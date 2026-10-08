import { describe, expect, it } from 'vitest';
import { canChoose, checkDecision, daysLeft, decisionState, endOfIstDay, needsReminder, parseOptions } from '@/modules/portal/decisions';
import { checkSnag, snagLine } from '@/modules/portal/snags';
import { messageFor } from '@/modules/notify/messages';
import { isExpoToken } from '@/modules/notify/service';

/** docs/CUSTOMER-PLATFORM-PLAN.md, step 1: decisions, snags and what notifications say. */

// Thu 8 Oct 2026, 10:00 IST
const NOW = new Date('2026-10-08T04:30:00Z');

const options = [
  { name: 'Sage matte laminate', note: 'Soft-touch', extraPaise: 0, swatch: '#9FB59A' },
  { name: 'Walnut grain', note: 'Warm wood look', extraPaise: 14_500_00, swatch: '#7a4a2c' },
];

describe('decision options', () => {
  it('keeps two or more named options, cleaned', () => {
    const o = parseOptions([...options, { name: '  ', note: 'no name' }, 'junk'])!;
    expect(o).toHaveLength(2);
    expect(o[0]!.swatch).toBe('#9fb59a');
    expect(o[1]!.extraPaise).toBe(14_500_00);
  });

  it('refuses fewer than two', () => {
    expect(parseOptions([options[0]])).toBeNull();
    expect(parseOptions('two')).toBeNull();
  });

  it('never stores a negative price or a bad colour', () => {
    const o = parseOptions([
      { name: 'A', extraPaise: -500 },
      { name: 'B', swatch: 'red; background:url(x)' },
    ])!;
    expect(o[0]!.extraPaise).toBe(0);
    expect(o[1]!.swatch).toBeNull();
  });
});

describe('a new decision', () => {
  const good = { title: 'Kitchen shutter finish', why: 'Shutters are cut next week.', dueOn: '2026-10-16', options };

  it('is accepted with a title, a reason, a future date and options', () => {
    const c = checkDecision(good, NOW);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.value.dueOn.toISOString()).toBe('2026-10-16T18:29:59.000Z');
  });

  it('is refused with a past date, no reason, or one option', () => {
    expect(checkDecision({ ...good, dueOn: '2026-10-01' }, NOW).ok).toBe(false);
    expect(checkDecision({ ...good, why: 'soon' }, NOW).ok).toBe(false);
    expect(checkDecision({ ...good, options: [options[0]] }, NOW).ok).toBe(false);
    expect(checkDecision({ ...good, dueOn: '16/10/2026' }, NOW).ok).toBe(false);
  });
});

describe('where a decision stands', () => {
  const due = (date: string) => ({ dueOn: endOfIstDay(date), chosenIndex: null as number | null, remindedAt: null as Date | null });

  it('counts IST days to the due date', () => {
    expect(daysLeft(endOfIstDay('2026-10-08'), NOW)).toBe(0);
    expect(daysLeft(endOfIstDay('2026-10-10'), NOW)).toBe(2);
    expect(daysLeft(endOfIstDay('2026-10-16'), NOW)).toBe(8);
  });

  it('is open, then due soon inside two days, then overdue; chosen wins', () => {
    expect(decisionState(due('2026-10-16'), NOW)).toBe('open');
    expect(decisionState(due('2026-10-10'), NOW)).toBe('due-soon');
    expect(decisionState(due('2026-10-07'), NOW)).toBe('overdue');
    expect(decisionState({ ...due('2026-10-07'), chosenIndex: 0 }, NOW)).toBe('chosen');
  });

  it('reminds once, only when due soon and still open', () => {
    expect(needsReminder(due('2026-10-10'), NOW)).toBe(true);
    expect(needsReminder({ ...due('2026-10-10'), remindedAt: NOW }, NOW)).toBe(false);
    expect(needsReminder({ ...due('2026-10-10'), chosenIndex: 1 }, NOW)).toBe(false);
    expect(needsReminder(due('2026-10-16'), NOW)).toBe(false);
  });

  it('takes a choice that names an option, until the due date', () => {
    const o = parseOptions(options)!;
    expect(canChoose(due('2026-10-16'), o, 1, NOW)).toBe(true);
    expect(canChoose(due('2026-10-16'), o, 2, NOW)).toBe(false);
    expect(canChoose(due('2026-10-16'), o, '1', NOW)).toBe(false);
    expect(canChoose(due('2026-10-07'), o, 0, NOW)).toBe(false);
  });
});

describe('snags', () => {
  it('need a short title; room and note are optional', () => {
    expect(checkSnag({ title: 'ok' }).ok).toBe(false);
    const c = checkSnag({ title: '  Gap between   wardrobe and ceiling ', room: '', note: 42 });
    expect(c).toEqual({ ok: true, value: { title: 'Gap between wardrobe and ceiling', room: null, note: null } });
  });

  it('say when they will be or were fixed', () => {
    expect(snagLine({ status: 'OPEN', fixBy: new Date('2026-10-10T06:30:00Z'), fixedAt: null })).toBe('Fix by Sat 10 Oct');
    expect(snagLine({ status: 'FIXED', fixBy: null, fixedAt: new Date('2026-09-26T06:30:00Z') })).toBe('Fixed Sat 26 Sept');
    expect(snagLine({ status: 'OPEN', fixBy: null, fixedAt: null })).toBeNull();
  });
});

describe('what a notification says', () => {
  it('a site update names the studio and counts the photos', () => {
    const m = messageFor({ kind: 'update', studio: 'Teakline Studio', note: 'Wardrobe frames fitted.', photos: 3 });
    expect(m.title).toBe('New from site · Teakline Studio');
    expect(m.body).toBe('Wardrobe frames fitted. (3 photos)');
    expect(m.url).toBe('/app/site');
  });

  it('a long note is clipped for the lock screen', () => {
    const m = messageFor({ kind: 'update', studio: 'S', note: 'x'.repeat(400), photos: 0 });
    expect(m.body.length).toBe(160);
    expect(m.body.endsWith('…')).toBe(true);
  });

  it('a due decision says how long is left and opens it', () => {
    expect(messageFor({ kind: 'decision-due', decisionId: 'd1', title: 'Shutter finish', daysLeft: 2 }).title).toBe('Decision due in 2 days');
    expect(messageFor({ kind: 'decision-due', decisionId: 'd1', title: 'Shutter finish', daysLeft: 0 }).title).toBe('Decision due today');
    expect(messageFor({ kind: 'decision-due', decisionId: 'd1', title: 'x', daysLeft: 1 }).url).toBe('/app/decision?id=d1');
  });

  it('the studio hears what was chosen and what it adds', () => {
    const m = messageFor({ kind: 'decision-made', decisionId: 'd1', title: 'Shutter finish', choice: 'Walnut grain', extraPaise: 14_500_00 });
    expect(m.body).toBe('Shutter finish: Walnut grain (+₹14,500).');
  });
});

describe('push tokens', () => {
  it('takes only Expo push tokens', () => {
    expect(isExpoToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
    expect(isExpoToken('ExpoPushToken[AbC-123_xyzABCDEF]')).toBe(true);
    expect(isExpoToken('fcm:abc')).toBe(false);
    expect(isExpoToken('ExponentPushToken[]')).toBe(false);
    expect(isExpoToken(42)).toBe(false);
  });
});

describe('the screens, from a real project', async () => {
  const { currentStage, dayOf, daysLate, optionPrice, pickDecision } = await import('@/modules/app/project-view');
  const stage = (key: string, targetOn: string, state: 'done' | 'now' | 'next' | 'later', late = false) => ({ key, label: key, targetOn, state, late });
  const stages = [
    stage('DESIGN', '2026-09-01T00:00:00Z', 'done'),
    stage('PRODUCTION', '2026-10-01T00:00:00Z', 'now', true),
    stage('HANDOVER', '2026-12-14T00:00:00Z', 'next'),
  ];

  it('finds the stage happening now', () => {
    expect(currentStage(stages).stage?.key).toBe('PRODUCTION');
    expect(currentStage(stages.map((s) => ({ ...s, state: 'done' as const }))).stage).toBeNull();
  });

  it('counts the day of the project and how late it runs', () => {
    expect(dayOf('2026-08-01T00:00:00Z', stages, NOW)).toEqual({ day: 69, of: 135 });
    expect(daysLate(stages, NOW)).toBe(7);
    expect(daysLate(stages.map((s) => ({ ...s, late: false })), NOW)).toBe(0);
  });

  it('prices each option against the quote', () => {
    expect(optionPrice({ name: 'a', note: '', extraPaise: 0, swatch: null })).toBe('In quote');
    expect(optionPrice({ name: 'b', note: '', extraPaise: 8_200_00, swatch: null })).toBe('+₹8,200');
  });

  it('leads with the asked-for decision, else the first still open', () => {
    const d = (id: string, state: 'open' | 'due-soon' | 'overdue' | 'chosen') => ({ id, title: id, why: '', dueOn: '', daysLeft: 1, state, options: [], chosenIndex: null });
    const list = [d('a', 'chosen'), d('b', 'due-soon'), d('c', 'open')];
    expect(pickDecision(list, 'c')?.id).toBe('c');
    expect(pickDecision(list, 'zzz')?.id).toBe('b');
    expect(pickDecision([d('a', 'chosen')], null)?.id).toBe('a');
    expect(pickDecision([], null)).toBeNull();
  });
});

describe('project documents', async () => {
  const { checkDoc, docMeta, isDocKind } = await import('@/modules/portal/documents');

  it('need a known kind; the title defaults to the kind', () => {
    expect(isDocKind('AGREEMENT')).toBe(true);
    expect(isDocKind('SECRET')).toBe(false);
    expect(checkDoc({ kind: 'nope', title: 'x' }).ok).toBe(false);
    expect(checkDoc({ kind: 'DRAWINGS', title: '  ' })).toEqual({ ok: true, value: { kind: 'DRAWINGS', title: 'Design drawings' } });
    expect(checkDoc({ kind: 'RECEIPT', title: ' Receipt   2 ' })).toEqual({ ok: true, value: { kind: 'RECEIPT', title: 'Receipt 2' } });
  });

  it('read as type, size and date', () => {
    expect(docMeta({ contentType: 'application/pdf', bytes: 1_258_291, createdAt: new Date('2026-08-03T06:30:00Z') })).toBe('PDF · 1.2 MB · 3 Aug');
    expect(docMeta({ contentType: 'image/jpeg', bytes: 300, createdAt: new Date('2026-08-03T06:30:00Z') })).toBe('Photo · 1 KB · 3 Aug');
  });

  it('a new one tells the customer it is in their Locker', () => {
    const m = messageFor({ kind: 'document', studio: 'Teakline Studio', title: 'Agreement' });
    expect(m).toMatchObject({ title: 'New document · Teakline Studio', body: 'Agreement', url: '/app/locker' });
  });
});
