import type { Metadata } from 'next';
import { myLeadRouting, myLeadSources } from '@/modules/studio-sales/settings';
import { SOURCE_LABELS } from '@/modules/studio-practice/vocabulary';
import { SourcesForm } from './SourcesForm';
import { myIntakeScreen } from '@/modules/studio-intake/connections';
import { myConversionScreen } from '@/modules/studio-sales/conversions';
import { IntakeConnections } from './IntakeConnections';
import { LeadRouting } from './LeadRouting';
import { MetaFeedback } from './MetaFeedback';

export const metadata: Metadata = { title: 'Lead sources', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Lead sources (Studio OS Phase 1): the studio's own names for
 * where leads come from, beside ours. They show in every source list: on
 * the lead, the board's filter and import. Under them, the doors leads come
 * in through by themselves (lead intake, 21 Oct 2026): Meta lead ads, Google
 * lead forms, the website and portals (docs/studio-os/LEAD-INTAKE.md); who
 * those leads go to (owner, 22 Oct 2026: "New leads go to", for the studio
 * and per door); and whether Meta is told which lead-ad leads became
 * customers (off by default, the owner's switch).
 */
export default async function LeadSourcesPage() {
  const [sources, intake, routing, feedback] = await Promise.all([myLeadSources(), myIntakeScreen(), myLeadRouting(), myConversionScreen()]);
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
        {routing?.canManage ? (
          <div className="mt-6">
            <LeadRouting screen={routing} />
          </div>
        ) : null}
        {intake ? (
          <div className="mt-6">
            <IntakeConnections screen={intake} people={routing?.canManage ? routing.people : []} />
          </div>
        ) : null}
        {feedback ? (
          <div className="mt-6">
            <MetaFeedback screen={feedback} />
          </div>
        ) : null}
      </div>
    </>
  );
}
