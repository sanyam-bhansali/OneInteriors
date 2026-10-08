import Link from 'next/link';
import { FlatStage } from '@/components/landing-v3/FlatStage';
import { LivePrice } from '@/components/landing-v3/LivePrice';
import { VERIFIED_STUDIOS } from '@/lib/claims';
import { Mark } from '@/components/brand';
import { CbMotion } from './CbMotion';
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
 * The home page, v4 (8 Oct 2026): the owner asked for the customer side in the
 * manner of cuberto.com — a white canvas, one sans face set large and tight,
 * black pill buttons, rounded cards that stack as you scroll, black panels
 * with big rounded tops sliding over the white, and soft tinted tiles for the
 * figures. The content is v3's, unchanged in substance: every figure is real
 * or labelled (the example quote is priced by the engine on sample rates, the
 * example matches say they are examples, the photos are the picker's).
 */

// ── Small parts ────────────────────────────────────────────────

/** A heading whose words rise into place on scroll (home-cb.css `.split`). */
function Split({
  as: Tag = 'h2',
  text,
  className = '',
  id,
  auto = false,
}: {
  as?: 'h1' | 'h2' | 'h3';
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

/** A pill button whose label rolls up on hover and whose fill rises from below. */
function Pill({
  href,
  children,
  tone = 'dark',
  arrow = false,
  size,
}: {
  href: string;
  children: string;
  tone?: 'dark' | 'light' | 'line' | 'accent';
  arrow?: boolean;
  size?: 'sm' | 'lg';
}) {
  const cls = `pill pill-${tone}${size ? ` pill-${size}` : ''}`;
  const inner = (
    <span className="mag-inner">
      <span className="roll">
        <span data-t={children}>{children}</span>
      </span>
      {arrow ? <Arrow /> : null}
    </span>
  );
  return href.startsWith('#') || href.startsWith('mailto:') ? (
    <a className={cls} href={href} data-magnetic="">
      {inner}
    </a>
  ) : (
    <Link className={cls} href={href} data-magnetic="">
      {inner}
    </Link>
  );
}

const Arrow = () => (
  <span className="pill-arrow" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
      <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const Tick = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="m2 5.2 2 2 4-4.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Data ───────────────────────────────────────────────────────

/** The five steps. Each card shows the room a little more lit: the v3 sequence, five frames of it. */
const STEPS = [
  {
    n: '01',
    tag: 'Brief',
    title: 'Tell us about your home',
    body: 'Twelve short screens: your flat, the work, the finish level, the styles you love and the ones you never want, and who lives there.',
    chip: '12 screens · about 4 min',
    frame: 'f00',
  },
  {
    n: '02',
    tag: 'Match',
    title: 'Meet the studios that fit',
    body: `${VERIFIED_STUDIOS} verified studios, scored against your answers, each with the reason in your own words. Nobody can pay to rank higher.`,
    chip: '3–6 matches, each with its reason',
    frame: 'f08',
  },
  {
    n: '03',
    tag: 'Quote',
    title: 'Every quote in seconds',
    body: 'Each studio priced on rates read from its own past quotations, line by line, with every board, finish and fitting named.',
    chip: 'Every match priced at once',
    frame: 'f16',
  },
  {
    n: '04',
    tag: 'Compare',
    title: 'Compare them side by side',
    body: 'Room by room and material by material, with a plain-language summary of where the money really differs.',
    chip: 'Rooms · materials · summary',
    frame: 'f24',
  },
  {
    n: '05',
    tag: 'Architect',
    title: 'A 30-minute call with your architect',
    body: `${ARCHITECT.name} reads your brief and every quote first, tells you where the studios differ, and sets up the meeting with the one you choose.`,
    chip: 'Then we introduce you',
    frame: 'f32',
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

/** The hero collage: the picker's own photographs, tilted like a table of prints. */
const COLLAGE: StyleTag[] = ['warm-modern', 'japandi', 'indian-contemporary', 'scandinavian', 'luxe-glam', 'rustic-earthy'];

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

const img = (photo: StylePhoto, w: number, h: number) => `${photo.src}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

// ── The page ───────────────────────────────────────────────────

export function HomeCB({ offer }: { offer: OfferState }) {
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
  const total = formatINRCompact(quote.totalPaise);

  return (
    <div className="cb">
      <CbMotion />
      <div className="cursor" aria-hidden="true">
        <span className="cursor-label">Start</span>
      </div>

      {/* ── Navigation ── */}
      <header className="nav">
        <div className="wrap nav-in">
          <a className="logo" href="#top" aria-label="One Interiors, back to top">
            <Mark className="text-current" />
            <span className="logo-word">One Interiors</span>
          </a>
          <nav className="nav-links" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#styles">Styles</a>
            <a href="#benefits">Benefits</a>
            <a href="#faq">FAQ</a>
          </nav>
          {/* "Find", never "request" — no studio is asked for this quote. */}
          <Pill href="/quiz" size="sm">
            Find your designer
          </Pill>
        </div>
      </header>

      <main id="top">
        {/* ── Hero: the headline, then the prints ── */}
        <section className="hero" aria-label="Introduction">
          <div className="wrap hero-copy">
            <p className="hero-meta" data-reveal="" data-auto="">
              <i aria-hidden="true" />
              Pune · {VERIFIED_STUDIOS} verified studios · Quotes you can read
            </p>
            <Split as="h1" className="h-xl" text="Find the right interior designer for your home." auto />
            <p className="hero-sub" data-reveal="" data-auto="" style={{ ['--d' as string]: '450ms' }}>
              Tell us about your flat in four minutes. We match you with studios that actually fit it,
              price every one on its own rates, line by line, and a 30-minute call with our architect
              helps you choose.
            </p>
            <div className="hero-cta" data-reveal="" data-auto="" style={{ ['--d' as string]: '600ms' }}>
              <Pill href="/quiz" arrow size="lg">
                Find your interior designer
              </Pill>
              <Pill href="#how" tone="line" size="lg">
                See how it works
              </Pill>
            </div>
          </div>

          <div className="collage" aria-hidden="true">
            <div className="collage-tilt" data-parallax="-0.06">
              {COLLAGE.map((tag, i) => (
                <figure key={tag} className={`tile t${i}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(STYLE_PHOTOS[tag], 760, 560)} alt="" fetchPriority={i < 3 ? 'high' : 'low'} />
                  <figcaption>{STYLE_LABELS[tag]}</figcaption>
                </figure>
              ))}
              <figure className="tile t-hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/hero.webp" alt="" fetchPriority="high" />
              </figure>
            </div>
          </div>
        </section>

        {/* ── What we do ── */}
        <section className="overview wrap" aria-labelledby="ov-h">
          <p className="label" data-reveal="">
            What we do
          </p>
          <h2 className="ov-text" id="ov-h" data-reveal="">
            We check Pune&rsquo;s interior studios fifteen ways, read fifty of each one&rsquo;s own
            quotations, and turn your brief into quotes you can compare line by line — before you
            ring anyone.
          </h2>
        </section>

        {/* ── A live price, before the brief ── */}
        <section className="wrap block" id="price" aria-labelledby="price-h">
          <div className="soft-card price-card">
            <div className="price-head">
              <p className="label" data-reveal="">
                What would my home cost?
              </p>
              <Split className="h-l" id="price-h" text="Your home, priced in a second." />
              <p className="lede" data-reveal="">
                Pick your home and a finish level. This is the range for a full home at that level; your
                brief turns it into real quotes from verified studios.
              </p>
            </div>
            <LivePrice />
          </div>
        </section>

        {/* ── How it works: five cards that stack as you scroll ── */}
        <section className="wrap block" id="how" aria-labelledby="how-h">
          <div className="sec-head">
            <p className="label" data-reveal="">
              How it works · 5 steps
            </p>
            <Split className="h-l" id="how-h" text="Every home starts dark and empty. Here is how yours comes together." />
          </div>
          <ol className="stack">
            {STEPS.map((s, i) => (
              <li key={s.n} className="stack-card" style={{ ['--i' as string]: i }}>
                <div className="stack-copy">
                  <div className="stack-top">
                    <span className="stack-tag">{s.tag}</span>
                    <span className="stack-n">{s.n}</span>
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  <span className="chip">{s.chip}</span>
                </div>
                <div className="stack-media" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/landing/seq/${s.frame}.webp`} alt="" loading="lazy" decoding="async" />
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── The fifteen checks, as a reel ── */}
        <section className="reel" aria-labelledby="reel-h">
          <h2 className="reel-h" id="reel-h" data-reveal="">
            Every studio clears <em data-count={checks.length}>{checks.length}</em> checks
          </h2>
          {[checks.slice(0, 8), checks.slice(7)].map((row, r) => (
            <div key={r} className="mq-row">
              <div className={`mq-track${r === 1 ? ' rev' : ''}`}>
                {[...row, ...row].map((c, i) => (
                  <span key={i} className="mq-item" aria-hidden={i >= row.length ? true : undefined}>
                    <Tick />
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ── The black panel: matching, the quote, the 3D flat ── */}
        <section className="panel panel-dark" id="match" aria-labelledby="match-h">
          <div className="wrap">
            <Split className="h-l panel-h" id="match-h" text="Studios scored on your brief. Never on who paid." />
            <div className="match-grid">
              <div className="glass" data-reveal="">
                <p className="label">An example brief</p>
                <dl className="brief">
                  {EXAMPLE_BRIEF.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <ol className="matches">
                  {EXAMPLE_MATCHES.map((m, i) => (
                    <li key={m.name} className="match" data-reveal="" style={{ ['--d' as string]: `${i * 120}ms` }}>
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
                <p className="note">
                  An example of how a match reads — your own matches are real studios, scored on your answers.
                </p>
              </div>
            </div>

            <div className="quote" data-reveal="">
              <div className="quote-head">
                <h3>A quote you can actually read.</h3>
                <span className="label">
                  Example · 2 BHK, 960 sq ft, full home · {lineCount} lines · sample rates
                </span>
              </div>
              {shown.map((r) => (
                <div key={r.room} className="qrow">
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
                <div className="qrow">
                  <span className="item muted">{restLines} more lines</span>
                  <span className="spec">{rest.map((r) => r.label).join(', ')}</span>
                  <span className="amt muted">{formatINR(restPaise)}</span>
                </div>
              ) : null}
              <div className="q-total">
                <div>
                  <strong>Total for all {lineCount} lines</strong>
                  <span>
                    Fees and GST included · ±{Math.round(quote.variancePct * 100)}% until a site visit
                  </span>
                </div>
                <div className="sum">{total}</div>
              </div>
            </div>
          </div>

          <div id="home3d" aria-label="Your home in 3D">
            <FlatStage />
          </div>
        </section>

        {/* ── Why trust us: tinted tiles ── */}
        <section className="wrap block" id="trust" aria-labelledby="trust-h">
          <div className="sec-head center">
            <p className="label" data-reveal="">
              Why trust us
            </p>
            <Split className="h-l" id="trust-h" text="Checked before you ever see them." />
          </div>
          <ul className="tiles">
            <li className="tile-stat mint" data-reveal="">
              <span className="ic" aria-hidden="true">✓</span>
              <strong data-count={checks.length}>{checks.length}</strong>
              <span>Checks on every studio, each with a named source — from GST filings to finished sites we have stood in.</span>
            </li>
            <li className="tile-stat lilac" data-reveal="" style={{ ['--d' as string]: '80ms' }}>
              <span className="ic" aria-hidden="true">◎</span>
              <strong>
                <span data-count={50}>50</span>+
              </strong>
              <span>Of a studio&rsquo;s own quotations read before it is listed, so every price you see is its own.</span>
            </li>
            <li className="tile-stat sand" data-reveal="" style={{ ['--d' as string]: '160ms' }}>
              <span className="ic" aria-hidden="true">₹</span>
              <strong>0</strong>
              <span>Paid by you for the brief, the matches, the quotes or the comparison.</span>
            </li>
            <li className="tile-stat wide peach" data-reveal="" id="architect">
              <div>
                <span className="ic" aria-hidden="true">☏</span>
                <h3>Your architect is on our payroll. Never a studio&rsquo;s.</h3>
                <p>
                  A 30-minute call with {ARCHITECT.name}. She reads your brief and every quote before it,
                  tells you where the studios really differ, and sets up the meeting with the one you choose.
                </p>
              </div>
              <div className="offer-box">
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
                <Pill href="/expert" arrow>
                  Book your expert call
                </Pill>
              </div>
            </li>
          </ul>
        </section>

        {/* ── Styles ── */}
        <section className="wrap block" id="styles" aria-labelledby="pf-h">
          <div className="sec-head center">
            <p className="label" data-reveal="">
              Styles · pick yours in the brief
            </p>
            <Split className="h-l" id="pf-h" text="Twelve styles. Which one is your home?" />
            <p className="lede" data-reveal="">
              The same photographs you pick from in the brief. Studios&rsquo; own finished homes take their
              place here as they join.
            </p>
          </div>
          <div className="filters" role="group" aria-label="Filter by room" data-reveal="">
            {(Object.keys(ROOM_WORDS) as GalleryRoom[]).map((r) => (
              <button key={r} type="button" data-filter={r} aria-pressed={r === 'LIVING'}>
                {ROOM_WORDS[r]}s <sup>{counts[r]}</sup>
              </button>
            ))}
            <button type="button" data-filter="all" aria-pressed="false">
              All <sup>{counts.all}</sup>
            </button>
          </div>
          <ul className="gallery">
            {photos.map(({ tag, room, photo }, i) => (
              <li
                key={`${tag}-${room}`}
                className="g-card"
                data-cat={room}
                hidden={room !== 'LIVING'}
                data-reveal=""
                style={{ ['--d' as string]: `${(i % 3) * 90}ms` }}
              >
                <Link className="g-img" href="/quiz" data-cursor-label="" aria-label={`Start your brief — ${STYLE_LABELS[tag]}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(photo, 720, 900)} alt={photo.alt} loading="lazy" decoding="async" />
                </Link>
                <div className="g-meta">
                  <h3>{STYLE_LABELS[tag]}</h3>
                  <span>{ROOM_WORDS[room]}</span>
                </div>
                <p>{STYLE_DEFINITIONS[tag].charAt(0).toUpperCase() + STYLE_DEFINITIONS[tag].slice(1)}.</p>
                <span className="credit">Photo: {photo.photographer} / Unsplash</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Finish levels ── */}
        <section className="wrap block" id="levels" aria-labelledby="lv-h">
          <div className="sec-head">
            <p className="label" data-reveal="">
              Finish levels · per sq ft of carpet, before GST
            </p>
            <Split className="h-l" id="lv-h" text="Three levels, described in materials rather than adjectives." />
          </div>
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
                  <div className="band-top">
                    <span className="band-name">{band.label}</span>
                    <span className="band-n">0{i + 1}</span>
                  </div>
                  <span className="per">
                    {perSqftLabel(tier).replace(' and up', '+')} <small>/ sq ft</small>
                  </span>
                  <p className="promise">{band.promise}</p>
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
        </section>

        {/* ── Benefits ── */}
        <section className="wrap block" id="benefits" aria-labelledby="ben-h">
          <div className="sec-head">
            <p className="label" data-reveal="">
              One Interiors benefits
            </p>
            <Split className="h-l" id="ben-h" text="Everything you get when you do up your home with us." />
            <p className="lede" data-reveal="">
              The first five change how you choose a studio. The rest come only when you book through us —
              none of it comes with ringing a studio directly.
            </p>
          </div>

          <p className="ben-label" data-reveal="">
            <span>Choosing with confidence</span>
            <span>05</span>
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
            ].map(([h, p], i) => (
              <li key={h} data-reveal="" style={{ ['--d' as string]: `${i * 60}ms` }}>
                <span className="n">0{i + 1}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </li>
            ))}
          </ul>

          <p className="ben-label" data-reveal="">
            <span>Only when you book through us</span>
            <span>07</span>
          </p>
          <ul className="bento">
            <li data-reveal="" className="b-dark wide">
              <span className="fig">₹50,000</span>
              <span className="tag">Up to · cashback</span>
              <h3>Cashback on your project</h3>
              <p>{benefit('cashback').terms}</p>
            </li>
            <li data-reveal="" className="b-mint" style={{ ['--d' as string]: '60ms' }}>
              <span className="fig">₹10,000</span>
              <span className="tag">OneReferrals</span>
              <h3>Refer a friend</h3>
              <p>{benefit('referral').terms}</p>
            </li>
            <li data-reveal="" className="b-sand" style={{ ['--d' as string]: '120ms' }}>
              <span className="fig fig-sm">Curated</span>
              <span className="tag">Discount</span>
              <h3>One Interiors curated discount</h3>
              <p>{benefit('curated-discount').terms}</p>
            </li>
            <li data-reveal="" className="b-light wide">
              <div className="trk" aria-hidden="true">
                <div className="trk-top">
                  <span>
                    <b>Project tracker</b> · an example
                  </span>
                  <span>Day 38 of 75</span>
                </div>
                <ol className="trk-stages">
                  {['Design', 'Factory', 'Site', 'Install', 'Handover'].map((s, i) => (
                    <li key={s} className={i < 2 ? 'done' : i === 2 ? 'now' : ''}>
                      <span className="dot">{i < 2 ? <Tick /> : null}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="trk-status">
                  <span>Kitchen carcasses delivered to site</span>
                  <span className="ok">On schedule</span>
                </div>
              </div>
              <span className="tag">Tracking</span>
              <h3>Project tracker</h3>
              <p>{benefit('tracker').terms}</p>
            </li>
            <li data-reveal="" className="b-photo" style={{ ['--d' as string]: '60ms' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/hero.webp" alt="" loading="lazy" />
              <div className="b-photo-copy">
                <span className="tag">Film · worth ₹20,000</span>
                <h3>Cinematic film of your home</h3>
                <p>{benefit('cinematic-shoot').terms}</p>
              </div>
            </li>
            <li data-reveal="" className="b-lilac">
              <span className="fig fig-sm">OneHamper</span>
              <span className="tag">Handover · worth ₹5,000</span>
              <h3>A gift at handover</h3>
              <p>{benefit('onehamper').terms}</p>
            </li>
            <li data-reveal="" className="b-peach" style={{ ['--d' as string]: '60ms' }}>
              <span className="fig fig-sm">Cab</span>
              <span className="tag">Travel · worth ₹1,000</span>
              <h3>Free cab to the studio</h3>
              <p>{benefit('free-cab').terms}</p>
            </li>
          </ul>

          <div className="ben-worth" data-reveal="">
            <strong>
              Worth up to <em>{worth}</em> — only through us.
            </strong>
            <Pill href="/quiz" arrow>
              Find your designer
            </Pill>
          </div>
        </section>

        {/* ── FAQ, on a black panel ── */}
        <section className="panel panel-dark" id="faq" aria-labelledby="faq-h">
          <div className="wrap faq-grid">
            <div className="faq-side">
              <Split className="h-l" id="faq-h" text="The awkward questions first." />
              <p data-reveal="">
                Still unsure? Write to us at <a href="mailto:hello@oneinteriors.in">hello@oneinteriors.in</a>{' '}
                and one of our architects will reply.
              </p>
            </div>
            <div className="faq-list">
              {FAQ.map((f, i) => (
                <details key={f.q} data-reveal="" style={{ ['--d' as string]: `${i * 60}ms` }} open={i === 0}>
                  <summary>
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

        {/* ── The outro ── */}
        <section className="outro" id="start" aria-labelledby="start-h">
          <div className="glow" aria-hidden="true" />
          <div className="wrap outro-in">
            <Split className="h-xl" id="start-h" text="Four minutes. Then a quote you can read." />
            <p data-reveal="">No phone call, and nothing payable by you for the brief, your matches or your quotes.</p>
            <div data-reveal="" style={{ ['--d' as string]: '150ms' }}>
              <Pill href="/quiz" tone="light" arrow size="lg">
                Find your designer
              </Pill>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-contact">
              <a className="foot-pill" href="mailto:hello@oneinteriors.in">
                hello@oneinteriors.in
              </a>
              <span className="foot-pill">Tue–Sun · 11:00–19:00 IST</span>
              <p>Interior studios in Pune, checked fifteen ways and quoted line by line.</p>
            </div>
            <nav className="foot-links" aria-label="Footer">
              <a href="#how">How it works</a>
              <Link href="/apply">Apply to be listed</Link>
              <a href="#styles">Styles</a>
              <Link href="/verification">The fifteen checks</Link>
              <a href="#benefits">Benefits</a>
              <Link href="/studio">Studio sign-in</Link>
              <a href="#faq">FAQ</a>
              <Link href="/expert">Book your expert call</Link>
            </nav>
          </div>
          <div className="foot-bottom">
            <span>© 2026 One Interiors · Pune, Maharashtra</span>
            <nav aria-label="Legal">
              <Link href="/privacy">Privacy</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
