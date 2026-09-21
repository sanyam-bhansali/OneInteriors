# Studio onboarding — flows worth stealing

Source: DesignerUp's study of 200+ onboarding flows, read in full. Dribbble
and Mobbin are JavaScript-rendered galleries behind sign-in and could not be
read, so nothing here is claimed from them.

---

## The diagnosis, before any of the ideas

That article opens by separating two things we have merged:

> *"It's not the login screen (Authentication) or even the fields where you
> enter your account information (Account Setup)."*

By that definition **we do not have an onboarding flow.** We have forty
minutes of account setup wearing a progress bar. Five steps, all of them data
collection, and at the end of it the studio has seen nothing they wanted.

Worse is the timing. A studio's first real win — an introduction, a customer
who asked for them — is roughly **two weeks away**, behind fifteen
verification checks. So the sequence we currently offer is:

> forty minutes of typing → two weeks of silence → maybe something good

That is the thing to fix. Not the field layout.

**The one number that matters:** how long from "I was approved" to "I have
seen something that makes me glad I did this." Today it is two weeks. Every
idea below is judged on whether it shortens that.

---

## 1 · Show demand before asking for anything

**Steal from:** Notion's self-identification, and the article's core rule —
get to the first win fast.

Before the form, one screen:

> **Three briefs from Baner and Balewadi this month.**
>
> 2 BHK · 890 sq ft · ₹12–15 L · full home, kitchen first
> 3 BHK · 1,240 sq ft · ₹18–22 L · renovation
> 2 BHK · 910 sq ft · ₹9–12 L · kitchen and wardrobes
>
> *You would have matched all three. They went to studios who had finished
> setting up.*

We have this data. It costs one query and it converts the next forty minutes
from a chore into the thing standing between them and those briefs.

**This is the highest-leverage change in this document.** Everything else is
refinement.

> ⚠️ Only real numbers. If there were no matching briefs last month, say so.
> A studio who finishes setup and finds nothing waiting will remember the
> screen that promised three.

---

## 2 · Ask which kind of practice they are

**Steal from:** Notion — "team / personal / school" before anything else.

One question, first screen:

- **Just me** — a solo practice
- **A small team** — two to eight people
- **An established firm** — nine or more

It changes three things:

**What "three completed projects" means.** A solo practice two years in has
different proof than a twelve-person firm. Same bar, different evidence.

**Which fields we even show.** Team size and GSTIN matter differently.

**Whether we should have approved them at all** — which the article names
directly: *"you also need to understand who your product is NOT for."*

---

## 3 · Put the rate card first, and say what it unlocks

**Steal from:** Acorns — the bank link is non-negotiable, so it comes early,
with an explanation of why and a reassurance about safety.

Our equivalent is the rate card. Without it, **no quote can be generated, so
the studio cannot be matched to anybody.** It is currently step four of five.

Move it up, and say plainly what it does:

> **Your rates. This is the one that turns demand into quotes.**
>
> Every quote a customer sees is generated from these numbers in about three
> seconds — no one rings you, and you are not asked to price anything by hand.
>
> Private. No customer and no other studio ever sees this table. It is the
> input to a number, not a number anyone reads.

Acorns also pairs the hard step with reassurance. Ours writes itself, because
the privacy claim is true.

---

## 4 · Let them see the software working before it is theirs

**Steal from:** Stripe's test mode — the product works fully with sample data
before anything real exists.

We have started this: the sample lead on an empty client board, marked and
excluded from every count. Extend the same idea:

- **A sample quotation**, fully priced, so they see the PDF with their logo
  on it before they have entered a single product
- **A sample introduction**, the artifact from the apply page, sitting in
  their inbox view

Both clearly marked, both removable, neither counted. The studio learns the
software by reading rather than by being told.

---

## 5 · Replace the wizard with a board of five cards

**Steal from:** the article's "no escape room" — flexibility over a forced
march.

**The code already supports this.** Step state is derived from the data —
`portfolioCount`, `missingRates`, `gstin`, `submittedForReview` — not from a
step pointer. Nothing enforces the order. We present a linear wizard over a
system that never needed one.

So show five cards, each with:

- what it is
- **how long it takes** — *"about 6 minutes"*, not "forty minutes" for the lot
- what it unlocks
- done / not done

A studio with twenty minutes on a Tuesday can do the two that fit. A studio
who cannot find their GSTIN can do everything else and come back.

> The current welcome email already promises *"it saves as you go, so you can
> stop and come back."* The board makes that visible instead of asking them to
> take our word for it.

---

## 6 · Do it with them, on a call

**Steal from:** Superhuman — one-to-one onboarding, by a person, for every
early user.

We are onboarding **ten studios, not ten thousand.** A twenty-minute call
where we fill the profile together converts better than any form, and it is
entirely affordable at this scale.

It also does something a form cannot: we learn where studios get stuck, in
their words, while there is still time to change the product.

The form stays for whoever prefers it. But for studio one through ten, the
call *is* the onboarding, and the software is what they use afterwards.

---

## 7 · Say who this is not for — before they invest forty minutes

**Steal from:** the article's Step 1, and VSCO's failure mode — a paywall
discovered after commitment rather than before it.

We have the same failure in a different costume. **The portfolio step demands
three completed projects with no escape hatch**, unlike GSTIN which has one.
So a young practice applies, is approved, invests half an hour, and stops dead
at step three.

Two honest options, and we should pick one rather than leave it:

**Say it on the apply page.** Already drafted — the third bullet of the
honest filter. Costs nothing, loses some good young studios.

**Give the step an escape hatch.** "In progress" or "not on the platform yet",
recorded as what it is, reviewed by ops. About an hour of work, and it keeps
practices who will be excellent in two years.

---

## What I would do first, in order

1. **The demand screen (§1).** One query, one screen, changes the frame of
   everything after it.
2. **Decide the portfolio gate (§7).** It is a dead end today whichever way we
   go; leaving it undecided is the only wrong answer.
3. **The five-card board (§5).** The code already works this way.
4. **Rate card first (§3).** A reorder and a paragraph of copy.
5. **Onboarding calls (§6).** No code at all — just do it for studio one.

Numbers 2, 4 and 5 need no engineering worth the name. Number 1 is a day.

---

## What not to take from the article

It is written for consumer mobile apps, and two of its lessons do not
transfer.

**"Emotional engagement — micro-rewards, confetti, dopamine."** Our user is a
business owner deciding whether we are worth their Tuesday. Confetti reads as
unserious. Their dopamine is a real brief from Baner, which is §1.

**"Reduce steps at all costs."** Some of our steps are load-bearing —
verification is the product, not friction to be minimised. The fix is not
fewer checks; it is making the studio understand that the checks are *why a
customer accepts their quote without haggling.*
