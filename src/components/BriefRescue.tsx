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
 * `/quiz` and `/match` render on the client and reconcile the two, so
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
import Link from 'next/link';
import { Sheet, Wrap } from '@/components/oi';
import { loadBrief } from '@/modules/brief/store';
import { isBriefComplete } from '@/modules/brief/types';
import { saveBriefAction } from '@/app/quiz/actions';
import { PREVIEW_PARAM, encodePreviewBrief } from '@/modules/brief/preview-param';
import { useSiteT } from '@/components/app/i18n';
import { EXPERT_DICT } from '@/modules/i18n/site/expert';

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
  destination,
  previewable = false,
}: {
  destination?: string;
  /** The page can render from `?preview=` when the build has no database. */
  previewable?: boolean;
}) {
  const t = useSiteT(EXPERT_DICT);
  const dest = destination ?? t('rescue.defaultDest');
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
          /* A build with no database cannot store it — hand the page the
             brief in the address instead (modules/brief/preview-param). */
          if (result.noDatabase && previewable) {
            clearRescueAttempts();
            const url = new URL(window.location.href);
            url.searchParams.set(PREVIEW_PARAM, encodePreviewBrief(brief));
            // A full load: the client router's soft replace was cut short by
            // the page's own streaming boundary and landed back on the bare URL.
            window.location.replace(`${url.pathname}${url.search}`);
            return;
          }
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
  }, [router, previewable]);

  /* The customer side's look (owner, 10 Oct 2026: "make it more like our
     theme"): a soft card, a display heading, black pill actions. */
  const primary =
    'oi-cta inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full px-7 py-3 text-[15px] font-medium text-white no-underline';
  const secondary =
    'inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-transparent px-7 py-3 text-[15px] font-medium text-[var(--ink)] no-underline transition-colors hover:border-[var(--ink)]';

  const frame = (children: React.ReactNode) => (
    <main className="py-14 sm:py-20">
      <Wrap>
        <Sheet className="mx-auto max-w-[720px] rounded-[28px] px-6 py-10 sm:px-12 sm:py-14">{children}</Sheet>
      </Wrap>
    </main>
  );

  if (phase === 'checking' || phase === 'restoring') {
    return frame(
      <div className="flex items-start gap-5">
        <span
          aria-hidden
          className="mt-1 h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--acc)] motion-reduce:animate-none"
        />
        <div>
          <p className="oi-eyebrow m-0">{t('rescue.picking')}</p>
          <p className="m-0 mt-3 max-w-[46ch] text-[16px] leading-relaxed text-[var(--ink2)]">
            {t('rescue.pickingBody', { dest })}
          </p>
        </div>
      </div>,
    );
  }

  if (phase === 'failed') {
    return frame(
      <>
        <h1 className="oi-display m-0 mb-4 max-w-[20ch] text-[clamp(1.9rem,1.2rem+2.4vw,2.9rem)] leading-[1.08]">
          {t('rescue.failedH1')}
        </h1>
        <p className="m-0 mb-8 max-w-[54ch] text-[16.5px] leading-relaxed text-[var(--ink2)]">
          {t('rescue.failedBody')}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={primary}
            onClick={() => {
              clearRescueAttempts();
              router.refresh();
            }}
          >
            {t('rescue.retry')}
          </button>
          <Link href="/match" className={secondary}>
            {t('rescue.back')}
          </Link>
        </div>
      </>,
    );
  }

  return frame(
    <>
      <h1 className="oi-display m-0 mb-4 max-w-[20ch] text-[clamp(1.9rem,1.2rem+2.4vw,2.9rem)] leading-[1.08]">
        {t('rescue.emptyH1')}
      </h1>
      <p className="m-0 mb-8 max-w-[54ch] text-[16.5px] leading-relaxed text-[var(--ink2)]">
        {t('rescue.emptyBody', { dest })}
      </p>
      <Link href="/quiz" className={primary}>
        {t('rescue.answer')}
      </Link>
    </>,
  );
}
