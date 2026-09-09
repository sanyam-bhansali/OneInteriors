'use client';

/**
 * The bridge between the two places a brief lives.
 *
 * ## The problem this exists to end
 *
 * A brief has two homes and they can disagree:
 *
 *  - **The browser.** `sessionStorage`, written synchronously on every answer.
 *    This is the copy that is always right, because it is written before the
 *    customer sees the next question.
 *  - **Postgres.** Written by a server action that is deliberately
 *    fire-and-forget, because a slow database must never make Continue feel
 *    broken. `saveBrief` swallows its own failures for the same reason.
 *
 * `/quiz`, `/tier` and `/match` render on the client and reconcile the two, so
 * they work whichever copy exists. `/quotes`, `/compare` and `/expert` render
 * on the server and can only see Postgres. So any time the server copy is
 * missing — a dropped write, a claim that did not attach, a sign-in that
 * arrived from a different tab — those three pages concluded the brief did not
 * exist, and the only button on that screen sent the customer back to question
 * one. Nine questions answered, and the product acts like it never met them.
 *
 * ## What it does instead
 *
 * Look in sessionStorage. If a finished brief is sitting there, push it to the
 * server and refresh the page the customer was already trying to read. They see
 * a moment of "one second" and then their quotes — which is the truth, because
 * the answers were never actually lost.
 *
 * Only when the browser has nothing either do we say so, and even then we say
 * what happened rather than silently restarting them.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Button } from '@/components/ui';
import { loadBrief } from '@/modules/brief/store';
import { isBriefComplete } from '@/modules/brief/types';
import { saveBriefAction } from '@/app/quiz/actions';

type Phase = 'checking' | 'restoring' | 'empty' | 'failed';

/**
 * How many times we will try to hand the brief over before giving up.
 *
 * Without this the page can spin forever: the server says it has no brief, we
 * push one and refresh, the server still says it has no brief, and the
 * component remounts fresh with its state reset. That is a loop with no exit
 * and no error — the worst kind. Two attempts, then we say so plainly.
 *
 * Counted in sessionStorage rather than component state precisely because the
 * refresh is what resets the state.
 */
const ATTEMPT_KEY = 'oi.rescue.attempts';
const MAX_ATTEMPTS = 2;

function attempts(): number {
  try {
    return Number(window.sessionStorage.getItem(ATTEMPT_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function noteAttempt(n: number): void {
  try {
    window.sessionStorage.setItem(ATTEMPT_KEY, String(n));
  } catch {
    /* private mode; the loop guard degrades to none, which is the old behaviour */
  }
}

/** Called once the page actually renders, so a later hiccup starts fresh. */
export function clearRescueAttempts(): void {
  try {
    window.sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    /* no-op */
  }
}

/**
 * Renders nothing; resets the loop guard.
 *
 * Dropped on the pages that only render once the brief was found, so a rescue
 * that worked does not leave a spent counter behind to make the next hiccup
 * look like a repeat failure.
 */
export function RescueSettled() {
  useEffect(() => {
    clearRescueAttempts();
  }, []);
  return null;
}

export function BriefRescue({
  /** What the customer was trying to reach. Shown so the wait has a reason. */
  destination = 'your quotes',
}: {
  destination?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');

  useEffect(() => {
    let cancelled = false;

    const local = loadBrief();
    if (!isBriefComplete(local)) {
      setPhase('empty');
      return;
    }

    const tried = attempts();
    if (tried >= MAX_ATTEMPTS) {
      // We pushed the brief and the server still cannot see it. Do not refresh
      // again — say what happened instead of spinning.
      setPhase('failed');
      return;
    }
    noteAttempt(tried + 1);

    setPhase('restoring');

    // `completedAt` is stamped when the last question is answered. If the
    // local copy somehow lacks it — an older shape, or a tab that closed
    // between the final answer and the stamp — set it now rather than syncing
    // a brief the server will immediately judge unfinished.
    const brief = local.completedAt
      ? local
      : { ...local, completedAt: new Date().toISOString() };

    void saveBriefAction(brief)
      .then((result) => {
        if (cancelled) return;
        if (!result.persisted) {
          setPhase('failed');
          return;
        }
        // Re-render the server page. It will find the brief this time.
        router.refresh();
      })
      .catch(() => {
        if (!cancelled) setPhase('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (phase === 'checking' || phase === 'restoring') {
    return (
      <main className="py-24">
        <Container size="narrow">
          <p className="m-0 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
            Picking up your brief…
          </p>
          <p className="m-0 mt-4 max-w-[46ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            Your answers were saved in this browser. We are attaching them to your account, then
            {' '}{destination} will load.
          </p>
        </Container>
      </main>
    );
  }

  if (phase === 'failed') {
    return (
      <main className="py-20">
        <Container size="narrow">
          <h1 className="h1 mb-4">We have your answers, but we could not save them just now.</h1>
          <p className="m-0 mb-8 max-w-[54ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
            Nothing is lost — they are still in this browser. This is our side, not yours. Try
            again in a moment, and if it keeps happening, tell us and we will sort it out.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => {
                clearRescueAttempts();
                router.refresh();
              }}
              size="lg"
            >
              Try again
            </Button>
            <Button href="/match" variant="secondary" size="lg">
              Back to your matches
            </Button>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main className="py-20">
      <Container size="narrow">
        <h1 className="h1 mb-4">We do not have your brief yet.</h1>
        <p className="m-0 mb-8 max-w-[54ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
          Either it was not finished, or it was answered in a different browser — briefs are held
          per browser until you sign in. Nine questions, three minutes, and {destination} follow
          immediately.
        </p>
        <Button href="/quiz" size="lg">
          Answer the questions
        </Button>
      </Container>
    </main>
  );
}
