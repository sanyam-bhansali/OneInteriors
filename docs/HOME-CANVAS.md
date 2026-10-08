# The Home Canvas

8 October 2026. A step past the fifty-app plan (`UX-PRINCIPLES-PLAN.md`).
That plan makes our current journey the best version of itself. This one asks
whether the journey itself is the right shape.

## The honest verdict on where we are

What we have is the best-built version of the category's standard shape:

```
questions (12 screens) → a list of studios → a document per studio → a comparison page → a call
```

Livspace, HomeLane, Houzz and Thumbtack all follow it. We do it more honestly
and more beautifully, but the customer still does the work the old way:
answering questions about a home we never show them, reading 20-line
documents, and holding three PDFs in their head.

Five assumptions are holding us back:

1. **The brief is a questionnaire.** People don't think in answers. They
   think in rooms: "the kitchen should be white, the master needs more
   storage." The best apps let people touch the thing itself (IKEA Kreativ,
   Apple's configurator).
2. **The quote is a document.** It can be read but not changed. Change one
   thing and you must start the brief again. Wise, Lemonade and Apple all
   reprice live as you choose.
3. **Comparison is a separate page.** In reality every decision is a
   comparison: "if I pick acrylic here, who is cheapest now?"
4. **Uncertainty is a footnote.** "±16%" sits in small text. It is the
   customer's biggest fear, and it should be something they can watch shrink.
5. **One person decides.** Interiors are a household decision, yet every
   screen assumes a single user.

## The leap: one live surface

**Their own flat, drawn from their floor plan, is the interface.** Every room
is tappable. Every choice they make re-prices every matched studio at once,
line by line. The uncertainty band visibly narrows as they tell us more, and
their family can open the same live home and weigh in.

No interiors product does this. As far as we know, no big-ticket marketplace
of any kind does. What makes it possible for us is something we already own:
**the quote engine is pure and runs in the browser in milliseconds**
(`buildFirstQuote`). We can price ten studios on every tap. Everyone else's
quote is a document a person writes; ours is a calculation.

### The six pillars, and what we already have for each

| Pillar | What the customer feels | Assets we already own |
|---|---|---|
| **1. Your home is the interface** | "That's my flat." The brief is built by tapping rooms, not by answering screens. | Floor-plan reader, society plan library, `HomeSketch`, `QuotePlan`, `Flat3D` |
| **2. Live, multi-studio pricing** | Every change moves every studio's price instantly, with "+₹X" on each option. | `buildFirstQuote` (pure, instant), `rankStudios` (pure), scope checklist |
| **3. Taste without words** | Swipe styles, then watch the flat repaint in them. | Swipe picker, style DNA, `Flat3D` palettes |
| **4. A truth layer on every number** | Tap any figure to see where it came from. The confidence band shrinks as they add a plan or measure the kitchen. | `assumptions`, `variancePct`, measure-kitchen tightening, figure checker |
| **5. Household mode** | Send the live home to a spouse or parents. Each can react room by room, and the disagreements show. | Share links (`createShareLinkAction`), style DNA share |
| **6. One continuous object** | The same canvas becomes the architect call's agenda, then the project tracker, with site photos pinned to rooms and payments tied to stages. | Expert booking, tracker, site photos, payment phases |

The point of pillar 6: the customer never "moves to the next page." The home they
start shaping in minute one is the home they track in month four.

### What makes it more than a pretty configurator

- **Honesty is built into the structure.** The band narrows only when we
  actually know more (a plan read, a kitchen measured, a site visit). It
  never narrows because of an animation.
- **Comparison stops being a destination.** Every room shows the cheapest and
  the best-specified studio for this choice, live.
- **The architect works on the same object.** The call opens on the
  customer's own canvas, with their reactions and their family's disagreements
  already marked.

## What is hard, said plainly

1. **Material options need rates per option.** Today a studio files one rate
   per item (`FiledRate`: one `ratePaise` per code). Live "laminate → acrylic →
   veneer" pricing needs a rate per finish grade per item. Those come from the
   50–60 quotations per studio we already plan to analyse (the studio approval
   rule), but the extraction has to capture the grade. **Until then, live
   pricing works for what we can already price:** rooms, items in and out,
   sizes, kitchen run, scope.
2. **Showing "+₹X" per option.** This reveals each studio's relative price
   for that option without showing its rate. That is a policy question for the
   owner, given the rule that per-sq-ft rates are never shown.
3. **Floor plans for everyone.** The canvas is at its best with the real
   plan. Today we have the reader and the society library; without a plan we
   fall back to the typical layout and say so (the existing
   "a schematic, not your floor plan").
4. **Real rate cards.** Live comparison is only as true as the rates behind
   it. Pre-launch archive rates make every studio move together, which is the
   compare-page problem the review found, only louder.
5. **Performance on mid-range Android phones.** Ten studios repriced on
   every tap is cheap (pure arithmetic). The 3D view is not, so the canvas is
   2D-first, with 3D as an optional view.

## Build sequence

1. **Canvas v0: the quote becomes editable.** On the quote page, tap a room →
   toggle items in or out, and change the kitchen run. The total, and every
   matched studio's total, update live. This needs no new data. It proves
   pillar 2 on what we already price.
2. **Canvas v1: the brief happens on the home.** After BHK and society, draw
   the flat and let rooms be tapped to set scope. The question screens shrink to
   the few that aren't about rooms: budget level, household, involvement,
   priorities.
3. **Truth layer.** Every figure is tappable for its source. A visible
   confidence band shows what would narrow it ("upload your plan: ±16% →
   ±12%").
4. **Household mode.** A live share link, reactions per room, and
   disagreements surfaced for the architect.
5. **Finish grades.** Once the archive extraction captures grade, options
   per item are priced live, subject to the owner's decision on showing
   per-option differences.
6. **Canvas as tracker.** After signing, the same plan carries stages, site
   photos pinned to rooms, payment phases and change approvals.

Steps 1–4 need no new data and no policy decisions. Step 5 needs the rate
model and an owner decision. Step 6 needs the studio side to post updates
against rooms.
