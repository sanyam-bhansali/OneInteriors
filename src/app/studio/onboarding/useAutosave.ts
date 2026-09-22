'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** What the indicator beside the Save button is currently entitled to say. */
export type DraftState = 'clean' | 'typing' | 'saving' | 'saved' | 'failed';

/** How long a form sits still before its draft goes up. */
const QUIET_MS = 1200;

/**
 * Keep a form's contents on the server while it is being filled in.
 *
 * ## What it is for, and what it is not for
 *
 * It exists so that a closed tab, a dead battery or a mis-clicked back button
 * does not cost somebody the twenty minutes they just spent describing their
 * studio. It is **not** a replacement for the Save button, and it must never
 * be presented as one: the action it calls writes without validating, so a
 * successful draft save says only "your typing is on our server" and
 * specifically does not say "this step is finished". Those are two claims and
 * this file makes exactly one of them.
 *
 * ## Why on a quiet pause rather than per keystroke
 *
 * Literally saving each keystroke means a request per character, most of them
 * carrying a half-typed word that the next one replaces. A pause is the
 * cheapest reliable signal that a thought is finished. 1.2s is long enough to
 * cover the gap between words and short enough that a studio who types a
 * sentence and closes the laptop keeps the sentence.
 *
 * ## Why it listens on the form rather than to each field
 *
 * One listener on the form element catches `input` from every control inside
 * it, including ones added later — the chips, the locality picker, whatever
 * the step grows next. Wiring each field individually is how one control ends
 * up quietly not autosaving, and it is not discoverable by looking at it.
 *
 * ## The rules that stop it fighting the real submit
 *
 * - It never fires while an explicit submit is in flight. Two writes to the
 *   same row racing is a way to lose a field, and the validated one must win.
 * - It skips the run scheduled before a submit landed, because the submit has
 *   already stored a strictly better version of the same data.
 * - Only one request is outstanding at a time, and a change arriving during a
 *   request re-arms rather than overlapping. Requests can finish out of
 *   order; two in flight is a coin toss over whose copy of the form sticks.
 */
export function useAutosave(
  formRef: React.RefObject<HTMLFormElement | null>,
  save: (data: FormData) => Promise<void>,
  { pending }: { pending: boolean },
) {
  const [state, setState] = useState<DraftState>('clean');

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  /* Read inside the debounce callback, which closes over whatever `pending`
     was when the timer was set — a ref is the only way to see the value at
     the moment it fires rather than the one from 1.2 seconds ago. */
  const submitting = useRef(pending);
  submitting.current = pending;

  const flush = useCallback(async () => {
    const form = formRef.current;
    if (!form || inFlight.current || submitting.current) return;

    inFlight.current = true;
    setState('saving');
    try {
      await save(new FormData(form));
      setState('saved');
    } catch {
      /* Swallowed on purpose. A failed background save is not something to
         interrupt somebody mid-sentence about: their work is still in the
         form in front of them, the next pause tries again, and the Save
         button is unaffected. The indicator says so quietly and that is the
         whole of the response. */
      setState('failed');
    } finally {
      inFlight.current = false;
    }
  }, [formRef, save]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const onEdit = () => {
      setState('typing');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, QUIET_MS);
    };

    /* `input` covers typing; `change` covers the controls that do not emit
       input at all — checkboxes, radios, selects and the chip buttons. Both
       are needed, and both are cheap. */
    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);

    return () => {
      form.removeEventListener('input', onEdit);
      form.removeEventListener('change', onEdit);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [formRef, flush]);

  /* A real submit supersedes any pending draft: it writes the same fields,
     validated, and revalidates the tree afterwards. Letting the timer land on
     top of it would overwrite a checked write with an unchecked one. */
  useEffect(() => {
    if (!pending) return;
    if (timer.current) clearTimeout(timer.current);
    setState('clean');
  }, [pending]);

  return state;
}
