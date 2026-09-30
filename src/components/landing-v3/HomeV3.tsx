import Link from 'next/link';
import { LivePrice } from './LivePrice';
import { VERIFIED_STUDIOS } from '@/lib/claims';
import { Mark } from '@/components/brand';
import { LandingMotion } from './LandingMotion';
import { CHECK_LABELS } from '@/modules/studio/types';
import { BENEFITS, showcaseWorthPaise } from '@/modules/portal/benefits';
import { ARCHITECT } from '@/modules/consultation/architect';
import type { OfferState } from '@/modules/consultation/offer';
import { STYLE_LABELS, STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { STYLE_DEFINITIONS } from '@/modules/inspiration/reading';
import { ROOM_STYLE_PHOTOS, STYLE_PHOTOS, type StylePhoto } from '@/data/style-photos';
import { TIER, TIERS, perSqftLabel } from '@/modules/quotation/tiers';
import { buildFirstQuote, homeShapeFor, standardKitchenRunMm } from '@/modules/quotation/first-quote';
import { referenceRates } from '@/data/filed-rates';
import { formatINR, formatINRCompact } from '@/lib/money';

/**
 * The home page, v3 — the owner's layout and motion of 30 Sep 2026, carrying
 * our own copy: what the product actually does, the benefits on the owner's
 * terms, the 30-minute call with the named architect, and no count of
 * studios (the owner: not until there are fifty).
 *
 * Every figure on it is real or labelled: the example quote is priced by the
 * quote engine itself, on sample rates, for a stated home; the example
 * matches say they are examples; the style photos are the ones in the picker,
 * standing in for studios' projects until those exist.
 */

// ── Small parts ────────────────────────────────────────────────

/** A heading whose words rise into place (landing-v3.css `.split`). */
function Split({
  as: Tag = 'h2',
  text,
  className = '',
  id,
  auto = false,
}: {
  as?: 'h1' | 'h2';
  text: string;
  className?: string;
  id?: string;
  auto?: boolean;
}) {
  const words = text.split(/\s+/);
  return (
    <Tag className={`${className} split`} id={id} data-split="" data-auto={auto ? '' : undefined} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true">
          <span className="w">
            <span className="wi" style={{ ['--i' as string]: i }}>
              {w}
            </span>
          </span>{' '}
        </span>
      ))}
    </Tag>
  );
}

/** Text that rolls up on hover. */
function Roll({ children }: { children: string }) {
  return (
    <span className="roll">
      <span data-t={children}>{children}</span>
    </span>
  );
}

const Arrow = () => (
  <svg className="arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Tick = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="m2 5.2 2 2 4-4.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Data ───────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    tag: 'Brief',
    state: 'Lights on',
    title: 'Tell us about your home',
    body: 'Twelve short screens: your flat, the work, the finish level, the styles you love and the ones you never want, and who lives there.',
    chip: '12 screens · about 4 min',
  },
  {
    n: '02',
    tag: 'Match',
    state: 'Walls and floor',
    title: 'Meet the studios that fit',
    body: `${VERIFIED_STUDIOS} verified studios, scored against your answers, each with the reason in your own words. Nobody can pay to rank higher.`,
    chip: `${VERIFIED_STUDIOS} verified studios → 3–6 matches`,
  },
  {
    n: '03',
    tag: 'Quote',
    state: 'First pieces',
    title: 'Every quote in seconds',
    body: 'Each studio priced on rates read from its own past quotations, line by line, with every board, finish and fitting named.',
    chip: 'Every match priced at once',
  },
  {
    n: '04',
    tag: 'Compare',
    state: 'Furnishing',
    title: 'Compare them side by side',
    body: 'Room by room and material by material, with a plain-language summary of where the money really differs.',
    chip: 'Rooms · materials · summary',
  },
  {
    n: '05',
    tag: 'Architect',
    state: 'Home',
    title: 'A 30-minute call with your architect',
    body: `${ARCHITECT.name} reads your brief and every quote first, tells you where the studios differ, and sets up the meeting with the one you choose.`,
    chip: 'Then we introduce you',
  },
];

const EXAMPLE_BRIEF: [string, string][] = [
  ['Home', '2 BHK · Baner'],
  ['Carpet area', '960 sq ft'],
  ['Finish level', 'Premium'],
  ['Household', '2 adults, 1 elderly'],
  ['Leaning', 'Warm modern'],
  ['Put first', 'Finishing on time'],
];

const EXAMPLE_MATCHES = [
  { score: 92, name: 'Studio A', why: 'Can start in January, when you get the keys', checks: '15/15 checks' },
  { score: 87, name: 'Studio B', why: 'Three of their projects are like yours', checks: '14/15 checks' },
  { score: 80, name: 'Studio C', why: 'Has designed for elderly parents before', checks: '14/15 checks' },
];

/** The example quote, priced by the engine itself on sample rates — not typed in. */
function exampleQuote() {
  const shape = homeShapeFor({ propertyType: 'BHK_2', carpetAreaSqft: 960, scope: 'FULL_HOME' });
  return buildFirstQuote(
    { ...shape, kitchenRunMm: standardKitchenRunMm(shape.bhk), runSource: 'standard' },
    referenceRates(),
  );
}

const ROOM_WORDS = { LIVING: 'Living room', BEDROOM: 'Bedroom', KITCHEN: 'Kitchen' } as const;
type GalleryRoom = keyof typeof ROOM_WORDS;

/** The picker's photos, one card each — the portfolio until studios' own projects are in. */
function gallery(): { tag: StyleTag; room: GalleryRoom; photo: StylePhoto }[] {
  const out: { tag: StyleTag; room: GalleryRoom; photo: StylePhoto }[] = [];
  for (const tag of STYLE_TAGS) {
    out.push({ tag, room: 'LIVING', photo: STYLE_PHOTOS[tag] });
    const rooms = ROOM_STYLE_PHOTOS[tag];
    if (rooms?.BEDROOM) out.push({ tag, room: 'BEDROOM', photo: rooms.BEDROOM });
    if (rooms?.KITCHEN) out.push({ tag, room: 'KITCHEN', photo: rooms.KITCHEN });
  }
  return out;
}

const FAQ = [
  {
    q: 'What does One Interiors cost me?',
    a: 'Nothing for the brief, the matches, the quotes or the comparison. The 30-minute call with our architect is ₹5,000, and free for our first 1,000 customers. A studio pays us a fee only if you book it, and that fee comes out of its margin, not your quote.',
  },
  {
    q: 'How can a quote be ready in seconds?',
    a: 'No studio is phoned. Every listed studio’s rates are read from at least fifty of its own past quotations. Our system applies them to your brief and writes the quote line by line — their pricing, not our estimate. The studio confirms or revises it after a site visit.',
  },
  {
    q: 'Can a studio pay to rank higher?',
    a: 'No. Matches are scored on your answers and on the checks a studio has cleared. There is no paid placement, and every match shows its score and the reason behind it.',
  },
  {
    q: 'Will my number be passed to ten contractors?',
    a: 'No. No studio sees your name or number until after your call with our architect — and then only the studios you choose, with your agreement.',
  },
  {
    q: 'What does the architect actually do?',
    a: `A 30-minute call. ${ARCHITECT.name} reads your brief and every quote before it, tells you where the studios really differ and what to ask them, and sets up the meeting with the one you choose. She is on our payroll, so she never earns more by pushing a particular studio.`,
  },
  {
    q: 'Do you work outside Pune?',
    a: 'Not yet. Verification means visiting sites and calling past clients, so we work one city at a time. Right now that is Pune and Pimpri-Chinchwad.',
  },
];

// ── The page ───────────────────────────────────────────────────

export function HomeV3({ offer }: { offer: OfferState }) {
  const quote = exampleQuote();
  const shown = quote.rooms.slice(0, 4);
  const rest = quote.rooms.slice(4);
  const restLines = rest.reduce((n, r) => n + r.lines.length, 0);
  const restPaise = rest.reduce((n, r) => n + r.subtotalPaise, 0);
  const lineCount = quote.lines.length;
  const checks = Object.values(CHECK_LABELS);
  const photos = gallery();
  const counts = {
    all: photos.length,
    LIVING: photos.filter((p) => p.room === 'LIVING').length,
    BEDROOM: photos.filter((p) => p.room === 'BEDROOM').length,
    KITCHEN: photos.filter((p) => p.room === 'KITCHEN').length,
  };
  const benefit = (id: string) => BENEFITS.find((b) => b.id === id)!;
  const worth = formatINR(showcaseWorthPaise());

  return (
    <div className="lv3" data-tone="dark">
      <LandingMotion />
      <div className="cursor" aria-hidden="true">
        <span className="cursor-label">Pick</span>
      </div>

      <header className="nav">
        <div className="wrap nav-in">
          <a className="logo intro" href="#top" data-hover="" aria-label="One Interiors, back to top">
            <Mark className="text-current" />
            <span className="logo-word">One Interiors</span>
          </a>
          <nav className="nav-links intro" aria-label="Main">
            <a href="#how" data-hover="">
              <Roll>How it works</Roll>
            </a>
            <a href="#styles" data-hover="">
              <Roll>Styles</Roll>
            </a>
            <a href="#benefits" data-hover="">
              <Roll>Benefits</Roll>
            </a>
            <a href="#architect" data-hover="">
              <Roll>Talk to an architect</Roll>
            </a>
          </nav>
        </div>
      </header>
      <div className="nav-cta">
        <div className="wrap nav-in">
          {/* "Find", never "request" — no studio is asked for this quote. */}
          <Link className="btn btn-accent btn-sm intro" href="/quiz" data-magnetic="" data-hover="">
            <span className="mag-inner">
              <Roll>Find your designer</Roll>
            </span>
          </Link>
        </div>
      </div>

      <main id="top">
        {/* ── Hero ── */}
        <section className="hero" data-tone="dark" aria-label="Introduction">
          <div className="hero-media" data-parallax="0.18">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/hero.webp"
              alt="A warmly lit living room with a linen sofa, a round oak table and a tall window"
              fetchPriority="high"
            />
          </div>
          <div className="hero-content wrap">
            <div className="hero-grid">
              <div>
                <p className="hero-meta mono intro">
                  <i aria-hidden="true" />
                  Pune · {VERIFIED_STUDIOS} verified studios · Quotes you can read
                </p>
                <Split as="h1" className="h-xl" text="Find the right interior designer for your home." auto />
                <p className="hero-sub" data-reveal="" data-auto="" style={{ ['--d' as string]: '500ms' }}>
                  Tell us about your flat in four minutes. We match you with studios that actually fit
                  it, price every one on its own rates, line by line, and a 30-minute call with our
                  architect helps you choose.
                </p>
                <div className="hero-cta" data-reveal="" data-auto="" style={{ ['--d' as string]: '650ms' }}>
                  <Link className="btn btn-accent" href="/quiz" data-magnetic="" data-hover="">
                    <span className="mag-inner">
                      <Roll>Find your interior designer</Roll>
                      <Arrow />
                    </span>
                  </Link>
                  <a className="btn btn-line" href="#how" data-magnetic="" data-hover="">
                    <span className="mag-inner">
                      <Roll>See how it works</Roll>
                    </span>
                  </a>
                </div>
              </div>
              <div className="scroll-cue mono intro" aria-hidden="true">
                <span>Scroll</span>
                <span className="line" />
              </div>
            </div>
          </div>
        </section>

        {/* ── What would my home cost? — a live price, before the brief ── */}
        <section className="section" id="price" data-tone="light" aria-labelledby="price-h">
          <div className="wrap">
            <p className="eyebrow mono" data-reveal="">
              What would my home cost?
            </p>
            <Split className="h-l" id="price-h" text="Your home, priced in a second." />
            <p className="lede" data-reveal="">
              Pick your home and a finish level. This is the range for a full home at that level;
              your brief turns it into real quotes from {VERIFIED_STUDIOS} verified studios.
            </p>
            <LivePrice />
          </div>
        </section>

        {/* ── How it works: the room lights up as you scroll ── */}
        <section className="section" id="how" data-tone="dark" aria-labelledby="how-h">
          <div className="wrap">
            <p className="eyebrow mono" data-reveal="">
              How it works · 5 steps
            </p>
            <Split className="h-l" id="how-h" text="Every home starts dark and empty. Here is how yours comes together." />
            <div className="how-grid">
              <div className="room" aria-hidden="true">
                <div className="room-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/landing/seq/f00.webp" alt="" className="room-poster" />
                  <canvas className="room-canvas" />
                </div>
                <div className="room-bar mono muted">
                  <span className="room-step">Step 1 of 5</span>
                  <span className="progress">
                    <i />
                  </span>
                  <span className="room-state">Unlit</span>
                </div>
              </div>
              <ol className="steps">
                {STEPS.map((s, i) => (
                  <li key={s.n} className={`step${i === 0 ? ' active' : ''}`} data-state={s.state}>
                    <div className="step-top mono muted">
                      <span>{s.n}</span>
                      <span>{s.tag}</span>
                    </div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                    <span className="chip">{s.chip}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── Matching and the quote ── */}
        <section className="section" id="match" data-tone="light" aria-labelledby="match-h">
          <div className="wrap">
            <p className="eyebrow mono" data-reveal="">
              Matching
            </p>
            <Split className="h-l" id="match-h" text="Studios scored on your brief. Never on who paid." />
            <div className="match-grid">
              <div data-reveal="">
                <p className="mono muted" style={{ margin: '0 0 18px' }}>
                  An example brief
                </p>
                <dl className="brief">
                  {EXAMPLE_BRIEF.map(([k, v]) => (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <ol className="matches">
                  {EXAMPLE_MATCHES.map((m, i) => (
                    <li key={m.name} className="match" data-reveal="" data-hover="" style={{ ['--d' as string]: `${i * 120}ms` }}>
                      <span className="score" data-count={m.score}>
                        {m.score}
                      </span>
                      <div>
                        <h3>{m.name}</h3>
                        <p>{m.why}</p>
                        <div className="bar" style={{ ['--v' as string]: m.score / 100 }}>
                          <i />
                        </div>
                      </div>
                      <span className="checks-ok">{m.checks}</span>
                    </li>
                  ))}
                </ol>
                <p className="example-note">
                  An example of how a match reads — your own matches are real studios, scored on your
                  answers.
                </p>
              </div>
            </div>

            <div className="quote">
              <div className="quote-head" data-reveal="">
                <h3 className="h-m">A quote you can actually read.</h3>
                <span className="mono muted">
                  Example · 2 BHK, 960 sq ft, full home · {lineCount} lines
                </span>
              </div>
              {shown.map((r, i) => (
                <div key={r.room} className="qrow" data-reveal="" style={{ ['--d' as string]: `${i * 80}ms` }}>
                  <span className="item">{r.label}</span>
                  <span className="spec">
                    {r.lines
                      .slice(0, 2)
                      .map((l) => `${l.label} ${l.size === 'Standard' ? '' : l.size}`.trim())
                      .join(' · ')}
                    {r.lines.length > 2 ? ` · +${r.lines.length - 2}` : ''}
                  </span>
                  <span className="amt">{formatINR(r.subtotalPaise)}</span>
                </div>
              ))}
              {rest.length > 0 ? (
                <div
                  className="qrow"
                  data-reveal=""
                  style={{ ['--d' as string]: '320ms', borderBottom: '1px solid var(--line)' }}
                >
                  <span className="item muted">{restLines} more lines</span>
                  <span className="spec">{rest.map((r) => r.label).join(', ')}</span>
                  <span className="amt muted">{formatINR(restPaise)}</span>
                </div>
              ) : null}
              <div className="q-total" data-reveal="" style={{ ['--d' as string]: '420ms' }}>
                <div className="lbl">
                  <strong>Total for all {lineCount} lines</strong>
                  <span>
                    Fees and GST included · ±{Math.round(quote.variancePct * 100)}% until a site visit
                  </span>
                </div>
                <div className="sum">
                  {formatINRCompact(quote.totalPaise).replace(/ L$/, '')}
                  <small>{/ L$/.test(formatINRCompact(quote.totalPaise)) ? 'L' : ''}</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust: the checks, and the architect ── */}
        <section className="section" id="trust" data-tone="dark" aria-labelledby="trust-h">
          <div className="wrap">
            <p className="eyebrow mono" data-reveal="">
              Why trust us
            </p>
            <h2 className="big-num" id="trust-h" data-reveal="">
              <span data-count={checks.length}>{checks.length}</span>
              <span className="unit">checks on every studio</span>
            </h2>
            <div className="trust-copy">
              <p data-reveal="">
                {VERIFIED_STUDIOS} studios verified so far, from GST filings to finished sites we have
                stood in. Each check has a named source, and every studio card shows which it has cleared.
              </p>
              <p className="muted" data-reveal="" style={{ ['--d' as string]: '120ms' }}>
                A studio is listed only once at least fifty of its own quotations have been read, so every
                price you see is its own.
              </p>
            </div>
          </div>
          <div className="marquee" aria-label="The fifteen checks">
            {[checks.slice(0, 8), checks.slice(7)].map((row, r) => (
              <div key={r} className="mq-row">
                <div className={`mq-track${r === 1 ? ' rev' : ''}`}>
                  {[...row, ...row].map((c, i) => (
                    <span key={i} className="mq-item" aria-hidden={i >= row.length ? true : undefined}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="wrap">
            <div className="architect" id="architect">
              <Split className="h-l" text="Your architect is on our payroll. Never a studio’s." />
              <div data-reveal="">
                <p>
                  A 30-minute call with {ARCHITECT.name}. She reads your brief and every quote before it,
                  tells you where the studios really differ, and sets up the meeting with the one you
                  choose.
                </p>
                {offer.free ? (
                  <p className="offer">
                    <s aria-label={`Usually ${offer.price}`}>{offer.price}</s>
                    <strong>Free</strong>
                    <span>
                      {offer.headline.replace(/^Free /, '')}
                      {offer.remaining ? ` · ${offer.remaining}` : ''}
                    </span>
                  </p>
                ) : (
                  <p className="offer">
                    <span>{offer.headline}</span>
                  </p>
                )}
                <Link className="btn btn-line" href="/expert" data-magnetic="" data-hover="">
                  <span className="mag-inner">
                    <Roll>Book your expert call</Roll>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Styles: the portfolio, until studios' own projects are in ── */}
        <section className="section" id="styles" data-tone="light" aria-labelledby="pf-h">
          <div className="wrap">
            <p className="eyebrow mono" data-reveal="">
              Styles · Pick yours in the brief
            </p>
            <div className="pf-head">
              <Split className="h-l" id="pf-h" text="Twelve styles. Which one is your home?" />
              <p data-reveal="">
                The same photographs you pick from in the brief. Studios&rsquo; own finished homes take
                their place here as they join.
              </p>
            </div>
            <div className="pf-filters" role="group" aria-label="Filter by room" data-reveal="">
              {/* Living rooms first: all thirty-odd at once made the section a scroll of its own. */}
              {(Object.keys(ROOM_WORDS) as GalleryRoom[]).map((r) => (
                <button key={r} type="button" data-filter={r} aria-pressed={r === 'LIVING'} data-hover="">
                  {ROOM_WORDS[r]}s <sup>{counts[r]}</sup>
                </button>
              ))}
              <button type="button" data-filter="all" aria-pressed="false" data-hover="">
                All <sup>{counts.all}</sup>
              </button>
            </div>
            <ul className="pf-grid">
              {photos.map(({ tag, room, photo }, i) => (
                <li
                  key={`${tag}-${room}`}
                  className="pf-card"
                  data-cat={room}
                  hidden={room !== 'LIVING'}
                  data-reveal=""
                  style={{ ['--d' as string]: `${(i % 3) * 90}ms` }}
                >
                  <Link className="pf-img" href="/quiz" data-cursor-label="" aria-label={`Start your brief — ${STYLE_LABELS[tag]}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${photo.src}?auto=format&fit=crop&w=720&h=900&q=70`}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="pf-style">{STYLE_LABELS[tag]}</span>
                  </Link>
                  <span className="pf-meta">{ROOM_WORDS[room]}</span>
                  <h3>{STYLE_LABELS[tag]}</h3>
                  <p className="desc">
                    {STYLE_DEFINITIONS[tag].charAt(0).toUpperCase() + STYLE_DEFINITIONS[tag].slice(1)}.
                  </p>
                  <div className="pf-foot">
                    <span>Photo: {photo.photographer} / Unsplash</span>
                    <Link href="/quiz" data-hover="">
                      Start here →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Finish levels ── */}
        <section className="section" id="levels" data-tone="light" aria-labelledby="lv-h" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <p className="eyebrow mono" data-reveal="">
              Finish levels · per sq ft of carpet, before GST
            </p>
            <Split className="h-m" id="lv-h" text="Three levels, described in materials rather than adjectives." />
            <div className="bands">
              {TIERS.map((tier, i) => {
                const band = TIER[tier];
                return (
                  <article
                    key={tier}
                    className={`band${tier === 'PREMIUM' ? ' featured' : ''}`}
                    data-reveal=""
                    style={{ ['--d' as string]: `${i * 90}ms` }}
                  >
                    <span className="mono muted">{band.label}</span>
                    <span className="per">
                      {perSqftLabel(tier).replace(' and up', '+')} <small>/ sq ft</small>
                    </span>
                    <p style={{ margin: 0 }} className="muted">
                      {band.promise}
                    </p>
                    <ul>
                      {band.materials.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                    <p className="not">{band.notFor.split('. ')[0]}.</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Benefits ── */}
        <section className="section" id="benefits" data-tone="light" aria-labelledby="ben-h">
          <div className="wrap">
            <p className="eyebrow mono" data-reveal="">
              One Interiors benefits
            </p>
            <div className="ben-head">
              <Split className="h-l" id="ben-h" text="Everything you get when you do up your home with us." />
              <p data-reveal="">
                The first five change how you choose a studio. The rest come only when you book through us
                — none of it comes with ringing a studio directly.
              </p>
            </div>

            <p className="ben-label mono" data-reveal="">
              <span>Choosing with confidence</span>
              <span>5</span>
            </p>
            <ul className="ben-core">
              {[
                [`${VERIFIED_STUDIOS} verified studios`, benefit('verified').terms],
                ['A quote in seconds', benefit('instant-quote').terms],
                ['Quotes compared in plain language', benefit('plain-compare').terms],
                [
                  'A comparison brief you can read',
                  'A one-page summary of how your quotes differ and why, to read with your family or print.',
                ],
                [`A 30-minute call with ${ARCHITECT.name}`, benefit('unbiased-expert').terms],
              ].map(([h, p]) => (
                <li key={h} data-reveal="">
                  <h3>{h}</h3>
                  <p>{p}</p>
                </li>
              ))}
            </ul>

            <p className="ben-label mono" data-reveal="">
              <span>Only when you book through us</span>
              <span>7</span>
            </p>
            <ul className="ben-extra">
              <li data-reveal="" className="wide">
                <span className="fig">₹50,000</span>
                <span className="tag">Up to</span>
                <h3>Cashback on your project</h3>
                <p>{benefit('cashback').terms}</p>
              </li>
              <li data-reveal="" style={{ ['--d' as string]: '60ms' }}>
                <span className="fig">₹10,000</span>
                <span className="tag">OneReferrals</span>
                <h3>Refer a friend</h3>
                <p>{benefit('referral').terms}</p>
              </li>
              <li data-reveal="" style={{ ['--d' as string]: '120ms' }}>
                <div className="vis v-tag">
                  <svg viewBox="0 0 240 150" fill="none" aria-hidden="true">
                    <path d="M226 30 C 250 10, 240 -10, 214 6" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M58 22 H212 a12 12 0 0 1 12 12 V116 a12 12 0 0 1 -12 12 H58 L16 75 Z" style={{ fill: 'var(--accent)' }} />
                    <circle cx="52" cy="75" r="7" style={{ fill: 'var(--bg)' }} />
                    <text x="138" y="82" textAnchor="middle" fill="#fff" style={{ font: '600 34px var(--display)', letterSpacing: '-1px' }}>
                      Curated
                    </text>
                    <text x="138" y="108" textAnchor="middle" fill="#fff" style={{ font: '500 12px var(--mono)', letterSpacing: '3px' }}>
                      DISCOUNT
                    </text>
                  </svg>
                </div>
                <span className="tag">Discount</span>
                <h3>One Interiors curated discount</h3>
                <p>{benefit('curated-discount').terms}</p>
              </li>

              <li data-reveal="" className="wide">
                <div className="vis">
                  <div className="trk">
                    <div className="trk-top">
                      <span>
                        <b>Project tracker</b> · an example
                      </span>
                      <span>Day 38 of 75</span>
                    </div>
                    <div className="trk-rail">
                      <span className="base" />
                      <span className="fill" />
                      <ol className="trk-stages">
                        <li className="done">
                          <span className="dot">
                            <Tick />
                          </span>
                          Design
                        </li>
                        <li className="done">
                          <span className="dot">
                            <Tick />
                          </span>
                          Factory
                        </li>
                        <li className="now">
                          <span className="dot" />
                          Site
                        </li>
                        <li>
                          <span className="dot" />
                          Install
                        </li>
                        <li>
                          <span className="dot" />
                          Handover
                        </li>
                      </ol>
                    </div>
                    <div className="trk-status">
                      <span>Kitchen carcasses delivered to site</span>
                      <span className="pill">On schedule</span>
                    </div>
                  </div>
                </div>
                <span className="tag">Tracking</span>
                <h3>Project tracker</h3>
                <p>{benefit('tracker').terms}</p>
              </li>

              <li data-reveal="" style={{ ['--d' as string]: '60ms' }} className="wide">
                <div className="vis">
                  <div className="film">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/landing/hero.webp" alt="" loading="lazy" />
                    <div className="hud">
                      <div>
                        <span className="rec">
                          <i />
                          REC
                        </span>
                        <span>4K · 24 FPS</span>
                      </div>
                      <div>
                        <span>Your home · Scene 01</span>
                        <span>00:42</span>
                      </div>
                    </div>
                    <span className="play" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="#fff">
                        <path d="M5 3.5v11l9.5-5.5Z" />
                      </svg>
                    </span>
                  </div>
                </div>
                <span className="tag">Film · worth ₹20,000</span>
                <h3>Cinematic film of your home</h3>
                <p>{benefit('cinematic-shoot').terms}</p>
              </li>

              <li data-reveal="" className="wide">
                <div className="vis v-hamper">
                  <svg viewBox="0 0 250 180" fill="none" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
                    <g className="items">
                      <path d="M78 96 V56 q0 -6 5 -9 V34 h10 v13 q5 3 5 9 v40" style={{ stroke: 'var(--fg)' }} strokeWidth="2" />
                      <path d="M78 70 h20" style={{ stroke: 'var(--accent)' }} strokeWidth="6" />
                      <rect x="108" y="62" width="44" height="34" rx="3" style={{ fill: 'var(--accent)' }} />
                      <path d="M130 62 v34 M108 79 h44" stroke="#fff" strokeWidth="2.5" />
                      <path d="M130 62 q-10 -12 -16 -4 q6 6 16 4 q10 -12 16 -4 q-6 6 -16 4" style={{ stroke: 'var(--accent)' }} strokeWidth="2.5" />
                      <rect x="160" y="68" width="22" height="28" rx="4" style={{ stroke: 'var(--fg)' }} strokeWidth="2" />
                      <path d="M158 68 h26" style={{ stroke: 'var(--fg)' }} strokeWidth="4" />
                      <path d="M190 96 q2 -30 18 -44 M200 72 q10 -6 16 -2 q-6 8 -16 2 M196 84 q-10 -8 -16 -4 q6 8 16 4" style={{ stroke: '#3F8254' }} strokeWidth="2" />
                    </g>
                    <path d="M52 96 C 60 20, 190 20, 198 96" style={{ stroke: 'var(--fg)' }} strokeWidth="2.5" />
                    <path d="M34 96 H216 L200 168 H50 Z" style={{ fill: 'var(--bg)', stroke: 'var(--fg)' }} strokeWidth="2.5" />
                    <path d="M40 118 H210 M45 140 H205" style={{ stroke: 'var(--fg)' }} strokeWidth="1.5" opacity=".45" />
                    <path d="M70 96 l6 72 M100 96 l3 72 M125 96 v72 M150 96 l-3 72 M180 96 l-6 72" style={{ stroke: 'var(--fg)' }} strokeWidth="1.5" opacity=".45" />
                    <path d="M34 96 H216" style={{ stroke: 'var(--accent)' }} strokeWidth="7" />
                  </svg>
                </div>
                <span className="tag">Handover · worth ₹5,000</span>
                <h3>OneHamper</h3>
                <p>{benefit('onehamper').terms}</p>
              </li>
              <li data-reveal="" style={{ ['--d' as string]: '60ms' }} className="wide">
                <div className="vis v-cab">
                  <svg viewBox="0 0 340 150" fill="none" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
                    <path className="road" d="M0 138 H340" style={{ stroke: 'var(--muted)' }} strokeWidth="2" />
                    <g className="car">
                      <rect x="146" y="26" width="42" height="14" rx="3" style={{ fill: 'var(--accent)' }} />
                      <text x="167" y="36.5" textAnchor="middle" fill="#fff" style={{ font: '600 9px var(--mono)', letterSpacing: '2px' }}>
                        CAB
                      </text>
                      <path
                        d="M52 112 V92 q2 -12 16 -14 l40 -6 l30 -28 q6 -6 14 -6 h72 q9 0 15 7 l26 28 l22 5 q12 3 12 15 v19 Z"
                        style={{ fill: 'var(--bg)', stroke: 'var(--fg)' }}
                        strokeWidth="2.5"
                      />
                      <path d="M144 48 l-26 24 h58 V48 Z M184 48 v24 h60 l-22 -24 Z" style={{ stroke: 'var(--fg)' }} strokeWidth="2" opacity=".6" />
                      <path d="M52 100 H288" style={{ stroke: 'var(--accent)' }} strokeWidth="4" />
                      <path d="M282 92 h8" style={{ stroke: '#E8B54A' }} strokeWidth="5" />
                      <circle cx="102" cy="114" r="17" style={{ fill: 'var(--bg)', stroke: 'var(--fg)' }} strokeWidth="2.5" />
                      <circle cx="102" cy="114" r="6" style={{ fill: 'var(--fg)' }} />
                      <circle cx="244" cy="114" r="17" style={{ fill: 'var(--bg)', stroke: 'var(--fg)' }} strokeWidth="2.5" />
                      <circle cx="244" cy="114" r="6" style={{ fill: 'var(--fg)' }} />
                    </g>
                  </svg>
                </div>
                <span className="tag">Travel · worth ₹1,000</span>
                <h3>Free cab to the studio</h3>
                <p>{benefit('free-cab').terms}</p>
              </li>
            </ul>

            <div className="ben-worth" data-reveal="">
              <strong>
                Worth up to <em>{worth}</em> — only through us.
              </strong>
              <Link className="btn btn-accent" href="/quiz" data-magnetic="" data-hover="">
                <span className="mag-inner">
                  <Roll>Find your designer</Roll>
                  <Arrow />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="section" id="faq" data-tone="dark" aria-labelledby="faq-h">
          <div className="wrap faq-grid">
            <div className="faq-side">
              <p className="eyebrow mono" data-reveal="">
                FAQ
              </p>
              <Split className="h-l" id="faq-h" text="The awkward questions first." />
              <p data-reveal="">
                Still unsure? Write to us at{' '}
                <a href="mailto:hello@oneinteriors.in">hello@oneinteriors.in</a> and one of our
                architects will reply.
              </p>
            </div>
            <div className="faq-list">
              {FAQ.map((f, i) => (
                <details key={f.q} data-reveal="" style={{ ['--d' as string]: `${i * 60}ms` }} open={i === 0}>
                  <summary data-hover="">
                    {f.q}
                    <span className="pm" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <p className="ans">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Start ── */}
        <section className="section final" id="start" data-tone="light" aria-labelledby="start-h">
          <div className="wrap">
            <div className="final-grid">
              <div>
                <p className="eyebrow mono" data-reveal="">
                  Start here
                </p>
                <Split className="h-xl" id="start-h" text="Four minutes. Then a quote you can read." />
                <p className="muted" data-reveal="" style={{ margin: '28px 0 0', maxWidth: '44ch', fontSize: 19 }}>
                  No phone call, and nothing payable by you for the brief, your matches or your quotes.
                </p>
              </div>
              <div data-reveal="" style={{ ['--d' as string]: '200ms' }}>
                <Link className="circle" href="/quiz" data-magnetic="" data-hover="">
                  <span className="mag-inner">Find your designer</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="f-grid">
            <div className="f-brand">
              <p>Interior studios in Pune, checked fifteen ways and quoted line by line.</p>
            </div>
            <div className="f-col">
              <h2>The product</h2>
              <ul>
                <li>
                  <a href="#how">How it works</a>
                </li>
                <li>
                  <a href="#styles">Styles</a>
                </li>
                <li>
                  <a href="#benefits">Benefits</a>
                </li>
                <li>
                  <a href="#faq">FAQ</a>
                </li>
              </ul>
            </div>
            <div className="f-col">
              <h2>For studios</h2>
              <ul>
                <li>
                  <Link href="/apply">Apply to be listed</Link>
                </li>
                <li>
                  <Link href="/verification">The fifteen checks</Link>
                </li>
                <li>
                  <Link href="/studio">Studio sign-in</Link>
                </li>
              </ul>
            </div>
            <div className="f-col">
              <h2>Talk to us</h2>
              <ul>
                <li>
                  <a href="mailto:hello@oneinteriors.in">hello@oneinteriors.in</a>
                </li>
                <li>
                  <Link href="/expert">Book your expert call</Link>
                </li>
                <li>
                  <span className="hours">Tue–Sun · 11:00–19:00 IST</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="f-bottom">
            <span className="copy">© 2026 One Interiors · Pune, Maharashtra</span>
            <nav aria-label="Legal">
              <Link href="/privacy">Privacy</Link>
              <span>Terms</span>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
