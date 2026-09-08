import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { hasAnthropic } from '@/lib/env';
import { currentStudio } from '@/modules/studio/onboarding';
import { readDraft } from '@/modules/studio/profile-draft-store';
import { GenerateButton, DraftEditor } from './DraftEditor';

export const metadata: Metadata = {
  title: 'Your profile copy',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProfileCopyPage() {
  const context = await currentStudio();
  if (!context) return null;

  const draft = await readDraft();
  const projectsReady = context.studio.portfolioCount > 0;

  return (
    <main className="py-10">
      <Container size="narrow">
        <Link
          href="/studio"
          className="label mb-6 inline-block text-[var(--color-ink-3)] no-underline hover:text-[var(--color-ink)]"
        >
          ← All steps
        </Link>

        <h1 className="h1 mb-3">Your profile copy</h1>
        <p className="lede mb-8">
          The words a customer reads before deciding whether to meet you.
        </p>

        {!hasAnthropic() ? (
          <Note>
            Drafting is switched off on this deployment, so write your description yourself on the{' '}
            <Link href="/studio/onboarding/profile" className="text-[var(--color-petrol)]">
              studio step
            </Link>
            . Your own words are better than a draft anyway — this feature exists for people who
            hate writing, not because we think a machine does it better.
          </Note>
        ) : !projectsReady ? (
          <Note>
            Add a project or two first. There is nothing to write about yet, and a draft built from
            an empty record would just be padding.
          </Note>
        ) : (
          <div className="mb-10 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
            <p className="label m-0 mb-2">How this works</p>
            <p className="m-0 mb-4 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
              We read the projects you have entered and draft a profile from them — nothing else.
              It cannot see your website, your Instagram, or anything you have not told us, and
              every number it writes is checked against your record before you see it. Then you
              edit it until it sounds like you, and approve it. It is a first draft, not a
              decision.
            </p>
            <GenerateButton hasDraft={draft !== null} />
          </div>
        )}

        {draft ? (
          <>
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-t border-[var(--color-rule)] pt-6">
              <p className="h3 m-0">The draft</p>
              <p className="m-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                {draft.approvedAt ? 'Approved and live on your profile' : 'Not yet approved'}
              </p>
            </div>

            <DraftEditor
              draft={{
                headline: draft.headline,
                introduction: draft.introduction,
                notFor: draft.notFor,
                stories: draft.stories,
                issues: draft.issues,
                generatedAt: draft.generatedAt.toISOString(),
                approvedAt: draft.approvedAt ? draft.approvedAt.toISOString() : null,
              }}
            />
          </>
        ) : null}
      </Container>
    </main>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 max-w-[62ch] rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-5 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
      {children}
    </p>
  );
}
