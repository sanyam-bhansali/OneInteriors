import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui';
import { Wordmark } from '@/components/brand';
import { getCurrentUser } from '@/modules/auth/session';
import { safeNext } from '@/lib/site';
import { SignInForm } from './SignInForm';

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
            {fromQuotes ? 'Where should we send your quotes?' : 'Sign in'}
          </h1>
          <p className="m-0 mb-8 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            {fromQuotes ? (
              <>
                Your answers are saved. We&rsquo;ll email you a link so your quotes stay yours —
                you can come back to them from any device, and every version is kept.
              </>
            ) : (
              <>We&rsquo;ll email you a link. No password to remember or lose.</>
            )}
          </p>

          <SignInForm next={destination} />

          {fromQuotes ? (
            <p className="m-0 mt-10 border-t border-[var(--color-rule)] pt-5 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              No password, and nothing is shared with any studio until you ask us to introduce
              you.
            </p>
          ) : (
            <p className="m-0 mt-10 border-t border-[var(--color-rule)] pt-5 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              Looking for an interior designer? You can see your matches without an account —{' '}
              <a href="/quiz" className="text-[var(--color-petrol)]">
                start with the nine questions
              </a>
              .
            </p>
          )}
        </div>
      </Container>
    </main>
  );
}
