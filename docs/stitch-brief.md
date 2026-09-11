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

---

## 5. Rules that constrain the design

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
- **Indian number formatting throughout** — ₹8,50,000 with lakh grouping, not
  ₹850,000. Get this wrong and the product reads as foreign.

---

## 6. Visual language as built

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

## 7. What to actually ask Stitch for

The flow works. These are the places where better design would move a number,
roughly in order of value:

1. **The studio's own dashboard.** Almost nothing exists — once a studio is
   live, their home page is still an onboarding checklist. They pay ₹25k–₹1L a
   month for volume and cannot see the volume. Needs: briefs they appeared in,
   where they ranked and why, *including the losses*, quotes generated from
   their rates, and consultations requested. This is the biggest gap in the
   product.

2. **Question 4 — the style picker.** Currently a grid of room images, pick two
   or three. A binary "which of these two" repeated three times would be lower
   effort and would yield a ranked preference instead of an unordered set.

3. **The comparison table.** It renders all eleven cost categories. Research
   says people cannot hold more than 5–7 rows across tiers. It should lead with
   the categories that actually differ for *this* customer and collapse the
   rest — and the studio names and totals should stay pinned while scrolling.

4. **The quote card.** How to present a range honestly without it reading as
   evasion, given a competitor's confident wrong number is more persuasive than
   our honest band.

5. **Mobile.** Most Pune homeowners will do this on a phone, on mobile data. The
   comparison table in particular has no good mobile answer yet.

**Ask it to design against the emotional states in §3**, not against a generic
e-commerce funnel. The brief is not a checkout. The comparison is not a pricing
page.
