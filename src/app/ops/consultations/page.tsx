import type { Metadata } from 'next';
import { Container, Pill } from '@/components/ui';
import { OpsHeader } from '../ui';
import { listConsultations } from '@/modules/consultation/request';
import { prisma } from '@/lib/prisma';
import { formatINRCompact } from '@/lib/money';
import { signedUrlFor } from '@/modules/storage/floor-plan';
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
                {done.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-rule-soft)] py-3"
                  >
                    <span className="text-[14.5px] text-[var(--color-ink)]">{r.contactName}</span>
                    <Pill tone={r.status === 'completed' ? 'ontrack' : 'neutral'}>{r.status}</Pill>
                  </li>
                ))}
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

      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--color-rule)] pt-4">
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
