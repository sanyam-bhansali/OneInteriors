import Link from 'next/link';
import { FlatStage } from '@/components/landing-v3/FlatStage';
import { LivePrice } from '@/components/landing-v3/LivePrice';
import { VERIFIED_STUDIOS } from '@/lib/claims';
import { Wordmark } from '@/components/brand';
import { CbMotion } from './CbMotion';
import { Pill, Split } from './parts';
import { SiteLangPicker } from '@/components/app/i18n';
import { CHECK_LABELS, type CheckType } from '@/modules/studio/types';
import { BENEFITS, showcaseWorthPaise } from '@/modules/portal/benefits';
import { ARCHITECT } from '@/modules/consultation/architect';
import { FREE_CALLS, type OfferState } from '@/modules/consultation/offer';
import { translator, tx, type Lang, type Tx } from '@/modules/i18n/site';
import { HOME_DICT } from '@/modules/i18n/site/home';
import { CHECK_TX, FINISH_TX, PRIORITY_TX, ROOM_TX, itemLabel } from '@/modules/i18n/site/labels';
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

const Tick = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="m2 5.2 2 2 4-4.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Data ───────────────────────────────────────────────────────

type T = ReturnType<typeof translator<typeof HOME_DICT>>;

/** The five steps. Each card shows the room a little more lit: the v3 sequence, five frames of it. Words in HOME_DICT `step.<k>.*`. */
const STEPS = [
  { n: '01', k: 'brief', frame: 'f00' },
  { n: '02', k: 'match', frame: 'f08' },
  { n: '03', k: 'quote', frame: 'f16' },
  { n: '04', k: 'compare', frame: 'f24' },
  { n: '05', k: 'architect', frame: 'f32' },
] as const;

const exampleBrief = (t: T, lang: Lang): [string, string][] => [
  [t('brief.home'), '2 BHK · Baner'],
  [t('brief.area'), '960 sq ft'],
  [t('brief.finish'), 'Premium'],
  [t('brief.household'), t('brief.householdV')],
  [t('brief.leaning'), 'Warm modern'],
  [t('brief.first'), tx(lang, PRIORITY_TX.SPEED)],
];

const EXAMPLE_MATCHES = [
  { score: 92, k: 'A', checks: [15, 15] },
  { score: 87, k: 'B', checks: [14, 15] },
  { score: 80, k: 'C', checks: [14, 15] },
] as const;

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

/** The questions, in order. Words in HOME_DICT `faq.<k>.q` / `faq.<k>.a`. */
const FAQ = ['cost', 'seconds', 'rank', 'number', 'architect', 'pune'] as const;

/** The finish level's "not for" line, first sentence only. English exactly as before. */
function firstSentence(lang: Lang, text: string): string {
  if (lang === 'en') return `${text.split('. ')[0]}.`;
  const stop = lang === 'hi' ? '।' : '.';
  return `${text.split(/[।.] /)[0].replace(/[।.]$/, '')}${stop}`;
}

const img = (photo: StylePhoto, w: number, h: number) => `${photo.src}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

// ── The page ───────────────────────────────────────────────────

/**
 * Pictures for the two benefits a word alone does not explain (owner,
 * 10 Oct 2026): a gift hamper and a cab. Line drawings in the card's own ink,
 * decorative — the heading below says what each one is.
 */
function HamperArt() {
  return (
    <svg className="bento-art" viewBox="0 0 120 110" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {/* What is inside, peeking over the rim */}
      <rect x="34" y="30" width="16" height="26" rx="3" fill="#fff" />
      <path d="M38 30v-6h8v6" />
      <circle cx="66" cy="40" r="11" fill="#fff" />
      <path d="M66 29c2-5 6-6 9-5" />
      <rect x="76" y="34" width="14" height="22" rx="2" fill="#fff" />
      {/* The handle */}
      <path d="M22 56c0-34 76-34 76 0" />
      {/* The basket */}
      <path d="M14 56h92l-9 42a6 6 0 0 1-6 5H29a6 6 0 0 1-6-5Z" fill="rgba(255,255,255,.65)" />
      <path d="M18 70h84M21 84h78" opacity=".55" />
      <path d="M40 56l3 47M60 56v47M80 56l-3 47" opacity=".55" />
      {/* The bow */}
      <path d="M60 64c-9-9-19-6-15 2 3 5 15 2 15-2Zm0 0c9-9 19-6 15 2-3 5-15 2-15-2Z" fill="#fff" />
      <path d="M57 66l-6 12M63 66l6 12" />
    </svg>
  );
}

function CabArt() {
  return (
    <svg className="bento-art bento-art-car" viewBox="0 0 140 90" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {/* The taxi sign on the roof */}
      <rect x="58" y="10" width="24" height="10" rx="3" fill="#fff" />
      {/* Body */}
      <path d="M14 62V50c0-5 3-8 8-9l14-3 12-14c3-3 6-4 10-4h28c4 0 7 1 10 4l13 14 12 3c5 1 8 4 8 9v12a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4Z" fill="rgba(255,255,255,.65)" />
      {/* Windows */}
      <path d="M44 38l9-11c1-1 3-2 5-2h10v13Zm30 0V25h12c2 0 4 1 5 2l9 11Z" fill="#fff" />
      {/* Door line and handle, headlight */}
      <path d="M72 40v24M80 47h6M124 50h4" opacity=".7" />
      {/* Wheels */}
      <circle cx="40" cy="66" r="11" fill="#fff" />
      <circle cx="40" cy="66" r="4" />
      <circle cx="104" cy="66" r="11" fill="#fff" />
      <circle cx="104" cy="66" r="4" />
      {/* Speed lines */}
      <path d="M2 46h8M4 54h6" opacity=".5" />
    </svg>
  );
}

export function HomeCB({ offer, lang = 'en' }: { offer: OfferState; lang?: Lang }) {
  const t = translator(lang, HOME_DICT);
  /** The module's English, or its translation when there is one. */
  const L = (en: string, entry?: Tx) => (lang === 'en' || !entry ? en : tx(lang, entry));
  const dict = HOME_DICT as Record<string, Tx>;
  const quote = exampleQuote();
  const shown = quote.rooms.slice(0, 4);
  const rest = quote.rooms.slice(4);
  const restLines = rest.reduce((n, r) => n + r.lines.length, 0);
  const restPaise = rest.reduce((n, r) => n + r.subtotalPaise, 0);
  const lineCount = quote.lines.length;
  const checks = (Object.keys(CHECK_LABELS) as CheckType[]).map((k) => L(CHECK_LABELS[k], CHECK_TX[k]));
  const photos = gallery();
  const counts = {
    all: photos.length,
    LIVING: photos.filter((p) => p.room === 'LIVING').length,
    BEDROOM: photos.filter((p) => p.room === 'BEDROOM').length,
    KITCHEN: photos.filter((p) => p.room === 'KITCHEN').length,
  };
  const benefit = (id: string) => {
    const b = BENEFITS.find((x) => x.id === id)!;
    return { ...b, terms: L(b.terms ?? '', dict[`benefit.${id}`]) };
  };
  const worth = formatINR(showcaseWorthPaise());
  const total = formatINRCompact(quote.totalPaise);
  const freeLeft = offer.remaining ? parseInt(offer.remaining.replace(/\D/g, ''), 10) : 0;

  return (
    <div className="cb" lang={lang === 'en' ? undefined : lang}>
      <CbMotion />
      <div className="cursor" aria-hidden="true">
        <span className="cursor-label">{t('cursor.start')}</span>
      </div>

      {/* ── Navigation ── */}
      <header className="nav">
        <div className="wrap nav-in">
          <a className="logo" href="#top" aria-label={t('nav.logo')}>
            <Wordmark inherit showCity={false} />
          </a>
          <nav className="nav-links" aria-label={t('nav.aria')}>
            <a href="#how">{t('nav.how')}</a>
            <a href="#styles">{t('nav.styles')}</a>
            <a href="#benefits">{t('nav.benefits')}</a>
            <a href="#faq">{t('nav.faq')}</a>
          </nav>
          <SiteLangPicker className="nav-lang" />
          {/* "Find", never "request" — no studio is asked for this quote. */}
          <Pill href="/quiz" size="sm">
            {t('cta.find')}
          </Pill>
        </div>
      </header>

      <main id="top">
        {/* ── Hero: the headline, then the prints ── */}
        <section className="hero" aria-label={t('hero.aria')}>
          <div className="wrap hero-copy">
            <p className="hero-meta" data-reveal="" data-auto="">
              <i aria-hidden="true" />
              {t('hero.meta', { n: VERIFIED_STUDIOS })}
            </p>
            <Split as="h1" className="h-xl" text={t('hero.h1')} auto />
            <p className="hero-sub" data-reveal="" data-auto="" style={{ ['--d' as string]: '450ms' }}>
              {t('hero.sub')}
            </p>
            <div className="hero-cta" data-reveal="" data-auto="" style={{ ['--d' as string]: '600ms' }}>
              <Pill href="/quiz" arrow size="lg">
                {t('hero.cta')}
              </Pill>
              <Pill href="#how" tone="line" size="lg">
                {t('hero.how')}
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
            {t('ov.label')}
          </p>
          <h2 className="ov-text" id="ov-h" data-reveal="">
            {t('ov.text')}
          </h2>
        </section>

        {/* ── A live price, before the brief ── */}
        <section className="wrap block" id="price" aria-labelledby="price-h">
          <div className="soft-card price-card">
            <div className="price-head">
              <p className="label" data-reveal="">
                {t('price.label')}
              </p>
              <Split className="h-l" id="price-h" text={t('price.h')} />
              <p className="lede" data-reveal="">
                {t('price.lede')}
              </p>
            </div>
            <LivePrice lang={lang} />
          </div>
        </section>

        {/* ── How it works: five cards that stack as you scroll ── */}
        <section className="wrap block" id="how" aria-labelledby="how-h">
          <div className="sec-head">
            <p className="label" data-reveal="">
              {t('how.label')}
            </p>
            <Split className="h-l" id="how-h" text={t('how.h')} />
          </div>
          <ol className="stack">
            {STEPS.map((s, i) => (
              <li key={s.n} className="stack-card" style={{ ['--i' as string]: i }}>
                <div className="stack-copy">
                  <div className="stack-top">
                    <span className="stack-tag">{t(`step.${s.k}.tag`)}</span>
                    <span className="stack-n">{s.n}</span>
                  </div>
                  <h3>{t(`step.${s.k}.title`)}</h3>
                  <p>{t(`step.${s.k}.body`, { n: VERIFIED_STUDIOS, name: ARCHITECT.name })}</p>
                  <span className="chip">{t(`step.${s.k}.chip`)}</span>
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
            {t('reel.pre')} <em data-count={checks.length}>{checks.length}</em> {t('reel.post')}
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
            <Split className="h-l panel-h" id="match-h" text={t('match.h')} />
            <div className="match-grid">
              <div className="glass" data-reveal="">
                <p className="label">{t('brief.label')}</p>
                <dl className="brief">
                  {exampleBrief(t, lang).map(([k, v]) => (
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
                    <li key={m.k} className="match" data-reveal="" style={{ ['--d' as string]: `${i * 120}ms` }}>
                      <span className="score" data-count={m.score}>
                        {m.score}
                      </span>
                      <div>
                        <h3>{t(`match.studio${m.k}`)}</h3>
                        <p>{t(`match.why${m.k}`)}</p>
                        <div className="bar" style={{ ['--v' as string]: m.score / 100 }}>
                          <i />
                        </div>
                      </div>
                      <span className="checks-ok">{t('match.checks', { a: m.checks[0], b: m.checks[1] })}</span>
                    </li>
                  ))}
                </ol>
                <p className="note">
                  {t('match.note')}
                </p>
              </div>
            </div>

            <div className="quote" data-reveal="">
              <div className="quote-head">
                <h3>{t('quote.h')}</h3>
                <span className="label">
                  {t('quote.label', { n: lineCount })}
                </span>
              </div>
              {shown.map((r) => (
                <div key={r.room} className="qrow">
                  <span className="item">{L(r.label, ROOM_TX[r.room])}</span>
                  <span className="spec">
                    {r.lines
                      .slice(0, 2)
                      .map((l) => `${itemLabel(lang, l.label)} ${l.size === 'Standard' ? '' : l.size}`.trim())
                      .join(' · ')}
                    {r.lines.length > 2 ? ` · +${r.lines.length - 2}` : ''}
                  </span>
                  <span className="amt">{formatINR(r.subtotalPaise)}</span>
                </div>
              ))}
              {rest.length > 0 ? (
                <div className="qrow">
                  <span className="item muted">{t('quote.more', { n: restLines })}</span>
                  <span className="spec">{rest.map((r) => L(r.label, ROOM_TX[r.room])).join(', ')}</span>
                  <span className="amt muted">{formatINR(restPaise)}</span>
                </div>
              ) : null}
              <div className="q-total">
                <div>
                  <strong>{t('quote.total', { n: lineCount })}</strong>
                  <span>
                    {t('quote.fees', { pct: Math.round(quote.variancePct * 100) })}
                  </span>
                </div>
                <div className="sum">{total}</div>
              </div>
            </div>
          </div>

          <div id="home3d" aria-label={t('home3d.aria')}>
            <FlatStage lang={lang} />
          </div>
        </section>

        {/* ── Why trust us: tinted tiles ── */}
        <section className="wrap block" id="trust" aria-labelledby="trust-h">
          <div className="sec-head center">
            <p className="label" data-reveal="">
              {t('trust.label')}
            </p>
            <Split className="h-l" id="trust-h" text={t('trust.h')} />
          </div>
          <ul className="tiles">
            <li className="tile-stat mint" data-reveal="">
              <span className="ic" aria-hidden="true">✓</span>
              <strong data-count={checks.length}>{checks.length}</strong>
              <span>{t('trust.checks')}</span>
            </li>
            <li className="tile-stat lilac" data-reveal="" style={{ ['--d' as string]: '80ms' }}>
              <span className="ic" aria-hidden="true">◎</span>
              <strong>
                <span data-count={50}>50</span>+
              </strong>
              <span>{t('trust.quotes')}</span>
            </li>
            <li className="tile-stat sand" data-reveal="" style={{ ['--d' as string]: '160ms' }}>
              <span className="ic" aria-hidden="true">₹</span>
              <strong>0</strong>
              <span>{t('trust.zero')}</span>
            </li>
            <li className="tile-stat wide peach" data-reveal="" id="architect">
              <div>
                <span className="ic" aria-hidden="true">☏</span>
                <h3>{t('arch.h')}</h3>
                <p>
                  {t('arch.p', { name: ARCHITECT.name })}
                </p>
              </div>
              <div className="offer-box">
                {/* English straight from offer.ts, as before; Hindi and Marathi rebuilt from the same facts. */}
                {offer.free ? (
                  <p className="offer">
                    <s aria-label={t('offer.usually', { price: offer.price })}>{offer.price}</s>
                    <strong>{t('offer.free')}</strong>
                    <span>
                      {lang === 'en'
                        ? offer.headline.replace(/^Free /, '')
                        : t('offer.forFirst', { n: FREE_CALLS.toLocaleString('en-IN') })}
                      {offer.remaining
                        ? ` · ${lang === 'en' ? offer.remaining : t(freeLeft === 1 ? 'offer.left1' : 'offer.leftN', { n: freeLeft })}`
                        : ''}
                    </span>
                  </p>
                ) : (
                  <p className="offer">
                    <span>{lang === 'en' ? offer.headline : t('offer.paid', { price: offer.price })}</span>
                  </p>
                )}
                <Pill href="/expert" arrow>
                  {t('cta.expert')}
                </Pill>
              </div>
            </li>
          </ul>
        </section>

        {/* ── Styles ── */}
        <section className="wrap block" id="styles" aria-labelledby="pf-h">
          <div className="sec-head center">
            <p className="label" data-reveal="">
              {t('styles.label')}
            </p>
            <Split className="h-l" id="pf-h" text={t('styles.h')} />
            <p className="lede" data-reveal="">
              {t('styles.lede')}
            </p>
          </div>
          <div className="filters" role="group" aria-label={t('filter.aria')} data-reveal="">
            {(Object.keys(ROOM_WORDS) as GalleryRoom[]).map((r) => (
              <button key={r} type="button" data-filter={r} aria-pressed={r === 'LIVING'}>
                {t(`rooms.${r}`)} <sup>{counts[r]}</sup>
              </button>
            ))}
            <button type="button" data-filter="all" aria-pressed="false">
              {t('filter.all')} <sup>{counts.all}</sup>
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
                <Link className="g-img" href="/quiz" data-cursor-label="" aria-label={t('gallery.aria', { style: STYLE_LABELS[tag] })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(photo, 720, 900)} alt={photo.alt} loading="lazy" decoding="async" />
                </Link>
                <div className="g-meta">
                  <h3>{STYLE_LABELS[tag]}</h3>
                  <span>{t(`room.${room}`)}</span>
                </div>
                <p>
                  {L(STYLE_DEFINITIONS[tag].charAt(0).toUpperCase() + STYLE_DEFINITIONS[tag].slice(1), dict[`style.${tag}`])}
                  {lang === 'hi' ? '।' : '.'}
                </p>
                <span className="credit">{t('gallery.credit', { name: photo.photographer })}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Finish levels ── */}
        <section className="wrap block" id="levels" aria-labelledby="lv-h">
          <div className="sec-head">
            <p className="label" data-reveal="">
              {t('levels.label')}
            </p>
            <Split className="h-l" id="lv-h" text={t('levels.h')} />
          </div>
          <div className="bands">
            {TIERS.map((tier, i) => {
              const band = TIER[tier];
              const words = FINISH_TX[tier];
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
                  <p className="promise">{L(band.promise, words.promise)}</p>
                  <ul>
                    {band.materials.map((m, j) => (
                      <li key={m}>{L(m, words.materials[j])}</li>
                    ))}
                  </ul>
                  <p className="not">{firstSentence(lang, L(band.notFor, words.notFor))}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Benefits ── */}
        <section className="wrap block" id="benefits" aria-labelledby="ben-h">
          <div className="sec-head">
            <p className="label" data-reveal="">
              {t('ben.label')}
            </p>
            <Split className="h-l" id="ben-h" text={t('ben.h')} />
            <p className="lede" data-reveal="">
              {t('ben.lede')}
            </p>
          </div>

          <p className="ben-label" data-reveal="">
            <span>{t('ben.choosing')}</span>
            <span>05</span>
          </p>
          <ul className="ben-core">
            {[
              [t('ben.verified', { n: VERIFIED_STUDIOS }), benefit('verified').terms],
              [t('ben.quote'), benefit('instant-quote').terms],
              [t('ben.compare'), benefit('plain-compare').terms],
              [t('ben.brief'), t('ben.briefP')],
              [t('ben.call', { name: ARCHITECT.name }), benefit('unbiased-expert').terms],
            ].map(([h, p], i) => (
              <li key={h} data-reveal="" style={{ ['--d' as string]: `${i * 60}ms` }}>
                <span className="n">0{i + 1}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </li>
            ))}
          </ul>

          <p className="ben-label" data-reveal="">
            <span>{t('ben.only')}</span>
            <span>07</span>
          </p>
          <ul className="bento">
            <li data-reveal="" className="b-dark wide">
              <span className="fig">₹50,000</span>
              <span className="tag">{t('bento.cashTag')}</span>
              <h3>{t('bento.cashH')}</h3>
              <p>{benefit('cashback').terms}</p>
            </li>
            <li data-reveal="" className="b-mint" style={{ ['--d' as string]: '60ms' }}>
              <span className="fig">₹10,000</span>
              <span className="tag">OneReferrals</span>
              <h3>{t('bento.refH')}</h3>
              <p>{benefit('referral').terms}</p>
            </li>
            <li data-reveal="" className="b-sand" style={{ ['--d' as string]: '120ms' }}>
              <span className="fig fig-sm">{t('bento.discFig')}</span>
              <span className="tag">{t('bento.discTag')}</span>
              <h3>{t('bento.discH')}</h3>
              <p>{benefit('curated-discount').terms}</p>
            </li>
            <li data-reveal="" className="b-light wide">
              <div className="trk" aria-hidden="true">
                <div className="trk-top">
                  <span>
                    <b>{t('bento.trk')}</b> {t('bento.trkExample')}
                  </span>
                  <span>{t('bento.trkDay')}</span>
                </div>
                <ol className="trk-stages">
                  {(['Design', 'Factory', 'Site', 'Install', 'Handover'] as const).map((s, i) => (
                    <li key={s} className={i < 2 ? 'done' : i === 2 ? 'now' : ''}>
                      <span className="dot">{i < 2 ? <Tick /> : null}</span>
                      {t(`bento.stage.${s}`)}
                    </li>
                  ))}
                </ol>
                <div className="trk-status">
                  <span>{t('bento.trkStatus')}</span>
                  <span className="ok">{t('bento.trkOk')}</span>
                </div>
              </div>
              <span className="tag">{t('bento.trkTag')}</span>
              <h3>{t('bento.trk')}</h3>
              <p>{benefit('tracker').terms}</p>
            </li>
            <li data-reveal="" className="b-photo" style={{ ['--d' as string]: '60ms' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/hero.webp" alt="" loading="lazy" />
              <div className="b-photo-copy">
                <span className="tag">{t('bento.filmTag')}</span>
                <h3>{t('bento.filmH')}</h3>
                <p>{benefit('cinematic-shoot').terms}</p>
              </div>
            </li>
            <li data-reveal="" className="b-lilac">
              <span className="fig fig-sm">OneHamper</span>
              <HamperArt />
              <span className="tag">{t('bento.hamperTag')}</span>
              <h3>{t('bento.hamperH')}</h3>
              <p>{benefit('onehamper').terms}</p>
            </li>
            <li data-reveal="" className="b-peach" style={{ ['--d' as string]: '60ms' }}>
              <span className="fig fig-sm">{t('bento.cabFig')}</span>
              <CabArt />
              <span className="tag">{t('bento.cabTag')}</span>
              <h3>{t('bento.cabH')}</h3>
              <p>{benefit('free-cab').terms}</p>
            </li>
          </ul>

          <div className="ben-worth" data-reveal="">
            <strong>
              {t('worth.pre')} <em>{worth}</em> {t('worth.post')}
            </strong>
            <Pill href="/quiz" arrow>
              {t('cta.find')}
            </Pill>
          </div>
        </section>

        {/* ── FAQ, on a black panel ── */}
        <section className="panel panel-dark" id="faq" aria-labelledby="faq-h">
          <div className="wrap faq-grid">
            <div className="faq-side">
              <Split className="h-l" id="faq-h" text={t('faq.h')} />
              <p data-reveal="">
                {t('faq.pre')} <a href="mailto:hello@oneinteriors.in">hello@oneinteriors.in</a>{' '}
                {t('faq.post')}
              </p>
            </div>
            <div className="faq-list">
              {FAQ.map((f, i) => (
                <details key={f} data-reveal="" style={{ ['--d' as string]: `${i * 60}ms` }} open={i === 0}>
                  <summary>
                    {t(`faq.${f}.q`)}
                    <span className="pm" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <p className="ans">{t(`faq.${f}.a`, { name: ARCHITECT.name })}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── The outro ── */}
        <section className="outro" id="start" aria-labelledby="start-h">
          <div className="glow" aria-hidden="true" />
          <div className="wrap outro-in">
            <Split className="h-xl" id="start-h" text={t('outro.h')} />
            <p data-reveal="">{t('outro.p')}</p>
            <div data-reveal="" style={{ ['--d' as string]: '150ms' }}>
              <Pill href="/quiz" tone="light" arrow size="lg">
                {t('cta.find')}
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
              <span className="foot-pill">{t('foot.hours')}</span>
              <p>{t('foot.p')}</p>
            </div>
            <nav className="foot-links" aria-label={t('foot.aria')}>
              <a href="#how">{t('nav.how')}</a>
              <Link href="/apply">{t('foot.apply')}</Link>
              <a href="#styles">{t('nav.styles')}</a>
              <Link href="/verification">{t('foot.checks')}</Link>
              <a href="#benefits">{t('nav.benefits')}</a>
              <Link href="/studio">{t('foot.studio')}</Link>
              <a href="#faq">{t('nav.faq')}</a>
              <Link href="/expert">{t('cta.expert')}</Link>
            </nav>
          </div>
          <div className="foot-bottom">
            <span>{t('foot.copy')}</span>
            <nav aria-label={t('foot.legal')}>
              <Link href="/privacy">{t('foot.privacy')}</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
