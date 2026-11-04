import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { getCurrentUser } from '@/modules/auth/session';
import { signOutAction } from '@/app/sign-in/actions';
import { loadBrief } from '@/modules/brief/repository';
import { homeProfile } from '@/modules/brief/home-profile';

export const metadata: Metadata = {
  title: 'My Home Profile',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * My Home Profile (owner, 4 Nov 2026): every answer they gave, in words, with
 * their style DNA, on their account. It is read from the brief claimed when
 * they signed in, so it is the same on any device and after any sign-out.
 */
export default async function HomeProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/account/profile');

  const { brief, found } = await loadBrief();
  const profile = found ? homeProfile(brief, user.name) : null;

  return (
    <>
      <SiteHeader />
      <main className="py-10 sm:py-14">
        <Container size="default">
          <Eyebrow>My Home Profile</Eyebrow>
          <h1 className="display mb-3 text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.03]">
            {profile?.title ?? 'Your Home Profile'}
          </h1>

          {!profile || profile.groups.length === 0 ? (
            <p className="lede mb-8 max-w-[58ch]">
              You have not told us about your home yet. It takes about four minutes, and we match you with studios that
              fit it.{' '}
              <Link href="/quiz" className="text-[var(--color-petrol)]">
                Start your Home Profile
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="lede mb-8 max-w-[58ch]">
                {[profile.homeLine, profile.planLine].filter(Boolean).join(' · ')}
                {profile.complete ? '' : '. Not finished yet.'}
              </p>

              {profile.dna ? (
                <section
                  aria-label="Your style DNA"
                  className="mb-10 rounded-[16px] border border-[var(--color-rule)] p-5 sm:p-6"
                >
                  <p className="label m-0 mb-3">Your style DNA</p>
                  <p className="m-0 mb-4 text-[clamp(1.2rem,2.4vw,1.6rem)] leading-snug text-[var(--color-ink)]">
                    {profile.dna.shares.map((s) => `${s.pct}% ${s.label}`).join(' · ')}
                  </p>
                  <div className="mb-3 flex gap-2" aria-hidden>
                    {profile.dna.palette.map((c) => (
                      <span key={c} className="h-9 w-9 rounded-full border border-[var(--color-rule)]" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="m-0 text-[14px] text-[var(--color-ink-2)]">
                    Materials that suit it: {profile.dna.materials.join(', ')}
                  </p>
                </section>
              ) : null}

              {profile.groups.map((g) => (
                <section key={g.id} className="mb-8 border-t border-[var(--color-rule)] pt-5">
                  <h2 className="h3 m-0 mb-3">{g.title}</h2>
                  <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-[180px_1fr]">
                    {g.answers.map((a) => (
                      <div key={a.label} className="contents">
                        <dt className="label m-0 pt-0.5">{a.label}</dt>
                        <dd className="m-0 text-[15px] leading-relaxed text-[var(--color-ink)]">{a.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              <section className="mb-8 border-t border-[var(--color-rule)] pt-5">
                <h2 className="h3 m-0 mb-3">Your details</h2>
                <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-[180px_1fr]">
                  <dt className="label m-0 pt-0.5">Name</dt>
                  <dd className="m-0 text-[15px] text-[var(--color-ink)]">{user.name ?? brief.contactName ?? 'Not given'}</dd>
                  <dt className="label m-0 pt-0.5">Mobile</dt>
                  <dd className="m-0 text-[15px] text-[var(--color-ink)]">{user.phone ?? 'Not given'}</dd>
                  {user.email ? (
                    <>
                      <dt className="label m-0 pt-0.5">Email</dt>
                      <dd className="m-0 text-[15px] text-[var(--color-ink)]">{user.email}</dd>
                    </>
                  ) : null}
                </dl>
              </section>

              <div className="mb-10 flex flex-wrap gap-3">
                <Link
                  href="/quiz"
                  className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-[14.5px] text-[var(--color-paper)] no-underline"
                >
                  {profile.complete ? 'Change an answer' : 'Finish my Home Profile'}
                </Link>
                {profile.complete ? (
                  <Link
                    href="/match"
                    className="rounded-full border border-[var(--color-rule)] px-5 py-2.5 text-[14.5px] text-[var(--color-ink)] no-underline"
                  >
                    See studios that fit
                  </Link>
                ) : null}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-[var(--color-rule)] pt-6">
            <Link href="/account" className="text-[14px] text-[var(--color-petrol)]">
              ← Your project
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13.5px] text-[var(--color-ink-2)] hover:border-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
