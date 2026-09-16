/**
 * Investor deck generator.
 *
 *   npm install --save-dev pptxgenjs
 *   node scripts/pitch-deck.js
 *
 * Writes docs/pitch-deck.pptx.
 *
 * ## Why this is a script and not a file
 *
 * Every number in here is sourced from docs/year-one-model.html and
 * docs/gtm-plan.html. When those change, this changes — and a script makes the
 * diff readable, so nobody has to guess whether a figure on a slide was updated
 * or forgotten. An investor deck that disagrees with the model behind it is
 * worse than no deck.
 *
 * ## The one editorial rule
 *
 * Nothing here may claim traction that does not exist. There are zero studios
 * live, zero briefs and zero revenue. The product's entire proposition is that
 * it never fabricates social proof; a deck that opened by implying otherwise
 * would be the first thing to contradict it, and it would be contradicted again
 * in diligence.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, run directly, outside the Next module graph */

// The directive has to be the FIRST text in the comment. Written as a decorated
// block with a leading `*` it is not parsed at all, and the exemption silently
// does nothing — which is how this file broke `npm run lint` once already.
const pptxgen = require('pptxgenjs');
const path = require('path');

// ── Palette ────────────────────────────────────────────────────
// The product's own, from src/app/globals.css. Petrol dominates; brass is the
// single accent and is reserved for numbers that matter and for warnings.
const PETROL = '1A6068';
const PETROL_DEEP = '10454B';
const TERRACOTTA = 'BC6440';
const BRASS = 'C9922A';
const INK = '2A2622';
const INK_2 = '5A544E';
const INK_3 = '8B847C';
const PAPER = 'FFFFFF';
const CREAM = 'FBF7F0';
const RULE = 'E3DCD2';
const WHITE = 'FFFFFF';

const HEAD = 'Cambria';
const BODY = 'Calibri';

const W = 13.33;
const H = 7.5;
const M = 0.7;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'One Interiors';
pres.title = 'One Interiors — investor deck';

// ── Helpers ────────────────────────────────────────────────────
// Fresh option objects every call: pptxgenjs mutates them in place.

function lightSlide() {
  const s = pres.addSlide();
  s.background = { color: PAPER };
  return s;
}

function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: PETROL_DEEP };
  return s;
}

function title(slide, text, opts) {
  const o = opts || {};
  slide.addText(text, {
    isTextBox: true,
    x: M,
    y: o.y || 0.55,
    w: W - M * 2,
    h: o.h || 0.95,
    fontFace: HEAD,
    fontSize: o.size || 34,
    bold: true,
    color: o.color || INK,
    align: 'left',
    valign: 'top',
    margin: 0,
  });
}

function standfirst(slide, text, opts) {
  const o = opts || {};
  slide.addText(text, {
    isTextBox: true,
    x: M,
    y: o.y || 1.6,
    w: o.w || W - M * 2 - 0.6,
    h: o.h || 0.85,
    fontFace: BODY,
    fontSize: o.size || 17,
    color: o.color || INK_2,
    lineSpacingMultiple: 1.25,
    margin: 0,
  });
}

/** The deck's one repeated motif: a filled circle carrying a short label. */
function circle(slide, x, y, label, opts) {
  const o = opts || {};
  slide.addShape(pres.ShapeType.ellipse, {
    x,
    y,
    w: o.d || 0.46,
    h: o.d || 0.46,
    fill: { color: o.fill || PETROL },
  });
  slide.addText(String(label), {
    isTextBox: true,
    x,
    y,
    w: o.d || 0.46,
    h: o.d || 0.46,
    fontFace: BODY,
    fontSize: o.size || 13,
    bold: true,
    color: o.color || WHITE,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });
}

/** A tinted block. No edge stripes anywhere in this deck, by instruction. */
function card(slide, x, y, w, h, opts) {
  const o = opts || {};
  slide.addShape(pres.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: o.fill || CREAM },
    line: { color: o.line || RULE, width: 1 },
  });
}

/** Big number, small label under it. */
function stat(slide, x, y, w, value, label, opts) {
  const o = opts || {};
  slide.addText(value, {
    isTextBox: true,
    x,
    y,
    w,
    h: 0.72,
    fontFace: HEAD,
    fontSize: o.size || 32,
    bold: true,
    color: o.color || PETROL,
    align: 'left',
    valign: 'middle',
    margin: 0,
  });
  slide.addText(label, {
    isTextBox: true,
    x,
    y: y + 0.7,
    w,
    h: 0.62,
    fontFace: BODY,
    fontSize: 11.5,
    color: o.labelColor || INK_3,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 1.15,
    margin: 0,
  });
}

function bullets(slide, x, y, w, h, items, opts) {
  const o = opts || {};
  slide.addText(
    items.map((t, i) => ({
      text: t,
      options: {
        bullet: true,
        breakLine: i !== items.length - 1,
        paraSpaceAfter: o.gap === undefined ? 10 : o.gap,
      },
    })),
    {
      isTextBox: true,
      x,
      y,
      w,
      h,
      fontFace: BODY,
      fontSize: o.size || 14.5,
      color: o.color || INK_2,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );
}

/** An icon-circle row: numbered circle, bold header, description. */
function row(slide, x, y, w, n, header, body, opts) {
  const o = opts || {};
  circle(slide, x, y + 0.04, n, { fill: o.fill || PETROL });
  slide.addText(header, {
    isTextBox: true,
    x: x + 0.68,
    y,
    w: w - 0.68,
    h: 0.34,
    fontFace: BODY,
    fontSize: 15,
    bold: true,
    color: o.headColor || INK,
    margin: 0,
    valign: 'top',
  });
  slide.addText(body, {
    isTextBox: true,
    x: x + 0.68,
    y: y + 0.36,
    w: w - 0.68,
    h: o.h || 0.78,
    fontFace: BODY,
    fontSize: 13,
    color: o.bodyColor || INK_2,
    lineSpacingMultiple: 1.2,
    margin: 0,
    valign: 'top',
  });
}

function footnote(slide, text, opts) {
  const o = opts || {};
  slide.addText(text, {
    isTextBox: true,
    x: M,
    y: H - 0.82,
    w: W - M * 2,
    h: 0.45,
    fontFace: BODY,
    fontSize: 10.5,
    italic: true,
    color: o.color || INK_3,
    margin: 0,
    valign: 'top',
  });
}

// ═══════════════════════════════════════════════════════════════
// 1 — Title
// ═══════════════════════════════════════════════════════════════
{
  const s = darkSlide();

  s.addText('One Interiors', {
    isTextBox: true,
    x: M,
    y: 2.15,
    w: W - M * 2,
    h: 1.1,
    fontFace: HEAD,
    fontSize: 54,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addText('Certainty, not taste.', {
    isTextBox: true,
    x: M,
    y: 3.3,
    w: 9.5,
    h: 0.6,
    fontFace: HEAD,
    fontSize: 26,
    italic: true,
    color: BRASS,
    margin: 0,
  });

  s.addText(
    'A curated interior-design marketplace for Pune. The homeowner gets a verified studio, a real price, and a neutral expert on the phone before anyone is introduced.',
    {
      isTextBox: true,
      x: M,
      y: 4.05,
      w: 8.6,
      h: 1.1,
      fontFace: BODY,
      fontSize: 15,
      color: 'CFE0E2',
      lineSpacingMultiple: 1.3,
      margin: 0,
    },
  );

  s.addText('₹20 lakh  ·  ₹1 crore post-money  ·  September 2026', {
    isTextBox: true,
    x: M,
    y: 5.6,
    w: 9,
    h: 0.45,
    fontFace: BODY,
    fontSize: 15,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addText(
    '"One Interiors" is the working name. The permanent name is being settled this week — nothing in the product hardcodes it.',
    {
      isTextBox: true,
      x: M,
      y: 6.35,
      w: 10.5,
      h: 0.5,
      fontFace: BODY,
      fontSize: 11,
      italic: true,
      color: '8FB3B6',
      margin: 0,
    },
  );

  s.addNotes(
    'Open by naming the round: 20 lakh, 1 crore post-money, 20 percent. Say the name is provisional before anyone asks — it is the one live blocker on the launch date and it is better volunteered than discovered.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 2 — The problem
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'The problem is not finding a designer.');
  standfirst(
    s,
    'A Pune homeowner can find forty studios in an afternoon. What they cannot do is tell which one will still be answering the phone in month four.',
    { w: 11.4 },
  );

  const items = [
    ['Quotes that grew 40%', 'after the contract was signed'],
    ['Four months late', 'on a committed handover date'],
    ['Laminate delivered', 'where veneer was quoted'],
    ['Advances not refunded', 'when the job was abandoned'],
  ];

  const cw = 2.78;
  items.forEach((it, i) => {
    const x = M + i * (cw + 0.24);
    card(s, x, 2.85, cw, 1.62);
    s.addText(it[0], {
      isTextBox: true,
      x: x + 0.22,
      y: 3.02,
      w: cw - 0.44,
      h: 0.72,
      fontFace: HEAD,
      fontSize: 16,
      bold: true,
      color: TERRACOTTA,
      margin: 0,
      valign: 'top',
    });
    s.addText(it[1], {
      isTextBox: true,
      x: x + 0.22,
      y: 3.78,
      w: cw - 0.44,
      h: 0.6,
      fontFace: BODY,
      fontSize: 12,
      color: INK_2,
      lineSpacingMultiple: 1.15,
      margin: 0,
      valign: 'top',
    });
  });

  s.addText('None of these are matching failures. They are execution failures.', {
    isTextBox: true,
    x: M,
    y: 4.85,
    w: 11.4,
    h: 0.5,
    fontFace: HEAD,
    fontSize: 21,
    bold: true,
    color: INK,
    margin: 0,
  });

  bullets(
    s,
    M,
    5.45,
    11.4,
    1.2,
    [
      '₹7–27 lakh per project — the largest discretionary purchase most Indian households make after the flat itself.',
      'Happens once a decade, is irreversible, and the buyer has no basis for judging quality.',
      'So the product sells certainty, not taste. Every feature follows from that one sentence.',
    ],
    { size: 13.5, gap: 7 },
  );

  s.addNotes(
    'The complaint corpus for every competitor reads the same way. Read the four cards out. Then land the line: these are execution failures, not matching failures, which is why a prettier gallery does not fix it.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 3 — Why us
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Why we can start this from a standing start.');
  standfirst(s, 'Supply is the hard side of this marketplace, and we begin with an unfair position on it.', {
    w: 11.4,
  });

  row(
    s,
    M,
    2.75,
    5.4,
    '1',
    '980 real quotation files',
    'Hauspire’s actual quotation archive — real rate structures for Pune, not guesses. The pricing engine is built against them.',
  );
  row(
    s,
    M,
    4.15,
    5.4,
    '2',
    'Twenty designers already paying us',
    'They buy ads from our agency today. It is the warmest supply list in the city, and the conflict gets named in the first sentence of every conversation.',
    { h: 1.0 },
  );
  row(
    s,
    M + 6.1,
    2.75,
    5.4,
    '3',
    'Two studios already in the queue',
    'Hauspire and Urbanline are seeded and waiting on verification. Ten live studios is what month one needs.',
  );
  row(
    s,
    M + 6.1,
    4.15,
    5.4,
    '4',
    'Agency baseline nobody else has',
    'We know what a booked project already costs a Pune designer. That turns our pricing pitch from an assertion into a calculation.',
    { h: 1.0 },
  );

  card(s, M, 5.55, 11.93, 1.0, { fill: 'F7EFE2', line: 'E8D5B4' });
  s.addText(
    'Disclosed up front: Hauspire is a cofounder’s business. Its catalogue is used as structure only — every studio loads its own rates, and no Hauspire pricing ever sets a platform price. If that came out later it would cost us the roster, so it is on this slide.',
    {
      isTextBox: true,
      x: M + 0.3,
      y: 5.72,
      w: 11.33,
      h: 0.7,
      fontFace: BODY,
      fontSize: 12.5,
      color: INK,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes(
    'Do not let anyone find the Hauspire relationship in diligence. Say it here. The rule that protects it is real and enforced in code: studios load their own rates.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 4 — What is built
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'The whole flow is built and deployed.');
  standfirst(s, 'Not a prototype and not a design file. This runs today, end to end, on real infrastructure.', {
    w: 11.4,
  });

  const steps = [
    ['Brief', 'Nine questions,\nabout three minutes'],
    ['Match', 'Ranked studios with\nthe reason in words'],
    ['Quote', 'Priced from each\nstudio’s own rates'],
    ['Compare', 'Side by side, plus a\nlink for the spouse'],
    ['Prepare', 'Their own board\nwhile they wait'],
    ['Expert call', 'The only route to\nan introduction'],
  ];

  const cw = 1.86;
  steps.forEach((st, i) => {
    const x = M + i * (cw + 0.13);
    card(s, x, 2.8, cw, 2.0);
    circle(s, x + 0.2, 3.0, String(i + 1), { d: 0.42, size: 12 });
    s.addText(st[0], {
      isTextBox: true,
      x: x + 0.2,
      y: 3.55,
      w: cw - 0.4,
      h: 0.36,
      fontFace: HEAD,
      fontSize: 15,
      bold: true,
      color: INK,
      margin: 0,
      valign: 'top',
    });
    s.addText(st[1], {
      isTextBox: true,
      x: x + 0.2,
      y: 3.94,
      w: cw - 0.4,
      h: 0.78,
      fontFace: BODY,
      fontSize: 11,
      color: INK_2,
      lineSpacingMultiple: 1.15,
      margin: 0,
      valign: 'top',
    });
  });

  const facts = [
    ['25 tables', 'Postgres, row-level security\nforced on every one'],
    ['354 tests', 'Passing. Money and matching\nlogic are unit-tested'],
    ['0 fabricated', 'No fake reviews, no stars,\nno invented studios'],
    ['Live', 'Deployed on Vercel in\nMumbai, noindex until named'],
  ];
  const fw = 2.9;
  facts.forEach((f, i) => {
    stat(s, M + i * (fw + 0.08), 5.15, fw, f[0], f[1]);
  });

  s.addNotes(
    'The point of this slide is that the money is not being raised to build the product. It is being raised to find out what a customer costs.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 5 — Feature: the brief
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Feature 1 — The brief teaches the vocabulary.');
  standfirst(
    s,
    'A first-time buyer cannot tell you what they want, because they do not know the words. So the questions do the teaching.',
    { w: 11.4 },
  );

  bullets(s, M, 2.75, 6.1, 3.1, [
    'Nine questions, one per screen, about three minutes.',
    'Budget is not a text box. It is three bands priced for their own flat — they learn what their money buys before they name a number.',
    'Styles are chosen as images. The style name is revealed only after they pick, which is how the vocabulary gets taught.',
    'Question five asks what they would never want. That answer is a hard filter, not a weight — a studio matching it is removed outright.',
  ]);

  card(s, M + 6.5, 2.75, 5.43, 3.1, { fill: PETROL });
  s.addText('Works today with zero studios', {
    isTextBox: true,
    x: M + 6.85,
    y: 3.05,
    w: 4.73,
    h: 0.5,
    fontFace: HEAD,
    fontSize: 19,
    bold: true,
    color: WHITE,
    margin: 0,
    valign: 'top',
  });
  s.addText(
    'The cost bands are ours, not any studio’s. So on day one — before a single studio is live — a homeowner still gets a real answer to the question they arrived with: what does my flat actually cost at three levels of finish.\n\nNobody else in Pune publishes that number.',
    {
      isTextBox: true,
      x: M + 6.85,
      y: 3.65,
      w: 4.73,
      h: 1.95,
      fontFace: BODY,
      fontSize: 13,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.25,
      margin: 0,
      valign: 'top',
    },
  );

  footnote(
    s,
    'Completion rate is one of the four numbers the first month exists to measure. Below 40% the problem is the quiz, not the market — and the funnel view names the exact question losing people.',
  );

  s.addNotes(
    'The cost-bands point is the one that matters commercially: it is why a waitlist in September is worth joining even though quotes are six weeks away.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 6 — Feature: matching
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Feature 2 — Matches that explain themselves.');
  standfirst(s, 'A percentage with no reasoning is a slot machine. Every match is shown with the sentence behind it.', {
    w: 11.4,
  });

  card(s, M, 2.7, 11.93, 1.35, { fill: CREAM });
  s.addText(
    '“88% match — because you leaned toward Warm Minimalist and most of their work sits there; the projects they have actually delivered land in your range; they have finished two homes in Baner.”',
    {
      isTextBox: true,
      x: M + 0.32,
      y: 2.9,
      w: 11.29,
      h: 0.95,
      fontFace: HEAD,
      fontSize: 16,
      italic: true,
      color: INK,
      lineSpacingMultiple: 1.25,
      margin: 0,
      valign: 'top',
    },
  );

  row(
    s,
    M,
    4.3,
    5.6,
    'A',
    'It admits what it could not measure',
    'Each card says “4 of 6 factors measured”. A studio with no delivery record must never look like one with a terrible record.',
    { h: 0.95 },
  );
  row(
    s,
    M + 6.33,
    4.3,
    5.6,
    'B',
    'Absent data renders as the reason',
    '“Not enough data yet” — never 0%. That single rule is most of what stops a new roster from looking like a failing one.',
    { h: 0.95 },
  );

  footnote(
    s,
    'The matching engine reads exactly one commercial field about a studio, and that field can only ever remove them from results. A test fails the build if the engine so much as mentions the words sponsored, featured, promoted or boost.',
  );

  s.addNotes(
    'If someone asks how we stop this becoming a pay-to-rank directory, this footnote is the answer, and slide 11 is the longer version.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 7 — Feature: quotes
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Feature 3 — A real price, from a real rate card.');
  standfirst(
    s,
    'Every quote is built room by room from that studio’s own rates, with the modular and non-modular split, and every assumption stated.',
    { w: 11.4 },
  );

  bullets(s, M, 2.8, 6.1, 2.5, [
    'Always a range, never a single number — nobody has visited the flat.',
    'The range states its own spread, and names the one thing that would narrow it most.',
    'Uploading a floor plan and a real carpet area is worth a genuine, computed improvement — not a marketing claim.',
  ]);

  card(s, M + 6.5, 2.8, 5.43, 2.5, { fill: 'FAEDE6', line: 'E8C9B8' });
  s.addText('What the product refuses to do', {
    isTextBox: true,
    x: M + 6.85,
    y: 3.05,
    w: 4.73,
    h: 0.42,
    fontFace: HEAD,
    fontSize: 17,
    bold: true,
    color: TERRACOTTA,
    margin: 0,
    valign: 'top',
  });
  s.addText(
    'On 16 September this product cannot produce a quote. Not because of a bug — because no studio has entered a rate card, and the pricing code refuses to invent one.\n\nThat refusal is the entire trust proposition. It is also why the headline promise is six weeks away rather than available on launch day.',
    {
      isTextBox: true,
      x: M + 6.85,
      y: 3.55,
      w: 4.73,
      h: 1.6,
      fontFace: BODY,
      fontSize: 12.5,
      color: INK,
      lineSpacingMultiple: 1.22,
      margin: 0,
      valign: 'top',
    },
  );

  s.addText(
    'Twenty minutes with one studio unblocks it. That is the single highest-leverage action in the whole plan.',
    {
      isTextBox: true,
      x: M,
      y: 5.55,
      w: 11.93,
      h: 0.55,
      fontFace: HEAD,
      fontSize: 19,
      bold: true,
      color: INK,
      margin: 0,
      valign: 'top',
    },
  );

  footnote(
    s,
    'Publishing the unflattering numbers — days past committed date, disputes upheld — is the same principle applied to studios rather than to prices.',
  );

  s.addNotes(
    'Do not hide the cannot-quote-yet point. Volunteering it is what makes the rest of the deck credible, and it is a twenty-minute fix rather than a build.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 8 — Feature: the expert call
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Feature 4 — There is no “contact this studio” button.');
  standfirst(
    s,
    'Anywhere. Every introduction in the product runs through a call with our own expert first. That is the quality control, and it is what the fee is for.',
    { w: 11.4 },
  );

  row(
    s,
    M,
    2.85,
    5.6,
    '1',
    'The expert arrives briefed',
    'They have read the brief, the floor plan, every quote on the comparison and the board the customer built. The customer never explains their flat twice.',
    { h: 1.0 },
  );
  row(
    s,
    M,
    4.25,
    5.6,
    '2',
    'We are paid by the studio',
    'Which is exactly why the expert will say none of these fit, and go back to the roster, when that is the honest read.',
    { h: 1.0 },
  );
  row(
    s,
    M + 6.33,
    2.85,
    5.6,
    '3',
    'It is also the ceiling',
    'About 0.9 full-time experts in year one, 3.5 in year two. We cannot close more projects than experts can hold calls for.',
    { h: 1.0 },
    );
  row(
    s,
    M + 6.33,
    4.25,
    5.6,
    '4',
    'And it is not yet priced',
    'Roughly ₹6.2 lakh in year one. It does not appear in the revenue model, and slide 14 puts it back in.',
    { h: 1.0 },
  );

  footnote(
    s,
    'A throughput ceiling set by hiring rather than by demand is a real constraint on how fast this can grow. It is on the risk slide for that reason.',
  );

  s.addNotes(
    'Expect the question: does the call not throttle growth? Answer yes, openly. It is the quality mechanism and the fee justification, and the ceiling is arithmetic we have already done.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 9 — Feature: the prep pack
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Feature 5 — They design their own board while they wait.');
  standfirst(
    s,
    'The call is a working day away. A confirmation screen that says “we’ll call you” and stops is a dead end at the highest-intent moment we ever get.',
    { w: 11.4 },
  );

  bullets(s, M, 2.8, 6.1, 2.6, [
    'Their home, room by room, with each room’s share of the budget attached from the first screen.',
    'A curated library of 46 elements — floors, shutters, furniture, lighting, fabric, walls — written for Pune, not for a European fit-out.',
    'The board starts pre-filled, never blank, then they change whatever they like.',
    'The expert reads all of it before dialling.',
  ]);

  card(s, M + 6.5, 2.8, 5.43, 2.6, { fill: PETROL });
  s.addText('What Pinterest cannot do', {
    isTextBox: true,
    x: M + 6.85,
    y: 3.05,
    w: 4.73,
    h: 0.45,
    fontFace: HEAD,
    fontSize: 19,
    bold: true,
    color: WHITE,
    margin: 0,
    valign: 'top',
  });
  s.addText(
    'Tell you what the board costs. Every element carries a budget band, so when a board drifts above what the customer chose, the page says so — once, plainly.\n\nThey can still have the marble. They just cannot have it by accident, and discover the cost in month two.',
    {
      isTextBox: true,
      x: M + 6.85,
      y: 3.58,
      w: 4.73,
      h: 1.65,
      fontFace: BODY,
      fontSize: 12.5,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.22,
      margin: 0,
      valign: 'top',
    },
  );

  s.addText(
    'We deliberately did not build a 3D planner. An open canvas produces a home the budget cannot buy — every hour spent on it makes the first ten minutes of the expert call worse.',
    {
      isTextBox: true,
      x: M,
      y: 5.62,
      w: 11.93,
      h: 0.75,
      fontFace: BODY,
      fontSize: 13.5,
      italic: true,
      color: INK_2,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes(
    'Modsy raised seventy-three million dollars building the 3D planner and shut down. The cheaper insight is that calibration, not rendering, is what the customer actually needs before the call.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 10 — Feature: ops console
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Feature 6 — The console that keeps the promise.');
  standfirst(s, 'The trust claims are only worth what the operating tools behind them enforce.', { w: 11.4 });

  const tiles = [
    ['Verification queue', 'Twelve checks per studio, each with a date and a source. A badge is not evidence; a dated checklist is.'],
    ['Allocation, not ranking', 'We control how often a studio is shown. We never control where it appears in a customer’s results.'],
    ['Pause a studio', 'At capacity, on payment default, or by hand. A studio that cannot serve is removed from matching rather than left to disappoint.'],
    ['Funnel analytics', 'Which question loses people, from our own tables, with no third-party script on the site.'],
  ];

  const cw = 2.86;
  tiles.forEach((t, i) => {
    const x = M + i * (cw + 0.16);
    card(s, x, 2.8, cw, 2.55);
    s.addText(t[0], {
      isTextBox: true,
      x: x + 0.24,
      y: 3.02,
      w: cw - 0.48,
      h: 0.72,
      fontFace: HEAD,
      fontSize: 15.5,
      bold: true,
      color: PETROL,
      margin: 0,
      valign: 'top',
    });
    s.addText(t[1], {
      isTextBox: true,
      x: x + 0.24,
      y: 3.78,
      w: cw - 0.48,
      h: 1.4,
      fontFace: BODY,
      fontSize: 12,
      color: INK_2,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    });
  });

  footnote(
    s,
    'Every status change requires a written reason and records who made it. That machinery exists today — the dispute and removal policy it will enforce still has to be written, and it is on the open-questions slide.',
  );

  s.addNotes(
    'This slide answers “what stops this from degrading into a lead-generation business”. The answer is that the tools are built to make degradation visible.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 11 — The rule
// ═══════════════════════════════════════════════════════════════
{
  const s = darkSlide();

  s.addText('The subscription buys volume.\nIt never buys position.', {
    isTextBox: true,
    x: M,
    y: 1.5,
    w: 11.5,
    h: 1.9,
    fontFace: HEAD,
    fontSize: 40,
    bold: true,
    color: WHITE,
    lineSpacingMultiple: 1.1,
    margin: 0,
  });

  s.addText(
    'How many briefs a studio is shown for is something they pay us to increase. Where they appear inside a customer’s results comes from fit alone, and no amount of money moves it.',
    {
      isTextBox: true,
      x: M,
      y: 3.55,
      w: 10.4,
      h: 0.95,
      fontFace: BODY,
      fontSize: 16.5,
      color: 'CFE0E2',
      lineSpacingMultiple: 1.3,
      margin: 0,
    },
  );

  const guards = [
    ['No sponsored slots', 'Nowhere in the product. No featured cards, no promoted results, no paid placement of any kind.'],
    ['One field, one direction', 'The matching engine reads exactly one commercial fact about a studio, and it can only remove them.'],
    ['Enforced by the build', 'A test reads the matching source and fails if it mentions subscription, boost, sponsored, promoted or featured.'],
  ];
  const cw = 3.84;
  guards.forEach((g, i) => {
    const x = M + i * (cw + 0.2);
    s.addShape(pres.ShapeType.roundRect, {
      x,
      y: 4.85,
      w: cw,
      h: 1.65,
      rectRadius: 0.08,
      fill: { color: PETROL },
      line: { color: '2E7D85', width: 1 },
    });
    s.addText(g[0], {
      isTextBox: true,
      x: x + 0.26,
      y: 5.05,
      w: cw - 0.52,
      h: 0.38,
      fontFace: HEAD,
      fontSize: 15,
      bold: true,
      color: BRASS,
      margin: 0,
      valign: 'top',
    });
    s.addText(g[1], {
      isTextBox: true,
      x: x + 0.26,
      y: 5.46,
      w: cw - 0.52,
      h: 0.92,
      fontFace: BODY,
      fontSize: 12,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'top',
    });
  });

  s.addNotes(
    'This is the differentiation and it is the thing most likely to be quietly abandoned under revenue pressure. It is enforced in the build precisely so that abandoning it would take a deliberate act.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 12 — Business model
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'How the money works.');
  standfirst(s, 'Three months of commission only, then a subscription that scales with the size of projects a studio takes.', {
    w: 11.4,
  });

  const rows = [
    ['Pilot · months 1–3', '5% commission only', 'Nothing at all unless a project closes'],
    ['Essential', '₹25,000/mo + 5%', 'Studios averaging ₹7 lakh projects'],
    ['Premium', '₹50,000/mo + 5%', 'Studios averaging ₹12 lakh projects'],
    ['Luxury', '₹1,00,000/mo + 5%', 'Studios averaging ₹20 lakh projects'],
    ['Escrow · planned', '1.75% customer-side', 'Not launched, and not yet legally cleared'],
  ];

  let y = 2.75;
  rows.forEach((r, i) => {
    const isLast = i === rows.length - 1;
    card(s, M, y, 11.93, 0.66, { fill: isLast ? 'F7EFE2' : i % 2 ? PAPER : CREAM, line: RULE });
    s.addText(r[0], {
      isTextBox: true,
      x: M + 0.3,
      y,
      w: 3.3,
      h: 0.66,
      fontFace: BODY,
      fontSize: 14,
      bold: true,
      color: INK,
      margin: 0,
      valign: 'middle',
    });
    s.addText(r[1], {
      isTextBox: true,
      x: M + 3.7,
      y,
      w: 3.2,
      h: 0.66,
      fontFace: BODY,
      fontSize: 14,
      color: isLast ? BRASS : PETROL,
      bold: true,
      margin: 0,
      valign: 'middle',
    });
    s.addText(r[2], {
      isTextBox: true,
      x: M + 7.1,
      y,
      w: 4.7,
      h: 0.66,
      fontFace: BODY,
      fontSize: 12.5,
      color: INK_2,
      margin: 0,
      valign: 'middle',
    });
    y += 0.74;
  });

  s.addText(
    'At the month-twelve target the blended take rate lands between 5.7% and 6.0% across all three tiers — the higher tiers pay more but also sell more, so the rate does not fan out.',
    {
      isTextBox: true,
      x: M,
      y: 6.5,
      w: 11.93,
      h: 0.6,
      fontFace: BODY,
      fontSize: 13,
      color: INK_2,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes(
    'A studio does not compare our fee to zero. It compares it to what a booked project costs through its own ads today. That is the comparison we have agency data for and competitors do not.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 13 — Year one
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Year one, if the assumptions hold.');
  standfirst(s, 'Ten pilot studios from month one, subscriptions from month four, one city.', { w: 11.4 });

  s.addChart(
    pres.ChartType.bar,
    [
      {
        name: 'Projects closed',
        labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
        values: [10, 10, 10, 16, 23, 30, 42, 52, 66, 78, 96, 120],
      },
    ],
    {
      x: M,
      y: 2.7,
      w: 7.3,
      h: 3.25,
      barDir: 'col',
      chartColors: [PETROL],
      showTitle: true,
      title: 'Projects closed per month',
      titleFontSize: 13,
      titleColor: INK_2,
      showValue: true,
      dataLabelPosition: 'outEnd',
      dataLabelFontSize: 9,
      dataLabelColor: INK_3,
      showLegend: false,
      catAxisLabelColor: INK_3,
      catAxisLabelFontSize: 10,
      valAxisLabelColor: INK_3,
      valAxisLabelFontSize: 10,
      valGridLine: { color: RULE, size: 1 },
      catGridLine: { style: 'none' },
    },
  );

  const cells = [
    ['553', 'projects closed\n₹70.51 Cr of work placed'],
    ['₹4.36 Cr', 'gross revenue\n₹3.53 Cr fees · ₹83.8 L subs'],
    ['₹2,000', 'to acquire a closed project\n0.2% of project value'],
    ['24', 'studios at month twelve\nnot the 50 the plan assumed'],
  ];
  cells.forEach((c, i) => {
    const x = M + 7.7 + (i % 2) * 2.15;
    const y = 2.85 + Math.floor(i / 2) * 1.6;
    stat(s, x, y, 2.05, c[0], c[1], { size: i === 1 ? 26 : 28, color: i === 3 ? TERRACOTTA : PETROL });
  });

  footnote(
    s,
    'Revenue is gross of GST and of every cost on the next slide — this is a contribution model, not a P&L. Source: docs/year-one-model.html at default assumptions.',
  );

  s.addNotes(
    'Give the headline, then go straight to the next slide. Do not let anyone sit with 4.36 crore unqualified — the credibility comes from being the one who raises the problems.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 14 — What the model does not carry
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'What that model does not carry.');
  standfirst(
    s,
    'Our own model raises these against us. We would rather you heard them from this slide than found them in the spreadsheet.',
    { w: 11.4 },
  );

  const issues = [
    [
      'The roster reaches 24, not 50',
      'Signing 20% a month against 10% churn is 10% net growth. Hitting 50 needs 30% a month — a different business-development problem than the plan describes.',
    ],
    [
      'The fee is heaviest when volume is lightest',
      'At month six a studio runs about 2.3 projects and pays up to 7.1%, against 5% in the pilot. That is the same month we assumed 10% churn. The two are unlikely to be unrelated.',
    ],
    [
      'Two acquisition costs, only one can be true',
      'The model computes ₹2,000 per closed project. The kill-criteria imply ₹25,000. Finding out which is the first thing the pilot measures.',
    ],
    [
      '₹15.5 lakh of unpriced cost',
      'The expert calls (₹6.2 L) and verification (₹9.3 L) appear in no revenue line. About 37 paise in every verification rupee is spent on studios who then churn out.',
    ],
  ];

  const cw = 5.86;
  issues.forEach((it, i) => {
    const x = M + (i % 2) * (cw + 0.21);
    const y = 2.75 + Math.floor(i / 2) * 1.85;
    card(s, x, y, cw, 1.65, { fill: 'FAEDE6', line: 'E8C9B8' });
    s.addText(it[0], {
      isTextBox: true,
      x: x + 0.26,
      y: y + 0.18,
      w: cw - 0.52,
      h: 0.4,
      fontFace: HEAD,
      fontSize: 15.5,
      bold: true,
      color: TERRACOTTA,
      margin: 0,
      valign: 'top',
    });
    s.addText(it[1], {
      isTextBox: true,
      x: x + 0.26,
      y: y + 0.62,
      w: cw - 0.52,
      h: 0.92,
      fontFace: BODY,
      fontSize: 12,
      color: INK,
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'top',
    });
  });

  footnote(
    s,
    'The pilot also has zero slack: ten studios guaranteed one project a month for three months is exactly the thirty projects the model produces. Miss the conversion rate at all and we owe ten studios an explanation in the worst possible quarter.',
  );

  s.addNotes(
    'This is the slide that earns the room. Nobody expects a founder to argue against their own model, and it makes every other number more believable, not less.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 15 — Year two
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'Year two is a second city, and a real asset.');
  standfirst(s, 'Pune runs toward its cap; each new city repeats the same three-month pilot before anyone pays a subscription.', {
    w: 11.4,
  });

  const nums = [
    ['₹20.54 Cr', 'gross revenue across three cities'],
    ['2,233', 'projects · ₹284.71 Cr placed'],
    ['14%', 'of revenue is escrow — not yet legal'],
    ['8%', 'of Pune’s organised market'],
  ];
  nums.forEach((n, i) => {
    stat(s, M + i * 3.05, 2.75, 2.9, n[0], n[1], { size: 30, color: i >= 2 ? TERRACOTTA : PETROL });
  });

  card(s, M, 4.35, 5.86, 1.95, { fill: 'FAEDE6', line: 'E8C9B8' });
  s.addText('The two honest problems', {
    isTextBox: true,
    x: M + 0.28,
    y: 4.55,
    w: 5.3,
    h: 0.38,
    fontFace: HEAD,
    fontSize: 15.5,
    bold: true,
    color: TERRACOTTA,
    margin: 0,
    valign: 'top',
  });
  s.addText(
    '₹2.81 Cr rests on holding client money, which in India needs an RBI-compliant partner nobody has confirmed we can have.\n\nAnd 8% of a city’s organised market in year two is a market-share claim, not a growth rate. It is the number a serious investor pushes back on hardest.',
    {
      isTextBox: true,
      x: M + 0.28,
      y: 4.98,
      w: 5.3,
      h: 1.22,
      fontFace: BODY,
      fontSize: 12,
      color: INK,
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'top',
    },
  );

  card(s, M + 6.07, 4.35, 5.86, 1.95, { fill: PETROL });
  s.addText('The thing nobody can copy', {
    isTextBox: true,
    x: M + 6.35,
    y: 4.55,
    w: 5.3,
    h: 0.38,
    fontFace: HEAD,
    fontSize: 15.5,
    bold: true,
    color: BRASS,
    margin: 0,
    valign: 'top',
  });
  s.addText(
    'By the end of year two we hold delivery variance on 2,233 completed projects — who finished on time, who did not, and by how much.\n\nThat cannot be bought from a KYC vendor or copied in a weekend. Everything else in this plan is replicable. This is not.',
    {
      isTextBox: true,
      x: M + 6.35,
      y: 4.98,
      w: 5.3,
      h: 1.22,
      fontFace: BODY,
      fontSize: 12,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes(
    'If escrow turns out to be impossible, drag it to zero and the year still works — it is 14% of revenue, not the business. Say that before they ask.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 16 — Go to market
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'The waitlist is how we buy supply.');
  standfirst(
    s,
    '“Join our platform” is a weak cold open. “We have 140 briefs in Baner and Kharadi, here is the budget distribution, do you want to be one of the first ten studios to see them” is a different conversation.',
    { w: 11.93, h: 1.0 },
  );

  const channels = [
    ['Founders’ network', '20–40', 'Direct WhatsApp to people who have just taken possession. Highest intent, zero cost.'],
    ['Societies and RWAs', '40–80', 'Handover-stage towers in Baner, Kharadi, Wakad, Hinjewadi. One admin reaches hundreds of households in the right week of their lives.'],
    ['Instagram, organic', '20–40', 'Publish the cost bands themselves. Nobody else in Pune publishes that, and it is the product.'],
    ['Paid test', '30–60', 'Not a growth channel. A measuring instrument, and the first ₹25,000 has exactly one job.'],
  ];

  let y = 2.95;
  channels.forEach((c) => {
    s.addText(c[0], {
      isTextBox: true,
      x: M,
      y,
      w: 2.6,
      h: 0.72,
      fontFace: BODY,
      fontSize: 14,
      bold: true,
      color: INK,
      margin: 0,
      valign: 'middle',
    });
    s.addText(c[1], {
      isTextBox: true,
      x: M + 2.65,
      y,
      w: 1.25,
      h: 0.72,
      fontFace: HEAD,
      fontSize: 17,
      bold: true,
      color: PETROL,
      margin: 0,
      valign: 'middle',
    });
    s.addText(c[2], {
      isTextBox: true,
      x: M + 4.0,
      y,
      w: 7.9,
      h: 0.72,
      fontFace: BODY,
      fontSize: 12,
      color: INK_2,
      lineSpacingMultiple: 1.15,
      margin: 0,
      valign: 'middle',
    });
    y += 0.8;
  });

  s.addText(
    'Waitlist opens Tuesday 16 September. What it promises is a place in the queue and a real cost band for their own flat — never “quotes from verified studios”, which is true in November and false in September.',
    {
      isTextBox: true,
      x: M,
      y: 6.28,
      w: 11.93,
      h: 0.72,
      fontFace: BODY,
      fontSize: 13,
      italic: true,
      color: INK_2,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes(
    'The 140 is illustrative of the pitch, not a forecast. Channel totals are 110 to 220 briefs. Say that if anyone writes the number down.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 17 — The gate
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'One gate, three weeks after launch.');
  standfirst(s, 'The first honest decision point is the week of 6 October. Four numbers, all already instrumented.', {
    w: 11.4,
  });

  const gates = [
    ['150+', 'completed briefs'],
    ['4+', 'studios with rates entered'],
    ['< ₹2,500', 'cost per completed brief'],
    ['> 40%', 'brief completion rate'],
  ];
  gates.forEach((g, i) => {
    const x = M + i * 3.05;
    card(s, x, 2.8, 2.9, 1.5, { fill: CREAM });
    s.addText(g[0], {
      isTextBox: true,
      x: x + 0.24,
      y: 2.98,
      w: 2.42,
      h: 0.62,
      fontFace: HEAD,
      fontSize: 27,
      bold: true,
      color: PETROL,
      margin: 0,
      valign: 'middle',
    });
    s.addText(g[1], {
      isTextBox: true,
      x: x + 0.24,
      y: 3.62,
      w: 2.42,
      h: 0.52,
      fontFace: BODY,
      fontSize: 12,
      color: INK_2,
      margin: 0,
      valign: 'top',
    });
  });

  s.addText('Four decisions that are not engineering, and are not ours alone.', {
    isTextBox: true,
    x: M,
    y: 4.55,
    w: 11.93,
    h: 0.45,
    fontFace: HEAD,
    fontSize: 19,
    bold: true,
    color: INK,
    margin: 0,
    valign: 'top',
  });

  bullets(
    s,
    M,
    5.1,
    11.93,
    1.5,
    [
      'The name — blocks the launch date itself. The site stays unindexed until it exists, and that cost compounds invisibly.',
      'DPDP on the 20,000 existing records — a two-hour legal question that currently blocks the largest demand source.',
      'Escrow legality — a fortnight with a lawyer, and it decides 14% of year-two revenue.',
      'GST treatment on composite supply versus works contract — needed before a single real quote goes out.',
    ],
    { size: 13, gap: 6 },
  );

  s.addNotes(
    'Miss the completion number and the problem is the quiz, which is cheap. Miss the cost number and the problem is the channel, and the answer is owned demand rather than a bigger budget.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 18 — The ask
// ═══════════════════════════════════════════════════════════════
{
  const s = darkSlide();

  s.addText('₹20 lakh, at ₹1 crore post-money.', {
    isTextBox: true,
    x: M,
    y: 0.85,
    w: 11.93,
    h: 0.85,
    fontFace: HEAD,
    fontSize: 38,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addText('20% of the company. Enough to reach the 6 October gate with the real numbers in hand.', {
    isTextBox: true,
    x: M,
    y: 1.72,
    w: 11.5,
    h: 0.5,
    fontFace: BODY,
    fontSize: 16,
    color: 'CFE0E2',
    margin: 0,
  });

  const uses = [
    ['₹6 L', 'Demand, and the measurement that decides the year'],
    ['₹5 L', 'Verifying the first ten studios properly'],
    ['₹6 L', 'The first expert — the mechanic the fee pays for'],
    ['₹3 L', 'Legal: escrow, DPDP, GST, dispute policy'],
  ];
  uses.forEach((u, i) => {
    const x = M + i * 3.05;
    s.addShape(pres.ShapeType.roundRect, {
      x,
      y: 2.5,
      w: 2.9,
      h: 1.5,
      rectRadius: 0.08,
      fill: { color: PETROL },
      line: { color: '2E7D85', width: 1 },
    });
    s.addText(u[0], {
      isTextBox: true,
      x: x + 0.24,
      y: 2.66,
      w: 2.42,
      h: 0.55,
      fontFace: HEAD,
      fontSize: 24,
      bold: true,
      color: BRASS,
      margin: 0,
      valign: 'middle',
    });
    s.addText(u[1], {
      isTextBox: true,
      x: x + 0.24,
      y: 3.22,
      w: 2.42,
      h: 0.68,
      fontFace: BODY,
      fontSize: 11.5,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.15,
      margin: 0,
      valign: 'top',
    });
  });

  s.addText('Why ₹1 crore, when the model on slide 13 says ₹4.36 crore?', {
    isTextBox: true,
    x: M,
    y: 4.35,
    w: 11.93,
    h: 0.5,
    fontFace: HEAD,
    fontSize: 22,
    bold: true,
    color: BRASS,
    margin: 0,
    valign: 'top',
  });

  s.addText(
    'Because that model is titled “what has to be true for year one to work”, not “what will happen”. Today there is no revenue, no studio live, and the one number the whole plan rests on — what a customer actually costs — has never been measured. This round buys the measurement, not a share of a ₹4 crore business.\n\nIf it works, ₹1 crore will look absurd in hindsight. That is the point. I would rather the people who backed this before there was any proof were well paid for it than negotiate hard with people who know me.',
    {
      isTextBox: true,
      x: M,
      y: 4.95,
      w: 11.5,
      h: 1.75,
      fontFace: BODY,
      fontSize: 14,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.3,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes(
    'Say this slide slowly. The valuation is deliberately below what the model implies and the reason is stated rather than hidden — that is the whole argument. If someone pushes for a higher price, that is a good problem.',
  );
}

// ═══════════════════════════════════════════════════════════════
// 19 — What would kill this
// ═══════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  title(s, 'What would kill this, and when we would know.');
  standfirst(s, 'Every one of these is measurable inside ninety days. That is what the ₹20 lakh is actually for.', {
    w: 11.4,
  });

  const risks = [
    ['Acquisition is 12× worse than modelled', 'Week 3', 'If a completed brief costs more than ₹2,500 and no owned channel replaces paid, the unit economics do not close. We stop buying and say so out loud.'],
    ['Studios refuse milestone-gated payment', 'Week 2', 'The load-bearing assumption of the whole model, and the one most likely to be false. Both pilot studios can be asked plainly, for free, before anyone builds escrow.'],
    ['Escrow turns out to be illegal for us', 'Week 6', 'Removes 14% of year-two revenue. Year one is unaffected; the repositioning is not. We plan against the version without it until a lawyer says otherwise.'],
    ['Churn stays at 10% a month', 'Month 6', 'The roster never passes 24 studios. The likely cause is pricing the fee flat across the ramp, and the fix costs little — waive it until a studio closes four a month.'],
  ];

  let y = 2.75;
  risks.forEach((r) => {
    card(s, M, y, 11.93, 0.92, { fill: PAPER, line: RULE });
    s.addText(r[0], {
      isTextBox: true,
      x: M + 0.28,
      y: y + 0.06,
      w: 4.5,
      h: 0.8,
      fontFace: BODY,
      fontSize: 13.5,
      bold: true,
      color: INK,
      lineSpacingMultiple: 1.1,
      margin: 0,
      valign: 'middle',
    });
    s.addText(r[1], {
      isTextBox: true,
      x: M + 4.85,
      y: y + 0.06,
      w: 1.0,
      h: 0.8,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: TERRACOTTA,
      margin: 0,
      valign: 'middle',
    });
    s.addText(r[2], {
      isTextBox: true,
      x: M + 5.95,
      y: y + 0.06,
      w: 5.85,
      h: 0.8,
      fontFace: BODY,
      fontSize: 11.5,
      color: INK_2,
      lineSpacingMultiple: 1.15,
      margin: 0,
      valign: 'middle',
    });
    y += 1.0;
  });

  s.addText(
    'None of these are discovered late. The instrumentation to catch all four is already built and running.',
    {
      isTextBox: true,
      x: M,
      y: 6.85,
      w: 11.93,
      h: 0.45,
      fontFace: HEAD,
      fontSize: 16,
      bold: true,
      color: PETROL,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes(
    'Close on this rather than on a hockey stick. The pitch is not that this cannot fail — it is that we will know which way within a quarter, and for twenty lakh rather than two crore.',
  );
}

const out = path.join(__dirname, '..', 'docs', 'pitch-deck.pptx');
pres
  .writeFile({ fileName: out })
  .then(() => console.log('Wrote ' + out))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
