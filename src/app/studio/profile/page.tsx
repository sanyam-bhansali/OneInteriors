import Link from 'next/link';
import type { Metadata } from 'next';
import { hasAnthropic } from '@/lib/env';
import { currentStudio } from '@/modules/studio/onboarding';
import { readDraft } from '@/modules/studio/profile-draft-store';
import { GenerateButton, DraftEditor } from './DraftEditor';
import '../office-ui.css';
import '../listing/listing.css';

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
    <main className="content ox-page" style={{ maxWidth: 900 }}>
      <div className="phead">
        <div>
          <Link href="/studio/listing" className="muted sm">
            ← Your listing
          </Link>
          <h1 style={{ marginTop: 4 }}>Your profile copy</h1>
          <p className="muted">The words a customer reads before deciding whether to meet you.</p>
        </div>
        {draft ? (
          <span className={draft.approvedAt ? 'chip good' : 'chip warn'}>
            <span className="dot" />
            {draft.approvedAt ? 'Approved and live on your profile' : 'Not yet approved'}
          </span>
        ) : null}
      </div>

      {!hasAnthropic() ? (
        <Note>
          Drafting is switched off on this deployment, so write your description yourself on the{' '}
          <Link href="/studio/onboarding/profile" className="ox-link">
            studio step
          </Link>
          . Your own words are better than a draft anyway — this feature exists for people who hate writing, not because we think a machine does it better.
        </Note>
      ) : !projectsReady ? (
        <Note>Add a project or two first. There is nothing to write about yet, and a draft built from an empty record would just be padding.</Note>
      ) : (
        <section className="card" aria-labelledby="h-how">
          <div className="chead">
            <h2 id="h-how">How this works</h2>
          </div>
          <p className="muted" style={{ margin: 0, maxWidth: '62ch', fontSize: 14.5, lineHeight: 1.5 }}>
            We read the projects you have entered and draft a profile from them — nothing else. It cannot see your website, your Instagram, or anything you have not told
            us, and every number it writes is checked against your record before you see it. Then you edit it until it sounds like you, and approve it. It is a first
            draft, not a decision.
          </p>
          <GenerateButton hasDraft={draft !== null} />
        </section>
      )}

      {draft ? (
        <section className="card" aria-labelledby="h-draft">
          <div className="chead">
            <h2 id="h-draft">The draft</h2>
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
        </section>
      ) : null}
    </main>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="muted" style={{ fontSize: 15, lineHeight: 1.5, maxWidth: '62ch' }}>
        {children}
      </span>
    </div>
  );
}
