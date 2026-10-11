import { describe, expect, it } from 'vitest';
import { buildToday, istDayBounds, todayCount, todayEmail, type TodayLead, type TodayQuote } from '@/modules/studio-sales/today-rules';

/** Studio OS Phase 1: building Today (docs/studio-os/PHASE-1-SALES.md §7). */

const NOW = new Date('2026-10-12T04:30:00Z'); // 10:00 IST, Mon 12 Oct
const day = (iso: string) => new Date(iso);

const lead = (over: Partial<TodayLead>): TodayLead => ({
  id: 'c',
  name: 'Lead',
  phone: '9876543210',
  assignedToId: 'm-sales',
  assignedToName: 'Asha',
  stageKind: 'OPEN',
  nextAction: null,
  nextActionOn: null,
  lastContactedAt: day('2026-10-10T06:00:00Z'),
  meetingAt: null,
  meetingNote: null,
  hasFloorPlan: true,
  quoteCount: 1,
  isDemo: false,
  booked: false,
  ...over,
});

const section = (s: ReturnType<typeof buildToday>, id: string) => s.find((x) => x.id === id)!;

describe('the India day', () => {
  it('runs midnight to midnight IST', () => {
    const { start, end } = istDayBounds(NOW);
    expect(start.toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-12T18:29:59.999Z');
  });
});

describe('calls due and late', () => {
  it('lists due today and late, late first, each with Call', () => {
    const s = buildToday({
      leads: [
        lead({ id: 'a', name: 'Today', nextAction: 'Call back', nextActionOn: day('2026-10-12T10:00:00Z') }),
        lead({ id: 'b', name: 'Late', nextAction: 'Send plan', nextActionOn: day('2026-10-09T05:00:00Z') }),
        lead({ id: 'c', name: 'Tomorrow', nextActionOn: day('2026-10-13T05:00:00Z') }),
      ],
      quotes: [],
      bookings: [],
      now: NOW,
      seesAll: false,
    });
    const calls = section(s, 'calls').rows;
    expect(calls.map((r) => r.title)).toEqual(['Late', 'Today']);
    expect(calls[0]).toMatchObject({ late: true, detail: 'Send plan · 3 days late', action: { label: 'Call', href: 'tel:9876543210', kind: 'call' } });
    expect(calls[1]).toMatchObject({ late: false, detail: 'Call back · due today' });
  });

  it('never lists the sample lead, or a lost one', () => {
    const s = buildToday({
      leads: [lead({ id: 'demo', isDemo: true, nextActionOn: NOW }), lead({ id: 'gone', stageKind: 'LOST', nextActionOn: NOW })],
      quotes: [],
      bookings: [],
      now: NOW,
      seesAll: true,
    });
    expect(todayCount(s)).toBe(0);
  });
});

describe('meetings, floor plans, quotes, bookings', () => {
  const s = buildToday({
    leads: [
      lead({ id: 'm', name: 'Meeting', meetingAt: day('2026-10-12T05:30:00Z'), meetingNote: 'Office' }),
      lead({ id: 'm2', name: 'Meeting tomorrow', meetingAt: day('2026-10-13T05:30:00Z') }),
      lead({ id: 'p', name: 'No plan', hasFloorPlan: false, quoteCount: 0 }),
      lead({ id: 'p2', name: 'Never spoke', hasFloorPlan: false, quoteCount: 0, lastContactedAt: null }),
    ],
    quotes: [
      { id: 'q1', number: '2026-004', clientId: 'x', clientName: 'Kothari', status: 'ISSUED', latestRevision: 2, lastSentAt: day('2026-10-09T05:00:00Z'), hasSalesFinal: false, booked: false },
      { id: 'q2', number: '2026-005', clientId: 'y', clientName: 'Booked one', status: 'ISSUED', latestRevision: 1, lastSentAt: day('2026-10-09T05:00:00Z'), hasSalesFinal: true, booked: true },
      { id: 'q3', number: '2026-006', clientId: 'z', clientName: 'Draft', status: 'DRAFT', latestRevision: null, lastSentAt: null, hasSalesFinal: false, booked: false },
    ] satisfies TodayQuote[],
    bookings: [
      { clientId: 'b1', name: 'Booked Monday', bookedAt: day('2026-10-12T03:00:00Z'), amountPaise: 2_500_000 },
      { clientId: 'b2', name: 'Booked long ago', bookedAt: day('2026-09-20T03:00:00Z'), amountPaise: 2_500_000 },
    ],
    now: NOW,
    seesAll: false,
  });

  it('meetings today only, with the time', () => {
    expect(section(s, 'meetings').rows).toEqual([expect.objectContaining({ title: 'Meeting', detail: '11 am · Office' })]);
  });

  it('floor plans not in yet: spoken to, no plan, no quote', () => {
    expect(section(s, 'floor-plans').rows.map((r) => r.title)).toEqual(['No plan']);
    expect(section(s, 'floor-plans').rows[0]!.action.href).toBe('/studio/clients/p#files');
  });

  it('quotes sent and waiting: sent, not booked', () => {
    expect(section(s, 'quotes').rows).toEqual([expect.objectContaining({ title: 'Kothari', detail: '2026-004 R2 sent 3 days ago' })]);
  });

  it('bookings this week', () => {
    expect(section(s, 'bookings').rows.map((r) => r.title)).toEqual(['Booked Monday']);
  });

  it('a salesperson gets no pool and no never-called sections', () => {
    expect(s.find((x) => x.id === 'pool')).toBeUndefined();
    expect(s.find((x) => x.id === 'never-called')).toBeUndefined();
  });
});

describe('owner and PM also see the pool and leads nobody has called', () => {
  const s = buildToday({
    leads: [
      lead({ id: 'pool', name: 'In the pool', assignedToId: null, assignedToName: null, lastContactedAt: null }),
      lead({ id: 'nc', name: 'Never called', lastContactedAt: null }),
      lead({ id: 'ok', name: 'Called', lastContactedAt: NOW }),
    ],
    quotes: [],
    bookings: [],
    now: NOW,
    seesAll: true,
  });

  it('the pool, each with Assign', () => {
    expect(section(s, 'pool').rows).toEqual([expect.objectContaining({ title: 'In the pool', action: expect.objectContaining({ kind: 'assign' }) })]);
  });

  it('nobody has called: assigned, never contacted', () => {
    expect(section(s, 'never-called').rows).toEqual([expect.objectContaining({ title: 'Never called', detail: 'Asha has it · nobody has called yet' })]);
  });
});

describe('the morning email', () => {
  it('lists each section, and is not sent when there is nothing', () => {
    const s = buildToday({ leads: [lead({ name: 'Priya', nextAction: 'Call back', nextActionOn: NOW })], quotes: [], bookings: [], now: NOW, seesAll: false });
    const mail = todayEmail(s, 'Asha', 'Hauspire')!;
    expect(mail.title).toBe('Today: 1 thing for you');
    expect(mail.body).toContain('Good morning Asha');
    expect(mail.body).toContain('- Priya: Call back · due today');
    expect(todayEmail(buildToday({ leads: [], quotes: [], bookings: [], now: NOW, seesAll: true }), 'A', 'B')).toBeNull();
  });

  it('cuts long sections and says how many more', () => {
    const many = Array.from({ length: 30 }, (_, i) => lead({ id: `l${i}`, name: `L${i}`, nextActionOn: NOW }));
    const s = buildToday({ leads: many, quotes: [], bookings: [], now: NOW, seesAll: false, limit: 25 });
    expect(section(s, 'calls').rows).toHaveLength(25);
    expect(section(s, 'calls').more).toBe(5);
    expect(todayEmail(s, 'A', 'B')!.body).toContain('- and 20 more');
  });
});
