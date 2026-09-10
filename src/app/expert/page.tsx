import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { JourneyNav } from '@/components/JourneyNav';
import { BriefRescue } from '@/components/BriefRescue';
import { prisma } from '@/lib/prisma';
import { loadBrief, readAnonKey } from '@/modules/brief/repository';
import { getCurrentUser } from '@/modules/auth/session';
import { studioRepository } from '@/modules/studio/repository';
import { rankStudios } from '@/modules/matching/score';
import { quoteBrief } from '@/modules/quotation/generate';
import { MIN_STUDIOS, MAX_STUDIOS } from '@/modules/consultation/request';
import { TIER } from '@/modules/quotation/tiers';
import { PROPERTY_LABELS, PUNE_LOCALITIES, STYLE_LABELS } from '@/modules/brief/types';
import { ExpertForm } from './ExpertForm';

export const metadata: Metadata = {
  title: 'Talk to an expert',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ExpertPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/expert&reason=expert');

  // Both of these mean the same thing — the server has no brief for this
  // person — and neither is grounds for restarting them. The browser may still
  // hold it; let the client try to hand it over. See BriefRescue.
  const { brief, found } = await loadBrief();
  const id = found && brief.completedAt ? await briefId() : null;

  if (!id) {
    return (
      <>
        <SiteHeader />
        <JourneyNav reached={1} />
        <BriefRescue destination="the expert call" />
        <SiteFooter />
      </>
    );
  }

  const studios = await studioRepository.list({ activeOnly: true });
  const ranked = rankStudios(brief, studios).slice(0, MAX_STUDIOS);
  const result = await quoteBrief(brief, ranked.map((r) => r.studioId));
  if (!result.ok) redirect('/quotes');

  return (
    <>
      <SiteHeader />
      <JourneyNav />

      <main className="py-10 sm:py-14">
        <Container size="narrow">
          <Eyebrow>OneExpert</Eyebrow>
          <h1 className="display mb-5 max-w-[20ch] text-[clamp(2rem,4.5vw,3rem)] leading-[1.02]">
            One call, and then we introduce you.
          </h1>
          <p className="lede mb-4">
            Someone who has read your brief, your quotes and every studio&rsquo;s delivery record
            spends half an hour helping you choose. Then we set up the meeting or site visit with
            that studio ourselves.
          </p>
          <p className="m-0 mb-8 max-w-[58ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            This is the only way to reach a studio through us. It is slower than a contact button,
            and it is the reason people do not end up in a meeting with a studio that was never
            going to suit them.
          </p>

          {/* What the expert will already know, shown back to the customer.
              "Briefed, not a cold intro" is a claim; this is the evidence. It
              costs a paragraph and it is the difference between the call
              sounding like a sales callback and sounding like a consultation
              somebody prepared for. Everything in it is drawn from the brief —
              nothing here is aspirational. */}
          <div className="mb-10 rounded-[14px] border-l-[3px] border-[var(--color-brass)] bg-[var(--color-paper-2)] p-6">
            <p className="label m-0 mb-3">What they will have read before they ring</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              <BriefLine
                label="Your home"
                value={[
                  brief.propertyType ? propertyLabel(brief.propertyType) : null,
                  brief.carpetAreaSqft ? `${brief.carpetAreaSqft} sqft` : null,
                  localityLabel(brief.locality),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <BriefLine
                label="Level"
                value={brief.tier ? TIER[brief.tier].label : null}
              />
              <BriefLine
                label="Leaning"
                value={
                  brief.styleLikes.length
                    ? brief.styleLikes.map((t) => STYLE_LABELS[t]).join(', ')
                    : null
                }
              />
              <BriefLine
                label="Ruled out"
                value={
                  brief.styleDislikes.length
                    ? brief.styleDislikes.map((t) => STYLE_LABELS[t]).join(', ')
                    : null
                }
              />
              <BriefLine
                label="Quotes in hand"
                value={`${result.quotes.length} studios, priced from their own rates`}
              />
            </ul>
            <p className="m-0 mt-4 border-t border-[var(--color-rule)] pt-3 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              You will not be explaining your flat again.
            </p>
          </div>

          <ExpertForm
            briefId={id}
            minStudios={MIN_STUDIOS}
            maxStudios={MAX_STUDIOS}
            defaultName={user.name}
            defaultEmail={user.email}
            studios={result.quotes.map((q) => ({
              id: q.studioId,
              name: q.studioName,
              lowPaise: q.quote.lowPaise,
              highPaise: q.quote.highPaise,
            }))}
          />
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}

/** One line of the call brief. Absent facts are omitted, never guessed at. */
function BriefLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <li className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 text-[14.5px] leading-snug">
      <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
        {label}
      </span>
      <span className="text-[var(--color-ink)]">{value}</span>
    </li>
  );
}

function localityLabel(slug: string | null): string | null {
  if (!slug) return null;
  return PUNE_LOCALITIES.find((l) => l.slug === slug)?.label ?? null;
}

/**
 * Prisma's PropertyType enum carries values our own union does not, so an
 * unmapped value must render as nothing rather than as `undefined` — a defect
 * this codebase has already shipped once.
 */
function propertyLabel(type: keyof typeof PROPERTY_LABELS): string | null {
  return PROPERTY_LABELS[type] ?? null;
}

async function briefId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (row) return row.id;
  }
  const anonKey = await readAnonKey();
  if (!anonKey) return null;
  const row = await prisma.brief.findUnique({ where: { anonKey }, select: { id: true } });
  return row?.id ?? null;
}
