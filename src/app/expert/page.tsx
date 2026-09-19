import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { Wrap, Chapter, Sheet, Established, Flag, Tick } from '@/components/oi';
import { BriefRescue } from '@/components/BriefRescue';
import { prisma } from '@/lib/prisma';
import { loadBrief, readAnonKey } from '@/modules/brief/repository';
import { getCurrentUser } from '@/modules/auth/session';
import { studioRepository } from '@/modules/studio/repository';
import { rankStudios } from '@/modules/matching/score';
import { showUnverifiedStudios } from '@/lib/env';
import { quoteBrief } from '@/modules/quotation/generate';
import { MIN_STUDIOS, MAX_STUDIOS } from '@/modules/consultation/request';
import { ARCHITECT, ARCHITECT_IS_REAL, architectFacts } from '@/modules/consultation/architect';
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
      <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
        <AppHeader />
        <Spine at="expert" />
        <BriefRescue destination="the expert call" />
        <AppFooter />
      </div>
    );
  }

  const studios = await studioRepository.list({ activeOnly: true });
  const ranked = rankStudios(brief, studios, 9, {
    allowUnverified: showUnverifiedStudios(),
  }).slice(0, MAX_STUDIOS);
  const result = await quoteBrief(brief, ranked.map((r) => r.studioId));
  if (!result.ok) redirect('/match');

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

  const facts = [
    brief.propertyType ? { label: 'Home', value: propertyLabel(brief.propertyType) ?? '—' } : null,
    brief.carpetAreaSqft ? { label: 'Carpet', value: `${brief.carpetAreaSqft} sqft` } : null,
    localityLabel(brief.locality) ? { label: 'Where', value: localityLabel(brief.locality)! } : null,
    brief.tier ? { label: 'Level', value: TIER[brief.tier].label } : null,
    { label: 'Quotes', value: String(result.quotes.length) },
  ].filter((f): f is { label: string; value: string } => f !== null);

  return (
    <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Spine
        at="expert"
        facts={[
          { id: 'quote', fact: `${result.quotes.length} priced` },
          { id: 'expert', fact: 'Reading it with you' },
        ]}
      />

      <Wrap className="py-12">
        <Chapter
          eyebrow="Your architect"
          title="One call, and then we introduce you."
          aside={
            <p className="oi-num m-0 whitespace-nowrap text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink2)]">
              No studio pays them
            </p>
          }
        >
          Someone who has read your brief, your quotes and every studio&rsquo;s delivery record
          spends half an hour helping you choose. Then we set up the meeting or site visit with that
          studio ourselves. It is slower than a contact button, and it is the reason people do not
          end up in a meeting with a studio that was never going to suit them.
        </Chapter>

        {/* ── Who is actually going to ring ──
            Everything else in this product is specific — a quantity on every
            line, a named studio behind every quote. Asking for a phone number
            on behalf of "an expert" was the one place we sounded like a sales
            queue. */}
        <div className="oi-pane mb-10 p-[clamp(22px,3vw,32px)]">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <div>
              <p className="oi-eyebrow m-0 mb-2">Who will ring you</p>
              <h2 className="oi-display m-0 text-[clamp(1.4rem,1.15rem+1vw,1.85rem)]">
                {ARCHITECT.name}
              </h2>
              <p className="m-0 mt-1.5 text-[14px] text-[var(--ink2)]">
                {ARCHITECT.role} · {ARCHITECT.credential}
              </p>
            </div>
          </div>

          <p className="m-0 mb-6 max-w-[60ch] text-[15px] leading-[1.65] text-[var(--ink)]">
            &ldquo;{ARCHITECT.says}&rdquo;
          </p>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[var(--line)] pt-5">
            {architectFacts().map((f) => (
              <p key={f.label} className="m-0 flex items-baseline gap-2">
                <span className="oi-label m-0">{f.label}</span>
                <span className="oi-num text-[13px]">{f.value}</span>
              </p>
            ))}
          </div>

          {/* Honest failure mode for unfinished content is a visible label, not
              a plausible-looking fiction — the same rule the stock photography
              and the placeholder films follow. */}
          {!ARCHITECT_IS_REAL ? (
            <p className="m-0 mt-5">
              <Flag>
                Pre-launch placeholder — a named architect and their real record go here before
                anybody is asked for a phone number
              </Flag>
            </p>
          ) : null}
        </div>

        {/* What they will already have read. "Briefed, not a cold intro" is a
            claim; this is the evidence, and everything in it is drawn from the
            brief — nothing here is aspirational. */}
        <div className="mb-10">
          <p className="oi-label m-0 mb-3">What {firstName(ARCHITECT.name)} reads before ringing</p>
          <Established facts={facts} />
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
            <Read label="Your brief, in full — including what you ruled out" />
            <Read
              label={
                brief.styleLikes.length || brief.styleDislikes.length
                  ? [
                      brief.styleLikes.length
                        ? `Leaning ${brief.styleLikes.map((t) => STYLE_LABELS[t]).join(', ')}`
                        : null,
                      brief.styleDislikes.length
                        ? `ruled out ${brief.styleDislikes.map((t) => STYLE_LABELS[t]).join(', ')}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Your style answers'
              }
            />
            <Read label={`All ${result.quotes.length} quotes, line by line, with the materials`} />
            <Read label="Every studio's verification standing and delivery record" />
          </ul>
          <p className="m-0 mt-4 max-w-[58ch] text-[13.5px] leading-[1.6] text-[var(--ink2)]">
            You will not be explaining your flat again.
          </p>
        </div>

        {/* Studios that were ranked for this brief and could not be priced.
            Named rather than dropped: a customer who sees two studios where
            they expected four should be told it is about rates and not about
            fit, and a studio absent for a reason we could state and did not is
            the sort of silence people notice later. */}
        {result.skipped.length > 0 ? (
          <Sheet className="mb-8 px-5 py-4">
            <p className="m-0 max-w-[58ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
              {result.skipped.length === 1
                ? `${result.skipped[0]!.name} suits this brief but has not published rates for all of this work yet, so we cannot put a number against their name — and a studio on this call without a quote would be one you could not compare.`
                : `${result.skipped.length} studios that suit this brief have not published rates for all of this work yet. We have left them out rather than show you a name with no number against it.`}
            </p>
          </Sheet>
        ) : null}

        {result.quotes.length === 1 ? (
          <Sheet className="mb-8 px-5 py-4">
            <p className="m-0 max-w-[58ch] text-[14.5px] leading-[1.6]">
              There is one studio we can quote for this brief today, so this call is about whether
              they are right for you rather than about choosing between two. If the answer is no, we
              will say so — and we would rather tell you that than introduce you anyway.
            </p>
          </Sheet>
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
      </Wrap>

      <AppFooter />
    </div>
  );
}

/** One thing already read. Sage tick — this is verification, not an action. */
function Read({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-snug">
      <span className="flex h-[21px] flex-none items-center">
        <Tick style={{ color: 'var(--sec)' }} />
      </span>
      <span>{label}</span>
    </li>
  );
}

function firstName(full: string): string {
  return full.split(' ')[0] ?? full;
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
