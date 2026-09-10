import Link from 'next/link';
import { Container, Button } from '@/components/ui';
import { ShortlistButton } from '@/components/Shortlist';
import { formatINR, formatINRCompact } from '@/lib/money';
import { loadBrief } from '@/modules/brief/repository';
import { getCurrentUser } from '@/modules/auth/session';
import { quoteBrief } from '@/modules/quotation/generate';
import { narrowing } from '@/modules/quotation/narrowing';
import { splitByWorkCode } from '@/modules/quotation/price';
import type { Studio } from '@/modules/studio/types';

/**
 * One studio's quote for this customer's home, on that studio's own page.
 *
 * ## Why it lives here and not only on /quotes
 *
 * The product's whole argument is that the same brief costs different amounts
 * at different studios, and that the difference is explainable. That argument
 * only lands when the number sits beside the studio's work and its verification
 * checks — a list of four quotes on a separate page invites price-sorting,
 * which is the one comparison we spend the rest of the site arguing against.
 *
 * ## Why the sign-in gate still holds
 *
 * Everything before the quote is anonymous, on purpose. This page does not
 * become the back door around that: signed out, the customer sees that a quote
 * exists and what it is built from, and is asked to sign in — the same gate
 * `/quotes` applies, in the same words.
 *
 * ## Why it refuses rather than estimates
 *
 * `quoteBrief` returns `ok: false` when this studio has no rate for work the
 * brief needs, and that is rendered as a plain sentence. There is no house
 * rate and no market fallback anywhere in the pricing code, so a studio that
 * has not entered rates cannot be made to quote — see `price.ts`.
 */
export async function StudioQuotation({ studio }: { studio: Studio }) {
  const { brief, found } = await loadBrief();

  // No brief at all: nothing to price, and nothing worth saying about it here.
  // The page's own CTA already invites them to start one.
  if (!found || !brief.completedAt) return null;

  const user = await getCurrentUser();

  if (!user) {
    return (
      <section className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-10">
        <Container>
          <p className="m-0 mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
            Their price for your home
          </p>
          <h2 className="h2 mb-3">
            {studio.tradeName} has priced your brief from their own rate card.
          </h2>
          <p className="m-0 mb-6 max-w-[58ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
            Sign in to see it, line by line, with everything we had to assume. It takes a phone
            number and a code — no password, and the numbers stay yours to come back to.
          </p>
          <Button href={`/sign-in?next=/studios/${studio.slug}&reason=quotes`} size="lg">
            See their quote
          </Button>
        </Container>
      </section>
    );
  }

  const result = await quoteBrief(brief, [studio.id]);
  const entry = result.ok ? result.quotes[0] : undefined;

  if (!entry) {
    const reason = result.ok
      ? result.skipped.find((s) => s.name === studio.tradeName)?.reason
      : null;

    return (
      <section className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-10">
        <Container>
          <p className="m-0 mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
            Their price for your home
          </p>
          <h2 className="h2 mb-3">{studio.tradeName} cannot quote this brief yet.</h2>
          <p className="m-0 max-w-[58ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
            {reason ??
              'They have not published rates for all of the work in your brief. That is our gap to close, not yours — we would rather show you nothing than a number they did not set.'}
          </p>
        </Container>
      </section>
    );
  }

  const { quote } = entry;
  const split = splitByWorkCode(quote);
  const n = narrowing({
    variancePct: quote.variancePct,
    propertyTypeKnown: brief.propertyType !== null,
    areaKnown: Boolean(brief.carpetAreaSqft && brief.carpetAreaSqft > 0),
    scopeKnown: brief.scope !== null,
    floorPlanUploaded: false,
  });

  return (
    <section className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-10">
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div>
            <p className="m-0 mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
              Their price for your home
            </p>
            <h2 className="h2 mb-3">
              {formatINRCompact(quote.lowPaise)} – {formatINRCompact(quote.highPaise)}
            </h2>
            <p className="m-0 mb-4 max-w-[58ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
              Built from your{' '}
              {brief.carpetAreaSqft ? `${brief.carpetAreaSqft} sqft` : 'home'} on{' '}
              <strong className="font-semibold">{studio.tradeName}&rsquo;s own rate card</strong>.
              Nobody has seen your flat, so this is a range — we do not narrow it to look
              confident.
            </p>

            <p className="m-0 mb-7 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              <span className="font-[family-name:var(--font-mono)]">{n.spread}</span>
              {n.action ? (
                <>
                  {' · '}
                  <Link href="/quiz" className="text-[var(--color-petrol)]">
                    {n.action}
                  </Link>
                </>
              ) : (
                ' · Only a site visit narrows this further.'
              )}
            </p>

            <details className="mb-7">
              <summary className="cursor-pointer font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-petrol)]">
                What we assumed ({quote.assumptions.length})
              </summary>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {quote.assumptions.map((a, i) => (
                  <li
                    key={i}
                    className="max-w-[62ch] border-l-2 border-[var(--color-rule)] pl-3 text-[13.5px] leading-snug text-[var(--color-ink-2)]"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </details>

            <div className="flex flex-wrap items-center gap-4">
              <ShortlistButton slug={studio.slug} name={studio.tradeName} />
              <Link
                href="/quotes"
                className="text-[14px] text-[var(--color-petrol)] underline underline-offset-4"
              >
                See every studio&rsquo;s quote →
              </Link>
            </div>
          </div>

          {/* The line items, grouped the way a real quotation is. */}
          <div className="rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-6">
            <table className="w-full border-collapse text-[14px]">
              <tbody>
                {quote.lines.map((line) => (
                  <tr key={line.category} className="border-b border-[var(--color-rule-soft)]">
                    <td className="py-2.5 pr-3 text-[var(--color-ink-2)]">
                      {line.label}
                      <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-ink-3)]">
                        {line.quantity} {line.unit}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-[var(--color-ink)]">
                      {formatINR(line.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <QuoteTotals
              modularPaise={split.modularPaise}
              nonModularPaise={split.nonModularPaise}
              designFeePaise={quote.designFeePaise}
              gstPaise={quote.gstPaise}
              totalPaise={quote.totalPaise}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * The totals block.
 *
 * Every line here is a question a customer would otherwise have to ask, and the
 * modular / non-modular split is the one that explains most of the difference
 * between two studios' numbers — modular carpentry is where the rate cards
 * actually diverge, and it is where discounts land in this trade.
 */
export function QuoteTotals({
  modularPaise,
  nonModularPaise,
  designFeePaise,
  gstPaise,
  totalPaise,
}: {
  modularPaise: number;
  nonModularPaise: number;
  designFeePaise: number;
  gstPaise: number;
  totalPaise: number;
}) {
  return (
    <dl className="m-0 mt-5 border-t-2 border-[var(--color-ink)] pt-4">
      <Row label="Modular work" value={modularPaise} />
      <Row label="Everything else" value={nonModularPaise} />
      <Row label="Design fee" value={designFeePaise} />
      <Row label="GST at 18%" value={gstPaise} />
      <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-[var(--color-rule)] pt-3">
        <dt className="m-0 text-[15px] font-bold text-[var(--color-ink)]">Total</dt>
        <dd className="m-0 font-[family-name:var(--font-display)] text-[24px] leading-none text-[var(--color-petrol)]">
          {formatINR(totalPaise)}
        </dd>
      </div>
    </dl>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  if (value <= 0) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="m-0 text-[13.5px] text-[var(--color-ink-2)]">{label}</dt>
      <dd className="m-0 text-[13.5px] tabular-nums text-[var(--color-ink)]">{formatINR(value)}</dd>
    </div>
  );
}
