'use client';

import { startTransition, useActionState, useRef } from 'react';
import { lookupSiteAction, type LookupState } from '@/app/apply/actions';

const INITIAL: LookupState = { status: 'idle' };

/**
 * Fill the description from the studio's own website.
 *
 * ## Why this reuses the application's action rather than getting its own
 *
 * `lookupSiteAction` is already the hardened path: the scraper refuses
 * private address ranges including the octal, hex, short-form and
 * trailing-dot spellings, revalidates every redirect hop by hand, and the
 * whole thing sits behind a shared rate limit. All of that exists because
 * `/apply` calls it with no session at all. A signed-in studio is a strictly
 * easier case, so a second action here would be a second thing to keep
 * hardened, and the one that gets forgotten is always the copy.
 *
 * ## What comes back is a suggestion
 *
 * It is scraped text about them, not a fact we have checked, and it is shown
 * to be accepted or ignored — never written into the box behind their back.
 * The same rule the application form follows, and `enrich.ts` labels it that
 * way for ops for the same reason. Overwriting a paragraph somebody has
 * already typed, on one button press, with text a robot found, is a way to
 * destroy the best thing on the page.
 *
 * ## Why it never submits the form
 *
 * `type="button"`, and the action called by hand. As a submit control it
 * would be the form's FIRST submit button, which is what Enter in any text
 * field activates — so pressing Enter while typing a studio name would fire a
 * web request at somebody's website instead of moving on.
 */
export function SiteLookup({
  onFound,
  hasText,
}: {
  onFound: (about: string) => void;
  /** Changes the offer's wording — replacing writing is not the same as filling a blank. */
  hasText: boolean;
}) {
  const [state, action, pending] = useActionState(lookupSiteAction, INITIAL);
  const button = useRef<HTMLButtonElement>(null);

  function run() {
    /* Read from the live form rather than from props. The website field is
       two sections further down and uncontrolled, so its current value lives
       in the DOM and nowhere else. */
    const form = button.current?.form;
    if (!form) return;
    const website = String(new FormData(form).get('website') ?? '').trim();

    const data = new FormData();
    data.set('website', website);
    /* `startTransition` because a `useActionState` action must be dispatched
       inside one — calling it directly from an event handler throws. */
    startTransition(() => action(data));
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        ref={button}
        type="button"
        onClick={run}
        disabled={pending}
        className="text-[13px] font-medium text-[var(--color-petrol)] underline underline-offset-4 transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {pending ? 'Reading your site…' : 'Fill this from my website'}
      </button>

      {state.status === 'found' && state.about ? (
        <div className="w-full rounded-[11px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3.5 text-left">
          <p className="label m-0 mb-1.5">Found on your site</p>
          <p className="m-0 mb-3 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
            {state.about}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onFound(state.about!)}
              className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-paper)] transition-opacity hover:opacity-90"
            >
              {hasText ? 'Replace what I wrote' : 'Use this'}
            </button>
            <span className="text-[12.5px] text-[var(--color-ink-3)]">
              {hasText
                ? 'Your own words are usually better — this is a starting point.'
                : 'Edit it afterwards. It is a starting point, not a profile.'}
            </span>
          </div>
        </div>
      ) : null}

      {state.status === 'nothing' || state.status === 'error' ? (
        <p className="m-0 max-w-[40ch] text-right text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
