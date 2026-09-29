import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { POLICY_VERSION } from '@/modules/consent/policy';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What One Interiors collects, why, who sees it, how long we keep it, and what you can ask us to do with it.',
};

/**
 * The privacy notice every consent row points at.
 *
 * ## Why it exists now
 *
 * `consent/policy.ts` has stamped consent rows with a policy version since
 * September, and there was no page at that version or any other — consent
 * recorded against a notice nobody could read. The brief now takes a name and
 * a mobile number, so the notice has to exist before that screen does.
 *
 * ## The rule for this page
 *
 * It describes what the product actually does today, service by service, and
 * nothing it might do later. When a feature starts sending data somewhere new
 * — reading a floor plan with an AI service, for one — this page changes in
 * the same commit, and `POLICY_VERSION` moves with it.
 *
 * The facts that are business decisions rather than code — the retention
 * period, the address for requests — are in `PRIVACY` below, in one place.
 * The text should be read by a lawyer before the customer side opens.
 */
const PRIVACY = {
  /** How long a brief and its contact details are kept after the last activity. */
  retentionMonths: 24,
  /** Where requests and complaints go. */
  contact: 'hello@oneinteriors.in',
  /** How quickly a request is answered. */
  responseDays: 30,
  updated: '29 September 2026',
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--color-rule)] py-9">
      <Container size="narrow">
        <h2 className="h2 mb-4">{title}</h2>
        <div className="flex flex-col gap-3 text-[16px] leading-relaxed text-[var(--color-ink-2)] [&_li]:mb-2 [&_ul]:m-0 [&_ul]:pl-5">
          {children}
        </div>
      </Container>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="border-b border-[var(--color-rule)] py-10 sm:py-14">
          <Container size="narrow">
            <p className="m-0 mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
              Privacy · version {POLICY_VERSION} · updated {PRIVACY.updated}
            </p>
            <h1 className="display mb-5 max-w-[18ch]">What we keep about you, and why.</h1>
            <p className="m-0 text-[17px] leading-relaxed text-[var(--color-ink-2)]">
              One Interiors matches homeowners in Pune with interior design studios. To do that we
              need some information about you and your home. This page says what, why, who sees it,
              and what you can ask us to do — in plain words, under India&rsquo;s Digital Personal
              Data Protection Act, 2023.
            </p>
          </Container>
        </section>

        <Section title="What we collect">
          <ul>
            <li>
              <strong>Your brief</strong> — your home, where it is, possession, the work you want,
              your budget level, the styles you like and rule out, who lives there, what the home
              needs, how you like to work and your priorities.
            </li>
            <li>
              <strong>Your name, mobile number and, if you give it, email</strong> — on the last
              screen of the brief, once you agree to this notice. Your name stays on your own
              device until then.
            </li>
            <li>
              <strong>Your account</strong>, if you sign in — the email address or mobile number you
              sign in with, and, if you use Google, the name and email Google shares with us.
            </li>
            <li>
              <strong>What you do on the quotes</strong> — the quotes built for you, the studios you
              compare and the lines you star.
            </li>
            <li>
              <strong>A floor plan</strong>, only if you upload one.
            </li>
            <li>
              <strong>Technical details</strong> — a cookie that keeps you signed in, a cookie that
              lets your brief survive a reload before you have an account, and a scrambled (hashed)
              form of your connection&rsquo;s address, kept briefly to stop abuse. We record which
              screens of the brief are completed, without your name or number, to find where it is
              hard to use.
            </li>
          </ul>
        </Section>

        <Section title="Why we use it">
          <ul>
            <li>To rank studios for your home and explain why each one appears.</li>
            <li>To price each studio&rsquo;s first quote for your home.</li>
            <li>To reach you about your matches and to arrange your call with our expert.</li>
            <li>To introduce you to a studio — only one you have chosen.</li>
            <li>To keep the service working and safe from misuse.</li>
            <li>
              To send you updates on WhatsApp or by email, <strong>only if you tick that
              separately</strong>. Saying no never changes the matches you see.
            </li>
          </ul>
        </Section>

        <Section title="Who sees it">
          <p className="m-0">
            <strong>Studios see your brief and your contact details only when you choose them</strong>{' '}
            — when you ask our expert to introduce you. No studio pays to see anyone&rsquo;s
            details, and we do not sell your information to anyone.
          </p>
          <p className="m-0">These services handle it on our behalf, under contract, to run the product:</p>
          <ul>
            <li>Supabase — our database and file storage, in Mumbai.</li>
            <li>Vercel — hosting, in Mumbai.</li>
            <li>Resend — to deliver the emails we send you.</li>
            <li>Meta — WhatsApp messages, if you sign in or get updates that way.</li>
            <li>
              Anthropic — writes the short explanation beside each match. It receives your brief&rsquo;s
              answers and the studio&rsquo;s record, never your name or number.
            </li>
            <li>Google — only if you choose to sign in with Google.</li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <p className="m-0">
            Your brief and contact details for as long as you are using One Interiors, and for{' '}
            {PRIVACY.retentionMonths} months after your last activity — unless you ask us to delete
            them sooner. We keep the record of what you agreed to, and when, for longer: it is how we
            show we asked properly.
          </p>
        </Section>

        <Section title="What you can ask us">
          <ul>
            <li>To see the information we hold about you.</li>
            <li>To correct it, or to delete it.</li>
            <li>
              To withdraw your agreement at any time — from{' '}
              <Link href="/account">your account</Link>, or by writing to us. It is as easy to
              withdraw as it was to give, and it stops what it covered from then on.
            </li>
            <li>To name someone who can act for you if you cannot.</li>
            <li>
              To complain. Write to us first; if we do not resolve it, you can go to the Data
              Protection Board of India.
            </li>
          </ul>
          <p className="m-0">
            Write to <a href={`mailto:${PRIVACY.contact}`}>{PRIVACY.contact}</a>. We answer within{' '}
            {PRIVACY.responseDays} days.
          </p>
        </Section>

        <Section title="Children">
          <p className="m-0">
            One Interiors is for adults planning work on their home. We do not knowingly collect
            information about anyone under 18, beyond the number of children in a household that you
            choose to tell us.
          </p>
        </Section>

        <Section title="When this changes">
          <p className="m-0">
            This page has a version number, and every agreement you give is recorded against the
            version you saw. If we change how we use your information in a way that matters, we ask
            you again rather than assume your earlier agreement covers it.
          </p>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
