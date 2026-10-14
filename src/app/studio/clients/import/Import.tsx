'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  parseCsv,
  guessMapping,
  planImport,
  csvChunks,
  COLUMN_LABELS,
  type ColumnKey,
} from '@/modules/studio-practice/csv';
import { importCheckAction, importCsvAction, type ImportState } from './actions';
import { SOURCE_LABELS, type ClientSourceName } from '@/modules/studio-practice/vocabulary';

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

/* The design's field and buttons (studio-ui.css). */
const input = 'fld';
const primary = 'btn pri';
const quiet = 'btn sec';

const KEYS = Object.keys(COLUMN_LABELS) as ColumnKey[];

/** Cells long enough to break the preview table's layout are clipped for show only. */
function short(cell: string): string {
  return cell.length > 40 ? `${cell.slice(0, 40)}…` : cell;
}

export function Import({
  fields = [],
  sources = [],
}: {
  /** The studio's own fields, which a column can be mapped to. */
  fields?: { key: string; label: string }[];
  /** The studio's own source names. */
  sources?: { id: string; name: string }[];
}) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<string[]>([]);
  /* Where this list came from: one of ours (FACEBOOK…) or 'own:<id>'. Asked, because the analytics page counts it. */
  const [source, setSource] = useState('');
  const [readError, setReadError] = useState('');
  const [state, setState] = useState<ImportState>(IMPORT_IDLE);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  /* Leads at scale: a big file goes in pieces of 1,000 rows, one after
     another, with progress; the dry run says how many are already here. */
  const [progress, setProgress] = useState<{ done: number; of: number } | null>(null);
  const [already, setAlready] = useState<number | null>(null);
  const [checking, startCheck] = useTransition();

  function checkExisting(phones: string[]) {
    startCheck(async () => {
      let n = 0;
      for (let i = 0; i < phones.length; i += 5000) n += (await importCheckAction(phones.slice(i, i + 5000))).already;
      setAlready(n);
    });
  }

  async function addAll(own: string | null, src: string, total: number) {
    const pieces = csvChunks(rows, 1000);
    let written = 0;
    setProgress({ done: 0, of: total });
    for (let i = 0; i < pieces.length; i += 1) {
      const r = await importCsvAction(pieces[i]!, mapping, src, own);
      if (!('ok' in r) || !r.ok) {
        setProgress(null);
        const why = 'error' in r ? r.error : 'Something went wrong.';
        return setState({
          ok: false,
          error: `${why} Stopped after ${written.toLocaleString('en-IN')} added (piece ${i + 1} of ${pieces.length}). Importing the same file again is safe — anyone already added is skipped by phone number.`,
        });
      }
      written += r.written;
      setProgress({ done: Math.min(total, (i + 1) * 1000), of: total });
    }
    setProgress(null);
    setState({
      ok: true,
      written,
      alreadyHere: Math.max(0, total - written),
      skippedNoName: plan?.skippedNoName ?? 0,
      duplicatesInFile: plan?.duplicatesInFile ?? 0,
    });
  }

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
    setAlready(null);
    setState(IMPORT_IDLE);
  }

  async function onFile(file: File) {
    if (file.size > 25_000_000) {
      setReadError('That file is over 25 MB. Split it into two files and import each.');
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
      <div className="card" style={{ maxWidth: '46rem' }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
          {state.written === 0
            ? 'Nothing new to add.'
            : `${state.written} ${state.written === 1 ? 'client' : 'clients'} added.`}
        </p>

        <ul className="mt-3 mb-0 flex list-none flex-col gap-1.5 p-0 text-[14px] text-[var(--text2)]">
          {state.alreadyHere > 0 ? (
            <li>
              <span className="mono">{state.alreadyHere}</span> were already on your list — same
              phone number. Those were left exactly as they are, not merged.
            </li>
          ) : null}
          {state.duplicatesInFile > 0 ? (
            <li>
              <span className="mono">{state.duplicatesInFile}</span> appeared twice in the file
              itself. Added once.
            </li>
          ) : null}
          {state.skippedNoName > 0 ? (
            <li>
              <span className="mono">{state.skippedNoName}</span> had no name, so there was nobody
              to add. Those rows are still in your file.
            </li>
          ) : null}
        </ul>

        {/* Where they go next is the actual point. An import that lands two
            hundred rows in a pool and then says "done" has moved the problem,
            not solved it. */}
        <p className="mt-4 mb-0 max-w-[58ch] text-[14px] leading-relaxed text-[var(--text2)]">
          Everyone arrived unassigned, so nobody has quietly become your problem. Share them out
          from the list, and put a date on the ones worth a call this week.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/studio/clients" className={primary}>
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
      <div className="card" style={{ maxWidth: '46rem' }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Bring your list with you.</p>
        <p className="m-0 max-w-[60ch] text-[14.5px] leading-relaxed text-[var(--text2)]">
          A CSV out of Excel, Google Sheets, or whatever you are using now. Nothing is written
          until you have seen exactly what it is going to do — you get to change every column
          first, and nothing gets merged over the top of a client you already have. CSV only: in
          Excel, use File, Save As, CSV. Big files are fine — 26,000 rows go in pieces of 1,000.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="lbl">Choose a file</span>
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

          <details className="text-[13.5px] text-[var(--text2)]">
            <summary className="cursor-pointer">Or paste the rows instead</summary>
            <textarea
              rows={6}
              placeholder={'Name,Phone,Society\nMrs Kothari,98765 43210,Kalyani Nagar'}
              onChange={(e) => {
                const v = e.target.value;
                if (v.trim().length > 0) load(v, 'pasted rows');
              }}
              className={`${input} mono`} style={{ marginTop: 8, padding: 12, minHeight: 120 }}
            />
          </details>
        </div>

        {readError ? (
          <p role="alert" className="cl-err">
            {readError}
          </p>
        ) : null}
      </div>
    );
  }

  // ── Map the columns, then confirm ────────────────────────────
  const mapped = new Set(mapping.filter((m) => m !== 'skip'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '64rem' }}>
      <div className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>What is in each column?</p>
          <p className="m-0 text-[13px] text-[var(--text2)]">
            {fileName} · <span className="mono">{rows.length - 1}</span> rows
          </p>
        </div>

        <p className="m-0 mt-2 max-w-[60ch] text-[14px] leading-relaxed text-[var(--text2)]">
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
                    className="border-b border-[var(--fill2)] p-2 text-left align-bottom"
                  >
                    <span className="lbl block truncate" title={h}>
                      {h.trim() || `Column ${i + 1}`}
                    </span>
                    <select
                      aria-label={`What is in the column "${h.trim() || i + 1}"?`}
                      value={mapping[i] ?? 'skip'}
                      onChange={(e) => {
                        const next = [...mapping];
                        const chosen = e.target.value;
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
                      className={input} style={{ marginTop: 6, minHeight: 34 }}
                    >
                      {KEYS.map((k) => (
                        <option key={k} value={k}>
                          {COLUMN_LABELS[k]}
                        </option>
                      ))}
                      {fields.map((f) => (
                        <option key={f.key} value={`custom:${f.key}`}>
                          {f.label} (your field)
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
                      className={`border-b border-[var(--fill2)] p-2 align-top ${
                        mapping[ci] === 'skip' ? 'muted line-through' : ''
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
          <p role="alert" className="cl-err">
            Nothing is set to Name yet, so there is nobody to import.
          </p>
        ) : null}
      </div>

      {plan && mapped.has('name') ? (
        <div className="card">
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            This will add <span className="mono">{plan.rows.length}</span>{' '}
            {plan.rows.length === 1 ? 'client' : 'clients'}.
          </p>

          <ul className="mt-2 mb-0 flex list-none flex-col gap-1 p-0 text-[13.5px] text-[var(--text2)]">
            <li>
              Read <span className="mono">{plan.read}</span> rows.
            </li>
            {plan.skippedNoName > 0 ? (
              <li>
                <span className="mono">{plan.skippedNoName}</span> have no name and will be left
                out.
              </li>
            ) : null}
            {plan.duplicatesInFile > 0 ? (
              <li>
                <span className="mono">{plan.duplicatesInFile}</span> repeat a phone number already
                in the file and will be added once.
              </li>
            ) : null}
            <li>
              Anyone already on your list with the same number is left alone — nothing is merged
              over the top of work you have already done.
            </li>
            <li>
              {already === null ? (
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => checkExisting(plan.rows.map((r) => r.phone).filter((p): p is string => p !== null))}
                  className="btn ghost sm"
                >
                  {checking ? 'Checking your list…' : 'Check how many are already on your list'}
                </button>
              ) : (
                <>
                  <span className="mono" style={{ fontWeight: 600 }}>{already.toLocaleString('en-IN')}</span> already on your list (left alone) ·{' '}
                  <span className="mono" style={{ fontWeight: 600 }}>{Math.max(0, plan.rows.length - already).toLocaleString('en-IN')}</span> new.
                </>
              )}
            </li>
            {plan.rows.length > 1000 ? (
              <li>
                A big file goes in pieces of 1,000 rows. Keep this page open until it says done; if it stops, importing the
                same file again is safe.
              </li>
            ) : null}
          </ul>

          {/* Loud, and separate from the counts above, because it is the one
              problem on this screen that importing will NOT solve. Excel
              stored those numbers as numbers and the digits are gone from
              the file — so this says what to do about it rather than just
              reporting a number, since an error that names a cause without a
              remedy is just blame. */}
          {plan.mangledPhones > 0 ? (
            <div style={{ borderRadius: 12, background: 'var(--bad-bg)', padding: '12px 14px' }}>
              <p className="bad-t" style={{ margin: '0 0 4px', fontWeight: 600 }}>
                <span className="mono">{plan.mangledPhones}</span>{' '}
                {plan.mangledPhones === 1 ? 'phone number was' : 'phone numbers were'} damaged by
                Excel before we saw the file.
              </p>
              <p className="m-0 text-[12.5px] leading-relaxed text-[var(--text2)]">
                They look like <span className="mono">9.87E+09</span>
                . Excel read the column as numbers and kept only the first few digits, so the rest
                are not in this file to recover. Go back to the original, format the phone column as{' '}
                <strong>Text</strong> before opening it, and export again. You can import now and
                those rows will simply have no number.
              </p>
            </div>
          ) : null}

          <p className="lbl" style={{ margin: 0 }}>The first few, as they will be saved</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  {(['name', 'phone', 'society', 'config'] as const).map((k) => (
                    <th
                      key={k}
                      scope="col"
                      className="lbl border-b border-[var(--fill2)] p-2 text-left"
                    >
                      {COLUMN_LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    <td className="border-b border-[var(--fill2)] p-2">{short(r.name)}</td>
                    <td className="border-b border-[var(--fill2)] p-2">
                      {r.phone ? (
                        <span className="mono">{r.phone}</span>
                      ) : (
                        // Worth saying rather than leaving blank: a column of
                        // these means the phone column is mapped wrong, and
                        // that is far easier to see here than afterwards.
                        <span className="muted">no usable number</span>
                      )}
                    </td>
                    <td className="border-b border-[var(--fill2)] p-2">{short(r.society ?? '—')}</td>
                    <td className="border-b border-[var(--fill2)] p-2">{short(r.config ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="mt-5 flex max-w-[26rem] flex-col gap-1.5">
            <span className="lbl">Where did these leads come from?</span>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={input}>
              <option value="">Pick one…</option>
              {(Object.keys(SOURCE_LABELS) as ClientSourceName[])
                .filter((k) => k !== 'ONE_INTERIORS')
                .map((k) => (
                  <option key={k} value={k}>
                    {SOURCE_LABELS[k]}
                  </option>
                ))}
              {sources.map((o) => (
                <option key={o.id} value={`own:${o.id}`}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || !source}
              onClick={() =>
                start(async () => {
                  const own = source.startsWith('own:') ? source.slice(4) : null;
                  await addAll(own, own ? 'OTHER' : source, plan.rows.length);
                })
              }
              className={primary}
            >
              {pending
                ? progress
                  ? `Adding… ${progress.done.toLocaleString('en-IN')} of ${progress.of.toLocaleString('en-IN')}`
                  : 'Adding…'
                : `Add ${plan.rows.length.toLocaleString('en-IN')}`}
            </button>
            <button type="button" onClick={startOver} disabled={pending} className={quiet}>
              Use a different file
            </button>
          </div>

          {'ok' in state && !state.ok ? (
            <p role="alert" className="cl-err">
              {state.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
