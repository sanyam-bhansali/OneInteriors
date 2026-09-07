import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Container, Button } from '@/components/ui';
import { Wordmark } from '@/components/brand';
import { consumeMagicLink } from '@/modules/auth/magic-link';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Signing in',
  robots: { index: false, follow: false },
};

/**
 * Consumes the link and opens a session.
 *
 * `dynamic = 'force-dynamic'` matters: this must never be prerendered or
 * cached, and it sets a cookie.
 */
export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, { title: string; body: string }> = {
  invalid: {
    title: 'That link is not valid',
    body: 'It may have been copied incompletely. Request a fresh one — they only take a moment.',
  },
  expired: {
    title: 'That link has expired',
    body: 'Sign-in links last fifteen minutes, so an old email will not work. Request a new one.',
  },
  used: {
    title: 'That link has already been used',
    body: 'Each link works exactly once. If you are not signed in, request another.',
  },
  no_account: {
    title: 'No account for that address',
    body: 'Ask an admin to add you. We do not create accounts automatically.',
  },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const h = await headers();

  const result = await consumeMagicLink(token ?? '', {
    userAgent: h.get('user-agent'),
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  if (result.ok) {
    const user = await prisma.user.findUnique({ where: { id: result.userId } });
    redirect(user?.role === 'OPS' || user?.role === 'ADMIN' ? '/ops' : '/');
  }

  const message = MESSAGES[result.reason] ?? MESSAGES.invalid;

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
