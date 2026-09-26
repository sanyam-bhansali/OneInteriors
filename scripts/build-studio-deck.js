/**
 * The studio onboarding deck.
 *
 * Built to be presented ALONGSIDE the live software, not instead of it. Three
 * dark "switch to the software" slides mark the handoffs; the speaker notes on
 * each say exactly what to open and what to say while it loads. Everything the
 * software can show, the software shows — the deck carries only what a screen
 * cannot: the money, the boundaries, and the promise.
 *
 * Figures are read from the repo, not invented:
 *   src/modules/studio/subscription.ts  — tiers, fees, guaranteed briefs
 *   docs/STUDIO-AGREEMENT.md            — commission, reporting, termination
 *   src/modules/studio/onboarding-steps — the five onboarding steps
 */

const pptx = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const REPO = '/sessions/wonderful-laughing-albattani/mnt/OneInteriors';
const OUT = path.join(REPO, 'docs', 'One-Interiors-Studio-Deck.pptx');

/* ---- palette: "Tactile Assurance", locked in CLAUDE.md ---------------- */
const BG = 'EAE6DF'; // raw silk
const CARD = 'FCFCFA'; // alabaster
const INK = '2C2624'; // deep espresso
const INK2 = '6B615C'; // secondary ink
const ACC = 'C0613C'; // terracotta — high-intent only
const SAGE = '839073'; // verification, good news
const LINE = 'DBD5CB'; // hairline
const ONDARK = 'CFC8BF'; // secondary ink on espresso
const ONDARK3 = '8E847C';

/* Serif for headings, sans for body, mono for evidence — the type system is
   the one thing that carries across both surfaces (CLAUDE.md). Cambria and
   Calibri stand in for Instrument Serif and Instrument Sans, which are not
   Office fonts; Courier New stands in for IBM Plex Mono. */
const SERIF = 'Cambria';
const SANS = 'Calibri';
const MONO = 'Courier New';

const W = 13.333;
const H = 7.5;
const M = 0.85; // side margin

const p = new pptx();
p.layout = 'LAYOUT_WIDE';
p.author = 'One Interiors';
p.company = 'One Interiors';
p.title = 'One Interiors — Studio Partnership';

/* ---------- small helpers ---------------------------------------------- */

function eyebrow(s, text, opts = {}) {
  s.addText(text.toUpperCase(), {
    x: opts.x ?? M,
    y: opts.y ?? 0.62,
    w: opts.w ?? 8,
    h: 0.26,
    fontFace: MONO,
    fontSize: 10,
    charSpacing: 2.4,
    color: opts.color ?? INK2,
    isTextBox: true,
    margin: 0,
    valign: 'middle',
  });
}

function title(s, text, opts = {}) {
  s.addText(text, {
    x: opts.x ?? M,
    y: opts.y ?? 1.05,
    w: opts.w ?? 10.4,
    h: opts.h ?? 1.15,
    fontFace: SERIF,
    fontSize: opts.size ?? 33,
    color: opts.color ?? INK,
    isTextBox: true,
    margin: 0,
    lineSpacingMultiple: 1.06,
    valign: 'top',
  });
}

function standfirst(s, text, opts = {}) {
  s.addText(text, {
    x: opts.x ?? M,
    y: opts.y ?? 2.3,
    w: opts.w ?? 9.4,
    h: opts.h ?? 0.75,
    fontFace: SANS,
    fontSize: opts.size ?? 15,
    color: opts.color ?? INK2,
    isTextBox: true,
    margin: 0,
    lineSpacingMultiple: 1.26,
  });
}

/** A card. Tint and shadow only — no edge stripes. */
function card(s, x, y, w, h, opts = {}) {
  s.addShape(p.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: { color: opts.fill ?? CARD },
    line: { color: opts.line ?? LINE, width: 0.75 },
    shadow: {
      type: 'outer',
      angle: 90,
      blur: 10,
      offset: 2,
      color: '9A9086',
      opacity: 0.16,
    },
  });
}

function foot(s, text) {
  s.addText(text, {
    x: M,
    y: H - 0.72,
    w: W - M * 2,
    h: 0.32,
    fontFace: SANS,
    fontSize: 10.5,
    italic: true,
    color: INK2,
    isTextBox: true,
    margin: 0,
  });
}

function light() {
  const s = p.addSlide();
  s.background = { color: BG };
  return s;
}

function dark() {
  const s = p.addSlide();
  s.background = { color: INK };
  return s;
}

/*
 * The real logotype, on every slide.
 *
 * Rasterised from the LOGO_D path in src/components/brand.tsx by
 * scripts/build-deck-logo.js rather than redrawn, so the deck cannot drift
 * from the product. Two colourways because a single one would be invisible on
 * half the slides: ink on the beige grounds, light on the espresso ones.
 *
 * The artwork is 1072 x 560, so height is always width / 1.914 — pinning both
 * axes independently would squash it.
 */
const LOGO_INK = path.join(REPO, 'docs', 'assets', 'logo-ink.png');
const LOGO_LIGHT = path.join(REPO, 'docs', 'assets', 'logo-light.png');
const LOGO_RATIO = 1072 / 560;

function logo(s, { x, y, w, onDark = false }) {
  s.addImage({
    path: onDark ? LOGO_LIGHT : LOGO_INK,
    x,
    y,
    w,
    h: w / LOGO_RATIO,
  });
}

/** The running corner mark, opposite the eyebrow. */
function mark(s, onDark = false) {
  logo(s, { x: W - M - 0.95, y: 0.45, w: 0.95, onDark });
}

/** The three demo hand-off slides all look identical on purpose. */
function demoSlide(n, heading, bullets, notes) {
  const s = dark();
  mark(s, true);

  s.addText(`DEMO ${n}`, {
    x: M,
    y: 1.9,
    w: 4,
    h: 0.34,
    fontFace: MONO,
    fontSize: 12,
    charSpacing: 3,
    color: ACC,
    isTextBox: true,
    margin: 0,
  });

  s.addText('Switch to the software', {
    x: M,
    y: 2.4,
    w: 10,
    h: 0.9,
    fontFace: SERIF,
    fontSize: 40,
    color: 'FFFFFF',
    isTextBox: true,
    margin: 0,
  });

  s.addText(heading, {
    x: M,
    y: 3.42,
    w: 9.6,
    h: 0.5,
    fontFace: SANS,
    fontSize: 16,
    color: ONDARK,
    isTextBox: true,
    margin: 0,
  });

  bullets.forEach((b, i) => {
    const y = 4.15 + i * 0.48;
    s.addShape(p.ShapeType.ellipse, {
      x: M + 0.02,
      y: y + 0.09,
      w: 0.13,
      h: 0.13,
      fill: { color: ACC },
      line: { type: 'none' },
    });
    s.addText(b, {
      x: M + 0.36,
      y,
      w: 10.6,
      h: 0.4,
      fontFace: SANS,
      fontSize: 13.5,
      color: ONDARK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
  });

  s.addText('Come back to the deck when you are done.', {
    x: M,
    y: H - 0.78,
    w: 8,
    h: 0.3,
    fontFace: MONO,
    fontSize: 10,
    charSpacing: 1.6,
    color: ONDARK3,
    isTextBox: true,
    margin: 0,
  });

  s.addNotes(notes);
  return s;
}

/* ====================================================================== */
/* 1 — cover                                                              */
/* ====================================================================== */
{
  const s = dark();
  logo(s, { x: M, y: 0.8, w: 2.1, onDark: true });

  s.addText('For the studio', {
    x: M,
    y: 2.2,
    w: 5,
    h: 0.3,
    fontFace: MONO,
    fontSize: 10.5,
    charSpacing: 2.6,
    color: ONDARK3,
    isTextBox: true,
    margin: 0,
  });

  s.addText(
    [
      { text: 'We don’t provide leads.', options: { breakLine: true } },
      { text: 'We provide introductions.', options: { color: ACC } },
    ],
    {
      x: M,
      y: 2.6,
      w: 11,
      h: 2.0,
      fontFace: SERIF,
      fontSize: 50,
      color: 'FFFFFF',
      isTextBox: true,
      margin: 0,
      lineSpacingMultiple: 1.06,
    },
  );

  s.addText(
    'A curated marketplace for interior design in Pune. The homeowner has answered nine questions, seen a real price built from your own rates, compared it against two other studios, and spoken to our architect — before your phone rings.',
    {
      x: M,
      y: 4.85,
      w: 9.2,
      h: 1.1,
      fontFace: SANS,
      fontSize: 15,
      color: ONDARK,
      isTextBox: true,
      margin: 0,
      lineSpacingMultiple: 1.3,
    },
  );

  s.addText('Pune  ·  2026', {
    x: M,
    y: H - 0.85,
    w: 6,
    h: 0.3,
    fontFace: MONO,
    fontSize: 10,
    charSpacing: 2,
    color: ONDARK3,
    isTextBox: true,
    margin: 0,
  });

  s.addNotes(
    [
      'OPEN HERE. Do not start the software yet.',
      '',
      'Say the hero line out loud and then stop talking for a second. It is the',
      'whole pitch: a lead is a phone number, an introduction is a person who',
      'already knows what the work costs.',
      '',
      'Ask one question before moving on: "How many enquiries did you take last',
      'month, and how many became projects?" Write their answer down — you will',
      'use their own number on the pricing slide.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 2 — the problem, from their side                                       */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'The problem');
  title(s, 'A lead is not the expensive part.\nThe ones that go nowhere are.');
  standfirst(
    s,
    'You already have enquiries. What you do not have is a way to tell, on the first call, which one is real — so the cost of a booked project is not the ad that produced it, it is everything spent on the ones that did not.',
    { w: 10.6 },
  );

  const items = [
    ['Site visits', 'An hour there, an hour back, for a homeowner still deciding whether to do the kitchen at all.'],
    ['Quotations', 'Sixty to a hundred and twenty line items, four or five revisions, most of them for people who never sign.'],
    ['Price discovery', 'The first conversation is spent explaining why interiors cost what they cost, again.'],
    ['Silence', 'No answer is the most common answer, and you never learn why.'],
  ];

  items.forEach(([h, b], i) => {
    const x = M + i * 3.02;
    card(s, x, 3.6, 2.78, 2.35);
    s.addText(String(i + 1).padStart(2, '0'), {
      x: x + 0.28,
      y: 3.85,
      w: 1,
      h: 0.3,
      fontFace: MONO,
      fontSize: 11,
      charSpacing: 1.5,
      color: ACC,
      isTextBox: true,
      margin: 0,
    });
    s.addText(h, {
      x: x + 0.28,
      y: 4.2,
      w: 2.25,
      h: 0.34,
      fontFace: SERIF,
      fontSize: 17,
      color: INK,
      isTextBox: true,
      margin: 0,
    });
    s.addText(b, {
      x: x + 0.28,
      y: 4.62,
      w: 2.25,
      h: 1.2,
      fontFace: SANS,
      fontSize: 11.5,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.2,
    });
  });

  foot(s, 'None of this is a marketing problem. It is a qualification problem, and it happens before you ever meet anyone.');

  s.addNotes(
    [
      'Let them talk here. This slide is a prompt, not a lecture.',
      '',
      'The point to land: they are not short of enquiries, they are short of',
      'QUALIFIED ones, and the cost of the unqualified ones is invisible because',
      'it is their own time.',
      '',
      'If they say "my conversion is fine", ask what it is. Anything under one in',
      'five makes the rest of this deck argue itself.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 3 — lead vs introduction                                               */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'The difference');
  title(s, 'What arrives, and what we send.');
  standfirst(s, 'The same homeowner, at two different points in their thinking.', { w: 9 });

  card(s, M, 3.1, 5.35, 3.3, { fill: 'E4DFD7' });
  card(s, M + 5.75, 3.1, 5.9, 3.3);

  s.addText('A LEAD', {
    x: M + 0.42,
    y: 3.42,
    w: 4,
    h: 0.3,
    fontFace: MONO,
    fontSize: 11,
    charSpacing: 2.4,
    color: INK2,
    isTextBox: true,
    margin: 0,
  });
  s.addText('AN INTRODUCTION', {
    x: M + 6.17,
    y: 3.42,
    w: 4,
    h: 0.3,
    fontFace: MONO,
    fontSize: 11,
    charSpacing: 2.4,
    color: ACC,
    isTextBox: true,
    margin: 0,
  });

  const leftRows = [
    'A name and a number.',
    'Budget unknown, or guessed.',
    'Has not seen a price for anything.',
    'Talking to six studios, or to none.',
    'You qualify them, at your cost.',
  ];
  const rightRows = [
    'Nine answered questions about their home.',
    'A budget band they chose with the numbers in front of them.',
    'A full quotation, built from YOUR rate card.',
    'Your quote compared against two others, materials and all.',
    'An architect of ours has already spoken to them.',
  ];

  leftRows.forEach((t, i) => {
    s.addText(t, {
      x: M + 0.42,
      y: 3.92 + i * 0.47,
      w: 4.55,
      h: 0.42,
      fontFace: SANS,
      fontSize: 13,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
  });
  rightRows.forEach((t, i) => {
    s.addShape(p.ShapeType.ellipse, {
      x: M + 6.17,
      y: 4.06 + i * 0.47,
      w: 0.12,
      h: 0.12,
      fill: { color: SAGE },
      line: { type: 'none' },
    });
    s.addText(t, {
      x: M + 6.5,
      y: 3.92 + i * 0.47,
      w: 4.9,
      h: 0.42,
      fontFace: SANS,
      fontSize: 13,
      color: INK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
  });

  foot(s, 'We do not sell you the name on the left. We do the work in between, and send you the one on the right.');

  s.addNotes(
    [
      'This is the slide the whole meeting hangs on. Do not rush it.',
      '',
      'Read the right column top to bottom. Each line is work someone has to do',
      'before a project can start — today the studio does all of it, unpaid, on',
      'every enquiry including the ones that die.',
      '',
      'Then: "That is what the five percent is for. Not the name — the five',
      'things underneath it."',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 4 — the five steps before you                                          */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'Before your phone rings');
  title(s, 'Five things happen, and you are in none of them.');
  standfirst(
    s,
    'This is the part that costs us money and costs you nothing. By the time you are introduced, the homeowner has already been through all five.',
    { w: 10.4 },
  );

  const steps = [
    ['OneQuiz', 'Nine questions, about three minutes. They learn the vocabulary as they answer — we never ask a first-time buyer a question they cannot answer.'],
    ['OneMatch', 'Studios ranked by fit, each with the sentence explaining why. Nobody can pay to sit higher.'],
    ['OneQuote', 'A full quotation generated from your own filed rate card in about three seconds. Nobody phones you. You are not asked for anything.'],
    ['OneCompare', 'Your quote beside two others — and the materials behind them. Carcass, shutter, hardware.'],
    ['OneExpert', 'Our architect calls them, having read all of it, before any introduction is made.'],
  ];

  steps.forEach(([h, b], i) => {
    const x = M + i * 2.42;
    s.addShape(p.ShapeType.ellipse, {
      x,
      y: 3.45,
      w: 0.46,
      h: 0.46,
      fill: { color: i === 4 ? ACC : INK },
      line: { type: 'none' },
    });
    s.addText(String(i + 1), {
      x,
      y: 3.45,
      w: 0.46,
      h: 0.46,
      fontFace: MONO,
      fontSize: 13,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
      isTextBox: true,
      margin: 0,
    });
    s.addText(h, {
      x,
      y: 4.08,
      w: 2.2,
      h: 0.35,
      fontFace: SERIF,
      fontSize: 18,
      color: INK,
      isTextBox: true,
      margin: 0,
    });
    s.addText(b, {
      x,
      y: 4.52,
      w: 2.18,
      h: 1.9,
      fontFace: SANS,
      fontSize: 11.5,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.22,
    });
  });

  foot(s, 'Every one of these is built and running today. You are about to see it.');

  s.addNotes(
    [
      'Name the five quickly — do not explain them here, the demo does that.',
      '',
      'The one line worth pausing on is OneQuote: "the first quotation is',
      'generated by our system from your own rate card, in about three seconds.',
      'Nobody rings you. You are not asked to quote." Studios expect to be asked',
      'to quote for free, and this is the moment they realise they are not.',
      '',
      'Then go straight to the demo slide.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 5 — DEMO 1                                                             */
/* ====================================================================== */
demoSlide(
  1,
  'Walk the homeowner’s journey, as a homeowner. Do not explain the screens — let them watch.',
  [
    'The brief — answer three or four questions out loud, then skip to the end',
    'The tier screen — show that the budget band is chosen with real numbers on screen',
    'The matches — read one match reason aloud, and point at "nobody can pay to sit higher"',
    'The quote — open it. This is the moment. A full quotation, their rates, no phone call',
    'The comparison — show the materials row, not just the totals',
  ],
  [
    'BEFORE THE MEETING: have the customer flow already open in a tab, one',
    'brief part-completed, so nothing has to load in front of them.',
    '',
    'Run it as the homeowner, not as the operator. Narrate as little as you can',
    'stand to. The screens are the argument.',
    '',
    'Stop at the comparison screen. Do NOT go into the studio software yet —',
    'that is demo 2 and it answers a different question.',
    '',
    'If they ask "whose rates are those?" — that is the best question in the',
    'meeting. Answer: "yours, once you have filed them. Today it is a pilot rate',
    'card built from a real Pune archive." Then move on.',
  ].join('\n'),
);

/* ====================================================================== */
/* 6 — so who reaches you                                                 */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'What that means for you');
  title(s, 'The first call is about the work.');
  standfirst(
    s,
    'Not about price, not about whether interiors are expensive, not about whether they are serious. All three are settled before you are introduced.',
    { w: 10.2 },
  );

  const stats = [
    ['Nine', 'questions answered about their home, their rooms and how they live in it'],
    ['One', 'full quotation already seen — built from your rates, not a guess'],
    ['Zero', 'free quotes you produced to get there'],
  ];

  stats.forEach(([n, b], i) => {
    const x = M + i * 3.85;
    card(s, x, 3.5, 3.55, 2.4);
    s.addText(n, {
      x: x + 0.35,
      y: 3.78,
      w: 2.9,
      h: 0.95,
      fontFace: SERIF,
      fontSize: 48,
      color: i === 2 ? ACC : INK,
      isTextBox: true,
      margin: 0,
    });
    s.addText(b, {
      x: x + 0.35,
      y: 4.82,
      w: 2.85,
      h: 0.95,
      fontFace: SANS,
      fontSize: 12.5,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.22,
    });
  });

  foot(s, 'And an architect of ours has already spoken to them, so you are not the one finding out they wanted a false ceiling.');

  s.addNotes(
    [
      'Short slide. The third card is the one that matters — "zero free quotes',
      'you produced to get there."',
      '',
      'Say it plainly: "You have not quoted. You have not visited. You have not',
      'spent a Saturday. And the person on the phone has already seen a price."',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 7 — position cannot be bought                                          */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'The rule that makes it worth being on');
  title(s, 'A subscription buys volume.\nIt never buys position.');
  standfirst(
    s,
    'How many briefs you are shown for is something you pay us to increase. Where you appear inside one homeowner’s results is computed from fit, and no amount of money moves it.',
    { w: 10.6 },
  );

  const rules = [
    ['No paid placement', 'No sponsored slots, no featured cards, no promoted results. Nowhere in the product.'],
    ['The engine cannot see your fee', 'The matching code has no access to what you pay. It is a different module, by design.'],
    ['A test enforces it', 'A build test reads the matching source and fails if it so much as mentions subscription or boost. It is not a policy, it is a wall.'],
  ];

  rules.forEach(([h, b], i) => {
    const x = M + i * 3.85;
    card(s, x, 3.75, 3.55, 2.15);
    s.addText(h, {
      x: x + 0.35,
      y: 4.02,
      w: 2.85,
      h: 0.62,
      fontFace: SERIF,
      fontSize: 17,
      color: INK,
      isTextBox: true,
      margin: 0,
      lineSpacingMultiple: 1.05,
    });
    s.addText(b, {
      x: x + 0.35,
      y: 4.72,
      w: 2.85,
      h: 1.05,
      fontFace: SANS,
      fontSize: 12,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.22,
    });
  });

  foot(s, 'This is in the agreement as clause 2.4, not only in this deck.');

  s.addNotes(
    [
      'This slide protects you from the studio who assumes the biggest cheque',
      'wins. Say it before they ask.',
      '',
      'It is also the reason a good studio should want to be on: on a platform',
      'where position is for sale, being good is worth nothing.',
      '',
      'Point at the clause number. It is a contractual promise, not marketing.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 8 — verification                                                       */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'Why the roster is worth being on');
  title(s, 'Twelve checks before anyone is listed.');
  standfirst(
    s,
    'People ring your past clients. Somebody visits a finished site. The registration is checked against public records. It is slow on purpose — the roster is only worth something if it is hard to get onto.',
    { w: 10.6 },
  );

  const checks = [
    'Company registration, against public records',
    'GSTIN, verified',
    'Past clients, telephoned',
    'A completed site, visited in person',
    'Portfolio work confirmed as your own',
    'Rate card sense-checked against the archive',
  ];

  checks.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * 5.8;
    const y = 3.62 + row * 0.62;
    s.addShape(p.ShapeType.ellipse, {
      x,
      y: y + 0.1,
      w: 0.2,
      h: 0.2,
      fill: { color: SAGE },
      line: { type: 'none' },
    });
    s.addText(t, {
      x: x + 0.42,
      y,
      w: 5,
      h: 0.42,
      fontFace: SANS,
      fontSize: 13.5,
      color: INK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
  });

  card(s, M, 5.75, 11.6, 0.92, { fill: 'E4DFD7' });
  s.addText(
    'The badge on your listing is not decoration. Every check carries a date and a source, and a homeowner can read what was checked and when.',
    {
      x: M + 0.4,
      y: 5.95,
      w: 10.8,
      h: 0.55,
      fontFace: SANS,
      fontSize: 13,
      color: INK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    },
  );

  s.addNotes(
    [
      'Six of the twelve are on the slide — enough to make the point. If they ask',
      'for all twelve, say you will send the list, and do.',
      '',
      'The framing that works: "This is the part that is annoying for you and',
      'valuable to you at the same time. It is annoying because it takes two',
      'weeks. It is valuable because it is why the homeowner believes the badge."',
      '',
      'Expect the question: "how many studios are on?" Answer honestly. The',
      'roster is capped at about fifty for Pune, and early partners are being',
      'chosen, not collected.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 9 — your side: onboarding                                              */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'What you do');
  title(s, 'Five steps, and the fourth is the only long one.');
  standfirst(
    s,
    'You can stop halfway and come back — everything saves as you type. Most of it is facts you already have written down somewhere.',
    { w: 10 },
  );

  const steps = [
    ['Profile', 'Who you are, what you do, where you work. Ten minutes.'],
    ['Registration', 'Company details, GSTIN, the documents. Upload and move on.'],
    ['Your work', 'Projects with photographs. This is what a homeowner actually looks at.'],
    ['Your rates', 'The rate card. Or upload old quotations and we build it for you.'],
    ['Review', 'You send it. We verify. You are listed.'],
  ];

  steps.forEach(([h, b], i) => {
    const x = M + i * 2.42;
    const isRates = i === 3;
    card(s, x, 3.4, 2.22, 2.6, isRates ? { fill: 'F3E7E0' } : {});
    s.addText(`STEP ${i + 1}`, {
      x: x + 0.26,
      y: 3.65,
      w: 1.7,
      h: 0.26,
      fontFace: MONO,
      fontSize: 9.5,
      charSpacing: 1.6,
      color: isRates ? ACC : INK2,
      isTextBox: true,
      margin: 0,
    });
    s.addText(h, {
      x: x + 0.26,
      y: 3.98,
      w: 1.75,
      h: 0.36,
      fontFace: SERIF,
      fontSize: 18,
      color: INK,
      isTextBox: true,
      margin: 0,
    });
    s.addText(b, {
      x: x + 0.26,
      y: 4.44,
      w: 1.72,
      h: 1.4,
      fontFace: SANS,
      fontSize: 11.5,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.22,
    });
  });

  foot(s, 'Upload your last twenty quotations and step four writes itself. That is the single biggest time-saver in the whole process.');

  s.addNotes(
    [
      'The objection you are defusing here is "I do not have time for this."',
      '',
      'So lead with the archive upload: they hand over old quotation PDFs, our',
      'system reads them, and their product list and rates come out the other',
      'end. They check it rather than type it.',
      '',
      'Be honest that step 3, the portfolio, is the one that needs real effort —',
      'good photographs of finished work. It is also the one that earns them the',
      'most, so it is worth their evening.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 10 — DEMO 2                                                            */
/* ====================================================================== */
demoSlide(
  2,
  'Open the onboarding as if they were signing up. This is the demo that converts — they are watching their own next hour.',
  [
    'Start at step 1 and move fast — they need to see how short it is',
    'Stop properly at step 4, Your rates — this is the engine',
    'Show the archive upload: drop in an old quotation and let them watch it read it',
    'Show a filed rate turning into a line on a real quotation',
    'End on Review — what we check, and how long it takes',
  ],
  [
    'BEFORE THE MEETING: have a part-finished onboarding ready, and a sample',
    'quotation PDF on the desktop to drag in. Never upload a real studio’s',
    'document in front of another studio.',
    '',
    'The moment to slow down for: the archive upload. Watching a PDF turn into a',
    'rate table is the thing studios remember afterwards.',
    '',
    'If they ask "who sees my rates?" — answer it now, do not defer it. Their',
    'rates are used to quote on their behalf and for nothing else. Never shown',
    'to another studio, never sold, never used to train anything.',
  ].join('\n'),
);

/* ====================================================================== */
/* 11 — the software they get                                             */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'And then it is yours to use');
  title(s, 'The quotation builder is not a bonus.\nIt is most of the value.');
  standfirst(
    s,
    'A ₹8–10 lakh quotation is sixty to a hundred and twenty lines, revised four or five times, usually in Excel. "That is not what you quoted" is the most common dispute in the category.',
    { w: 10.6 },
  );

  const feats = [
    ['Pick a BHK, get a quotation', 'Rooms, products and quantities proposed from the configuration — then you edit. It starts at ninety percent, not at zero.'],
    ['Every line carries its spec', 'Quantity, size and material on the line itself. Carcass, shutter, hardware — the things arguments are actually about.'],
    ['Revisions you can prove', 'Issue a version and it is snapshotted. What changed between revision two and revision three is a screen, not an argument.'],
    ['Your name on it, not ours', 'Your logo, your terms, your document. Our line at the foot comes off on a paid plan.'],
  ];

  feats.forEach(([h, b], i) => {
    const x = M + (i % 2) * 5.95;
    const y = 3.5 + Math.floor(i / 2) * 1.6;
    card(s, x, y, 5.6, 1.4);
    s.addText(h, {
      x: x + 0.38,
      y: y + 0.2,
      w: 4.9,
      h: 0.34,
      fontFace: SERIF,
      fontSize: 17,
      color: INK,
      isTextBox: true,
      margin: 0,
    });
    s.addText(b, {
      x: x + 0.38,
      y: y + 0.6,
      w: 4.9,
      h: 0.7,
      fontFace: SANS,
      fontSize: 12,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.2,
    });
  });

  foot(s, 'Plus a client board, a vendor ledger, and every introduction we send you, in one place.');

  s.addNotes(
    [
      'Studios undervalue this until they see it, and overvalue it afterwards.',
      'Do not oversell — demo 3 does the work.',
      '',
      'The line that lands: "you are already doing this in Excel, badly, at',
      'eleven at night."',
      '',
      'If they ask about the watermark — be straightforward. Our attribution is',
      'one line under their GSTIN, and it comes off on a paid plan. Do not quote',
      'a price for that here; it is not settled.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 12 — DEMO 3                                                            */
/* ====================================================================== */
demoSlide(
  3,
  'The studio software. Build a quotation in front of them, from nothing, in two minutes.',
  [
    'The client board — drag a client from enquiry to quoted',
    'New quotation: pick 2 BHK and let it propose the rooms and lines',
    'Edit one rate and watch every total move',
    'Issue it, change something, and open the changes tab',
    'The document — their logo, their terms, their name at the top',
  ],
  [
    'This is the demo where you can be slow and let them drive if they want to.',
    'Hand them the laptop if the room is right for it.',
    '',
    'Build a quotation from scratch. Do not use a saved one — the speed is the',
    'point, and a prepared quotation looks like a prepared quotation.',
    '',
    'Finish on the issued document with a studio logo on it. That image — their',
    'brand on a professional quotation — is what they take home.',
    '',
    'Then go straight to money. Do not let the demo trail off.',
  ].join('\n'),
);

/* ====================================================================== */
/* 13 — your own clients                                                  */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'The boundary');
  title(s, 'Your own clients are yours.\nWe charge nothing on them, ever.');
  standfirst(
    s,
    'A homeowner you found by any other means — a referral, your Instagram, a neighbour, a hoarding — is entirely yours. No commission. And the software is free to use for that project.',
    { w: 10.6 },
  );

  const rows = [
    ['A homeowner we introduce', '5% of the contract value', ACC],
    ['A client you found yourself', 'Nothing. Zero. And the software is free for it.', SAGE],
  ];

  rows.forEach(([l, r, c], i) => {
    const y = 3.65 + i * 1.22;
    card(s, M, y, 11.6, 1.02, i === 1 ? { fill: 'EAEDE6' } : {});
    s.addText(l, {
      x: M + 0.42,
      y: y + 0.24,
      w: 5,
      h: 0.55,
      fontFace: SERIF,
      fontSize: 20,
      color: INK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
    s.addText(r, {
      x: M + 5.8,
      y: y + 0.24,
      w: 5.4,
      h: 0.55,
      fontFace: SANS,
      fontSize: 15,
      bold: true,
      color: c,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
  });

  card(s, M, 6.15, 11.6, 0.72, { fill: 'E4DFD7' });
  s.addText(
    'Your client list, your rates and your quotations are yours. Never shown to another studio, never sold, never used to train anything. That is clause 5 of the agreement.',
    {
      x: M + 0.42,
      y: 6.25,
      w: 10.8,
      h: 0.5,
      fontFace: SANS,
      fontSize: 12.5,
      color: INK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    },
  );

  s.addNotes(
    [
      'Every studio is quietly worried you will take their existing book. Say',
      'this before they ask it — asking it out loud is awkward for them and',
      'volunteering it buys a lot of trust.',
      '',
      'Clause 4.3 is the free-for-their-own-clients promise; clause 5 is data.',
      'Both are in the agreement you are leaving with them.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 14 — what the bands actually mean                                      */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'Before the price — which band are you?');
  title(s, 'A band is a rate per square foot.\nIt is not the size of the cheque.');
  standfirst(
    s,
    'This is the distinction everyone gets wrong, so it is worth a minute. What decides your band is what you charge for a square foot of finished home — which is really a statement about materials and design time, not about how big the project was.',
    { w: 10.8, h: 0.9 },
  );

  const bands = [
    ['Essential', '₹1,200 – ₹1,500', 'Furnishing only. The work gets made and fitted, well, with nothing spent on show.'],
    ['Premium', '₹1,500 – ₹2,500', 'Furnishing, plus a designer and project management through the build, plus pieces designed for the room rather than picked off a list.'],
    ['Luxury', '₹2,500 and above', 'Everything in Premium, in premium materials — veneer, leatherette, the specified finishes rather than the available ones.'],
  ];

  bands.forEach(([n, rate, mats], i) => {
    const x = M + i * 3.85;
    card(s, x, 3.55, 3.55, 1.95);
    s.addText(n, {
      x: x + 0.35,
      y: 3.75,
      w: 2.9,
      h: 0.32,
      fontFace: SERIF,
      fontSize: 18,
      color: INK,
      isTextBox: true,
      margin: 0,
    });
    s.addText([{ text: rate }, { text: ' /sqft', options: { fontSize: 11, color: INK2 } }], {
      x: x + 0.35,
      y: 4.12,
      w: 3,
      h: 0.32,
      fontFace: MONO,
      fontSize: 14,
      color: ACC,
      isTextBox: true,
      margin: 0,
    });
    s.addText(mats, {
      x: x + 0.35,
      y: 4.5,
      w: 2.85,
      h: 0.95,
      fontFace: SANS,
      fontSize: 10.5,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.2,
    });
  });

  /* The worked example. This is the whole slide, really. */
  card(s, M, 5.66, 11.6, 0.98, { fill: 'F3E7E0' });
  s.addText('THE SAME ₹25 LAKH', {
    x: M + 0.42,
    y: 5.82,
    w: 3,
    h: 0.28,
    fontFace: MONO,
    fontSize: 10,
    charSpacing: 2,
    color: ACC,
    isTextBox: true,
    margin: 0,
  });
  s.addText(
    [
      { text: '₹25 L on a 2 BHK', options: { bold: true, color: INK } },
      { text: ' is about ₹2,800 a square foot — that is Luxury.    ', options: { color: INK2 } },
      { text: '₹25 L on a 4 BHK', options: { bold: true, color: INK } },
      { text: ' is about ₹1,500 — that is Premium.', options: { color: INK2 } },
    ],
    {
      x: M + 0.42,
      y: 6.12,
      w: 10.8,
      h: 0.42,
      fontFace: SANS,
      fontSize: 12.5,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    },
  );

  foot(s, 'You tell us which band you work in. We confirm it against your rate card — and if we disagree, we say so before you are listed, not after.');

  s.addNotes(
    [
      'Do this slide BEFORE the price slide. A studio that has placed itself in',
      'a band argues with the fee far less than one who is told which band it is',
      'in and then told what that costs.',
      '',
      'The ₹25 lakh example is the whole slide. Read both halves out loud.',
      'Everyone in this market talks about project size; almost nobody talks',
      'about rate per square foot, which is the number that actually describes',
      'what a studio does.',
      '',
      'Then ask directly: "Where do you sit?" Let them answer before you turn',
      'the page. Their answer is the tier they will sign up for.',
      '',
      'If they claim Luxury and their rate card says Essential, do not argue in',
      'the room — say verification confirms the band, and move on.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 15 — the rate card, already discounted                                 */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'The rate card');
  title(s, 'What each band costs — and what it costs you to start.');
  standfirst(
    s,
    'The subscription holds your place on a capped roster and puts briefs in front of you. The five percent is only ever on a project you actually close through us. For the first three months the subscription is discounted to a rupee.',
    { w: 10.9, h: 0.85 },
  );

  /* A rate card is a table and should look like one: the eye compares down a
     column, and the discount only reads as a discount beside the price it
     came off. */
  const COLS = [M, M + 3.9, M + 6.9, M + 9.55];
  const HEADS = ['Band', 'Your rate', 'Subscription', 'First 3 months'];

  HEADS.forEach((h, i) => {
    s.addText(h.toUpperCase(), {
      x: COLS[i],
      y: 3.5,
      w: 3.4,
      h: 0.3,
      fontFace: MONO,
      fontSize: 9.5,
      charSpacing: 1.8,
      color: INK2,
      isTextBox: true,
      margin: 0,
    });
  });

  const rows = [
    ['Essential', 'Furnishing only', '₹1,200 – ₹1,500 /sqft', '₹25,000', '₹1'],
    ['Premium', '+ designer and project management', '₹1,500 – ₹2,500 /sqft', '₹49,000', '₹1'],
    ['Luxury', '+ premium materials', '₹2,500 and above', '₹99,000', '₹1'],
  ];

  rows.forEach(([name, note, rate, fee], i) => {
    const y = 3.92 + i * 0.94;
    card(s, M - 0.3, y, 11.9, 0.86, i === 1 ? { fill: 'F3E7E0' } : {});

    s.addText(name, {
      x: COLS[0],
      y: y + 0.08,
      w: 3.6,
      h: 0.34,
      fontFace: SERIF,
      fontSize: 19,
      color: INK,
      isTextBox: true,
      margin: 0,
    });
    s.addText(note, {
      x: COLS[0],
      y: y + 0.44,
      w: 3.7,
      h: 0.32,
      fontFace: SANS,
      fontSize: 11,
      color: INK2,
      isTextBox: true,
      margin: 0,
    });
    s.addText(rate, {
      x: COLS[1],
      y: y + 0.22,
      w: 3,
      h: 0.42,
      fontFace: MONO,
      fontSize: 13,
      color: INK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
    s.addText(
      [
        { text: fee, options: { strike: true } },
        { text: ' /mo', options: { fontSize: 11 } },
      ],
      {
      x: COLS[2],
      y: y + 0.22,
      w: 2.5,
      h: 0.42,
      fontFace: MONO,
      fontSize: 16,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    },
    );
    s.addText([{ text: '₹1' }, { text: ' /mo', options: { fontSize: 11, color: INK2 } }], {
      x: COLS[3],
      y: y + 0.22,
      w: 2.4,
      h: 0.42,
      fontFace: MONO,
      fontSize: 22,
      color: ACC,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
  });

  card(s, M - 0.3, 6.58, 11.9, 0.6, { fill: 'E4DFD7' });
  s.addText(
    [
      { text: 'Plus 5% of the contract value ', options: { bold: true, color: INK } },
      {
        text: 'on a project you close through us — during the discounted months as well. Nothing on your own clients, ever.',
        options: { color: INK2 },
      },
    ],
    {
      x: M,
      y: 6.62,
      w: 11.2,
      h: 0.52,
      fontFace: SANS,
      fontSize: 12,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    },
  );

  s.addNotes(
    [
      'The whole commercial offer on one page. Let them read it before you talk.',
      '',
      'Read the struck-through column out loud — "Premium is forty-nine thousand',
      'a month" — and only then the rupee. A discount only lands beside the price',
      'it came off; if you lead with the rupee it sounds free, and free is what',
      'people do not value.',
      '',
      'Then the line that does the work: "the five percent still applies in those',
      'three months. We earn when you earn, and nothing when you do not."',
      '',
      'Next slide is the terms — what happens in month four. Do not skip it.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* ====================================================================== */
/* 16 — the offer                                                         */
/* ====================================================================== */
{
  const s = dark();
  mark(s, true);
  eyebrow(s, 'To start', { color: ONDARK3 });
  title(s, 'Three months at one rupee.', { color: 'FFFFFF', size: 38 });
  standfirst(
    s,
    'Not a free trial. You choose your band and set up payment properly — we just discount it to a rupee while you find out whether this works.',
    { color: ONDARK, w: 10.2, y: 2.15 },
  );

  s.addText('₹1', {
    x: M,
    y: 3.15,
    w: 3,
    h: 1.5,
    fontFace: SERIF,
    fontSize: 96,
    color: ACC,
    isTextBox: true,
    margin: 0,
  });
  s.addText('a month, whichever band\nyou choose, for three months', {
    x: M + 2.1,
    y: 3.62,
    w: 4.6,
    h: 0.8,
    fontFace: SANS,
    fontSize: 13.5,
    color: ONDARK,
    isTextBox: true,
    margin: 0,
    valign: 'middle',
    lineSpacingMultiple: 1.24,
  });

  const terms = [
    'The 5% commission still applies during these three months — we earn when you earn, and nothing when you do not.',
    'From month four you pay the band you chose, and stay on it for six months. After that, move up or down as you like.',
    'The rupee is a real payment, so your details are on file and month four does not need a fresh conversation.',
  ];

  terms.forEach((t, i) => {
    const y = 5.15 + i * 0.58;
    s.addShape(p.ShapeType.ellipse, {
      x: M + 0.02,
      y: y + 0.13,
      w: 0.13,
      h: 0.13,
      fill: { color: ACC },
      line: { type: 'none' },
    });
    s.addText(t, {
      x: M + 0.36,
      y,
      w: 11,
      h: 0.42,
      fontFace: SANS,
      fontSize: 13,
      color: ONDARK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
  });

  s.addNotes(
    [
      'This is the ask. Slow down.',
      '',
      'Frame it exactly as the slide does — a DISCOUNT, not a free trial. "You',
      'are signing up at Premium. Premium is forty-nine thousand. For the first',
      'three months we are charging you one rupee for it."',
      '',
      'Be straight about why it is a rupee and not zero: so the payment method is',
      'set up and month four is automatic. Studios respect that answer. Do not be',
      'coy about it — coyness here reads as a trap.',
      '',
      'The six-month commitment from month four MUST be said out loud in the',
      'room. Do not let them discover it in the contract.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 17 — the maths                                                         */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'What it actually works out at');
  title(s, 'The fee stops mattering at three projects.');
  standfirst(
    s,
    'Essential, at a ₹12 lakh project — roughly a 2 BHK furnished at ₹1,350 a square foot. The subscription is fixed, so every project you close makes it a smaller share of what you earned.',
    { w: 10.4 },
  );

  s.addChart(
    p.ChartType.bar,
    [
      {
        name: 'Total we take, as % of your revenue',
        labels: ['1 project', '2 projects', '3 projects', '4 projects', '5 projects'],
        values: [7.1, 6.0, 5.7, 5.5, 5.4],
      },
    ],
    {
      x: M,
      y: 3.3,
      w: 7.1,
      h: 3.2,
      barDir: 'col',
      chartColors: [ACC],
      showValue: true,
      dataLabelPosition: 'outEnd',
      dataLabelFormatCode: '0.0"%"',
      dataLabelFontFace: MONO,
      dataLabelFontSize: 11,
      dataLabelColor: INK,
      showLegend: false,
      showTitle: false,
      valAxisMaxVal: 10,
      valAxisHidden: true,
      catAxisLabelColor: INK2,
      catAxisLabelFontFace: SANS,
      catAxisLabelFontSize: 11,
      catGridLine: { style: 'none' },
      valGridLine: { style: 'none' },
      chartArea: { fill: { color: BG } },
      plotArea: { fill: { color: BG } },
    },
  );

  card(s, M + 7.5, 3.3, 4.1, 3.2);
  s.addText('Read it the other way', {
    x: M + 7.88,
    y: 3.58,
    w: 3.4,
    h: 0.34,
    fontFace: SERIF,
    fontSize: 18,
    color: INK,
    isTextBox: true,
    margin: 0,
  });
  s.addText(
    'At one project a month we are expensive, and we should be — you have barely used us.\n\nAt three we cost under six percent of what you billed, and we found every one of those three.\n\nWe would rather show you this than have you work it out in month five.',
    {
      x: M + 7.88,
      y: 4.05,
      w: 3.35,
      h: 2.25,
      fontFace: SANS,
      fontSize: 12.5,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.22,
    },
  );

  foot(s, 'Premium and Luxury land in the same place — the fee rises with the band, and so does the size of the project.');

  s.addNotes(
    [
      'This is the slide that answers "why would I pay you five percent" with',
      'arithmetic instead of adjectives.',
      '',
      'Use THEIR number from slide 1. If they said they close two a month, point',
      'at the second bar and say "that is you, today, on Essential."',
      '',
      'Do not hide the first bar. Showing that we are expensive at low volume is',
      'what makes the rest of the chart believable — and it sets up the real',
      'message: this only works if you use it.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 18 — the agreement                                                     */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'The paperwork');
  title(s, 'Eight pages, and nothing buried in them.');
  standfirst(
    s,
    'You are leaving today with the whole agreement. These are the clauses worth reading first, because they are the ones that would annoy you if you found them later.',
    { w: 10.6 },
  );

  const clauses = [
    ['2.4', 'No payment of any kind can improve your position in a homeowner’s results.'],
    ['4.3', 'Nothing is charged on your own clients, and the software is free for those projects.'],
    ['4.5', 'An introduction carries commission for twelve months, however the contract comes about.'],
    ['5', 'Your data is used to run this and nothing else. Never sold, never shown to another studio.'],
    ['9.2', 'We can remove your listing at any time. Software you have paid for runs to the end of the period.'],
    ['9.6', 'Fees are not refunded on termination.'],
  ];

  clauses.forEach(([n, t], i) => {
    const x = M + (i % 2) * 5.95;
    const y = 3.5 + Math.floor(i / 2) * 1.0;
    s.addText(n, {
      x,
      y,
      w: 0.8,
      h: 0.8,
      fontFace: MONO,
      fontSize: 15,
      color: ACC,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
    });
    s.addText(t, {
      x: x + 0.85,
      y,
      w: 4.75,
      h: 0.8,
      fontFace: SANS,
      fontSize: 12.5,
      color: INK,
      isTextBox: true,
      margin: 0,
      valign: 'middle',
      lineSpacingMultiple: 1.18,
    });
  });

  foot(s, 'Take it to your CA. We would rather you read it properly than sign it today.');

  s.addNotes(
    [
      'Hand them the printed agreement at this slide, not at the door.',
      '',
      'Read 9.2 and 9.6 aloud yourself. A studio that hears the unflattering',
      'clauses from you trusts the flattering ones. A studio that finds them',
      'alone at eleven at night does not.',
      '',
      'Never push for a signature in the first meeting. "Take it to your CA" is',
      'a stronger close than a pen.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 19 — next fourteen days                                                */
/* ====================================================================== */
{
  const s = light();
  mark(s);
  eyebrow(s, 'What happens next');
  title(s, 'Two weeks from this meeting to a live listing.');
  standfirst(s, 'The only part that depends on you is the first one.', { w: 9 });

  const stages = [
    ['Today', 'You leave with the agreement and a login.'],
    ['This week', 'Profile, registration, portfolio. Your rate card, or your old quotations for us to read.'],
    ['Week two', 'We verify — registration, past clients, a site visit. Twelve checks, each dated.'],
    ['Then', 'You are listed, and the briefs start.'],
  ];

  stages.forEach(([h, b], i) => {
    const x = M + i * 2.98;
    s.addShape(p.ShapeType.ellipse, {
      x,
      y: 3.5,
      w: 0.44,
      h: 0.44,
      fill: { color: INK },
      line: { type: 'none' },
    });
    s.addText(String(i + 1), {
      x,
      y: 3.5,
      w: 0.44,
      h: 0.44,
      fontFace: MONO,
      fontSize: 12.5,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
      isTextBox: true,
      margin: 0,
    });
    if (i < 3) {
      s.addShape(p.ShapeType.line, {
        x: x + 0.6,
        y: 3.72,
        w: 2.2,
        h: 0,
        line: { color: LINE, width: 1.25 },
      });
    }
    s.addText(h, {
      x,
      y: 4.15,
      w: 2.7,
      h: 0.34,
      fontFace: SERIF,
      fontSize: 19,
      color: INK,
      isTextBox: true,
      margin: 0,
    });
    s.addText(b, {
      x,
      y: 4.6,
      w: 2.68,
      h: 1.5,
      fontFace: SANS,
      fontSize: 12,
      color: INK2,
      isTextBox: true,
      margin: 0,
      valign: 'top',
      lineSpacingMultiple: 1.22,
    });
  });

  foot(s, 'Verification takes as long as it takes. A studio we could not verify does not get listed, and that is the point of the badge.');

  s.addNotes(
    [
      'Close the meeting with a date, not a feeling.',
      '',
      'Get one thing in the diary before you stand up: the rate-card session.',
      'Twenty minutes, this week, with you on a call. Everything downstream is',
      'blocked on it and studios will not do it alone.',
      '',
      'Do not promise a listing date. Promise the verification starts the day',
      'their rates are filed.',
    ].join('\n'),
  );
}

/* ====================================================================== */
/* 20 — close                                                             */
/* ====================================================================== */
{
  const s = dark();
  logo(s, { x: M, y: 0.8, w: 1.75, onDark: true });

  s.addText(
    [
      { text: 'A capped roster, in one city,', options: { breakLine: true } },
      { text: 'where position is not for sale.', options: { color: ACC } },
    ],
    {
      x: M,
      y: 2.5,
      w: 11,
      h: 1.8,
      fontFace: SERIF,
      fontSize: 40,
      color: 'FFFFFF',
      isTextBox: true,
      margin: 0,
      lineSpacingMultiple: 1.08,
    },
  );

  s.addText(
    'About fifty studios is all Pune can hold and all we intend to verify. Being one of them is worth something precisely because most studios will not be.',
    {
      x: M,
      y: 4.45,
      w: 9.4,
      h: 0.9,
      fontFace: SANS,
      fontSize: 15,
      color: ONDARK,
      isTextBox: true,
      margin: 0,
      lineSpacingMultiple: 1.28,
    },
  );

  const closing = [
    ['₹1', 'a month, for three months'],
    ['5%', 'and only when you close'],
    ['0%', 'on your own clients, always'],
  ];

  closing.forEach(([n, b], i) => {
    const x = M + i * 3.85;
    s.addText(n, {
      x,
      y: 5.55,
      w: 3.4,
      h: 0.72,
      fontFace: SERIF,
      fontSize: 38,
      color: i === 2 ? SAGE : 'FFFFFF',
      isTextBox: true,
      margin: 0,
    });
    s.addText(b, {
      x,
      y: 6.32,
      w: 3.4,
      h: 0.38,
      fontFace: SANS,
      fontSize: 12.5,
      color: ONDARK3,
      isTextBox: true,
      margin: 0,
    });
  });

  s.addNotes(
    [
      'Last slide. Leave it up while they ask questions — the three numbers are',
      'the ones you want on screen during the part of the meeting you cannot',
      'script.',
      '',
      'Do not add anything. If the room has gone quiet, ask: "What is the part',
      'of this you are least sure about?" and then be honest about the answer.',
    ].join('\n'),
  );
}

p.writeFile({ fileName: OUT }).then(() => {
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
});
