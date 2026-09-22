'use client';

import { useActionState, useRef, useState } from 'react';
import { uploadQuotationsAction, type UploadState } from './actions';
import {
  MIN_QUOTATIONS_TO_SEND,
  studioMessage,
  type ArchiveState,
} from '@/modules/studio/quotation-archive';

const INITIAL: UploadState = { status: 'idle' };

export interface ArchiveView {
  /** What the automatic reader has done, as opposed to what ops has. */
  analysisState: string;
  state: ArchiveState;
  quotationCount: number | null;
  fileCount: number;
  note: string | null;
  files: { id: string; filename: string; bytes: number }[];
}

/**
 * "Send us your old quotations and we will build this page for you."
 *
 * ## Why this sits above the manual form rather than replacing it
 *
 * Forty rates typed from memory is the worst part of onboarding, and the
 * numbers a studio types under that kind of fatigue are worse than the numbers
 * they actually charge — they round, they guess, they put in what they wish
 * they charged. Their own past quotations are the truth, and they already
 * exist.
 *
 * But the manual form is never taken away, in any state. While we are reading
 * the files, the form is the only route forward, and a studio blocked on us
 * for a week because we hid it is a studio that stops.
 *
 * ## Why it does not promise anything about timing beyond "a few days"
 *
 * Because a person opens these by hand. There is no parser: quotation formats
 * differ per studio, and a parser that is wrong produces a plausible rate
 * rather than an error, which then prices somebody's home. At ten studios a
 * person reading them is both affordable and more accurate — and the one thing
 * we must not do is dress that up as instant.
 */
export function ArchivePanel({
  archive,
  minForRates,
  enabled,
}: {
  archive: ArchiveView | null;
  minForRates: number;
  /** False when storage is not configured on this deployment. */
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(uploadQuotationsAction, INITIAL);
  const [chosen, setChosen] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  if (!enabled && !archive) return null;

  return (
    <div className="rounded-[14px] border border-[var(--color-petrol)] bg-[var(--color-paper-2)] p-6">
      <p className="label m-0 mb-2 text-[var(--color-petrol)]">Instead of typing all of this</p>
      <p className="h3 m-0 mb-3">Send us your past quotations.</p>

      <p className="m-0 mb-4 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
        {MIN_QUOTATIONS_TO_SEND} or more and we will read them and fill this page in from your own
        numbers — what you actually charged, not what you can remember charging at nine in the
        evening. Any format: Excel, PDF, Word, photographs of printed ones. A person opens them,
        so anything you can open, we can.
      </p>

      {/* This paragraph used to say "read by us and nobody else". That became
          untrue the moment the extractor was switched on: the documents go to
          Anthropic's API whole, because whole documents extract far more
          reliably from the layouts studios actually use than stripped line
          items do.

          The choice was made deliberately and the disclosure is the other
          half of it. A studio handing over their back catalogue is handing
          over their pricing and their clients' names, and finding out later
          where it went would be a betrayal of exactly the trust this page
          asks for. It is stated here, before the upload control, not in a
          policy nobody opens. */}
      <p className="m-0 mb-5 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
        They are never published, never shown to another studio, never shown to a customer, and
        never used for anything but building the rates below. To read them we send them to
        Anthropic, the company whose software does the reading — they are not used to train
        anything, and nobody there is looking at your pricing. If you would rather they did not
        leave us, say so and we will read them by hand instead.
      </p>

      {archive ? (
        <div className="mb-5 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-5">
          <p className="label m-0 mb-2">
            {archive.state === 'REJECTED' ? 'We could not use these' : 'What you have sent'}
          </p>
          <p className="m-0 mb-3 max-w-[60ch] text-[14px] leading-relaxed text-[var(--color-ink)]">
            {studioMessage(archive, minForRates)}
          </p>
          {archive.files.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {archive.files.map((f) => (
                <li key={f.id} className="text-[13px] text-[var(--color-ink-2)]">
                  {f.filename}{' '}
                  <span className="tabular font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-ink-3)]">
                    {Math.max(1, Math.round(f.bytes / 1024))} KB
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {enabled ? (
        <form action={action} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="quotations"
              className="inline-block cursor-pointer rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-2.5 text-[14.5px] text-[var(--color-ink)] hover:border-[var(--color-petrol)]"
            >
              {archive ? 'Add more files' : 'Choose files'}
            </label>
            <input
              ref={input}
              id="quotations"
              name="quotations"
              type="file"
              multiple
              onChange={(e) => setChosen(e.target.files?.length ?? 0)}
              className="sr-only"
            />
            {chosen > 0 ? (
              <span className="ml-3 text-[14px] text-[var(--color-ink-2)]">
                {chosen} file{chosen === 1 ? '' : 's'} ready
              </span>
            ) : null}
          </div>

          {chosen > 0 ? (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-[var(--color-petrol)] px-5 py-2.5 text-[14.5px] font-medium text-[var(--color-paper)] disabled:opacity-40"
              >
                {pending ? 'Sending…' : `Send ${chosen} file${chosen === 1 ? '' : 's'}`}
              </button>
              {/* Large files over a slow connection. Saying so beats a button
                  that looks stuck. */}
              {pending ? (
                <span className="text-[13px] text-[var(--color-ink-2)]">
                  This can take a minute. Do not close the tab.
                </span>
              ) : null}
            </div>
          ) : null}

          {state.status === 'saved' ? (
            <p className="m-0 text-[14px] leading-relaxed text-[var(--color-ontrack)]">
              {state.message}
            </p>
          ) : null}

          {state.status === 'error' ? (
            <p role="alert" className="m-0 text-[14px] leading-relaxed text-[var(--color-atrisk)]">
              {state.message}
            </p>
          ) : null}

          {/* Named individually, because "3 files could not be sent" tells a
              studio nothing about which three or what to do next. */}
          {state.skipped && state.skipped.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {state.skipped.map((s) => (
                <li key={s} className="text-[13px] leading-snug text-[var(--color-atrisk)]">
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      ) : null}

      <p className="m-0 mt-5 border-t border-[var(--color-rule)] pt-4 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
        Fewer than {MIN_QUOTATIONS_TO_SEND}, or would rather not send them? Fill the rates in
        yourself below. It is the same rate card either way, and you can change any number on it
        whenever you like.
      </p>
    </div>
  );
}
