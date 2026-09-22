import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHead, PageBody } from '../../StudioShell';
import { clientById } from '@/modules/studio-practice/clients';
import { timelineFor } from '@/modules/studio-practice/events';
import { SOURCE_LABELS } from '@/modules/studio-practice/vocabulary';
import { paiseToLakhs } from '@/lib/money';
import { Timeline } from './Timeline';
import { LogContact } from './LogContact';

export const metadata: Metadata = {
  title: 'Lead',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * One lead, and everything that has happened to it.
 *
 * ## Why this page exists now and did not before
 *
 * The board was the only view, so a lead was whatever fitted on a card.
 * Anything longer than a card — what was discussed, why it moved, who had it
 * before — either lived in the single overwritable `notes` box or nowhere.
 *
 * The question this page answers is the one a studio owner actually asks:
 * *"Kothari rang — where are we with her?"* That question needs a history,
 * not a form.
 *
 * ## Two columns, and the history is the wide one
 *
 * The facts are a short list that does not change; the history is the thing
 * being read. Putting the fields in the wide column and the timeline in a
 * sidebar — which is how most CRMs lay this out — optimises for the data
 * entry that happens once over the reading that happens weekly.
 */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await clientById(id);
  if (!client) notFound();

  const events = await timelineFor(id);

  return (
    <>
      <PageHead
        title={client.name}
        sub={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="rounded-full px-2 py-px text-[12px] font-medium"
              style={{ background: 'var(--s-rail-active)' }}
            >
              {client.stageName}
            </span>
            {client.fromMarketplace ? (
              <span className="s-label rounded-full bg-[var(--s-accent)]/12 px-1.5 py-px normal-case tracking-normal text-[var(--s-accent)]">
                From One Interiors
              </span>
            ) : null}
            <span>
              {client.assignedToName ? `${client.assignedToName} has this` : 'Nobody has taken this'}
            </span>
          </span>
        }
        action={
          <Link
            href="/studio/clients"
            className="rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium no-underline hover:border-[var(--s-ink-3)]"
          >
            Back to the board
          </Link>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* ── The history ── */}
          <div className="order-2 min-w-0 lg:order-1">
            <div className="mb-5">
              <LogContact clientId={client.id} lastContactedAt={client.lastContactedAt} />
            </div>

            <h2 className="m-0 mb-4 text-[15.5px] font-semibold">History</h2>
            <Timeline rows={events} />
          </div>

          {/* ── The facts ── */}
          <aside className="order-1 flex flex-col gap-5 lg:order-2">
            <Facts client={client} />
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Facts({ client }: { client: NonNullable<Awaited<ReturnType<typeof clientById>>> }) {
  /* Built as a list and then filtered, so a lead with three known facts shows
     three rows rather than nine with "—" in six of them. A panel of dashes
     teaches somebody to stop reading the panel. */
  const rows: { label: string; value: string | null }[] = [
    { label: 'Phone', value: client.phone },
    { label: 'Email', value: client.email },
    { label: 'Where', value: client.locality ?? client.society },
    { label: 'Property', value: client.config },
    {
      label: 'Carpet area',
      value: client.carpetSqft ? `${client.carpetSqft.toLocaleString('en-IN')} sqft` : null,
    },
    { label: 'Source', value: SOURCE_LABELS[client.source] ?? null },
    {
      label: 'Quoted',
      value: client.quotedPaise ? `₹${paiseToLakhs(client.quotedPaise).toFixed(1)}L` : null,
    },
    {
      label: 'Next',
      value: client.nextAction
        ? `${client.nextAction}${
            client.nextActionOn
              ? ` — ${client.nextActionOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
              : ''
          }`
        : null,
    },
  ];

  const known = rows.filter((r) => r.value !== null && r.value !== '');

  return (
    <>
      <section className="rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5">
        <h2 className="s-label m-0 mb-3 text-[var(--s-ink-3)]">Details</h2>
        <dl className="m-0 flex flex-col gap-2.5">
          {known.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3">
              <dt className="flex-none text-[12.5px] text-[var(--s-ink-3)]">{r.label}</dt>
              <dd className="m-0 min-w-0 text-right text-[13.5px]">
                {r.label === 'Phone' ? (
                  <a href={`tel:${r.value}`} className="no-underline hover:underline">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {client.notes ? (
        <section className="rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5">
          <h2 className="s-label m-0 mb-2 text-[var(--s-ink-3)]">Notes</h2>
          <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed">{client.notes}</p>
        </section>
      ) : null}
    </>
  );
}
