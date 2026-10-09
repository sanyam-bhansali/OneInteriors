"use client";

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

import { useSiteT } from "@/components/app/i18n";
import { CHROME_DICT } from "@/modules/i18n/site/chrome";
import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { Pill } from "@/components/home/parts";
import { rosterIsReal } from "@/lib/env";
import { Wrap } from "@/components/landing/parts";

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
  { id: "brief", href: "/quiz", name: "Your brief" },
  { id: "match", href: "/match", name: "Who fits" },
  { id: "quote", href: "/match", name: "The quote" },
  { id: "compare", href: "/compare", name: "Side by side" },
  { id: "expert", href: "/expert", name: "Your architect" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

/**
 * The header.
 *
 * Deliberately thin and Alabaster rather than the landing page's transparent
 * overlay: there is no photograph underneath here, and a customer reading a
 * quote does not need the brand asserting itself above it.
 */
export function AppHeader() {
  const t = useSiteT(CHROME_DICT);
  /* The landing's nav (owner, 10 Oct 2026: the landing's design through the
     whole flow), sticky rather than fixed: a working screen should not have
     its first line slide under it. */
  return (
    <header className="cb cb-part flow-chrome print:hidden">
      <div className="nav flow-nav">
        <div className="wrap nav-in">
          <Link href="/" className="logo" aria-label={t("header.homeAria")}>
            <Wordmark inherit showCity={false} />
          </Link>
          <nav className="nav-links" aria-label={t("header.homeAria")}>
            <Link href="/studios">{t("header.studios")}</Link>
            <Link href="/verification">{t("header.verify")}</Link>
          </nav>
          {/* Line, not filled: the one filled action belongs to the screen. */}
          <Pill
            href="/account"
            tone="line"
            size="sm"
            className="ml-auto min-[861px]:ml-0"
          >
            {t("header.project")}
          </Pill>
        </div>
      </div>
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
  const t = useSiteT(CHROME_DICT);
  const known = new Map(facts.map((f) => [f.id, f.fact]));

  return (
    <nav
      aria-label={t("spine.aria")}
      className="cb cb-part flow-spine print:hidden"
    >
      <div className="wrap">
        {/* Scrolls sideways on a phone rather than wrapping to three rows. */}
        <ol>
          {CHAPTERS.map((chapter, i) => {
            const fact = known.get(chapter.id);
            const here = chapter.id === at;
            const written = fact !== undefined || here;
            const body = (
              <>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <span className="t">{t(`spine.${chapter.id}`)}</span>
                {/* The fact, not a tick: what you got for it. */}
                <span className="f">
                  {fact ?? (here ? t("spine.readingNow") : "—")}
                </span>
              </>
            );
            return (
              <li key={chapter.id}>
                {written && !here ? (
                  <Link href={chapter.href}>{body}</Link>
                ) : (
                  <div
                    className={`seg${written ? "" : " off"}`}
                    aria-current={here ? "step" : undefined}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
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
  const t = useSiteT(CHROME_DICT);
  return (
    <footer
      data-on-dark
      className="mt-20 border-t border-[var(--line)] py-12 print:hidden"
      style={{ background: "var(--ink)", colorScheme: "light" }}
    >
      <Wrap>
        <div className="flex flex-col gap-9 sm:flex-row sm:justify-between sm:gap-12">
          <div className="max-w-[40ch]">
            <span className="mb-3 flex items-center gap-2.5">
              <span className="text-[#f4efe8]">
                <Wordmark inherit showCity={false} />
              </span>
            </span>
            <p className="m-0 text-[13.5px] leading-[1.6] text-white/60">
              {t("footer.tagline")}
            </p>
          </div>

          <nav className="flex flex-col gap-2.5">
            <p className="oi-num m-0 mb-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
              {t("footer.project")}
            </p>
            {[
              ["/quiz", t("footer.startBrief")],
              ["/account", t("footer.everything")],
              ["/studios", t("footer.studios")],
              ["/verification", t("footer.checks")],
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
              {t("footer.apply")}
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
            {t("footer.prelaunch")}
          </p>
        ) : null}
      </Wrap>
    </footer>
  );
}
