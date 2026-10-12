import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/modules/auth/session';
import { currentMember } from '@/modules/studio/access';
import { appsFor, APPS, type AppKey, type StudioApp } from '@/modules/studio/apps';
import { SITE_HOME } from '@/modules/studio/surfaces';
import { myToday } from '@/modules/studio-sales/today';
import type { SectionId, TodaySection } from '@/modules/studio-sales/today-rules';
import { prisma } from '@/lib/prisma';
import { getLang } from '@/modules/i18n/server';
import { AppIcon } from '../ui/icons';
import { Mark, Oim, PoweredBy, Verified, initials } from '../ui/brand';
import { ThemeToggle } from '../ui/theme';
import { HomeSearch, LangSeg, Splash } from './HomeBits';

export const metadata: Metadata = { title: 'Studio home', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Every role's home (StudioLauncher, StudioSalesHome, StudioDesHome,
 * StudioPMHome in the owner's UI handoff): the studio's pill, a greeting,
 * search, a strip of what is due now, and this person's app tiles with live
 * counts. One page for every role: which tiles show is `appsFor`, which
 * already asked the door (`mayOpen`); the counts come from `myToday`, which
 * is scoped to what this person may see (a salesperson's own leads only).
 */
export default async function StudioHomePage() {
  const [user, member] = await Promise.all([getCurrentUser(), currentMember()]);
  if (member?.role === 'SUPERVISOR') redirect(SITE_HOME);

  const apps = member ? appsFor(member) : [...APPS];
  const [studio, today, lang] = await Promise.all([
    member
      ? prisma.studio.findUnique({ where: { id: member.studioId }, select: { tradeName: true, status: true } }).catch(() => null)
      : Promise.resolve(null),
    member && ['OWNER', 'PM', 'SALES'].includes(member.role) ? myToday() : Promise.resolve(null),
    getLang(),
  ]);

  const name = studio?.tradeName ?? 'Your studio';
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || null;
  const now = new Date();
  const hour = Number(now.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greeting = firstName ? `${hello}, ${firstName}` : hello;
  const dateLine = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const roleLine = member ? ROLE_LINE[member.role] : 'Owner and admin';

  const sections = today?.sections ?? [];
  const n = (id: SectionId) => sectionCount(sections, id);
  const strip = stripFor(sections, apps);
  const sees = new Set(apps.map((a) => a.key));
  const leadsWord = member?.role === 'SALES' ? 'lead' : 'client';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ground)', color: 'var(--ink)' }}>
      <Splash greeting={greeting} />
      <header className="top homehead" style={{ background: 'transparent', border: 0, padding: '18px 32px' }}>
        <div className="hstack brandwrap" style={{ gap: 12 }}>
          <Mark name={name} />
          <span className="bn">
            <span className="hstack" style={{ gap: 8 }}>
              <b>{name}</b>
              {studio?.status === 'ACTIVE' ? <Verified /> : null}
            </span>
          </span>
          <span className="pwby">
            <span>Powered by</span>
            <Oim width={61} />
          </span>
        </div>
        <div className="topr">
          <LangSeg value={lang} />
          <ThemeToggle />
          <Link href="/studio/today" className="iconbtn" aria-label="Your list for today">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9M10 20.5a2 2 0 0 0 4 0" />
            </svg>
            {strip.length > 0 ? <span className="pip" /> : null}
          </Link>
          <span className="av" style={{ width: 42, height: 42 }} title={user?.name ?? undefined}>
            {initials(user?.name)}
          </span>
        </div>
      </header>

      <main className="homemain" style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center', paddingTop: 12 }}>
          <span className="muted">
            {dateLine} · {roleLine}
          </span>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 500, letterSpacing: '-.045em' }}>{greeting}</h1>
          <HomeSearch label={member?.role === 'SALES' ? 'Find a lead by name or phone' : 'Search or jump to any client, quote, project or app'} />
          {strip.length > 0 ? (
            <div className="strip" aria-label="Right now">
              {strip.map((s) => (
                <Link key={s.href + s.t} href={s.href}>
                  <span className="dot" style={{ color: s.c }} />
                  {s.t}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <section aria-labelledby="h-apps" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="hstack" style={{ justifyContent: 'space-between' }}>
            <h2 id="h-apps" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              {member && member.role !== 'OWNER' ? 'Your apps' : 'Your studio'}
            </h2>
            {sees.has('clients') ? (
              <Link href="/studio/clients?add=1" className="btn pri sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add a {leadsWord}
              </Link>
            ) : null}
          </div>
          <div className="lgrid">
            {apps.map((a) => {
              const t = tileFor(a.key, n);
              return (
                <Link key={a.key} href={a.href} className="tile">
                  <span className="tico" style={{ background: a.bg, color: a.fg }}>
                    <AppIcon name={a.icon} />
                  </span>
                  <b>{a.name}</b>
                  <span className={`tsub ${t.tone}`}>{t.sub}</span>
                  {t.badge > 0 ? <span className="badge">{t.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        </section>

        <PoweredBy style={{ paddingTop: 24 }} />
      </main>
    </div>
  );
}

const ROLE_LINE: Record<string, string> = {
  OWNER: 'Owner and admin',
  PM: 'Project manager',
  SALES: 'Sales',
  DESIGNER: 'Designer',
  ACCOUNTS: 'Accounts',
  SUPERVISOR: 'Site supervisor',
};

function sectionCount(sections: readonly TodaySection[], id: SectionId): number {
  const s = sections.find((x) => x.id === id);
  return s ? s.rows.length + s.more : 0;
}

/** A tile's line under its name, in the design's words, with a count where we have one. */
function tileFor(key: AppKey, n: (id: SectionId) => number): { sub: string; tone: '' | 'warn' | 'hot'; badge: number } {
  const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
  switch (key) {
    case 'today': {
      const total = n('calls') + n('tasks') + n('meetings') + n('quotes') + n('floor-plans') + n('bookings');
      return total > 0 ? { sub: `${plural(total, 'thing')} to do`, tone: 'warn', badge: 0 } : { sub: 'Nothing waiting', tone: '', badge: 0 };
    }
    case 'clients': {
      const calls = n('calls');
      const pool = n('pool');
      if (calls > 0) return { sub: `${calls} to call today${pool > 0 ? ` · ${pool} new` : ''}`, tone: 'warn', badge: calls };
      if (pool > 0) return { sub: `${pool} in the pool`, tone: 'hot', badge: 0 };
      return { sub: 'No calls due today', tone: '', badge: 0 };
    }
    case 'quotes': {
      const q = n('quotes');
      return q > 0 ? { sub: `${q} waiting on you`, tone: 'warn', badge: q } : { sub: 'Build and send quotations', tone: '', badge: 0 };
    }
    case 'calendar': {
      const m = n('meetings');
      return m > 0 ? { sub: `${plural(m, 'meeting')} today`, tone: '', badge: 0 } : { sub: 'Nothing booked today', tone: '', badge: 0 };
    }
    case 'projects':
      return { sub: 'Plans, site log, snags, design', tone: '', badge: 0 };
    case 'site':
      return { sub: "Today's updates from site", tone: '', badge: 0 };
    case 'money':
      return { sub: 'Payments to record', tone: '', badge: 0 };
    case 'vendors':
      return { sub: 'Crews, work orders and pay', tone: '', badge: 0 };
    case 'intros':
      return { sub: 'Introductions and your listing', tone: 'hot', badge: 0 };
    case 'rates':
      return { sub: 'Your price list', tone: '', badge: 0 };
    case 'team':
      return { sub: 'People, roles and settings', tone: '', badge: 0 };
  }
}

/** "Right now": the first few things due, each opening where it is done. */
function stripFor(sections: readonly TodaySection[], apps: readonly StudioApp[]): { t: string; href: string; c: string }[] {
  const has = new Set(apps.map((a) => a.key));
  const out: { t: string; href: string; c: string }[] = [];
  if (has.has('today') && sections.some((s) => s.rows.length > 0)) out.push({ t: 'See your full list for today', href: '/studio/today', c: 'var(--ink)' });
  const words: Partial<Record<SectionId, [string, string, string]>> = {
    calls: ['call left today', 'calls left today', 'var(--acc)'],
    meetings: ['meeting today', 'meetings today', 'var(--ink)'],
    quotes: ['quote to chase', 'quotes to chase', 'var(--warn-s)'],
    'floor-plans': ['floor plan to ask for', 'floor plans to ask for', 'var(--warn-s)'],
    tasks: ['task due', 'tasks due', 'var(--acc)'],
    pool: ['new lead in the pool', 'new leads in the pool', 'var(--acc)'],
  };
  for (const s of sections) {
    const w = words[s.id];
    const k = s.rows.length + s.more;
    if (!w || k === 0) continue;
    out.push({ t: `${k} ${k === 1 ? w[0] : w[1]}`, href: s.seeAll ?? '/studio/today', c: w[2] });
    if (out.length >= 4) break;
  }
  return out;
}
