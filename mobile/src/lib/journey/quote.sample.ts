import type { Booking, CompareView, ExpertSlots } from './quote';
import type { SampleHandler } from './sample';

/**
 * Sample answers for the phone, quote, compare and expert screens
 * (docs/app-handover/SAMPLE-DATA.md): Priya's Premium matches, Teakline
 * ₹18.4 L, Chitra & Co. ₹19.6 L, Maya Workshop ₹16.9 L, and Meera's open
 * times over the next five working days in IST. The verification itself is
 * answered by lib/sample.ts ({ token: 'sample' }).
 */

const L = (lakh: number) => Math.round(lakh * 100_000 * 100);

type Column = CompareView['columns'][number];

/** The three studios as Compare.dc.html shows them, found by the slug the matches sample uses. */
const STUDIOS: (Column & { key: RegExp })[] = [
  {
    key: /teak/,
    slug: 'teakline-studio',
    name: 'Teakline Studio',
    totalPaise: L(18.4),
    board: '18mm BWP ply',
    shutter: 'Matt laminate',
    counter: 'Quartz',
    weeks: 14,
    lateness: 'Usually 4 days late',
    checks: '15/15',
  },
  {
    key: /chitra/,
    slug: 'chitra-and-co',
    name: 'Chitra & Co.',
    totalPaise: L(19.6),
    board: '18mm BWP ply',
    shutter: 'Acrylic',
    counter: 'Quartz',
    weeks: 16,
    lateness: 'Usually 2 days late',
    checks: '15/15',
  },
  {
    key: /maya/,
    slug: 'maya-workshop',
    name: 'Maya Workshop',
    totalPaise: L(16.9),
    board: '16mm MDF',
    shutter: 'Matt laminate',
    counter: 'Granite',
    weeks: 12,
    lateness: null,
    checks: '14/15',
  },
];

function compare(body: unknown): CompareView {
  const slugs = ((body as { slugs?: unknown } | null)?.slugs as string[] | undefined) ?? [];
  const picked = slugs.length
    ? slugs.flatMap((slug) => {
        const s = STUDIOS.find((x) => x.key.test(slug));
        return s ? [{ ...s, slug }] : [];
      })
    : STUDIOS;
  const columns = (picked.length ? picked : STUDIOS).map(({ key: _key, ...c }) => c);
  return {
    plainWords: [
      'Maya Workshop is ₹2.7 L cheaper than Chitra & Co. The biggest share of that is the wardrobes: 16mm MDF against 18mm BWP ply, which holds up far better in the monsoon.',
      'Teakline Studio sits between them, ₹1.5 L above Maya Workshop.',
      'Chitra & Co. runs closest to schedule. Teakline Studio matches your style best.',
    ],
    columns,
    ratesReal: true,
  };
}

/** "10:00 am" for an IST hour and minute. */
const label = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
const TIMES: [number, number][] = [
  [10, 0],
  [11, 30],
  [13, 0],
  [16, 0],
  [17, 30],
  [18, 30],
];

/** Meera's open half-hours over the next five working days (Sundays off), from tomorrow, in IST. */
function slots(): ExpertSlots {
  const IST = 330 * 60_000;
  const today = new Date(Date.now() + IST);
  const days: ExpertSlots['days'] = [];
  for (let i = 1; days.length < 5 && i < 10; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    if (d.getUTCDay() === 0) continue;
    const date = d.toISOString().slice(0, 10);
    days.push({
      date,
      slots: TIMES.map(([h, m]) => ({ startsAt: new Date(d.getTime() + (h * 60 + m) * 60_000 - IST).toISOString(), label: label(h, m) })),
    });
  }
  return {
    expert: { name: 'Meera', photo: null, line: "Architect. On our payroll, never a studio's, and paid the same whichever studio you pick." },
    days,
  };
}

function book(body: unknown): { booking: Booking } {
  const startsAt = String((body as { startsAt?: unknown } | null)?.startsAt ?? new Date().toISOString());
  const d = new Date(new Date(startsAt).getTime() + 330 * 60_000);
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return { booking: { startsAt, label: `${day}, ${label(d.getUTCHours(), d.getUTCMinutes())}` } };
}

export const QUOTE_SAMPLES: SampleHandler[] = [
  { match: (r) => r === 'POST /journey/compare', answer: (_r, body) => compare(body) },
  { match: (r) => r === 'GET /expert/slots', answer: () => slots() },
  { match: (r) => r === 'POST /expert/book', answer: (_r, body) => book(body) },
  {
    match: (r) => r === 'POST /journey/submit',
    answer: (_r, body) => ({ shortlisted: (((body as { slugs?: unknown[] } | null)?.slugs ?? []) as unknown[]).length }),
  },
];
