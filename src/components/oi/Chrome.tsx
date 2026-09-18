/**
 * The frame every customer screen sits in, and the spine that runs down it.
 *
 * ## Why the nav is a spine and not a progress bar
 *
 * `JourneyNav` used to render "Matches · Quotes · Compare · Talk to us" with
 * a `reached` number, which is a progress bar wearing words. Two things are
 * wrong with that, and both cost trust rather than usability:
 *
 * 1. **It counts steps, not facts.** "Step 3 of 5" tells somebody how much of
 *    our process they have endured. "2 BHK · Baner · ₹14.4–25.6 L · 6 studios
 *    match" tells them what they now know that they did not know this morning.
 *    The second is the product; the first is the packaging.
 *
 * 2. **It implies the end is the point.** A funnel wants you at the bottom.
 *    This product's position is that you can stop at any point and keep what
 *    you have got — the quiz needs no signup, the quotes cost nothing, nobody
 *    is phoned. A bar filling towards a goal quietly contradicts that.
 *
 * So the spine lists the chapters that are *established*, each with the fact
 * that establishes it. An unreached chapter is visible but unlit, in the same
 * way the fifteen checks are on the landing page — you can see what is coming,
 * and nothing is hidden to manufacture curiosity.
 */

import Link from 'next/link';
import { Mark } from '@/components/brand';
import { rosterIsReal } from '@/lib/env';
import { Wrap } from '@/components/landing/parts';

/**
 * The chapters of the document, in the order they are written.
 *
 * `id` is what a chapter IS; `href` is where it lives. They are separate
 * because the quote has no route of its own — it renders inside the profile of
 * whichever studio produced it, and `/match` is where every one of them is
 * reachable from. Keying the spine on `href` instead would light "Who fits"
 * and "The quote" together and hand React two identical keys.
 */
export const CHAPTERS = [
  { id: 'brief', href: '/quiz', name: 'Your brief' },
  { id: 'match', href: '/match', name: 'Who fits' },
  { id: 'quote', href: '/match', name: 'The quote' },
  { id: 'compare', href: '/compare', name: 'Side by side' },
  { id: 'expert', href: '/expert', name: 'Your architect' },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]['id'];

/**
 * The header.
 *
 * Deliberately thin and Alabaster rather than the landing page's transparent
 * overlay: there is no photograph underneath here, and a customer reading a
 * quote does not need the brand asserting itself above it.
 */
export function AppHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)]">
      <Wrap>
        <div className="flex items-center justify-between gap-6 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2.5 no-underline"
            aria-label="One Interiors, home"
          >
            <Mark className="h-[18px] w-[18px] text-[var(--ink)]" />
            <span className="oi-display text-[17px] leading-none text-[var(--ink)]">
              One Interiors
            </span>
          </Link>

          <nav className="flex items-center gap-5">
            <Link
              href="/studios"
              className="hidden text-[13.5px] text-[var(--ink2)] no-underline hover:text-[var(--ink)] sm:inline"
            >
              Studios
            </Link>
            <Link
              href="/verification"
              className="hidden text-[13.5px] text-[var(--ink2)] no-underline hover:text-[var(--ink)] sm:inline"
            >
              How we verify
            </Link>
            {/* Not a terracotta button. The one high-intent action belongs to
                the screen the customer is on — a second one up here competes
                with it, and on the quote screen it would be competing with
                the thing they came to do. */}
            <Link
              href="/account"
              className="border-b border-[var(--line)] pb-0.5 text-[13.5px] text-[var(--ink)] no-underline transition-colors hover:border-[var(--ink)]"
            >
              Your project
            </Link>
          </nav>
        </div>
      </Wrap>
    </header>
  );
}

export interface SpineFact {
  /** Which chapter this fact belongs to. */
  id: ChapterId;
  /** What is now known. "2 BHK · Baner", "6 still match", "₹18.4 L". */
  fact: string;
}

/**
 * The spine.
 *
 * `facts` says which chapters are written and what each one established.
 * Anything not in it renders unlit and unlinked — visible, so the shape of
 * the whole is legible from the first screen, but not pretending to be
 * reachable before it is.
 */
export function Spine({
  at,
  facts = [],
}: {
  /** The chapter being read now. */
  at: ChapterId;
  facts?: SpineFact[];
}) {
  const known = new Map(facts.map((f) => [f.id, f.fact]));

  return (
    <nav aria-label="Your project so far" className="border-b border-[var(--line)] bg-[var(--card)]">
      <Wrap>
        {/* Scrolls sideways on a phone rather than wrapping to three rows —
            five chapters wrapped is a block of text, not a spine. */}
        <ol className="oi-rail m-0 flex list-none items-stretch gap-0 overflow-x-auto p-0">
          {CHAPTERS.map((chapter, i) => {
            const fact = known.get(chapter.id);
            const here = chapter.id === at;
            const written = fact !== undefined || here;

            const body = (
              <>
                <span className="oi-num text-[9.5px] uppercase tracking-[0.16em] text-[var(--ink2)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="mt-1.5 block text-[13.5px] font-medium"
                  style={{ color: here ? 'var(--ink)' : 'var(--ink2)' }}
                >
                  {chapter.name}
                </span>
                {/* The fact, not a tick. A tick says "done"; the fact says
                    what you got for it. */}
                <span className="oi-num mt-1 block text-[10.5px] uppercase tracking-[0.12em] text-[var(--ink2)]">
                  {fact ?? (here ? 'reading now' : '—')}
                </span>
              </>
            );

            return (
              <li
                key={chapter.id}
                className="min-w-[8.5rem] flex-1 border-l border-[var(--line)] first:border-l-0"
                style={{
                  // Terracotta marks where you are, and only there. It is the
                  // one thing on this bar worth finding at a glance.
                  boxShadow: here ? 'inset 0 -2px 0 var(--acc)' : undefined,
                  opacity: written ? 1 : 0.5,
                }}
              >
                {written && !here ? (
                  <Link
                    href={chapter.href}
                    className="block px-4 py-3 no-underline transition-colors hover:bg-[var(--bg)]"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="px-4 py-3" aria-current={here ? 'step' : undefined}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Wrap>
    </nav>
  );
}

/**
 * The footer.
 *
 * Deep Espresso, like the landing page's — the document ends on the same
 * ground the marketing did, which is the cheapest way for the two to read as
 * one publication.
 */
export function AppFooter() {
  return (
    <footer
      data-on-dark
      className="mt-20 border-t border-[var(--line)] py-12"
      style={{ background: 'var(--ink)', colorScheme: 'light' }}
    >
      <Wrap>
        <div className="flex flex-col gap-9 sm:flex-row sm:justify-between sm:gap-12">
          <div className="max-w-[40ch]">
            <span className="mb-3 flex items-center gap-2.5">
              <Mark className="h-5 w-5 text-white/80" />
              <span className="oi-display text-[18px] text-[#f4efe8]">One Interiors</span>
            </span>
            <p className="m-0 text-[13.5px] leading-[1.6] text-white/60">
              Interior studios in Pune, checked fifteen ways and quoted line by line.
            </p>
          </div>

          <nav className="flex flex-col gap-2.5">
            <p className="oi-num m-0 mb-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
              Your project
            </p>
            {[
              ['/quiz', 'Start the brief'],
              ['/account', 'Everything so far'],
              ['/studios', 'Studios'],
              ['/verification', 'The fifteen checks'],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href!}
                className="text-[14px] text-white/70 no-underline hover:text-white"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/apply"
              className="mt-1.5 text-[14px] text-white/45 no-underline hover:text-white"
            >
              For studios — apply to join
            </Link>
          </nav>
        </div>

        {/* Pre-launch honesty notice. Keyed to whether the ROSTER is real, not
            to whether a database exists — the database is seeded with the
            invented studios, so a `hasDatabase()` check would hide this while
            every studio on the page was still fabricated. Defaults to
            showing: forgetting the flag over-discloses, which is the safe
            direction to be wrong in. */}
        {!rosterIsReal() ? (
          <p className="m-0 mt-10 max-w-[74ch] border-t border-white/15 pt-6 text-[13px] leading-relaxed text-white/55">
            Pre-launch build. The studios shown are placeholder records used to develop and review
            the product — they are not real businesses and the registration numbers are not real.
          </p>
        ) : null}
      </Wrap>
    </footer>
  );
}
