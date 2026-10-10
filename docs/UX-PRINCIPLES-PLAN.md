# Applying the fifty-app research to One Interiors

8 October 2026. The research is the "Fifty-App Teardown" (published as a
private artifact for the owner). This turns its ten principles into changes to
our own screens, in the order they are being built. Each change names the
principle, the app it comes from, and the file it lands in.

Two constraints from earlier decisions shape it:

- **Per-sq-ft studio rates are never shown to customers** (owner, 30 Sep). So
  "show the maths" means the quote's structure and where each figure came from,
  not the studio's rate.
- **The price bands vs real quotes question is the owner's call.** Until it is
  settled, the product must at least never misdescribe where a quote sits.

## The ten principles, against what we have

| # | Principle | Where we stand | Change |
|---|---|---|---|
| 1 | Value before asking | Live price on the home page; matches before sign-in | Keep. Ask for the number once (below) |
| 2 | One decision per screen | Brief does this | Keep |
| 3 | Answers visibly change the result | Sidebar shows the brief, not what it costs | Running estimate in the brief |
| 4 | Recognise, don't describe | Swipe style picker, style DNA | Keep |
| 5 | Show the maths first | Totals block exists; no clear next step | Quote as a labelled sum; sticky total and next step |
| 6 | Turn uncertainty into something visible | Tracker stages exist | Payment phases on "Your home" |
| 7 | Badges with public rules | 15 checks, but only as wings on wide screens | Checks opened from the card on every screen size |
| 8 | Show real work only | "Built in 12.1 seconds" times an animation | Honest building screen, once per studio |
| 9 | Personal and shareable | Style DNA share, compare share link | Expert confirmation as something to keep |
| 10 | Calm and honest | Mostly | "Below your range" said as below; no repeated claims |

## Build order

### Batch 1: trust fixes
1. **Say "below your range" when it is below.** `modules/matching/signals.ts`
   budgetPosition. (Principle 10; Wise.)
2. **One reason, said once.** The budget sentence appeared three times per
   card. `modules/matching/score.ts`. (Principle 10.)
3. **An honest building screen.** Drop the stopwatch that timed the
   animation, and add "Skip to the quote". It already plays once a visit
   (`seenBuild`). `components/oi/Building.tsx`. (Principle 8; Perplexity.)

**Status, 8 Oct:** batches 1–4 are built, with tests in
`tests/ux-principles.test.ts`, and the screens were checked at phone size.
Three of them only show with a database: the sign-in prefill, the expert
confirmation and the payment schedule. They are typechecked and not yet seen
on screen.
4. **Ask for the number once.** Sign-in is prefilled from the brief's contact.
   `modules/brief/repository.ts`, `app/sign-in`. (Principle 1; Duolingo,
   Calendly.)

### Batch 2: the quote
5. **A sticky total with the next step** on the quote and on compare: the total,
   and "Book your free architect call". The quote's closing block becomes a real
   link. (Principle 5; Airbnb.)
6. **The total as a labelled sum.** The totals block reads as an equation, and
   "What this quote includes / does not include" lists the lines left out.
   (Principle 5; Wise, Urban Company.)

### Batch 3: the brief and the call
7. **A running estimate in the brief**: the range for their home, scope and
   level, updating as they answer. `app/quiz/QuizClient.tsx` LiveProfile.
   (Principle 3; Lemonade, Apple.)
8. **An expert confirmation worth keeping**: the architect named, the agenda
   built from the questions they ticked, and "Add to calendar".
   `app/expert/ExpertForm.tsx`. (Principle 9; Calendly, Superhuman.)

### Batch 4: after the brief
9. **Checks on every screen size**: a "15 of 15 checks" chip on the card that
   opens the list. `app/match/StudioCard.tsx`. (Principle 7; Airbnb, Thumbtack.)
10. **Payment phases on "Your home"**: paid, next, remaining for the studio
    they chose. `modules/portal/tracker-store.ts`, `app/account/page.tsx`.
    (Principle 6; Klarna, Wise.)

### Later, needing more than a screen change
- **AI summary sentences linked to the quote lines they cite** (Perplexity):
  needs the figure checker to keep value→line sources.
- **Inspiration photos attributed to studios** (Houzz): needs studios' own
  project photos.
- **Change approvals with photo and price difference** (Instacart): needs the
  studio side to post variations.
- **Bands vs real quotes**: owner's decision.
