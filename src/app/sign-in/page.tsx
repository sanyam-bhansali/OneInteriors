import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui';
import { Wordmark } from '@/components/brand';
import { getCurrentUser } from '@/modules/auth/session';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  // Already signed in — send them somewhere useful rather than showing a form
  // that would confuse.
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === 'OPS' || user.role === 'ADMIN' ? '/ops' : '/');
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md">
          <div className="mb-8">
            <Wordmark showCity={false} />
          </div>

          <h1 className="h1 mb-3">Sign in</h1>
          <p className="m-0 mb-8 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            We&rsquo;ll email you a link. No password to remember or lose.
          </p>

          <SignInForm />

          <p className="m-0 mt-10 border-t border-[var(--color-rule)] pt-5 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
            This is for our team and partner studios. If you&rsquo;re looking for an interior
            designer, you don&rsquo;t need an account —{' '}
            <a href="/quiz" className="text-[var(--color-petrol)]">
              start with the nine questions
            </a>
            .
          </p>
        </div>
      </Container>
    </main>
  );
}
