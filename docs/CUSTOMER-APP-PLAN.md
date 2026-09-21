# The customer side: a plan

Written 22 September 2026. **A decision document, not a build order.** Nothing
in here is started.

---

## The thing to settle before anything else

A homeowner's relationship with us has two halves, and they want opposite
things from software.

**Half one — choosing.** Quiz, matches, quotes, compare, the expert call, the
prep pack. Roughly **two weeks**, and they do it **once in their life**. It
arrives from a WhatsApp link or a Google search. It ends with an introduction.

**Half two — the project.** Three to six months of someone rebuilding their
home. Payment stages, drawings to approve, site photographs, a delay to hear
about on a Tuesday, a snag list at the end.

**Only half two wants to be an app.**

Half one is a one-off flow a stranger reaches by link. Asking that stranger to
install something before they have seen a single studio is the highest-friction
thing we could possibly do, and it is at the exact moment they are least
invested. Every product in the onboarding research — Airbnb, Bark, Stripe —
moves the *first win* earlier. An install requirement moves it later by a
minute and a decision.

Half two is the opposite. It is recurring, it is months long, it runs on
notifications, it wants a camera for snags, and by then they have paid us
money. That is a home-screen icon they will genuinely use.

**So the honest position: the phone app's real reason to exist is the project
portal — which you have just decided to defer to "coming soon."**

That is not an argument against the app. It is an argument about *sequence*,
and it makes the plan below a lot cheaper than it would otherwise be.

---

## Where the customer side actually stands

Built, working, unreachable:

| Route | What it is |
| --- | --- |
| `/quiz` | Nine questions. The brief, written as they answer. |
| `/tier` | Essential / Premium / Luxury — materials, not a ranking. |
| `/match` | Who fits, with score rings and reasons. **Mid-rebuild.** |
| `/compare` | Quotes side by side, and the materials behind them. |
| `/expert` | The assigned architect. |
| `/prepare` | Moodboard, room notes, floor plan — the prep pack. |
| `/account` | Their brief, their quotes, their appointments. |
| `/quotes`, `/shared/[token]` | A quote, and a shareable link to one. |

Twenty-three files. It stops dead at the introduction — which is exactly where
half two would begin.

`CUSTOMER_LIVE` is unset, so none of it answers on any hostname. The gate is
not a flag somebody can misconfigure; it is that nothing routes there.

**There is no `public/` directory at all.** No manifest, no app icons, no
service worker. Today the customer web app cannot even be added to a phone home
screen. That matters below.

---

## Part one — the phone app: three routes

### A. React Native (Expo)

A real app in both stores.

**What it costs.** Every screen is rebuilt. None of the twenty-three React
files transfers — `className`, Tailwind, `next/link`, server components and
server actions have no meaning in React Native. Realistically **a second
front-end codebase**, permanently, with its own release cycle, its own store
review, and its own crash reporting.

**What does transfer** is the part that matters most and is easy to overlook:
the pure modules. `matching/score.ts`, `brief/types.ts`, `quotation/ingest.ts`
and the rest carry no `server-only` and no I/O, by the rule in CONTRIBUTING
§9.5. Scoring, tiers, money, the locality map and the catalogue vocabulary can
be imported by an app unchanged. **The expensive thinking is already portable.
It is the screens that are not.**

**When this is right:** when the portal exists and people live in it for
months. Push notifications, camera, offline — those are real advantages and
they are all in half two.

### B. A PWA — the existing web app, installable

Add `public/manifest.json`, an icon set, and a service worker. The site becomes
installable from the browser, gets a home-screen icon, runs without the browser
chrome, and can take web push on Android.

**What it costs.** Days, not months. One codebase. No store review, so a fix
ships in the time a deploy takes.

**What you give up.** iOS web push needs the user to install the PWA first and
is still second-class. No store listing — and in India a store presence is a
trust signal for some buyers. Nothing that needs a real native API.

**What it buys that is specific to here:** a WhatsApp link opens it instantly,
with no install and no store. That is how a Pune homeowner will actually first
meet this, every time.

### C. A wrapper (Capacitor / a WebView shell)

The web app in a native shell, in the stores, one codebase.

**Honest assessment: this is usually the worst of both.** You take on store
review and release cycles, and get an app that feels like a website in a box.
Apple rejects thin wrappers that add nothing native. It is worth it only when
the store listing itself is the goal.

---

## What I would do, and why

**Do B now. Plan A for the portal. Never C.**

1. **Make the existing customer web app a proper PWA.** Days of work, no second
   codebase, and it closes a gap that exists today regardless of any app
   decision — right now there is not even an icon.
2. **Build the portal as web first**, inside the same app, when you build it.
3. **Then, if the portal is being used**, build A on top of it — by which point
   you will know from real usage what actually needs to be native, instead of
   guessing now.

The order matters because A costs a permanent second codebase, and the case for
paying that is made by half two, which does not exist yet. Building the app
first means maintaining two front ends for a flow people touch once.

**If you want the store listing regardless** — for credibility rather than for
function — say so and the calculus changes. That is a legitimate marketing
reason and it is not one I can weigh for you. But it should be named as that,
rather than argued as a product need, because the two lead to different
products.

---

## Part two — "good things take time" for the portal

Small, and worth doing early rather than at the end.

A homeowner who has been introduced to a studio currently reaches the end of
`/account` and finds nothing. The same page should carry a plain block:

> **Your project, once it starts**
> Payment stages, drawings to approve, photographs from site, and what was
> promised against what arrived.
> Good things take time :) — we are building this now.

Two reasons to put it in before the portal exists. It tells a customer the
relationship does not end at the introduction, which is the single thing most
likely to make them trust the introduction. And it is the same voice as the
not-found page, which makes "we are still working on it" read as a house style
rather than an apology.

Reuse the wording from `src/app/not-found.tsx` so the two cannot drift.

---

## Part three — finish and polish

In the order I would do them.

### P1 — Walk the whole thing as a customer, once

Nobody has. Start at `/quiz` with an empty session and go through to
`/prepare`, on a phone, writing down everything wrong. Every list below was
written from reading the code; this is the list that will be written from
using it, and it will be more honest than mine.

### P2 — Finish `/match` (#113, #114, #115)

The three open tasks. It is the heaviest page in the app — **191 kB first load,
against 102 kB shared and ~110 kB typical** — and it is the screen where a
customer decides whether any of this was worth it. Being both the most
important and the least finished makes it first.

While it is open: check whether `framer-motion` is still earning its place.
It is the only heavyweight dependency in a six-dependency project, and the
`useScrollFocus` / `Reveal` primitives already extracted may cover what is left.
Dropping it takes the count to five.

### P3 — The PWA shell

`public/manifest.json`, an icon set at every size, `theme-color`, an offline
fallback page. The manifest is also what gives the app its name and colour on a
home screen, which is a branding surface that currently does not exist.

### P4 — Mobile pass on the long screens

`QuizClient.tsx` is 1,222 lines and `CompareClient.tsx` is 678, both built
desktop-first. The quiz uses a fixed frame with an inner scrolling container —
a pattern that behaves differently with an on-screen keyboard open, and phones
are where this will actually be used.

### P5 — The empty and error states

Specifically: a brief that matches nobody. The roster is about to be genuinely
empty once `db:unseed` runs, so "no studio fits you yet" stops being
hypothetical and becomes the **first thing an early customer sees.** It should
be a good screen, not a fallback.

### P6 — What the quiz promises about time

`/quiz` shows time remaining rather than "question 3 of 9", which is the right
instinct. Confirm the estimate is true by timing a real person, because a
promise of "about three minutes" that takes seven is worse than no promise.

---

## Sequence

```
now      P1  walk it as a customer, on a phone, write down what is wrong
         P2  finish /match, and re-test framer-motion's keep
         --  portal "coming soon" block on /account   (an hour)

next     P3  PWA shell: manifest, icons, offline page
         P4  mobile pass on quiz and compare
         P5  the empty-roster screen, before anyone hits it
         P6  time the quiz honestly

later    the project portal, as web, inside this app
after that, and only if it is being used, a React Native app on top
```

---

## What has to be true before any of this ships

**Studios first.** A customer app with an empty roster is worse than no
customer app: the first homeowner through gets nothing, and there is exactly
one of those. `CUSTOMER_LIVE` stays off until the roster is real — the flag is
already the right shape for that and needs no change.

**And the two open questions from the other plans still stand:**

- the commission percentage, unanswered in `docs/APPLY-COPY.md`
- `hello@oneinteriors.in` still receives no mail, which the customer app will
  print in more places than the studio one does
