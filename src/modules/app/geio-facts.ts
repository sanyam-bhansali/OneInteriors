/**
 * What GEIO knows about the customer's home, as plain text for the model,
 * and the only rupee figures it may say.
 *
 * Today that is the example project (`example-project.ts`); when customers
 * have signed projects, this is the one function that changes. Every figure
 * GEIO writes is checked against `allowed` before it is shown: a number that
 * is not here, or not a sum or difference of two that are, means the answer
 * goes to the expert instead.
 */

import { formatINR, formatINRCompact } from '@/lib/money';
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

/**
 * The same text for every homeowner on the same project, so the model's
 * prompt cache can reuse it; their name travels with the question instead.
 */
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
