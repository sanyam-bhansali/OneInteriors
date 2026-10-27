import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICE_MEMBER, homeFor, mayOpen } from '@/modules/studio/surfaces';
import { route } from '@/lib/host';
import { NOT_CONFIGURED, type SmsProvider } from '@/modules/messaging/sms';
import { plainText } from '@/modules/messaging/messages';

/**
 * The role gate on /studio (studio/surfaces.ts): which screens each role
 * may open, where each lands, and the module-layer lock — the office
 * modules find no studio for a site supervisor or an accounts member. Plus
 * the studio sign-in's address and MessageSender's fallback order.
 */

type Role = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS' | 'SALES';
type Status = 'INVITED' | 'ACTIVE' | 'SUSPENDED';
const m = (role: Role, status: Status = 'ACTIVE') => ({ role, status });

describe('mayOpen and homeFor', () => {
  const office = ['/studio', '/studio/clients', '/studio/quotations/q1', '/studio/products', '/studio/settings', '/studio/settings/pipeline', '/studio/projects', '/studio/updates', '/studio/calendar/appointments'];

  it('a site supervisor opens site mode and their calendar (office meetings, 27 Oct 2026), nothing else', () => {
    expect(mayOpen(m('SUPERVISOR'), '/studio/site')).toBe(true);
    expect(mayOpen(m('SUPERVISOR'), '/studio/calendar/meetings')).toBe(true);
    for (const p of [...office, '/studio/payments', '/studio/settings/team', '/studio/vendors', '/studio/sitex']) {
      expect(mayOpen(m('SUPERVISOR'), p), p).toBe(false);
    }
    expect(homeFor('SUPERVISOR')).toBe('/studio/site');
  });

  it('accounts opens the payments desk, the crews (Phase 3) and their calendar, and nothing else', () => {
    expect(mayOpen(m('ACCOUNTS'), '/studio/payments')).toBe(true);
    expect(mayOpen(m('ACCOUNTS'), '/studio/calendar')).toBe(true);
    expect(mayOpen(m('ACCOUNTS'), '/studio/vendors')).toBe(true);
    expect(mayOpen(m('ACCOUNTS'), '/studio/vendors/pay')).toBe(true);
    expect(mayOpen(m('ACCOUNTS'), '/studio/vendors/orders/wo1/statement')).toBe(true);
    for (const p of [...office, '/studio/site', '/studio/settings/team', '/studio/vendors/labour', '/studio/settings/trades']) {
      expect(mayOpen(m('ACCOUNTS'), p), p).toBe(false);
    }
    expect(homeFor('ACCOUNTS')).toBe('/studio/home');
  });

  it('a project manager keeps the office, except the team and vendor rates', () => {
    for (const p of office) expect(mayOpen(m('PM'), p), p).toBe(true);
    expect(mayOpen(m('PM'), '/studio/settings/team')).toBe(false);
    expect(mayOpen(m('PM'), '/studio/vendors')).toBe(false);
    expect(homeFor('PM')).toBe('/studio/home');
    expect(homeFor('OWNER')).toBe('/studio/home');
  });

  it('a salesperson opens Today, the leads board and a lead, and quotations — nothing else', () => {
    for (const p of ['/studio/today', '/studio/clients', '/studio/clients/c1', '/studio/quotations', '/studio/quotations/q1', '/studio/quotations/q1/compare']) {
      expect(mayOpen(m('SALES'), p), p).toBe(true);
    }
    for (const p of ['/studio', '/studio/clients/import', '/studio/clients/bin', '/studio/clients/analytics', '/studio/products', '/studio/settings', '/studio/projects', '/studio/payments', '/studio/site', '/studio/vendors', '/studio/todayx']) {
      expect(mayOpen(m('SALES'), p), p).toBe(false);
    }
    expect(homeFor('SALES')).toBe('/studio/home');
  });

  it('the payment stages are the owner’s alone', () => {
    expect(mayOpen(m('OWNER'), '/studio/settings/payments')).toBe(true);
    expect(mayOpen(m('PM'), '/studio/settings/payments')).toBe(false);
  });

  it('the owner opens everything', () => {
    for (const p of [...office, '/studio/settings/team', '/studio/vendors', '/studio/site', '/studio/payments']) {
      expect(mayOpen(m('OWNER'), p), p).toBe(true);
    }
  });

  it('anyone not ACTIVE opens nothing', () => {
    for (const s of ['INVITED', 'SUSPENDED'] as const) {
      expect(mayOpen(m('OWNER', s), '/studio')).toBe(false);
      expect(mayOpen(m('SUPERVISOR', s), '/studio/site')).toBe(false);
    }
  });
});

// ── The module-layer lock ──────────────────────────────────────

const db = vi.hoisted(() => {
  const members: Record<string, { studioId: string; role: string; status: string }> = {};
  const calls: string[] = [];
  const client = {
    studioMember: {
      /* Applies the filters the way Postgres would, so a missing
         OFFICE_MEMBER in `myStudioId()` would let a supervisor through. */
      findUnique: vi.fn(async (a: { where: { userId: string; status?: string; role?: { in: string[] } } }) => {
        const row = members[a.where.userId];
        if (!row) return null;
        if (a.where.status && row.status !== a.where.status) return null;
        if (a.where.role && !a.where.role.in.includes(row.role)) return null;
        return { id: `m-${a.where.userId}`, userId: a.where.userId, ...row };
      }),
    },
    studioProduct: {
      count: vi.fn(async () => {
        calls.push('studioProduct.count');
        return 1;
      }),
      findMany: vi.fn(async () => {
        calls.push('studioProduct.findMany');
        return [];
      }),
      createMany: vi.fn(),
    },
    studioClient: {
      findMany: vi.fn(async () => {
        calls.push('studioClient.findMany');
        return [];
      }),
    },
  };
  return { client, members, calls };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));
const session = vi.hoisted(() => ({ userId: 'u-sup' }));
vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: session.userId, role: 'STUDIO', email: null, phone: null, name: null })),
  hasRole: () => true,
}));

import { myStudioId } from '@/modules/studio/tenancy';
import { myProducts } from '@/modules/studio-quote/store';

describe('the office modules find no studio for site and accounts roles', () => {
  beforeEach(() => {
    db.calls.length = 0;
    Object.assign(db.members, {
      'u-owner': { studioId: 's1', role: 'OWNER', status: 'ACTIVE' },
      'u-pm': { studioId: 's1', role: 'PM', status: 'ACTIVE' },
      'u-sup': { studioId: 's1', role: 'SUPERVISOR', status: 'ACTIVE' },
      'u-acc': { studioId: 's1', role: 'ACCOUNTS', status: 'ACTIVE' },
      'u-gone': { studioId: 's1', role: 'OWNER', status: 'SUSPENDED' },
      'u-new': { studioId: 's1', role: 'PM', status: 'INVITED' },
      'u-sales': { studioId: 's1', role: 'SALES', status: 'ACTIVE' },
    });
    vi.stubEnv('DATABASE_URL', 'postgres://test');
    vi.stubEnv('SAMPLE_DATA_ONLY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('OFFICE_MEMBER is ACTIVE owners and project managers', () => {
    expect(OFFICE_MEMBER).toEqual({ status: 'ACTIVE', role: { in: ['OWNER', 'PM'] } });
  });

  for (const [user, studio] of [
    ['u-owner', 's1'],
    ['u-pm', 's1'],
    ['u-sup', null],
    ['u-acc', null],
    ['u-gone', null],
    ['u-new', null],
    // A salesperson is not office: every older office module finds no studio.
    ['u-sales', null],
  ] as const) {
    it(`myStudioId for ${user} is ${studio}`, async () => {
      session.userId = user;
      expect(await myStudioId()).toBe(studio);
    });
  }

  it('a supervisor cannot load the product master: no query reaches the studio’s rows', async () => {
    session.userId = 'u-sup';
    expect(await myProducts()).toEqual([]);
    expect(db.calls).toEqual([]);
  });

  it('accounts cannot either', async () => {
    session.userId = 'u-acc';
    expect(await myProducts()).toEqual([]);
    expect(db.calls).toEqual([]);
  });

  it('a salesperson reads the products quoting needs (and nothing else opens for them)', async () => {
    session.userId = 'u-sales';
    await myProducts();
    expect(db.calls).toContain('studioProduct.findMany');
  });

  it('a project manager still can', async () => {
    session.userId = 'u-pm';
    await myProducts();
    expect(db.calls).toContain('studioProduct.findMany');
  });
});

describe('the studio sign-in address', () => {
  const env = { STUDIO_HOST: 'studio.oneinteriors.in', OPS_HOST: 'ops.oneinteriors.in', PUBLIC_HOST: 'oneinteriors.in' };

  it('is served by the page outside the studio layout, on the studio host and locally', () => {
    expect(route('studio.oneinteriors.in', '/studio/sign-in', env)).toEqual({ kind: 'rewrite', to: '/studio-sign-in' });
    expect(route('localhost:3000', '/studio/sign-in', {})).toEqual({ kind: 'rewrite', to: '/studio-sign-in' });
  });

  it('the internal page is not reachable by its own address on the studio or public host', () => {
    expect(route('studio.oneinteriors.in', '/studio-sign-in', env)).toEqual({ kind: 'notFound' });
    expect(route('oneinteriors.in', '/studio-sign-in', env)).toEqual({ kind: 'notFound' });
    expect(route('oneinteriors.in', '/studio/sign-in', env)).toEqual({ kind: 'notFound' });
  });
});

// ── MessageSender ──────────────────────────────────────────────

const wa = vi.hoisted(() => ({
  configured: true,
  sendOtp: vi.fn(async () => ({ delivered: true })),
  sendTemplate: vi.fn(async () => ({ delivered: true })),
}));
vi.mock('@/modules/auth/whatsapp', () => ({
  hasWhatsApp: () => wa.configured,
  sendOtp: wa.sendOtp,
  sendTemplate: wa.sendTemplate,
}));

import { send } from '@/modules/messaging/sender';

describe('MessageSender: WhatsApp template, then SMS, then the console in development only', () => {
  const sms = (delivered: boolean): SmsProvider & { send: ReturnType<typeof vi.fn> } => ({
    name: 'fake',
    configured: () => true,
    send: vi.fn(async () => ({ delivered })),
  });
  const invite = { kind: 'invite' as const, name: 'Imran', studioName: 'Teakline', link: 'https://studio.example/studio/sign-in' };

  beforeEach(() => {
    wa.configured = true;
    wa.sendOtp.mockClear();
    wa.sendTemplate.mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses the studio WhatsApp template when it is named', async () => {
    vi.stubEnv('WHATSAPP_STUDIO_CODE_TEMPLATE', 'studio_code');
    expect(await send('+919822055310', { kind: 'code', code: '481726' }, sms(true))).toEqual({ delivered: true, via: 'whatsapp' });
    expect(wa.sendOtp).toHaveBeenCalledWith('+919822055310', '481726', { template: 'studio_code' });
  });

  it('skips WhatsApp when no studio template is named, and falls to SMS', async () => {
    vi.stubEnv('WHATSAPP_STUDIO_INVITE_TEMPLATE', '');
    const provider = sms(true);
    expect(await send('+919822055310', invite, provider)).toEqual({ delivered: true, via: 'sms' });
    expect(wa.sendTemplate).not.toHaveBeenCalled();
    expect(provider.send).toHaveBeenCalledWith('+919822055310', plainText(invite));
  });

  it('falls to SMS when WhatsApp fails', async () => {
    vi.stubEnv('WHATSAPP_STUDIO_INVITE_TEMPLATE', 'studio_invite');
    wa.sendTemplate.mockResolvedValueOnce({ delivered: false });
    expect((await send('+919822055310', invite, sms(true))).via).toBe('sms');
    expect(wa.sendTemplate).toHaveBeenCalledWith('+919822055310', 'studio_invite', ['Imran', 'Teakline', 'https://studio.example/studio/sign-in']);
  });

  it('with nothing configured: the console in development, nothing at all in production', async () => {
    wa.configured = false;
    vi.stubEnv('NODE_ENV', 'development');
    expect(await send('+919822055310', { kind: 'code', code: '481726' }, NOT_CONFIGURED)).toMatchObject({ delivered: false, via: 'console' });
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'log');
    log.mockClear();
    expect(await send('+919822055310', { kind: 'code', code: '481726' }, NOT_CONFIGURED)).toMatchObject({ delivered: false, via: 'none' });
    expect(log).not.toHaveBeenCalled();
  });

  it('no SMS provider is wired yet', () => {
    expect(NOT_CONFIGURED.configured()).toBe(false);
  });
});
