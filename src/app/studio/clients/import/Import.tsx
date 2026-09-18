'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  parseCsv,
  guessMapping,
  planImport,
  COLUMN_LABELS,
  type ColumnKey,
} from '@/modules/studio-practice/csv';
import { importCsvAction, type ImportState } from './actions';

/** Lives here rather than in `actions.ts`, which exports only its action. */
const IMPORT_IDLE: ImportState = { idle: true };

/**
 * Bringing in a studio's existing list.
 *
 * ## Three screens, and the middle one is the point
 *
 * Pick a file → say what the columns are → see exactly what will happen →
 * agree. The mapping screen exists because every guess this software makes
 * about somebody else's spreadsheet is a guess, and a wrong guess that runs
 * silently writes two hundred clients called "9876543210".
 *
 * The plan screen exists for the same reason in reverse: an import that
 * reports what it did *afterwards* is an import nobody runs a second time,
 * because the first time cost them an evening of undoing.
 *
 * ## Nothing is written until the last click
 *
 * Everything up to that point is parsing in the browser. The person can go
 * back, change a column, and look again as many times as they like. The file
 * never leaves the machine until they press the button that says how many
 * rows it is about to write.
 */

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

const KEYS = Object.keys(COLUMN_LABELS) as ColumnKey[];

/** Cells long enough to break the preview table's layout are clipped for show only. */
function short(cell: string): string {
  return cell.length > 40 ? `${cell.slice(0, 40)}…` : cell;
}

export function Import() {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnKey[]>([]);
  const [readError, setReadError] = useState('');
  const [state, setState] = useState<ImportState>(IMPORT_IDLE);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => (text ? parseCsv(text) : []), [text]);
  const headers = rows[0] ?? [];
  const sample = rows.slice(1, 4);

  const plan = useMemo(
    () => (rows.length > 1 && mapping.length > 0 ? planImport(rows, mapping) : null),
    [rows, mapping],
  );

  function load(raw: string, name: string) {
    const parsed = parseCsv(raw);
    if (parsed.length < 2) {
      setReadError('That file has a header and nothing under it.');
      return;
    }
    setReadError('');
    setFileName(name);
    setText(raw);
    setMapping(guessMapping(parsed[0] ?? []));
    setState(IMPORT_IDLE);
  }

  async function onFile(file: File) {
    if (file.size > 900_000) {
      setReadError('That file is larger than we can take in one go. Split it in half.');
      return;
    }
    load(await file.text(), file.name);
  }

  function startOver() {
    setText('');
    setFileName('');
    setMapping([]);
    setReadError('');
    setState(IMPORT_IDLE);
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Done ─────────────────────────────────────────────────────
  if ('ok' in state && state.ok) {
    return (
      <div className="s-card max-w-[46rem] p-6">
        <p className="m-0 text-[15.5px] font-semibold">
          {state.written === 0
            ? 'Nothing new to add.'
            : `${state.written} ${state.written === 1 ? 'client' : 'clients'} added.`}
        </p>

        <ul className="mt-3 mb-0 flex list-none flex-col gap-1.5 p-0 text-[14px] text-[var(--s-ink-2)]">
          {state.alreadyHere > 0 ? (
            <li>
              <span className="s-num">{state.alreadyHere}</span> were already on your list — same
              phone number. Those were left exactly as they are, not merged.
            </li>
          ) : null}
          {state.duplicatesInFile > 0 ? (
            <li>
              <span className="s-num">{state.duplicatesInFile}</span> appeared twice in the file
              itself. Added once.
            </li>
          ) : null}
          {state.skippedNoName > 0 ? (
            <li>
              <span className="s-num">{state.skippedNoName}</span> had no name, so there was nobody
              to add. Those rows are still in your file.
            </li>
          ) : null}
        </ul>

        {/* Where they go next is the actual point. An import that lands two
            hundred rows in a pool and then says "done" has moved the problem,
            not solved it. */}
        <p className="mt-4 mb-0 max-w-[58ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          Everyone arrived unassigned, so nobody has quietly become your problem. Share them out
          from the list, and put a date on the ones worth a call this week.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/studio/clients" className={`${primary} no-underline`}>
            Go to the list
          </Link>
          <button type="button" onClick={startOver} className={quiet}>
            Import another file
          </button>
        </div>
      </div>
    );
  }

  // ── Pick a file ──────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="s-card max-w-[46rem] p-6">
        <p className="m-0 mb-2 text-[15.5px] font-semibold">Bring your list with you.</p>
        <p className="m-0 max-w-[60ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
          A CSV out of Excel, Google Sheets, or whatever you are using now. Nothing is written
          until you have seen exactly what it is going to do — you get to change every column
          first, and nothing gets merged over the top of a client you already have.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="s-label">Choose a file</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
              className={input}
            />
          </label>

          <details className="text-[13.5px] text-[var(--s-ink-2)]">
            <summary className="cursor-pointer">Or paste the rows instead</summary>
            <textarea
              rows={6}
              placeholder={'Name,Phone,Society\nMrs Kothari,98765 43210,Kalyani Nagar'}
              onChange={(e) => {
                const v = e.target.value;
                if (v.trim().length > 0) load(v, 'pasted rows');
              }}
              className={`${input} mt-2 w-full font-[family-name:var(--font-mono,monospace)] text-[13px]`}
            />
          </details>
        </div>

        {readError ? (
          <p role="alert" className="mt-3 mb-0 text-[13px] text-[var(--s-bad)]">
            {readError}
          </p>
        ) : null}
      </div>
    );
  }

  // ── Map the columns, then confirm ────────────────────────────
  const mapped = new Set(mapping.filter((m) => m !== 'skip'));

  return (
    <div className="flex max-w-[64rem] flex-col gap-5">
      <div className="s-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="m-0 text-[15.5px] font-semibold">What is in each column?</p>
          <p className="m-0 text-[13px] text-[var(--s-ink-2)]">
            {fileName} · <span className="s-num">{rows.length - 1}</span> rows
          </p>
        </div>

        <p className="m-0 mt-2 max-w-[60ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          These are our guesses from your headings. Change any that are wrong, and set anything you
          do not want to <em>Do not import</em>.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-[var(--s-rule)] p-2 text-left align-bottom"
                  >
                    <span className="s-label block truncate" title={h}>
                      {h.trim() || `Column ${i + 1}`}
                    </span>
                    <select
                      aria-label={`What is in the column "${h.trim() || i + 1}"?`}
                      value={mapping[i] ?? 'skip'}
                      onChange={(e) => {
                        const next = [...mapping];
                        const chosen = e.target.value as ColumnKey;
                        // One column per field. Picking a field that is already
                        // taken moves it, rather than creating two columns that
                        // both claim to be the phone number.
                        if (chosen !== 'skip') {
                          for (let j = 0; j < next.length; j += 1) {
                            if (j !== i && next[j] === chosen) next[j] = 'skip';
                          }
                        }
                        next[i] = chosen;
                        setMapping(next);
                      }}
                      className={`${input} mt-1.5 w-full py-1.5 text-[13px]`}
                    >
                      {KEYS.map((k) => (
                        <option key={k} value={k}>
                          {COLUMN_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.map((r, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-[var(--s-rule)] p-2 align-top ${
                        mapping[ci] === 'skip' ? 'text-[var(--s-ink-3)] line-through' : ''
                      }`}
                    >
                      {short(r[ci] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!mapped.has('name') ? (
          <p role="alert" className="mt-3 mb-0 text-[13px] text-[var(--s-bad)]">
            Nothing is set to Name yet, so there is nobody to import.
          </p>
        ) : null}
      </div>

      {plan && mapped.has('name') ? (
        <div className="s-card p-6">
          <p className="m-0 text-[15.5px] font-semibold">
            This will add <span className="s-num">{plan.rows.length}</span>{' '}
            {plan.rows.length === 1 ? 'client' : 'clients'}.
          </p>

          <ul className="mt-2 mb-0 flex list-none flex-col gap-1 p-0 text-[13.5px] text-[var(--s-ink-2)]">
            <li>
              Read <span className="s-num">{plan.read}</span> rows.
            </li>
            {plan.skippedNoName > 0 ? (
              <li>
                <span className="s-num">{plan.skippedNoName}</span> have no name and will be left
                out.
              </li>
            ) : null}
            {plan.duplicatesInFile > 0 ? (
              <li>
                <span className="s-num">{plan.duplicatesInFile}</span> repeat a phone number already
                in the file and will be added once.
              </li>
            ) : null}
            <li>
              Anyone already on your list with the same number is left alone — nothing is merged
              over the top of work you have already done.
            </li>
          </ul>

          <p className="s-label mt-4 mb-2">The first few, as they will be saved</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  {(['name', 'phone', 'society', 'config'] as const).map((k) => (
                    <th
                      key={k}
                      scope="col"
                      className="s-label border-b border-[var(--s-rule)] p-2 text-left"
                    >
                      {COLUMN_LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    <td className="border-b border-[var(--s-rule)] p-2">{short(r.name)}</td>
                    <td className="border-b border-[var(--s-rule)] p-2">
                      {r.phone ? (
                        <span className="s-num">{r.phone}</span>
                      ) : (
                        // Worth saying rather than leaving blank: a column of
                        // these means the phone column is mapped wrong, and
                        // that is far easier to see here than afterwards.
                        <span className="text-[var(--s-ink-3)]">no usable number</span>
                      )}
                    </td>
                    <td className="border-b border-[var(--s-rule)] p-2">{short(r.society ?? '—')}</td>
                    <td className="border-b border-[var(--s-rule)] p-2">{short(r.config ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setState(await importCsvAction(text, mapping));
                })
              }
              className={primary}
            >
              {pending ? 'Adding…' : `Add ${plan.rows.length}`}
            </button>
            <button type="button" onClick={startOver} disabled={pending} className={quiet}>
              Use a different file
            </button>
          </div>

          {'ok' in state && !state.ok ? (
            <p role="alert" className="mt-3 mb-0 text-[13px] text-[var(--s-bad)]">
              {state.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
