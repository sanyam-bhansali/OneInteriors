import type { Metadata } from 'next';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { TIER_CHECKS } from '@/modules/studio/types';
import { ApplyForm } from './ApplyForm';

export const metadata: Metadata = {
  title: 'Apply to join',
  description:
    'We work with a small, closed roster of interior studios in Pune. Apply, and we will verify and reply within a week.',
  robots: { index: false, follow: false },
};

const TOTAL_CHECKS = TIER_CHECKS.LISTED.length + TIER_CHECKS.VERIFIED.length;

export default function ApplyPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-rule)]">
          <div className="grid-ground grid-ground-fade absolute inset-0" aria-hidden="true" />
          <Container size="wide" className="relative">
            <div className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-16">
              <div>
                <Eyebrow>For interior studios · Pune</Eyebrow>
                <h1 className="display mb-6 max-w-[16ch]">
                  We keep the roster{' '}
                  <span className="text-[var(--color-petrol)]">small on purpose</span>.
                </h1>
                <p className="lede mb-5">
                  Customers come to us because there are eight studios on this site, not eight
                  hundred. That only works if getting on it means something — so every studio is
                  checked before it appears, and the delivery record is published afterwards.
                </p>
                <p className="m-0 max-w-[46ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
                  If that sounds like the wrong trade for you, it probably is. If it sounds like
                  the market you already compete in on merit, we&rsquo;d like to talk.
                </p>
              </div>

              <div className="rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6">
                <p className="label m-0 mb-4">What happens next</p>
                <ol className="m-0 flex list-none flex-col gap-4 p-0">
                  <Step n="01" title="You apply" body="Ten minutes. Nothing you send here is published." />
                  <Step n="02" title="We reply within a week" body="Either way, with a reason. A call before any decision." />
                  <Step
                    n="03"
                    title="We verify"
                    body={`${TOTAL_CHECKS} checks — identity, GST filing history, references we call, and two completed sites we visit.`}
                  />
                  <Step n="04" title="You build your profile" body="Your work, your words, your rates. We help you shape it." />
                  <Step n="05" title="You go live" body="Matched to customers whose brief actually fits what you do." />
                </ol>
              </div>
            </div>
          </Container>
        </section>

        <section className="border-b border-[var(--color-rule)] py-10">
          <Container size="wide">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Honest
                title="No commission on your existing clients"
                body="We charge on work we bring you, and only when it closes. What you already have is yours."
              />
              <Honest
                title="We publish the bad numbers too"
                body="Average days past your committed date, and any upheld dispute. That cuts both ways — it is also why being on the list is worth something."
              />
              <Honest
                title="We do not hold your money"
                body="The customer pays you directly against a milestone schedule we set and verify. Escrow comes later, and we will tell you before it does."
              />
            </div>
          </Container>
        </section>

        <section className="py-12 sm:py-16">
          <Container size="narrow">
            <ApplyForm />
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[30px_minmax(0,1fr)] gap-3">
      <span className="tabular font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[var(--color-petrol)]">
        {n}
      </span>
      <div>
        <p className="m-0 text-[15px] font-bold leading-snug text-[var(--color-ink)]">{title}</p>
        <p className="m-0 text-[13.5px] leading-snug text-[var(--color-ink-2)]">{body}</p>
      </div>
    </li>
  );
}

function Honest({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t-2 border-[var(--color-petrol)] pt-4">
      <p className="h3 mb-1.5">{title}</p>
      <p className="m-0 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">{body}</p>
    </div>
  );
}
