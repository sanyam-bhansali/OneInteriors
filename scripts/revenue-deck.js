/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, run directly, outside the Next module graph */

/**
 * The pitch deck. One presentation, for the room.
 *
 *   npm install --save-dev pptxgenjs
 *   node scripts/revenue-deck.js
 *
 * Writes docs/company-deck.pptx.
 *
 * The idea, the revenue model, and what each shareholder brings and takes.
 * Written to be presented, not read alone.
 *
 * The sensitivities, the unpriced costs and the open questions are not in here
 * by design — they live in docs/year-one-model.html (which is a live calculator
 * anyone can re-run) and docs/gtm-plan.html. This deck is the case; those are
 * the workings.
 */

const pptxgen = require('pptxgenjs');
const path = require('path');

// ── Palette ────────────────────────────────────────────────────
const PETROL = '1A6068';
const PETROL_DEEP = '10454B';
const TERRACOTTA = 'BC6440';
const BRASS = 'C9922A';
const SAGE = '6E7A5A';
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
const M = 0.7;

// ═══════════════════════════════════════════════════════════════
// THE MODEL
// ═══════════════════════════════════════════════════════════════

const YEAR_ONE = [
  { m: 1, studios: 10, per: 1.0, projects: 10, commission: 6.4, subs: 0, contribution: 6.2 },
  { m: 2, studios: 10, per: 1.0, projects: 10, commission: 6.4, subs: 0, contribution: 6.2 },
  { m: 3, studios: 10, per: 1.0, projects: 10, commission: 6.4, subs: 0, contribution: 6.2 },
  { m: 4, studios: 11, per: 1.4, projects: 16, commission: 10.2, subs: 6.2, contribution: 16.1 },
  { m: 5, studios: 12, per: 1.9, projects: 23, commission: 14.7, subs: 6.8, contribution: 21.0 },
  { m: 6, studios: 13, per: 2.3, projects: 30, commission: 19.1, subs: 7.3, contribution: 25.8 },
  { m: 7, studios: 15, per: 2.8, projects: 42, commission: 26.8, subs: 8.4, contribution: 34.4 },
  { m: 8, studios: 16, per: 3.2, projects: 52, commission: 33.2, subs: 9.0, contribution: 41.1 },
  { m: 9, studios: 18, per: 3.7, projects: 66, commission: 42.1, subs: 10.1, contribution: 50.9 },
  { m: 10, studios: 19, per: 4.1, projects: 78, commission: 49.7, subs: 10.7, contribution: 58.9 },
  { m: 11, studios: 21, per: 4.6, projects: 96, commission: 61.2, subs: 11.8, contribution: 71.1 },
  { m: 12, studios: 24, per: 5.0, projects: 120, commission: 76.5, subs: 13.5, contribution: 87.6 },
];

const FIVE_YEAR = [
  { year: 'Year 1', cities: 1, studios: 24, projects: 553, commission: 3.53, subs: 0.84, escrow: 0, crm: 0, product: 0, note: 'Pune. Pilot, then subscriptions from month four.' },
  { year: 'Year 2', cities: 3, studios: 100, projects: 2233, commission: 14.24, subs: 3.49, escrow: 2.81, crm: 0, product: 0, note: 'Two new cities. Escrow adds a third revenue line.' },
  { year: 'Year 3', cities: 5, studios: 175, projects: 4200, commission: 26.78, subs: 11.81, escrow: 5.62, crm: 0.6, product: 8.4, note: 'Both new streams start. CRM at 100 seats.' },
  { year: 'Year 4', cities: 7, studios: 245, projects: 7000, commission: 44.63, subs: 16.54, escrow: 9.37, crm: 2.4, product: 14.0, note: 'CRM sells beyond our own roster.' },
  { year: 'Year 5', cities: 10, studios: 350, projects: 11000, commission: 70.13, subs: 23.63, escrow: 14.73, crm: 4.8, product: 22.0, note: 'Ten cities. Five lines, three of them not fees.' },
];

function total(y) {
  return y.commission + y.subs + y.escrow + y.crm + y.product;
}

/** ₹30 lakh at ₹1 crore post-money: 30% sold, ₹70 lakh pre-money. */
const CAP = [
  { who: 'Yogesh', pct: 40, what: 'Founder', note: 'The idea, the direction, the decisions' },
  { who: 'Sanyam', pct: 20, what: 'Execution', note: 'Product, studios, customers, operations. Salary from month four' },
  { who: 'Hauspire', pct: 20, what: '₹20 lakh', note: 'Investor, pilot studio one, and the factory route' },
  { who: 'Swarupa', pct: 10, what: '₹10 lakh', note: 'Investor, and marketing' },
  { who: 'ESOP pool', pct: 10, what: 'Reserved', note: 'For the experts and ops hires the plan needs' },
];

// ═══════════════════════════════════════════════════════════════
// Helpers — fresh option objects every call; pptxgenjs mutates them
// ═══════════════════════════════════════════════════════════════

let SHAPE = null;

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
    y: opts.y || 0.5,
    w: W - M * 2,
    h: opts.h || 0.9,
    fontFace: HEAD,
    fontSize: opts.size || 32,
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
    y: opts.y || 1.45,
    w: opts.w || W - M * 2 - 0.6,
    h: opts.h || 0.8,
    fontFace: BODY,
    fontSize: opts.size || 16,
    color: opts.color || INK_2,
    lineSpacingMultiple: 1.22,
    margin: 0,
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(SHAPE.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: opts.fill || CREAM },
    line: { color: opts.line || RULE, width: 1 },
  });
}

function stat(slide, x, y, w, value, label, opts = {}) {
  slide.addText(value, {
    isTextBox: true,
    x,
    y,
    w,
    h: 0.72,
    fontFace: HEAD,
    fontSize: opts.size || 30,
    bold: true,
    color: opts.color || PETROL,
    margin: 0,
    valign: 'middle',
  });
  slide.addText(label, {
    isTextBox: true,
    x,
    y: y + 0.72,
    w,
    h: 0.62,
    fontFace: BODY,
    fontSize: 11,
    color: INK_3,
    lineSpacingMultiple: 1.15,
    margin: 0,
    valign: 'top',
  });
}

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

function footnote(slide, text, y = 6.8) {
  slide.addText(text, {
    isTextBox: true,
    x: M,
    y,
    w: W - M * 2,
    h: 0.5,
    fontFace: BODY,
    fontSize: 10.5,
    italic: true,
    color: INK_3,
    lineSpacingMultiple: 1.15,
    margin: 0,
    valign: 'top',
  });
}

function tableRow(slide, y, cells, widths, opts = {}) {
  let x = M;
  const h = opts.h || 0.42;

  if (opts.fill) {
    slide.addShape(SHAPE.rect, {
      x: M,
      y,
      w: W - M * 2,
      h,
      fill: { color: opts.fill },
      line: { color: opts.fill, width: 0 },
    });
  }

  cells.forEach((cell, i) => {
    const w = (W - M * 2) * widths[i];
    slide.addText(String(cell), {
      isTextBox: true,
      x,
      y,
      w,
      h,
      fontFace: BODY,
      fontSize: opts.size || 12,
      bold: opts.bold || false,
      color: opts.color || INK_2,
      align: i === 0 ? 'left' : 'right',
      valign: 'middle',
      margin: 0,
    });
    x += w;
  });
}

function _row(slide, x, y, w, badge, header, body, opts = {}) {
  slide.addShape(SHAPE.ellipse, {
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
// SLIDES
// ═══════════════════════════════════════════════════════════════

function slideTitle(pres) {
  const s = dark(pres);

  s.addText('One Interiors', {
    isTextBox: true,
    x: M,
    y: 2.0,
    w: W - M * 2,
    h: 0.95,
    fontFace: HEAD,
    fontSize: 50,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addText('Certainty, not taste.', {
    isTextBox: true,
    x: M,
    y: 3.05,
    w: 10.5,
    h: 0.6,
    fontFace: HEAD,
    fontSize: 24,
    italic: true,
    color: BRASS,
    margin: 0,
  });

  s.addText(
    'A curated interior-design marketplace for Pune. Verified studios, a real price before anyone meets, and a neutral expert on the call — built, tested and ready to open.',
    {
      isTextBox: true,
      x: M,
      y: 3.9,
      w: 9.2,
      h: 1.2,
      fontFace: BODY,
      fontSize: 16,
      color: 'CFE0E2',
      lineSpacingMultiple: 1.3,
      margin: 0,
    },
  );

  s.addText('Pune  ·  September 2026  ·  ₹30 lakh at ₹1 crore post-money', {
    isTextBox: true,
    x: M,
    y: 5.9,
    w: 10,
    h: 0.4,
    fontFace: BODY,
    fontSize: 14,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addNotes('Open on the sentence, not the numbers. Certainty, not taste.');
}

function slideTheProblem(pres) {
  const s = light(pres);
  title(s, 'The problem is not finding a designer.');
  lede(
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

  s.addText('These are execution failures, not matching failures.', {
    isTextBox: true,
    x: M,
    y: 4.9,
    w: 11.4,
    h: 0.5,
    fontFace: HEAD,
    fontSize: 22,
    bold: true,
    color: INK,
    margin: 0,
  });

  bullets(s, M, 5.5, 11.4, 1.2, [
    '₹7–27 lakh a project — the largest discretionary purchase most Indian households make after the flat itself.',
    'Once a decade, irreversible, and the buyer has no basis for judging quality.',
    'So we sell certainty. Every feature follows from that one sentence.',
  ], { size: 13.5, gap: 7 });

  s.addNotes('Read the four cards out. Then land the line about execution failures.');
}

function slideHowItWorks(pres) {
  const s = light(pres);
  title(s, 'How it works.');
  lede(s, 'Built and running today — brief to introduction, with nothing left to a phone call that a page can do better.');

  const steps = [
    ['Brief', 'Nine questions,\nabout three minutes'],
    ['Match', 'Ranked studios with\nthe reason in words'],
    ['Quote', 'Priced from each\nstudio’s own rates'],
    ['Compare', 'Side by side, plus a\nlink for the spouse'],
    ['Prepare', 'Their own moodboard\nwhile they wait'],
    ['Expert call', 'The only route to\nan introduction'],
  ];

  const cw = 1.86;
  steps.forEach((st, i) => {
    const x = M + i * (cw + 0.13);
    card(s, x, 2.5, cw, 2.0);
    slideCircle(s, x + 0.2, 2.7, String(i + 1));
    s.addText(st[0], {
      isTextBox: true,
      x: x + 0.2,
      y: 3.25,
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
      y: 3.64,
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
    ['432 tests', 'Passing. Money and matching\nlogic are unit-tested'],
    ['Deployed', 'Running in Mumbai,\nwaiting on a launch date'],
    ['Studio + ops', 'Both consoles built —\nnot just the customer side'],
  ];
  const fw = 2.9;
  facts.forEach((f, i) => {
    stat(s, M + i * (fw + 0.08), 5.0, fw, f[0], f[1], { size: 26 });
  });

  s.addNotes('The point of this slide is that the money is not being raised to build the product.');
}

function slideCircle(slide, x, y, label) {
  slide.addShape(SHAPE.ellipse, { x, y, w: 0.42, h: 0.42, fill: { color: PETROL } });
  slide.addText(label, {
    isTextBox: true,
    x,
    y,
    w: 0.42,
    h: 0.42,
    fontFace: BODY,
    fontSize: 12,
    bold: true,
    color: WHITE,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });
}

function slideDefensible(pres) {
  const s = dark(pres);

  s.addText('The subscription buys volume.\nIt never buys position.', {
    isTextBox: true,
    x: M,
    y: 1.3,
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
    'How many briefs a studio is shown for is something they pay us to increase. Where they appear inside a customer’s results comes from fit alone, and no amount of money moves it. That is the whole differentiation, and it is enforced in the code rather than in a policy.',
    {
      isTextBox: true,
      x: M,
      y: 3.4,
      w: 10.4,
      h: 1.1,
      fontFace: BODY,
      fontSize: 16.5,
      color: 'CFE0E2',
      lineSpacingMultiple: 1.3,
      margin: 0,
    },
  );

  const guards = [
    ['No paid placement', 'No sponsored slots, no featured cards, no promoted results anywhere in the product.'],
    ['Verification, published', 'Twelve checks per studio, each with a date and a source. A dated checklist, not a badge.'],
    ['The data nobody can buy', 'Delivery variance on every completed project — who finished on time, and by how much. It compounds from project one.'],
  ];
  const cw = 3.84;
  guards.forEach((g, i) => {
    const x = M + i * (cw + 0.2);
    s.addShape(SHAPE.roundRect, {
      x,
      y: 4.85,
      w: cw,
      h: 1.75,
      rectRadius: 0.08,
      fill: { color: PETROL },
      line: { color: '2E7D85', width: 1 },
    });
    s.addText(g[0], {
      isTextBox: true,
      x: x + 0.26,
      y: 5.05,
      w: cw - 0.52,
      h: 0.4,
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
      y: 5.48,
      w: cw - 0.52,
      h: 1.0,
      fontFace: BODY,
      fontSize: 12,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'top',
    });
  });

  s.addNotes('This is the moat slide. Everything else in the plan is replicable; the delivery data is not.');
}

function slideHowMoneyWorks(pres) {
  const s = light(pres);
  title(s, 'Where a rupee comes from.');
  lede(s, 'Five lines by year five. Two live from day one, and three added as the roster grows.');

  const lines = [
    ['Commission', '5% of every closed project', 'Year 1', PETROL],
    ['Subscription', '₹25k / ₹50k / ₹1L a month per studio', 'Year 1, month 4', PETROL],
    ['Escrow', '1.75% customer-side on project value', 'Year 2', TERRACOTTA],
    ['CRM software', 'A seat price, sold on and off the roster', 'Year 3', SAGE],
    ['Product supply', '20% on product sold through the roster', 'Year 3', SAGE],
  ];

  let y = 2.5;
  lines.forEach((l) => {
    card(s, M, y, W - M * 2, 0.78);
    s.addText(l[0], {
      isTextBox: true,
      x: M + 0.3,
      y,
      w: 2.8,
      h: 0.78,
      fontFace: BODY,
      fontSize: 15,
      bold: true,
      color: l[3],
      margin: 0,
      valign: 'middle',
    });
    s.addText(l[1], {
      isTextBox: true,
      x: M + 3.2,
      y,
      w: 5.4,
      h: 0.78,
      fontFace: BODY,
      fontSize: 13.5,
      color: INK_2,
      margin: 0,
      valign: 'middle',
    });
    s.addText(l[2], {
      isTextBox: true,
      x: M + 8.8,
      y,
      w: 3.0,
      h: 0.78,
      fontFace: BODY,
      fontSize: 12.5,
      color: INK_3,
      align: 'right',
      margin: 0,
      valign: 'middle',
    });
    y += 0.86;
  });

  s.addText(
    'A studio does not compare our fee to zero. It compares it to what a booked project costs through its own advertising today — and at target the blended rate lands between 5.7% and 6.0%.',
    {
      isTextBox: true,
      x: M,
      y: 6.85,
      w: W - M * 2,
      h: 0.5,
      fontFace: BODY,
      fontSize: 13.5,
      color: INK_2,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes('The comparison to their own ad spend is the number that closes a studio.');
}

function slideYearOneShape(pres) {
  const s = light(pres);
  title(s, 'Year one.');
  lede(s, 'Ten pilot studios, subscriptions from month four, one city. Growth comes from the ramp per studio.');

  s.addChart(
    pres.ChartType.bar,
    [
      {
        name: 'Projects closed',
        labels: YEAR_ONE.map((r) => `M${r.m}`),
        values: YEAR_ONE.map((r) => r.projects),
      },
    ],
    {
      x: M,
      y: 2.45,
      w: 7.5,
      h: 3.6,
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
    ['₹4.36 Cr', 'gross revenue\n₹3.53 Cr fees · ₹83.8 L subs'],
    ['553', 'projects closed\n₹70.51 Cr of work placed'],
    ['₹12.75 L', 'blended project value\n25 / 50 / 25 tier mix'],
    ['₹90 L', 'month-twelve run rate\n120 projects that month'],
  ];
  cells.forEach((c, i) => {
    stat(s, M + 7.9 + (i % 2) * 2.1, 2.7 + Math.floor(i / 2) * 1.6, 2.0, c[0], c[1], {
      size: i === 0 ? 25 : 27,
    });
  });

  footnote(s, 'Figures in Indian lakh and crore, gross of GST.', 6.25);

  s.addNotes('Give the headline, then go to the month-by-month table for anyone who wants the shape.');
}

function slideYearOneTable(pres) {
  const s = light(pres);
  title(s, 'Year one, month by month.', { size: 30 });
  lede(s, 'Figures in lakh. Three months of pilot at one project per studio, then the ramp.', {
    y: 1.35,
    h: 0.5,
    size: 14,
  });

  const widths = [0.13, 0.12, 0.13, 0.13, 0.16, 0.16, 0.17];
  tableRow(
    s,
    2.0,
    ['Month', 'Studios', 'Per studio', 'Projects', 'Commission', 'Subscription', 'Contribution'],
    widths,
    { bold: true, color: INK, size: 11.5, fill: CREAM, h: 0.4 },
  );

  let y = 2.42;
  YEAR_ONE.forEach((r) => {
    tableRow(
      s,
      y,
      [
        r.m <= 3 ? `${r.m} · pilot` : String(r.m),
        r.studios,
        r.per.toFixed(1),
        r.projects,
        `₹${r.commission.toFixed(1)} L`,
        r.subs === 0 ? '—' : `₹${r.subs.toFixed(1)} L`,
        `₹${r.contribution.toFixed(1)} L`,
      ],
      widths,
      { size: 11, h: 0.33, fill: r.m % 2 === 0 ? PAPER : 'FCFBF9' },
    );
    y += 0.33;
  });

  tableRow(s, y + 0.06, ['Year one', '24', '5.0', '553', '₹3.53 Cr', '₹83.8 L', '₹4.25 Cr'], widths, {
    bold: true,
    color: INK,
    size: 11.5,
    fill: 'E8F0F0',
    h: 0.42,
  });

  s.addNotes('Month four is the one to point at — the first month with two revenue lines running together.');
}

function slideYearTwo(pres) {
  const s = light(pres);
  title(s, 'Year two: the second city.');
  lede(s, 'Pune runs toward its cap. Each new city repeats the same three-month pilot, then compounds.');

  const nums = [
    ['₹20.54 Cr', 'gross revenue across three cities'],
    ['2,233', 'projects · ₹284.71 Cr placed'],
    ['₹14.24 Cr', 'commission, the largest line'],
    ['3', 'cities live by the end of the year'],
  ];
  nums.forEach((n, i) => {
    stat(s, M + i * 3.05, 2.5, 2.9, n[0], n[1], { size: 27 });
  });

  card(s, M, 4.3, 5.86, 2.1, { fill: 'EEF3F0', line: 'C9D6CE' });
  s.addText('The playbook repeats', {
    isTextBox: true,
    x: M + 0.28,
    y: 4.52,
    w: 5.3,
    h: 0.4,
    fontFace: HEAD,
    fontSize: 16,
    bold: true,
    color: SAGE,
    margin: 0,
    valign: 'top',
  });
  s.addText(
    'The software is city-agnostic. Launching a new city is an ops hire and three months of verification before revenue — a known, repeatable cost with a known, repeatable return.\n\nBy year two the model is proven in one city and running in three.',
    {
      isTextBox: true,
      x: M + 0.28,
      y: 4.98,
      w: 5.3,
      h: 1.3,
      fontFace: BODY,
      fontSize: 12.5,
      color: INK,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );

  card(s, M + 6.07, 4.3, 5.86, 2.1, { fill: PETROL });
  s.addText('And the asset starts paying', {
    isTextBox: true,
    x: M + 6.35,
    y: 4.52,
    w: 5.3,
    h: 0.4,
    fontFace: HEAD,
    fontSize: 16,
    bold: true,
    color: BRASS,
    margin: 0,
    valign: 'top',
  });
  s.addText(
    'By the end of year two we hold delivery variance on 2,233 completed projects — who finished on time, who did not, and by how much.\n\nThat cannot be bought from a vendor or copied in a weekend, and it is what the two new revenue streams are built on top of.',
    {
      isTextBox: true,
      x: M + 6.35,
      y: 4.98,
      w: 5.3,
      h: 1.3,
      fontFace: BODY,
      fontSize: 12.5,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes('Year two is where the model stops being a Pune story.');
}

function slideNewStreams(pres) {
  const s = dark(pres);

  s.addText('Fifty studios a city\nis a ceiling worth having.', {
    isTextBox: true,
    x: M,
    y: 1.3,
    w: 11.5,
    h: 1.9,
    fontFace: HEAD,
    fontSize: 38,
    bold: true,
    color: WHITE,
    lineSpacingMultiple: 1.1,
    margin: 0,
  });

  s.addText(
    'The roster is capped by design — a city holds about fifty studios worth verifying, and the scarcity is what makes the product worth anything. A roster anyone can join is a directory, and a directory is worth nothing.',
    {
      isTextBox: true,
      x: M,
      y: 3.3,
      w: 10.6,
      h: 0.95,
      fontFace: BODY,
      fontSize: 16,
      color: 'CFE0E2',
      lineSpacingMultiple: 1.3,
      margin: 0,
    },
  );

  s.addText(
    'So growth past year two is more cities, or more revenue per studio. The two new streams are the second — and both are sold to people we already speak to every day.',
    {
      isTextBox: true,
      x: M,
      y: 4.4,
      w: 10.6,
      h: 0.85,
      fontFace: BODY,
      fontSize: 16,
      color: WHITE,
      lineSpacingMultiple: 1.3,
      margin: 0,
    },
  );

  const streams = [
    ['CRM software', 'Sold to studios on AND off the roster. No cap — a studio does not have to be good enough to verify in order to buy software.'],
    ['Product supply', '20% on product sold through studios we already have a relationship with. The factory route Hauspire brings.'],
  ];
  streams.forEach((st, i) => {
    const x = M + i * 6.07;
    s.addShape(SHAPE.roundRect, {
      x,
      y: 5.5,
      w: 5.86,
      h: 1.55,
      rectRadius: 0.08,
      fill: { color: PETROL },
      line: { color: '2E7D85', width: 1 },
    });
    s.addText(st[0], {
      isTextBox: true,
      x: x + 0.28,
      y: 5.7,
      w: 5.3,
      h: 0.38,
      fontFace: HEAD,
      fontSize: 16,
      bold: true,
      color: BRASS,
      margin: 0,
      valign: 'top',
    });
    s.addText(st[1], {
      isTextBox: true,
      x: x + 0.28,
      y: 6.12,
      w: 5.3,
      h: 0.8,
      fontFace: BODY,
      fontSize: 12,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'top',
    });
  });

  s.addNotes('The cap is the argument. Without it the new streams read as a distraction.');
}

function slideCrmAndProduct(pres) {
  const s = light(pres);
  title(s, 'Two new businesses, from the same relationships.');
  lede(s, 'Both start in year three, and both are built on software and supply we already have.');

  // CRM
  card(s, M, 2.45, 5.86, 4.0, { fill: CREAM });
  s.addText('CRM software', {
    isTextBox: true,
    x: M + 0.32,
    y: 2.68,
    w: 5.2,
    h: 0.45,
    fontFace: HEAD,
    fontSize: 20,
    bold: true,
    color: PETROL,
    margin: 0,
    valign: 'top',
  });
  s.addText('100 customers  ·  ₹5,000 a month  =  ₹60 lakh a year', {
    isTextBox: true,
    x: M + 0.32,
    y: 3.15,
    w: 5.2,
    h: 0.4,
    fontFace: BODY,
    fontSize: 13.5,
    bold: true,
    color: BRASS,
    margin: 0,
    valign: 'top',
  });
  bullets(s, M + 0.32, 3.65, 5.2, 2.6, [
    'Built, not planned — the studio dashboard, quotation engine and calendar already exist and are in use.',
    'Sold to the several thousand studios a curated roster will never admit.',
    'A rejection becomes a smaller sale rather than a dead end.',
    'A software margin on top of a marketplace margin, from one conversation.',
  ], { size: 12.5, gap: 8 });

  // Product
  card(s, M + 6.07, 2.45, 5.86, 4.0, { fill: CREAM });
  s.addText('Product supply', {
    isTextBox: true,
    x: M + 6.39,
    y: 2.68,
    w: 5.2,
    h: 0.45,
    fontFace: HEAD,
    fontSize: 20,
    bold: true,
    color: PETROL,
    margin: 0,
    valign: 'top',
  });
  s.addText('₹1 lakh of product a project  ·  20% to us  =  ₹20,000', {
    isTextBox: true,
    x: M + 6.39,
    y: 3.15,
    w: 5.2,
    h: 0.4,
    fontFace: BODY,
    fontSize: 13.5,
    bold: true,
    color: BRASS,
    margin: 0,
    valign: 'top',
  });
  bullets(s, M + 6.39, 3.65, 5.2, 2.6, [
    'Every project buys shutters, hardware, lighting and furnishing.',
    'We know the project, the budget and the moodboard before the studio is even introduced.',
    'Hauspire’s factory is the first supply route, and the relationship already exists.',
    '₹8.4 Cr in year three, on a fifth of projects taking it.',
  ], { size: 12.5, gap: 8 });

  s.addNotes('The prep pack is the unfair advantage here — we hold the demand signal before anyone else sees it.');
}

function slideFiveYearTable(pres) {
  const s = light(pres);
  title(s, 'Five years.');
  lede(s, 'In crore, by revenue line.', { y: 1.35, h: 0.5, size: 14 });

  const widths = [0.14, 0.09, 0.1, 0.11, 0.13, 0.11, 0.1, 0.1, 0.12];
  tableRow(
    s,
    2.0,
    ['', 'Cities', 'Studios', 'Projects', 'Commission', 'Subs', 'Escrow', 'CRM', 'Product'],
    widths,
    { bold: true, color: INK, size: 11.5, fill: CREAM, h: 0.42 },
  );

  let y = 2.44;
  FIVE_YEAR.forEach((r, i) => {
    tableRow(
      s,
      y,
      [
        r.year,
        r.cities,
        r.studios,
        r.projects.toLocaleString('en-IN'),
        `₹${r.commission.toFixed(2)}`,
        `₹${r.subs.toFixed(2)}`,
        r.escrow === 0 ? '—' : `₹${r.escrow.toFixed(2)}`,
        r.crm === 0 ? '—' : `₹${r.crm.toFixed(2)}`,
        r.product === 0 ? '—' : `₹${r.product.toFixed(2)}`,
      ],
      widths,
      { size: 12.5, h: 0.52, fill: i % 2 === 0 ? 'FCFBF9' : PAPER },
    );
    y += 0.52;
  });

  const totals = FIVE_YEAR.map((r) => `₹${total(r).toFixed(2)}`);
  tableRow(
    s,
    y + 0.12,
    ['Gross revenue', totals[0], totals[1], totals[2], totals[3], totals[4]],
    [0.3, 0.14, 0.14, 0.14, 0.14, 0.14],
    { bold: true, color: PETROL, size: 14, fill: 'E8F0F0', h: 0.55 },
  );

  footnote(
    s,
    'Escrow at 1.75% on 60% take-up. CRM at ₹5,000 a seat. Product at ₹20,000 to us per project taking it. Gross of GST.',
    6.3,
  );

  s.addNotes('The totals row is the only comparison anyone will make. Let it sit for a moment.');
}

function slideFiveYearChart(pres) {
  const s = light(pres);
  title(s, 'The same thing, drawn.');
  lede(s, 'Commission stays the largest line. By year five, three of the five are not marketplace fees.');

  s.addChart(
    pres.ChartType.bar,
    [
      { name: 'Commission', labels: FIVE_YEAR.map((r) => r.year), values: FIVE_YEAR.map((r) => r.commission) },
      { name: 'Subscription', labels: FIVE_YEAR.map((r) => r.year), values: FIVE_YEAR.map((r) => r.subs) },
      { name: 'Escrow', labels: FIVE_YEAR.map((r) => r.year), values: FIVE_YEAR.map((r) => r.escrow) },
      { name: 'CRM', labels: FIVE_YEAR.map((r) => r.year), values: FIVE_YEAR.map((r) => r.crm) },
      { name: 'Product', labels: FIVE_YEAR.map((r) => r.year), values: FIVE_YEAR.map((r) => r.product) },
    ],
    {
      x: M,
      y: 2.4,
      w: 7.6,
      h: 3.9,
      barDir: 'col',
      barGrouping: 'stacked',
      chartColors: [PETROL, '3E8E97', TERRACOTTA, SAGE, BRASS],
      showTitle: true,
      title: 'Gross revenue by line, ₹ crore',
      titleFontSize: 13,
      titleColor: INK_2,
      showLegend: true,
      legendPos: 'b',
      legendFontSize: 10,
      legendColor: INK_2,
      catAxisLabelColor: INK_3,
      catAxisLabelFontSize: 11,
      valAxisLabelColor: INK_3,
      valAxisLabelFontSize: 10,
      valGridLine: { color: RULE, size: 1 },
      catGridLine: { style: 'none' },
    },
  );

  let y = 2.55;
  FIVE_YEAR.forEach((r) => {
    s.addText(`${r.year}  ·  ₹${total(r).toFixed(1)} Cr`, {
      isTextBox: true,
      x: M + 8.0,
      y,
      w: 4.2,
      h: 0.32,
      fontFace: BODY,
      fontSize: 13.5,
      bold: true,
      color: PETROL,
      margin: 0,
      valign: 'top',
    });
    s.addText(r.note, {
      isTextBox: true,
      x: M + 8.0,
      y: y + 0.32,
      w: 4.2,
      h: 0.55,
      fontFace: BODY,
      fontSize: 11.5,
      color: INK_3,
      lineSpacingMultiple: 1.15,
      margin: 0,
      valign: 'top',
    });
    y += 0.95;
  });

  s.addNotes('Point at the shape: commission dominant throughout, which means the marketplace stays the business.');
}

function slideExploring(pres) {
  const s = light(pres);
  title(s, 'And what comes after.');
  lede(s, 'Adjacent because we already hold the relationship or the data. None of it is in the numbers above.');

  const ideas = [
    ['Materials marketplace', 'Beyond the factory route — the long tail a studio orders every week, at platform terms.'],
    ['Finance and EMI referral', 'A ₹12 lakh project is financed more often than not, and we know the number before any lender does.'],
    ['Benchmarking reports', 'What interiors actually cost, by locality and finish. The data exists as a by-product of quoting.'],
    ['White-label for other cities', 'Licensing the software to an operator who brings the ground game.'],
    ['Verified-trades network', 'The same verification applied to the contractors and vendors studios already use.'],
    ['Post-handover service', 'Snagging, maintenance, the second project. The relationship does not end at handover.'],
  ];

  const cw = 3.84;
  ideas.forEach((idea, i) => {
    const x = M + (i % 3) * (cw + 0.2);
    const y = 2.4 + Math.floor(i / 3) * 2.05;
    card(s, x, y, cw, 1.85);
    s.addText(idea[0], {
      isTextBox: true,
      x: x + 0.26,
      y: y + 0.2,
      w: cw - 0.52,
      h: 0.5,
      fontFace: HEAD,
      fontSize: 15,
      bold: true,
      color: PETROL,
      margin: 0,
      valign: 'top',
    });
    s.addText(idea[1], {
      isTextBox: true,
      x: x + 0.26,
      y: y + 0.74,
      w: cw - 0.52,
      h: 1.0,
      fontFace: BODY,
      fontSize: 12,
      color: INK_2,
      lineSpacingMultiple: 1.18,
      margin: 0,
      valign: 'top',
    });
  });

  s.addNotes('One line each. This slide is about headroom, not about a plan.');
}

function slideTeam(pres) {
  const s = light(pres);
  title(s, 'Four people, four different jobs.');
  lede(s, 'Nobody here is a passenger, and nobody is doing two of these at once.');

  const people = [
    ['Yogesh', 'Founder', 'The idea, and the direction. Certainty over taste, volume never position, an expert call before any introduction — those three sentences are the company.'],
    ['Sanyam', 'Execution', 'The software, the studios, the customers, the calls. He built the entire product, and he runs the operation that turns it into a business.'],
    ['Hauspire', 'Investor · Studio one', '₹20 lakh, the first rate card on the platform, 980 real quotation files that shaped the pricing engine, and the factory route.'],
    ['Swarupa', 'Investor · Marketing', '₹10 lakh, and the demand side — the societies, the content, and the channels that bring the first two hundred briefs.'],
  ];

  const cw = 2.86;
  people.forEach((p, i) => {
    const x = M + i * (cw + 0.16);
    card(s, x, 2.45, cw, 3.4);
    s.addText(p[0], {
      isTextBox: true,
      x: x + 0.26,
      y: 2.7,
      w: cw - 0.52,
      h: 0.5,
      fontFace: HEAD,
      fontSize: 21,
      bold: true,
      color: PETROL,
      margin: 0,
      valign: 'top',
    });
    s.addText(p[1], {
      isTextBox: true,
      x: x + 0.26,
      y: 3.2,
      w: cw - 0.52,
      h: 0.35,
      fontFace: BODY,
      fontSize: 11,
      bold: true,
      color: BRASS,
      margin: 0,
      valign: 'top',
    });
    s.addText(p[2], {
      isTextBox: true,
      x: x + 0.26,
      y: 3.6,
      w: cw - 0.52,
      h: 2.1,
      fontFace: BODY,
      fontSize: 12,
      color: INK_2,
      lineSpacingMultiple: 1.2,
      margin: 0,
      valign: 'top',
    });
  });

  footnote(s, 'The plan needs an expert and an ops person per city on top of this. That is what the reserved 10% is for.', 6.2);

  s.addNotes('Short. It exists so the cap table that follows reads as earned rather than allocated.');
}

function slideCapTable(pres) {
  const s = light(pres);
  title(s, 'Who owns what.');
  lede(s, '₹30 lakh in, 30% sold, ₹70 lakh pre-money.');

  let y = 2.5;
  CAP.forEach((c, i) => {
    card(s, M, y, W - M * 2, 0.78, { fill: i % 2 === 0 ? PAPER : 'FCFBF9' });
    s.addText(c.who, {
      isTextBox: true,
      x: M + 0.3,
      y,
      w: 2.2,
      h: 0.78,
      fontFace: BODY,
      fontSize: 15,
      bold: true,
      color: c.who === 'ESOP pool' ? INK_3 : INK,
      margin: 0,
      valign: 'middle',
    });
    s.addText(`${c.pct}%`, {
      isTextBox: true,
      x: M + 2.5,
      y,
      w: 1.2,
      h: 0.78,
      fontFace: HEAD,
      fontSize: 20,
      bold: true,
      color: c.who === 'ESOP pool' ? INK_3 : PETROL,
      margin: 0,
      valign: 'middle',
    });
    s.addText(c.what, {
      isTextBox: true,
      x: M + 3.9,
      y,
      w: 2.0,
      h: 0.78,
      fontFace: BODY,
      fontSize: 12.5,
      bold: true,
      color: INK_2,
      margin: 0,
      valign: 'middle',
    });
    s.addText(c.note, {
      isTextBox: true,
      x: M + 6.0,
      y,
      w: 5.8,
      h: 0.78,
      fontFace: BODY,
      fontSize: 12,
      color: INK_2,
      margin: 0,
      valign: 'middle',
    });
    y += 0.84;
  });

  s.addText(
    'The 10% pool is reserved, not held. Reserving it now is far cheaper than diluting everybody later.',
    {
      isTextBox: true,
      x: M,
      y: y + 0.25,
      w: W - M * 2,
      h: 0.5,
      fontFace: BODY,
      fontSize: 13,
      color: INK_3,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes('Straightforward. Let the next slide do the work.');
}

function slideWhatEachGets(pres) {
  const s = dark(pres);

  s.addText('What each of us gets out of it.', {
    isTextBox: true,
    x: M,
    y: 0.7,
    w: W - M * 2,
    h: 0.8,
    fontFace: HEAD,
    fontSize: 34,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  const gets = [
    [
      'Yogesh · 40%',
      'The largest stake in a company he conceived, and the direction of what it becomes. By year two it holds delivery data on 2,233 projects that nobody can buy or copy.',
    ],
    [
      'Sanyam · 20% + salary',
      'A fifth of the company, a salary from month four, and the operating record — a marketplace built and run from nothing in a year.',
    ],
    [
      'Hauspire · 20%',
      'A fifth of the company for ₹20 lakh. The ₹1,00,000-a-month Luxury listing free forever — ₹12 lakh a year, more than half the cheque back in year one. Plus first access to premium clients, and first refusal on supplying product through the roster.',
    ],
    [
      'Swarupa · 10%',
      'A tenth of the company for ₹10 lakh, and marketing owned outright — including a content position no competitor can copy without first building the pricing engine.',
    ],
  ];

  const cw = 5.86;
  gets.forEach((g, i) => {
    const x = M + (i % 2) * (cw + 0.21);
    const y = 1.75 + Math.floor(i / 2) * 2.25;
    s.addShape(SHAPE.roundRect, {
      x,
      y,
      w: cw,
      h: 2.0,
      rectRadius: 0.08,
      fill: { color: PETROL },
      line: { color: '2E7D85', width: 1 },
    });
    s.addText(g[0], {
      isTextBox: true,
      x: x + 0.3,
      y: y + 0.22,
      w: cw - 0.6,
      h: 0.4,
      fontFace: HEAD,
      fontSize: 18,
      bold: true,
      color: BRASS,
      margin: 0,
      valign: 'top',
    });
    s.addText(g[1], {
      isTextBox: true,
      x: x + 0.3,
      y: y + 0.68,
      w: cw - 0.6,
      h: 1.2,
      fontFace: BODY,
      fontSize: 12.5,
      color: 'DCEAEB',
      lineSpacingMultiple: 1.22,
      margin: 0,
      valign: 'top',
    });
  });

  s.addText(
    'Sanyam’s salary starts in month four — the same month subscriptions do, so it begins when the recurring revenue that pays for it begins.',
    {
      isTextBox: true,
      x: M,
      y: 6.5,
      w: 11.6,
      h: 0.6,
      fontFace: BODY,
      fontSize: 13,
      color: 'CFE0E2',
      lineSpacingMultiple: 1.25,
      margin: 0,
      valign: 'top',
    },
  );

  s.addNotes('This is the slide everyone came for. Take it slowly.');
}

function slideClose(pres) {
  const s = dark(pres);

  s.addText('Built. Tested. Ready to open.', {
    isTextBox: true,
    x: M,
    y: 2.0,
    w: 11.5,
    h: 1.0,
    fontFace: HEAD,
    fontSize: 40,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addText(
    'The product is done — the funnel, the matching engine, the quotation engine, the studio dashboard and the ops console. ₹30 lakh takes it from a finished product to a working business: ten studios live, the first two hundred briefs, and the first expert hired.',
    {
      isTextBox: true,
      x: M,
      y: 3.2,
      w: 10.6,
      h: 1.3,
      fontFace: BODY,
      fontSize: 16,
      color: 'CFE0E2',
      lineSpacingMultiple: 1.3,
      margin: 0,
    },
  );

  const nums = [
    ['₹4.36 Cr', 'year one'],
    ['₹20.5 Cr', 'year two'],
    ['₹135 Cr', 'year five'],
  ];
  nums.forEach((n, i) => {
    const x = M + i * 4.0;
    s.addText(n[0], {
      isTextBox: true,
      x,
      y: 4.9,
      w: 3.6,
      h: 0.75,
      fontFace: HEAD,
      fontSize: 34,
      bold: true,
      color: BRASS,
      margin: 0,
      valign: 'middle',
    });
    s.addText(n[1], {
      isTextBox: true,
      x,
      y: 5.65,
      w: 3.6,
      h: 0.4,
      fontFace: BODY,
      fontSize: 13,
      color: 'CFE0E2',
      margin: 0,
      valign: 'top',
    });
  });

  s.addText('Waitlist opens 16 September.', {
    isTextBox: true,
    x: M,
    y: 6.4,
    w: 11,
    h: 0.5,
    fontFace: HEAD,
    fontSize: 20,
    bold: true,
    color: WHITE,
    margin: 0,
  });

  s.addNotes('Close on the date. It is the only thing in the deck that happens this week.');
}

// ═══════════════════════════════════════════════════════════════
// Build
// ═══════════════════════════════════════════════════════════════

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'One Interiors';
pres.title = 'One Interiors';
SHAPE = pres.ShapeType;

slideTitle(pres);
slideTheProblem(pres);
slideHowItWorks(pres);
slideDefensible(pres);
slideHowMoneyWorks(pres);
slideYearOneShape(pres);
slideYearOneTable(pres);
slideYearTwo(pres);
slideNewStreams(pres);
slideCrmAndProduct(pres);
slideFiveYearTable(pres);
slideFiveYearChart(pres);
slideExploring(pres);
slideTeam(pres);
slideCapTable(pres);
slideWhatEachGets(pres);
slideClose(pres);

const out = path.join(__dirname, '..', 'docs', 'company-deck.pptx');
pres
  .writeFile({ fileName: out })
  .then(() => console.log('Wrote ' + out))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
