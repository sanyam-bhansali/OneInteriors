import { describe, expect, it, vi } from 'vitest';
import {
  dedupeKey,
  eventRow,
  FORBIDDEN_PAYLOAD_KEYS,
  PROJECT_EVENT_TYPES,
  recordEvent,
  recordEventOnce,
  SNAG_EVENT_TYPE,
  type EventWriter,
  type ProjectEventInput,
} from '@/modules/project/events';

const base: ProjectEventInput = {
  projectId: 'p1',
  type: 'site.posted',
  actor: { type: 'STUDIO', id: 'u-sup' },
  refId: 'log1',
  payload: { day: '2026-10-12', photos: 3, crew: ['Ramesh'] },
};

describe('eventRow', () => {
  it('builds the row', () => {
    expect(eventRow(base)).toEqual({
      projectId: 'p1',
      type: 'site.posted',
      actorType: 'STUDIO',
      actorId: 'u-sup',
      refId: 'log1',
      payload: { day: '2026-10-12', photos: 3, crew: ['Ramesh'] },
      dedupeKey: null,
    });
    const at = new Date('2026-10-12T05:00:00Z');
    expect(eventRow({ ...base, at }).at).toBe(at);
    expect(eventRow({ ...base, payload: undefined }).payload).toEqual({});
  });

  it('refuses an unknown type', () => {
    expect(() => eventRow({ ...base, type: 'site.edited' as never })).toThrow(/Unknown/);
  });

  it('needs a person for a person, and no person for SYSTEM', () => {
    expect(() => eventRow({ ...base, actor: { type: 'CUSTOMER', id: '' } })).toThrow();
    expect(() => eventRow({ ...base, actor: { type: 'SYSTEM', id: 'u1' as never } })).toThrow();
    expect(eventRow({ ...base, actor: { type: 'SYSTEM' } }).actorId).toBeNull();
  });

  it('keeps internal fields out of the payload, at any depth', () => {
    for (const key of FORBIDDEN_PAYLOAD_KEYS) {
      expect(() => eventRow({ ...base, payload: { photos: [{ [key]: 'x' }] } }), key).toThrow(/may not carry/);
    }
    for (const k of ['transcript', 'voicePath', 'studioCostDeltaPaise', 'internalNote', 'phone']) {
      expect(FORBIDDEN_PAYLOAD_KEYS).toContain(k);
    }
  });

  it('takes plain JSON only: no bigint, Date, NaN, or anything too big', () => {
    expect(() => eventRow({ ...base, payload: { amount: 10n as never } })).toThrow(/plain JSON/);
    expect(() => eventRow({ ...base, payload: { at: new Date() as never } })).toThrow(/plain JSON/);
    expect(() => eventRow({ ...base, payload: { n: Number.NaN } })).toThrow(/finite/);
    expect(() => eventRow({ ...base, payload: { big: 'x'.repeat(5000) } })).toThrow(/bytes/);
  });
});

describe('writing events', () => {
  const fakeTx = () => {
    const create = vi.fn(async (_args: unknown) => ({ id: 'e1' }));
    const createMany = vi.fn(async (_args: unknown) => ({ count: 1 }));
    return { tx: { homeProjectEvent: { create, createMany } } as unknown as EventWriter, create, createMany };
  };

  it('recordEvent inserts one row in the caller’s transaction', async () => {
    const { tx, create } = fakeTx();
    await expect(recordEvent(tx, base)).resolves.toBe('e1');
    expect(create).toHaveBeenCalledWith({ data: eventRow(base), select: { id: true } });
  });

  it('recordEventOnce skips a duplicate rather than failing the transaction', async () => {
    const { tx, createMany } = fakeTx();
    const input = { ...base, type: 'reminder.sent' as const, actor: { type: 'SYSTEM' as const }, dedupeKey: dedupeKey('reminder', 'p1', '2026-10-12', '18:00') };
    await expect(recordEventOnce(tx, input)).resolves.toBe(true);
    expect(createMany).toHaveBeenCalledWith({ data: [eventRow(input)], skipDuplicates: true });
    createMany.mockResolvedValueOnce({ count: 0 });
    await expect(recordEventOnce(tx, input)).resolves.toBe(false);
    await expect(recordEventOnce(tx, { ...input, dedupeKey: '' })).rejects.toThrow();
  });

  it('builds dedupe keys from clean parts', () => {
    expect(dedupeKey('reminder', 'p1', '2026-10-12', '18:00')).toBe('reminder|p1|2026-10-12|18:00');
    expect(() => dedupeKey()).toThrow();
    expect(() => dedupeKey('a', '')).toThrow();
    expect(() => dedupeKey('a|b')).toThrow();
  });
});

describe('the event types', () => {
  it('are unique and dotted', () => {
    expect(new Set(PROJECT_EVENT_TYPES).size).toBe(PROJECT_EVENT_TYPES.length);
    for (const t of PROJECT_EVENT_TYPES) expect(t).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  it('cover every snag event kind', () => {
    for (const t of Object.values(SNAG_EVENT_TYPE)) expect(PROJECT_EVENT_TYPES).toContain(t);
    expect(Object.keys(SNAG_EVENT_TYPE).sort()).toEqual(['ACCEPTED', 'AUTO_CLOSED', 'CONFIRMED', 'DISPUTED', 'FIXED', 'RAISED', 'REOPENED']);
  });
});
