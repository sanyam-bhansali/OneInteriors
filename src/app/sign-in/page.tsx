import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui';
import { Wordmark } from '@/components/brand';
import { getCurrentUser } from '@/modules/auth/session';
import { safeNext } from '@/lib/site';
import { SignInForm } from './SignInForm';
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

  // Already signed in — send them somewhere useful rather than showing a form
  // that would confuse.
  const user = await getCurrentUser();
  if (user) {
    redirect(destination ?? (user.role === 'OPS' || user.role === 'ADMIN' ? '/ops' : '/'));
  }

  // Arriving from the quotes gate is a different moment from arriving at a
  // sign-in page cold: they are mid-task and did not come here to sign in.
  const fromQuotes = reason === 'quotes' || reason === 'expert';

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
