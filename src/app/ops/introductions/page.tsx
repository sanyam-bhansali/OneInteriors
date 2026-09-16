import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { OpsHeader } from '../ui';
import { listIntroductions, NEED_LABEL } from '@/modules/studio/introduction-ops';
import { IntroductionCard } from './IntroductionCard';

export const metadata: Metadata = {
  title: 'Introductions · Ops',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * After the call.
 *
 * ## Why this page exists
 *
 * The introduction is the single event this business charges a fee for, and
 * until now nothing on the ops surface could see one. `createIntroduction` was
 * called from the call form and the row was never read again;
 * `withdrawIntroduction` and `releaseContactDetails` had no caller anywhere.
 * From the moment of the handoff, ops was blind and the studio held every
 * control — including the ones the module comments say belong to us.
 *
 * ## The order
 *
 * Waiting-on-us first, then everything live, then the closed ones folded away.
 * Not newest-first: a queue sorted by recency is a queue where the oldest
 * problem is the last one anybody sees, which is the wrong way round for a
 * customer who has been waiting a fortnight for a meeting nobody arranged.
 */
export default async function IntroductionsPage() {
  const all = await listIntroductions();

  const needsUs = all.filter((i) => i.needs !== null);
  const running = all.filter((i) => i.needs === null && !i.withdrawnAt);
  const closed = all.filter((i) => i.withdrawnAt);

  return (
    <>
      <OpsHeader />
      <main className="py-10">
        <Container size="wide">
          <p className="label m-0 mb-2">Introductions</p>
          <h1 className="h1 mb-3">
            {all.length === 0
              ? 'Nobody has been introduced yet.'
              : needsUs.length === 0
                ? `${all.length} introduced, nothing waiting on us.`
                : `${needsUs.length} waiting on us.`}
          </h1>
          <p className="m-0 mb-10 max-w-[64ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            Every customer we have handed to a studio, and what has happened since. The product
            promises four times over that we set up the meeting or site visit — this is where that
            is done, and the only place a contact release or a withdrawal can be recorded.
          </p>

          {all.length === 0 ? (
            <p className="m-0 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-6 py-8 text-[15px] italic leading-relaxed text-[var(--color-ink-3)]">
              Introductions are made at the end of an expert call, on{' '}
              <Link href="/ops/consultations" className="not-italic text-[var(--color-petrol)]">
                Calls
              </Link>
              . Nothing else in the product can create one, which is the whole quality mechanic.
            </p>
          ) : null}

          {needsUs.length > 0 ? (
            <section className="mb-12">
              <h2 className="m-0 mb-1 font-[family-name:var(--font-display)] text-[22px] leading-tight">
                Waiting on us
              </h2>
              <p className="m-0 mb-4 max-w-[60ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
                A meeting nobody arranged, a time nobody confirmed, or a meeting that has passed
                with nobody saying how it went. We do not guess at any of the three.
              </p>
              {/* The reason goes INSIDE the card's own list item rather than in
                  a wrapping div — a <div> between <ul> and <li> is invalid
                  nesting that React complains about in development. */}
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {needsUs.map((intro) => (
                  <IntroductionCard
                    key={intro.id}
                    intro={intro}
                    need={intro.needs ? NEED_LABEL[intro.needs] : null}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Two columns, where "waiting on us" above is one.
              The queue that needs acting on gets the full width because it is
              what the page is for; the ones already running are a reference
              list, and at 1280px a single column of them is a lot of screen
              spent on rows nobody has to do anything about. */}
          {running.length > 0 ? (
            <section className="mb-12">
              <h2 className="m-0 mb-4 font-[family-name:var(--font-display)] text-[22px] leading-tight">
                Running
              </h2>
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 xl:grid-cols-2">
                {running.map((intro) => (
                  <IntroductionCard key={intro.id} intro={intro} />
                ))}
              </ul>
            </section>
          ) : null}

          {closed.length > 0 ? (
            <details>
              <summary className="mb-4 cursor-pointer select-none text-[14.5px] font-medium text-[var(--color-ink-2)]">
                Withdrawn ({closed.length})
              </summary>
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 xl:grid-cols-2">
                {closed.map((intro) => (
                  <IntroductionCard key={intro.id} intro={intro} />
                ))}
              </ul>
            </details>
          ) : null}
        </Container>
      </main>
    </>
  );
}
