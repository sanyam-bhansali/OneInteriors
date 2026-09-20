import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui';
import { Wordmark } from '@/components/brand';
import { getCurrentUser } from '@/modules/auth/session';
import { safeNext } from '@/lib/site';
import { signOutAction } from './actions';
import { SignInForm } from './SignInForm';
import { PasswordForm } from './PasswordForm';
import { OtpForm } from './OtpForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const destination = safeNext(next ?? null);

  const user = await getCurrentUser();

  /**
   * Already signed in, and they were sent here by a gate.
   *
   * They already pass it, so carry on to where they were going. This branch is
   * the one that makes a stale `?next=` harmless.
   */
  if (user && destination) redirect(destination);

  /**
   * Already signed in, and they typed /sign-in deliberately.
   *
   * This used to redirect to `/` (or `/ops`), silently. Which means somebody
   * holding an old session — signed in as a customer during testing, say — types
   * the sign-in URL, lands on the homepage, and has no way to work out why: the
   * page they asked for is the one page that will not show itself to them.
   *
   * Nobody types /sign-in while signed in unless they want to change who they
   * are signed in as. So say who they are, and give them the control.
   */
  if (user) {
    const home =
      user.role === 'OPS' || user.role === 'ADMIN'
        ? { href: '/ops', label: 'the ops console' }
        : user.role === 'STUDIO'
          ? { href: '/studio', label: 'your studio dashboard' }
          : { href: '/account', label: 'your project' };

    return (
      <main className="flex min-h-dvh flex-col justify-center py-12">
        <Container size="narrow">
          <div className="mx-auto max-w-md">
            <div className="mb-8">
              <Wordmark showCity={false} />
            </div>

            <h1 className="h1 mb-3">You are already signed in.</h1>
            <p className="m-0 mb-8 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
              As {user.email ?? user.phone ?? 'this account'}
              {user.role !== 'CUSTOMER' ? `, with ${user.role.toLowerCase()} access` : ''}. Sign out
              if you meant to come back as somebody else.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-full bg-[var(--color-petrol)] px-6 py-3 text-[15px] font-medium text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)]"
                >
                  Sign out
                </button>
              </form>
              <Link href={home.href} className="text-[14.5px] text-[var(--color-petrol)]">
                Go to {home.label}
              </Link>
            </div>

            <p className="m-0 mt-10 border-t border-[var(--color-rule)] pt-5 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              Studio and team accounts sign in by email; customers sign in by phone. Signing in with
              the wrong one creates a second account rather than finding your existing one, which is
              why this page asks rather than guessing.
            </p>
          </div>
        </Container>
      </main>
    );
  }

  // Arriving from the quotes gate is a different moment from arriving at a
  // sign-in page cold: they are mid-task and did not come here to sign in.
  const fromQuotes = reason === 'quotes' || reason === 'expert';

  /**
   * Is this person heading for a staff surface?
   *
   * ## The trap this closes
   *
   * Studio and ops accounts are created with an email and **no phone number**.
   * The phone form was the primary, above-the-fold control for everybody, so a
   * studio owner arriving at an approval link would use the obvious form — and
   * `verifyOtp` looks a user up by phone, finds nobody, and creates a **brand
   * new CUSTOMER account** for that number. They are then signed in as a
   * customer, `/studio` bounces them to the landing page with no explanation,
   * and what they report is "your site logged me in and then threw me out".
   *
   * So when the destination is a staff surface, the email form leads. A studio
   * owner following their approval link now lands on the control that actually
   * works for them.
   *
   * ## Why the trailing slash matters
   *
   * `'/studios/kalyani'.startsWith('/studio')` is true. A customer sent here
   * from a studio's public profile — `/sign-in?next=/studios/<slug>` — would
   * have landed on the staff page with no phone form anywhere on it, which is
   * this exact bug with the roles reversed. Match the route, not the prefix.
   */
  const forStaff =
    destination === '/studio' ||
    destination?.startsWith('/studio/') ||
    destination === '/ops' ||
    destination?.startsWith('/ops/');

  if (forStaff) {
    return (
      <main className="flex min-h-dvh flex-col justify-center py-12">
        <Container size="narrow">
          <div className="mx-auto max-w-md">
            <div className="mb-8">
              <Wordmark showCity={false} />
            </div>

            <h1 className="h1 mb-3">Sign in</h1>
            <p className="m-0 mb-8 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
              Studio and team accounts sign in with the email address we
              approved you on.
            </p>

            {/* The daily path first. Studios and ops set a password on their
                first visit, so this is what they use every time after. */}
            <PasswordForm />

            {/* And the way back in, never hidden — somebody who has forgotten
                their password should not have to hunt for this while
                frustrated. It is also the whole first-run path, before any
                password exists. */}
            <div className="mt-8 border-t border-[var(--color-rule)] pt-6">
              <p className="m-0 mb-4 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
                Forgotten your password, or signing in for the first time? We
                will email you a link instead.
              </p>
              <SignInForm next={destination} />
            </div>

            <p className="m-0 mt-10 border-t border-[var(--color-rule)] pt-5 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              If the link has expired, ask for another — they last fifteen minutes and can only be
              used once, which is why.
            </p>

            {/* The phone form is still reachable, but it cannot sign anyone into
                a studio account, so it is not offered here as an alternative. */}
            <p className="m-0 mt-6 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              Looking for your own quotes as a customer?{' '}
              <a href="/sign-in" className="text-[var(--color-petrol)]">
                Sign in by phone instead
              </a>
              .
            </p>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md">
          <div className="mb-8">
            <Wordmark showCity={false} />
          </div>

          <h1 className="h1 mb-3">
            {fromQuotes ? 'Last step before your quotes.' : 'Sign in'}
          </h1>
          <p className="m-0 mb-8 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            {fromQuotes ? (
              <>
                Your answers are saved. Your name and number, a code on WhatsApp, and the quotes
                are on the next screen — so they stay yours and you can come back to them.
              </>
            ) : (
              <>Your number and a code on WhatsApp. No password to remember or lose.</>
            )}
          </p>

          {/* Customers sign in by phone. The emailed link is still here, below
              the fold, because ops and studio accounts use it — but it is not
              what a customer should be reading first. */}
          <OtpForm next={destination} />

          <p className="m-0 mt-10 border-t border-[var(--color-rule)] pt-5 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
            Nothing is shared with any studio until you ask us to introduce you, and we do not
            send your quotes anywhere — they live on this site.
          </p>

          {/* Staff route. Deliberately understated and last: a customer who
              opens it has taken a wrong turn, and a studio owner looking for
              it knows what they are looking for. */}
          <details className="group mt-6">
            <summary className="cursor-pointer list-none text-[13.5px] text-[var(--color-ink-3)] underline underline-offset-4">
              Studio or team member? Sign in by email instead
            </summary>
            <div className="mt-5">
              <SignInForm next={destination} />
            </div>
          </details>
        </div>
      </Container>
    </main>
  );
}
