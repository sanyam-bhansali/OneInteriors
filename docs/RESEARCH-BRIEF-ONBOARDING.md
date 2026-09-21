# Research brief — supply-side onboarding flows

**Hand this whole file to the Claude that has Chrome access.** It is written to
be self-contained.

---

## Who you are working for

One Interiors is a curated marketplace for interior design in Pune, India.
Two sides: homeowners who want their flat done, and interior design studios
who do the work. The studio side is the supply, and it is what this research
is about.

A studio's journey today:

1. Applies at `studio.oneinteriors.in/apply`
2. Ops reviews the application by hand and approves or rejects
3. Approved studio gets an email with a sign-in link
4. Redeems it, sets a password
5. **Five onboarding steps, about forty minutes:** profile and localities ·
   registration numbers · three completed projects · their rate card ·
   submit for review
6. We then verify fifteen things — registration, GST filing history,
   references we ring, two finished sites we visit in person. **About two
   weeks.**
7. They go live on the roster
8. Eventually: a homeowner's brief matches them, a quote is generated from
   their rate card, the homeowner picks them, and we make an introduction

**The problem, stated as one number.** Time from "I was approved" to "I have
seen something that makes me glad I did this" is about **two weeks**. Forty
minutes of typing, then silence.

Scale matters for what advice is realistic: we are onboarding roughly **ten
studios**, not ten thousand. High-touch answers are affordable here.

---

## The question this research answers

> **How do marketplaces get a supply-side professional through a long, boring,
> compliance-heavy setup — and keep them engaged across a verification wait
> they cannot shorten?**

Everything you record should serve that. A beautiful illustration on screen
two is not interesting. Where the first win lands, and what they do about the
gap, is the whole point.

---

## Flows to walk, in priority order

Do them in order. If you run out of time, the early ones matter most.

### Tier 1 — closest analogues: curated marketplaces that vet their supply

1. **Houzz Pro** (`pro.houzz.com`) — interior design specifically. The single
   most relevant product in existence to this question.
2. **Bark** (`bark.com/en/gb/sell/`) — services marketplace, professional side.
3. **Toptal** (`toptal.com/talent/apply`) — heavily screened, explicitly
   rejects most applicants. Closest to "we verify you before you appear."
4. **Upwork** freelancer signup — profile-completeness mechanics, and how they
   gate visibility on it.

### Tier 2 — long verification before the product works

5. **Stripe** (`dashboard.stripe.com/register`) — test mode lets you use
   everything before activation clears. The known best answer to our problem.
6. **Shopify** — trial first, payment setup later.
7. **Airbnb Host** (`airbnb.com/host/homes`) — save and resume across days, and
   an unusually good progress model.

### Tier 3 — India, and the trades

8. **Urban Company partner** (`partner.urbancompany.com` or the app) — how an
   Indian marketplace onboards a trade professional. Different assumptions
   about literacy, phone-first, language.
9. **IndiaMART or JustDial supplier signup** — **study this as the
   anti-pattern.** It is what our studios have been burned by, and naming what
   is wrong with it precisely is useful to us.

### Tier 4 — marketplace sellers

10. **Etsy** seller onboarding — "open your shop, then fill it."
11. **Fiverr** seller onboarding — gig-first ordering.

---

## Rules while you work

**Do not create accounts, and do not enter passwords.** Walk as far as the
public flow goes. Where a wall stops you, say so and record what was visible
up to that point — that is still useful data.

**If the user is present and willing to sign up themselves**, ask them. Many
of these flows only reveal their structure after the wall, and the user's own
account is the legitimate way through.

**Never enter real payment details, government ID numbers, or anything
belonging to a real business.**

**Where you are geo-blocked from India** (Thumbtack does this), note it and
move on. Do not work around it.

---

## What to record — the same fields for every flow

Use this structure for each product, so the reports can be compared
side by side. Be concrete. "Asks for business details" is useless; "asks for
legal entity name, GSTIN, and year founded, all required, on screen 3" is
what we need.

```
## <Product name>

**Entry point:** the URL, and what the page promised before signup
**How far I got:** all the way / stopped at <wall>

### The screens, in order
1. <what it asks> — required? / skippable? — <any reason they give>
2. ...
(continue for every screen, including interstitials and confirmations)

**Where account creation sits:** which screen number, and what they had
already shown you before asking

**The first win:** what is the first moment the professional sees something
they actually wanted, and on which screen? If it never happens in the flow,
say so.

**Handling the wait:** if there is a review or verification period — how long
do they say it takes, what can you do meanwhile, what do they send you, how
often?

**Progress:** bar / steps / checklist / percentage / none. Is it honest —
does it match how much work is really left?

**Save and resume:** can you leave and come back? Is that told to you upfront
or discovered?

**Deferred to later:** what they let you skip now and ask for after you are
in. This is the most useful field in the whole form.

**Escape hatches:** what happens to somebody who cannot meet a requirement
yet — a new business, no registration number, no portfolio. Dead end, or a
path?

**What they deliberately do NOT ask:** anything conspicuously absent that you
would have expected.

**Copy worth stealing:** quote verbatim, two or three lines maximum. Especially
how they justify a hard ask, or reassure about privacy.

**Best single idea:** one sentence.
**Worst moment:** one sentence — where you would have given up.
```

---

## After the flows: the cross-cutting analysis

Once you have them all, answer these directly. This section matters more than
the individual write-ups.

1. **Where does the first win sit?** Rank every product by how many screens
   until the professional sees something they wanted. Name the fastest and how
   they did it.

2. **Who asks for money/compliance data early and who defers it?** What do the
   deferrers do instead, and does it seem to work?

3. **The verification wait.** Of the products that have one — what is the best
   thing any of them does while the applicant waits? Be specific.

4. **The unqualified applicant.** Which products have a real path for someone
   who does not meet the bar yet, and what does it look like? (This is a live
   problem for us: our portfolio step demands three completed projects with no
   escape hatch, so a young practice gets approved and then hits a wall.)

5. **Linear or not?** Who forces an order, who lets you pick, and did the
   non-linear ones feel worse or better?

6. **What did NONE of them do** that you think would have helped? Original
   observation welcome here.

---

## Explicitly not interesting

Skip these. They are consumer-mobile patterns that do not transfer to a
business owner deciding whether we are worth their Tuesday.

- Illustration carousels and welcome slideshows
- Confetti, streaks, badges, micro-rewards
- "Personalise your experience" quizzes that change nothing downstream
- Push-notification permission priming
- Paywall placement and pricing-page design

Also ignore anything about **reducing the number of steps as an end in
itself.** Our verification is the product, not friction to be minimised. We
are not looking for permission to check less — we are looking for how to make
the checking feel like the thing that earns a studio their price.

---

## What we will do with this

The report feeds a rebuild of the five-step onboarding. Two things already on
the table, which your findings should confirm or kill:

- **Show real matching briefs before the form** — "three briefs from Baner
  this month, you would have matched all three" — to move the first win from
  week two to minute one.
- **Replace the wizard with a board of cards**, since our step state is
  already derived from the data rather than from a step pointer, and nothing
  actually enforces the order.

If the research says either is wrong, say so plainly. A confident "the
evidence points the other way" is worth more than agreement.

---

## Output

One markdown file. Per-flow records first, cross-cutting analysis second, and
a short final section: **the five changes you would make to One Interiors'
studio onboarding, in priority order, with the flow each is borrowed from.**

Be concrete enough to build from. "Improve the empty state" is not
actionable; "on the clients board, show a sample lead marked as sample,
excluded from counts, removable in one click — like Stripe's test-mode data"
is.
