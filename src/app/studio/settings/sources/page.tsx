import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { myLeadSources } from '@/modules/studio-sales/settings';
import { SOURCE_LABELS } from '@/modules/studio-practice/vocabulary';
import { SourcesForm } from './SourcesForm';

export const metadata: Metadata = { title: 'Lead sources', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Lead sources (Studio OS Phase 1): the studio's own names for
 * where leads come from, beside ours. They show in every source list: on
 * the lead, the board's filter and import.
 */
export default async function LeadSourcesPage() {
  const sources = await myLeadSources();
  const ours = Object.entries(SOURCE_LABELS)
    .filter(([k]) => k !== 'ONE_INTERIORS' && k !== 'OTHER')
    .map(([, v]) => v);
  return (
    <PageBody>
      <div className="max-w-[44rem]">
        <p className="m-0 mb-4 text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          Already on every list: {ours.join(', ')}. Add the others your leads come from — a portal, a builder tie-up, an exhibition.
        </p>
        <SourcesForm sources={sources} />
      </div>
    </PageBody>
  );
}
