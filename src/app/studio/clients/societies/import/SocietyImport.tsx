'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { parseCsv } from '@/modules/studio-practice/csv';
import {
  SOCIETY_COLUMN_LABELS,
  SOCIETY_TEMPLATE,
  guessSocietyColumns,
  societyTemplateCsv,
  planSocietyImport,
  toPayload,
  type SocietyColumn,
} from '@/modules/studio-practice/society-import';
import { monthLabel, parsePossession } from '@/modules/studio-practice/society-rules';
import { readXlsx } from './read-sheet';
import { importSocietySheetAction } from './actions';

const KINDS = Object.keys(SOCIETY_COLUMN_LABELS) as SocietyColumn[];

/**
 * Import a society sheet (owner, 11 Nov 2026): pick the file, match the
 * columns, see what it will do, then save. Nothing is sent until "Import".
 */
export function SocietyImport({ people, me, mayGive }: { people: { id: string; name: string }[]; me: string; mayGive: boolean }) {
  const [file, setFile] = useState<string>('');
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [columns, setColumns] = useState<SocietyColumn[]>([]);
  const [society, setSociety] = useState('');
  const [locality, setLocality] = useState('');
  const [possession, setPossession] = useState('');
  const [owner, setOwner] = useState(me);
  /* Who gets the new leads now; '' = nobody yet (give them out on the society page). */
  const [leadsTo, setLeadsTo] = useState(me);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function pick(f: File | undefined) {
    setError(null);
    setDone(null);
    if (!f) return;
    try {
      const read = /\.xlsx$/i.test(f.name) ? await readXlsx(f) : /\.csv$/i.test(f.name) || f.type === 'text/csv' ? parseCsv(await f.text()) : null;
      if (!read) return setError('Pick an .xlsx or .csv file. An old .xls: open it in Excel and save as .xlsx first.');
      const clean = read.filter((r) => r.some((c) => String(c ?? '').trim()));
      if (clean.length === 0) return setError('That sheet looks empty.');
      setFile(f.name);
      setRows(clean);
      setColumns(guessSocietyColumns(clean[0].map(String)));
      if (!society) setSociety(f.name.replace(/\.(xlsx|csv)$/i, '').replace(/[_-]+/g, ' ').trim());
    } catch {
      setError('That file could not be read. Save it again as .xlsx or .csv and try once more.');
    }
  }

  const body = hasHeader ? rows.slice(1) : rows;
  const width = Math.max(0, ...rows.slice(0, 50).map((r) => r.length));
  const defaultPossession = possession ? parsePossession(possession) : null;
  const plan = useMemo(
    () => (rows.length ? planSocietyImport(body, columns, { society: columns.includes('society') ? undefined : society, locality, possession: defaultPossession }) : null),
    [rows, body, columns, society, locality, defaultPossession],
  );
  const ownersTotal = plan?.societies.reduce((n, g) => n + g.owners.length, 0) ?? 0;

  function save() {
    if (!plan) return;
    setError(null);
    start(async () => {
      const r = await importSocietySheetAction(toPayload(plan, file, owner || null, mayGive ? leadsTo || null : me));
      if (!r.ok) return setError(r.error);
      setDone(
        `Done. ${r.societiesNew} new societ${r.societiesNew === 1 ? 'y' : 'ies'}${r.societiesSeen ? `, ${r.societiesSeen} already here updated` : ''}; ${r.leadsNew} new lead${r.leadsNew === 1 ? '' : 's'}${r.leadsLinked ? `, ${r.leadsLinked} existing linked` : ''}${r.leadsLeft ? `, ${r.leadsLeft} left as they were (someone else’s, or deleted)` : ''}.${r.assigned ? ` ${r.assigned}` : ''}`,
      );
      setRows([]);
      setFile('');
    });
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([societyTemplateCsv()], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'society-sheet-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="soc-import">
      <section className="card">
        <label className="soc-k" htmlFor="soc-file">
          1 · The sheet
        </label>
        <input id="soc-file" type="file" accept=".xlsx,.csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
        <p className="muted soc-small">Put your sheet in this format: one row per flat owner, these headings in the first row. Other headings work too; you match them in the next step.</p>
        <div className="tscroll">
          <table className="tbl soc-format">
            <thead>
              <tr>
                <th>Heading</th>
                <th>Needed?</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              {SOCIETY_TEMPLATE.map((c) => (
                <tr key={c.header}>
                  <td>
                    <b>{c.header}</b>
                  </td>
                  <td className="muted">{c.need}</td>
                  <td className="mono">{c.example[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted soc-small">
          <button type="button" className="linkbtn" onClick={downloadTemplate}>
            Download the template (.csv, opens in Excel)
          </button>{' '}
          · Possession can be written Mar 2027, 03/2027 or 2027-03. Keep phone numbers as plain 10 digits; in Excel, format the column as Text.
        </p>
        {error ? <p role="alert" className="soc-err">{error}</p> : null}
        {done ? (
          <p role="status" className="soc-ok">
            {done} <Link href="/studio/clients/societies">See the societies</Link>
          </p>
        ) : null}
      </section>

      {rows.length ? (
        <section className="card">
          <span className="soc-k">2 · Match the columns</span>
          <label className="hstack" style={{ gap: 6 }}>
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> The first row is headings
          </label>
          <div className="tscroll">
            <table className="tbl soc-map">
              <thead>
                <tr>
                  {Array.from({ length: width }, (_, i) => (
                    <th key={i}>
                      <select
                        value={columns[i] ?? 'skip'}
                        aria-label={`Column ${i + 1}`}
                        onChange={(e) => setColumns((c) => Array.from({ length: width }, (_, j) => (j === i ? (e.target.value as SocietyColumn) : (c[j] ?? 'skip'))))}
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {SOCIETY_COLUMN_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 6).map((r, i) => (
                  <tr key={i} className={hasHeader && i === 0 ? 'soc-headrow' : undefined}>
                    {Array.from({ length: width }, (_, j) => (
                      <td key={j}>{r[j] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="soc-grid">
            {!columns.includes('society') ? (
              <label>
                Society for every row
                <input value={society} onChange={(e) => setSociety(e.target.value)} maxLength={120} placeholder="Life Republic, Sector R10" />
              </label>
            ) : null}
            {!columns.includes('locality') ? (
              <label>
                Locality
                <input value={locality} onChange={(e) => setLocality(e.target.value)} maxLength={80} placeholder="Hinjewadi" />
              </label>
            ) : null}
            {!columns.includes('possession') ? (
              <label>
                Possession month for every wing
                <input type="month" value={possession} onChange={(e) => setPossession(e.target.value)} />
              </label>
            ) : null}
            {mayGive ? (
              <label>
                Give the new leads to
                <select value={leadsTo} onChange={(e) => setLeadsTo(e.target.value)}>
                  <option value="">Nobody yet (give them out on the society page)</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.id === me ? ' (you)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {mayGive ? (
              <label>
                Owner of new societies
                <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.id === me ? ' (you)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </section>
      ) : null}

      {plan && rows.length ? (
        <section className="card">
          <span className="soc-k">3 · What it will do</span>
          {plan.societies.length === 0 ? (
            <p className="soc-err">No society to put these in. Type the society, or match a Society column.</p>
          ) : (
            <ul className="soc-plan">
              {plan.societies.slice(0, 20).map((g) => (
                <li key={g.key}>
                  <b>{g.name}</b>: {g.wings.size} wing{g.wings.size === 1 ? '' : 's'} (
                  {[...g.wings].map(([w, d]) => `${w}${d ? ` · ${monthLabel(d)}` : ''}`).join(', ')}), {g.owners.length} owner{g.owners.length === 1 ? '' : 's'}
                </li>
              ))}
              {plan.societies.length > 20 ? <li>…and {plan.societies.length - 20} more societies</li> : null}
            </ul>
          )}
          <p className="muted soc-small">
            {ownersTotal} owner{ownersTotal === 1 ? '' : 's'} become leads, unless their phone is already a lead: those are linked instead.
            {plan.skipped ? ` ${plan.skipped} row${plan.skipped === 1 ? '' : 's'} with no name or phone left out.` : ''}
            {plan.repeats ? ` ${plan.repeats} repeated phone${plan.repeats === 1 ? '' : 's'} kept once.` : ''}
            {plan.noSociety ? ` ${plan.noSociety} row${plan.noSociety === 1 ? '' : 's'} with no society left out.` : ''}
            {plan.badDates ? ` ${plan.badDates} possession cell${plan.badDates === 1 ? '' : 's'} not read as a month.` : ''}
          </p>
          <div>
            <button type="button" className="btn pri" disabled={pending || plan.societies.length === 0} onClick={save}>
              {pending ? 'Importing…' : `Import ${plan.societies.length} societ${plan.societies.length === 1 ? 'y' : 'ies'}`}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
