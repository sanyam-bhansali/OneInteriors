import { studioLocker } from '@/modules/project/locker';
import { CustomerSees } from '../marks';
import { DraftActions, MaterialCode, UploadDocument } from './LockerClient';

/**
 * The Home locker card (studio workspace Phase 5, StudioProject.dc.html):
 * what is filed by itself (agreement, final quote, receipts, decision
 * outcomes), the studio's drawings with their versions and drafts, and the
 * materials from the quote with their product codes once ordered.
 */

const muted = 'text-[12.5px] text-[var(--s-ink-3)]';

export async function LockerCard({ projectId, customer }: { projectId: string; customer: string }) {
  const locker = await studioLocker(projectId);
  if (!locker) return null;
  const count = (k: string) => locker.docs.filter((d) => d.kind === k).length;
  const drawings = count('DRAWINGS');
  const receipts = count('RECEIPT');
  const summary = [
    'Agreement and final quote filed automatically',
    drawings ? `${drawings} drawing${drawings === 1 ? '' : 's'}` : null,
    receipts ? `${receipts} receipt${receipts === 1 ? '' : 's'}` : null,
    locker.materials.length ? `${locker.materials.length} material${locker.materials.length === 1 ? '' : 's'} from the quote` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const ordered = locker.materials.filter((m) => m.ordered).length;

  return (
    <section className="s-card flex flex-col gap-3 p-4" aria-label="Home locker">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[15px] font-semibold">Home locker</h2>
        <CustomerSees name={customer} />
      </div>
      <p className={`m-0 ${muted}`}>
        {summary}. {customer} can open {locker.sharedCount}
        {locker.drafts ? `; ${locker.drafts} draft${locker.drafts === 1 ? '' : 's'} only your team can see` : ''}.
      </p>

      {locker.docs.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {locker.docs.map((d) => (
            <li key={d.id} className="flex flex-col gap-0.5 border-t border-[var(--s-rule)] pt-2 text-[13.5px]">
              <span>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-[var(--s-ink)] underline decoration-[var(--s-rule)]">
                    {d.title}
                  </a>
                ) : (
                  d.title
                )}
                {d.version > 1 ? <span className="ml-1.5 rounded-full bg-[var(--s-tag)] px-1.5 text-[11.5px] text-[var(--s-tag-ink)]">v{d.version}</span> : null}
                {!d.shared ? <span className="ml-1.5 rounded-full bg-[var(--s-warn-wash)] px-1.5 text-[11.5px] text-[var(--s-warn)]">Draft · only your team</span> : null}
              </span>
              <span className={muted}>
                {d.kindLabel} · {d.meta}
                {d.automatic ? ' · filed automatically' : ''}
              </span>
              {locker.canUpload && !d.automatic ? (
                d.shared ? (
                  <UploadDocument projectId={projectId} customer={customer} replaces={{ id: d.id, title: d.title }} />
                ) : (
                  <DraftActions projectId={projectId} documentId={d.id} customer={customer} />
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`m-0 ${muted}`}>Nothing filed yet.</p>
      )}

      {locker.canUpload ? <UploadDocument projectId={projectId} customer={customer} /> : null}

      {locker.materials.length ? (
        <details className="border-t border-[var(--s-rule)] pt-2">
          <summary className="cursor-pointer text-[13.5px] font-medium">
            What the home is made of <span className={muted}>· {ordered} of {locker.materials.length} ordered</span>
          </summary>
          <p className={`m-0 mt-1 ${muted}`}>Add the product code when you order: {customer} keeps it for spares and repairs.</p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {locker.materials.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 border-t border-[var(--s-rule-soft)] pt-2 text-[13px]">
                <span>
                  <span className="font-medium">{m.item}</span> <span className={muted}>· {m.room}</span>
                  {m.spec ? <span className={`block ${muted}`}>{m.spec}</span> : null}
                </span>
                {locker.canUpload ? (
                  <MaterialCode projectId={projectId} materialId={m.id} code={m.productCode} ordered={m.ordered} />
                ) : m.productCode ? (
                  <span className={muted}>Code {m.productCode}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
