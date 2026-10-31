/**
 * Every quotation in the Hauspire quotation app, into One Interiors (owner,
 * 22 Oct 2026: "import everything"; docs/studio-os/QUOTE-PARITY.md §Import).
 * Pure: the rows come in, a plan and a report go out. The database side is
 * hauspire-import.ts, the command scripts/import-hauspire-quotes.ts; tested
 * in tests/hauspire-import-plan.test.ts with fake rows only.
 *
 * ## What one quotation is
 *
 * The old app keeps one row per (quotation number, stage) and overwrites it
 * on every save; older versions of the app inserted a new row per save
 * instead. So the rows are grouped by number and stage: the newest row IS
 * the quotation, and any older rows of the same group become its earlier
 * revisions (R1, R2… in the order they were saved), so nothing in the old
 * app is lost. A row with no number is a quotation of its own.
 *
 * Each quotation is mapped by `mapQuote` (hauspire-map.ts): every line, its
 * sizes, rate and agreed amount, the modular %, the flat discount and its
 * name, fee on/off, GST on/off and the date. It keeps the old number — the
 * Sales Final as "2312", its Design Final as "2312-D", pointing back at it
 * — so a search for 2312 finds both.
 *
 * ## Idempotent
 *
 * Our quotation remembers its row (`importedFrom` = "hauspire:<row id>",
 * unique per studio). Run again, and a row already here is left alone when
 * nothing changed; when it changed in the old app and nobody has touched our
 * copy since it was imported, our copy is brought up to date (and the old
 * content kept as a revision); when both changed, ours wins and the report
 * says so.
 *
 * ## Whose lead
 *
 * Each quotation is attached to the studio's lead for that client:
 *   1. by mobile, when the old quotation has one (last ten digits);
 *   2. else by name (case, spacing and punctuation ignored) AND location
 *      (the lead's locality or city);
 *   3. no single match — none, or more than one — and a lead is created:
 *      source OTHER, "From the Hauspire quotation app", in the team pool
 *      asked for, else the studio pool. Quotations of the same client share
 *      the one new lead.
 * A quotation already imported keeps the lead it has.
 */

import { mapQuote, type MappedLine, type MappedQuote, type SourceQuote } from './hauspire-map';

export const SOURCE_NOTE = 'From the Hauspire quotation app';
export const IMPORTED_PREFIX = 'hauspire:';
/** Our copy counts as edited here when it changed this long after it was imported. */
export const EDITED_AFTER_MS = 5_000;

// ── Keys ───────────────────────────────────────────────────────

/** The last ten digits of an Indian mobile, or null when there are not ten. */
export function phoneKey(raw: string | null | undefined): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  while (d.length > 10 && (d.startsWith('0') || d.startsWith('91'))) d = d.startsWith('0') ? d.slice(1) : d.slice(2);
  return d.length === 10 ? d : null;
}

/** A name or place compared without case, spacing, punctuation or a title (Mr, Mrs, Ms, Dr). */
export function textKey(raw: string | null | undefined): string {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^(mr|mrs|ms|miss|dr|shri|smt)\s+/, '')
    .replace(/\s+/g, ' ');
}

/** What a quotation says, to tell "changed" from "the same": lines in order and the terms. */
export function contentKey(q: { lines: readonly Omit<MappedLine, 'sortOrder'>[]; terms: { feeBps: number; discountBps: number; onSpotPaise: number; onSpotLabel: string | null; gstBps: number; quoteDate: string | null } }): string {
  return JSON.stringify({
    l: q.lines.map((l) => [l.room, l.product, l.code, l.unit, l.details ?? '', l.widthMm, l.heightMm, l.qtyMilli, l.ratePaise, l.amountPaise]),
    t: [q.terms.feeBps, q.terms.discountBps, q.terms.onSpotPaise, q.terms.onSpotLabel ?? '', q.terms.gstBps, q.terms.quoteDate],
  });
}

// ── Inputs ─────────────────────────────────────────────────────

export interface ExistingQuote {
  id: string;
  importedFrom: string;
  number: string;
  clientId: string | null;
  importedAt: Date | null;
  updatedAt: Date;
  /** `contentKey` of our copy as it stands. */
  content: string;
}

export interface ExistingClient {
  id: string;
  name: string;
  phone: string | null;
  locality: string | null;
  city: string | null;
}

// ── The plan ───────────────────────────────────────────────────

export type ClientRef = { kind: 'existing'; id: string; how: 'phone' | 'name+location' | 'already' } | { kind: 'new'; key: string };

export interface NewClientPlan {
  key: string;
  name: string;
  phone: string | null;
  locality: string | null;
  config: string | null;
  /** Why it is new: nobody matched, or more than one lead did. */
  why: 'none' | 'ambiguous';
  /** The quotation numbers that brought it in. */
  numbers: string[];
}

export type QuoteAction = 'create' | 'update' | 'same' | 'edited-here';

export interface QuotePlan {
  action: QuoteAction;
  mapped: MappedQuote;
  /** The older rows of the same number and stage, oldest first: its earlier revisions. */
  earlier: MappedQuote[];
  client: ClientRef;
  /** For a Design Final: the source row id of its Sales Final, when the old app has one. */
  salesSourceId: string | null;
  existingId: string | null;
}

export interface Unreadable {
  id: string;
  number: string;
  reason: string;
}

export interface Mismatch {
  number: string;
  stage: 'sales' | 'design';
  client: string;
  oldTpvPaise: number;
  ourTpvPaise: number;
  differencePaise: number;
}

export interface ImportReport {
  rows: number;
  quotations: number;
  byStage: { sales: number; design: number };
  byAction: Record<QuoteAction, number>;
  earlierRevisions: number;
  clients: { byPhone: number; byNameLocation: number; already: number; created: number; ambiguous: number };
  newClients: { name: string; phone: string | null; numbers: string[]; why: 'none' | 'ambiguous' }[];
  unreadable: Unreadable[];
  warnings: { number: string; text: string }[];
  totalsChecked: number;
  totalsMatched: number;
  mismatches: Mismatch[];
  /** The old app's own total before GST, summed over the quotations (paise). */
  oldTpvPaise: number;
  ourTpvPaise: number;
}

export interface ImportPlan {
  quotes: QuotePlan[];
  newClients: NewClientPlan[];
  report: ImportReport;
}

const stageOf = (r: SourceQuote): 'sales' | 'design' => (String(r.stage ?? '').trim().toLowerCase() === 'design' ? 'design' : 'sales');
const numberOf = (r: SourceQuote) => (typeof r.quote_no === 'string' ? r.quote_no.trim() : '');
const time = (r: SourceQuote) => (typeof r.created_at === 'string' ? r.created_at : '');

/** The rows grouped into quotations: newest of each (number, stage) first in `rows`, older ones after. */
export function groupRows(rows: readonly SourceQuote[]): SourceQuote[][] {
  const groups = new Map<string, SourceQuote[]>();
  for (const r of rows) {
    const no = numberOf(r);
    const key = no ? `${no}|${stageOf(r)}` : `id|${r.id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map((g) => [...g].sort((a, b) => time(b).localeCompare(time(a)) || b.id.localeCompare(a.id)));
}

/** Which of the studio's leads a quotation belongs to, or why none. */
export function matchClient(m: Pick<MappedQuote, 'phone' | 'client' | 'location'>, clients: readonly ExistingClient[]): { id: string; how: 'phone' | 'name+location' } | { id: null; why: 'none' | 'ambiguous' } {
  const phone = phoneKey(m.phone);
  if (phone) {
    const hits = clients.filter((c) => phoneKey(c.phone) === phone);
    if (hits.length === 1) return { id: hits[0]!.id, how: 'phone' };
    if (hits.length > 1) return { id: null, why: 'ambiguous' };
  }
  const name = textKey(m.client);
  const place = textKey(m.location);
  if (!name) return { id: null, why: 'none' };
  /* Never a lead whose own mobile is another number (31 Oct 2026: "Mr Yogesh" in Pune, mobile …1323, went onto a
     lead "Yogesh" in Pune with …4609). With a mobile and no lead on it, the client is new. */
  const hits = clients.filter(
    (c) => textKey(c.name) === name && Boolean(place) && (textKey(c.locality) === place || textKey(c.city) === place) && !(phone && phoneKey(c.phone) && phoneKey(c.phone) !== phone),
  );
  if (hits.length === 1) return { id: hits[0]!.id, how: 'name+location' };
  return { id: null, why: hits.length > 1 ? 'ambiguous' : 'none' };
}

/** The key one new lead is made under, so a client's quotations share it. */
function newClientKey(m: MappedQuote): string {
  const phone = phoneKey(m.phone);
  return phone ? `p:${phone}` : `n:${textKey(m.client)}|${textKey(m.location)}`;
}

function unreadableReason(r: SourceQuote): string | null {
  if (!Array.isArray(r.lines)) return 'its lines are not a list';
  if (r.lines.length === 0) return 'it has no lines';
  return null;
}

/**
 * `previous`: source id → `contentKey` of what an earlier run imported (the
 * file that run read). When given for a row, "edited here" means our copy no
 * longer says that — not the clock, which a slow earlier run could trip
 * (31 Oct 2026: a 10-second run stamped one start time on every row, so the
 * later rows looked edited).
 */
export function planImport(input: {
  rows: readonly SourceQuote[];
  existing: readonly ExistingQuote[];
  clients: readonly ExistingClient[];
  previous?: ReadonlyMap<string, string>;
  /**
   * Quotation numbers the owner says to take from the source even though
   * ours changed here (31 Oct 2026: projects brought in on an older save,
   * deleted to be remade on the agreed one). Such a quotation also moves to
   * the lead its mobile now matches, when that is another lead (2523: saved
   * first with Anshu's mobile, then Chetan Joshi's).
   */
  replace?: ReadonlySet<string>;
}): ImportPlan {
  const byKey = new Map(input.existing.map((e) => [e.importedFrom, e]));
  const report: ImportReport = {
    rows: input.rows.length,
    quotations: 0,
    byStage: { sales: 0, design: 0 },
    byAction: { create: 0, update: 0, same: 0, 'edited-here': 0 },
    earlierRevisions: 0,
    clients: { byPhone: 0, byNameLocation: 0, already: 0, created: 0, ambiguous: 0 },
    newClients: [],
    unreadable: [],
    warnings: [],
    totalsChecked: 0,
    totalsMatched: 0,
    mismatches: [],
    oldTpvPaise: 0,
    ourTpvPaise: 0,
  };
  const newClients = new Map<string, NewClientPlan>();
  const quotes: QuotePlan[] = [];

  const groups = groupRows(input.rows.filter((r) => r && typeof r.id === 'string' && r.id.length > 0));
  report.unreadable.push(...input.rows.filter((r) => !r || typeof r.id !== 'string' || !r.id).map(() => ({ id: '—', number: '—', reason: 'it has no id' })));
  /* Sales rows by number, for linking each Design Final to its Sales Final. */
  const salesByNumber = new Map<string, string>();
  for (const g of groups) {
    const top = g[0]!;
    if (stageOf(top) === 'sales' && numberOf(top)) salesByNumber.set(numberOf(top), top.id);
  }

  for (const g of groups) {
    const top = g[0]!;
    const bad = unreadableReason(top);
    if (bad) {
      report.unreadable.push({ id: top.id, number: numberOf(top) || '—', reason: bad });
      continue;
    }
    const mapped = mapQuote(top);
    const earlier = g
      .slice(1)
      .filter((r) => unreadableReason(r) === null)
      .map(mapQuote)
      .reverse();
    report.quotations += 1;
    report.byStage[mapped.stage] += 1;
    report.earlierRevisions += earlier.length;
    for (const w of mapped.warnings) report.warnings.push({ number: mapped.number, text: w });

    report.totalsChecked += 1;
    report.oldTpvPaise += mapped.sourceTpvPaise;
    report.ourTpvPaise += mapped.totals.beforeTaxPaise;
    if (mapped.totals.beforeTaxPaise === mapped.sourceTpvPaise) report.totalsMatched += 1;
    else
      report.mismatches.push({
        number: mapped.number,
        stage: mapped.stage,
        client: mapped.client,
        oldTpvPaise: mapped.sourceTpvPaise,
        ourTpvPaise: mapped.totals.beforeTaxPaise,
        differencePaise: mapped.totals.beforeTaxPaise - mapped.sourceTpvPaise,
      });

    const prior = byKey.get(`${IMPORTED_PREFIX}${top.id}`) ?? null;
    let action: QuoteAction = 'create';
    if (prior) {
      const changedThere = prior.content !== contentKey(mapped);
      const before = input.previous?.get(top.id);
      const editedHere = before !== undefined ? prior.content !== before : prior.importedAt ? prior.updatedAt.getTime() - prior.importedAt.getTime() > EDITED_AFTER_MS : true;
      action = !changedThere ? 'same' : editedHere && !input.replace?.has(mapped.number) ? 'edited-here' : 'update';
    }
    report.byAction[action] += 1;

    let client: ClientRef;
    const moved = prior?.clientId && action === 'update' && input.replace?.has(mapped.number) ? matchClient(mapped, input.clients) : null;
    if (moved && moved.id !== null && moved.how === 'phone' && moved.id !== prior!.clientId) {
      client = { kind: 'existing', id: moved.id, how: 'phone' };
      report.clients.byPhone += 1;
    } else if (prior?.clientId) {
      client = { kind: 'existing', id: prior.clientId, how: 'already' };
      report.clients.already += 1;
    } else {
      const hit = matchClient(mapped, input.clients);
      if (hit.id !== null) {
        client = { kind: 'existing', id: hit.id, how: hit.how };
        if (hit.how === 'phone') report.clients.byPhone += 1;
        else report.clients.byNameLocation += 1;
      } else {
        const key = newClientKey(mapped);
        const made = newClients.get(key);
        if (made) made.numbers.push(mapped.number);
        else newClients.set(key, { key, name: mapped.client, phone: mapped.phone, locality: mapped.location, config: mapped.bhk, why: hit.why, numbers: [mapped.number] });
        client = { kind: 'new', key };
      }
    }

    quotes.push({
      action,
      mapped,
      earlier,
      client,
      salesSourceId: mapped.stage === 'design' ? (salesByNumber.get(numberOf(top)) ?? null) : null,
      existingId: prior?.id ?? null,
    });
  }

  report.clients.created = newClients.size;
  report.clients.ambiguous = [...newClients.values()].filter((c) => c.why === 'ambiguous').length;
  report.newClients = [...newClients.values()].map((c) => ({ name: c.name, phone: c.phone, numbers: c.numbers, why: c.why }));
  /* Sales Finals first, so a Design Final can point at the one it was made from. */
  quotes.sort((a, b) => (a.mapped.stage === b.mapped.stage ? 0 : a.mapped.stage === 'sales' ? -1 : 1));
  return { quotes, newClients: [...newClients.values()], report };
}

// ── The report ─────────────────────────────────────────────────

const rupees = (p: number) => {
  const abs = Math.abs(p);
  const body = abs % 100 === 0 ? (abs / 100).toLocaleString('en-IN') : (abs / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${p < 0 ? '−' : ''}₹${body}`;
};

export function formatReport(r: ImportReport, head: { studio: string; dryRun: boolean; poolTeam: string | null }): string {
  const out: string[] = [];
  const row = (k: string, v: string | number) => out.push(`  ${k.padEnd(44)} ${v}`);
  out.push(`Hauspire quotation app → ${head.studio}${head.dryRun ? '   (DRY RUN: nothing is written)' : ''}`);
  out.push('');
  out.push('Quotations');
  row('rows read from the quotation app', r.rows);
  row('quotations (one per number and stage)', r.quotations);
  row('  Sales Final', r.byStage.sales);
  row('  Design Final', r.byStage.design);
  row('earlier saves kept as revisions', r.earlierRevisions);
  row('new here', r.byAction.create);
  row('changed there, updated here', r.byAction.update);
  row('already here, unchanged', r.byAction.same);
  row('changed there AND edited here (ours kept)', r.byAction['edited-here']);
  row('unreadable (skipped)', r.unreadable.length);
  for (const u of r.unreadable) out.push(`    ✗ ${u.number} (${u.id}): ${u.reason}`);
  out.push('');
  out.push('Leads');
  row('matched by mobile', r.clients.byPhone);
  row('matched by name and location', r.clients.byNameLocation);
  row('kept from an earlier import', r.clients.already);
  row(`created (${head.poolTeam ? `team pool of ${head.poolTeam}` : 'studio pool'})`, r.clients.created);
  row('  of which more than one lead matched', r.clients.ambiguous);
  for (const c of r.newClients) out.push(`    + ${c.name}${c.phone ? ` · ${c.phone}` : ''} · ${c.numbers.join(', ')}${c.why === 'ambiguous' ? ' · several leads matched; a new one is made, merge by hand' : ''}`);
  out.push('');
  out.push('Totals check (the old app’s stored total before GST against ours, recomputed)');
  row('checked', r.totalsChecked);
  row('identical to the paisa', r.totalsMatched);
  row('different', r.mismatches.length);
  for (const m of r.mismatches) out.push(`    ≠ ${m.number} ${m.stage === 'design' ? 'Design' : 'Sales'} · ${m.client}: old ${rupees(m.oldTpvPaise)}, ours ${rupees(m.ourTpvPaise)} (${m.differencePaise > 0 ? '+' : ''}${rupees(m.differencePaise)})`);
  row('sum of the old totals', rupees(r.oldTpvPaise));
  row('sum of ours', rupees(r.ourTpvPaise));
  if (r.warnings.length) {
    out.push('');
    out.push('To look at');
    for (const w of r.warnings) out.push(`    ! ${w.number}: ${w.text}`);
  }
  return out.join('\n');
}
