# What the earlier One Interiors prototype got right

Written 10 September 2026, from a frame-by-frame read of the two prototype
walkthroughs — the desktop "One Interiors Website" build and the mobile
"clickable prototype · V3".

Companion to `FIRST-MODEL-LESSONS.md`, which covers the Hauspire quotation
engine. **These are two different first models**, and the interesting thing is
that the prototype had already wired the quotation engine into a marketplace —
which is the thing we are building now.

The prototype's own note says it was built from a screen-by-screen review of
**Decorilla and Havenly**, taking three patterns: one decision per screen, a
named style reveal, and *hero match then alternates*. That third one is the
biggest single thing we are missing.

---

## 1. Match reasoning as a sentence, not a score

The prototype shows this, in prose, next to a 99% ring:

> **99% match** — because you leaned toward **Warm Minimalist**, and they're
> tagged for it; your budget fits their **premium** rate card; they're active in
> **Baner**; their track record matches a **focused room** project.

We show a score ring and "6 OF 6 FACTORS". That is honest but it is not
*readable* — a customer cannot tell what the six factors were or why this studio
beat the next one. The prototype's own subtitle names the ambition: *"Matched
from your quiz — reasoning shown, not just a score."*

This is the highest-value thing in either video and it is a small build. We
already compute every input the sentence needs; `rankStudios` knows which
factors fired. Rendering four clauses instead of a number costs a day and it is
the difference between a customer trusting the order and scrolling past it.

**Do not copy the 99% precision.** A percentage to the unit implies an accuracy
we cannot defend, and we already made the better choice by showing how many
factors were actually measured. Keep our honesty, take their prose.

## 2. One hero match, then alternates

The prototype gives the top studio a full-width card — name, tier, the reasoning
sentence, the ring, and a single **View their profile** button — and only then
lists the rest under *"OTHER DESIGNERS WE HANDPICKED FOR YOU · 5 shown"*.

Our `/match` renders nine equal cards in a grid. Nine equivalent options is a
choice architecture problem: it invites comparison shopping on the one axis that
is easiest to compare, which is price, and price is exactly the axis we spend
the whole product arguing against.

If our matching is good enough to rank, it is good enough to lead with one.

## 3. The instant quotation lives on the studio's profile

This is the synthesis I did not expect to find already built. On each designer's
page, a sidebar:

> **Instant quotation** — Built from your 2 BHK configuration on their
> **basic-tier** rate card.

Then room-grouped lines — Kitchen: Base Cabinets ₹50,053, Wall Cabinets ₹40,042,
Loft ₹32,049 — each tagged `MO-01` or `NM-01`, then the totals block.

The same 2 BHK against a premium studio comes out at ₹4,75,303 instead of
₹2,94,687. **Same brief, same line items, different rate card, and you can see
exactly where the difference sits.** That is our entire proposition rendered in
one screen, and it is better placed than ours: the quote is attached to the
studio it belongs to, rather than living on a separate `/quotes` page that lists
four studios at once.

Worth considering as a change to our information architecture, not just a
feature.

## 4. The totals block shows the modular split to the customer

```
Modular (MO-01)          ₹2,30,164
Non-modular (NM-01)      ₹1,28,407
Professional fee (7%)      ₹25,100
Modular discount (15%)    −₹34,525
Total project value      ₹3,49,146
```

Five lines, and every one of them is a question a customer would otherwise ask.
It also makes the 15%-on-modular-only rule visible rather than buried — see
`FIRST-MODEL-LESSONS.md` §10 for why that rule matters.

Ours shows a line-item table and a GST line. Adding the split costs nothing and
explains the number.

## 5. The verification panel names each check in plain language

> **✓ VERIFIED BY ONE INTERIORS**
> - **Identity** — Aadhaar / PAN confirmed
> - **Criminal record** — Police verification cleared, local station
> - **Address** — Studio address field-confirmed
> - **Business** — GST registration checked
> - **Track record** — 3+ past projects confirmed with clients
> - **Portfolio** — One project site- or video-verified

Ours renders a tier badge and a count. Theirs tells you what was actually done,
in words a customer understands, and **"Police verification cleared, local
station" is the single most trust-building line in either video** — it speaks
directly to the fear the landing page now names.

Two cautions. Every one of those claims has to be true for every studio showing
the panel, or it is worse than not having it. And we should decide whether we
are actually doing police verification before we write it on a page — it is a
real operational commitment, not a copy change.

## 6. Budget and tier are one question, not two

Three options, each labelled with the tier it implies:

| Under ₹5L | ₹5L – ₹15L | ₹15L+ |
| --- | --- | --- |
| basic | premium | luxury |

We ask for a budget in the quiz and then send the customer to a whole separate
`/tier` screen to pick a band. The prototype collapses both into one tap, and it
is right to: the customer is answering the same question twice.

Our `/tier` screen earns its place *only* because it shows real ranges for their
own carpet area, which the prototype cannot do. But that is an argument for
merging them — show the three bands with the customer's own numbers **inside the
budget question** — not for keeping two steps.

That would take our flow from nine questions plus a tier screen to something
much closer to their **six taps**.

## 7. Rooms as a multi-select, and budget scoped to it

*"Which rooms need work? Pick as many as apply."* — Kitchen, Living Room, Master
Bedroom, Kids Bedroom, Full Home, Bathroom, with a live `0 rooms selected`
counter. The budget question then reads *"Per the rooms you picked"*.

Our scope question is one coarse choice (Full home / Kitchen & wardrobes / One
room / Renovation). Room-level selection is better data for matching, better
input for the quote engine, and it makes the budget question mean something
specific rather than "what is your budget, in general".

## 8. Style as A/B pairs, not a grid

*"Which feels more like you? Tap the one you'd actually want to live in."* Two
large images, three rounds, dot progress.

We show a grid of six-plus room images and ask for two or three picks. Binary
choice is materially lower effort — no comparison across six, no counting, no
wondering if you have picked enough — and three rounds gets us a ranked
preference rather than an unordered set.

Their framing is also better: *"the one you'd actually want to live in"* is a
question about their life, not about design vocabulary.

## 9. The name is asked last, and it is one field

*"Almost there. What should we call you?"* — first name only, no phone, no
email, at the very end.

Worth noting against our new OTP screen. We now ask for name **and** phone
**and** a code before the quotes. That is the right trade — we need an account
for the quotes to persist and be shareable — but the prototype is a reminder
that every field before the payoff costs completion, and that a first name alone
is enough to personalise everything before the gate.

## 10. "An expert will call you — within 2 hours"

The confirmation screen:

> **An expert will call you.** Within 2 hours, briefed on your shortlist — not a
> cold intro.
>
> **Call brief:** [name] · 2 BHK in Baner · comparing Design Nest and The Grid
> Studio · budget tier: premium

Two things we should take. **A stated time** — "within 2 hours" is a promise you
can keep or fail, and either is better than "we will call you". And **showing the
brief back to the customer**, which is the proof that "not a cold intro" is
true rather than a claim. It costs one paragraph and it is the difference
between our expert call sounding like a sales callback and sounding like a
prepared consultation.

## 11. A persistent shortlist with a count

**Add to compare** on each profile, and a bottom tab bar carrying a badge — `2`
— so the shortlist is always visible and always one tap away.

We have no shortlist. `/compare` just re-prices the top four matches. Letting a
customer *choose* who to compare is both better UX and better signal: which
studios someone shortlisted and then dropped is the most useful training data
the matching engine could get.

## 12. Marketplace filters

A left rail: **Tier** (all / basic / premium / luxury), **Locality** (Koregaon
Park, Baner, Kothrud, Viman Nagar), **Style** (Warm Minimalist, Modern Classic,
Industrial Loft, Traditional Indian).

`/studios` has none. Once there are more than a handful of studios, browsing
without filters stops working.

---

## What not to take

**The ratings.** `★ 4.3 (34)`, `★ 4.7 (82)`. We have zero completed projects and
inventing review counts would destroy the only asset we have. Our delivery
variance and dispute figures are the honest substitute and they are better.

**The dark palette.** It is handsome, and we moved to warm light deliberately —
see the theme decision in `globals.css`. Not a mistake to revisit.

**The name-substitution bug, which is worth studying.** Three screens read
*"Matching **there** to Pune's verified designers"*, *"**there**, meet your
match"*, and *"Call brief: **there** · comparing **Design** and **The**"* — the
placeholder never got replaced, and the studio names were truncated to their
first words. A personalisation feature that misfires is worse than no
personalisation: it is the most visible possible signal that nobody checked. If
we interpolate a name anywhere, the fallback has to read correctly on its own.

---

## Suggested order

1. **Match reasoning sentence** (§1) — largest gain, smallest build, everything
   it needs is already computed.
2. **Hero match then alternates** (§2) — a layout change to `/match`.
3. **Merge budget and tier into one step** (§6) and **rooms multi-select**
   (§7) — together these shorten the funnel and improve the quote inputs.
4. **Verification panel in plain language** (§5) — after deciding what we
   genuinely check.
5. **Call brief and a stated callback time** (§10) — one paragraph on `/expert`.
6. **Shortlist with a count** (§11), then **filters** (§12).

Items 1 and 2 are both `/match` and should ship together.
