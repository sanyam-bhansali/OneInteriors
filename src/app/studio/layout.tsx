import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { signOutAction } from '@/app/sign-in/actions';
import { isLive } from '@/modules/studio/features';
import { StudioShell, type NavGroup } from './StudioShell';

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

  if (!user) redirect('/sign-in?next=/studio');

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
              If you are a studio owner, this usually means you signed in by phone. Studio accounts
              use the email address we approved you on — sign out and use the email form, and you
              will land in the right place.
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

  const context = await shellContext(user.id);

  return (
    <StudioShell
      groups={navFor(context)}
      studioName={context?.tradeName ?? 'Your studio'}
      email={user.email}
      publicHref={context?.live ? `/studios/${context.slug}` : null}
      signOut={
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-[12.5px] text-[var(--s-ink-3)] underline-offset-2 hover:text-[var(--s-ink)] hover:underline"
          >
            Sign out
          </button>
        </form>
      }
    >
      {children}
    </StudioShell>
  );
}

interface ShellContext {
  tradeName: string;
  slug: string;
  /** ACTIVE only. Governs the marketplace half of the rail. */
  live: boolean;
  /** The real status, so PAUSED can be told apart from ONBOARDING. */
  status: string;
  pausedReason: string | null;
  /** Proposed times waiting on them. The only count worth a badge today. */
  toConfirm: number;
  draftQuotes: number;
  clientsDue: number;
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
      select: { studio: { select: { id: true, tradeName: true, slug: true, status: true, pausedReason: true } } },
    });
    if (!member) return null;

    const { studio } = member;

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [toConfirm, draftQuotes, clientsDue] = await Promise.all([
      prisma.appointment.count({
        where: { status: 'PROPOSED', introduction: { studioId: studio.id } },
      }),
      prisma.studioQuote.count({ where: { studioId: studio.id, status: 'DRAFT' } }),
      prisma.studioClient.count({
        where: {
          studioId: studio.id,
          deletedAt: null,
          // Kinds, not names. The studio owns its column names now, so a
          // literal list here would silently stop counting the day somebody
          // renamed one. See `studio-practice/stages.ts`.
          stage: { kind: { in: ['OPEN', 'WON'] } },
          nextActionOn: { lte: endOfToday },
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
      pausedReason: studio.pausedReason ?? null,
      toConfirm,
      draftQuotes,
      clientsDue,
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
function navFor(context: ShellContext | null): NavGroup[] {
  /* Their own software stays reachable unless they never finished setup.
     A pause is a marketplace state: it stops us sending briefs, and it does
     not repossess a studio's client list. */
  const ownSoftware = context !== null && context.status !== 'ONBOARDING';
  const live = context?.live ?? false;

  const setup: NavGroup = {
    items: [{ icon: 'home', href: '/studio', label: 'Setup', ready: true }],
  };

  if (!ownSoftware) return [setup];

  /* Leads and Quotations are the pilot. Everything else shows with a "soon"
     pill and does not link — see modules/studio/features.ts for why a pill
     beside a working link was not enough. */
  const groups: NavGroup[] = [
    { items: [{ icon: 'home', href: '/studio', label: 'Dashboard', ready: true }] },
    {
      label: 'Your work',
      items: [
        {
          icon: 'clients',
          href: '/studio/clients',
          label: 'Leads',
          ready: isLive('leads'),
          count: context?.clientsDue,
        },
        {
          icon: 'quote',
          href: '/studio/quotations',
          label: 'Quotations',
          ready: isLive('quotations'),
          count: context?.draftQuotes,
        },
        {
          icon: 'projects',
          href: '/studio/projects',
          label: 'Project tracker',
          ready: isLive('projects'),
        },
        { icon: 'vendors', href: '/studio/vendors', label: 'Vendors', ready: isLive('vendors') },
      ],
    },
  ];

  /* The marketplace half. A PAUSED studio keeps its own software above and
     loses this, which is exactly what a pause means. */
  if (live) {
    groups.push({
      label: 'From us',
      items: [
        {
          icon: 'calendar',
          href: '/studio/calendar',
          label: 'Calendar',
          ready: isLive('calendar'),
          count: context?.toConfirm,
        },
        { icon: 'listing', href: '/studio/listing', label: 'Your listing', ready: isLive('listing') },
      ],
    });
  }

  groups.push({
    items: [{ icon: 'settings', href: '/studio/settings', label: 'Settings', ready: true }],
  });

  return groups;
}
