'use client';

import { useActionState, useState } from 'react';
import { reviewArchiveAction, openArchiveFileAction } from './actions';
import type { RecordResult } from '@/modules/verification/record';
// Values AND types from the pure module, never from the `server-only` store —
// see tests/server-only-boundary.test.ts for what that costs.
import { MIN_QUOTATIONS_TO_SEND, type ArchiveState } from '@/modules/studio/quotation-archive';
import {
  ANALYSIS_COPY,
  isAnalysisState,
  type FiledRateView,
} from '@/modules/quotation/analysis-states';
import { RateReview } from './RateReview';

export interface ArchiveRow {
  id: string;
  state: ArchiveState;
  quotationCount: number | null;
  note: string | null;
  uploadedAt: string;
  files: { id: string; filename: string; bytes: number }[];
  /** What the automatic reader did, separate from what ops has done. */
  analysisState: string;
  analysisError: string | null;
  /** Derived and awaiting a person. Empty when nothing has been read. */
  pendingRates: FiledRateView[];
}

const STATES: { value: ArchiveState; label: string; help: string }[] = [
  { value: 'RECEIVED', label: 'Received', help: 'Nobody has opened them yet.' },
  { value: 'READING', label: 'Reading', help: 'You are working through them. The studio sees this.' },
  { value: 'FILED', label: 'Filed', help: 'Rates derived and entered against their rate card.' },
  { value: 'REJECTED', label: 'Cannot use', help: 'Too few, unreadable, or not quotations. Needs a reason.' },
];

/**
 * What a studio sent, and what we did with it.
 *
 * ## Why the files are opened one at a time through an action
 *
 * These are private-bucket objects holding a studio's entire pricing history.
 * A signed URL rendered into the page would sit in the HTML for anyone with
 * the tab open, get copied into a bug report, and live in the Next cache. So
 * the link is minted on click, by a server action that checks the ops role
 * itself, and is valid for five minutes.
 *
 * ## Why the count is typed rather than counted
 *
 * One workbook can hold two hundred quotations; one PDF holds one. File count
 * says nothing about whether there is enough here to derive a rate from, and a
 * number the software guesses wrong is worse than a number a person read off
 * the sheet.
 */
export function ArchiveReview({ archives }: { archives: ArchiveRow[] }) {
  if (archives.length === 0) {
    return (
      <p className="m-0 text-[14px] italic text-[var(--color-ink-3)]">
        Nothing sent. They are filling the rate card in by hand, which is fine — the archive is an
        offer, not a requirement.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {archives.map((a) => (
        <ArchiveCard key={a.id} archive={a} />
      ))}
    </div>
  );
}

function ArchiveCard({ archive }: { archive: ArchiveRow }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<RecordResult | null, FormData>(
    async (prev, fd) => {
      const r = await reviewArchiveAction(prev, fd);
      if (r.ok) setOpen(false);
      return r;
    },
    null,
  );

  const thin =
    archive.quotationCount !== null && archive.quotationCount < MIN_QUOTATIONS_TO_SEND;

  return (
    <div className="rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-5">
      {/* What the reader did, before what ops did. Two axes: an archive can
          be fully read and still untouched by a person, which is the normal
          case and the whole reason these are separate columns. */}
      <AnalysisLine state={archive.analysisState} error={archive.analysisError} />

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <p className="m-0 text-[14.5px] text-[var(--color-ink)]">
          {archive.files.length} file{archive.files.length === 1 ? '' : 's'}
          {archive.quotationCount !== null ? (
            <>
              {' · '}
              <span className="tabular font-[family-name:var(--font-mono)]">
                {archive.quotationCount}
              </span>{' '}
              quotations
            </>
          ) : null}
          {' · '}
          <span className="text-[var(--color-ink-2)]">
            {new Date(archive.uploadedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </p>
        <span className="rounded-full border border-[var(--color-rule)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-2)]">
          {archive.state}
        </span>
      </div>

      {thin ? (
        <p className="m-0 mb-3 border-l-2 border-[var(--color-brass)] pl-3 text-[13px] leading-snug text-[var(--color-ink-2)]">
          Below {MIN_QUOTATIONS_TO_SEND}. A rate taken from this few is one designer&rsquo;s mood
          — worth telling them what else to send rather than deriving from it.
        </p>
      ) : null}

      <ul className="m-0 mb-4 flex list-none flex-col gap-1 p-0">
        {archive.files.map((f) => (
          <li key={f.id}>
            <FileLink id={f.id} filename={f.filename} bytes={f.bytes} />
          </li>
        ))}
      </ul>

      {archive.note ? (
        <p className="m-0 mb-3 text-[13px] leading-snug text-[var(--color-ink-2)]">
          <span className="label">Told them:</span> {archive.note}
        </p>
      ) : null}

      {open ? (
        <form action={action} className="flex flex-col gap-3 border-t border-[var(--color-rule)] pt-4">
          <input type="hidden" name="archiveId" value={archive.id} />

          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">State</legend>
            <div className="flex flex-col gap-1.5">
              {STATES.map((s) => (
                <label key={s.value} className="flex cursor-pointer items-start gap-2 text-[13px]">
                  <input
                    type="radio"
                    name="state"
                    value={s.value}
                    defaultChecked={s.value === archive.state}
                    required
                    className="mt-0.5 accent-[var(--color-petrol)]"
                  />
                  <span>
                    <span className="text-[var(--color-ink)]">{s.label}</span>
                    <span className="block text-[11.5px] leading-snug text-[var(--color-ink-3)]">
                      {s.help}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`count-${archive.id}`} className="label m-0 mb-1.5 block">
              How many quotations are actually in there?
            </label>
            <input
              id={`count-${archive.id}`}
              name="quotationCount"
              type="number"
              min={0}
              defaultValue={archive.quotationCount ?? ''}
              className="tabular w-32 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 font-[family-name:var(--font-mono)] text-[13.5px]"
            />
          </div>

          <div>
            <label htmlFor={`note-${archive.id}`} className="label m-0 mb-1.5 block">
              What the studio is told — word for word
            </label>
            <textarea
              id={`note-${archive.id}`}
              name="note"
              rows={3}
              defaultValue={archive.note ?? ''}
              placeholder="Fourteen of these are revised versions of the same four projects, so there are really only nine. Send anything from before March and we will have enough."
              className="w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[13.5px]"
            />
          </div>

          {state && !state.ok ? (
            <p role="alert" className="m-0 text-[13px] leading-snug text-[var(--color-atrisk)]">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[var(--color-petrol)] px-4 py-2 text-[13.5px] font-medium text-[var(--color-paper)] disabled:opacity-40"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] text-[var(--color-ink-2)] underline underline-offset-4"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13px] text-[var(--color-ink)] hover:border-[var(--color-petrol)]"
        >
          Record what you found
        </button>
      )}

      {/* Below the file list and the record form, because the judgement it
          asks for depends on having opened the files first. */}
      {archive.pendingRates.length > 0 ? (
        <div className="mt-5">
          <RateReview
            archiveId={archive.id}
            rates={archive.pendingRates}
            quotationsRead={archive.quotationCount}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * What the reader made of this archive.
 *
 * Separate from the state ops sets, and shown above it, because it is the
 * thing that happened first. An archive can be fully read and still untouched
 * by a person — that is the normal case, and one column could not say it.
 *
 * The error is shown verbatim to ops and never to the studio: it names the
 * failure in our terms ("the reader timed out", a status code), which is
 * useful to somebody who can act on it and alarming to somebody who cannot.
 */
function AnalysisLine({ state, error }: { state: string; error: string | null }) {
  if (!isAnalysisState(state) || state === 'NOT_STARTED') return null;
  const copy = ANALYSIS_COPY[state];

  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span
        className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${
          state === 'READ'
            ? 'bg-[var(--color-ontrack-soft)] text-[var(--color-ontrack)]'
            : state === 'FAILED'
              ? 'bg-[var(--color-brass-soft)] text-[var(--color-brass)]'
              : 'bg-[var(--color-paper-3)] text-[var(--color-ink-2)]'
        }`}
      >
        {copy.label}
      </span>
      {error ? (
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-ink-3)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A download link minted on click.
 *
 * `window.open` with the URL the action returns, rather than rendering an
 * anchor with a signed URL in it — see the note at the top about why these
 * must not sit in the page source.
 */
function FileLink({ id, filename, bytes }: { id: string; filename: string; bytes: number }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <span className="flex flex-wrap items-baseline gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          const url = await openArchiveFileAction(id);
          setBusy(false);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
          else setFailed(true);
        }}
        className="text-[13.5px] text-[var(--color-petrol)] underline underline-offset-4 disabled:opacity-40"
      >
        {busy ? 'Opening…' : filename}
      </button>
      <span className="tabular font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-ink-3)]">
        {Math.max(1, Math.round(bytes / 1024))} KB
      </span>
      {failed ? (
        <span role="alert" className="text-[12px] text-[var(--color-atrisk)]">
          Could not open that one.
        </span>
      ) : null}
    </span>
  );
}
