'use client';

/**
 * Before you start — five reasons this goes wrong, with the evidence.
 *
 * ## Why this is an evidence board and not a list of pain points
 *
 * "Confusing quotes" as a bullet is a claim, and the reader has no reason to
 * take it. A photograph of three studios answering "what would this cost?"
 * with three non-answers is not a claim — it is the thing itself, and the
 * reader recognises it because it happened to them last month.
 *
 * None of it is invented. Every exhibit is a shape somebody forwarded us
 * while they were trying to get their flat done, redrawn rather than
 * screenshotted so no real person or studio is identifiable.
 *
 * ## Why the answer is inside the row and not a column of its own
 *
 * An "our solution" column beside a list of problems is an advertisement with
 * extra steps, and it gets skimmed as one. Putting the answer underneath the
 * complaint the reader just opened means they read it having agreed with the
 * sentence above it.
 *
 * ## Click only
 *
 * Nothing on this page moves by itself. A board that advanced on a timer
 * would take away the exhibit somebody stopped to read, and this is the
 * section where they are most likely to stop.
 */

import { useId, useState } from 'react';
import { Wrap, Eyebrow, Heading, Tick, Flag } from './parts';

// ── The five ────────────────────────────────────────────────────

const PAINS = [
  {
    title: '“So what will this actually cost?”',
    body: 'Ask three studios for a number and you get three non-answers. No range, no per-sq-ft, no basis — just come to the office.',
    answer:
      'Budget bands priced per square foot of your carpet area, on screen before you speak to anyone.',
    caption: 'Whatsapp · three studios, one question',
  },
  {
    title: '“Why does every quote look different?”',
    body: 'One is four lines on a letterhead. One is a photograph of a printout. One is eleven pages with no total. Nothing lines up, so nothing can be compared.',
    answer:
      'Every quote is written to the same lines, so two studios sit side by side row for row.',
    caption: 'Three quotes for the same flat',
  },
  {
    title: '“Premium ply — meaning what, exactly?”',
    body: 'The words on a quote are chosen so they cannot be checked. Premium, imported, branded, soft-close. No thickness, no brand, no quantity.',
    answer:
      'Carcass, shutter and hardware named on every line, with the quantity it was priced on.',
    caption: 'One line from a real quote',
  },
  {
    title: '“Six thousand studios all look the same.”',
    body: 'Every profile says best in Pune, every rating is 4.9, every portfolio is the same twelve photographs. There is no honest way to shortlist.',
    answer:
      'Six thousand screened to fourteen listed — then scored against your brief, with the reason shown.',
    caption: 'Search results · “interior designers pune”',
  },
  {
    title: '“It went quiet after we paid the advance.”',
    body: 'The designer who sold you the project is not the person who runs the site. Messages get delivered and not answered.',
    answer:
      'A personal architect on our payroll — not the studio’s — stays with you through handover.',
    caption: 'The month after the advance',
  },
] as const;

// ── Exhibit chrome ──────────────────────────────────────────────

const exhibitCard =
  'bg-[var(--card)] border border-[var(--line)] p-[clamp(20px,2.6vw,28px)]';
const exhibitShadow = { boxShadow: '0 26px 50px -34px rgba(44,38,36,.45)' };

function Bubble({
  children,
  time,
  out = false,
}: {
  children: React.ReactNode;
  time: string;
  out?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${out ? 'items-end' : 'items-start'}`}>
      <p
        className="oi-glass-inner m-0 max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-[1.45]"
        style={
          out
            ? { background: 'var(--ink)', color: '#f6f1e8' }
            : { background: '#efeae1', border: '1px solid var(--line)' }
        }
      >
        {children}
      </p>
      <span className="oi-num text-[9px] uppercase tracking-[0.14em] text-[var(--ink2)]/70">
        {time}
      </span>
    </div>
  );
}

// ── The exhibits ────────────────────────────────────────────────

function ExhibitOne() {
  return (
    <div className={exhibitCard} style={exhibitShadow}>
      <div className="flex flex-col gap-3.5">
        <Bubble out time="10:42 · seen">
          Hi — roughly what would a 2 BHK in Baner cost to do up?
        </Bubble>
        <Bubble time="10:51">Depends on your requirement ma&rsquo;am 🙏</Bubble>
        <Bubble time="11:06">Better you visit our office once, we will discuss</Bubble>
        <Bubble time="11:44">Anywhere between 5 and 25 lakh</Bubble>
      </div>
      <p className="m-0 mt-5 border-t border-[var(--line)] pt-4">
        <Flag>Three replies. No number.</Flag>
      </p>
    </div>
  );
}

function ExhibitTwo() {
  return (
    <div className={exhibitCard} style={exhibitShadow}>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <div className="border border-[var(--line)] p-3.5">
          <p className="oi-label m-0 mb-3">Studio A · 1 page</p>
          <p className="m-0 mb-4 text-[13px] leading-[1.45]">Complete interior work as discussed</p>
          <p className="oi-num m-0 text-[17px]">12,50,000</p>
        </div>

        <div className="border border-[var(--line)] p-3.5">
          <p className="oi-label m-0 mb-3">Studio B · photograph</p>
          <div
            className="flex h-[92px] flex-col items-center justify-center gap-1.5 text-center"
            style={{ border: '1px dashed var(--line)' }}
          >
            <span className="oi-num text-[10px] uppercase tracking-[0.14em] text-[var(--ink2)]">
              IMG_2481.JPG
            </span>
            <span className="oi-num text-[9px] uppercase tracking-[0.14em] text-[var(--ink2)]/70">
              Handwritten
            </span>
          </div>
        </div>

        <div className="border border-[var(--line)] p-3.5">
          <p className="oi-label m-0 mb-3">Studio C · 11 pages</p>
          <ul className="m-0 mb-3 flex list-none flex-col gap-1 p-0">
            {['4.1 Carcass', '4.2 Shutter', '4.3 Edge band', '4.4 …'].map((line) => (
              <li
                key={line}
                className="oi-num text-[10.5px] uppercase tracking-[0.12em] text-[var(--ink2)]"
              >
                {line}
              </li>
            ))}
          </ul>
          <p
            className="oi-num m-0 text-[11px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--acc-ink)' }}
          >
            No total
          </p>
        </div>
      </div>

      <p className="m-0 mt-5 border-t border-[var(--line)] pt-4">
        <Flag>Nothing lines up.</Flag>
      </p>
    </div>
  );
}

function ExhibitThree() {
  return (
    <div className={exhibitCard} style={exhibitShadow}>
      <p className="oi-label m-0 mb-4">Quotation · line 14 of 40</p>

      <div className="flex items-baseline justify-between gap-5 border-y border-[var(--line)] py-5">
        <span className="text-[14.5px] leading-[1.4]">
          Wardrobes — premium ply, imported hardware, soft close
        </span>
        <span className="oi-num flex-none text-[17px]">4,20,000</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5">
        <Flag>Which ply?</Flag>
        <Flag>12mm or 18mm?</Flag>
        <Flag>Which brand?</Flag>
        <Flag>How many sq ft?</Flag>
        <Flag>BWP or commercial?</Flag>
      </div>

      <p className="m-0 mt-5 border-t border-[var(--line)] pt-4 text-[13.5px] leading-[1.55] text-[var(--ink2)]">
        Four unanswerable questions in one line. Multiply by forty lines and that is a contract you
        cannot read.
      </p>
    </div>
  );
}

function ExhibitFour() {
  return (
    <div className={exhibitCard} style={exhibitShadow}>
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(108px,1fr))' }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="border border-[var(--line)] p-2.5">
            <p className="m-0 mb-1.5 text-[11.5px] leading-[1.3]">Best Interiors in Pune</p>
            <p className="oi-num m-0 text-[9px] uppercase tracking-[0.12em] text-[var(--ink2)]">
              ★ 4.9 · 12 photos
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5 border-t border-[var(--line)] pt-4">
        <Flag>6,000 of these</Flag>
        <Flag>Every rating 4.9</Flag>
      </div>
    </div>
  );
}

function ExhibitFive() {
  return (
    <div className={exhibitCard} style={exhibitShadow}>
      <div className="flex flex-col gap-3.5">
        <Bubble out time="14 Mar · delivered">Sir, when is the carpenter coming?</Bubble>
        <Bubble out time="19 Mar · delivered">Any update? Kitchen is still open</Bubble>
        <Bubble out time="27 Mar · delivered">Please respond, we have moved in already</Bubble>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5 border-t border-[var(--line)] pt-4">
        <Flag>No reply in 13 days</Flag>
        <Flag>Advance paid: 40%</Flag>
      </div>
    </div>
  );
}

const EXHIBITS = [ExhibitOne, ExhibitTwo, ExhibitThree, ExhibitFour, ExhibitFive];

// ── The section ─────────────────────────────────────────────────

export function Problem() {
  const [at, setAt] = useState(0);
  const panelId = useId();

  return (
    <section id="problem" className="border-t border-[var(--line)] py-16 sm:py-20">
      <Wrap>
        <Eyebrow>Before you start</Eyebrow>
        <Heading className="max-w-[22ch]">
          Five reasons this goes wrong, and the evidence for each.
        </Heading>
        <p className="m-0 mb-12 mt-5 max-w-[58ch] text-[15px] leading-[1.65] text-[var(--ink2)]">
          Nothing here is invented. It is what people forwarded us while they were trying to get
          their flat done. Open any one of them.
        </p>

        <div
          className="grid gap-[clamp(28px,4vw,60px)]"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}
        >
          {/* ── Left: the five complaints ── */}
          {/* An accordion, not a tablist.
              These were `role="tab"` at first, which is wrong twice over: a
              tab shows one of several panels, whereas each of these expands
              its own body in place; and the tabs pattern promises left/right
              arrow navigation, which promising without implementing is worse
              for a screen-reader user than never claiming it. Plain buttons
              with `aria-expanded` describe exactly what happens. */}
          <div className="flex flex-col">
            {PAINS.map((pain, i) => {
              const on = i === at;
              return (
                <div
                  key={pain.title}
                  className="border-t border-[var(--line)] last:border-b"
                  style={on ? { background: 'rgba(192,97,60,.08)' } : undefined}
                >
                  <button
                    type="button"
                    id={`${panelId}-row-${i}`}
                    aria-expanded={on}
                    aria-controls={`${panelId}-body-${i}`}
                    onClick={() => setAt(i)}
                    className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-baseline gap-4 border-0 bg-transparent px-4 py-5 text-left sm:px-[18px]"
                  >
                    <span
                      className="oi-num text-[11px] uppercase tracking-[0.16em]"
                      style={{ color: on ? 'var(--acc-ink)' : 'var(--sec-ink)' }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="oi-display text-[clamp(1.05rem,.95rem+.45vw,1.3rem)]"
                      style={{ color: on ? 'var(--ink)' : 'var(--ink2)' }}
                    >
                      {pain.title}
                    </span>
                  </button>

                  {/* Always rendered, never conditionally mounted — a
                      conditional body has nothing to transition from, and it
                      hides the text from find-in-page. */}
                  <div
                    id={`${panelId}-body-${i}`}
                    className="oi-reveal"
                    data-open={on}
                    aria-hidden={!on}
                  >
                    <div>
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-4 pb-6 sm:px-[18px]">
                        <span aria-hidden />
                        <div>
                          <p className="m-0 mb-4 text-[14px] leading-[1.6] text-[var(--ink2)]">
                            {pain.body}
                          </p>
                          <p className="oi-label m-0 mb-2">What we do instead</p>
                          <p className="m-0 flex items-start gap-2.5 text-[14px] leading-[1.55]">
                            <Tick className="mt-0.5" style={{ color: 'var(--sec)' }} />
                            <span>{pain.answer}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Right: the exhibit ──
              One live region rather than five tab panels, because the
              exhibits are illustrations of the row that is already open —
              they are not separately navigable content, and five panels in
              the tab order would make a reader hunt through four hidden
              ones. */}
          <div aria-live="polite" aria-label="The evidence for the reason you opened">
            <p className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <span className="oi-label m-0">{PAINS[at]!.caption}</span>
              <span className="oi-label m-0">Exhibit {String(at + 1).padStart(2, '0')}</span>
            </p>

            <div className="oi-stack min-h-[420px]">
              {EXHIBITS.map((Exhibit, i) => (
                <div key={i} data-on={i === at} aria-hidden={i !== at}>
                  <Exhibit />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
