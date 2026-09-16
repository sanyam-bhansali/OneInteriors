import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { myStages } from '@/modules/studio-practice/stages';
import { STAGE_KIND_LABELS, STAGE_KIND_NOTES } from '@/modules/studio-practice/vocabulary';
import { PipelineEditor } from './PipelineEditor';

export const metadata: Metadata = {
  title: 'Pipeline',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The columns on the client board, which are the studio's and not ours.
 *
 * ## What changed and why
 *
 * These six used to be an enum. A studio whose actual process is
 *
 *   New → Calling 1 → Calling 2 → Effective lead →
 *   Floor plan pending → Quotation pending → Quotation shared
 *
 * had nowhere to write any of it down, and the software quietly asked them to
 * work our way instead of theirs. Software that asks that gets used for as
 * long as it is the only thing on offer.
 *
 * ## What is still ours
 *
 * The four meanings. A studio names, colours, orders and sizes its own list;
 * each column also says whether it means the work is in play, won, finished
 * or gone, because Projects will only start a job from a won column and the
 * dashboard counts the ones in play. That is a real constraint and it is
 * stated on this page rather than discovered later.
 */
export default async function PipelinePage() {
  const stages = await myStages();

  return (
    <PageBody>
      <div className="s-card mb-5 border-l-[3px] !border-l-[var(--s-accent)] p-5">
        <p className="m-0 mb-2 text-[14.5px] font-semibold">
          These are your columns. Rename them, reorder them, add as many as you work with.
        </p>
        <p className="m-0 mb-3 max-w-[70ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          The six below are only a starting point — they are what the software shipped with, not
          what we think your process should be. The one thing each column has to declare is what it{' '}
          <em>means</em>, because the rest of the software reads that rather than the name:
        </p>
        <dl className="m-0 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {(Object.keys(STAGE_KIND_LABELS) as (keyof typeof STAGE_KIND_LABELS)[]).map((k) => (
            <div key={k} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="m-0 text-[13.5px] font-semibold">{STAGE_KIND_LABELS[k]}</dt>
              <dd className="m-0 flex-1 text-[13px] leading-snug text-[var(--s-ink-2)]">
                {STAGE_KIND_NOTES[k]}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <PipelineEditor stages={stages} />
    </PageBody>
  );
}
