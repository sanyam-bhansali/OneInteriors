import { projectCrews } from '@/modules/studio-crews/store';
import { CrewsPanel } from './CrewsPanel';

/**
 * The Crews tab (Studio OS Phase 3): read on the server through the crews
 * store, which checks who may see this project and takes every money field
 * out for anyone without `workorder.money` (a PM sees quantities only).
 */
export async function CrewsTab({ projectId, now }: { projectId: string; now: Date }) {
  const r = await projectCrews(projectId, now);
  if (!r.ok) {
    return (
      <section className="card p-5">
        <p className="m-0 text-[15px] text-[var(--text2)]">{r.error}</p>
      </section>
    );
  }
  return <CrewsPanel tab={r.tab} />;
}
