# What to take from the Hauspire Quotation Studio

Read from the source at `Quotation automation/Quotation hosted`, not from a demo.
Dated 10 September 2026.

## Read this first: they are not the same product

The quotation studio is a **designer's tool**. One studio, one operator, full
control, and the person using it already knows the truth — so letting them edit
any number is correct.

One Interiors is a **customer's tool**. Many studios, a reader who cannot check
anything we say, and a promise that every number traces to a studio's own rates.
Here, an editable number is a fabricated number.

So this is not a list to copy wholesale. Three sections: what to carry, what to
adapt, and what would actively damage us.

---

## 1. Carry these over

### 1.1 Floor-plan extraction — and do the free version first

**The single biggest win available to us.** The old app uploads a plan and reads
the room list and dimensions out of it.

Why it matters more here than it did there: `estimate.ts` widens the quote band
by **+15 points** when property type is unknown and **+10** when carpet area is
unknown. Those are the two largest terms in the whole variance model, and a
floor plan supplies both. Reading one plan does more for quote accuracy than
every other improvement on our list combined — and it is the difference between
a ±35% band a customer cannot plan against and a ±15% one they can.

Take the architecture exactly as built, because the ordering is the clever part:

1. **Tesseract.js in the browser first.** Free, no API key, no per-call cost, no
   image leaving the device. At our funnel volumes a paid vision call on every
   upload is a real line item; at theirs it was already worth avoiding.
2. **Vision model as fallback**, only when OCR fails.
3. **Manual entry** when both fail.

Their preprocessing is commented as "the single biggest free accuracy win" and
is worth lifting verbatim: upscale to a 2200px long edge (cap 3×), grayscale on
0.299/0.587/0.114 luma, then an **Otsu threshold** to binarise. Tesseract runs
in page-seg mode 11 (sparse text) because plan labels are scattered rather than
in paragraphs.

Two more details that are pure scar tissue:

- The dimension regex accepts `'`, `’`, `º`, `o` and `"` as the foot mark,
  because OCR reliably misreads apostrophes.
- Dimensions outside 600–12000 mm are discarded as misreads rather than used.

**And the part that matters most to us:** `ocrExtractPlan` returns `null` when
it finds fewer than two rooms, and its confidence is only ever `"medium"` or
`"low"` — never `"high"`. It refuses to be confident. That is the same rule
`portfolio-draft.ts` already enforces for studio profiles, and it should govern
this too: **AI proposes, the customer confirms, and we never auto-finalise a
misread.** A wrong carpet area silently baked into four quotes is worse than no
carpet area at all.

### 1.2 The isometric 3D view of *their* flat

The old app builds a real three.js dollhouse from the quote's own dimensions —
orthographic camera, only the −z and −x walls at 1.4 m so you can see in,
furniture modelled from primitives and sized from the actual numbers.

Our `/match` reveal currently shows generated style art. It is good art, but it
is generic — the same picture every customer with that style tag sees. A massing
of *their own flat* is a categorically stronger "we listened" moment, and it
arrives at exactly the point in the funnel we need one.

It also solves a problem we already identified and have only half-fixed: the
second decision-maker. A picture of your own flat is the thing that actually
gets forwarded to a spouse. The share link gives them a table; this would give
them something to look at.

The detail to keep: `preserveDrawingBuffer: true` on the renderer, purely so the
canvas can be captured to PNG. **"Download image" is free, offline and always
works**; the AI-beautified render is optional garnish behind a key. That ordering
is the honest one and should not be reversed.

### 1.3 Show the payment schedule before they choose a studio

The old app prices a booking advance of **₹25,000, labelled "Fully Refundable
for 3 days"**, then splits the remainder 5% first draft / 10% design closure /
40% procurement / 40% dispatch / 5% handover — each with a customer-facing
description.

We claim the frightening part of this purchase is the money and the timeline,
and then we show neither. A customer looking at four quotes cannot tell that
80% of the money moves before anything is installed. Nobody else in this market
shows that up front, it costs us nothing, and it is the most on-thesis thing in
this entire document.

The percentages are Hauspire's, not ours — see §3.

### 1.4 Per-line specification text

`template.json` carries real boilerplate spec text per item, not just a price.
That text is the difference between "Modular kitchen — ₹2,10,000", which is
uncomparable, and a line a customer can actually hold two studios against.

Our compare table shows category totals. Category totals plus specification text
is a genuinely better comparison, and it is the cheapest way to make the compare
screen worth the visit.

### 1.5 Revisions as new quotes, never edits

"Revise →" copies the old quote's lines into a new one with `fromId` set. The
old quote survives untouched.

Our `Quotation` model already stores every quote ever generated for a brief —
`quoteHistory()` exists and nothing calls it. This is the "quotation revisions"
from the original brief, and the schema is already right. It needs a screen.

### 1.6 The AI integration rules, verbatim

From their own learnings file, every one of these earned in production:

- **Model names get retired.** Resolve from the provider's list API; never
  hardcode. (They resolve Claude *and* Gemini this way.)
- **Parse defensively.** A brace-balanced scanner, not a greedy regex — models
  emit reasoning blocks before the JSON, and braces occur inside strings.
- **Read all content blocks**, not `content[0]`.
- **Retry 503 with backoff**, then a second provider, then a non-AI path.
- **Surface the raw provider error to the UI.**

Our `portfolio-agent.ts` should adopt all five. We have already been bitten by
model naming once this project.

### 1.7 How to write a failure message

When the image model returns 429 they tell the user: *"Image-AI quota exceeded —
this needs billing enabled. Use ⬇ Download image (free) instead."*

Cause, consequence, and a working alternative in one sentence. That is the
template for every failure string we write.

---

## 2. Adapt, do not copy

**Inline-editable quote lines.** In their app the designer edits, and the
designer is the authority. Here the *studio's rate card* is the authority, and a
customer editing a quote would be inventing a number and attributing it to a
business. Editing belongs in the studio's rate card and nowhere else. What we
should take is the *feel* — live recompute, no modal, no save button — and apply
it to the studio onboarding rate-card screen, which is currently a plain form.

**The room-by-room breakdown.** Their table groups by room with per-room
subtotals. Ours groups by category. Room grouping is more legible to a customer
("the kitchen is where the money is") and we have the room data. Worth doing
once quotes come from real rate cards.

---

## 3. Do not carry these across

**The 7% fee and 15% modular discount as platform constants.** These are
Hauspire's commercial terms. Baking them into the platform is precisely the
governance breach the partner brief commits us to avoiding — a studio's prices
must come from that studio and nowhere else. `price.ts` deliberately has no
default rate and no market fallback, and there is a test asserting it refuses to
quote rather than invent. That must not weaken.

**The on-spot discount, and the struck-through "before" price.** Their quote
table renders modular amounts struck through in grey with the discounted figure
in green beside them. On a designer's tool, negotiating in front of the client,
that is a legitimate sales instrument.

On a marketplace it is the exact mechanic we are positioned against: invent an
anchor, discount from it, let the customer feel they won. It would work. It
would also make every honesty claim on our landing page worthless the first time
someone noticed the "before" number was never charged to anyone. The customer
sees one number, and it is the studio's real one.

**Making the customer confirm the kitchen run.** Their designer knows what an
L-kitchen corner allowance is. Our customer does not, and asking is how a
confident flow starts feeling like homework. Read it, apply `width + depth −
900mm` as they do, record it as an assumption, and let the expert correct it on
the call.

---

## 4. Things they learned that we already do

Recorded so we do not relitigate them:

- Graceful degradation with no key and no database — matches our `hasDatabase()`
  / `hasAnthropic()` pattern.
- Supabase needs RLS **and** a policy or reads silently fail — our migrations
  carry `ENABLE`/`FORCE ROW LEVEL SECURITY` plus `REVOKE ALL`.
- Env changes need a redeploy on Vercel.
- Build after every change to catch what tests do not.
- **Calibrate against real artifacts.** Their engine became trustworthy only
  after reverse-engineering rates from 940 real quotes and validating totals to
  the rupee against four real PDFs. This is the strongest argument in the whole
  document for getting Hauspire's and Urbanline's real rate cards in before
  anything else — theory did not catch the edge cases, real quotes did.

---

## Suggested order

1. **Floor-plan OCR, client-side, with a confirm step.** Biggest accuracy gain
   available, free, and it collapses our two largest variance terms.
2. **Payment schedule on the quote.** A day's work and the most on-thesis item
   here.
3. **Per-line spec text.** Makes the compare screen worth visiting.
4. **The 3D view.** Highest delight, highest effort, and the best thing to put
   in front of a spouse.
5. **Revision history screen.** Schema already exists.
6. **AI parsing rules into `portfolio-agent.ts`.** An hour, and it prevents a
   class of outage we have already had once.
