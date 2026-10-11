# Design spec — the app matches the website

On 10 Oct 2026 the app was restyled to match the website's customer side, so the same look runs through both. The rules come from `src/components/home/home-cb.css`: a white canvas, one sans face set large and tight, black pill buttons, soft rounded cards and ink for whatever is chosen. Terracotta is the one accent and is used only as a dot, a tick or a hover fill.

Phone frame: **390 × 844**. Side padding is **20px**. Content scrolls; the header and bottom bar stay put.

## Colours

| Token | Hex | Use |
|---|---|---|
| ink | `#0B0B0B` | Text, primary buttons, chosen state, dark cards, bottom bar |
| ink-2 | `#5F5F5F` | Secondary text |
| ink-3 | `#8D8D8D` | Tertiary text, timestamps |
| paper | `#FFFFFF` | Screen background |
| soft | `#F3F3F1` | Cards, inputs, unchosen circles |
| soft-2 | `#EBEBE8` | Hover or pressed soft, segmented-control track |
| line | `#E6E6E3` | Dividers (1px) |
| accent | `#C1582E` (design files also use `#BA5329`) | Dots, ticks, rank numbers, button hover fill, notification dot |
| accent-ink | `#A6461F` | Accent text: "Overall · 4 days late", "Needs fixing" |
| accent-warm | `#E07A4E` | Active tab, highlights on dark |
| gold | `#F2C98A` | Coins, the GEIO orb, the challenge card label |
| ok | `#2F6B42` | Done, on track, savings |
| mint | `#DFF1EA` | Tinted tile |
| lilac | `#EBE9FB` | Tinted tile |
| sand | `#F4ECDF` | Tinted tile |
| peach | `#FBE6DC` | Tinted tile |
| on-dark text | `#F1F0EC`, muted `#B5B3AD` | Text on ink surfaces |

## Type

- **Geist**, with weights 400 and 500 for nearly everything. Use 600 only for small emphasis: list titles and labels on dark.
- **Geist Mono** only for numbers and dates in lists: amounts, specs, times.
- Devanagari falls back to the phone's own face (Kohinoor or Noto Sans Devanagari), because Geist has no Devanagari.
- Headline 34–42px / 500 / letter-spacing −0.045em / line-height ~1.
- Section heading 20–22px / 500 / −0.02em.
- Body 15–16px / 400 / line-height 1.5.
- **Eyebrow labels** (the line above a heading, row labels in tables): 13px / 500 / UPPERCASE / letter-spacing .07em / ink-2.
- **Minimum size anywhere is 13px.** Older customers and parents use this app.

## Components

- **Primary button:** black pill, 56px tall, radius 999, text 16/500 white.
  - It ends in a **white 28px circle holding a black arrow**.
  - On hover or press a terracotta fill rises from the bottom (website `.pill::before`).
  - On a dark card the pill is inverted: white, with a black arrow circle.
- **Secondary button:** transparent pill with a 1px `rgba(11,11,11,.22)` ring.
- **Disabled button:** soft-2 background, ink-3 text, and it says why ("Rank 2 more to continue", "Tick the box to sign").
- **Card:** soft `#F3F3F1`, radius 24, no border, padding 16.
- **Dark card:** ink, radius 20, white text, with an accent eyebrow.
- **Option pill** (quiz chips, filters, time slots): white with a 1px line ring. When chosen it fills with ink and turns white.
- **Circle option** (Q6 priorities, website quiz home types): 104px soft circle, line icon above a 13.5px label. Tapping moves it into a ranked black row that carries a terracotta number circle and a "Remove" label.
- **Segmented control:** soft-2 track, chosen segment is an ink pill.
- **Tinted stat tile:** mint, peach, sand or lilac, radius 20, uppercase label at the top and a big 20–26px figure at the bottom.
- **Dark panel at the top of a screen** (Compare, Expert): ink, bottom corners radius 32. This echoes the website's black panels with rounded tops.
- **Progress:** quiz uses 7 segments, 3px tall, ink for done and line for to-do. Choose & sign uses 4 segments plus "Step n of 4 · name".
- **Status chips:** green "Carpentry · on track" and amber "Overall · 4 days late". Stage status and overall status are always shown separately.
- **Coin:** a gold radial disc with an inner ring. The balance chip sits on Home's header. A "+N coins" toast slides up and fades when coins are earned.
- **GEIO orb:** a radial gradient (`#FFF6E6 → #F2C98A → #E07A4E → #BA5329 → #6E2A10`) with a slow conic shine. It breathes at 4.2s, and faster (1.1s) while thinking.

## Bottom bar (after signing)

Ink background, 5 tabs: **Home · Project · GEIO · Site · Me**.
- GEIO is the raised orb in the middle (52px, ringed in ink).
- Labels are 13px. The active tab is accent-warm `#E07A4E`.
- Snags and Decision open from Project.
- The 3D view opens from Site ("View in 3D"), for full-home orders only.
- Locker, Coins, Family, Dream board and Refer open from Me.

Before signing, the bar is planned as **Home · Studios · GEIO · Me** (see FLOWS.md, stage 1; awaiting approval).

## Motion

- Two curves: a glide `cubic-bezier(.22,1,.36,1)` and a spring `cubic-bezier(.34,1.56,.64,1)`.
- **Headings** rise 18px and fade in over 0.8s.
- **List items and options** rise in a stagger, 60ms apart.
- **Progress segments** grow from the left.
- **Photos** drift with a slow Ken Burns zoom, 18s.
- **Buttons** spring-scale to 0.965 when pressed. Chosen items pop.
- **Numbers count up:** match scores on Matches, the quote total, the coin balance.
- **GEIO** answers stream in word by word after a shimmering "Reading…" line.
- **Confetti:** expert booking and the milestone card.
- **Home's "Updated from site just now" chip** drops in, and the house icon lights up gold.
- **Project's stage lines** fill from the top down.
- **3D model** sways slowly; the worker figures swing hammers.
- **Respect "reduce motion":** every animation drops to instant.

## Accessibility

- Tap targets are at least 44–48px.
- Every icon-only button has a label.
- Option groups use radiogroup or group roles, with `aria-pressed` or `aria-checked`.
- Live regions announce GEIO answers and toasts.
- Contrast meets AA on all text.
- Hindi and Marathi must fit without clipping. Headlines drop from 40 to 34px for those languages.
