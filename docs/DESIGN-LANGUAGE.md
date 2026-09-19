# The design language

What `/match` is made of, written down so the next screen does not have to be
reverse-engineered from it.

This is not a style guide in the usual sense. The palette and the typography
are already locked elsewhere and are not restated here. What follows is the
layer above that: the *reasons* a screen in this product looks and moves the
way it does, and the specific mechanisms that carry those reasons.

Read §1 before building anything. The rest is reference.

---

## 1. The ideology

### 1.1 Every effect is evidence, or it is cut

This product's entire commercial argument is that our numbers are checkable
and everyone else's are not. A screen that decorates itself undermines that
argument faster than any copy can repair it.

So the test for any visual device is: **does it make a fact easier to believe,
or easier to find?** If it does neither, it does not ship, however good it
looks.

Worked examples from `/match`:

| Device | The fact it serves |
| --- | --- |
| Score counts up from zero | The number was computed, not stored |
| Card zooms as you reach it | This is the one you are reading |
| Wings slide out from behind the card | This work belongs to *this* studio |
| Ticks arrive one at a time | These were checked individually, not as a badge |
| "6 of 6 factors" beside the score | The score's own basis, visible |
| "+7 more on their profile" | Eight ticks are not the whole file |

The last two are not effects at all. They are the same instinct in text, and
they are load-bearing in exactly the same way.

### 1.2 A missing value renders as missing

Never as a flattering default, never as a blank that reads as zero.

```tsx
value={studio.avgVarianceDays === null ? '—' : `+${studio.avgVarianceDays}`}
label={studio.avgVarianceDays === null ? 'Days over — unmeasured' : 'Days over promise'}
```

The label changes too, not just the value. "—" under "Days over promise"
reads as "zero days over", which is a lie we would be telling by omission.

Same rule in `ProjectWings`: the photograph slot says **"Photo to come"**
rather than showing a grey rectangle, because a grey rectangle reads as a
loading failure and a labelled plate reads as a deliberate state.

And in `studioProof`: a `PENDING` check produces no tick **and** is not
counted in the "+N more" figure. A pending check is not a soft yes.

### 1.3 State the limit of the claim, on the same screen

Eight ticks beside a card will be read as "eight checks exist" unless
something says otherwise. So something says otherwise, right there, in the
same visual group — not on hover, not on the profile.

This is the most frequently skipped rule and the one that costs the most when
skipped. Any time a screen shows a *subset*, the subset must announce itself.

### 1.4 The order of information is the argument

Reading outward from a match card: **their work → what we checked about them.**
That is the argument the company makes, laid out in space.

The ticks were stacked *under* the plates in the first version. It looked
fine. It was wrong — it made the checks read as a footnote to the
photographs, when they are a statement about the studio. Position carries
meaning; decide what the layout is claiming before deciding whether it is
balanced.

### 1.5 Compute, don't taste

Every contrast figure, every width, every character limit in `/match` was
calculated and is written into the comment beside it. Several "obviously
fine" choices failed:

- Faded cards at 0.62 opacity → secondary text at **2.63:1**. Fixed at 0.82.
- CTA gradient top stop `#c76a44` → **3.77:1** with white. Fixed at `#b05634`.
- Sage tick on Apple glass → **3.11:1**. Replaced with `#17794A` at 5.02:1.
- The tick column at 1400px → overran by exactly 0px of slack. Gated at 1440.

None of these looked broken. That is the point: this is not a thing taste
catches.

---

## 2. Motion

### 2.1 The three motions, and nothing else

| Name | What it is | Where |
| --- | --- | --- |
| **Rise** | opacity 0→1, y +14→0, staggered by index | Page entrances |
| **Drawer** | slides out from behind its parent and back in | Wings, ticks |
| **Count** | a figure tweening to its real value | Scores, totals |

A new screen composes these. It does not invent a fourth without a reason
that fits §1.1.

### 2.2 The ease is always the same

```ts
ease: [0.16, 1, 0.3, 1]   // entrances, reveals — decelerating, no overshoot
ease: [0.2, 0.85, 0.25, 1] // drawers sliding out
ease: [0.4, 0, 0.2, 1]     // drawers closing (faster in)
```

Nothing bouncy, anywhere. From `CountUp`:

> Decelerating, and nothing bouncier: this is a count, not a toy, and an
> overshoot would briefly show a number that is not true.

That reasoning generalises. An overshoot on a money figure, a progress bar or
a match score momentarily displays a false value.

### 2.3 Stagger is ~60ms, capped

```tsx
delay: Math.min(rank, 5) * 0.06
```

The cap matters. Uncapped, the ninth card waits 540ms and the list feels
broken rather than choreographed.

Within a group (the ticks) the step is 90ms opening, 40ms closing.

### 2.4 Out and back run in the same order

A drawer closes the way it opened — plates first, ticks after — not in
reverse. Reversed, it reads as a rewind; in the same order, it reads as a
drawer shutting.

This costs something real in CSS: the delays must be declared in **both** the
closed and the open state, because the closed-state declaration is what
governs the closing transition.

```css
.q-proof                       { transition-delay: calc(var(--i) * 0.04s); }        /* closing */
.q-wings[data-open='yes'] .q-proof { transition-delay: calc(0.26s + var(--i) * 0.09s); } /* opening */
```

Closing is deliberately quicker than opening. A drawer that takes as long to
shut as it did to open feels stuck.

### 2.5 Two rules must never both set `transform`

The single sharpest trap in this codebase, and it has bitten twice.

**Framer Motion writes `transform` as an inline style, which beats every class
rule.** A card with a Framer entrance animation *and* a CSS hover zoom will
silently never zoom.

Two fixes, both in use:

1. **Split the elements.** `<motion.li>` owns the entrance; the `.q-glass`
   div inside it owns the scroll-zoom and hover-lift. `StudioCard` does this,
   and the comment there says so in capitals.
2. **Compose through custom properties.** When two CSS rules both need to
   move one element:

```css
.q-glass {
  --q-scale: 1;
  --q-lift: 0px;
  transform: scale(var(--q-scale)) translateY(var(--q-lift));
}
.q-glass:hover            { --q-lift: -4px; --q-scale: 1.035; }
.q-glass[data-focus='far'] { --q-scale: 0.97; }
```

Each rule sets its own property. Neither clobbers the other.

### 2.6 Reduced motion gets the content, immediately

Not a shorter animation — no animation, and nothing hidden behind a gesture
that will never be detected.

- `useScrollFocus` marks **every** card `near` and `open`.
- `CountUp` paints the final value on the first frame.
- Framer components pass `initial={reduced ? false : {...}}`.
- The CSS block zeroes transitions, delays, opacity and transform.

**Specificity trap:** the reduced-motion override must repeat the open-state
selectors *in full*. A bare `.q-proof` (0,1,0) loses to
`.q-wings[data-open='yes'] .q-proof` (0,3,0), and the delays survive into a
build that claims to honour the preference. `:where()` makes this worse, not
better — it zeroes the specificity you need.

Verify it rather than trusting it. The specificity of two selectors is
countable in a few lines of node.

---

## 3. Surfaces

### 3.1 Two grades of glass, and they are not interchangeable

**Card glass** (`.q-glass`) — a warm sheet that holds text:

```css
background: rgba(252, 252, 250, 0.72);
backdrop-filter: blur(18px) saturate(1.08);
border: 1px solid rgba(219, 213, 203, 0.9);
box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 18px 40px -28px rgba(44,38,36,.45);
```

**Apple glass** (`.q-proof`) — a small object that floats:

```css
background: linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.52));
backdrop-filter: blur(22px) saturate(180%);
border: 1px solid rgba(255,255,255,.72);
box-shadow: 0 8px 26px -14px rgba(44,38,36,.3), inset 0 1px 0 rgba(255,255,255,.85);
```

The differences are the whole thing. The `saturate(180%)` is what makes
colour come through from behind instead of grey — remove it and it reads as
frosted plastic instantly. The bright white top border plus the inner
highlight is the light-catching edge. And it is a **gradient**, not a flat
fill, because real glass is lit from one side.

Use card glass for anything containing a paragraph. Use Apple glass for
pills, chips and badges.

### 3.2 The alpha floor is a contrast constraint, not taste

`.q-glass` sits at 0.72 and may not go lower:

> Every text contrast on this card is computed against the COMPOSITE of this
> fill over Raw Silk, and a thinner sheet makes that composite depend on
> whatever scrolls behind it, which is unmeasurable and therefore unshippable.

If you want a more transparent surface, it may not carry body text.

### 3.3 Squared everywhere, curved on glass

From the locked spec. Glass is the one surface allowed corners: 22px on
cards, 16px on inner blocks, 999px on pills.

---

## 4. Contrast

### 4.1 Compute against the composite, never the token

The background of text on a translucent card is *not* `--card`. It is
`--card` at its alpha over `--bg`. Blend first, then measure.

```python
def over(fg, a, bg):   # the only line that makes the numbers real
    return tuple(round(f*a + b*(1-a)) for f, b in zip(fg, bg))
```

### 4.2 The thresholds

| Kind | Ratio |
| --- | --- |
| Body text | 4.5:1 |
| Large text (≥18.66px bold / ≥24px) | 3:1 |
| Icons, strokes, borders that carry meaning | 3:1 (WCAG 1.4.11) |
| Touch targets | 44px (WCAG 2.5.5) |

### 4.3 The derived ink tokens exist for this

`--acc` and `--sec` are the locked brand colours and stay so for fills,
rules, dots and rings. When the accent must be **ink** — text, or a stroke
that carries meaning — use the derived variants:

| Token | Value | For |
| --- | --- | --- |
| `--acc-ink` | `#964c2f` | terracotta as text |
| `--sec-ink` | `#616b55` | sage as text |
| `--acc-btn` | `#b85d3a` | white-on-terracotta button fill |
| `--ok-ink` | `#17794A` | the verification tick, and only that |

`--ok-ink` is the one genuine departure from the locked palette, and the
reasoning is recorded at its declaration: Muted Sage at 15px on Apple glass
is 3.1:1 and reads as grey-olive, and a tick that does not read as green is
not doing its job.

### 4.4 Colour is never the only signal

~8% of men cannot separate red from green. Every semantic colour is paired
with a shape — the tick is a check mark, not a green dot.

### 4.5 A faded card must recover on engagement

Depth-of-field is decoration; readability is not.

```css
.q-glass[data-focus='far']:hover,
.q-glass[data-focus='far']:focus-within { opacity: 1; filter: none; }
```

> A card you cannot read is a bug, not an effect.

---

## 5. The degrade ladder

Every device answers all four before it ships.

### 5.1 Reduced motion → §2.6.

### 5.2 Narrow screens: not rendered, never squeezed

Anything living in the margin beside the content column is `display: none`
below its threshold, and the threshold is **arithmetic**:

```
card 640 + 2 × (16 + 192)           = 1056  → plates gate at 1280
card 640 + 2 × (16 + 192 + 12 + 160) = 1400  → ticks gate at 1440
```

Write the sum in the comment. A round number nobody can reconstruct gets
changed by the next person and quietly produces a horizontal scrollbar.

The cost of hiding must be zero: the same content is one press away at every
width ("Their work", the studio profile). **If hiding it loses information,
it was never a margin element.**

### 5.3 No data: the element does not render

`ProjectWings` returns `null` with no projects *and* no passed checks. Empty
frames beside a card look like a failure; nothing looks like a card.

### 5.4 No JavaScript / no observer

`useScrollFocus` sets everything visible when `IntersectionObserver` is
missing. Note the asymmetry, which is deliberate:

- `focus` starts `near` — content must be readable before any observer runs.
- `open` starts `false` — otherwise every card flashes its wings open at first
  paint and snaps shut a frame later.

---

## 6. Copy

### 6.1 Three faces, three jobs

Serif for names and headlines. Sans for body and UI. **Mono for evidence** —
labels, money, quantities, specs, scores, counters, dates. Never mono for
body copy.

The rule is doing work: mono signals "this is a measured value" everywhere in
the product, so a figure in mono is making a claim the company will stand
behind.

### 6.2 Order by what it buys the reader, not by our process

`studioProof`'s `WEIGHT` is close to the reverse of our own verification
order:

> Our own funnel starts at PAN and Aadhaar because that is where a file
> begins. A homeowner does not care that we matched a PAN — they care that
> somebody from our team walked through a house this studio finished.

Any list ordered by internal convenience is worth re-sorting by reader value.

### 6.3 No disabled buttons

From `CompareBar`:

> A greyed-out button is a puzzle: it says "no" without saying why.

Below the minimum, state what is missing in words and render no button.

### 6.4 Short forms are measured, and the limit is tested

Chip text is capped at 18 characters — 160px box, minus 46px for the tick and
padding, at ~6.3px per character in 10.5px mono. `tests/proof.test.ts` holds
it, because a 19th character does not wrap, it silently ellipsises, and a
truncated claim is worse than a shorter one.

### 6.5 Cards, not paragraphs

The material glossary was rewritten from prose to cards — 350 words to 87 per
screen — after the note that *"this is too text heavy, we are not studying
something for exams"*. A card with a drawing, a seven-word line and two
five-word verdicts outperforms an accurate paragraph.

---

## 7. Building a new screen

1. Write down the fact the screen exists to deliver. Everything defends it.
2. Lay out the argument in space (§1.4) before worrying about balance.
3. Compose rise / drawer / count. Don't invent a fourth motion.
4. Pick the grade of glass by what sits on it (§3.1).
5. Compute every contrast against the composite (§4.1) and put the figure in
   the comment.
6. Walk the degrade ladder (§5) — all four rungs.
7. Anything showing a subset must say so (§1.3).
8. Put the reasoning in the file-top comment, per `CONTRIBUTING.md`. Not what
   it does — **what was tried, what broke, and why this instead.**

### The traps, in order of how much they cost

1. Two rules both setting `transform` (§2.5) — silent, and you will blame the
   wrong thing.
2. Reduced-motion overrides losing on specificity (§2.6) — silent, and it
   ships claiming an accessibility feature it does not have.
3. Contrast measured against the token instead of the composite (§4.1).
4. A margin element whose width was never summed (§5.2).
5. A subset presented as a whole (§1.3).

---

## 8. Where the code lives

| Piece | File |
| --- | --- |
| Eases, durations, stagger, `rise`, `riseCard` | `src/components/oi/motion.ts` |
| `Glass`, `Reveal`/`revealProps`, `Drawer`, `Pill`, `PillNote`, `Tick` | `src/components/oi/Surfaces.tsx` |
| `CountUp` | `src/components/oi/CountUp.tsx` |
| `useScrollFocus` | `src/components/oi/useScrollFocus.ts` |
| Surface CSS | `src/app/globals.css` — `CARD GLASS` and `DRAWERS` blocks |
| Palette and derived ink tokens | `src/app/globals.css`, `.oi-app` block |
| These rules, as assertions | `tests/design-language.test.ts` |
| Worked reference implementation | `src/app/match/` |

### Class names

Page-agnostic surfaces are `.oi-*` and may be used anywhere:

`.oi-glass` `.oi-reveal` `.oi-drawer(-l/-r)` `.oi-drawer-far(-l/-r)`
`.oi-pill` `.oi-pill-text` `.oi-pill-note` `.oi-tick` `.oi-cta`

`.q-*` is the Quicksand type scale and `/match` content, and is **not**
general: `.q-hero` `.q-h1` `.q-h2` `.q-h3` `.q-body` `.q-small` `.q-plate`
`.q-plate-photo` `.q-mark`. The type scale needs `.oi-quick` on an ancestor.

### On drift

Every number in §4 and §5.2 is asserted in `tests/design-language.test.ts`,
which reads `globals.css` from disk rather than restating it. Change the glass
alpha, a gate, a derived token or the pill's `saturate` and that suite fails
before anything ships. A design document nobody can trust is worse than none,
because it is still being followed.

The tests cover the measurable claims. The ideology in §1 is not testable and
is the part that actually matters — `/match` remains the reference. When this
document and that directory disagree, the directory is right and this file
needs a commit.
