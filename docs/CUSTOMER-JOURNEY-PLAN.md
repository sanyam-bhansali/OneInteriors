# Customer journey — the rebuild plan

**Draft for sign-off, 29 September 2026.** Builds on
`docs/CUSTOMER-JOURNEY-REVIEW.md` (the diagnosis) and the owner's direction of
29 Sep. Nothing here is built yet. Section 16 lists what needs deciding before
work starts; section 14 is the build order.

The standard this plan holds itself to: **every question the customer answers
changes something they can see** — who is shown, in what order, what is
priced, or what is said — and the page tells them which answer did it.

---

## 0. What was asked for

| # | Requirement | Where in this plan |
|---|---|---|
| R1 | Every question affects the result shown | §2 (the answer map), §5 |
| R2 | Improve the journey — new questions, steps or systems as needed | §2, §11 |
| R3 | Move-in date becomes **possession** — "already have it" or "when" | §2 screen 4, §5.6 |
| R4 | Floor plan read by Claude → basic quotation (the Hauspire quotation software) | §7.1 |
| R5 | Scope drives the quote: full home → full home; kitchen & wardrobes → only those; etc. All four scopes are in the launch | §7.2 |
| R6 | Bands by ₹/sq ft: **Essential ₹1,200–1,800, Premium ₹1,800–2,500, Luxury ₹2,500+**. Studios sit in a band; choosing a band shows only that band's studios | §4 |
| R7 | Priorities mapped to specific factors | §5.3 |
| R8 | A studio-side profile completion document | `docs/STUDIO-PROFILE-REQUIREMENTS.md`, §13 |
| R9 | One score per card; the match and the AI summary exactly fit the customer's answers | §5.8, §6 |
| R10 | Rethink the process; propose added or removed steps | §11 |
| R11 | Compare has real things to compare, plus an AI summary: where the cost changes, material ranges, price per material | §8 |
| R12 | Expert: book a consultation directly, seamlessly | §9 |
| R13 | Google, Apple and Facebook sign-in; name and number captured in the brief; a personal greeting ("Welcome, Sanyam") | §3, §6 |
| R14 | Style photos from studio portfolios **and** licensed images; studios ranked on what the customer picks | §5.2 |
| R15 | Show three to six matches | §4.4, §6 |
| R16 | Everything in review §5, plus more personalisation ideas | §12 |

---

## 1. The new journey at a glance

```
Landing
  └─ OneBrief ── seven short chapters, ~12 screens, ~4 minutes
       1 You          name
       2 Your home    BHK + society/area · floor plan (AI reads it) · possession
       3 The work     scope + what's included · finish level (band)
       4 Your taste   photos you love · this-or-that · never
       5 How you live household · home needs
       6 How you work involvement · priorities · language
       7 Your matches phone + Google/Apple/Facebook · consent
  └─ OneMatch ─── "Welcome, Sanyam" · 3–6 studios in your band · one score each ·
                  evidence in your words · their work like yours · timeline from
                  your possession · every studio already priced
  └─ OneQuote ─── instant, for every match, from your floor plan and your scope,
                  on each studio's own rates · payment schedule · "Prepared for Sanyam"
  └─ OneCompare ─ fit first, then price · per-room and per-material ·
                  AI summary of where the money differs
  └─ OneExpert ── pick a 30-minute slot and book — no forms, no call-back wait
  └─ After ────── your introduction and first meeting, visible in "Your home"
```

The five names stay. What changes: the floor plan moves **into** the brief,
OneQuote stops being a per-studio gate with a ten-second build and becomes
instant for every match, and the journey gets a visible ending (§11).

---

## 2. OneBrief v2 — every screen and what it changes

Legend for the last column: **F** hard filter (who can appear) · **R** ranking ·
**Q** the quote · **S** what the page says · **E** the expert's pack.

| # | Chapter | Question | Input | Changes |
|---|---|---|---|---|
| 1 | You | "What should we call you?" | first name; optional "Continue with Google / Apple / Facebook", which fills it | **S** every screen after this, the match greeting, "Prepared for" on quotes · **E** |
| 2 | Your home | Home type, and where it is | BHK tiles; **society or area typeahead** (typing "Gera World of Joy" fills Kharadi) | **F** zone · **R** similar work: same society > same area > same zone · **Q** rooms · **S** "they have done 3 homes in your society" |
| 3 | Your home | "Have your floor plan?" | upload PDF/photo → **Claude reads it** → "We read: 3 BHK, 1,180 sq ft, kitchen platform 4.2 m, 2 bathrooms — right?" · or "No plan" → carpet area (optional; default by BHK, labelled) | **Q** sizes and band width · **F/R** via area · **S** assumptions printed |
| 4 | Your home | **"Do you have possession yet?"** | "Yes, I have the keys" / "Expected — month and year" / "Not sure yet" | **R** timeline fit (studio can start when you can) · **S** your personal timeline: "design from Dec, work Jan–Apr, ready by May" · **E** |
| 5 | The work | What are we doing, and what is included? | Full home / Kitchen & wardrobes / Single room(s) — which / Renovation — what; then **a checklist of items**, pre-ticked for the scope and the rooms we read from the plan | **F** studio offers this scope · **Q** exactly these lines · **R** similar work by scope |
| 6 | The work | Finish level | Essential / Premium / Luxury, each **priced for this scope, these items and this home**, with the materials each band means | **F** studio's band · **Q** · **S** |
| 7 | Your taste | "Which of these feel like your home?" | 12–16 **photographs**, scope-aware (a kitchen customer sees kitchens), mixed licensed and studio portfolio images, studio names hidden; pick 3+ | **R** style fit (and direct affinity to the studios whose photos were picked) · **S** "you picked two of their projects" |
| 8 | Your taste | This or that | 4 pairs drawn from the two or three styles closest to the picks | **R** sharpens the style fit |
| 9 | Your taste | "Which would you never want?" | pick up to 2 from the same set | **F** above 40% of their work · **R** penalty below it |
| 10 | How you live | Who lives there, and what the home needs | adults / children / elderly / pets / works from home; needs: vastu, pooja room, extra storage, smart home, low-maintenance finishes, entertaining | **R** household & needs fit (studio specialisms) · **Q** adds the lines these imply (study unit, mandir, extra lofts…) · **S** · **E** |
| 11 | How you work | How involved you want to be, and what matters most | three involvement options; rank four priorities; preferred language (English / हिन्दी / मराठी) | **R** working-style fit · **R** priority weights (§5.3) · **R** language (soft) · **S** the top priority leads every card's evidence |
| 12 | Your matches | "Where should we send your matches, Sanyam?" | mobile number (+ email if not from a provider) · "Continue with Google / Apple / Facebook" · consent in plain words | Saves the brief to an account; enables the expert booking; **S** |

**Rules for the brief**

- Progress shows as seven chapters, not twelve numbers. Screens that do not apply are skipped: the plan fills area and BHK, and single-room customers skip the rooms they did not pick.
- Every screen saves to the server as well as the tab, so a customer can finish on another device after signing in (fixes review §4.2 #11).
- No answer is invented. A default (area by BHK, standard kitchen) is always labelled as ours.
- `moveInBy` stops being asked. The column stays for old briefs; `possessionOn` (already in the schema) plus a new `possessionStatus` replace it.

**Name first, number last — a recommendation, and a decision for you.** You
asked for name and number in the first quiz process. Both are in it. I
recommend the **name on screen 1** — it costs nothing and personalises
everything after — and the **number on the last screen**, right before the
matches. By then the customer has invested four minutes, can see what they
get for it, and the consent wording has something concrete to refer to. Asking
for a phone number on the first screen, before we have given anything, is
where lead-gen funnels lose most people. If you still want both on screen 1,
it is a one-line change to the order.

---

## 3. Identity — name, number, and one-tap sign-in

### 3.1 What each sign-in gives us

| Method | Name | Email | Phone | Needs from you |
|---|---|---|---|---|
| **Google** | yes | yes, verified | **no** | Google Cloud OAuth client (free) |
| **Apple** | first sign-in only | yes (may be a private relay address) | **no** | Apple Developer account ($99/yr), a Services ID and a key |
| **Facebook** | yes | usually | **no** | Meta developer app; app review and business verification before the public can use it |
| Phone OTP (exists) | typed | — | yes, verified | WhatsApp template approval (still pending) |
| Email link (exists) | — | yes, verified | — | — |

**No social provider gives a phone number.** So the last brief screen always
asks for the mobile number, whatever the sign-in method. Social sign-in
removes the OTP step; it does not remove the number.

### 3.2 How it works

- One small library, **Arctic** (MIT, a thin OAuth client for Google, Apple and Facebook), on top of **our own sessions** — the existing `createSession()`. No second auth system, no Supabase Auth users to keep in sync.
- Routes `/auth/oauth/[provider]/start` and `/callback` (Apple posts back, so its callback takes POST). State and PKCE in short-lived cookies.
- New table `auth_identities` (provider, provider user id, user id, email, verified) with the RLS block.
- **Linking:** a verified provider email that matches an existing *customer* links to that account. One that matches a studio or ops account does **not** auto-link — they are told to use their usual sign-in. Social sign-in only ever creates CUSTOMER accounts.
- **The phone is stored on the brief as an unverified contact number, not on `User.phone`.** `User.phone` is unique and is an identity, and writing an unverified number there would let someone claim another person's number. It moves onto the user only once verified (WhatsApp OTP when the template is approved, or the expert confirming it on the call).
- The anonymous brief is claimed on sign-in, as today.
- Build Google first. Apple and Facebook follow as soon as their credentials exist; each is small once the first provider works.

### 3.3 Consent and privacy (required, not optional)

Collecting a name and a number at step 12 is personal data under DPDP, so this
ships **with** it, not after:

- A **`/privacy` page.** `POLICY_VERSION` exists and has no page behind it. We draft it; a lawyer should read it.
- Plain consent on screen 12: *"We use this to show you your matches and to arrange your expert call. We share it with a studio only when you choose one."*
- Consent rows written at capture (`Consent` exists), with a new purpose, `SHARE_WITH_STUDIO`, recorded at the moment they pick studios at OneExpert.
- Withdrawal from "Your home" (`/account`), which today promises a withdrawal that nothing performs.

---

## 4. Bands — the numbers, the filter, and the maths of supply

### 4.1 The bands

| Band | ₹ per sq ft of carpet, all-in before GST |
|---|---|
| **Essential** | 1,200 – 1,800 |
| **Premium** | 1,800 – 2,500 |
| **Luxury** | 2,500 and up |

These replace `tiers.ts` (₹700–3,200) on every customer surface — the quiz,
the landing page's Packages section and the quote. The studio deck
(₹1,200–1,500 / 1,500–2,500 / 2,500+) and `subscription.ts` should move to the
same boundaries so a studio's subscription band and its customer band are the
same thing. Luxury has no ceiling, so it is shown as "from ₹X for your home".

### 4.2 How a studio gets a band

A band is a **consequence of a studio's prices**, never chosen by the studio and
never bought:

1. **From filed rates** (preferred): price a standard 2 BHK and 3 BHK full
   home on the studio's LIVE rates → ₹/sq ft → band. `studioTierFrom()` already
   does this arithmetic.
2. **From delivered work** (until rates are live): median of value ÷ carpet
   area across their portfolio projects — which needs carpet area per project
   (new field, see the studio document).
3. **Ops confirms** the computed band on `/ops/[slug]`, with a reason if
   overriding. Audited.

One band per studio. A studio whose numbers straddle a boundary is placed by
its median and can appear in the adjacent band only through the explicit
"see more" in §4.4 — a decision for you (§16).

### 4.3 The price range on the finish-level screen

For a full home it is simply the band × their carpet area. For a partial scope
("Kitchen & wardrobes, Premium, for your home") there is no per-sq-ft figure, so
it is computed: price **that scope's lines at this home's sizes** on a
*band reference rate card* — the archive medians scaled so a standard full
home lands exactly on the band's low and high ₹/sq ft. Labelled *"typical for
Premium studios in Pune"*. Once three or more studios in a band have live
rates, the reference card becomes their actual median and the label says so.

### 4.4 Three to six matches — and what happens when there are fewer

Hard filters now stack: **band × scope × zone**. With the likely launch
supply — say 12–15 studios — that is four or five per band, and after zone and
scope often **one or two**. This is the biggest product risk in the plan and
it has to be handled honestly rather than hidden:

- **Zone becomes a strong ranking factor rather than a hard filter for studios that declare they work city-wide.** Most Pune studios take work across the city for the right job; the filter stays hard for studios that say they do not.
- **When fewer than three fit**, the page says so plainly and offers named, one-tap widenings with the count each adds: *"Include studios working city-wide (+2)"*, and — if you approve it — *"Show Luxury studios too (+2), clearly marked as above your level"*.
- **Ops sees the coverage gaps.** A band × zone × scope grid on `/ops` shows where briefs are landing with fewer than three matches, which is the recruiting list.
- Fixtures grow from 8 to ~15 studios spread across bands, zones and scopes, so the rule can be built and tested before real supply exists.

---

## 5. OneMatch engine v2 — `match@2.0.0`

### 5.1 Filters (a studio failing one is not shown)

Active and verified · not paused · **in the chosen band** · **offers the
chosen scope** (renovation needs declared civil capability) · works in the
customer's zone (or city-wide, §4.4) · less than 40% of its work in a style
the customer ruled out.

### 5.2 Style fit — from photographs (weight 30)

- **Every picker image is tagged**: its style(s) and its room. Licensed images are tagged by us; portfolio images are tagged by the studio, then checked by a vision pass and confirmed by ops.
- The picks, the this-or-that answers and the "never" choices become a **style profile** — a weight per style — with partial credit between neighbouring styles from a small, versioned **affinity table** (Japandi ↔ Scandinavian ↔ Warm Modern).
- Each studio's style profile comes from its tagged portfolio, recent work weighted above old.
- **Direct affinity:** if the customer picked a studio's own photo, that studio gets a capped boost and the card says *"you picked two of their projects"*. To keep this fair, the picker shows at most one image per studio per screen, rotates which studios appear, and balances images across styles.
- Scope-aware: a kitchen-only customer is shown kitchens and wardrobes, not living rooms.

### 5.3 Priorities — each one has its own signal (weight 30, split by rank)

The customer's ranking splits the 30 points **12 / 9 / 6 / 3**. Each priority
reads a signal of its own instead of re-counting another factor:

| Priority | Signal on day one | Signal once projects are monitored |
|---|---|---|
| **Staying in budget** | where this studio's quote for *this home* sits inside the band (lower is better); how complete its rate card is (fewer "not priced" lines) | quote-to-final variance on delivered projects |
| **Finishing on time** | can they start when the customer can (lead time vs possession); typical duration for this scope from their portfolio; in-house factory | days over promise on monitored projects |
| **Design ambition** | depth of work in the customer's styles; design services (3D views, revisions included, a dedicated designer); share of custom work | customer design ratings |
| **Material quality** | spec level of their filed rates (BWP vs MR/HDHMR carcass, hardware brand, shutter finish); warranty years; own factory | spec compliance at site checks |

Where a signal cannot be measured it is `null` and the card says so — the
rule does not change.

### 5.4 Similar work (weight 15)

Portfolio projects that match the **scope**, a **size** within ±25% of this
home, and the **place** — same society scores above same area above same
zone. This is where "they have done three homes in your society" comes from.

### 5.5 Working style (weight 10) and household & needs fit (weight 10)

- **Involvement ↔ how the studio says it works** (turnkey / collaborative / client signs off on everything), from the new studio profile. Communication rating joins later from post-meeting check-ins.
- **Household and needs ↔ studio specialisms and tagged projects**: children, elderly, pets, home office, vastu, pooja room, storage-heavy, smart home.

### 5.6 Timeline fit (weight 5, plus a flag)

From possession: *work can start* = the later of possession and today; *studio
can start* = today + their declared lead time. The card shows a line either
way — *"Can start in January, when you get the keys"* or *"Booked until
March — six weeks after your possession"*. Studios that cannot start within a
month of possession sort down and are flagged, never silently hidden. If
nobody can, the page says so once at the top.

### 5.7 Ranking that stays honest

- The **displayed** score is normalised over what could be measured, exactly as today.
- The **order** uses a confidence-adjusted score, so a studio measured on half the factors cannot outrank one measured on all of them on thin evidence.
- Explicit tie-breaks: measured weight, then checks cleared, then delivery record.
- Language is a gentle tie-breaker, not a factor.

### 5.8 One score, computed once, stored

- Ranking moves **to the server**. The brief is read from the database, ranked once, and **stored as `Match` rows** with the engine version. Nothing re-ranks.
- The card, the AI read, compare and the expert page all read that stored result. Two different numbers become impossible by construction (fixes review §4.2 #3).
- No sentence ever prints the percentage. The number lives in one place on the card.
- Full studio records stop being sent to the browser; the page receives what it displays.

---

## 6. OneMatch page v2

- **The greeting:** *"Welcome, Sanyam. Four studios fit your 3 BHK in Kharadi at Premium."* Returning visitors: *"Welcome back, Sanyam — one new studio fits your brief since Tuesday."*
- **3–6 cards**, ordered as in §5.7. Each card:
  - one score, with "N of M factors measured"
  - **evidence in the customer's own words, led by their top priority** — *"You put finishing on time first → they can start in January and their last six homes took 84 days on average"*
  - **their work like yours** — the two or three portfolio projects closest to this brief (style, size, society), photos first
  - the **timeline line** from §5.6
  - **the quote total**, already computed (§7), with its range
  - the **written read** (Claude), from the stored result and the full brief — household, priorities, possession, scope — plus the similar projects. It names the weakest point last. The deterministic fallback follows the same rules and carries no percentage.
- **Fewer than three:** the honest message and the widenings from §4.4.
- A **"why not the others"** link lists studios filtered out and the filter that removed them ("not in Premium", "doesn't do renovation"), so the customer sees the ranking is not arbitrary.

---

## 7. OneQuote v2

### 7.1 The floor plan — the Hauspire quotation software

**Detailed in `docs/QUOTATION-ENGINE-INTEGRATION.md`** (29 Sep), written
after reading the software's source: what it does, what One Interiors
already has, the eight things to fix on the way in, how it plugs into the
brief, and the 50–60-quotations-per-studio data feed.

The Hauspire quotation software you will share reads a floor plan with Claude
and produces a basic quotation. It plugs in behind two interfaces, so the
rest of the journey does not care how the reading is done:

```
readFloorPlan(file)  →  { bhk, carpetAreaSqft, rooms[{ name, widthMm, lengthMm }],
                          kitchenRunMm, bathrooms, confidence, notes }
basicLines(reading, scope, items)  →  canonical lines with sizes
```

- **The customer confirms what was read** before anything is priced ("We read 1,180 sq ft — right?"). AI proposes, the customer confirms, and a misread is never baked into six quotes. This is the rule LEARNINGS-FROM-QUOTATION-APP §1.1 set.
- The reading infrastructure largely exists already: `extract-agent.ts` sends PDFs and images to Claude and parses the answer defensively for studio archives. Floor plans use the same path.
- Plans are stored privately (the `floor-plans` bucket exists) under the customer's consent, never shown to a studio until they choose one.
- No plan → standard sizes by BHK and area, a wider band, and the document says which.
- **I need the software itself** to decide whether we call its hosted API or bring its reader and template into this codebase. Bringing it in is likely better — one set of rates, one catalogue — but that is a call to make with the code in front of us.

### 7.2 Scope-aware quotes

| Scope | Lines priced |
|---|---|
| **Full home** | every room, minus anything unticked on the checklist |
| **Kitchen & wardrobes** | kitchen (base, wall, loft, tandem) + every bedroom's wardrobe and loft — nothing else |
| **Single room** | the room(s) chosen, with that room's lines |
| **Renovation** | the civil work ticked (flooring, bathroom, kitchen civil, electrical rewiring, painting, false ceiling) + any interior rooms ticked |

- The catalogue gets a **scope membership** per item, and a **civil block** for renovation. The Hauspire template is the source for both; the four calibration quotes check them.
- **The checklist is the quote.** Unticking the false ceiling removes it from every studio's quote at once.
- Household and needs add lines (§2 screen 10): a study unit for someone working from home, a mandir for a pooja room, extra lofts for storage.

### 7.3 Priced once, for every match, instantly

- Every matched studio is priced the moment the matches appear. The build animation plays once, for the first quote, not six times.
- Each quote uses **that studio's LIVE filed rates**. A studio with no live rates shows *"Rates not filed yet"* instead of a borrowed price — no more placeholder table under a real studio's name. Until real rates exist, fixtures carry distinct, labelled rate cards so compare can be built against real-looking differences.
- The document: room by room, **"Prepared for Sanyam · 3 BHK · Kharadi · Premium"**, every assumption printed, the band's ±, and **the payment schedule** — when money moves, before any studio is chosen (LEARNINGS §1.3).
- It says where the total lands against the chosen band. A total outside it is flagged.

---

## 8. OneCompare v2

Compare becomes worth opening the day studios have real rate cards. Until then
it keeps its loud "placeholder rates" flag and leads with fit.

1. **Fit, first.** Score and factors, similar work, timeline, working style, checks cleared, delivery record — side by side, because the decision is a designer, not a price list.
2. **Price by room**, with the spread across studios: *"Kitchen: ₹2.1L – ₹2.9L across your four studios."*
3. **Price per material**: each studio's rate for the same spec — *"18mm BWP ply, veneer shutter: ₹2,130 / sq ft at Akara, ₹1,950 at Sixth Wall"*. Materials matched on normalised ids from the glossary, not on sentences (FINDINGS 1.2).
4. **Starred lines** and the verdict with caveats, as today.
5. **AI summary**, on demand ("Explain the differences"): where the cost changes, the material ranges, and the price per material, in plain words. Guardrails:
   - Claude receives only the compared numbers, and never names a figure it was not given.
   - **A checker verifies every ₹ amount and percentage in the text against the data** before it is shown; any mismatch falls back to the deterministic summary (`summary.ts` already exists and compare never used it).
   - The summary is labelled as written by AI, like the match read.

---

## 9. OneExpert v2 — book, don't request

- **One screen:** the studios carried over from compare (pre-ticked, editable), the questions we derived (from the spread, the household and the possession date), an optional note, and **a calendar of real 30-minute slots** for the next ten days.
- **Pick a slot → booked.** Name and number are already known. No "when suits you?" box, and no waiting for a call-back to fix a time.
- Confirmation on screen, by email with a calendar invite (`.ics`), and on WhatsApp once the template is approved. Reschedule and cancel links.
- **Availability** is set by ops in the console: weekly hours per expert plus blocked dates. No double booking — the database refuses it.
- **The expert's pack**, extending the existing prep pack in `/ops/consultations`: every answer, the stored match reasoning per studio, the quotes exactly as the customer saw them, their stars and their notes. The customer never repeats themselves.
- **The legacy pricing engine leaves this page.** It shows the customer's own quotes (§7), not a re-ranked, re-priced set.
- **A real expert.** The placeholder architect (`ARCHITECT_IS_REAL=false`) must be replaced by a real person's profile before launch.
- Option for later: sync the expert's Google Calendar free/busy instead of hours set in the console.

---

## 10. After the call — a visible ending, and the customer's own portal

**Owner's direction, 29 September:** once the expert call is booked, the
customer has **their own portal**, signed in with their Google account,
holding all their information — and a **mood board** and a **3D design**
feature they can configure themselves until the call. The 3D design tool is
being built separately by the owner and is integrated when ready; the mood
board builds on the room boards that already exist in `/prepare` (`PrepRoom`),
which fold into the portal (§11).

Today the journey ends at "someone will call you". The customer never sees the
introduction, the meeting, or anything after. **"Your home"** (`/account`)
becomes the place that does:

- the brief, the matches and the quotes, as they left them
- the booked expert call
- after the call: *"Introduced to Akara Design Studio · first meeting Saturday 11am at your flat"* (from the existing `Introduction` and `Appointment` rows)
- two questions after that first meeting — *did the studio match what we told you? how was the communication?* — which start filling the working-style and communication signals (§5.5)
- share with family (the share link exists and has no button), and withdraw consent

---

## 11. Rethinking the process — what I would change

| Change | Why |
|---|---|
| **Floor plan moves into the brief** (from the quote gate) | It fills area, BHK, rooms and the kitchen for **every** studio at once, and skips three questions |
| **OneQuote becomes instant for every match** (the per-studio gate goes) | The computation is instant; pricing three studios should not be three round trips and thirty seconds of animation |
| **Brief grows from 9 screens to ~12, in 7 chapters** | Possession, the scope checklist, this-or-that and the contact screen earn their place; the plan auto-skips screens. Each new question changes a result (§2) |
| **Add a visible ending** ("Your home", §10) | The journey currently stops at "we'll call you". The introduction is the product's actual outcome and the customer cannot see it |
| **Retire `/tier`** | Orphaned since the band moved into the brief |
| **Fold `/prepare` into "Your home"** | It duplicates the floor-plan upload and has no entry point (FINDINGS 2.6); its room boards fit naturally as "prepare for your meeting" |
| **Keep five names** | OneBrief / OneMatch / OneQuote / OneCompare / OneExpert still describe it; "Your home" is a place, not a step |

---

## 12. More personalisation — beyond the review

1. **Society-level matching** — the typeahead captures the society, studios tag projects with it, and *"they have done three flats in your building"* becomes a real sentence and a real ranking signal.
2. **A floor-plan library by society** — every plan uploaded with consent is kept against its society and configuration, so the next buyer in that building picks "Tower B, 3 BHK" instead of uploading. In a possession-heavy market this compounds quickly.
3. **Your personal timeline** from possession: design, execution and ready-by dates, per studio.
4. **Scope-aware style photos** — kitchens for kitchen customers.
5. **"Upload photos you love"** (Pinterest or Instagram screenshots) → Claude reads the style → folded into the style profile. Optional, and never stored longer than the brief.
6. **Their work like yours**, first on every card.
7. **Language** — English, Hindi or Marathi, matched to the languages the studio's team speaks.
8. **"Prepared for Sanyam"** on every quote and the compare PDF, so it can be forwarded to family.
9. **Returning-visitor memory** — "one new studio fits your brief since Tuesday".
10. **Payment schedule before choosing** — when money moves, per studio.
11. **The expert never re-asks** — everything is in their pack.
12. **Quote lines from household and needs** (study, mandir, storage, safer finishes).
13. **The 3D view of their own flat** from the floor-plan reading (LEARNINGS §1.2) — later, but it is the thing people forward to a spouse.
14. **Post-meeting check-in** feeding the engine — personalisation that improves for the next customer, not just this one.

---

## 13. The studio side

The customer side can only match on what studios tell us. The fields, the
wording for studios and the reason for each are in
**`docs/STUDIO-PROFILE-REQUIREMENTS.md`**. In short: band evidence (filed
rates, carpet area per project), scopes offered with minimums, service areas
and societies, capacity and lead time, how they work, specialisms, languages,
materials and warranty, and a portfolio with room-tagged photos and consent to
appear in the customer's style picker.

Studio-side work that follows from it:

- **Onboarding** gains a "Matching profile" step (or folds into the existing steps) collecting those fields. Every field says in one line which customer answer it is matched against — that is also the pitch for filling it in.
- **Ops** gets band confirmation, image-tag review, and the coverage grid (§4.4).
- Studios already onboarded are asked to complete the profile. Missing fields score `null`; they never block a listing, but the listing shows what is not yet known.

---

## 14. Build order

Sizes: **S** ≤ a day · **M** a few days · **L** a week or more. Each phase
ships with its tests, green typecheck, lint and suite, and is usable on its
own. The customer side stays closed (`CUSTOMER_LIVE`) throughout.

| Phase | What ships | Size | Depends on |
|---|---|---|---|
| **0 · Ground** | CI green again (it has not run since 7 Sep); waitlist RLS migration; single-score fix; false claims removed (review §4.2 #2, #5, #6); **new band boundaries** everywhere customer-facing; **possession question** replaces move-in | M | — |
| **1 · Brief v2 + identity** | Name first; seven chapters; society typeahead; possession; scope + item checklist; contact screen with consent; `/privacy`; **Google sign-in**; brief on the server; the greeting | L | Google OAuth client |
| **2 · Quote v2** | Scope membership and civil block in the catalogue; band reference ranges per scope; instant quotes for every match; payment schedule; "Prepared for"; **floor-plan reading** with the confirm step | L | **The Hauspire software** |
| **3 · Studio profile v2** | The fields in the studio document; band computed + ops confirmation; portfolio image tagging and picker consent; ~15 fixture studios across bands, zones and scopes | L | Your sign-off on the studio document |
| **4 · Engine v2 + OneMatch v2** | Photo style picker (licensed + portfolio), this-or-that, never; `match@2.0.0` (§5); server-side ranking with stored matches; card and AI read v2; widenings when fewer than three; "why not the others" | L | Phase 3 (fixtures are enough to build it); licensed images |
| **5 · Compare v2** | Fit block, per-room and per-material pricing, the AI summary with its checker | M | Phase 2 |
| **6 · Expert booking** | Availability, slots, booking, confirmations, the expert's pack, "Your home" ending | M | A named expert and their hours |
| **7 · The rest** | Apple and Facebook sign-in; inspiration upload; society plan library; post-meeting check-in; coverage grid | M each | Apple / Meta accounts |

Phases 2 and 3 can run in parallel once Phase 1 is in. Phase 4 can start on
fixtures while real studios fill in their profiles.

**Progress, 29 September** (branch `claude/detailed-review-planning-048ed8`):

- **Phase 0 — done.** CI runs; waitlist lockdown; one score per card;
  the false claims removed; bands at ₹1,200 / 1,800 / 2,500 (engine
  `match@1.0.1` for the open top band); possession replaces move-in.
- **Phase 1 — done, one item moved.** Name first; eleven screens in seven
  chapters; locality search and society; home needs and language; the
  contact screen with consent and `/privacy`; Google sign-in (needs the
  OAuth client); "Welcome, Sanyam" and the brief held for any tab; the
  written read given the whole brief; `/tier` retired. **The scope item
  checklist moves to Phase 2**, because what it lists is the catalogue's
  scope membership, which Phase 2 builds.
- **Phase 2 — done.** Scope checklist, scope-scaled bands and the civil
  block; the floor-plan reader with its confirm step; every match priced
  at once on the platform format ("Prepared for", payment phases in
  rupees, "Powered by One Interiors", print/save as PDF on A4); where the
  total lands against the chosen band; archive threshold 50 with a
  per-item floor of 8; Excel quotations read. The per-studio modular
  discount moves to Phase 3 with the curated discount.
- **Phase 3 — done.** "How you work" matching profile; curated discount
  (ops) on every quote; portfolio area, society, tags, photo rooms and
  picker consent; band proposed from rates and finished homes, confirmed
  by ops; 15 fixture studios across every band, zone and scope;
  `/ops/coverage`.
- **Phase 4 — mostly done.** `match@2.0.0` (§5) with evidence per factor,
  the timing line, "like your home", widenings, "why not the others", one
  server ranker and stored matches. Waiting: the photo style picker and
  Style DNA (licensed images), and "one band up" (your yes).
- **Migrations to deploy:** `20260929100000_waitlist_signups_lockdown`,
  `20260929110000_brief_possession_status`,
  `20260929120000_brief_contact_and_home`, `20260929130000_auth_identities`,
  `20260929140000_brief_scope_selection`,
  `20260929150000_brief_floor_plan_reading`,
  `20260929160000_studio_payment_phases`,
  `20260929170000_studio_matching_profile`,
  `20260929180000_portfolio_matching_fields`, `20260929190000_studio_band`.

---

## 15. Data changes

Every new table carries the RLS block, and every migration is generated
offline and checked in a transaction before `db:deploy`.

| Change | For |
|---|---|
| `Brief`: `contactName`, `contactPhone` (unverified), `possessionStatus`, `society`, `scopeRooms`, `items` (jsonb), `needs[]`, `language`, `stylePicks` + `styleProfile` (jsonb), `floorPlanReading` (jsonb) | §2 |
| `auth_identities` (new) | §3 |
| `ConsentPurpose` + `SHARE_WITH_STUDIO` | §3.3 |
| `Studio`: `band`, `bandSource`, `bandConfirmedAt`, `scopesOffered[]` with minimums, `servesCityWide`, `leadTimeDays`, `processProfile`, `specialisms[]`, `languages[]`, `materialDefaults` (jsonb), `warrantyYears`, `ownFactory`, `designServices` (jsonb) | §4, §5, studio document |
| `PortfolioProject`: `carpetAreaSqft`, `society`, `needsTags[]`; images become rows with `room`, `styleTags`, `inPicker` consent | §5.2, §5.4 |
| `style_images` (new) — licensed and portfolio images for the picker, with tags and licence details | §5.2 |
| `expert_availability`, `expert_blocks` (new); `Consultation` gains `mode`; unique on expert + slot | §9 |
| `Match` — start writing it | §5.8 |
| Catalogue: scope membership per item, civil block (code, not a table) | §7.2 |

---

## 16. Decisions

**Signed off 29 September** ("looks good, go ahead"). Where this plan gave a
recommendation, the recommendation is what is being built:

| # | Decision | Adopted |
|---|---|---|
| 1 | Name and number placement | Name on screen 1, number on the last brief screen |
| 2 | Zone for city-wide studios | A strong ranking factor, not a hard filter |
| 4 | Studios near a band boundary | One band, by median |
| 5 | Brief length | ~12 screens in 7 chapters, auto-skipping |
| 7 | Expert availability | Hours set in our console to start |
| 11 | Deck and `subscription.ts` bands | Move to ₹1,200 / 1,800 / 2,500 |
| 12 | Studio profile document | Approved as the basis for onboarding changes |

**Still open — none of them blocks Phase 0:**

- **3.** Whether "show studios one band up, clearly marked" may be offered when fewer than three fit. Until you say yes, the band is strict and only the city-wide widening is offered.
- **6.** The Hauspire quotation software — needed for Phase 2.
- **8.** The expert at launch — needed for Phase 6.
- **9.** The licensed image library — needed for Phase 4.
- **10.** Google OAuth client (Phase 1); Apple and Meta developer accounts (Phase 7).
- **Benefits terms** — §17.3.

---

## 17. The benefits of booking through One Interiors

The owner's list, 29 September:

> Verified studios · Quotation in 10 seconds · Quotation comparison in a
> language you can understand · Comparison brief in a language you can
> understand · Unbiased experts — we are not selling for any studio, we are
> here to guide you · One Interiors curated discount · Project tracker ·
> Cinematic video shoot · Cashback worth up to ₹50,000 · OneHamper at project
> handover · OneReferrals — refer a friend or colleague, get ₹10,000 · Free cab
> service

### 17.1 Where each one lives in the journey

A benefit is most persuasive at the moment it is relevant, and it is only
honest if the product actually delivers it at that moment.

| Benefit | Where the customer meets it | What makes it true |
|---|---|---|
| **Verified studios** | Every match card: checks cleared, with sources and dates | Already true — the hard filter shows verified studios only |
| **Quotation in 10 seconds** | The first quote: a live stopwatch — *"Built in 9.6 seconds"* — measured, not claimed | Phase 2 (instant quotes for every match) |
| **Comparison in a language you understand** | OneCompare: plain-words summary, in English, हिन्दी or मराठी (the language from the brief), with a *listen* button for family | Phase 5 (AI summary + checker); the browser's speech engine reads it aloud at no cost |
| **Comparison brief in a language you understand** | A one-page brief of the comparison, downloadable and shareable, in the same language | Phase 5 |
| **Unbiased experts** | OneExpert: *"No studio pays our experts. They are here to help you choose, not to sell."* Shown beside the booking calendar | Already true in the model — no studio pays for position. The expert's pack shows every compared studio equally |
| **Curated discount** | A line on every quote — *"One Interiors curated discount · 5% · −₹72,000"* — never a struck-through price | Needs each studio's agreed discount (new field, studio profile §1). Same for every customer of that studio |
| **Project tracker** | "Your home" after signing: milestones, site photos, what is next | **Not built on the customer side.** The studio-side tracker exists and is switched off. Must be built before it is promised |
| **Cinematic video shoot** | "Your home" benefits pass, unlocks at handover | Ops arranges; with the customer's consent the film also becomes portfolio work for the studio |
| **Cashback up to ₹50,000** | Quote: *"Eligible for up to ₹X cashback if you sign through us"*; tracked in the benefits pass | Needs the terms (§17.3) |
| **OneHamper** | Benefits pass, unlocks at handover | Ops fulfils |
| **OneReferrals ₹10,000** | Benefits pass from day one: a personal code — *SANYAM-10K* — and a share button | Needs the terms (§17.3); needs a referral record |
| **Free cab service** | OneExpert and after: *"Visit Akara's studio on Saturday — we'll send a cab"*, booked in the app | Ops fulfils; needs the limits (§17.3) |

### 17.2 The benefits pass

A single card in "Your home" with every benefit and its honest state —
**available now**, **unlocks when…**, **claimed**. For example: referral code
(available now), free cab (available once your expert call is booked),
curated discount and cashback (unlock when you sign with a studio through us),
cinematic shoot and OneHamper (unlock at handover). It turns the list into a
path, and each state is a fact we hold, not a promise.

### 17.3 What each benefit needs before it is shown

Copy that promises money needs terms behind it:

- **Cashback** — how much for which project value ("up to ₹50,000" needs a rule), when it is paid (on signing, on a milestone, at handover), and whether anything cancels it.
- **Curated discount** — the percentage per studio (agreed in the studio agreement), and what it applies to (the whole quote, or modular only). It is shown as a line, never as a struck-through price (LESSONS-FROM-V1: no price that moves when pushed).
- **Referral ₹10,000** — paid to whom (referrer, referee or both), and when (the friend signs, or pays their first stage).
- **Free cab** — for which visits (studio, experience centre, site), how many, and within what distance.
- **Project tracker** — build it (a customer view of the milestone plan), or leave it off the list until it exists.
- **Cinematic shoot and OneHamper** — for which projects (all signed through us, or above a value).

None of this blocks Phase 0. Each benefit appears on a screen only once its terms are written down.

---

## 18. Making it immersive

The rule these obey is the design language's own: **every effect is evidence,
or it is cut**, with three motions only (Rise, Drawer, Count). Immersion here
means the customer *watching their own information turn into their answer*,
not decoration.

1. **Your home, assembling.** The brief's side panel stops being a list. It becomes a picture of *their* home: the plan's outline (from the floor-plan reading, or a schematic for their BHK), rooms filling with the palette and materials of the photos they pick, household icons appearing, and the possession date pinned to it. By the last screen they are looking at their home, not a form. *Phase 1–4.*
2. **The reveal, counted down with real numbers.** *"Verified studios in Pune: 18 → at Premium: 7 → do kitchens and wardrobes: 5 → work in East Pune: 4 → for you, Sanyam."* Each number counts in (the Count motion). It is the filter shown working, which is exactly the evidence the brand runs on. *Phase 4.*
3. **Swipe your style.** On a phone the style photos become cards: right for love, left for not-for-me, up for never. Twenty swipes take under a minute and carry far more signal than "pick three". Buttons and keys do the same on a laptop. *Phase 4.*
4. **Your Style DNA.** A card at the end of the taste chapter: their styles as shares ("Warm Modern 45% · Japandi 30% · Indian Contemporary 25%"), a five-colour palette and three materials drawn from what they loved. One tap shares it to WhatsApp — delight for them, reach for us. *Phase 4.*
5. **Built in 9.6 seconds.** The quote build shows a live stopwatch and what it is doing — reading the plan, counting 38 lines, pricing on each studio's own rates — so "quotation in 10 seconds" is something they watch happen. *Phase 2.*
6. **Walk the quote, room by room.** The quote opens as their floor plan: tap the kitchen to see its lines, materials and price. *Phase 2.* The 3D view is **paused** — the owner is building a separate 3D design tool, which becomes part of the customer portal (§10) when it is ready.
7. **Materials you can almost touch.** Every spec opens a close-up photo, what the cheaper alternative looks like, and the price difference per sq ft. *Phase 5.*
8. **Listen to the comparison.** The comparison summary in their language, read aloud for a parent who would rather hear it. *Phase 5.*
9. **Meet them before you meet them.** A 20–30 second intro video from each studio on its card, and project walkthrough films. The cinematic handover shoot feeds this with consent: every finished project makes the next match more vivid. *Studio profile field; Phase 4.*
10. **Your possession countdown.** "Keys in 84 days" in "Your home", with the plan laid against it — design sign-off by this date, factory by that one, the studio visit with a free cab on Saturday — and a reminder on WhatsApp. *Phase 6.*
11. **Ask your quote.** *"Why is Akara's kitchen ₹60,000 more?"* Answered only from their own numbers, checked the same way as the comparison summary, in their language. *After Phase 5.*
12. **Returning to your home.** *"Welcome back, Sanyam — one new studio fits your brief since Tuesday."* *Phase 4.*
