import { designForStudio } from '@/modules/studio-design/store';
import { studioRequirementForm } from '@/modules/project/requirement-form';
import { studioAgreementView } from '@/modules/agreement/store';
import { DesignPanel } from './DesignPanel';
import { AgreementPanel } from './AgreementPanel';

/**
 * The Design tab (Studio OS Phase 2): read on the server through the design
 * store (which checks who may see this project), then handed to the client
 * panel for its one-action-per-row controls. Below it, the client agreement
 * signed at design closure (owner, 21 Nov 2026), for whoever may close the
 * design.
 */
export async function DesignTab({ projectId, now }: { projectId: string; now: Date }) {
  const [r, requirements, agreement] = await Promise.all([
    designForStudio(projectId, now),
    studioRequirementForm(projectId).catch(() => null),
    studioAgreementView(projectId, now).catch(() => null),
  ]);
  if (!r.ok) {
    return (
      <section className="card p-5">
        <p className="m-0 text-[15px] text-[var(--text2)]">{r.error}</p>
      </section>
    );
  }
  return (
    <>
      <DesignPanel tab={r.tab} requirements={requirements} />
      {agreement?.ok ? <AgreementPanel projectId={projectId} view={agreement.view} /> : null}
    </>
  );
}
