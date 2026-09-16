# One Interiors — product brief for a UI tool

Paste the relevant part of this into Stitch. It is written to be accurate rather
than flattering: a design tool produces better work from real constraints than
from a pitch, and most of what makes this product distinctive is a constraint.

---

## 1. What the product is

A curated marketplace for interior design in **Pune, India**. A homeowner
answers nine questions about their flat, is matched to verified local design
studios, gets a real indicative quote from each studio's own rate card, compares
them side by side, and then speaks to an in-house expert who arranges the
introduction.

Project values run **₹7 lakh to ₹27 lakh** (roughly $8,000–$32,000). This is the
largest discretionary purchase most Indian households make after the flat
itself. It happens roughly once a decade, it is irreversible, and the buyer has
no basis for judging quality.

**The problem it solves is not discovery.** A Pune homeowner can find forty
studios in an afternoon. What they cannot do is tell which one will still be
answering the phone in month four. Every competitor's complaint corpus reads the
same way: quotes that grew 40%, handover dates that slipped four months,
laminate delivered where veneer was quoted, advances not refunded. None of those
are matching failures — they are execution failures. So the product sells
**certainty**, not taste.

---

## 2. How the business makes money

| Stage | Charge | Notes |
| --- | --- | --- |
| Pilot, months 1–3 | 5% commission on closed projects | Nothing unless it closes |
| Essential tier | ₹25,000/month + 5% | Studios averaging ₹7L projects |
| Premium tier | ₹50,000/month + 5% | Studios averaging ₹12L projects |
| Luxury tier | ₹1,00,000/month + 5% | Studios averaging ₹20L projects |
| Escrow (planned) | 1.75% customer-side | Not yet launched |

**The subscription buys volume — how many briefs a studio is shown for. It never
buys position.** Ranking within a customer's results comes from fit alone. This
is not a nicety; it is the entire differentiation, and it constrains the UI:
there is no "sponsored", no "featured", no "promoted" anywhere.

---

## 3. Who the user is, and what they are feeling

In order, as they move through the flow:

1. **Overwhelm.** Infinite options, no vocabulary. They cannot tell you what
   they want because they do not know the words. → *Constrain choice; teach
   vocabulary through the questions themselves.*
2. **Fear of being cheated.** Universal in India — everyone has heard about the
   contractor who took the advance and vanished. → *Lead with verification and
   money-safety, not with pretty rooms.*
3. **Fear of regret.** They live with this for ten years. → *Reversibility
   signals: "you can change any answer", "quotes are free and non-binding".*
4. **Desire for identity.** The home is a statement to family and neighbours. →
   *This is the only place the emotional register belongs.*

**Nobody makes this decision alone.** A spouse is always involved, often
parents. The second decision-maker is frequently never on the site at all — they
hear about it second-hand over dinner. Any design that helps the first person
explain it to the second is worth more than it looks.

---

## 4. The customer flow, screen by screen

Currently built and live:

1. **Landing.** Names the fear directly — "Nine lakh rupees is a lot to hand to
   a stranger" — then the three-part answer: we check the studio, we show what
   your flat costs, we put a neutral expert on a call. Trust strip: *0% added to
   any quote · 0 calls before you see prices · 12 checks before a studio
   appears.* Also a "How we make money" section, because an unexplained free
   service in India reads as "they're selling my number".

2. **The brief — nine questions, ~3 minutes.** One question per screen, sticky
   footer so the Continue button never scrolls away, header shows *"3 of 9 ·
   about 2 minutes left"* rather than a bare count. A live panel beside the
   questions shows the profile assembling — style keywords appearing, a matching
   studio count updating. Questions: property type + locality + carpet area /
   scope / **budget shown as three priced bands for their own flat** / styles
   they like (images, names revealed only after choosing) / styles they reject
   (a hard filter) / household / priority ranking / involvement level /
   timeline.

3. **Matches.** One **hero studio** at full width with a written sentence
   explaining the match — *"88% match — because you leaned toward Warm Minimalist
   and most of their work sits there; the projects they have actually delivered
   land in your range; they have finished two homes in Baner"* — then the rest
   as alternates below. Each card shows how many factors could actually be
   measured, e.g. "4 of 6 factors measured".

4. **Studio profile.** Their work, a **verification checklist with dates and
   sources** (not a badge), their delivery record *including the bad numbers*,
   and an **instant quote built from that studio's own rate card**, room by
   room, with the modular / non-modular split and everything we had to assume.

5. **Sign-in.** Name, mobile number, WhatsApp OTP. One screen, no password, no
   email. This sits between the matches and the quotes.

6. **Quotes.** All matched studios' numbers together, each as a **range** with
   its spread stated and the single most useful thing that would narrow it.

7. **Compare.** Side by side on identical rows, with a written read of what the
   differences actually mean. Plus a **share link** — a read-only version for
   the spouse who was not on the call.

8. **Talk to an expert.** A request form, showing the customer the brief the
   expert will have already read.

9. **Prepare for the call.** Where they go after booking, so the confirmation is
   not a dead end. Covered in full in §5 — it is the newest surface and the one
   most worth designing.

---

## 5. The prep pack — the newest screen, and the one to design

### The problem

The confirmation screen used to say *"We'll call you"* and stop. That is a dead
end at the single highest-intent moment in the funnel: they have just handed
over a phone number and asked for help, and we give them a page with nothing on
it. Someone about to spend nine lakh rupees does not sit still — they go and
fill in two more forms elsewhere. A call is typically **one working day** away,
so the gap is real.

So they now land on `/prepare`, and everything in it makes their own call
better. That is the only honest reason to offer it.

### What we took from Planner5D, and what we rejected

Planner5D's onboarding is three questions — room shape, room dimensions, room
type and style — and then it **generates a furnished room for you**. There is a
Shuffle button. At no point does it ask a person with no design training to
design something. That mechanic is why a hundred million people got through it,
and it is the one thing worth taking.

**We deliberately did not build the 3D planner.** Two reasons, and a designer
working on this needs both:

- Modsy raised $73M building exactly this and shut down.
- More importantly, **an open canvas works against the product's entire
  argument.** Hand someone eight thousand furniture items and they will design a
  home their budget cannot buy. Every hour they spend on it makes the first ten
  minutes of the expert call *worse*, because the call now has to open by taking
  it away from them. It manufactures a disappointment and then charges us the
  engineering months to build it.

**We also rejected importing Pinterest.** Almost every customer already has a
board, and it is the highest-signal artefact they own — but it is aspirational
by construction, and Pinterest cannot tell anyone what a board costs, because it
has no idea what they have. Importing it imports the disappointment. We do know
what they have, so we build the board here instead.

### The three parts, in order

1. **Floor plan, first.** A PDF or a photo of the printed sheet, plus their real
   carpet area. It goes first because it is the only slightly-chore-like part
   and attention is highest at the top. It is the one place on the page that
   states a payoff: *"Right now every quote is a ±25% band. With the plan and
   your real carpet area it narrows to ±11%."* **Those numbers are computed from
   that customer's own brief by the same estimator that draws their quote band**
   — they are not marketing copy, and the sentence is suppressed entirely when
   the gain is under two points.

2. **The board, room by room.** Rooms are derived from their property type and
   scope — a 3 BHK full-home customer gets living, kitchen, three bedrooms,
   bathrooms, balcony; a kitchen-and-wardrobes customer gets a kitchen and
   bedrooms and no balcony. **Every room carries its share of the budget from
   the first screen**, split the way a Pune fit-out usually falls. The kitchen
   share surprises almost everyone, and learning that here is far better than
   learning it on the call.

   Each room offers a **curated catalogue of ~46 elements** — floors and
   counters, shutters and storage, furniture, lighting, fabric, walls — written
   for Pune specifically, so wood-look tile is essential-band and engineered
   wood is premium, which is the opposite of how a European catalogue ranks
   them. Every element carries a budget band, style tags, and a sentence that
   teaches something rather than sells: *"Acrylic shows every fingerprint —
   people love it or regret it within a month."*

   **The board starts pre-filled, never blank.** Four in-band items, one per
   category, seeded from their liked styles. That is the real Planner5D lesson:
   a half-built board asks "is this right?" instead of "what do you want?", and
   anyone can answer the first. Everything seeded is removable, so they remain
   the author.

3. **One decision per room, and a note.** Each room names the single choice that
   actually moves the number — kitchen shutter finish, how much of the living
   room is carpentry, wardrobe type — with two or three options marked ₹ / ₹₹ /
   ₹₹₹. Tapping a chosen option again clears it, because *"I don't know yet"* is
   a real answer the expert wants to see. Plus a free-text note per room, which
   is the single most valuable thing the expert reads before dialling.

### The feature Pinterest structurally cannot have

**The board tells them what it costs.** When a third or more of a board sits
above the band they chose, the page says so — once, plainly, and without
scolding. Items above band are **shown and marked, never hidden**: a filtered
catalogue reads as thin and people notice, and wanting the marble is legitimate.
Plenty of good projects start above band and get negotiated down on purpose.
What must not happen is someone discovering the cost in month two. They can have
it; they just cannot have it *by accident*.

The assembled board at the bottom of the page reads across **all** rooms,
because one marble counter is an indulgence and the same choice in six rooms is
a budget conversation — only that view can see the difference.

### Where it goes

The whole thing lands on the ops console before the expert dials, with
above-band items coloured. That round trip is the actual feature; the page on
its own is a toy.

### Constraints specific to this screen

- **It is never a gate.** Nobody has to do any of it to get their call, nothing
  is scored, and a customer who does none of it must not be treated differently
  from one who does it all. The moment it decides who gets served first it stops
  being preparation and becomes a qualification test.
- **No progress bar, no percentage, no checklist.** The assembled board filling
  in *is* the progress indicator. Anything else reads as marking their homework.
- **Nothing here is binding** and the page says so. A room marked one way today
  is a conversation on the call, not a commitment.
- **The floor plan is private.** Not a public URL, never sent to a studio they
  have not chosen, deletable on request. It is the layout of their home, usually
  with the flat number on it.
- **No photography exists yet.** Every tile is a drawn SVG generated from a
  material palette. A drawing that is honestly a drawing beats a stock photo
  pretending to be someone's work — but it loses to a real Pune kitchen at the
  customer's own budget, which is the upgrade the moment pilot studios hand over
  project photos.

---

## 6. Rules that constrain the design

These are not preferences. Breaking any of them breaks the product's argument.

- **There is no "contact this studio" button anywhere.** Every introduction runs
  through an expert call. That is the quality control and it is what the fee is
  for.
- **Quotes are always ranges, never single numbers**, because nobody has visited
  the flat. Every quote shows its own assumptions.
- **Publish the unflattering numbers.** Average days past the committed date,
  disputes upheld. That is the whole trust proposition.
- **Never fabricate social proof.** There are zero completed projects and zero
  reviews. No star ratings, no "most popular", no testimonials.
- **Absent data renders as the reason, not as zero.** "Not enough data yet"
  rather than "0%" — a studio with no delivery record must not look like a
  studio with a terrible one.
- **No studio can pay for placement**, so no sponsored slots or promoted cards.
- **The prep pack is never a gate and never scored** — see §5.
- **Indian number formatting throughout** — ₹8,50,000 with lakh grouping, not
  ₹850,000. Get this wrong and the product reads as foreign.

---

## 7. Visual language as built

- **Ground** warm cream `#FDF9F2` · **primary** petrol `#1A6068` · accents
  terracotta `#BC6440` and brass `#C9922A` · ink `#2A2622`
- **Type** Instrument Serif for display, Public Sans for interface, IBM Plex
  Mono for figures and labels
- **The split that matters:** discovery surfaces (landing, brief, style reveal)
  are **warm** — cream, soft tiles, conversational. Money surfaces (quotes,
  comparison, milestones) are **institutional** — tabular figures, dated
  evidence, no warmth. A customer about to release ₹2 lakh wants a receipt, not
  a mood; warmth over a payment screen reads as manipulation to an audience
  already primed to expect it.
- Light theme only, by decision.
- Semantic states carry **shape as well as colour** — roughly 8% of male users
  cannot reliably separate red from green.

---

## 8. What to actually ask Stitch for

The flow works. These are the places where better design would move a number,
roughly in order of value:

1. **The studio's own dashboard.** Almost nothing exists — once a studio is
   live, their home page is still an onboarding checklist. They pay ₹25k–₹1L a
   month for volume and cannot see the volume. Needs: briefs they appeared in,
   where they ranked and why, *including the losses*, quotes generated from
   their rates, and consultations requested. This is the biggest gap in the
   product.

2. **The prep pack (§5) — the most design-shaped ask on this list.** It is the
   newest surface, it is the most visual, and it is the only one where the
   *look* of the thing is the product rather than a wrapper around a number.
   Three specific problems:

   - **The catalogue tiles.** Forty-six elements drawn as SVG from eight forms
     and a three-colour palette each. Eight forms across forty-six items means a
     six-tile board can read as repetitive. Either better forms, or a visual
     system that makes repetition feel deliberate.
   - **The assembled board.** It has to survive being looked at cold, by a
     spouse, with no explanation — which is why each room keeps its name and its
     budget share rather than becoming an anonymous grid of swatches. It should
     feel like something you would screenshot.
   - **Picker density.** A room offers 20–30 elements, each with a tile, a
     label, a band flag and a teaching sentence. That is a lot of card, and it
     currently lives inside an expanding panel inside a room card inside a page.
     The nesting is the weakest part of the build.

3. **Question 4 — the style picker.** Currently a grid of room images, pick two
   or three. A binary "which of these two" repeated three times would be lower
   effort and would yield a ranked preference instead of an unordered set.

4. **The comparison table.** It renders all eleven cost categories. Research
   says people cannot hold more than 5–7 rows across tiers. It should lead with
   the categories that actually differ for *this* customer and collapse the
   rest — and the studio names and totals should stay pinned while scrolling.

5. **The quote card.** How to present a range honestly without it reading as
   evasion, given a competitor's confident wrong number is more persuasive than
   our honest band.

6. **Mobile.** Most Pune homeowners will do this on a phone, on mobile data. The
   comparison table has no good mobile answer yet, and neither does the prep
   pack's picker — a grid of tiles with teaching text under each is a desktop
   pattern, and this is a screen people will open in bed the night before their
   call.

**Ask it to design against the emotional states in §3**, not against a generic
e-commerce funnel. The brief is not a checkout. The comparison is not a pricing
page.
