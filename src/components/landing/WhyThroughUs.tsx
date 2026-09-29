import { Wrap, Section, Eyebrow, Heading, Cta } from './parts';
import { CallOffer } from '@/components/oi/CallOffer';
import { showcase } from '@/modules/portal/benefits';
import { ARCHITECT } from '@/modules/consultation/architect';
import type { OfferState } from '@/modules/consultation/offer';

/**
 * Why book through us rather than ring a studio directly.
 *
 * The pilot keeps every studio's name and quote open (docs/FUTURE-REQUIREMENTS.md),
 * so what keeps a customer with us is here: what they get only through us,
 * in rupees where there are rupees, and the expert call that starts it.
 */
export function WhyThroughUs({ offer }: { offer: OfferState }) {
  const items = showcase();
  return (
    <Section id="why-us" className="border-y border-[var(--line)] bg-[var(--card)] py-16 sm:py-20">
      <Wrap>
        <Eyebrow>Why book through us</Eyebrow>
        <Heading className="max-w-[26ch]">The same studios, with more for you when you book through us.</Heading>
        <p className="m-0 mt-4 max-w-[60ch] text-[15.5px] leading-[1.6] text-[var(--ink2)]">
          Ring a studio directly and none of this comes with it.
        </p>

        <ul className="m-0 mt-10 grid list-none gap-x-8 gap-y-7 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((b) => (
            <li key={b.id} className="border-t border-[var(--line)] pt-4">
              <p className="m-0 mb-1.5 text-[16px] font-semibold leading-snug text-[var(--ink)]">{b.short}</p>
              <p className="m-0 text-[13.5px] leading-[1.55] text-[var(--ink2)]">{b.terms}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-10 gap-y-5 border-t border-[var(--line)] pt-8">
          <div>
            <p className="m-0 mb-2 text-[17px] font-semibold text-[var(--ink)]">
              It starts with a 30-minute call with {ARCHITECT.name}.
            </p>
            <CallOffer offer={offer} />
          </div>
          <Cta href="/expert">Book your expert call</Cta>
        </div>
      </Wrap>
    </Section>
  );
}
