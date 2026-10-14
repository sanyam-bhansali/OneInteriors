import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { signOutAction } from '@/app/sign-in/actions';
import { isLive } from '@/modules/studio/features';
import { crmIsOpen } from '@/modules/studio/standing';
import { StudioShell, type NavGroup } from './StudioShell';
import { hasSubmittedForReview } from '@/modules/studio/submitted';
import { headers } from 'next/headers';
import { PATH_HEADER, STUDIO_SIGN_IN } from '@/lib/host';
import { memberFor } from '@/modules/studio/access';
import { can, type MemberRole } from '@/modules/studio/roles';
import { TEAM_PATH, TODAY_HOME, usesOfficeShell } from '@/modules/studio/surfaces';
import { doorFor, type PilotArea } from '@/modules/studio/pilot';
import { ComingSoon } from './ComingSoon';
import { RoleFrame } from './RoleFrame';
import { APPS, appsFor } from '@/modules/studio/apps';
import { StudioFrame } from './ui/StudioFrame';
import { THEME_SCRIPT } from './ui/theme-script';
import './studio-ui.css';
import './studio-extra.css';
import { getLang } from '@/modules/i18n/server';
import { tx } from '@/modules/i18n/site';
import { STUDIO_WORDS } from '@/modules/i18n/studio';

/**
 * The studio surface's auth gate, and its frame.
 *
 * Like `/ops`, this reads the session from Postgres in a server component
 * rather than trusting middleware — the edge runtime cannot query the database,
 * so `src/middleware.ts` is only a cookie pre-filter and is explicitly not the
 * authorisation model.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  /* Signed out: the studio sign-in, by phone — which links to the email
     sign-in for owners who use that. */
  if (!user) redirect(STUDIO_SIGN_IN);

  /**
   * Signed in, but not as a studio.
   *
   * This used to `redirect('/')`, silently. The likeliest person to hit it is a
   * studio owner who signed in with the phone form — which creates a CUSTOMER
   * account, because studio accounts have an email and no phone — and what they
   * experienced was being logged in and then dumped on the landing page with no
   * explanation.
   */
  if (!hasRole(user, 'STUDIO')) {
    return (
      <main className="flex min-h-dvh flex-col justify-center py-12">
        <Container size="narrow">
          <div className="mx-auto max-w-lg">
            <h1 className="h1 mb-4">This account is not a studio account.</h1>
            <p className="m-0 mb-4 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
              You are signed in{user.email ? ` as ${user.email}` : ''}, but this sign-in is not
              linked to a studio.
            </p>
            <p className="m-0 mb-8 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
              If you are a studio owner, this usually means you signed in on the customer page.
              Sign out and use the email address we approved you on. If you work for a studio, sign
              in at {STUDIO_SIGN_IN} with the number your studio owner added.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-full bg-[var(--color-petrol)] px-6 py-3 text-[15px] font-medium text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)]"
                >
                  Sign out and try email
                </button>
              </form>
              <Link href="/" className="text-[14.5px] text-[var(--color-ink-2)]">
                Back to the site
              </Link>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  /**
   * Which part of the studio this person works in (studio/surfaces.ts).
   *
   * A supervisor or an accounts member who opens an office screen is sent to
   * their own; the office rail is never drawn for them. This is the door. The
   * lock is the module layer — the office modules find no studio for them
   * (`OFFICE_MEMBER` in `myStudioId()`) — because a layout does not re-run on
   * every in-app navigation.
   *
   * No membership (an ops account, a studio account not yet linked, or
   * fixtures mode with no database) keeps today's behaviour below.
   */
  /* A failed lookup is NOT "no membership". Treating it as one drew every
     app for a salesperson whenever the database read failed (seen with a
     stale client after a schema change), so it fails closed: a short
     "try again" screen, never a menu the person is not meant to have. */
  let member: Awaited<ReturnType<typeof memberFor>> = null;
  if (hasDatabase()) {
    try {
      member = await memberFor(user.id);
    } catch (error) {
      console.error('[studio] membership lookup failed', error instanceof Error ? error.name : 'unknown');
      return (
        <Themed>
          <main className="content" style={{ maxWidth: 560, margin: '10vh auto' }}>
            <div className="card">
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>We could not open your studio just now.</h1>
              <p className="muted" style={{ margin: 0 }}>Nothing is lost. Refresh the page in a minute; if it keeps happening, tell us.</p>
            </div>
          </main>
        </Themed>
      );
    }
  }
  /* A screen closed only by the studio's pilot switch (studio/pilot.ts): an
     owner or a salesperson who types its address sees its "coming soon" in
     the frame instead of the screen; the gated sections' own layouts
     (PilotGate) say the same on every navigation into them. */
  let soon: PilotArea | null = null;
  if (member) {
    if (member.status !== 'ACTIVE') return <Themed><NotActive suspended={member.status === 'SUSPENDED'} /></Themed>;
    const path = (await headers()).get(PATH_HEADER);
    /* No header (middleware did not run) means no redirect: redirecting on a
       guess could loop. The module layer still holds. */
    const door = path ? doorFor(member, path) : null;
    if (door?.kind === 'home') redirect(door.to);
    if (door?.kind === 'soon') soon = door.area;
    /* A site supervisor: site mode on the phone, nothing of the office.
       Without the full software site mode is closed; their home says so. */
    if (member.role === 'SUPERVISOR' && member.fullSoftware !== false) {
      return (
        <Themed>
          <RoleFrame
            member={member}
            name={user.name}
            signOut={<SignOutButton label={tx(await getLang(), STUDIO_WORDS['site.signOut'])} />}
          >
            {children}
          </RoleFrame>
        </Themed>
      );
    }
  }

  const context = await shellContext(user.id);

  /* A studio still in setup keeps the setup frame: the software opens when they
     submit (crmIsOpen), and until then Setup is the only thing in their way. */
  const ownSoftware =
    context !== null && crmIsOpen({ status: context.status, submittedForReview: context.submittedForReview });
  if (!ownSoftware && (!member || member.role === 'OWNER')) {
    return (
      <Themed>
        <StudioShell
          groups={navFor(context, member)}
          studioName={context?.tradeName ?? 'Your studio'}
          email={user.email}
          publicHref={context?.live ? `/studios/${context.slug}` : null}
          signOut={<SignOutButton />}
        >
          {soon ? <ComingSoon area={soon} /> : children}
        </StudioShell>
      </Themed>
    );
  }

  /* Everyone else: the app frame from the owner's UI handoff (12 Oct 2026).
     No side menu; a home of app tiles and an apps menu with only this
     member's apps (`appsFor` asks `mayOpen` for each, so a tile never points
     at a screen the door above would bounce). No membership row (an ops
     account looking in) sees every app, as the old rail did. */
  const apps = member ? appsFor(member) : [...APPS];
  const office = !member || usesOfficeShell(member);
  return (
    <Themed>
      <StudioFrame
        apps={apps}
        studioName={context?.tradeName ?? 'Your studio'}
        verified={context?.live ?? false}
        canSearchClients={office}
        alerts={office ? (context?.toConfirm ?? 0) + (context?.clientsDue ?? 0) : 0}
        userName={user.name}
        signOut={signOutAction}
      >
        {soon ? <ComingSoon area={soon} /> : children}
      </StudioFrame>
    </Themed>
  );
}

/**
 * The studio's theme and look (studio-ui.css): light or dark from the
 * person's choice, set on <html> before the first paint so the page never
 * flashes the wrong one. `studio-app` keeps the older screens' tokens
 * bridged to the new ones (studio-extra.css).
 */
function Themed({ children }: { children: React.ReactNode }) {
  return (
    <div className="oi-studio studio-app">
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
    </div>
  );
}

function SignOutButton({ label = 'Sign out' }: { label?: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-[12.5px] text-[var(--s-ink-3)] underline-offset-2 hover:text-[var(--s-ink)] hover:underline"
      >
        {label}
      </button>
    </form>
  );
}

/**
 * A team member whose access is not on: invited but signed in some other way
 * than their phone, or suspended with a session that outlived the
 * suspension's sign-out. Nothing of the studio is shown.
 */
function NotActive({ suspended }: { suspended: boolean }) {
  return (
    <main className="studio-app flex min-h-dvh items-center justify-center bg-[var(--s-ground)] px-5 py-12">
      <div className="max-w-md rounded-[18px] bg-[var(--s-surface)] p-6 shadow-[var(--s-lift)]">
        <h1 className="m-0 text-[20px] font-semibold tracking-tight">
          {suspended ? 'Your access to this studio is paused.' : 'Finish joining your studio.'}
        </h1>
        <p className="m-0 mt-2 text-[15px] leading-relaxed text-[var(--s-ink-2)]">
          {suspended
            ? 'Ask your studio owner. They can turn it back on from Settings, Team.'
            : `Sign in at ${STUDIO_SIGN_IN} with the mobile number your studio owner added.`}
        </p>
        <div className="mt-5">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}

interface ShellContext {
  tradeName: string;
  slug: string;
  /** ACTIVE only. Governs the marketplace half of the rail. */
  live: boolean;
  /** The real status, so PAUSED can be told apart from ONBOARDING. */
  status: string;
  /**
   * Have they handed their side back to us?
   *
   * The rail needs this for the same reason the dashboard does: a studio is
   * ONBOARDING right up until ops approves them, so status alone cannot tell
   * "still filling the form" from "finished and waiting on us". Without it the
   * rail collapsed to Setup for the whole review week — on the very screen
   * that had just told them their side was complete.
   */
  submittedForReview: boolean;
  pausedReason: string | null;
  /** Proposed times waiting on them. The only count worth a badge today. */
  toConfirm: number;
  draftQuotes: number;
  clientsDue: number;
  /**
   * Leads nobody has taken. The badge on the Pool tab.
   *
   * Open columns only: an unassigned client sitting in "Handed over" is not
   * work going undone, and counting it would put a number on the rail that
   * never goes back to zero — which teaches a studio to stop reading badges.
   */
  clientsPooled: number;
}

/**
 * One query per page load, for the four things the rail needs.
 *
 * A direct read rather than `currentStudio()`: that pulls the whole onboarding
 * context including a rate-card round trip, and this runs on every studio
 * screen. Falls closed on any failure — a rail with no counts is fine, a
 * studio surface that 500s because a badge could not be computed is not.
 */
async function shellContext(userId: string): Promise<ShellContext | null> {
  if (!hasDatabase()) return null;

  try {
    const member = await prisma.studioMember.findUnique({
      where: { userId },
      select: {
        studio: {
          select: {
            id: true,
            tradeName: true,
            slug: true,
            status: true,
            pausedReason: true,
            /* Read raw rather than through `currentStudio()`, which this
               function deliberately avoids — see the note above. The shape is
               the same one `prisma-repository.ts` reads. */
            onboardingSteps: true,
          },
        },
      },
    });
    if (!member) return null;

    const { studio } = member;

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [toConfirm, draftQuotes, clientsDue, clientsPooled] = await Promise.all([
      prisma.appointment.count({
        where: { status: 'PROPOSED', introduction: { studioId: studio.id } },
      }),
      prisma.studioQuote.count({ where: { studioId: studio.id, status: 'DRAFT' } }),
      prisma.studioClient.count({
        where: {
          studioId: studio.id,
          // `LIVE`, not `deletedAt: null`. The sample lead ships with a
          // follow-up date two days out, so without this it would put a badge
          // on the rail the day a studio first signed in — a notification for
          // work we invented on their behalf.
          ...LIVE,
          // Kinds, not names. The studio owns its column names now, so a
          // literal list here would silently stop counting the day somebody
          // renamed one. See `studio-practice/stages.ts`.
          stage: { kind: { in: ['OPEN', 'WON'] } },
          nextActionOn: { lte: endOfToday },
        },
      }),
      prisma.studioClient.count({
        where: {
          studioId: studio.id,
          /* LIVE, like every other counter here. The sample lead is a real
             row and is deliberately unassigned, so without this a brand-new
             studio would be told one lead is going untouched — a number we
             invented about work we invented. tests/demo-lead.test.ts fails
             any studioClient.count that omits it. */
          ...LIVE,
          assignedToId: null,
          stage: { kind: { in: ['OPEN', 'WON'] } },
        },
      }),
    ]);

    return {
      tradeName: studio.tradeName,
      slug: studio.slug,
      live: studio.status === 'ACTIVE',
      /* Paused and suspended are NOT "still in setup".
         The rail used to test `=== 'ACTIVE'` and nothing else, so a paused
         studio lost its clients, its quotations and its vendor ledger from
         the nav and was shown a completed onboarding checklist reading
         "0 to go." with no mention of being paused. Their records are theirs
         and do not stop being theirs because we took them out of rotation —
         the marketplace half is what a pause suspends. */
      status: studio.status,
      submittedForReview: hasSubmittedForReview(studio.onboardingSteps),
      pausedReason: studio.pausedReason ?? null,
      toConfirm,
      draftQuotes,
      clientsDue,
      clientsPooled,
    };
  } catch (error) {
    console.error('[studio] shell context failed', error);
    return null;
  }
}

/**
 * The rail, in three groups.
 *
 * The grouping is the argument the whole product rests on. **Your work** is
 * software a studio uses whether or not we ever send them a lead — it is theirs,
 * it holds their clients and their prices, and it keeps working the day they
 * leave the roster. **From us** is the marketplace. Putting them in one flat
 * list would say they are the same kind of thing, and the entire retention case
 * is that they are not.
 *
 * A studio still in setup gets the second group only. Offering a quotation
 * builder to somebody who has not finished onboarding buries the five steps
 * that are actually in their way.
 */
function navFor(context: ShellContext | null, member: MemberRole | null): NavGroup[] {
  /* No membership row (an ops account looking in, fixtures mode) keeps the
     rail as it was. A project manager loses the two owner-only rows. */
  const owner = member === null || can(member, 'team.manage');
  /* Their own software stays reachable unless they never finished setup.
     A pause is a marketplace state: it stops us sending briefs, and it does
     not repossess a studio's client list.

     `crmIsOpen`, not `status !== 'ONBOARDING'`. The rule that the software
     opens on submission rather than on approval lives in one pure function,
     and the rail reading its own version of it was the bug: the dashboard
     opened, the navigation did not, and a studio who had just been told
     "your side is complete" was left with a rail holding Setup and nothing
     else. One rule, one place — modules/studio/standing.ts. */
  const ownSoftware =
    context !== null &&
    crmIsOpen({ status: context.status, submittedForReview: context.submittedForReview });
  const live = context?.live ?? false;

  const setup: NavGroup = {
    items: [{ icon: 'home', href: '/studio', label: 'Setup', ready: true }],
  };

  if (!ownSoftware) return [setup];

  /* Leads and Quotations are the pilot. Everything else shows with a "soon"
     pill and does not link — see modules/studio/features.ts for why a pill
     beside a working link was not enough. */
  const groups: NavGroup[] = [
    {
      items: [
        /* Studio OS Phase 1: what needs doing today, first. */
        { icon: 'today', href: TODAY_HOME, label: 'Today', ready: true },
        /* Leads at scale (12 Oct 2026): the sales numbers, and the calendar of
           follow-ups, meetings and tasks (with One Interiors visits in it). */
        { icon: 'chart', href: '/studio/dashboard', label: 'Dashboard', ready: true },
        { icon: 'calendar', href: '/studio/calendar', label: 'Calendar', ready: true, count: context?.toConfirm },
        /* The studio's morning overview (what was the Dashboard): inbox, owed to trades, live sites. */
        { icon: 'home', href: '/studio', label: 'Overview', ready: true },
      ],
    },
    {
      label: 'Your work',
      items: [
        {
          icon: 'clients',
          href: '/studio/clients',
          label: 'Leads',
          ready: isLive('leads'),
          count: context?.clientsDue,
          /**
           * Leads is a section, not a page.
           *
           * The board is one view of the same data; the pool is the work
           * nobody has taken; analytics is whether any of it is working. They
           * were reachable before only as a footer link on the board, a
           * filter in a dropdown, and nowhere respectively — which is a good
           * way to build features a studio never discovers.
           *
           * There is deliberately no "Board" child: the section row IS the
           * board. A parent and a first child pointing at the same href is
           * two controls for one destination, and whichever one somebody
           * clicks they will wonder what the other did.
           *
           * Order is the order of a working day: what is nobody's, where does
           * more come from, how is it going, what did I throw away.
           */
          children: [
            {
              href: '/studio/clients/pool',
              label: 'Pool',
              ready: isLive('leads'),
              count: context?.clientsPooled,
            },
            { href: '/studio/clients/import', label: 'Import', ready: isLive('leads') },
            { href: '/studio/clients/analytics', label: 'Analytics', ready: isLive('leads') },
            { href: '/studio/clients/bin', label: 'Bin', ready: isLive('leads') },
          ],
        },
        {
          icon: 'quote',
          href: '/studio/quotations',
          label: 'Quotations',
          ready: isLive('quotations'),
          count: context?.draftQuotes,
          // The price list every quotation is built from — was reachable only from the guide.
          children: [{ href: '/studio/products', label: 'Product master', ready: isLive('products') }],
        },
        /* The customer projects this person runs (studio workspace Phase 1).
           Owners see all; a PM only the ones they are on. */
        /* Studio OS Phase 2: the designers' page (owner, PM). */
        { icon: 'projects', href: '/studio/projects', label: 'Projects', ready: true, children: [{ href: '/studio/design', label: 'Design', ready: true }] },
        /* Studio OS Phase 3: the site crews (the old Vendors screen, switched on). The owner's in this
           rail; accounts reaches it from its own frame (RoleFrame), a PM works crews on a project's Crews tab. */
        ...(owner ? [{ icon: 'vendors' as const, href: '/studio/vendors', label: 'Crews', ready: isLive('vendors') }] : []),
      ],
    },
  ];

  /* The marketplace half. A PAUSED studio keeps its own software above and
     loses this, which is exactly what a pause means. */
  if (live) {
    groups.push({
      label: 'From us',
      items: [
        /* Calendar moved to the top of the rail (leads at scale); One Interiors visits are in it. */
        { icon: 'listing', href: '/studio/listing', label: 'Your listing', ready: isLive('listing') },
        // Updates for homes introduced through us — the customer sees them (queue item 22).
        { icon: 'projects', href: '/studio/updates', label: 'Client projects', ready: true },
      ],
    });
  }

  groups.push({
    items: [
      { icon: 'settings', href: '/studio/settings', label: 'Settings', ready: true },
      /* Who is on the team, and which sites they see. Owner only (`team.manage`). */
      ...(member !== null && owner ? [{ icon: 'clients' as const, href: TEAM_PATH, label: 'Team', ready: true }] : []),
    ],
  });

  return groups;
}
