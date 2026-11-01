import { designForStudio } from '@/modules/studio-design/store';
import { studioRequirementForm } from '@/modules/project/requirement-form';
import { DesignPanel } from './DesignPanel';

/**
 * The Design tab (Studio OS Phase 2): read on the server through the design
 * store (which checks who may see this project), then handed to the client
 * panel for its one-action-per-row controls.
 */
export async function DesignTab({ projectId, now }: { projectId: string; now: Date }) {
  const [r, requirements] = await Promise.all([designForStudio(projectId, now), studioRequirementForm(projectId).catch(() => null)]);
  if (!r.ok) {
    return (
      <section className="card p-5">
        <p className="m-0 text-[15px] text-[var(--text2)]">{r.error}</p>
      </section>
    );
  }
  return <DesignPanel tab={r.tab} requirements={requirements} />;
}
