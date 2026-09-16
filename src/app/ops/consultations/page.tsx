import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, Pill } from '@/components/ui';
import { OpsHeader } from '../ui';
import { listConsultations } from '@/modules/consultation/request';
import { introducedBriefIds } from '@/modules/studio/introduction-ops';
import { prisma } from '@/lib/prisma';
import { formatINRCompact } from '@/lib/money';
import { signedUrlFor } from '@/modules/storage/floor-plan';
import { prepForBrief } from '@/modules/prepare/prep';
import { CallOutcome } from './CallOutcome';
import { propertyLabel, scopeLabel, PUNE_LOCALITIES, STYLE_LABELS } from '@/modules/brief/types';
import { fromDb } from '@/lib/money';
import type { StyleTag } from '@/modules/brief/types';

export const metadata: Metadata = { title: 'Expert calls', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The expert's queue.
 *
 * Every introduction runs through a call, so this page is the bottleneck of
 * the whole business — and the value of gating introductions is entirely
 * dependent on the expert having done the reading first. So this is a **prep
 * pack**, not a list of names: everything needed to walk into the call
 * informed is on the row, and the floor plan is one click away.
 */
export default async function ConsultationsPage() {
  const requests = await listConsultations();
  const open = requests.filter((r) => r.status === 'requested' || r.status === 'scheduled');
  const done = requests.filter((r) => r.status !== 'requested' && r.status !== 'scheduled');

  /**
   * Which completed calls actually produced an introduction.
   *
   * `recordOutcome` marks the consultation completed before the introduction is
   * attempted, and a completed consultation no longer renders the outcome form
   * — so a call where the handoff failed used to vanish into this list looking
   * identical to one that went perfectly. The customer had been told on the
   * phone that a studio would be in touch, and nothing in the product knew
   * otherwise.
   *
   * The time-parsing cases are now caught before anything is written. This
   * covers what cannot be: a studio paused between the expert opening the form
   * and submitting it.
   */
  const introduced = await introducedBriefIds(done.map((r) => r.briefId));

  return (
    <>
      <OpsHeader />
      <main className="py-8">
        <Container size="wide">
          <p className="label m-0 mb-2">Expert calls</p>
          <h1 className="h1 mb-8">{open.length} waiting</h1>

          {open.length === 0 ? (
            <p className="m-0 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-6 text-[15px] italic text-[var(--color-ink-3)]">
              Nothing waiting. Requests arrive from <code>/expert</code>, after a customer has
              compared their quotes.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-5 p-0">
              {await Promise.all(open.map((request) => PrepCard({ request })))}
            </ul>
          )}

          {done.length > 0 ? (
            <>
              <p className="label m-0 mb-3 mt-12">Done</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {done.map((r) => {
                  const stranded = r.status === 'completed' && !introduced.has(r.briefId);
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-rule-soft)] py-3"
                    >
                      <span className="text-[14.5px] text-[var(--color-ink)]">{r.contactName}</span>

                      {stranded ? (
                        <span className="flex flex-wrap items-baseline gap-3">
                          <span className="text-[13.5px] text-[var(--color-atrisk)]">
                            Call recorded, but no introduction was made.
                          </span>
                          <Link
                            href="/ops/allocation"
                            className="text-[13.5px] text-[var(--color-petrol)]"
                          >
                            Check the studio is live →
                          </Link>
                        </span>
                      ) : null}

                      <Pill tone={r.status === 'completed' ? 'ontrack' : 'neutral'}>{r.status}</Pill>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </Container>
      </main>
    </>
  );
}

async function PrepCard({
  request,
}: {
  request: Awaited<ReturnType<typeof listConsultations>>[number];
}) {
  const brief = await prisma.brief.findUnique({
    where: { id: request.briefId },
    select: {
      propertyType: true,
      carpetAreaSqft: true,
      locality: true,
      scope: true,
      budgetMinPaise: true,
      budgetMaxPaise: true,
      styleLikes: true,
      styleDislikes: true,
      involvement: true,
      moveInBy: true,
      floorPlanName: true,
      adults: true,
      children: true,
      elderly: true,
      pets: true,
    },
  });

  const planUrl = await signedUrlFor(request.briefId);
  const prep = await prepForBrief(request.briefId);

  return (
    <li key={request.id} className="rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="h3 m-0 mb-1">{request.contactName}</h2>
          <p className="m-0 font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-ink-2)]">
            {request.contactPhone}
            {request.contactEmail ? ` · ${request.contactEmail}` : ''}
          </p>
        </div>
        <div className="text-right">
          <Pill tone={request.status === 'scheduled' ? 'petrol' : 'neutral'}>{request.status}</Pill>
          {/* The booked time, rendered in IST. Writing `scheduledFor` and never
              showing it would leave ops exactly where they started — knowing a
              decision had been made and not what it was. */}
          {request.scheduledFor ? (
            <p className="m-0 mt-1.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-petrol)]">
              {new Intl.DateTimeFormat('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata',
              }).format(request.scheduledFor)}
            </p>
          ) : null}
          <p className="m-0 mt-1.5 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
            {waitingFor(request.createdAt)}
          </p>
        </div>
      </div>

      {/* What they actually asked. Read this first. */}
      {request.askedAbout ? (
        <p className="m-0 mb-5 max-w-[72ch] border-l-2 border-[var(--color-brass)] bg-[var(--color-paper)] px-4 py-3 text-[15px] leading-relaxed text-[var(--color-ink)]">
          &ldquo;{request.askedAbout}&rdquo;
        </p>
      ) : null}

      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Fact label="Home" value={propertyLabel(brief?.propertyType)} />
        <Fact label="Area" value={brief?.carpetAreaSqft ? `${brief.carpetAreaSqft} sqft` : null} />
        <Fact
          label="Where"
          value={PUNE_LOCALITIES.find((l) => l.slug === brief?.locality)?.label ?? brief?.locality ?? null}
        />
        <Fact label="Scope" value={scopeLabel(brief?.scope)} />
        <Fact
          label="Budget"
          value={
            brief?.budgetMinPaise && brief?.budgetMaxPaise
              ? `${formatINRCompact(fromDb(brief.budgetMinPaise))}–${formatINRCompact(fromDb(brief.budgetMaxPaise))}`
              : null
          }
        />
        <Fact
          label="Household"
          value={
            brief
              ? `${brief.adults ?? 0} adults, ${brief.children ?? 0} children${brief.pets ? ', pets' : ''}`
              : null
          }
        />
        <Fact label="Working style" value={brief?.involvement ?? null} />
        <Fact label="When" value={brief?.moveInBy ? brief.moveInBy.toLocaleDateString('en-IN') : null} />
      </dl>

      <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2">
        <span className="text-[13.5px] text-[var(--color-ink-2)]">
          <span className="label mr-2">Likes</span>
          {(brief?.styleLikes ?? []).map((t) => STYLE_LABELS[t as StyleTag] ?? t).join(', ') || '—'}
        </span>
        {/* The hard filter. Worth seeing before recommending anyone. */}
        <span className="text-[13.5px] text-[var(--color-atrisk)]">
          <span className="label mr-2">Rules out</span>
          {(brief?.styleDislikes ?? []).map((t) => STYLE_LABELS[t as StyleTag] ?? t).join(', ') || '—'}
        </span>
      </div>

      {/* The prep pack.
          This is the half of the card that did not come out of a dropdown —
          the customer sat down after booking and worked through their own
          rooms. A note here is the single most useful thing on the page for
          opening the call, so it gets room to breathe rather than a truncated
          cell in the grid above.

          Rooms they did not touch are absent, not shown as blanks. Nine empty
          rows would bury the two that matter, and an untouched room is not a
          failing — nothing in this pack is required. */}
      {prep.length > 0 ? (
        <div className="mb-5 rounded-[10px] border border-[var(--color-rule-soft)] bg-[var(--color-paper)] p-4">
          <p className="label m-0 mb-3">Prepared before the call</p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {prep.map((room) => (
              <li key={room.roomKey} className="text-[14px] leading-snug">
                <span className="mr-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.09em] text-[var(--color-ink-3)]">
                  {room.label}
                </span>
                <span className="text-[var(--color-ink-2)]">
                  {[room.styleLabel, room.choice].filter(Boolean).join(' · ') || '—'}
                </span>
                {/* What they put on the board. Above-band items are marked,
                    because the gap between what someone chose and what they
                    budgeted is the single most useful thing to know before
                    dialling — it is the conversation the call exists for. */}
                {room.board.length > 0 ? (
                  <span className="mt-1 block text-[13px] leading-snug text-[var(--color-ink-2)]">
                    {room.board.map((item, i) => (
                      <span key={`${item.label}-${i}`}>
                        {i > 0 ? ', ' : ''}
                        <span className={item.aboveBand ? 'text-[var(--color-brass)]' : ''}>
                          {item.label}
                        </span>
                      </span>
                    ))}
                  </span>
                ) : null}
                {room.budgetFlag ? (
                  <span className="mt-1 block text-[12.5px] leading-snug text-[var(--color-brass)]">
                    {room.budgetFlag}
                  </span>
                ) : null}
                {room.note ? (
                  <span className="mt-1 block max-w-[72ch] border-l-2 border-[var(--color-brass)] pl-3 text-[14.5px] text-[var(--color-ink)]">
                    &ldquo;{room.note}&rdquo;
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* The end of the call, in one form. Recording the outcome, making the
          introduction and booking the first meeting are three writes and one
          decision — split across three surfaces, the second two get forgotten,
          which is precisely why `recordOutcome` sat in the codebase for months
          with nothing calling it. */}
      {request.status !== 'completed' ? (
        <CallOutcome
          consultationId={request.id}
          briefId={request.briefId}
          status={request.status}
          studios={request.studioIds.map((id, i) => ({
            id,
            name: request.studioNames[i] ?? 'Unknown studio',
          }))}
        />
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[var(--color-rule)] pt-4">
        <span className="text-[14.5px] text-[var(--color-ink-2)]">
          <span className="label mr-2">Wants to discuss</span>
          {request.studioNames.join(' · ')}
        </span>
        {planUrl ? (
          <a
            href={planUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-petrol)]"
          >
            Floor plan ↗
          </a>
        ) : brief?.floorPlanName ? (
          <span className="text-[13px] italic text-[var(--color-ink-3)]">
            Floor plan on file, storage not configured
          </span>
        ) : null}
        {request.preferredTimes ? (
          <span className="text-[13.5px] text-[var(--color-ink-3)]">
            Prefers {request.preferredTimes}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function waitingFor(since: Date): string {
  const hours = Math.floor((Date.now() - since.getTime()) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  return `${days}d waiting`;
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="label m-0">{label}</dt>
      <dd className="m-0 truncate text-[13.5px] text-[var(--color-ink)]">
        {value ?? <span className="text-[var(--color-ink-3)]">—</span>}
      </dd>
    </div>
  );
}
