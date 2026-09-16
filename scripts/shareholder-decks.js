/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, run directly, outside the Next module graph */

/**
 * Four shareholder decks: Sanyam, Yogesh, Hauspire, Swarupa.
 *
 *   npm install --save-dev pptxgenjs
 *   node scripts/shareholder-decks.js
 *
 * Writes docs/deck-sanyam.pptx, deck-yogesh.pptx, deck-hauspire.pptx,
 * deck-swarupa.pptx.
 *
 * ## What these are, and what they are not
 *
 * Not investor pitches. Everyone reading these already knows what the company
 * is — two of them thought of it. These answer the question a shareholder
 * actually has, which is "what is my part of this, what do I get for it, and
 * what happens if it goes wrong."
 *
 * So the first four slides are shared and deliberately short, and the weight is
 * in the second half, which differs per person.
 *
 * ## One editorial rule
 *
 * The shared slides say the same thing in all four decks, and the cap table is
 * identical in every one. A shareholder who later compares their copy with
 * another's should find no difference in the facts — different emphasis is
 * honest, different numbers are not.
 *
 * That rule is why the cap table is a single constant at the top of this file
 * rather than four hand-written slides: the one thing that must never drift
 * between decks is the one thing a generator can guarantee.
 */

const pptxgen = require('pptxgenjs');
const path = require('path');

// ── Palette ────────────────────────────────────────────────────
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
const _H = 7.5;
const M = 0.7;

// ── The cap table, in one place ────────────────────────────────
const CAP = [
  { who: 'Yogesh', pct: 40, note: 'Founder — the idea, the direction, the decisions' },
  { who: 'Sanyam', pct: 20, note: 'Execution — product, studios, customers, operations' },
  { who: 'Hauspire', pct: 20, note: 'Investor — ₹20 lakh, and the first pilot studio' },
  { who: 'Swarupa', pct: 10, note: 'Investor — ₹10 lakh, and marketing' },
  { who: 'ESOP pool', pct: 10, note: 'Reserved for hires the plan already needs' },
];

/** ₹30 lakh raised at ₹1 crore post-money: 30% sold, ₹70 lakh pre-money. */
const RAISE = '₹30 lakh at ₹1 crore post-money';

// ═══════════════════════════════════════════════════════════════
// Shared drawing helpers
// ═══════════════════════════════════════════════════════════════
// pptxgenjs mutates option objects in place, so every one of these builds a
// fresh object on each call rather than sharing a constant.

function light(pres) {
  const s = pres.addSlide();
  s.background = { color: PAPER };
  return s;
}

function dark(pres) {
  const s = pres.addSlide();
  s.background = { color: PETROL_DEEP };
  return s;
}

function title(slide, text, opts = {}) {
  slide.addText(text, {
    isTextBox: true,
    x: M,
    y: opts.y || 0.55,
    w: W - M * 2,
    h: opts.h || 0.95,
    fontFace: HEAD,
    fontSize: opts.size || 34,
    bold: true,
    color: opts.color || INK,
    margin: 0,
    valign: 'top',
  });
}

function lede(slide, text, opts = {}) {
  slide.addText(text, {
    isTextBox: true,
    x: M,
    y: opts.y || 1.6,
    w: opts.w || W - M * 2 - 0.6,
    h: opts.h || 0.9,
    fontFace: BODY,
    fontSize: opts.size || 17,
    color: opts.color || INK_2,
    lineSpacingMultiple: 1.25,
    margin: 0,
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres_ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: opts.fill || CREAM },
    line: { color: opts.line || RULE, width: 1 },
  });
}

// Set once the presentation exists — pptxgenjs exposes ShapeType on instances.
let pres_ShapeType = null;

function bullets(slide, x, y, w, h, items, opts = {}) {
  slide.addText(
    items.map((t, i) => ({
      text: t,
      options: {
        bullet: true,
        breakLine: i !== items.length - 1,
        paraSpaceAfter: opts.gap === undefined ? 10 : opts.gap,
      },
    })),
    {
      isTextBox: true,
      x,
      y,
      w,
      h,
      fontFace: BODY,
      fontSize: opts.size || 14.5,
      color: opts.color || INK_2,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );
}

function stat(slide, x, y, w, value, label, opts = {}) {
  slide.addText(value, {
    isTextBox: true,
    x,
    y,
    w,
    h: 0.75,
    fontFace: HEAD,
    fontSize: opts.size || 34,
    bold: true,
    color: opts.color || PETROL,
    margin: 0,
    valign: 'middle',
  });
  slide.addText(label, {
    isTextBox: true,
    x,
    y: y + 0.74,
    w,
    h: 0.66,
    fontFace: BODY,
    fontSize: 11.5,
    color: INK_3,
    lineSpacingMultiple: 1.15,
    margin: 0,
    valign: 'top',
  });
}

function row(slide, x, y, w, badge, header, body, opts = {}) {
  slide.addShape(pres_ShapeType.ellipse, {
    x,
    y: y + 0.04,
    w: 0.46,
    h: 0.46,
    fill: { color: opts.fill || PETROL },
  });
  slide.addText(badge, {
    isTextBox: true,
    x,
    y: y + 0.04,
    w: 0.46,
    h: 0.46,
    fontFace: BODY,
    fontSize: 13,
    bold: true,
    color: WHITE,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });
  slide.addText(header, {
    isTextBox: true,
    x: x + 0.68,
    y,
    w: w - 0.68,
    h: 0.34,
    fontFace: BODY,
    fontSize: 15,
    bold: true,
    color: INK,
    margin: 0,
    valign: 'top',
  });
  slide.addText(body, {
    isTextBox: true,
    x: x + 0.68,
    y: y + 0.36,
    w: w - 0.68,
    h: opts.h || 0.9,
    fontFace: BODY,
    fontSize: 13,
    color: INK_2,
    lineSpacingMultiple: 1.2,
    margin: 0,
    valign: 'top',
  });
}

// ═══════════════════════════════════════════════════════════════
// The shared spine — identical in all three decks
// ═══════════════════════════════════════════════════════════════

function titleSlide(pres, person) {
  const s = dark(pres);

  s.addText(person.name, {
    isTextBox: true,
    x: M,
    y: 2.0,
    w: W - M * 2,
    h: 0.9,
    fontFace: HEAD,
    fontSize: 46,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addText(person.role, {
    isTextBox: true,
    x: M,
    y: 2.95,
    w: 10,
    h: 0.6,
    fontFace: HEAD,
    fontSize: 24,
    italic: true,
    color: BRASS,
    margin: 0,
  });

  s.addText(person.headline, {
    isTextBox: true,
    x: M,
    y: 3.8,
    w: 8.8,
    h: 1.4,
    fontFace: BODY,
    fontSize: 16,
    color: 'CFE0E2',
    lineSpacingMultiple: 1.3,
    margin: 0,
  });

  s.addText('One Interiors  ·  Pune  ·  September 2026', {
    isTextBox: true,
    x: M,
    y: 5.9,
    w: 9,
    h: 0.4,
    fontFace: BODY,
    fontSize: 14,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addText(
    'Working name. The permanent name is being settled this week — nothing in the product hardcodes it.',
    {
      isTextBox: true,
      x: M,
      y: 6.4,
      w: 10.5,
      h: 0.45,
      fontFace: BODY,
      fontSize: 11,
      italic: true,
      color: '8FB3B6',
      margin: 0,
    },
  );

  s.addNotes(person.titleNote);
}

function whatWeAreBuilding(pres) {
  const s = light(pres);
  title(s, 'What we are building.');
  lede(
    s,
    'A curated marketplace for interior design in Pune. Nine questions, matched to verified studios, a real price from each studio’s own rates, and a neutral expert on the phone before anyone is introduced.',
    { w: 11.4, h: 1.1 },
  );

  const items = [
    ['The problem', 'Not finding a designer — you can find forty in an afternoon. Telling which one will still be answering the phone in month four.'],
    ['What we sell', 'Certainty, not taste. Every complaint in this trade is an execution failure, not a matching failure.'],
    ['The size of it', '₹7–27 lakh a project. The largest discretionary purchase most Indian households make after the flat itself.'],
    ['The rule', 'A studio can pay us for volume. It can never pay us for position. That constraint is the product.'],
  ];

  let y = 2.95;
  items.forEach((it, i) => {
    row(s, M + (i % 2) * 6.1, y + Math.floor(i / 2) * 1.65, 5.7, String(i + 1), it[0], it[1], {
      h: 1.0,
    });
  });

  s.addNotes(
    'Keep this short in the room. Everybody here already knows what the company is; this slide exists so the three decks start from the same sentence.',
  );
}

function whereItIsToday(pres) {
  const s = light(pres);
  title(s, 'Where it actually is, today.');
  lede(s, 'Said plainly, because everyone in this room is going to find out anyway.', {
    w: 11.4,
  });

  const facts = [
    ['Built', 'The whole funnel runs: brief, matching, quotes, comparison, expert call, prep pack. Plus the studio dashboard and the ops console.'],
    ['Not launched', 'Zero customers. Zero revenue. Zero live studios. The waitlist opens 16 September.'],
    ['One thing missing', 'On day one the product cannot produce a quote — because no studio has entered a rate card, and the pricing code refuses to invent one.'],
    ['Twenty minutes', 'That is what it takes to fix, once one studio sits down with us. It is the single highest-leverage action in the plan.'],
  ];

  const cw = 2.86;
  facts.forEach((f, i) => {
    const x = M + i * (cw + 0.16);
    card(s, x, 2.85, cw, 2.5, i === 2 ? { fill: 'FAEDE6', line: 'E8C9B8' } : {});
    s.addText(f[0], {
      isTextBox: true,
      x: x + 0.24,
      y: 3.06,
      w: cw - 0.48,
      h: 0.5,
      fontFace: HEAD,
      fontSize: 17,
      bold: true,
      color: i === 2 ? TERRACOTTA : PETROL,
      margin: 0,
      valign: 'top',
    });
    s.addText(f[1], {
      isTextBox: true,
      x: x + 0.24,
      y: 3.6,
      w: cw - 0.48,
      h: 1.6,
      fontFace: BODY,
      fontSize: 12,
      color: INK_2,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    });
  });

  s.addText(
    'Nothing on this slide is a surprise to anyone who has been close to it. It is here so nobody signs on a different picture than the one that exists.',
    {
      isTextBox: true,
      x: M,
      y: 5.7,
      w: 11.93,
      h: 0.6,
      fontFace: BODY,
      fontSize: 13.5,
      italic: true,
      color: INK_3,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes('Do not soften this. A shareholder who discovers it later stops believing the rest.');
}

function theMoney(pres) {
  const s = light(pres);
  title(s, 'How the money works.');
  lede(s, 'Three months of commission only, then a subscription that scales with project size.', {
    w: 11.4,
  });

  const rows = [
    ['Pilot · months 1–3', '5% commission only', 'Nothing at all unless a project closes'],
    ['Essential', '₹25,000/mo + 5%', 'Studios averaging ₹7 lakh projects'],
    ['Premium', '₹50,000/mo + 5%', 'Studios averaging ₹12 lakh projects'],
    ['Luxury', '₹1,00,000/mo + 5%', 'Studios averaging ₹20 lakh projects'],
  ];

  let y = 2.8;
  rows.forEach((r, i) => {
    card(s, M, y, 11.93, 0.7, { fill: i % 2 ? PAPER : CREAM });
    s.addText(r[0], {
      isTextBox: true,
      x: M + 0.3,
      y,
      w: 3.3,
      h: 0.7,
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
      h: 0.7,
      fontFace: BODY,
      fontSize: 14,
      bold: true,
      color: PETROL,
      margin: 0,
      valign: 'middle',
    });
    s.addText(r[2], {
      isTextBox: true,
      x: M + 7.1,
      y,
      w: 4.7,
      h: 0.7,
      fontFace: BODY,
      fontSize: 12.5,
      color: INK_2,
      margin: 0,
      valign: 'middle',
    });
    y += 0.78;
  });

  stat(s, M, 6.0, 3.0, '₹4.36 Cr', 'year-one gross revenue, if the\nassumptions hold');
  stat(s, M + 3.1, 6.0, 3.0, '553', 'projects placed\n₹70.5 Cr of work');
  stat(s, M + 6.2, 6.0, 3.0, '24', 'studios at month twelve —\nnot the 50 the plan assumed', {
    color: TERRACOTTA,
  });

  s.addNotes(
    'The 24 is on this slide on purpose. Our own model says the roster does not reach 50 at the churn we assumed, and everyone signing should have seen that number before they signed.',
  );
}

// ═══════════════════════════════════════════════════════════════
// Personal slides
// ═══════════════════════════════════════════════════════════════

function yourRole(pres, person) {
  const s = light(pres);
  title(s, person.roleTitle);
  lede(s, person.roleLede, { w: 11.4, h: 1.0 });

  let y = 2.95;
  person.duties.forEach((d, i) => {
    row(s, M + (i % 2) * 6.1, y + Math.floor(i / 2) * 1.7, 5.7, String(i + 1), d[0], d[1], {
      h: 1.05,
    });
  });

  s.addNotes(person.roleNote);
}

function whatYouGet(pres, person) {
  const s = dark(pres);

  s.addText('What you get.', {
    isTextBox: true,
    x: M,
    y: 0.75,
    w: 11.93,
    h: 0.85,
    fontFace: HEAD,
    fontSize: 38,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addText(person.getLede, {
    isTextBox: true,
    x: M,
    y: 1.65,
    w: 11.3,
    h: 0.7,
    fontFace: BODY,
    fontSize: 16,
    color: 'CFE0E2',
    lineSpacingMultiple: 1.25,
    margin: 0,
  });

  const cw = (11.93 - 0.2 * (person.gets.length - 1)) / person.gets.length;
  person.gets.forEach((g, i) => {
    const x = M + i * (cw + 0.2);
    s.addShape(pres_ShapeType.roundRect, {
      x,
      y: 2.6,
      w: cw,
      h: 1.85,
      rectRadius: 0.08,
      fill: { color: PETROL },
      line: { color: '2E7D85', width: 1 },
    });
    s.addText(g[0], {
      isTextBox: true,
      x: x + 0.26,
      y: 2.8,
      w: cw - 0.52,
      h: 0.6,
      fontFace: HEAD,
      fontSize: 24,
      bold: true,
      color: BRASS,
      margin: 0,
      valign: 'middle',
    });
    s.addText(g[1], {
      isTextBox: true,
      x: x + 0.26,
      y: 3.42,
      w: cw - 0.52,
      h: 0.9,
      fontFace: BODY,
      fontSize: 12,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'top',
    });
  });

  s.addText(person.getBodyTitle, {
    isTextBox: true,
    x: M,
    y: 4.75,
    w: 11.93,
    h: 0.5,
    fontFace: HEAD,
    fontSize: 21,
    bold: true,
    color: BRASS,
    margin: 0,
    valign: 'top',
  });

  s.addText(person.getBody, {
    isTextBox: true,
    x: M,
    y: 5.3,
    w: 11.4,
    h: 1.5,
    fontFace: BODY,
    fontSize: 14,
    color: 'DCEAEB',
    lineSpacingMultiple: 1.3,
    margin: 0,
    valign: 'top',
  });

  s.addNotes(person.getNote);
}

function whatIsExpected(pres, person) {
  const s = light(pres);
  title(s, 'What is expected of you.');
  lede(s, person.expectLede, { w: 11.4 });

  bullets(s, M, 2.8, 11.93, 2.6, person.expects, { size: 15, gap: 12 });

  card(s, M, 5.6, 11.93, 1.3, { fill: 'FAEDE6', line: 'E8C9B8' });
  s.addText(person.expectWarning, {
    isTextBox: true,
    x: M + 0.32,
    y: 5.8,
    w: 11.29,
    h: 0.95,
    fontFace: BODY,
    fontSize: 13.5,
    color: INK,
    lineSpacingMultiple: 1.22,
    margin: 0,
    valign: 'top',
  });

  s.addNotes(person.expectNote);
}

function capTable(pres, person) {
  const s = light(pres);
  title(s, 'The cap table.');
  lede(s, `${RAISE}. Everyone in one table, in every deck.`, { w: 11.4 });

  let y = 2.55;
  CAP.forEach((c) => {
    const mine = c.who === person.capKey;
    card(s, M, y, 11.93, 0.8, mine ? { fill: 'E8F0F0', line: PETROL } : {});
    s.addText(c.who, {
      isTextBox: true,
      x: M + 0.32,
      y,
      w: 3.0,
      h: 0.82,
      fontFace: BODY,
      fontSize: 15,
      bold: true,
      color: mine ? PETROL : INK,
      margin: 0,
      valign: 'middle',
    });
    s.addText(`${c.pct}%`, {
      isTextBox: true,
      x: M + 3.4,
      y,
      w: 1.4,
      h: 0.82,
      fontFace: HEAD,
      fontSize: 20,
      bold: true,
      color: mine ? PETROL : INK_2,
      margin: 0,
      valign: 'middle',
    });
    s.addText(c.note, {
      isTextBox: true,
      x: M + 5.0,
      y,
      w: 6.8,
      h: 0.82,
      fontFace: BODY,
      fontSize: 13,
      color: INK_2,
      margin: 0,
      valign: 'middle',
    });
    y += 0.88;
  });

  s.addText(
    'The 10% pool is reserved, not held by anyone. The plan needs an expert, an ops person per city and engineers — reserving now is far cheaper than diluting everybody later. ₹30 lakh in, 30% sold, ₹70 lakh pre-money.',
    {
      isTextBox: true,
      x: M,
      y: 6.6,
      w: 11.93,
      h: 0.7,
      fontFace: BODY,
      fontSize: 13,
      color: INK_3,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes(
    'Same table in all three decks, deliberately. Anyone comparing their copy with another should find the facts identical.',
  );
}

function whatWouldGoWrong(pres, person) {
  const s = light(pres);
  title(s, 'What would make this fail — for you.');
  lede(s, 'Every one of these is measurable inside ninety days.', { w: 11.4 });

  let y = 2.8;
  person.risks.forEach((r) => {
    card(s, M, y, 11.93, 1.12, { fill: PAPER, line: RULE });
    s.addText(r[0], {
      isTextBox: true,
      x: M + 0.3,
      y: y + 0.06,
      w: 4.4,
      h: 1.0,
      fontFace: BODY,
      fontSize: 14,
      bold: true,
      color: INK,
      lineSpacingMultiple: 1.1,
      margin: 0,
      valign: 'middle',
    });
    s.addText(r[1], {
      isTextBox: true,
      x: M + 5.0,
      y: y + 0.06,
      w: 6.7,
      h: 1.0,
      fontFace: BODY,
      fontSize: 12.5,
      color: INK_2,
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'middle',
    });
    y += 1.2;
  });

  s.addText(person.riskClose, {
    isTextBox: true,
    x: M,
    y: y + 0.25,
    w: 11.93,
    h: 0.6,
    fontFace: HEAD,
    fontSize: 16,
    bold: true,
    color: PETROL,
    margin: 0,
    valign: 'top',
  });

  s.addNotes(person.riskNote);
}

function closeSlide(pres, person) {
  const s = dark(pres);

  s.addText(person.closeTitle, {
    isTextBox: true,
    x: M,
    y: 2.1,
    w: 11.5,
    h: 1.6,
    fontFace: HEAD,
    fontSize: 38,
    bold: true,
    color: WHITE,
    lineSpacingMultiple: 1.12,
    margin: 0,
  });

  s.addText(person.closeBody, {
    isTextBox: true,
    x: M,
    y: 3.9,
    w: 10.6,
    h: 1.8,
    fontFace: BODY,
    fontSize: 16,
    color: 'CFE0E2',
    lineSpacingMultiple: 1.3,
    margin: 0,
  });

  s.addNotes(person.closeNote);
}

// ═══════════════════════════════════════════════════════════════
// The three people
// ═══════════════════════════════════════════════════════════════

const SANYAM = {
  file: 'deck-sanyam.pptx',
  name: 'Sanyam',
  capKey: 'Sanyam',
  role: 'Execution — everything that has to actually happen',
  headline:
    'The product is built. What decides whether this works now is studios signed, briefs collected and calls run — and that is one person’s job.',
  titleNote:
    'This deck is about the role with the most hours in it and the least optionality. Be straight about both halves.',

  roleTitle: 'You run it.',
  roleLede:
    'Not a department — the operating half of the company. Four jobs that in a bigger business would be four people, and for the first year they are you.',
  duties: [
    ['The software', 'Build it, ship it, fix it. Twenty-five tables, the matching engine, the ops console, the studio dashboard. All of it already exists because of this.'],
    ['The studios', 'Approach, verify, onboard, keep. Ten live in month one, and every one of them is a relationship rather than a signup.'],
    ['The customers', 'Waitlist, societies, Instagram, the paid test. The first two hundred briefs come from conversations, not from a campaign.'],
    ['The calls', 'Until there is an expert to hire, the expert is you. Roughly three calls per closed project.'],
  ],
  roleNote:
    'Worth saying out loud: this is four jobs. The plan assumes 0.9 full-time experts in year one and does not name who they are.',

  getLede: 'A fifth of the company, a salary so you are not living on the equity, and the record.',
  gets: [
    ['20%', 'of the company, as a founding operator'],
    ['Salary', 'so the equity is upside rather than the whole compensation'],
    ['The record', 'a marketplace you built and ran, from nothing, in a year'],
  ],
  getBodyTitle: 'The part that is not on the cap table',
  getBody:
    'Nobody gets to build the whole of something twice. If this works, the thing you own is not only the 20% — it is having been the person who took a plan and made it a company, with the commits and the roster and the first hundred customers to show for it.\n\nAnd if it does not work, that is still true, and it is still the strongest thing on your CV.',
  getNote:
    'The salary number is not on this slide because it is not settled. Do not present a figure you have not agreed.',

  expectLede: 'The honest list, including the bit that is uncomfortable.',
  expects: [
    'Ten studios live with a rate card each, by the end of month one. This is the gate everything else sits behind.',
    'The first two hundred briefs, from channels that cost almost nothing — societies, network, Instagram.',
    'The number that decides the year: cost per completed brief, known by week three and under ₹2,500.',
    'Every expert call, until there is somebody to hire. Three per closed project, forty-five minutes each.',
    'And saying so, early, when one of these is not going to happen.',
  ],
  expectWarning:
    'Settle the salary number before you sign. The original ₹20 lakh use-of-funds — ₹6L demand, ₹5L verification, ₹6L the first expert, ₹3L legal — accounted for the whole cheque with no salary line in it. Swarupa’s ₹10 lakh is roughly the size of that gap, which is the reason the round grew. Get the figure agreed and written down rather than assumed.',
  expectNote:
    'The salary gap was the biggest quiet risk in this relationship. The ₹30 lakh round closes it — but only if the number is actually agreed, not left implied.',

  risks: [
    ['You are the single point of failure', 'Four roles, one person, no redundancy. A fortnight of illness in month two costs the launch. There is no plan for this yet and there should be.'],
    ['The salary question goes unanswered', 'The cheque does not cover it. Left unresolved, this becomes resentment somewhere around month four, and resentment in a two-person operating team is fatal.'],
    ['20% against 40% starts to grate', 'You will do most of the visible work. If that ratio is going to be a problem, it will be a problem — say it now, when it is a conversation rather than a grievance.'],
    ['Acquisition costs 12× the model', 'If a completed brief costs more than ₹2,500 and no owned channel replaces paid, the unit economics do not close and the year has to be replanned.'],
  ],
  riskClose: 'Three of those four are conversations to have before signing, not problems to discover.',
  riskNote:
    'This slide exists because the failure modes for Sanyam specifically are organisational, not market ones.',

  closeTitle: 'You already built it.\nThis is the part where it becomes a company.',
  closeBody:
    'The product is done and it was done by one person. What the next ninety days decide is whether the thing that was built gets used — and that is the same person again, doing a different and harder job.\n\nTwenty percent, a salary that needs settling, and the first real operating record of your career.',
  closeNote: 'End on the ask: settle the salary and the cover plan before 16 September.',
};

const YOGESH = {
  file: 'deck-yogesh.pptx',
  name: 'Yogesh',
  capKey: 'Yogesh',
  role: 'Founder — the idea, the direction, the decisions',
  headline:
    'You hold the largest stake in this because the idea was yours. What the next ninety days need from you is not more ideas — it is four decisions that are blocking everything downstream.',
  titleNote:
    'The respectful version of this deck is the one that says the blockers are his. Do not bury that slide.',

  roleTitle: 'You decide.',
  roleLede:
    'The idea, the direction, and — right now — the four open questions that nobody else can answer and that are holding up the launch.',
  duties: [
    ['The idea', 'Certainty over taste. Volume never position. An expert call before any introduction. Those three sentences are the company, and they were yours.'],
    ['The direction', 'What gets built and what does not. The 3D planner was cut, escrow was deferred, pay-to-rank was refused. Those were the right calls.'],
    ['The planning', 'The year-one and year-two models, the GTM plan, the tier structure. All of it exists and all of it is yours.'],
    ['The decisions', 'Four of them are open, all four are blocking, and none of them is engineering work. The next slide is that list.'],
  ],
  roleNote:
    'Move quickly to the blockers. That is the useful part of this conversation.',

  getLede: 'The largest stake in the company, and the direction of what it becomes.',
  gets: [
    ['40%', 'of the company — twice any other holder'],
    ['Direction', 'the founder’s stake, and the casting view on what gets built'],
    ['The asset', 'delivery data nobody can buy or copy'],
  ],
  getBodyTitle: 'What the 40% is actually buying you',
  getBody:
    'By the end of year two the company holds delivery variance on 2,233 completed projects — who finished on time, who did not, and by how much. That cannot be bought from a KYC vendor or copied in a weekend. Everything else in this plan is replicable; that is not.\n\nTwo fifths of that is yours, and it compounds from the first completed project.\n\nWorth being precise about one thing: 40% is the largest single holding and it is not a majority. You and Sanyam together are 60%. Nothing is decided over the founder’s objection, but nothing is decided by the founder alone either — and that is a structure worth agreeing out loud rather than discovering at the first disagreement.',
  getNote:
    'Do not skip the last paragraph. Going from 50 to 40 changes who can carry a vote, and a shareholder should hear that from you rather than work it out later.',

  expectLede: 'Four decisions. None of them is engineering, all four are blocking, and they have been open since v0.3.',
  expects: [
    'The name. It blocks the launch date itself — the site stays unindexed until it exists, and every piece of outreach copy waits on it.',
    'DPDP on the 20,000 Hauspire records. A two-hour legal question that currently blocks the largest demand source we have.',
    'Escrow legality. A fortnight with a lawyer, and it decides 14% of year-two revenue.',
    'GST treatment — composite supply versus works contract. Needed before a single real quote goes out.',
    'And the one that is free: ask Hauspire and Urbanline whether studios will accept milestone-gated payment. It is the load-bearing assumption of the whole model and the one most likely to be false.',
  ],
  expectWarning:
    'These have been deferred for good reasons and have now become the thing standing between a finished product and a launch. The name alone has a compounding cost that is invisible because nothing looks broken: locality cost pages take months to rank, both Hauspire and Urbanline already run exactly those pages, and every week on noindex is a week not compounding.',
  expectNote:
    'Do not soften this. The product is finished and the blockers are all on his side of the table.',

  risks: [
    ['The decisions keep slipping', 'Four questions, none of them engineering, all four blocking. Every week they stay open is a week the built product earns nothing.'],
    ['Escrow turns out to be illegal for us', 'Removes 14% of year-two revenue and the repositioning that goes with it. Year one is unaffected — plan against the version without it until a lawyer says otherwise.'],
    ['DPDP blocks the 20,000 records', 'The largest demand source becomes unusable, the acquisition timeline moves out by a quarter, and the budget changes shape.'],
    ['Churn stays at 10% a month', 'The roster never passes 24 studios. The likely cause is pricing the fee flat across the ramp, and the fix costs little — waive it until a studio is closing four a month.'],
  ],
  riskClose: 'The first one is entirely within your control, and it is the one that matters most.',
  riskNote: 'End on the name. It is three days from the launch date.',

  closeTitle: 'The idea is built.\nWhat it needs now is four answers.',
  closeBody:
    'Everything described in this deck exists — the funnel, the matching engine, the ops console, the studio dashboard. It runs, it is tested, and it is deployed.\n\nWhat it cannot do is name itself, clear its own legal questions, or decide its own GST treatment. That is the founder’s half of the work, and it is the half that is outstanding.',
  closeNote: 'Ask for dates on all four before leaving the room.',
};

const HAUSPIRE = {
  file: 'deck-hauspire.pptx',
  name: 'Hauspire',
  capKey: 'Hauspire',
  role: 'Investor — ₹20 lakh',
  headline:
    'A fifth of a marketplace, plus a permanent channel into it for your own studio and, later, your factory.',
  titleNote:
    'This is the only deck where the reader is also a supplier and a customer. Keep the three roles separate on the page.',

  roleTitle: 'Three relationships, not one.',
  roleLede:
    'You are the investor, the first pilot studio, and eventually the supplier. Each one is worth something different, and it is worth being clear which is which.',
  duties: [
    ['The investor', '₹20 lakh for 20% at ₹1 crore post-money. The cheque that funds the first ninety days and the measurement that decides the year.'],
    ['The pilot studio', 'Studio number one on the roster. Your rate card is what unblocks the entire quote engine — twenty minutes of work that nothing else can substitute for.'],
    ['The supplier', 'The factory. Selling product through the platform’s studios is the second business, and it is yours to take first.'],
    ['The reference', '980 real quotation files already shaped the pricing engine. That structure came from your business and nobody else had it.'],
  ],
  roleNote:
    'The rate card is the ask in this meeting. Everything downstream is blocked on it.',

  getLede: '₹20 lakh for a fifth of the company, and three things that are not equity.',
  gets: [
    ['20%', 'of the company at ₹1 crore post-money'],
    ['Free forever', 'the ₹1,00,000/month Luxury listing, at no cost'],
    ['Premium flow', 'first access to the best clients on the platform'],
    ['The factory', 'first refusal on supplying product through the roster'],
  ],
  getBodyTitle: 'What the perks are worth, in rupees',
  getBody:
    'The Luxury tier is ₹1,00,000 a month. Waived permanently, that is ₹12 lakh a year — more than half the cheque back in year one alone, before a single project closes and before the equity is worth anything.\n\nPremium client flow and the factory supply route are on top of that, and neither is available to any other studio at any price.',
  getNote:
    'The ₹12 lakh a year figure is the strongest thing on this slide. Lead with it.',

  expectLede: 'Three things, and the first one is the whole of the next fortnight.',
  expects: [
    'The rate card. Twenty minutes entering real rates, and it unblocks the quote engine for every customer on the platform.',
    'The ₹20 lakh, on terms — the first ₹25,000 of it has one job, which is measuring what a customer actually costs.',
    'An honest answer on milestone-gated payment: will a studio accept being paid against milestones rather than up front? It is the load-bearing assumption of the model.',
    'And being studio number one properly — going through verification like everyone else, so the roster has a precedent worth copying.',
  ],
  expectWarning:
    'On 16 September the product cannot produce a quote, because no studio has entered a rate card and the pricing code refuses to invent one. That refusal is the whole trust proposition. Your rate card is the thing that turns a finished product into a working one, and it is the single highest-leverage action in the plan.',
  expectNote:
    'If you get one thing out of this meeting, get the rate card session in the diary.',

  risks: [
    ['The round buys a measurement, not a business', '₹30 lakh funds ninety days and one number: what a customer costs. If that number is twelve times the model, the year is replanned rather than executed.'],
    ['Acquisition costs ₹25,000, not ₹2,000', 'The model says one, the kill-criteria say the other, and only one can be the plan. Week three tells us which.'],
    ['Studios refuse milestone payment', 'The assumption most likely to be false, and you are one of the two people who can answer it for free, today.'],
    ['Escrow is not legal for us', 'Removes 14% of year-two revenue. Year one is unaffected; the repositioning is not.'],
  ],
  riskClose: 'Ninety days and ₹30 lakh to find out, rather than two crore and a year.',
  riskNote: 'The honest framing is that this is an option on a measurement, priced accordingly.',

  closeTitle: '₹20 lakh, 20%,\nand a permanent seat on the roster.',
  closeBody:
    'The Luxury listing alone returns more than half the cheque in the first year. The equity is the upside on top of it, and the factory route is the second business after that.\n\nWhat it needs from you this week is not the money — it is twenty minutes with a rate card.',
  closeNote: 'Close on the rate card, not the cheque. The cheque can follow.',
};

const SWARUPA = {
  file: 'deck-swarupa.pptx',
  name: 'Swarupa',
  capKey: 'Swarupa',
  role: 'Investor and marketing — ₹10 lakh',
  headline:
    'The entire year-one plan rests on one unmeasured number: what a customer actually costs. That number is a marketing question, and it is yours.',
  titleNote:
    'The money is the smaller half of what she brings. Lead with the number she owns, not with the cheque.',

  roleTitle: 'You own the number that decides the year.',
  roleLede:
    'Everything in the financial model — the studio count, the subscription price, whether year one works at all — sits downstream of one figure nobody has measured. Marketing is not a function here; it is the experiment the first ninety days exist to run.',
  duties: [
    ['The measurement', 'Cost per completed brief. The plan assumes ₹200 a lead at a 10% close rate; the kill-criteria imply a figure twelve times higher. Both cannot be right.'],
    ['The owned channels', 'Societies and RWAs in Baner, Kharadi, Wakad and Hinjewadi. One admin’s permission reaches hundreds of households in exactly the right week of their lives.'],
    ['The content', 'Nobody in Pune publishes what a 2 BHK actually costs at three levels of finish. We can, because the bands are ours. That is the content and it is also the product.'],
    ['The positioning', 'What we may honestly promise on 16 September, and what we may not. A waitlist that over-promises goes cold in six weeks and the second email is marked as spam.'],
  ],
  roleNote:
    'The ₹25,000 paid test is an instrument, not a campaign. Make sure that framing survives the meeting.',

  getLede: 'A tenth of the company, and ownership of the function that decides whether it works.',
  gets: [
    ['10%', 'of the company at ₹1 crore post-money'],
    ['The function', 'marketing, owned outright rather than advised on'],
    ['The evidence', 'a category nobody in Pune has published data on'],
  ],
  getBodyTitle: 'Why this is a better marketing job than it looks',
  getBody:
    'Most marketing roles start with a product that already sells and are asked to sell more of it. This one starts with a genuine information asymmetry: we know what interior work actually costs in Pune, at three levels of finish, per locality — and nobody publishes it.\n\nThat is a content position no competitor can copy without building the same pricing engine first. It is also the cheapest demand channel in the plan, and it is the one you would own.',
  getNote:
    'The cost-band content is the strongest thing in her remit. It is organic, defensible and already built.',

  expectLede: 'Three things, and the first one has a deadline measured in weeks.',
  expects: [
    'Cost per completed brief, known by week three and under ₹2,500. This is the year-defining number and everything else is downstream of it.',
    'The first two hundred briefs, from channels that cost almost nothing — societies, the founders’ own network, Instagram.',
    'Brief completion above 40%. Below that the problem is the quiz rather than the market, and the funnel view names the exact question losing people.',
    'And the share of briefs in the ₹7 lakh-plus band above 50% — a studio shown four unqualified briefs concludes the platform does not work.',
  ],
  expectWarning:
    'The first ₹25,000 is an instrument, not a campaign. Its only job is to measure what a completed brief costs. If that number comes back above ₹2,500, the answer is owned demand — societies, builders, referral — not a bigger budget. Getting it in week one costs almost nothing; getting it in month four costs the year.',
  expectNote:
    'The temptation will be to spend the ₹25k on growth. Say plainly that it is a measuring instrument.',

  risks: [
    ['Acquisition costs 12× the model', 'If a completed brief costs more than ₹2,500 and no owned channel replaces paid, the unit economics do not close. This is your number and it is the one that decides the year.'],
    ['DPDP blocks the 20,000 records', 'The largest demand source becomes unusable and the first quarter runs on channels that are slower and smaller. A legal answer, not a marketing one — but it lands on your plan.'],
    ['The name is still undecided', 'The site stays unindexed until it exists. Locality cost pages take months to rank, and every week without a name is a week not compounding — invisible, because nothing looks broken.'],
    ['We promise quotes in September', 'On 16 September the product cannot produce one, because no studio has entered a rate card. A waitlist that goes quiet for six weeks after an unfulfilled promise is worse than no waitlist.'],
  ],
  riskClose: 'Three of those four are inside the first fortnight, and two of them are yours to call.',
  riskNote:
    'The fourth risk is the one a marketer is most likely to be pushed into. Give her the argument for refusing it.',

  closeTitle: '₹10 lakh, 10%,\nand the number the plan rests on.',
  closeBody:
    'Everything else in this company is built. The funnel runs, the matching engine works, the quotes come from real rate cards. What nobody has yet is a single measurement of what a customer costs to reach.\n\nThat is the whole of the next ninety days, and it is the part of this business that is yours.',
  closeNote: 'Close on the measurement, not the cheque.',
};

// ═══════════════════════════════════════════════════════════════
// Build
// ═══════════════════════════════════════════════════════════════

function buildDeck(person) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'One Interiors';
  pres.title = `One Interiors — ${person.name}`;

  // pptxgenjs exposes ShapeType on the instance; the helpers read it.
  pres_ShapeType = pres.ShapeType;

  titleSlide(pres, person);
  whatWeAreBuilding(pres);
  whereItIsToday(pres);
  theMoney(pres);
  yourRole(pres, person);
  whatYouGet(pres, person);
  whatIsExpected(pres, person);
  capTable(pres, person);
  whatWouldGoWrong(pres, person);
  closeSlide(pres, person);

  const out = path.join(__dirname, '..', 'docs', person.file);
  return pres.writeFile({ fileName: out }).then(() => console.log('Wrote ' + out));
}

/**
 * Sequential, not `Promise.all`.
 *
 * `pres_ShapeType` is module-level state that `buildDeck` sets per
 * presentation, so two builds running concurrently would race on it — the
 * second would overwrite the first's value mid-render. One instance per output
 * file is the library's own rule; this keeps to it.
 */
[SANYAM, YOGESH, HAUSPIRE, SWARUPA]
  .reduce((chain, person) => chain.then(() => buildDeck(person)), Promise.resolve())
  .then(() => console.log('\nFour decks written to docs/.'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
