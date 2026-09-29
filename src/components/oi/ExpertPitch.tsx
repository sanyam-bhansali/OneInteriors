import Link from 'next/link';
import { CallOffer } from './CallOffer';
import { showcase } from '@/modules/portal/benefits';
import { ARCHITECT } from '@/modules/consultation/architect';
import type { OfferState } from '@/modules/consultation/offer';

/**
 * The expert call, pitched where a customer is deciding whether to ring a
 * studio directly: after the matches, after a quote, on the comparison.
 *
 * Nothing is withheld to force it (the pilot stays open —
 * docs/FUTURE-REQUIREMENTS.md). It says what the call is, what it costs, and
 * what booking through us brings that going direct does not.
 */
export function ExpertPitch({
  offer,
  lead = 'Before you ring any studio',
  className = '',
}: {
  offer: OfferState;
  lead?: string;
  className?: string;
}) {
  return (
    <aside
      className={`rounded-[14px] border border-[var(--acc)] bg-[var(--card)] p-[clamp(20px,3vw,28px)] ${className}`}
      aria-label="Book your expert call"
    >
      <p className="oi-eyebrow m-0 mb-2">{lead}</p>
      <p className="m-0 mb-2 text-[18px] font-semibold leading-snug text-[var(--ink)]">
        Go through these with {ARCHITECT.name}, 30 minutes.
      </p>
      <p className="m-0 mb-3 max-w-[58ch] text-[14px] leading-[1.6] text-[var(--ink2)]">
        She reads your brief and every quote first, tells you where the studios really differ, and
        sets up the meeting with the one you choose. No studio pays her.
      </p>
      <CallOffer offer={offer} className="mb-4" />
      <BenefitChips />
      <Link
        href="/expert"
        className="oi-cta mt-5 inline-flex min-h-11 items-center px-5 py-3 text-[14px] no-underline"
      >
        Book your expert call
      </Link>
    </aside>
  );
}

/** "Through One Interiors: Up to ₹50,000 cashback · Free cab to the studio · …" */
export function BenefitChips({ limit, className = '' }: { limit?: number; className?: string }) {
  const items = showcase().slice(0, limit);
  return (
    <div className={className}>
      <p className="oi-label m-0 mb-2">Only when you book through us</p>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {items.map((b) => (
          <li
            key={b.id}
            title={b.terms}
            className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12.5px] text-[var(--ink)]"
          >
            {b.short}
          </li>
        ))}
      </ul>
    </div>
  );
}
