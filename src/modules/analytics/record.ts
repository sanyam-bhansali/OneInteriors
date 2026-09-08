import 'server-only';

/**
 * Writing and reading funnel events.
 *
 * Ours rather than a third-party script, for a reason that is legal before it
 * is technical: under the DPDP Act the cheapest defensible position is not to
 * ship visitor data to anyone else at all. Everything we actually need — which
 * quiz question loses people, what a qualified lead cost — is answerable from
 * our own rows, and those rows never leave our database.
 *
 * **Recording an event can never fail a request.** Every write is wrapped and
 * swallowed. An analytics outage that takes down the quiz would cost more than
 * every insight this table will ever produce.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { readAnonKey } from '@/modules/brief/repository';
import { getCurrentUser } from '@/modules/auth/session';
import { sanitiseProps, stepFunnel, type EventName, type EventProps } from './events';

export async function record(
  name: EventName,
  props: EventProps = {},
  briefId?: string,
): Promise<void> {
  if (!hasDatabase()) return;

  try {
    const [anonKey, user] = await Promise.all([readAnonKey(), getCurrentUser()]);

    await prisma.analyticsEvent.create({
      data: {
        name,
        anonKey,
        userId: user?.id ?? null,
        briefId: briefId ?? null,
        // Sanitised rather than validated-and-rejected: a bad prop should cost
        // that field, not the whole event.
        props: sanitiseProps(props),
      },
    });
  } catch {
    // Deliberately silent. See the note above.
  }
}

export interface FunnelSummary {
  quizStarts: number;
  quizCompletions: number;
  completionRate: number | null;
  steps: ReturnType<typeof stepFunnel>;
  enquiries: number;
}

/**
 * The funnel, for the ops console.
 *
 * Rates are null rather than zero when the denominator is empty — a completion
 * rate of "0%" on a day nobody visited reads as a catastrophe, and a
 * dashboard that cries wolf gets ignored on the day it is right.
 */
export async function funnelSummary(sinceDays = 30, quizSteps = 9): Promise<FunnelSummary> {
  if (!hasDatabase()) {
    return { quizStarts: 0, quizCompletions: 0, completionRate: null, steps: [], enquiries: 0 };
  }

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.analyticsEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { name: true, props: true },
  });

  const views: Record<number, number> = {};
  const completions: Record<number, number> = {};
  let quizStarts = 0;
  let quizCompletions = 0;
  let enquiries = 0;

  for (const row of rows) {
    const step = readStep(row.props);

    switch (row.name) {
      case 'quiz.start':
        quizStarts += 1;
        break;
      case 'quiz.complete':
        quizCompletions += 1;
        break;
      case 'enquiry.sent':
        enquiries += 1;
        break;
      case 'quiz.step.view':
        if (step !== null) views[step] = (views[step] ?? 0) + 1;
        break;
      case 'quiz.step.complete':
        if (step !== null) completions[step] = (completions[step] ?? 0) + 1;
        break;
      default:
        break;
    }
  }

  return {
    quizStarts,
    quizCompletions,
    completionRate: quizStarts === 0 ? null : quizCompletions / quizStarts,
    steps: stepFunnel(views, completions, quizSteps),
    enquiries,
  };
}

function readStep(props: unknown): number | null {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;
  const value = (props as Record<string, unknown>).step;
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
