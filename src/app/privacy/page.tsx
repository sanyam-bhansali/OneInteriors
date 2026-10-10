import type { Metadata } from 'next';
import Link from 'next/link';
import { AppFooter, AppHeader } from '@/components/oi/Chrome';
import { Chapter, Sheet, Wrap } from '@/components/oi';
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

/**
 * One part of the notice, as a card in the customer side's format (owner,
 * 10 Oct 2026: "change this entire page in our format"). Numbered, so a
 * person who writes in can say "point 05" and both sides mean the same thing.
 */
function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const id = `p${String(n).padStart(2, '0')}`;
  return (
    <Sheet as="section" className="rounded-[18px] px-5 py-6 sm:px-8 sm:py-8">
      <div id={id} className="scroll-mt-24 grid gap-4 sm:grid-cols-[64px_1fr] sm:gap-6">
        <p className="oi-num m-0 text-[12px] tracking-[0.16em] text-[var(--acc-ink)]">{String(n).padStart(2, '0')}</p>
        <div className="min-w-0">
          <h2 className="oi-display m-0 mb-4 text-[clamp(1.35rem,1.05rem+1vw,1.75rem)] text-[var(--ink)]">{title}</h2>
          <div className="flex max-w-[64ch] flex-col gap-3 text-[15.5px] leading-[1.7] text-[var(--ink2)] [&_a]:text-[var(--ink)] [&_a]:underline [&_li]:mb-2 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-[var(--ink)] [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-[var(--acc)]">
            {children}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

const SECTIONS = [
  'What we collect',
  'Why we use it',
  'Who sees it',
  'How long we keep it',
  'What you can ask us',
  'Children',
  'When this changes',
] as const;

export default function PrivacyPage() {
  return (
    <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
      <AppHeader />

      <Wrap className="py-12">
        <Chapter
          eyebrow={`Privacy · version ${POLICY_VERSION}`}
          title="What we keep about you, and why."
          aside={
            <p className="oi-num m-0 whitespace-nowrap text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink2)]">
              Updated {PRIVACY.updated}
            </p>
          }
        >
          One Interiors matches homeowners in Pune with interior design studios. To do that we
          need some information about you and your home. This page says what, why, who sees it,
          and what you can ask us to do — in plain words, under India&rsquo;s Digital Personal
          Data Protection Act, 2023.
        </Chapter>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
          <nav aria-label="On this page" className="hidden lg:block">
            <ol className="sticky top-24 m-0 flex list-none flex-col gap-1 p-0">
              {SECTIONS.map((title, i) => (
                <li key={title}>
                  <a
                    href={`#p${String(i + 1).padStart(2, '0')}`}
                    className="flex items-baseline gap-3 rounded-full px-3 py-1.5 text-[13.5px] text-[var(--ink2)] no-underline hover:bg-[var(--card)] hover:text-[var(--ink)]"
                  >
                    <span className="oi-num text-[11px] text-[var(--acc-ink)]">{String(i + 1).padStart(2, '0')}</span>
                    {title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <main className="flex min-w-0 flex-col gap-4">
        <Section n={1} title={SECTIONS[0]}>
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
              <strong>A floor plan</strong>, only if you upload one — kept privately, and read
              for its sizes (below). If you confirm those sizes and told us your society, the
              sizes alone — never the file or your name — are kept for your building, and offered
              to the next family there once two or more homes have shared theirs.
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

        <Section n={2} title={SECTIONS[1]}>
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

        <Section n={3} title={SECTIONS[2]}>
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
              Anthropic — writes the short explanation beside each match and the plain-words
              comparison of your quotes, reads the sizes off a floor plan if you upload one, and
              tells you the styles in a room photo if you share one (the photo is read once and
              not kept). It receives your brief&rsquo;s answers, the quotes, the studio&rsquo;s
              record, the plan or the photo — never your name or number.
            </li>
            <li>Google, Apple or Facebook — only if you choose to sign in with one of them.</li>
          </ul>
        </Section>

        <Section n={4} title={SECTIONS[3]}>
          <p className="m-0">
            Your brief and contact details for as long as you are using One Interiors, and for{' '}
            {PRIVACY.retentionMonths} months after your last activity — unless you ask us to delete
            them sooner. We keep the record of what you agreed to, and when, for longer: it is how we
            show we asked properly.
          </p>
        </Section>

        <Section n={5} title={SECTIONS[4]}>
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

        <Section n={6} title={SECTIONS[5]}>
          <p className="m-0">
            One Interiors is for adults planning work on their home. We do not knowingly collect
            information about anyone under 18, beyond the number of children in a household that you
            choose to tell us.
          </p>
        </Section>

        <Section n={7} title={SECTIONS[6]}>
          <p className="m-0">
            This page has a version number, and every agreement you give is recorded against the
            version you saw. If we change how we use your information in a way that matters, we ask
            you again rather than assume your earlier agreement covers it.
          </p>
        </Section>
          </main>
        </div>
      </Wrap>

      <AppFooter />
    </div>
  );
}
