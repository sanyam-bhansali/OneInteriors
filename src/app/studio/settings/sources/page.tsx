import type { Metadata } from 'next';
import { myLeadSources } from '@/modules/studio-sales/settings';
import { SOURCE_LABELS } from '@/modules/studio-practice/vocabulary';
import { SourcesForm } from './SourcesForm';
import { myIntakeScreen } from '@/modules/studio-intake/connections';
import { IntakeConnections } from './IntakeConnections';

export const metadata: Metadata = { title: 'Lead sources', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Lead sources (Studio OS Phase 1): the studio's own names for
 * where leads come from, beside ours. They show in every source list: on
 * the lead, the board's filter and import. Under them, the doors leads come
 * in through by themselves (lead intake, 21 Oct 2026): Meta lead ads, Google
 * lead forms, the website and portals (docs/studio-os/LEAD-INTAKE.md).
 */
export default async function LeadSourcesPage() {
  const [sources, intake] = await Promise.all([myLeadSources(), myIntakeScreen()]);
  const ours = Object.entries(SOURCE_LABELS)
    .filter(([k]) => k !== 'ONE_INTERIORS' && k !== 'OTHER')
    .map(([, v]) => v);
  return (
    <>
      <div className="max-w-[44rem]">
        <p className="m-0 mb-4 text-[14px] leading-relaxed muted">
          Already on every list: {ours.join(', ')}. Add the others your leads come from — a portal, a builder tie-up, an exhibition.
        </p>
        <SourcesForm sources={sources} />
        {intake ? (
          <div className="mt-6">
            <IntakeConnections screen={intake} />
          </div>
        ) : null}
      </div>
    </>
  );
}
