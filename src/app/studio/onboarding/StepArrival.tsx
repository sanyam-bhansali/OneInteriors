'use client';

import { useEffect, useState } from 'react';

/**
 * The acknowledgement you land on after finishing a step.
 *
 * ## Why a step needs a goodbye as well as a hello
 *
 * Pressing Continue used to swap one long form for another long form. Nothing
 * said the step you just spent four minutes on had been accepted — the only
 * evidence was a tick in a rail you had already scrolled past, and the studio
 * arrived on the next screen still half-wondering whether the last one had
 * taken. Finishing something is the good part of a five-step flow and it was
 * the part with no feedback at all.
 *
 * ## It is verified, not taken on trust
 *
 * The step that was finished arrives in the query string, which anybody can
 * type. So the server re-derives it from `assessSteps` before rendering this
 * at all: `?done=portfolio` prints nothing unless Portfolio genuinely passes.
 * A congratulation for work that was not done is worse than silence, and this
 * is exactly the sort of thing that would otherwise be discovered by a studio
 * being told they had finished a step the submit button later refuses.
 *
 * ## Why it clears the URL
 *
 * `history.replaceState` drops the parameter on arrival. Without it the
 * banner is stuck to the address: a refresh re-congratulates you, the back
 * button re-congratulates you, and a bookmarked or shared URL carries a
 * celebration for something that happened last week.
 *
 * It fades rather than being dismissible. A close button on a message that
 * removes itself in seven seconds is a control that mostly gets clicked by
 * accident, and there is nothing underneath it to uncover.
 */
export function StepArrival({ finished, remaining }: { finished: string; remaining: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    /* Not during render: replaceState is a side effect on the document, and
       React may run a render more than once before committing it. */
    const url = new URL(window.location.href);
    if (url.searchParams.has('done')) {
      url.searchParams.delete('done');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }

    const timer = setTimeout(() => setVisible(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  return (
    /* No `role="status"` here, unlike the save flash. This banner is present
       in the server-rendered HTML, so it is read in normal document order on
       arrival — and a live region that already has content when the page
       loads is one most screen readers will not announce anyway. Marking it
       live would be a claim about behaviour that does not happen. */
    <div
      className={`mb-6 overflow-hidden transition-[opacity,max-height,margin] duration-500 ease-out motion-reduce:transition-none ${
        visible ? 'max-h-32 opacity-100' : 'mb-0 max-h-0 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3 rounded-[12px] border border-[var(--color-ontrack)]/30 bg-[var(--color-ontrack-soft)] px-5 py-3.5">
        <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--color-ontrack)] text-white">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3">
            <path
              d="M3.5 8.5 L6.5 11.5 L12.5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="m-0 text-[14.5px] leading-relaxed text-[var(--color-ink)]">
          <span className="font-semibold">{finished} is done.</span>{' '}
          <span className="text-[var(--color-ink-2)]">
            {remaining === 0
              ? 'That is everything — this last step is ours.'
              : remaining === 1
                ? 'One step after this one.'
                : `${remaining} steps after this one.`}
          </span>
        </p>
      </div>
    </div>
  );
}
