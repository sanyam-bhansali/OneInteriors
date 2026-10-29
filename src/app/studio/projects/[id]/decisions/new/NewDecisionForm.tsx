'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { shrinkImage } from '@/lib/shrink-image';
import { formatINR } from '@/lib/money';
import { parseRupees } from '@/modules/project/payment-ledger';
import { CustomerSees, OnlyYourTeam } from '../../../marks';
import { createDecisionAction } from './actions';
import { LineIcon } from '../../../../ui/icons';

/**
 * The New decision form and, beside it, the customer's screen as it will
 * look, updating as the studio types (design StudioDecision.dc.html).
 *
 * Nobody retypes: picking the quote line fills the title and the first
 * option (what was quoted, at ₹0) from the signed quote; amounts are typed
 * once, in rupees, and shown back with Indian grouping. Every field the
 * customer will read says so; the studio's own cost sits in a grey "Only
 * your team" box and is never in the preview.
 */

type Line = { quoteLineId: string; room: string; item: string; spec: string | null };

type Option = { label: string; detail: string; delta: string; cost: string; swatch: string; useSwatch: boolean; photo: File | null; preview: string | null };

const blank = (): Option => ({ label: '', detail: '', delta: '', cost: '', swatch: '#9fb59a', useSwatch: false, photo: null, preview: null });

const MAX_OPTIONS = 6;

const field = 'fld w-full';
const label = 'lbl';
const hint = 'm-0 text-[12.5px] text-[var(--muted)]';

/** "+₹14,000", "−₹2,500", "Included" — what the customer reads next to an option. */
function priceWords(raw: string): { text: string; tone: 'add' | 'less' | 'same' | 'bad' } {
  if (raw.trim() === '') return { text: 'Included', tone: 'same' };
  const p = parseRupees(raw, { negative: true });
  if (p === null) return { text: 'Not an amount', tone: 'bad' };
  if (p === 0) return { text: 'Included', tone: 'same' };
  return p > 0 ? { text: `+${formatINR(p)}`, tone: 'add' } : { text: `−${formatINR(-p)}`, tone: 'less' };
}

/** Typed "14000" or "-2500.5" → "14,000" / "-2,500.50", for showing back on blur. */
function grouped(raw: string): string {
  const p = parseRupees(raw, { negative: true });
  if (p === null || raw.trim() === '') return raw;
  const s = formatINR(Math.abs(p), { symbol: false, paise: p % 100 !== 0 });
  return p < 0 ? `-${s}` : s;
}

const dayWords = (day: string) =>
  day ? new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '') : '—';

export function NewDecisionForm({
  projectId,
  customer,
  family,
  lines,
  suggestedDue,
  today,
}: {
  projectId: string;
  customer: string;
  family: string[];
  lines: Line[];
  suggestedDue: string;
  today: string;
}) {
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [due, setDue] = useState(suggestedDue);
  const [lineId, setLineId] = useState('');
  const [options, setOptions] = useState<Option[]>([blank(), blank()]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  // Photo previews are object URLs: let them go when the form does.
  useEffect(() => () => options.forEach((o) => o.preview && URL.revokeObjectURL(o.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i: number, patch: Partial<Option>) => setOptions((all) => all.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const line = lines.find((l) => l.quoteLineId === lineId) ?? null;

  const pickLine = (id: string) => {
    setLineId(id);
    const l = lines.find((x) => x.quoteLineId === id);
    if (!l) return;
    // Fill what the quote already says, only where nothing was typed.
    if (!title.trim()) setTitle(`${l.room} ${l.item.charAt(0).toLowerCase()}${l.item.slice(1)}`.slice(0, 120));
    setOptions((all) =>
      all[0] && !all[0].label.trim() && l.spec ? [{ ...all[0], label: l.spec.slice(0, 60), detail: 'As in your signed quote', delta: '0' }, ...all.slice(1)] : all,
    );
  };

  const choosePhoto = (i: number, file: File | null) => {
    const old = options[i]?.preview;
    if (old) URL.revokeObjectURL(old);
    set(i, { photo: file, preview: file ? URL.createObjectURL(file) : null });
  };

  const filled = options.filter((o) => o.label.trim());
  const dueWords = dayWords(due);
  const voters = family.length ? `${family.length === 1 ? family[0] : `${family.slice(0, -1).join(', ')} and ${family[family.length - 1]}`} can vote. ` : '';

  const problems = useMemo(() => {
    const out: string[] = [];
    if (title.trim().length < 3) out.push('what needs deciding');
    if (why.trim().length < 10) out.push('what a late decision costs');
    if (!due || due < today) out.push('a decide-by date from today on');
    if (filled.length < 2) out.push('two options with names');
    if (options.some((o) => o.label.trim() && priceWords(o.delta).tone === 'bad')) out.push('price changes as amounts');
    return out;
  }, [title, why, due, today, filled.length, options]);

  const submit = () =>
    start(async () => {
      setError(null);
      const data = new FormData();
      data.set('projectId', projectId);
      data.set('title', title);
      data.set('why', why);
      data.set('dueOn', due);
      if (lineId) data.set('quoteLineId', lineId);
      const kept = options.filter((o) => o.label.trim());
      data.set(
        'options',
        JSON.stringify(kept.map((o) => ({ label: o.label, detail: o.detail, delta: o.delta, studioCost: o.cost, swatch: o.useSwatch ? o.swatch : null }))),
      );
      for (const [i, o] of kept.entries()) if (o.photo) data.set(`photo${i}`, await shrinkImage(o.photo));
      const r = await createDecisionAction(data);
      if (r.ok) setSent(true);
      else setError(r.error ?? 'Could not send. Try again.');
    });

  return (
    <div className="wscols">
      <form
        className="wsmain"
        onSubmit={(e) => {
          e.preventDefault();
          if (!sent && problems.length === 0) submit();
        }}
      >
        <section aria-label="The question" className="card">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="d-line" className={label}>
              Quote line it changes
            </label>
            <span className={hint}>Fills the title and the quoted option for you</span>
          </div>
          <select id="d-line" className={field} value={lineId} onChange={(e) => pickLine(e.target.value)} disabled={sent}>
            <option value="">Not tied to one line</option>
            {lines.map((l) => (
              <option key={l.quoteLineId} value={l.quoteLineId}>
                {l.room} · {l.item}
                {l.spec ? ` · ${l.spec}` : ''}
              </option>
            ))}
          </select>
          {line ? <p className={hint}>{customer}&rsquo;s pick replaces this line&rsquo;s spec in the locker; the quoted line is kept in the record.</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="d-title" className={label}>
              What does {customer} need to decide?
            </label>
            <CustomerSees name={customer} />
          </div>
          <input id="d-title" className={field} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Kitchen shutter finish" disabled={sent} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="d-due" className={label}>
              Decide by
            </label>
            <input id="d-due" type="date" className={field} value={due} min={today} onChange={(e) => setDue(e.target.value)} disabled={sent} />
            <p className={hint}>{dueWords}, end of the day</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor="d-why" className={label}>
                If {customer} decides late
              </label>
              <CustomerSees name={customer} />
            </div>
            <textarea
              id="d-why"
              className={`${field} min-h-[84px] py-2 leading-relaxed`}
              value={why}
              maxLength={600}
              rows={3}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Shutters are cut next week. If this waits past Friday, carpentry moves by about 3 days and so does handover."
              disabled={sent}
            />
            <p className={hint}>A delay from a late decision is marked as {customer}&rsquo;s, not yours: the plan moves by the days it was late.</p>
          </div>
        </div>

        </section>

        <section aria-labelledby="h-opts" className="card">
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-1 flex w-full flex-wrap items-baseline justify-between gap-2 p-0">
            <h2 id="h-opts" className="m-0 text-[17px] font-semibold">Options</h2>
            <span className={hint}>Prices include GST. Leave blank or 0 for as quoted; a minus takes money off.</span>
          </legend>
          {options.map((o, i) => {
            const price = priceWords(o.delta);
            return (
              <div key={i} className="optcard optgrid">
                <label className="relative flex h-[96px] w-[96px] cursor-pointer items-center justify-center overflow-hidden rounded-[12px] bg-[var(--paper)] text-center text-[12px] text-[var(--muted)]" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                  {o.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : o.useSwatch ? (
                    <span className="absolute inset-0" style={{ background: o.swatch }} aria-hidden="true" />
                  ) : (
                    <span>Add a photo</span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label={`Photo for option ${i + 1}`}
                    onChange={(e) => choosePhoto(i, e.target.files?.[0] ?? null)}
                    disabled={sent}
                  />
                </label>
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className={field}
                      value={o.label}
                      maxLength={60}
                      onChange={(e) => set(i, { label: e.target.value })}
                      placeholder={i === 0 ? 'Sage matte laminate' : i === 1 ? 'Walnut grain' : 'Off-white high gloss'}
                      aria-label={`Option ${i + 1} name`}
                      disabled={sent}
                    />
                    <input
                      className={field}
                      value={o.detail}
                      maxLength={160}
                      onChange={(e) => set(i, { detail: e.target.value })}
                      placeholder="One line about it"
                      aria-label={`Option ${i + 1}, one line about it`}
                      disabled={sent}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="sees">Price change</span> <CustomerSees name={customer} />
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-[var(--muted)]">₹</span>
                        <input
                          className={`${field} mono`}
                          inputMode="decimal"
                          value={o.delta}
                          onChange={(e) => set(i, { delta: e.target.value })}
                          onBlur={() => set(i, { delta: grouped(o.delta) })}
                          placeholder="0"
                          aria-label={`Option ${i + 1} price change for ${customer}, in rupees`}
                          disabled={sent}
                        />
                      </div>
                      <span className={`text-[12.5px] ${price.tone === 'bad' ? 'text-[var(--bad)]' : 'text-[var(--muted)]'}`}>{customer} reads: {price.text}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="team">Your cost · only your team</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-[var(--muted)]">₹</span>
                        <input
                          className={`${field} mono`}
                          inputMode="decimal"
                          value={o.cost}
                          onChange={(e) => set(i, { cost: e.target.value })}
                          onBlur={() => set(i, { cost: grouped(o.cost) })}
                          placeholder="optional"
                          aria-label={`Option ${i + 1} change in your own cost, in rupees, only your team sees it`}
                          disabled={sent}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-[var(--text2)]">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={o.useSwatch} onChange={(e) => set(i, { useSwatch: e.target.checked })} disabled={sent} />
                      It is a colour
                    </label>
                    {o.useSwatch ? (
                      <input type="color" value={o.swatch} onChange={(e) => set(i, { swatch: e.target.value })} aria-label={`Option ${i + 1} colour`} disabled={sent} />
                    ) : null}
                    {options.length > 2 ? (
                      <button type="button" className="ml-auto text-[12.5px] text-[var(--muted)] underline" onClick={() => setOptions((all) => all.filter((_, j) => j !== i))} disabled={sent}>
                        Remove this option
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {options.length < MAX_OPTIONS && !sent ? (
            <button type="button" className="btn ghost sm self-start" onClick={() => setOptions((all) => [...all, blank()])}>
              + Add an option
            </button>
          ) : null}
        </fieldset>
        </section>

        <div className="flex flex-col gap-2">
          {sent ? (
            <div role="status" className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-[var(--good-bg)] px-4 py-2 text-[14px] font-semibold text-[var(--good)]">
                ✓ Sent to {customer}
              </span>
              <p className="m-0 text-[13.5px] text-[var(--text2)]">
                It is on {customer}&rsquo;s phone now. You will be told the moment {customer} picks; the quote, the final payment and the locker update by
                themselves.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/studio/projects/${projectId}`} className="btn pri sm">
                  Back to the project
                </Link>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    setSent(false);
                    setTitle('');
                    setWhy('');
                    setLineId('');
                    setOptions([blank(), blank()]);
                  }}
                >
                  Ask something else
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="submit" className="btn pri lg self-start" disabled={pending || problems.length > 0}>
                {pending ? 'Sending…' : `Send to ${customer}`}
              </button>
              <p className={hint}>
                {problems.length
                  ? `Still needed: ${problems.join(', ')}.`
                  : `${customer} gets it on the phone app, with a reminder two days before ${dueWords}.`}
              </p>
              {error ? (
                <p role="alert" className="m-0 text-[13.5px] text-[var(--bad)]">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
      </form>

      <aside className="wsside" aria-label={`What ${customer} will see`}>
        <span className="sees" style={{ fontSize: 13 }}>
          <LineIcon name="eye" size={15} />
          What {customer} will see
        </span>
        <div className="phonecard">
          <span className="text-[13px] font-medium text-[var(--muted)]">Your decision, due {dueWords}</span>
          <span className="text-[26px] font-medium leading-[1.05] tracking-[-0.035em]">{title.trim() || 'What needs deciding'}</span>
          <span className="text-[14px] leading-[1.45] text-[var(--muted)]">{why.trim() || 'What happens if the decision comes late.'}</span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {(filled.length ? filled : options).map((o, i) => {
              const price = priceWords(o.delta);
              return (
                <li key={i} className="opt">
                  <span
                    className="relative h-9 w-9 flex-none overflow-hidden rounded-[10px]"
                    style={{ background: o.useSwatch ? o.swatch : 'var(--fill)', boxShadow: 'inset 0 0 0 1px var(--line)' }}
                    aria-hidden="true"
                  >
                    {o.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{o.label.trim() || `Option ${i + 1}`}</span>
                    {o.detail.trim() ? <span className="block truncate text-[12px] text-[var(--muted)]">{o.detail}</span> : null}
                  </span>
                  <span className="mono text-[13px]" style={{ color: price.tone === 'same' ? 'var(--muted)' : price.tone === 'less' ? 'var(--good)' : 'var(--bad-s)' }}>
                    {price.tone === 'same' ? 'included' : price.text}
                  </span>
                </li>
              );
            })}
          </ul>
          <span className="text-[13px] text-[var(--muted)]">
            {voters}
            {customer}&rsquo;s choice decides.
          </span>
          <span className="btn pri" aria-hidden="true">
            Confirm {(filled[0]?.label.trim() || 'an option').replace(/^./, (c) => c.toLowerCase())}
          </span>
        </div>
        <OnlyYourTeam>
          <p className="m-0 text-[13px] text-[var(--text2)]">Your cost per option never leaves this screen. {customer} sees only the price change.</p>
        </OnlyYourTeam>
      </aside>
    </div>
  );
}
