import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The daily site log (studio workspace Phase 2): one UPDATE or NOBODY per
 * project per IST day, a second post that day becomes a CORRECTION beside
 * it, an offline resend with the same clientRef lands once, nobody on site
 * needs a reason, and only a member on the project may post. Ticking a step
 * needs its own photo with a sentence (the step tracker), the step points at
 * that photo, and the stage finishes in the same transaction when its last
 * step is ticked. Prisma and the session are mocked with a small in-memory
 * store that enforces the two unique indexes the way Postgres does (P2002).
 *
 * Studio s1: owner, a supervisor on p1 (not p2), accounts. p9 is another
 * studio's project.
 */

type Role = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';
type Row = Record<string, unknown> & { id: string };

const db = vi.hoisted(() => {
  const members: Record<string, { id: string; studioId: string; userId: string; role: Role; status: 'ACTIVE' }> = {
    'u-owner': { id: 'm-owner', studioId: 's1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE' },
    'u-sup': { id: 'm-sup', studioId: 's1', userId: 'u-sup', role: 'SUPERVISOR', status: 'ACTIVE' },
    'u-acc': { id: 'm-acc', studioId: 's1', userId: 'u-acc', role: 'ACCOUNTS', status: 'ACTIVE' },
  };
  const projects: Record<string, string> = { p1: 's1', p2: 's1', p9: 's2' };
  const assigned = new Set(['p1:m-sup']);
  const state = {
    logs: [] as Row[],
    events: [] as Row[],
    ticks: [] as { where: unknown; data: unknown }[],
    crewMade: [] as Row[],
    items: new Map<string, { doneAt: Date | null; donePhotoId: string | null; inScope: boolean }>([
      ['i1', { doneAt: null, donePhotoId: null, inScope: true }],
      ['i2', { doneAt: null, donePhotoId: null, inScope: true }],
    ]),
    stageDone: null as Date | null,
    raceOnce: false,
    seq: 0,
  };
  const p2002 = (target: string) => {
    // Built lazily so the hoisted block does not need the import.
    return { code: 'P2002', target };
  };
  return { members, projects, assigned, state, p2002 };
});

vi.mock('@/lib/prisma', () => {
  const { members, projects, assigned, state } = db;
  const unique = (target: string) => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test', meta: { target } });
  const homeSiteLog = {
    findUnique: vi.fn(async ({ where }: { where: { clientRef: string } }) => {
      const row = state.logs.find((l) => l.clientRef === where.clientRef);
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.projectId,
        kind: row.kind,
        date: row.date,
        stage: { name: 'Carpentry' },
        _count: { photos: (row.photos as unknown[]).length, crew: (row.crew as unknown[]).length, ticked: 0 },
        project: { introduction: { brief: { contactName: 'Priya Shah', user: { name: 'Priya', locale: 'en-IN' } } } },
      };
    }),
    findFirst: vi.fn(async ({ where }: { where: { projectId: string; date: Date } }) => {
      if (state.raceOnce) {
        state.raceOnce = false;
        return null;
      }
      const row = state.logs.find((l) => l.projectId === where.projectId && (l.date as Date).getTime() === where.date.getTime() && l.kind !== 'CORRECTION');
      return row ? { id: row.id } : null;
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (state.logs.some((l) => l.clientRef === data.clientRef)) throw unique('clientRef');
      if (
        data.kind !== 'CORRECTION' &&
        state.logs.some((l) => l.projectId === data.projectId && (l.date as Date).getTime() === (data.date as Date).getTime() && l.kind !== 'CORRECTION')
      ) {
        throw unique('home_site_logs_one_per_day_key');
      }
      const row = {
        ...data,
        id: `log${++state.seq}`,
        photos: (data.photos as { create: unknown[] }).create,
        crew: (data.crew as { create: unknown[] }).create,
      };
      state.logs.push(row);
      return { id: row.id, photos: (row.photos as unknown[]).map((_, i) => ({ id: `ph-${row.id}-${i}` })) };
    }),
    findMany: vi.fn(async () => []),
  };
  const tx = {
    homeSiteLog,
    homeChecklistItem: {
      updateMany: vi.fn(async (args: { where: { id: string }; data: { doneAt: Date; donePhotoId: string } }) => {
        state.ticks.push(args);
        const item = state.items.get(args.where.id);
        if (!item || item.doneAt) return { count: 0 };
        item.doneAt = args.data.doneAt;
        item.donePhotoId = args.data.donePhotoId;
        return { count: 1 };
      }),
    },
    homeProjectStage: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'st-carp' ? { id: 'st-carp', kind: 'CARPENTRY', actualEnd: state.stageDone, items: [...state.items.values()] } : null,
      ),
      update: vi.fn(async ({ data }: { data: { actualEnd: Date | null } }) => {
        state.stageDone = data.actualEnd;
        return {};
      }),
    },
    homeProjectUpdate: { findMany: vi.fn(async () => []) },
    homeProject: {
      findUnique: vi.fn(async () => ({ doneStages: [] as string[] })),
      update: vi.fn(async () => ({})),
    },
    homeProjectEvent: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        state.events.push(data);
        return { id: `e${state.events.length}` };
      }),
    },
    studioCrewMember: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { ...data, id: `crew-new-${state.crewMade.length}` };
        state.crewMade.push(row);
        return { id: row.id };
      }),
    },
  };
  return {
    prisma: {
      ...tx,
      studioMember: { findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => members[where.userId] ?? null) },
      studioProjectMember: {
        findUnique: vi.fn(async ({ where }: { where: { homeProjectId_memberId: { homeProjectId: string; memberId: string } } }) =>
          assigned.has(`${where.homeProjectId_memberId.homeProjectId}:${where.homeProjectId_memberId.memberId}`) ? { id: 'spm' } : null,
        ),
      },
      homeProject: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          projects[where.id]
            ? {
                introduction: {
                  studioId: projects[where.id],
                  studio: { tradeName: 'Teakline' },
                  brief: { userId: 'u-customer', contactName: 'Priya Shah', society: null, locality: null, propertyType: null, user: { name: 'Priya', locale: 'mr-IN' } },
                },
                stages: [
                  { id: 'st-design', name: 'Design', actualEnd: new Date('2026-10-01T00:00:00Z'), items: [] },
                  {
                    id: 'st-carp',
                    name: 'Carpentry',
                    actualEnd: null,
                    items: [
                      { id: 'i1', room: 'Execution stage 2A', label: 'Carcass complete with hardware', doneAt: null, inScope: true, quoteLineId: null },
                      { id: 'i2', room: 'Execution stage 2B', label: 'Shutters delivered', doneAt: null, inScope: true, quoteLineId: null },
                      { id: 'i3', room: 'Execution stage 2B', label: 'Name plate ordered', doneAt: null, inScope: false, quoteLineId: null },
                    ],
                  },
                ],
              }
            : null,
        ),
      },
      studioCrewMember: {
        ...tx.studioCrewMember,
        findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; studioId: string } }) =>
          where.studioId === 's1' ? where.id.in.filter((id) => id === 'crew-ramesh').map((id) => ({ id, name: 'Ramesh Pawar', role: 'Carpenter' })) : [],
        ),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: 'STUDIO' } }));
vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(async () => session.user),
  hasRole: (user: { role: string } | null, role: string) => !!user && (user.role === role || role === 'CUSTOMER'),
  requireRole: vi.fn(async () => {
    throw new Error('UNAUTHORISED');
  }),
}));
const notified = vi.hoisted(() => [] as unknown[]);
vi.mock('@/modules/notify/service', () => ({ notify: vi.fn(async (...args: unknown[]) => void notified.push(args)) }));

import { postSiteLog } from '@/modules/project/site-log';
import { NOBODY_REASONS, countsAgainstStudio, logKind, parsePost } from '@/modules/project/site-log-rules';

const as = (userId: string) => {
  session.user = { id: userId, role: 'STUDIO' };
};
const NOW = new Date('2026-10-14T12:00:00Z'); // 17:30 IST, Wed 14 Oct

const update = (over: Record<string, unknown> = {}) => ({
  projectId: 'p1',
  clientRef: 'ref-aaaaaaaa',
  kind: 'UPDATE',
  postedAt: '2026-10-14T11:30:00Z',
  photos: [
    {
      path: 'project_p1/site/a.jpg',
      takenAt: '2026-10-14T11:20:00Z',
      fromGallery: false,
      lat: 18.52,
      lng: 73.85,
      voicePath: 'project_p1/voice/a.webm',
      transcript: 'बेडरूम एकमधल्या वॉर्डरोबची फ्रेम आज बसवली.',
      transcriptLang: 'mr',
      customerText: 'Wardrobe frame fitted in bedroom 1.',
      customerLang: 'en',
    },
  ],
  crew: [{ crewMemberId: 'crew-ramesh', arrivedAt: '2026-10-14T04:10:00Z' }],
  ticks: [{ itemId: 'i1', source: 'VOICE', photoIndex: 0 }],
  ...over,
});

/** A second photo, with a typed sentence. */
const typedPhoto = (text = 'Shutters delivered and stacked in the hall.') => ({ path: 'project_p1/site/b.jpg', takenAt: '2026-10-14T11:25:00Z', text });

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  db.state.logs.length = 0;
  db.state.events.length = 0;
  db.state.ticks.length = 0;
  db.state.crewMade.length = 0;
  db.state.items.set('i1', { doneAt: null, donePhotoId: null, inScope: true });
  db.state.items.set('i2', { doneAt: null, donePhotoId: null, inScope: true });
  db.state.stageDone = null;
  db.state.raceOnce = false;
  notified.length = 0;
  session.user = null;
});

describe('posting today’s update', () => {
  it('writes the day’s UPDATE with photos, crew and ticks, and its events in the same transaction', async () => {
    as('u-sup');
    const r = await postSiteLog(update(), NOW);
    expect(r).toMatchObject({ ok: true, post: { kind: 'UPDATE', day: '2026-10-14', photos: 1, crew: 1, ticked: 1, stage: 'Carpentry', duplicate: false } });
    const log = db.state.logs[0]!;
    expect(log).toMatchObject({ projectId: 'p1', kind: 'UPDATE', reason: null, stageId: 'st-carp', postedById: 'u-sup', clientRef: 'ref-aaaaaaaa', correctsId: null });
    expect((log.date as Date).toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(log.photos).toEqual([
      expect.objectContaining({ storagePath: 'project_p1/site/a.jpg', fromGallery: false, voicePath: 'project_p1/voice/a.webm', customerText: 'Wardrobe frame fitted in bedroom 1.', sortOrder: 0 }),
    ]);
    // Name and role copied at posting.
    expect(log.crew).toEqual([expect.objectContaining({ crewName: 'Ramesh Pawar', crewRole: 'Carpenter', crewMember: { connect: { id: 'crew-ramesh' } } })]);
    expect(db.state.ticks[0]).toMatchObject({
      where: { id: 'i1', doneAt: null, inScope: true, stage: { projectId: 'p1' } },
      data: { doneSource: 'VOICE', doneById: 'u-sup', doneSiteLogId: log.id, donePhotoId: `ph-${log.id}-0` },
    });
    expect(db.state.stageDone).toBeNull(); // the stage has another step open
    expect(db.state.events.map((e) => e.type)).toEqual(['site.posted', 'checklist.ticked']);
    expect(db.state.events[0]).toMatchObject({ refId: log.id, actorType: 'STUDIO', actorId: 'u-sup', at: new Date('2026-10-14T11:30:00Z') });
    expect(JSON.stringify(db.state.events)).not.toContain('बेडरूम'); // no transcript in a payload
    expect(notified).toHaveLength(1);
  });

  it('a resend of the same post (same clientRef) lands once and answers success', async () => {
    as('u-sup');
    await postSiteLog(update(), NOW);
    const again = await postSiteLog(update(), NOW);
    expect(again).toMatchObject({ ok: true, post: { duplicate: true, kind: 'UPDATE', day: '2026-10-14' } });
    expect(db.state.logs).toHaveLength(1);
    expect(db.state.events.filter((e) => e.type === 'site.posted')).toHaveLength(1);
  });

  it('a second post the same day is a CORRECTION beside the first, never an edit', async () => {
    as('u-sup');
    const first = await postSiteLog(update(), NOW);
    const second = await postSiteLog(
      update({
        clientRef: 'ref-bbbbbbbb',
        photos: [...update().photos, typedPhoto()],
        ticks: [
          { itemId: 'i1', source: 'TICK', photoIndex: 0 },
          { itemId: 'i2', source: 'TICK', photoIndex: 1 },
        ],
      }),
      NOW,
    );
    expect(second).toMatchObject({ ok: true, post: { kind: 'CORRECTION' } });
    expect(db.state.logs).toHaveLength(2);
    expect(db.state.logs[1]).toMatchObject({ kind: 'CORRECTION', correctsId: first.ok ? first.post.id : '' });
    // i1 was ticked by the first post; only i2 is new — and it was the stage's last step in scope.
    expect(second.ok && second.post.ticked).toBe(1);
    expect(db.state.items.get('i2')).toMatchObject({ donePhotoId: `ph-${db.state.logs[1]!.id}-1` });
    expect(db.state.events.map((e) => e.type)).toEqual(['site.posted', 'checklist.ticked', 'site.corrected', 'checklist.ticked', 'stage.done']);
    expect(db.state.stageDone).toEqual(new Date('2026-10-14T11:30:00Z'));
  });

  it('two different posts racing for the same day: the loser becomes the correction', async () => {
    as('u-sup');
    await postSiteLog(update(), NOW);
    db.state.raceOnce = true;
    const r = await postSiteLog(update({ clientRef: 'ref-cccccccc' }), NOW);
    expect(r).toMatchObject({ ok: true, post: { kind: 'CORRECTION' } });
  });

  it('a post saved offline and sent the next morning is the day it was taken, not a late update', async () => {
    as('u-sup');
    const r = await postSiteLog(update({ postedAt: '2026-10-13T13:30:00Z' }), new Date('2026-10-14T03:00:00Z'));
    expect(r).toMatchObject({ ok: true, post: { day: '2026-10-13' } });
    expect(db.state.logs[0]!.postedAt).toEqual(new Date('2026-10-13T13:30:00Z'));
    expect(db.state.events[0]).toMatchObject({ payload: expect.objectContaining({ day: '2026-10-13', offline: true }) });
  });

  it('a voice note recorded with no signal gets its customer sentence on arrival', async () => {
    as('u-sup');
    const photos = [{ path: 'project_p1/site/b.jpg', takenAt: '2026-10-14T11:00:00Z', voicePath: 'project_p1/voice/b.webm' }];
    await postSiteLog(update({ photos, ticks: [] }), NOW);
    const photo = (db.state.logs[0]!.photos as Record<string, unknown>[])[0]!;
    expect(photo.customerText).toEqual(expect.any(String));
    expect(photo.customerLang).toBe('mr'); // the customer's own language (User.locale)
  });

  it('a new face is kept on the crew list only by someone who manages the crew', async () => {
    as('u-sup');
    await postSiteLog(update({ crew: [{ crewMemberId: null, name: 'Imran', role: 'Electrician', save: true }] }), NOW);
    expect(db.state.crewMade).toHaveLength(0);
    expect(db.state.logs[0]!.crew).toEqual([expect.objectContaining({ crewName: 'Imran', crewRole: 'Electrician' })]);
    as('u-owner');
    await postSiteLog(update({ projectId: 'p2', clientRef: 'ref-dddddddd', photos: [], ticks: [], crew: [{ name: 'Imran', role: 'Electrician', save: true }], voice: { customerText: 'Wiring done.' } }), NOW);
    expect(db.state.crewMade).toEqual([expect.objectContaining({ studioId: 's1', name: 'Imran', role: 'Electrician' })]);
  });

  it('refuses a photo path from another project, and a crew member from another studio', async () => {
    as('u-sup');
    const bad = update({ photos: [{ path: 'project_p9/site/x.jpg', takenAt: '2026-10-14T11:00:00Z' }] });
    expect(await postSiteLog(bad, NOW)).toEqual({ ok: false, error: 'bad_path' });
    expect(await postSiteLog(update({ crew: [{ crewMemberId: 'crew-other-studio' }] }), NOW)).toEqual({ ok: false, error: 'crew' });
    expect(await postSiteLog(update({ ticks: [{ itemId: 'i-not-here', photoIndex: 0 }] }), NOW)).toEqual({ ok: false, error: 'items' });
    // A step marked not in scope cannot be ticked.
    expect(await postSiteLog(update({ ticks: [{ itemId: 'i3', photoIndex: 0 }] }), NOW)).toEqual({ ok: false, error: 'items' });
    expect(db.state.logs).toHaveLength(0);
  });
});

describe('ticking a step needs its own photo with a sentence', () => {
  it('refuses a tick with no photo — a post queued before the rule — and writes nothing', async () => {
    as('u-sup');
    expect(await postSiteLog(update({ ticks: [{ itemId: 'i1', source: 'TICK' }] }), NOW)).toEqual({ ok: false, error: 'tick_photo' });
    expect(await postSiteLog(update({ ticks: [{ itemId: 'i1', photoIndex: 3 }] }), NOW)).toEqual({ ok: false, error: 'tick_photo' });
    expect(await postSiteLog(update({ ticks: [{ itemId: 'i1', photoIndex: 0.5 }] }), NOW)).toEqual({ ok: false, error: 'tick_photo' });
    expect(await postSiteLog(update({ photos: [], ticks: [{ itemId: 'i1', photoIndex: 0 }] }), NOW)).toEqual({ ok: false, error: 'tick_photo' });
    expect(db.state.logs).toHaveLength(0);
    expect(db.state.ticks).toHaveLength(0);
  });

  it('one photo per tick', () => {
    const r = parsePost(update({ ticks: [{ itemId: 'i1', photoIndex: 0 }, { itemId: 'i2', photoIndex: 0 }] }), NOW);
    expect(r).toEqual({ ok: false, error: 'tick_photo' });
  });

  it('the photo needs a sentence: typed, from its mic, or a recording still to be written down', () => {
    const bare = { path: 'project_p1/site/b.jpg', takenAt: '2026-10-14T11:25:00Z' };
    expect(parsePost(update({ photos: [bare] }), NOW)).toEqual({ ok: false, error: 'tick_photo' });
    expect(parsePost(update({ photos: [{ ...bare, text: '   ' }] }), NOW)).toEqual({ ok: false, error: 'tick_photo' });
    expect(parsePost(update({ photos: [{ ...bare, voicePath: 'project_p1/voice/b.webm' }] }), NOW).ok).toBe(true);
    expect(parsePost(update({ photos: [{ ...bare, customerText: 'Carcass fixed.' }] }), NOW).ok).toBe(true);
  });

  it('a typed sentence is what the customer reads: trimmed, capped, and it wins over the mic’s', () => {
    const r = parsePost(update({ photos: [{ ...update().photos[0]!, text: '  Carcass   fixed in the master bedroom.  ' }] }), NOW);
    expect(r.ok && r.input.photos[0]).toMatchObject({ customerText: 'Carcass fixed in the master bedroom.', customerLang: null, transcript: expect.any(String) });
    const long = parsePost(update({ photos: [typedPhoto('x'.repeat(400))], ticks: [{ itemId: 'i1', photoIndex: 0 }] }), NOW);
    expect(long.ok && long.input.photos[0]!.customerText).toHaveLength(300);
  });

  it('a typed sentence is posted under the photo that ticked the step', async () => {
    as('u-owner');
    const r = await postSiteLog(update({ photos: [typedPhoto()], ticks: [{ itemId: 'i2', source: 'TICK', photoIndex: 0 }] }), NOW);
    expect(r).toMatchObject({ ok: true, post: { ticked: 1 } });
    expect(db.state.logs[0]!.photos).toEqual([expect.objectContaining({ customerText: 'Shutters delivered and stacked in the hall.', voicePath: null })]);
    expect(db.state.items.get('i2')).toMatchObject({ donePhotoId: `ph-${db.state.logs[0]!.id}-0` });
  });
});

describe('nobody on site', () => {
  it('needs a reason, and stores it', async () => {
    as('u-sup');
    expect(await postSiteLog({ projectId: 'p1', clientRef: 'ref-nobody01', kind: 'NOBODY', postedAt: '2026-10-14T04:00:00Z' }, NOW)).toEqual({ ok: false, error: 'no_reason' });
    const r = await postSiteLog({ projectId: 'p1', clientRef: 'ref-nobody02', kind: 'NOBODY', reason: 'WAITING_CUSTOMER_DECISION', postedAt: '2026-10-14T04:00:00Z' }, NOW);
    expect(r).toMatchObject({ ok: true, post: { kind: 'NOBODY' } });
    expect(db.state.logs[0]).toMatchObject({ kind: 'NOBODY', reason: 'WAITING_CUSTOMER_DECISION' });
    expect(db.state.events[0]).toMatchObject({ type: 'site.nobody', payload: expect.objectContaining({ reason: 'WAITING_CUSTOMER_DECISION' }) });
  });

  it('a nobody post carries no photos, crew or ticks, whatever the phone sends', () => {
    const r = parsePost({ ...update(), kind: 'NOBODY', reason: 'HOLIDAY' }, NOW);
    expect(r).toMatchObject({ ok: true, input: { kind: 'NOBODY', reason: 'HOLIDAY', photos: [], crew: [], ticks: [], voice: null } });
  });

  it('waiting on the customer’s decision and the customer asking do not count against the studio', () => {
    expect(NOBODY_REASONS.filter((r) => !countsAgainstStudio(r))).toEqual(['WAITING_CUSTOMER_DECISION', 'CUSTOMER_ASKED']);
  });
});

describe('who may post', () => {
  it('a supervisor cannot post to a site they are not on, nor to another studio’s', async () => {
    as('u-sup');
    expect(await postSiteLog(update({ projectId: 'p2', photos: [{ path: 'project_p2/site/a.jpg' }], ticks: [] }), NOW)).toEqual({ ok: false, error: 'not_yours' });
    expect(await postSiteLog(update({ projectId: 'p9', photos: [{ path: 'project_p9/site/a.jpg' }], ticks: [] }), NOW)).toEqual({ ok: false, error: 'not_yours' });
    expect(db.state.logs).toHaveLength(0);
  });

  it('accounts may not post; nobody signed out may', async () => {
    as('u-acc');
    expect(await postSiteLog(update(), NOW)).toEqual({ ok: false, error: 'not_your_role' });
    session.user = null;
    expect(await postSiteLog(update(), NOW)).toEqual({ ok: false, error: 'sign_in' });
  });

  it('the owner may post on any of the studio’s sites', async () => {
    as('u-owner');
    expect(await postSiteLog(update({ projectId: 'p2', photos: [{ path: 'project_p2/site/a.jpg' }], ticks: [] }), NOW)).toMatchObject({ ok: true });
  });
});

describe('parsePost', () => {
  it('refuses a post from the future or older than 30 days, and an empty one', () => {
    expect(parsePost(update({ postedAt: '2026-10-14T13:00:00Z' }), NOW)).toEqual({ ok: false, error: 'in_future' });
    expect(parsePost(update({ postedAt: '2026-09-01T00:00:00Z' }), NOW)).toEqual({ ok: false, error: 'too_old' });
    expect(parsePost(update({ photos: [], ticks: [] }), NOW)).toEqual({ ok: false, error: 'empty' });
    expect(parsePost(update({ clientRef: 'x' }), NOW)).toEqual({ ok: false, error: 'invalid' });
  });

  it('keeps the place only as a pair, and a photo time no later than the post', () => {
    const r = parsePost(update({ photos: [{ path: 'project_p1/site/a.jpg', takenAt: '2026-10-15T00:00:00Z', lat: 18.5 }], ticks: [] }), NOW);
    expect(r.ok && r.input.photos[0]).toMatchObject({ lat: null, lng: null, takenAt: new Date('2026-10-14T11:30:00Z') });
  });

  it('drops a duplicate crew face or tick', () => {
    const r = parsePost(update({ crew: [{ crewMemberId: 'c1' }, { crewMemberId: 'c1' }], ticks: [{ itemId: 'i1', photoIndex: 0 }, { itemId: 'i1', photoIndex: 0 }] }), NOW);

    expect(r.ok && [r.input.crew.length, r.input.ticks.length]).toEqual([1, 1]);
  });

  it('the day’s first post is the original; anything after is its correction', () => {
    expect(logKind('UPDATE', null)).toEqual({ kind: 'UPDATE', correctsId: null });
    expect(logKind('NOBODY', null)).toEqual({ kind: 'NOBODY', correctsId: null });
    expect(logKind('UPDATE', { id: 'log1' })).toEqual({ kind: 'CORRECTION', correctsId: 'log1' });
  });
});
