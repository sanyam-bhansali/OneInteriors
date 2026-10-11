/**
 * What GEIO knows about the customer's home, as plain text for the model,
 * and the only rupee figures it may say. Pure, and tested.
 *
 * Three sources, chosen by `customer-home.ts`:
 * - a signed-in customer with a project: that project, as
 *   `/api/app/v1/project` returns it, and their brief (`projectFacts`);
 * - a signed-in customer with no project yet: their brief alone, saying
 *   plainly that no studio is signed (`briefFacts`);
 * - the website's labelled sample mode (signed out, or a build with no
 *   database): the example project (`geioFacts`). Never a real customer.
 *
 * Every figure GEIO writes is checked against `allowed` before it is shown: a
 * number that is not here, or not a sum or difference of two that are, means
 * the answer goes to the expert instead.
 */

import { formatINR, formatINRCompact } from '@/lib/money';
import type { CustomerProject } from '@/modules/portal/project-store';
import { daysLate, optionPrice, shortDate } from './project-view';
import { homeSummary, scopeLine, type HomeBrief } from './home-summary';
import {
  CARPENTRY,
  DECISION,
  DOCUMENTS,
  EXAMPLE,
  MATERIALS,
  MILESTONES,
  PAYMENTS,
  QUOTE_LINES,
  ROOMS_3D,
  SNAGS,
  WEEK,
} from './example-project';

export interface GeioFacts {
  text: string;
  allowed: { paise: number[]; percents: number[] };
  /** The quote lines GEIO may cite as sources, by line number (trust fix 8). */
  lines: QuoteSource[];
}

export interface QuoteSource {
  line: number;
  item: string;
  amount: string;
  spec: string;
}

const lakh = (l: number) => Math.round(l * 100_000 * 100);
const rs = (rupees: number) => rupees * 100;

/** The example project, for the website's labelled sample mode only. */
export function geioFacts(expert: string): GeioFacts {
  const paise: number[] = [lakh(EXAMPLE.totalLakh), lakh(EXAMPLE.paidLakh), lakh(EXAMPLE.totalLakh - EXAMPLE.paidLakh)];
  for (const q of QUOTE_LINES) paise.push(rs(q.rupees));
  for (const p of PAYMENTS) paise.push(rs(p.rupees));
  for (const o of DECISION.options) {
    const m = o.price.match(/₹([\d,]+)/);
    if (m) paise.push(rs(Number(m[1]!.replace(/,/g, ''))));
  }

  const lines = [
    `EXPERT: ${expert}, an architect employed by One Interiors; no studio pays her.`,
    `HOME: ${EXAMPLE.flat}, 2 BHK. Studio: ${EXAMPLE.studio}, working since ${EXAMPLE.since}.`,
    `STAGE: ${EXAMPLE.stage.name}, day ${EXAMPLE.stage.day} of ${EXAMPLE.stage.of}. Stages: ${EXAMPLE.stages.join(' → ')}. Running ${EXAMPLE.runningLateDays} days late overall. Handover planned ${EXAMPLE.handover}. Today is ${EXAMPLE.today}.`,
    `MONEY: quote total ${formatINRCompact(lakh(EXAMPLE.totalLakh))} (${formatINR(lakh(EXAMPLE.totalLakh))}), paid ${formatINRCompact(lakh(EXAMPLE.paidLakh))} so far.`,
    'PAYMENTS:',
    ...PAYMENTS.map((p) => `- ${p.stage}: ${formatINR(rs(p.rupees))}, ${p.state}`),
    'QUOTE LINES (signed quote, 40 lines in all; these are some of them):',
    ...QUOTE_LINES.map((q) => `- Line ${q.line}, ${q.item}: ${formatINR(rs(q.rupees))}, ${q.spec}`),
    'MILESTONES:',
    ...MILESTONES.map((m) => `- ${m.title} (${m.state}): ${m.meta}${m.note ? `. ${m.note}` : ''}${m.flag ? `. ${m.flag.head}: ${m.flag.body}` : ''}`),
    `CARPENTRY ITEMS: ${CARPENTRY.map((c) => `${c.item} — ${c.status}`).join('; ')}.`,
    `THIS WEEK ON SITE: ${WEEK.map((d) => `${d.day} ${d.state}`).join(', ')}. Today: Ramesh (carpenter) and one helper on site from 9:40 am; wardrobe frames fitted in both bedrooms; kitchen carcass levelled and fixed to the wall. Tue 6 Oct nobody came (the carpenter was on another site); the day is added to the schedule, not the bill.`,
    `DECISION DUE ${DECISION.due}: ${DECISION.title}. ${DECISION.why} Options: ${DECISION.options.map((o) => `${o.name} (${o.note}; ${o.price})`).join('; ')}.`,
    `SNAGS OPEN: ${SNAGS.open.map((s) => `${s.title} — ${s.where}; ${s.status}`).join('; ')}. FIXED: ${SNAGS.fixed.map((s) => `${s.title} — ${s.status}`).join('; ')}. The last payment is due only once snags close.`,
    `MATERIALS: ${MATERIALS.map((m) => `${m.part}: ${m.name} (${m.note})`).join('; ')}.`,
    `ROOMS: ${ROOMS_3D.map((r) => `${r.name} — ${r.status}: ${r.note}`).join(' ')}`,
    `DOCUMENTS IN THE LOCKER: ${DOCUMENTS.map((d) => `${d.name} (${d.meta})`).join('; ')}.`,
  ];

  return {
    text: lines.join('\n'),
    allowed: { paise: withSumsAndGaps(paise), percents: [] },
    lines: QUOTE_LINES.map((q) => ({ line: q.line, item: q.item, amount: formatINR(rs(q.rupees)), spec: q.spec })),
  };
}

const expertLine = (expert: string) => `EXPERT: ${expert}, an architect employed by One Interiors; no studio pays her.`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const one = (s: string) => s.replace(/\s+/g, ' ').trim();
/** In the third person: the quiz's own labels are in the customer's voice ("I have the keys"). */
const POSSESSION: Record<string, string> = { HAVE_KEYS: 'they have the keys', EXPECTED: 'they are expecting possession', NOT_SURE: 'not sure yet' };
const STAGE_STATE: Record<string, string> = { done: 'done', now: 'happening now', next: 'next', later: 'not started' };

/** What the brief says about the home, as lines; the same for both real sources. */
function homeLines(brief: HomeBrief | null): string[] {
  const home = homeSummary(brief);
  if (!brief || !home) return ['HOME: they have not told us about their home yet.'];
  const size = [home.bhk, home.carpetSqft ? `${home.carpetSqft} sq ft carpet` : null].filter(Boolean).join(', ');
  const lines = [`HOME: ${home.label ?? 'Pune (no society or locality given)'}${size ? `, ${size}` : ''}.`];
  const scope = scopeLine(brief);
  if (scope) lines.push(`SCOPE OF WORK: ${scope}.`);
  if (home.tier) {
    lines.push(`FINISH BAND THEY CHOSE: ${home.tier[0]!.toUpperCase()}${home.tier.slice(1)} (a choice of materials and finish, not a ranking of studios).`);
  }
  const keys = brief.possessionStatus ? POSSESSION[brief.possessionStatus] : undefined;
  if (keys) {
    const when = brief.possessionStatus === 'EXPECTED' && brief.possessionOn ? `, expected ${shortDate(brief.possessionOn)}` : '';
    lines.push(`POSSESSION: ${keys}${when}.`);
  }
  return lines;
}

/** The budget they gave in the brief, and its figures. */
function budget(brief: HomeBrief | null): { line: string | null; paise: number[] } {
  const lo = brief?.budgetMinPaise ?? null;
  const hi = brief?.budgetMaxPaise ?? null;
  if (lo && hi) return { line: `BUDGET THEY GAVE: ${formatINR(lo)} to ${formatINR(hi)}.`, paise: [lo, hi] };
  if (hi) return { line: `BUDGET THEY GAVE: up to ${formatINR(hi)}.`, paise: [hi] };
  if (lo) return { line: `BUDGET THEY GAVE: from ${formatINR(lo)}.`, paise: [lo] };
  return { line: null, paise: [] };
}

/**
 * A signed-in customer with no project yet: the brief alone. The facts say so
 * outright, so the model does not invent a studio, a stage or a payment.
 */
export function briefFacts(expert: string, brief: HomeBrief | null, now = new Date()): GeioFacts {
  const b = budget(brief);
  const lines = [
    expertLine(expert),
    `TODAY: ${shortDate(now.toISOString())}.`,
    ...homeLines(brief),
    ...(b.line ? [b.line] : []),
    'PROJECT: no studio is signed yet. There is no quote, payment plan, site record, decision, snag or document for this home. Do not describe any; say plainly that these begin once they choose and sign a studio, and offer their expert for anything about choosing one.',
    'QUOTE LINES: none.',
  ];
  return { text: lines.join('\n'), allowed: { paise: withSumsAndGaps(b.paise), percents: [] }, lines: [] };
}

/** A signed-in customer's own project, from the same view the app's project screen reads. */
export function projectFacts(expert: string, project: CustomerProject, brief: HomeBrief | null, now = new Date()): GeioFacts {
  const paise: number[] = [];
  const stages = project.stages.map((s) => ({ ...s, targetOn: s.targetOn.toISOString() }));
  const handover = stages.at(-1);
  const late = daysLate(stages, now);

  const lines = [
    expertLine(expert),
    project.role === 'owner'
      ? 'ASKING: the owner of this home, who makes the choices.'
      : 'ASKING: a family member on this project. The owner makes the choices; family can see everything and vote.',
    `TODAY: ${shortDate(now.toISOString())}.`,
    ...homeLines(brief),
    `STUDIO: ${project.studio}, working since ${shortDate(project.startOn)}.`,
    'STAGES:',
    ...stages.map(
      (s) => `- ${s.label}: ${STAGE_STATE[s.state] ?? s.state}, target ${shortDate(s.targetOn)}${s.late ? ', past its target' : ''}`,
    ),
  ];
  if (handover) {
    lines.push(`HANDOVER PLANNED: ${shortDate(handover.targetOn)}. ${late > 0 ? `Running ${late} day${late === 1 ? '' : 's'} late.` : 'On time so far.'}`);
  }

  const m = project.money;
  if (m) {
    paise.push(m.contractPaise, m.paidPaise, m.contractPaise - m.paidPaise, m.laterPaise, ...m.stages.map((s) => s.amountPaise));
    lines.push(
      `MONEY: signed total ${formatINRCompact(m.contractPaise)} (${formatINR(m.contractPaise)}, GST included), paid ${formatINR(m.paidPaise)} so far, ${formatINR(m.contractPaise - m.paidPaise)} still to pay. They pay the studio directly; One Interiors only keeps the record.`,
      m.next
        ? `NEXT PAYMENT: ${m.next.label}, ${formatINR(m.next.amountPaise)}${m.next.dueOn ? `, due ${shortDate(m.next.dueOn)}` : ', date not set yet'}.`
        : 'NEXT PAYMENT: none; every stage is paid.',
      'PAYMENTS:',
      ...m.stages.map(
        (s) =>
          `- ${s.label}: ${formatINR(s.amountPaise)}, ${s.state === 'paid' ? `paid${s.paidOn ? ` ${shortDate(s.paidOn)}` : ''}` : s.dueOn ? `due ${shortDate(s.dueOn)}` : 'not due yet'}`,
      ),
    );
  } else {
    lines.push('MONEY: the signed total and payment stages are not recorded in the app for this project. Do not state any amount; hand money questions to the expert.');
  }

  const changes = project.changes;
  if (changes.items.length) {
    paise.push(changes.totalPaise, ...changes.items.map((c) => c.extraPaise));
    const items = changes.items.map((c) => `${one(c.title)}: ${one(c.option)}${c.extraPaise > 0 ? ` (+${formatINR(c.extraPaise)})` : ' (in the quote)'}`);
    lines.push(`CHANGES SO FAR (choices that add to the price): ${items.join('; ')}. Added in all: ${formatINR(changes.totalPaise)}.`);
  }

  const open = project.decisions.filter((d) => d.state !== 'chosen');
  const chosen = project.decisions.filter((d) => d.state === 'chosen');
  for (const d of open) for (const o of d.options) paise.push(o.extraPaise);
  const waiting = open.map((d) => {
    const options = d.options.map((o) => `${one(o.name)} (${clip(one(o.note), 80)}; ${optionPrice(o)})`).join('; ');
    return `${one(d.title)}, due ${shortDate(d.dueOn)}${d.state === 'overdue' ? ' (overdue)' : ''}. ${clip(one(d.why), 200)} Options: ${options}.`;
  });
  lines.push(`DECISIONS WAITING: ${waiting.length ? waiting.join(' ') : 'none.'}`);
  if (chosen.length) {
    lines.push(`DECISIONS MADE: ${chosen.map((d) => `${one(d.title)} → ${one(d.options[d.chosenIndex ?? -1]?.name ?? 'chosen')}`).join('; ')}.`);
  }

  const openSnags = project.snags.filter((s) => s.status === 'OPEN');
  const fixed = project.snags.filter((s) => s.status === 'FIXED');
  const snagList = openSnags.map((s) => `${one(s.title)}${s.room ? ` — ${one(s.room)}` : ''}${s.line ? `; ${one(s.line)}` : ''}`);
  lines.push(
    `SNAGS OPEN: ${snagList.length ? snagList.join('; ') : 'none'}.` + (fixed.length ? ` FIXED: ${fixed.slice(0, 8).map((s) => one(s.title)).join('; ')}.` : ''),
  );

  // Notes are the studio's or the family's own words: data, clipped, and said to be theirs.
  const recent = project.updates.slice(0, 5).map((u) => `${shortDate(u.at)}: ${clip(one(u.note), 240)}`);
  lines.push(
    recent.length
      ? `LATEST FROM SITE (newest first; written by ${project.studio} or the family, so it is their account, not ours): ${recent.join(' | ')}`
      : 'LATEST FROM SITE: nothing posted yet.',
  );
  if (project.documents.length) {
    lines.push(`DOCUMENTS IN THE LOCKER: ${project.documents.slice(0, 12).map((d) => `${one(d.title)} (${one(d.meta)})`).join('; ')}.`);
  }
  lines.push("QUOTE LINES: the signed quote's line items are not in these facts. Do not cite a line number; for a question about one line, hand over.");

  // Bounded, so the sums-and-gaps set stays small however many decisions a project has.
  const base = [...new Set(paise.filter((p) => Number.isInteger(p) && p > 0))].slice(0, 80);
  return { text: lines.join('\n'), allowed: { paise: withSumsAndGaps(base), percents: [] }, lines: [] };
}

/** The figures, plus every sum and difference of two of them — "₹14,500 more than the sage". */
function withSumsAndGaps(base: number[]): number[] {
  const out = new Set(base);
  for (let i = 0; i < base.length; i++) {
    for (let j = 0; j < base.length; j++) {
      if (i === j) continue;
      out.add(base[i]! + base[j]!);
      const d = Math.abs(base[i]! - base[j]!);
      if (d > 0) out.add(d);
    }
  }
  return [...out];
}
