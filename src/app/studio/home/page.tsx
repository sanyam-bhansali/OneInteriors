import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/modules/auth/session';
import { currentMember } from '@/modules/studio/access';
import { appsFor, comingSoonApps, APPS, type AppKey, type StudioApp } from '@/modules/studio/apps';
import { waitingForFullSoftware } from '@/modules/studio/pilot';
import { quizPrompt } from '@/modules/studio/setup-quiz';
import { crmIsOpen } from '@/modules/studio/standing';
import { hasSubmittedForReview } from '@/modules/studio/submitted';
import { SETUP_PATH, SITE_HOME } from '@/modules/studio/surfaces';
import { myToday } from '@/modules/studio-sales/today';
import type { SectionId, TodaySection } from '@/modules/studio-sales/today-rules';
import { prisma } from '@/lib/prisma';
import { getLang } from '@/modules/i18n/server';
import { AppIcon } from '../ui/icons';
import { Mark, Oim, PoweredBy, Verified } from '../ui/brand';
import { ProfileMenu } from '../ui/ProfileMenu';
import { signOutAction } from '@/app/sign-in/actions';
import { myHomePrefs } from '@/modules/studio/profile';
import { DEFAULT_HOME_PREFS, homeTiles } from '@/modules/studio/home-prefs';
import { ThemeToggle } from '../ui/theme';
import { HomeSearch, LangSeg, Splash } from './HomeBits';
import { SalesCalls, YourList, type ListRow } from './HomeSections';
import { mySitesToday, type SiteCard } from '@/modules/project/site-log';
import { crewsOnMySites } from '@/modules/studio-crews/store';
import { closuresRemainingFor, lifecycleBoard } from '@/modules/studio/lifecycle-store';
import { remainingLine } from '@/modules/project/lifecycle-rules';
import { asLifeTab, LifecycleTabs } from '../design/LifecycleTabs';
import { siteWords } from '../site/words';
import './home.css';
import '../setup/setup.css';

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
export default async function StudioHomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [user, member] = await Promise.all([getCurrentUser(), currentMember()]);
  /* Without the full software site mode is closed, so a supervisor stays here and is told why. */
  if (member?.role === 'SUPERVISOR' && member.fullSoftware !== false) redirect(SITE_HOME);
  /* The pilot switch (studio/pilot.ts): a designer, project manager,
     supervisor or accounts member of a studio without the full software. */
  if (member && waitingForFullSoftware(member)) return <NotSwitchedOn name={user?.name ?? null} />;

  /* The person's own home (profile menu): their tile order, hidden tiles and
     the "Right now" strip. Only ever a subset of `appsFor`. */
  const allApps = member ? appsFor(member) : [...APPS];
  const prefs = member ? await myHomePrefs(member.id) : DEFAULT_HOME_PREFS;
  const apps = homeTiles(allApps, prefs);
  const role = member?.role ?? 'OWNER';
  /* The lower sections read through the same scoped module functions as the
     screens they summarise: a salesperson's own leads (myToday), the sites
     this member may see (mySitesToday reads through projectsVisibleTo),
     crews only for roles that may read work orders (crewsOnMySites returns
     nothing to a designer), a designer's own design steps. */
  const [studio, today, lang, sites, crews, board, closures, { tab: rawTab }] = await Promise.all([
    member
      ? prisma.studio.findUnique({ where: { id: member.studioId }, select: { tradeName: true, status: true, onboardingSteps: true, setupQuiz: true } }).catch(() => null)
      : Promise.resolve(null),
    member && ['OWNER', 'PM', 'SALES'].includes(member.role) ? myToday() : Promise.resolve(null),
    getLang(),
    member && ['OWNER', 'PM', 'DESIGNER'].includes(member.role) ? mySitesToday().catch(() => null) : Promise.resolve(null),
    member?.role === 'PM' ? crewsOnMySites().catch(() => []) : Promise.resolve([]),
    /* The project lifecycle (owner, 13 Oct 2026): a designer's home is My Design / My Execution / My Snags. */
    member?.role === 'DESIGNER' ? lifecycleBoard().catch(() => null) : Promise.resolve(null),
    /* The owner's (and a PM's) "N project closures remaining". */
    member && ['OWNER', 'PM'].includes(member.role) ? closuresRemainingFor().catch(() => null) : Promise.resolve(null),
    searchParams,
  ]);

  /* "Set up your studio" (owner, 14 Oct 2026): on the owner's first visit
     after the software opens, the quiz; skipped, a small card stays here. */
  const open = studio ? crmIsOpen({ status: studio.status, submittedForReview: hasSubmittedForReview(studio.onboardingSteps) }) : false;
  const prompt = member?.role === 'OWNER' && member.status === 'ACTIVE' && open ? quizPrompt(studio?.setupQuiz ?? null) : null;
  if (prompt === 'quiz') redirect(SETUP_PATH);
  /* Apps their studio does not have yet: greyed "Coming soon" tiles, owner only. */
  const soon = member ? comingSoonApps(member) : [];

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
  const strip = prefs.strip ? stripFor(sections, allApps) : [];
  const sees = new Set(allApps.map((a) => a.key));
  const leadsWord = member?.role === 'SALES' ? 'lead' : 'client';
  const cards = sites?.cards ?? [];
  const calls = sections.find((x) => x.id === 'calls');
  const list = listFrom(sections);
  const phoneName = firstName ? `Hi, ${firstName}` : 'Hi';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ground)', color: 'var(--ink)' }}>
      <Splash greeting={greeting} />
      <header className="top homehead hm-desk" style={{ background: 'transparent', border: 0, padding: '18px 32px' }}>
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
          <ProfileMenu name={user?.name ?? null} signOut={signOutAction} />
        </div>
      </header>

      <header className="hstack ph-head hm-phone">
        <div style={{ minWidth: 0 }}>
          <span className="hstack" style={{ gap: 8, marginBottom: 4 }}>
            <b style={{ fontSize: 14 }}>{name}</b>
            {studio?.status === 'ACTIVE' ? <Verified /> : null}
          </span>
          <h1 className="hi">{phoneName}</h1>
        </div>
        <div className="hstack" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <ThemeToggle />
          <Link href="/studio/today" className="iconbtn" aria-label="Your list for today">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9M10 20.5a2 2 0 0 0 4 0" />
            </svg>
            {strip.length > 0 ? <span className="pip" /> : null}
          </Link>
          <ProfileMenu name={user?.name ?? null} signOut={signOutAction} size={40} />
        </div>
      </header>

      <main className="homemain" style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div className="hm-phone" style={{ flexDirection: 'column', gap: 16 }}>
          <HomeSearch label={member?.role === 'SALES' ? 'Find a lead' : 'Search anything'} />
          <div className="ph-grid">
            {apps.map((a) => {
              const t = tileFor(a.key, n);
              return (
                <Link key={a.key} href={a.href} className="ph-app">
                  <span className="tico" style={{ background: a.bg, color: a.fg }}>
                    <AppIcon name={a.icon} />
                  </span>
                  {a.name}
                  {t.badge > 0 ? <span className="badge">{t.badge}</span> : null}
                </Link>
              );
            })}
            {soon.map((a) => (
              <div key={a.key} className="ph-app soon" aria-disabled="true">
                <span className="tico">
                  <AppIcon name={a.icon} />
                </span>
                {a.name}
                <span className="muted sm">Soon</span>
              </div>
            ))}
          </div>
          {prompt === 'card' ? <SetupCard /> : null}
          {strip.length > 0 ? (
            <section className="card ph-card" aria-label="Right now">
              <b>Right now</b>
              {strip.map((x) => (
                <Link key={x.href + x.t} href={x.href} className="trow">
                  <span>{x.t}</span>
                  <span className="dot" style={{ color: x.c }} />
                </Link>
              ))}
            </section>
          ) : null}
          {member?.role === 'OWNER' && cards.length > 0 ? <SitesToday cards={cards} /> : null}
        </div>

        <div className="hm-desk" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center', paddingTop: 12 }}>
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

        <section aria-labelledby="h-apps" className="hm-desk" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <div className={`lgrid${apps.length <= 3 ? ' few' : ''}`}>
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
            {soon.map((a) => (
              <div key={a.key} className="tile soon" aria-disabled="true" data-testid="soon-tile">
                <span className="tico">
                  <AppIcon name={a.icon} />
                </span>
                <b>{a.name}</b>
                <span className="tsub">Coming soon</span>
              </div>
            ))}
          </div>
        </section>

        {prompt === 'card' ? <SetupCard /> : null}

        {closures && closures.count > 0 ? (
          <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--warn-bg)', color: 'var(--warn)' }} aria-label="Project closures remaining" data-testid="closures-remaining">
            <b style={{ fontSize: 15 }}>{remainingLine(closures.count).replace('You have', role === 'OWNER' ? 'The studio has' : 'You have')}</b>
            <span className="sm">Past provisional handover and not closed out: the final payment is not fixed yet.</span>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {closures.projects.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/studio/projects/${c.id}?tab=closure`} style={{ color: 'var(--ink)', fontWeight: 600 }}>
                    {c.client} · {c.flat}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {role === 'SALES' && calls ? <SalesCalls calls={calls.rows} more={calls.more} /> : null}

        {role === 'PM' ? (
          <>
            <EverySite cards={cards} />
            <div className="dgrid">
              <YourList rows={list.rows} more={list.more} moreHref="/studio/today" />
              <Trades crews={crews} />
            </div>
          </>
        ) : null}

        {role === 'DESIGNER' && board ? <LifecycleTabs board={board} tab={asLifeTab(rawTab)} base="/studio/home" mine /> : null}
        {role === 'DESIGNER' ? <ProjectsToday cards={cards} /> : null}

        <PoweredBy style={{ paddingTop: 24 }} />
      </main>
    </div>
  );
}

/** The quiz skipped: a small way back to it on the owner's home. */
function SetupCard() {
  return (
    <section className="card sq-setcard" aria-label="Set up your studio" data-testid="setup-card">
      <span>
        <b>Set up your studio</b>
        <span className="muted sm" style={{ display: 'block' }}>
          Twelve quick questions set your lead sources, pipeline, payment stages and quotation defaults.
        </span>
      </span>
      <Link href={SETUP_PATH} className="btn pri sm">
        Start
      </Link>
    </section>
  );
}

/**
 * A designer, project manager, supervisor or accounts member of a studio
 * whose full software is not switched on (owner, 14 Oct 2026): nothing of the
 * studio, just the plain reason and a way out.
 */
function NotSwitchedOn({ name }: { name: string | null }) {
  const first = (name ?? '').trim().split(/\s+/)[0] || null;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ground)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <section className="card" style={{ maxWidth: 520, width: '100%', padding: 24 }} data-testid="not-switched-on">
        <span className="eyebrow">{first ? `Hi, ${first}` : 'Hello'}</span>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: '-.03em' }}>Your studio’s full software isn’t switched on yet.</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Projects, design, site updates, payments and crews open when One Interiors switches on the full studio software for your studio. Until then there is nothing here for your role. Your studio owner will tell you when it is on.
        </p>
        <div className="hstack">
          <ThemeToggle />
          <form action={signOutAction}>
            <button type="submit" className="btn sec sm">
              Sign out
            </button>
          </form>
        </div>
      </section>
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

/* ── The lower sections (server parts) ─────────────────────── */

const SITE_T = siteWords('en');
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** Today on site, as the design's chip: posted, nobody (why), not posted yet, or no site work today. */
function siteChip(c: SiteCard): { text: string; cls: string } {
  if (c.today?.kind === 'NOBODY') return { text: `Nobody: ${c.today.reason ? SITE_T(`reason.${c.today.reason}`).toLowerCase() : 'on site'}`, cls: '' };
  if (c.today) return { text: `Posted ${clock(c.today.postedAt)}`, cls: 'good' };
  if (!c.expected) return { text: 'No site work today', cls: 'none' };
  return { text: 'Not posted yet', cls: 'warn' };
}

function Chip({ c }: { c: SiteCard }) {
  const chip = siteChip(c);
  if (chip.cls === 'none') return <span className="muted sm">{chip.text}</span>;
  return (
    <span className={`chip ${chip.cls}`}>
      <span className="dot" />
      {chip.text}
    </span>
  );
}

/** PM: every site they may see, today (StudioPMHome). */
function EverySite({ cards }: { cards: SiteCard[] }) {
  return (
    <section className="card flush" aria-labelledby="h-sites">
      <div className="chead">
        <h2 id="h-sites">Every site, today</h2>
        <span className="muted sm">Updates come from site mode. Tap a row to open the project.</span>
      </div>
      {cards.length === 0 ? (
        <p className="muted" style={{ margin: 0, padding: '0 18px 18px' }}>
          No projects yet.
        </p>
      ) : (
        <div className="tscroll">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">Stage</th>
                <th scope="col">Today on site</th>
                <th scope="col">Snags</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/studio/projects/${c.id}`} style={{ fontWeight: 600 }}>
                      {c.home}
                    </Link>
                    <div className="muted sm">{c.customerFirst}</div>
                  </td>
                  <td>
                    {c.stage ?? 'Not started'}{' '}
                    <span className="muted sm mono">
                      {Math.min(c.day, c.of)}/{c.of}
                    </span>
                  </td>
                  <td>
                    <Chip c={c} />
                  </td>
                  <td>{c.openSnags === 0 ? <span className="muted">None</span> : `${c.openSnags} open`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** PM: which crew is on which job (names and trades only, never money). */
function Trades({ crews }: { crews: Awaited<ReturnType<typeof crewsOnMySites>> }) {
  const rows = crews.flatMap((p) => p.crews.map((c, i) => ({ key: `${p.projectId}-${i}`, name: c.name, trades: c.trades, site: p.projectName, status: c.status })));
  return (
    <section className="card" aria-labelledby="h-trades">
      <div className="chead">
        <h2 id="h-trades">Trades on your sites</h2>
        <Link href="/studio/vendors" className="sm acc-t" style={{ fontWeight: 600 }}>
          Vendors
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="muted sm" style={{ margin: 0 }}>
          No work orders running.
        </p>
      ) : null}
      {rows.slice(0, 8).map((r) => (
        <div key={r.key} className="trow">
          <span>
            <b style={{ fontWeight: 600 }}>{r.name}</b>{' '}
            <span className="muted sm">
              · {r.trades ? `${r.trades}, ` : ''}
              {r.site}
            </span>
          </span>
          <span className={`chip ${r.status === 'IN_PROGRESS' ? 'good' : ''}`}>{r.status === 'IN_PROGRESS' ? 'On site' : 'Issued'}</span>
        </div>
      ))}
    </section>
  );
}

/** Designer: their projects, with today on site (StudioDesHome). */
function ProjectsToday({ cards }: { cards: SiteCard[] }) {
  return (
    <section className="card" aria-labelledby="h-proj">
      <div className="chead">
        <h2 id="h-proj">Your projects today</h2>
        <Link href="/studio/design" className="sm acc-t" style={{ fontWeight: 600 }}>
          All projects
        </Link>
      </div>
      {cards.length === 0 ? (
        <p className="muted sm" style={{ margin: 0 }}>
          No projects are yours yet.
        </p>
      ) : null}
      {cards.map((c) => (
        <Link key={c.id} href={`/studio/projects/${c.id}`} className="pcardh">
          <span className="top2">
            <b style={{ fontWeight: 600 }}>
              {c.home} · {c.customerFirst}
            </b>
            <Chip c={c} />
          </span>
          <span className="muted sm">
            {c.stage ? `${c.stage}, day ${Math.min(c.day, c.of)} of ${c.of}` : `Day ${Math.min(c.day, c.of)} of ${c.of}`}
            {c.openSnags ? ` · ${c.openSnags} snag${c.openSnags === 1 ? '' : 's'} open` : ''}
          </span>
        </Link>
      ))}
    </section>
  );
}

/** Owner on the phone: sites today (StudioOwnerPhone). */
function SitesToday({ cards }: { cards: SiteCard[] }) {
  return (
    <section className="card ph-card" aria-label="Sites today">
      <b>Sites today</b>
      {cards.slice(0, 6).map((c) => (
        <Link key={c.id} href={`/studio/projects/${c.id}`} className="trow">
          <span>{c.home}</span>
          <Chip c={c} />
        </Link>
      ))}
    </section>
  );
}

/** "Your list" for a PM: tasks first (ticking marks them done), then the lines due today. */
function listFrom(sections: readonly TodaySection[]): { rows: ListRow[]; more: number } {
  const order: SectionId[] = ['tasks', 'meetings', 'calls', 'quotes', 'floor-plans', 'bookings'];
  const all: ListRow[] = [];
  let total = 0;
  for (const id of order) {
    const s = sections.find((x) => x.id === id);
    if (!s) continue;
    total += s.rows.length + s.more;
    for (const r of s.rows) {
      const opens = r.action.kind === 'task' || r.action.kind === 'assign' || r.action.kind === 'claim';
      all.push({
        key: r.key,
        title: r.title,
        ctx: r.detail,
        href: opens ? (r.leadId ? `/studio/clients/${r.leadId}` : r.action.href) : r.action.href,
        action: opens ? 'Open' : r.action.label,
        taskId: r.action.kind === 'task' ? r.action.taskId : undefined,
        leadId: r.leadId,
      });
    }
  }
  const rows = all.slice(0, 5);
  return { rows, more: Math.max(0, total - rows.length) };
}


