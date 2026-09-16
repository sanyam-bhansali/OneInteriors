import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Button } from '@/components/ui';
import { Wordmark } from '@/components/brand';

export const metadata: Metadata = {
  title: 'Sign-in link',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Why a sign-in link did not work.
 *
 * ## What this page used to be
 *
 * It used to consume the link itself — and threw on every click, because
 * opening a session writes a cookie and **Next refuses a cookie write during a
 * server component render**. Email sign-in was broken for everyone, which meant
 * studios and ops accounts could not get in at all, since those are created
 * with an address and no phone.
 *
 * The consuming moved to `/auth/verify`, a Route Handler, where a cookie write
 * is allowed. This is now only the explanation, and it deliberately has no
 * access to a token: a page that cannot consume a link cannot accidentally
 * start consuming one again.
 */
const MESSAGES: Record<string, { title: string; body: string }> = {
  invalid: {
    title: 'That link is not valid',
    body: 'It may have been copied incompletely — email clients sometimes break a long link across two lines. Request a fresh one; they only take a moment.',
  },
  expired: {
    title: 'That link has expired',
    body: 'Sign-in links last fifteen minutes, so an old email will not work. Request a new one.',
  },
  used: {
    title: 'That link has already been used',
    body: 'Each link works exactly once — that is what stops a forwarded email from becoming a way into your account. If you are not signed in, request another.',
  },
  no_account: {
    title: 'No account for that address',
    body: 'Studio and team accounts are created by invitation rather than by signing up. Ask us to add you.',
  },
};

export default async function VerifyProblemPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = MESSAGES[reason ?? ''] ?? MESSAGES.invalid;

  return (
    <main className="flex min-h-dvh flex-col justify-center py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md">
          <div className="mb-8">
            <Wordmark showCity={false} />
          </div>
          <h1 className="h1 mb-3">{message.title}</h1>
          <p className="m-0 mb-8 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            {message.body}
          </p>
          <Button href="/sign-in" size="lg">
            Request a new link
          </Button>
          <p className="m-0 mt-8 text-[13.5px] text-[var(--color-ink-3)]">
            <Link href="/" className="text-[var(--color-petrol)]">
              Back to the site
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
