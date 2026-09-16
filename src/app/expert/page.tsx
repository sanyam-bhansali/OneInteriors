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
import { showUnverifiedStudios } from '@/lib/env';
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
  const ranked = rankStudios(brief, studios, 9, {
    allowUnverified: showUnverifiedStudios(),
  }).slice(0, MAX_STUDIOS);
  const result = await quoteBrief(brief, ranked.map((r) => r.studioId));
  if (!result.ok) redirect('/quotes');

  /**
   * The minimum is what the roster can actually offer.
   *
   * On a roster of two, one studio with an incomplete rate card left exactly
   * one checkbox above a permanently greyed-out button asking for two picks.
   * The customer had no way to proceed and no way to know why. The server
   * computes the same figure independently in `requestConsultation` — this one
   * is only so the button is not lying about what it will accept.
   */
  const minStudios = Math.max(1, Math.min(MIN_STUDIOS, result.quotes.length));

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

          {/* Studios that were ranked for this brief and could not be priced.
              Named rather than dropped: a customer who sees two studios where
              they expected four should be told it is about rates and not about
              fit, and a studio absent for a reason we could state and did not
              is the sort of silence people notice later. */}
          {result.skipped.length > 0 ? (
            <div className="mb-8 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4">
              <p className="m-0 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
                {result.skipped.length === 1
                  ? `${result.skipped[0]!.name} suits this brief but has not published rates for all of this work yet, so we cannot put a number against their name — and a studio on this call without a quote would be one you could not compare.`
                  : `${result.skipped.length} studios that suit this brief have not published rates for all of this work yet. We have left them out rather than show you a name with no number against it.`}
              </p>
            </div>
          ) : null}

          {result.quotes.length === 1 ? (
            <div className="mb-8 rounded-[12px] border-l-[3px] border-[var(--color-brass)] bg-[var(--color-paper-2)] px-5 py-4">
              <p className="m-0 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--color-ink)]">
                There is one studio we can quote for this brief today, so this call is about whether
                they are right for you rather than about choosing between two. If the answer is no,
                we will say so — and we would rather tell you that than introduce you anyway.
              </p>
            </div>
          ) : null}

          <ExpertForm
            briefId={id}
            minStudios={minStudios}
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
