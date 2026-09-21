# Supply-side onboarding: what eleven marketplaces do, and what One Interiors should take from them

> **Source.** Produced 21 September 2026 by a second Claude with Chrome access,
> working from `docs/RESEARCH-BRIEF-ONBOARDING.md`, walking each flow by hand in
> a real signed-in browser. Reproduced verbatim below.
>
> **My reading of it — including the one recommendation we cannot honestly build
> yet — is in `docs/ONBOARDING-PLAN.md`.** Read that second.

---

## Before anything: what could and couldn't be seen

No accounts were created and no passwords entered. That is a real limit and it
falls unevenly. Four of these products put account creation on screen one, so
their onboarding proper is invisible from outside. Where that happened it is
said so, and not guessed.

| Product | How far I got |
|---|---|
| Houzz Pro | Marketing + pricing in full; **wall at screen 1** (account creation) |
| Bark | **Three screens deep**, stopped at the details form that creates the account |
| Toptal | Wall at screen 1; **full screening process published** on their own site |
| Upwork | Two screens; profile builder behind the wall |
| Stripe | Wall at screen 1; **post-signup structure documented** in their public docs |
| Shopify | Wall at email capture |
| Airbnb Host | Pre-signup page in full, including the earnings model; listing wizard behind login |
| Urban Company | **Entire public flow** — it is one field |
| IndiaMART | Marketing + their own published step list; wall at OTP |
| Etsy | Marketing + **full published fee schedule and step list**; wizard behind sign-in |
| Fiverr | Wall at screen 1 |
| Mobbin | **Paywalled.** See below. |
| Dribbble | Browsed; treated as unvalidated concept art per the brief |

**Mobbin did not work, and not because of the 403.** The session signs in fine.
The library itself is behind Pro at ₹800/month. The index is visible — 630 web
onboarding flows, with names and screen counts (Remote 25 screens, Airbnb 16,
Shopify 10, folk 19, Attio 21) — and every screen is locked. The MCP connector
returns the same: *"Mobbin MCP requires a paid plan."* The mobile URL lands on
the same wall.

Worth knowing: the DesignerUp article says plainly that its 200 flows were
studied *through Mobbin*. So that article is a secondhand read of the same
library that could not be opened, filtered through a consumer-app lens. Only
the two bits of it that survive the studio-owner test are used; the rest is
ignored.

---

# Part one: the flows

## Houzz Pro

**Entry point:** `pro.houzz.com` — which, signed out, redirects straight to a
login screen. There is no marketing there at all. The real entry is
`houzz.com/houzz-pro/pricing`, which promises software, not clients: Design
$99/mo, Pro $199/mo, Teams from $399/mo, and an advertising package from
$499/mo, described as "Stand out to local, hiring homeowners with targeted ads."

**How far I got:** stopped at account creation, screen 1.

### The screens, in order

1. Pricing page. Full feature comparison table, open, no gate. An ROI calculator
   that asserts a number before you have given them anything — "Your potential
   annual revenue increase $195,721 / 39%" — with "Image above shown for
   illustration purposes only."
2. "Try Houzz Pro for Free — No credit card required" → **account creation.**
   Email + password, or Google. Required.

**Where account creation sits:** screen 1 of the flow proper. They showed you
pricing and a feature matrix first, and nothing about you or your business.

**The first win:** not in the flow that could be seen. After account creation,
the free plan gives 3D Floor Planner, Estimates and Invoicing — tools, not
clients. The win is "I made a thing," not "someone wants me."

**Handling the wait:** there is no wait, because there is no verification.
Anyone can be a Houzz Pro. This is the most important single fact about the most
relevant product in existence to this question: **the category leader in
interior design does not vet its supply at all.** It sells software and
advertising to professionals and leaves the quality judgement entirely to the
homeowner reading reviews.

**Deferred to later:** everything. No business details, no registration numbers,
no portfolio, no rate card before you are inside.

**Escape hatches:** the whole product is an escape hatch. A brand-new practice
with no projects can be a Houzz Pro today.

**What they deliberately do NOT ask:** any proof of anything. No licence, no
insurance, no references, no completed work.

**Copy worth stealing:** "Just getting started? Explore tools with our Free
Plan." — a permanent, dignified door for the unqualified, placed directly under
the paid tiers rather than hidden.

**Best single idea:** separate the tool from the listing, so the professional
gets value on day one from software they'd want anyway, independent of whether
any client ever arrives.

**Worst moment:** typing a URL that says "pro" and landing on a login box.
Signed-out pros are treated as lapsed users, not prospects.

---

## Bark

**Entry point:** `bark.com/en/gb/sellers/create/`. Promise: "Secure jobs and grow
your business / 1000's of local and remote clients are already waiting for your
services." Three columns, each answering a different objection: *Get quality
leads* (review leads **for free**), *Win new clients*, *Grow your business*
("Keep 100% of what you earn — no commission or hidden fees").

**How far I got:** three screens, stopped at the form that creates the account.

### The screens, in order

1. **"What service do you provide?"** — a typeahead, required, nothing else on
   the screen. Typing "Interior Design" offers Residential Interior Designers,
   Commercial Interior Designers, Home Staging, Exterior Painting, Picture
   Hanging and Art Installation, Bathroom Accessibility Adaptation.
2. **"Where would you like to see leads from?"** — subtitle "Tell us the area
   you cover so we can show you leads for your location." A radius dropdown (30
   miles, default) and a postcode. One checkbox, pre-ticked: "Show me leads
   outside this area that I could service online or remotely." Reassurance under
   it: "You can change your location at any time."
3. **"Some details about you"** — headed "You're just a few steps away from
   viewing our Residential Interior Designers leads." Name, company name, email,
   phone, does the company have a website (Y/N), company size (Self-employed/Sole
   trader · 2–10 · 11–50 · 51–200 · 200+), sales team (Y/N), social media (Y/N).

**Where account creation sits:** screen 3, after they know what you do and where.
They have already narrowed the world to your trade and your radius before asking
who you are — so by the time you type your name, the thing on the other side is
specific to you.

**The first win: screen zero, and it is the best thing in this entire research.**
On the marketing page, before any input, there is a button reading **"See an
example lead."** It opens a real-shaped brief — not a screenshot, not a
testimonial, the actual question-and-answer object a pro would buy:

> What is your gender? *Female* · What is your age? *60 or older* · Do you have a
> preference for the gender of the trainer? *It doesn't matter* · How frequently
> do you want your sessions? *I'm not sure yet* · How would you describe your
> current exercise regime? *I am unable due to my knees* · What are your goals?
> *Get my body strength up again* · Which location(s) would you consider? *Home*
> · Do you have any day preference(s)? *Any day* · Do you have any time
> preference(s)? *Morning (9am–noon), Early afternoon (noon–3pm)*

Read that as a professional. You are not being told the leads are good; you are
being handed one and left to judge. The messy human answers ("I am unable due to
my knees") do more work than any statistic on the page.

**Handling the wait:** there is none. No vetting. Bark monetises by charging to
unlock a lead's contact details, so their incentive is to get you to leads fast
and let volume sort quality out.

**Progress:** none shown. Three screens, no stepper — defensible at this length.

**Deferred to later:** everything about credentials. Nothing is asked about
qualifications, insurance, or past work at any point reachable.

**Escape hatches:** the single best line of microcopy found anywhere in this
research, sitting under the Company name field:

> "If you aren't a business or don't have this information, you can leave this
> blank"

**What they deliberately do NOT ask:** a portfolio. For a trade where the work is
visual, that is a loud omission — and it is the tell that Bark sells
introductions, not curation.

**Copy worth stealing:** "You're just a few steps away from viewing our
Residential Interior Designers leads." The category name is echoed back
verbatim. It is not "our leads," it is *your* leads, named.

**Best single idea:** publish a full example of the demand, unedited, before
asking for anything.

**Worst moment:** screen 3 asks whether you have a sales team and whether you use
social media. Those are questions for Bark's sales qualification, not for your
listing, and a busy owner can feel it.

---

## Toptal

**Entry point:** `toptal.com/talent/apply`. "Apply to Join the World's Top Talent
Network."

**How far I got:** wall at screen 1.

1. **Account creation.** Sign up with LinkedIn, or: role ("I'm applying as…"),
   full name, e-mail, password, confirm password. Required, all of it, before
   anything.

**The first win:** never, in the flow. The reward is admission itself, three to
eight weeks out.

**Handling the wait — and this is why Toptal is on the list.** They publish the
whole thing at `toptal.com/top-3-percent`, in advance, to people who have not
applied:

- the odds: "Of the thousands of applications Toptal sees each month, typically
  fewer than 3% are accepted."
- the duration: "The full screening process takes between 3-8 weeks to complete."
- all five stages by name: Language and Personality → In-Depth Skill Review →
  Live Screening → Test Projects → Continued Excellence.
- what the heavy stage actually costs you: test projects "take 1-3 weeks."
- and an honest hedge: "The screening process may vary or be changed as needed at
  the company's discretion."

**The structural insight is bigger than the transparency, though.** Toptal's wait
is not a wait. Across those 3–8 weeks the applicant is *doing things* — an
interview, assessments, a live screening, a multi-week test project. There is no
dead air to fill because the vetting is the activity. Compare One Interiors' two
weeks: you are working, they are idle. **That asymmetry, not the duration, is the
actual problem.**

**What they deliberately do NOT ask:** money. Nothing about rates, billing or
bank details appears anywhere near the application.

**Copy worth stealing:**

> "Each candidate is assigned a test project to evaluate whether they can 'walk
> the walk.' Test projects take 1-3 weeks are comprehensive and provide
> real-world scenarios for candidates to demonstrate their competence,
> thoroughness, professionalism, and integrity."

The hard ask is justified by naming what it proves. Nobody resents a test that is
explained as a chance to show something.

**Best single idea:** publish the odds and the duration before the application,
so the difficulty reads as prestige rather than bureaucracy.

**Worst moment:** the apply page itself, which shows nothing and asks for a
password immediately. All the persuasive material lives on a page you have to
find.

---

## Upwork

**Entry point:** `upwork.com/nx/signup`. **How far I got:** two screens.

1. "Welcome to Upwork / Which describes you best?" Two cards: **Client** (Post
   jobs and hire) · **Freelancer** (Work and get paid). A side-choice, nothing
   else.
2. **Account creation** (email, Google, Apple).

`/nx/create-profile` redirects to login, so the profile builder and its
completeness mechanics are entirely behind the wall. Upwork's completeness
percentage is not described here, because it was not seen.

**Best single idea (of what was seen):** asking which side you're on before
anything else. A studio and a homeowner should never see the same first screen,
and a two-card split costs one tap.

**Worst moment:** clicking the Freelancer card did nothing visible on first
attempt — the choice that defines the entire rest of the product had no feedback.

---

## Stripe

**Entry point:** `dashboard.stripe.com/register`. **How far I got:** wall at
screen 1 (password).

1. **Account creation** — email, full name, password, country. **But look at what
   is behind the modal.** The page renders a complete, populated Stripe
   dashboard: Today / Net Volume 406.39, USD Balance 9,257.51 "Available to pay
   out," Payouts 11,633.07 "Expected today," Gross volume +86.4%, a payments
   breakdown of succeeded / uncaptured / refunded / failed, charts with real
   shapes. Faded, unlabelled, not interactive — and unmistakably the thing you
   are signing up to own.

**The first win:** immediately after signup, and it is the whole product. From
their docs: *"After creating a Stripe account, you can test Stripe services in a
sandbox. To use a service in live mode, verify your business and complete its
activation requirements."* You build, you integrate, you watch test payments
succeed. Only the movement of real money waits on verification.

**Handling the wait:** by making the wait irrelevant to everything except the one
thing it must block. There is an explicit **"account checklist"** — their word,
in the docs — not a wizard.

**Deferred to later:** all of KYC. Business details, ownership, bank account —
none of it is needed to start.

**Escape hatches:** test mode *is* the escape hatch. Not ready to be verified?
Build anyway.

**Copy worth stealing** — how they justify the most intrusive ask in the product:

> "Our 'Know Your Customer' (KYC) obligations require us to collect and maintain
> this information for all users. Regulators and financial partners require it to
> help prevent financial-system abuse. We review it for compliance with our
> services agreement and contact you if we need anything else."

Three moves in four sentences: name the obligation, name who imposes it, promise
to come back to you. And separately, irreversible choices are flagged *before*
they are made: "After activating a Stripe service on a live account, you can't
change the business origin country."

**Best single idea:** split the product into the part that can run unverified and
the part that cannot, then ship the first part on day one.

**Worst moment:** a password field as the very first interaction, with the good
stuff greyed out behind it.

---

## Shopify

**Entry point:** `shopify.com/in/free-trial`. "Start for free, keep building for
₹20/month." **How far I got:** email capture.

Same architecture as Stripe, less instructive: a working store exists within
minutes, payment processing and business details come later. Fees and credits are
stated on the entry page. The store-setup questionnaire is behind the email gate
and was not walked.

**Best single idea:** the trial is a real store, not a demo.

---

## Airbnb Host

**Entry point:** `airbnb.co.in/host/homes`. **How far I got:** the full
pre-signup page; the listing wizard is behind login.

0. **An earnings estimate, before any input and before any account.** It animates
   up on an odometer: **"Your home could make ₹24,868 on Airbnb."** Underneath, an
   adjustable nights slider (defaulting to 1 night at ₹3,553/night), and — this
   is the part that matters — it has already guessed the situation from location:
   **"Pune · Entire place · 2 bedrooms."** Next to the number: "Learn how we
   estimate earnings." The number is defended, not merely asserted.
1. Three reassurance blocks, each aimed at a distinct fear: *It's easy* ("Create
   a listing in just a few steps, and get 1:1 support from experienced hosts at
   any time") · *It's worth it* ("Getting started is free. You set your price, and
   we only collect a fee after you've got paid") · *You're protected*.
2. "Get started" → login wall.

**Where account creation sits:** after the money conversation is finished.

**The first win:** screen zero, four seconds in, personalised to the city, with
no data entered.

**Escape hatches, and these are unusually good:** two separate human doors offered
*before* signup. "Curious about hosting? Get helpful tips from Airbnb
specialists. Let's talk." And at the bottom: "Still have questions? Get answers
from an experienced local host. Ask a host." One is staff, one is a peer. A
nervous 45-year-old gets a person, not a chatbot.

**Copy worth stealing:** "It's free to create a listing, and Airbnb typically
collects a service fee of 3% of the reservation subtotal once you get paid." The
fee is stated as a sentence a person would say, on the page where you decide.

**Best single idea:** compute the value of joining, for *this specific person's
city and property*, before asking for a single field.

**Worst moment:** "Get started" dumps you into a bare login box with none of that
context carried through.

---

## Urban Company (partner)

**Entry point:** `partner.urbancompany.com`. Headline: **"Earn More. Earn
Respect. Safety Ensured."** Sub: "Join 50,000+ service professionals across India,
KSA, Singapore, UAE."

**How far I got:** the entire public flow, which is one screen.

1. City selector, a `+91` phone field, and a button reading "Join Us". Microcopy:
   **"Share your WhatsApp number and we'll reach out via our WhatsApp Business
   Account."** That is the whole thing.

**Where account creation sits:** there isn't one. There is a phone number and
then a human conversation.

**Handling the wait:** entirely off-platform, by humans, on WhatsApp.

**What the page reveals about its audience:** the value proposition is ordered
money → **respect** → safety, and the footer carries a "Service Professionals
Welfare Policy," an "Anti Discrimination Policy," and a "Community" link. Those
are trust signals pointed at the *worker*. Urban Company understands that its
supply side is deciding whether this platform will treat them as a person.

**Best single idea:** for Indian supply-side onboarding, the form is not the
channel. WhatsApp is.

**Worst moment:** nothing to evaluate. A cautious professional has no way to judge
the offer before surrendering a phone number to a sales process — the exact
opposite of Bark's example lead.

---

## IndiaMART — the anti-pattern, named precisely

**Entry point:** `seller.indiamart.com`. "Sell for free on India's largest online
B2B marketplace." Scale first: 23.4 crore+ buyers, 88 lakh+ suppliers, 13.2
crore+ products. **How far I got:** wall at phone OTP; their own published steps
fill in the rest.

> **"Get a free listing in 3 simple steps"**
> 1. **Create Account** — "Add your name and phone number to get started"
> 2. **Add Business** — "Add name, address & e-mail of your company, store/
>    business"
> 3. **Add Products/ Services** — "Minimum 3 products/ services needed for your
>    free listing page"
>
> "Start selling for free. It only takes 5 minutes."

**What is actually wrong with it — five things, specifically:**

1. **There is no verification step anywhere.** Eighty-eight lakh suppliers, zero
   checks. Presence on IndiaMART is therefore information-free: it tells a buyer
   that someone completed a five-minute form. Your studios have been burned not
   by the form but by what the form *means*.
2. **The product sold to the supplier is rank, not demand.** The IndiaMART
   Advantage Program offers "Higher Visibility — Get higher listing on IndiaMART,
   appear on top of search results," and "Additional Leads — Choose from a list of
   **verified** orders." Read that last word carefully: "verified" is a paid
   upgrade applied to *orders*. Unverified leads are the default product.
3. **That inverts the incentive.** When rank is purchasable and quality is
   unchecked, the rational supplier move is to spend on placement rather than on
   being good. Every honest studio on the platform is competing against a budget.
4. **The minimum-three-products rule is IndiaMART's version of the
   three-completed-projects rule** — and it is the cautionary version. It gates
   only the free listing page, nobody inspects the three, and it exists to stop
   pages looking empty. A requirement that nobody checks is worse than no
   requirement: it costs the honest applicant forty minutes and buys the buyer
   nothing.
5. **"Architecture & Interiors" appears in a flat list of sixty-odd categories**
   between "R&D and Testing Labs" and "HR Planning & Recruitment." The studio is a
   row in a directory.

One detail worth sitting with: their headline seller testimonial is an interiors
business — *"Mr Satya Prakash, Owner, Sapphire Interior Solutions Pvt. Ltd."*
This is where your studios already are, and what they already think a marketplace
is.

**Copy worth stealing:** none. But "It only takes 5 minutes" is worth stealing
*the honesty of* — they tell you the cost up front. You ask for forty minutes and
say nothing.

**Worst moment:** the support escalation is a phone number sitting in body text.

---

## Etsy

**Entry point:** `etsy.com/sell`. **How far I got:** marketing in full; wizard
behind sign-in.

**The thing Etsy does that nobody else on this list does: it publishes the entire
fee schedule, itemised, before signup.** ₹19 listing fee (active four months or
until sold), 6.5% transaction, 3–5% + ₹25 processing, 15% Offsite Ads, 2.5%
currency conversion, 0.05% regulatory operating fee — plus a warning that "you
may be charged a one-time shop set-up fee… you will see the amount due before
completing your final shop set-up steps."

And it publishes the steps, in the FAQ, before you begin:

> "Create an Etsy account (if you don't already have one), set your shop location
> and currency, choose a shop name, create a listing, set a payment method (how
> you want to be paid), and finally set a billing method (how you want to pay your
> Etsy fees)."

**Read the order.** The creative, rewarding step — *create a listing* — comes
before the two administrative ones. Payment setup and billing setup are last.
That is a deliberate sequencing choice and it is the opposite of One Interiors':
registration numbers at step two, and showing your work at step three.

**Copy worth stealing:** the seller stories are about lives, not features —
"Sitting down at my workbench to create continues to be my lifeline… that success
is affirming of the bet I made to follow this path at age 45."

**Best single idea:** front-load the total cost of joining so completely that
there is no unpleasant surprise left in the flow.

---

## Fiverr

**Entry point:** `fiverr.com/start_selling`. **How far I got:** wall at screen 1.

**The one thing worth taking:** a line of microcopy directly under the signup
buttons —

> "Additional verification may be required at a later stage."

Eleven words, before commitment, that make every later intrusion non-surprising.
If a studio knows at minute one that site visits and GST checks are coming, the
ask at week two is a confirmation rather than an ambush.

---

## The galleries

### Mobbin — could not read it

Paywalled, as set out at the top. What was visible is an index: 630 web
onboarding flows, most popular first, with screen counts. Two observations
survive even from metadata:

- **The screen counts are large.** Remote 25, Attio 21, folk 19, Airbnb 16,
  Shopify 10. Nobody shipping a serious B2B onboarding is doing it in three
  screens. Five steps are not the problem; how they are sequenced and what they
  are worth is.
- **Airbnb and Shopify are the two in the top five from this set** —
  consumer-adjacent marketplaces with supply-side onboarding — which is consistent
  with them being the two worth studying.

Flows that could not be opened are not characterised.

### Dribbble — concept art, treated as such

Searching "onboarding b2b verification" returns exactly what the brief predicted:
portfolio pieces for invented products — *Veridra — KYC / AML Compliance SaaS*,
*okID Identity Verification Website Design*, *VerifyFlow — Ownership Compliance
Tracker*, *Shufti KYC – Identity Verification UX Case Study*, *Onboarding for
Factoring & Invoice Financing — Stenn*, *B2B SaaS Registration & Business
Onboarding Flow UI - Shopora*.

**Every one of these is unvalidated.** No users, no drop-off data, optimised for a
grid. The only signal worth taking from the set is a negative one: the density of
KYC-and-compliance concept work suggests designers find verification flows
visually interesting, which is a warning. A verification step that *looks*
impressive is not the same as one that makes a studio feel their two weeks were
well spent.

### The DesignerUp article

Its author states the 200 flows were studied via Mobbin, so it is a secondhand
read of the library that could not be opened, and most of its conclusions —
personalisation quizzes, micro-rewards, "tiny dopamine hit," progress bars as
emotional engagement — are exactly what the brief rules out. Its claim that "a bad
onboarding experience can cause up to 80% of people to abandon an app" is
unsourced; treat it as rhetoric.

**Two things in it do survive the studio-owner test.** First, its critique of
Acorns, which is the sharpest sentence in the piece and applies directly to the
forty minutes:

> "One thing I don't love is that you can't pause and finish later. I wish there
> was a notification upfront letting users know they'll need to complete this in
> one sitting."

Second, the "no escape room" principle: a flow that cannot be exited or deferred
reads as a trap to someone whose time has an hourly rate.

---

# Part two: the cross-cutting analysis

## 1. Where does the first win sit?

Ranked by screens until the professional sees something they actually wanted:

| Rank | Product | Screens | What the win is |
|---|---|---|---|
| 1 | **Airbnb Host** | **0** | A rupee figure for *your city and property type*, before any input |
| 1= | **Bark** | **0** | A complete real-shaped client brief, openable from the marketing page |
| 3 | **Stripe** | **0 visually, 1 functionally** | The populated dashboard behind the modal; then the entire product in test mode |
| 4 | **Urban Company** | **1 field** | A human being messages you |
| 5 | **Etsy** | 0 for cost clarity; ~4 for the win | Your first listing, live |
| 6 | **Shopify** | ~1 | A real store exists |
| 7 | **Houzz Pro** | 1 (account) | Tools you'd want anyway — a floor plan, an estimate |
| 8 | **IndiaMART** | 3, "5 minutes" | A listing page — but a hollow win |
| 9 | **Fiverr / Upwork** | Account, then full profile | A first order or invite |
| 10 | **Toptal** | Account, then 3–8 weeks | Admission itself |
| — | **One Interiors today** | 40 minutes + ~2 weeks | The first matched brief |

**The fastest is Airbnb, and the method is the one to copy.** They geolocate,
assume a plausible property, and compute. They don't ask; they guess and let you
correct. The number arrives before the relationship does. Bark ties for first by a
different route — not a computed number but a *specimen*, one unedited lead you
can judge for yourself. Notice that both are cheap: neither requires knowing
anything about the individual.

The honest ranking of One Interiors is last, by an order of magnitude. That is
the finding.

## 2. Who asks for money and compliance data early, and who defers?

**Nobody asks early.** Not one of the eleven asks for bank details, registration
numbers, or tax identifiers before the professional is inside and has seen
something.

- **Stripe** defers the most and has the most reason not to — it is a payments
  company with legal KYC obligations, and it still lets you build for as long as
  you like before verifying. The trick is that it split the product: everything
  works in test mode; only real money needs a verified business.
- **Etsy** defers by sequencing — listing first, payment method and billing method
  last.
- **Toptal** never asks about money during screening at all.
- **Bark** asks for company details at screen 3 but immediately releases the
  pressure: *"If you aren't a business or don't have this information, you can
  leave this blank."*
- **Airbnb** defers everything until after the earnings number.

**What the deferrers do instead** is give the professional something to hold: a
working sandbox, a live listing, a number, a lead. And it works — because the
compliance ask lands on someone who has already invested and already believes,
rather than on a stranger. The cost of the ask hasn't changed; the willingness to
pay it has.

**One Interiors' position:** registration numbers at step two of five, before the
studio has seen a single brief. That is the earliest compliance ask of anything
looked at, and it lands on someone who has been given nothing.

## 3. The verification wait: what is the best thing anyone does?

Only two of these products have a real wait, and they solve it in opposite ways.

**Stripe's answer is to make the wait not matter.** Verification blocks exactly
one thing — live money — and nothing else. Everything a developer wants to do on
day one, they can do on day one.

**Toptal's answer is to make the wait be the work.** The 3–8 weeks are not a
queue; they are a sequence of things the applicant is actively doing. Toptal also
publishes the duration and the odds in advance, so the wait reads as selectivity.

**The best single thing, and the one to take: Stripe's split.** Toptal's model
doesn't transfer cleanly, because One Interiors' verification genuinely is *you*
working — ringing referees, visiting sites — and there is no honest way to make
the studio do that work. But Stripe's question transfers perfectly: *what part of
this product does not actually depend on verification?* Answer: the rate card
working, the quote engine running, the profile existing and being previewable,
matching being computed. All of that can be live for an unverified studio, as long
as no homeowner is introduced.

**And here is what neither of them does:** neither shows the applicant the
verification happening. Stripe hides it; Toptal narrates it in the abstract.
Nobody says "we rang Mrs Kulkarni on Tuesday, she confirmed the Baner project,
here is what she said."

## 4. The unqualified applicant

Three real paths exist in this set:

- **Houzz Pro** — a permanent free tier, positioned under the paid ones: *"Just
  getting started? Explore tools with our Free Plan."* You get the software and a
  profile; you don't get the credibility. The door is honest about what's behind
  it.
- **Bark** — the field-level exemption: *"If you aren't a business or don't have
  this information, you can leave this blank."* A single sentence that converts a
  wall into a gap.
- **Fiverr** — the deferral signal: *"Additional verification may be required at a
  later stage."* You may enter now; the bar exists and will find you later.

**Everyone else is a dead end.** Toptal rejects 97% and offers them nothing. Etsy
and IndiaMART have no bar to fail.

**On the live problem** — approving a studio and then demanding three completed
projects with no alternative — the pattern that fits is Bark's, not Houzz's. You
don't want a free tier; you want the portfolio step to accept a different kind of
evidence. A three-year-old practice with two finished flats and one in progress is
exactly the kind of studio you should want, and the form currently tells them to
come back later. Worse, it tells them *after* you approved them, which reads as a
bait-and-switch even though it isn't one.

## 5. Linear or not?

- **Linear:** Bark (3 screens, sensibly ordered), Toptal (gated stages,
  necessarily), Airbnb's listing wizard, IndiaMART's 3 steps.
- **Non-linear:** Stripe — explicitly an *"account checklist"* in their own
  documentation, not a wizard.
- **Sequenced but not enforced:** Etsy publishes an order (listing before payment
  before billing) and clearly intends it, without the order being a cage.

**Did non-linear feel worse or better?** For a short flow, linear is better —
three screens with a clear ordering needs no navigation. For a long, heterogeneous
flow, the checklist wins, for a reason that is specific rather than aesthetic:
**the items are not equally ready at the same moment.** A studio owner has their
GSTIN in a drawer, their project photos on a designer's laptop, and their rate
card in a spreadsheet they need to dig out. A wizard forces the order of the
slowest item. A checklist lets them do what's in front of them and come back.

But note what Etsy does that a pure board would lose: **deliberate sequencing of
reward.** Creative first, administrative last. A board with no recommended order
hands a tired person a wall of equally grey obligations at 9pm.

## 6. What did none of them do that would have helped?

Three things, and the first is the one to build.

**a) Nobody shows the applicant the verification itself.** Every product treats
vetting as backstage work: a status ("under review"), a duration, a result. But
for One Interiors, the checking *is* the product — it is the entire reason a
homeowner should pay these studios more than they'd pay someone found on
IndiaMART. Fifteen substantive things are done, including ringing real references
and standing in two finished flats, and the studio sees none of it. That is the
single largest piece of value currently created and then thrown away. A studio
that watched "Reference call — Mrs Kulkarni, Baner — completed Tuesday" appear in
their file would understand, viscerally, what their eventual listing is worth, and
would tell other studios about it.

**b) Nobody shows the supply side the demand they are missing during the wait.**
Airbnb shows an estimate before. Bark shows a specimen before. But the two weeks
of silence are two weeks in which real homeowners are actually filing real briefs
in Baner and Kothrud. A counter that moves — "four briefs matched your profile
since you applied" — costs nothing, is true, and converts dead air into appetite.
Nobody in this set does it because nobody in this set has both a real wait and
real demand at the same time. One Interiors does.

**c) Nobody lets the professional see their own listing as the buyer will see
it.** Every one of these flows asks you to fill in fields and then hides the
result. A studio spending forty minutes on a profile is building something they
have never seen. A live preview — their card, their match reasoning, the quote
their rate card generates, rendered exactly as a homeowner in Baner would see it —
would make every remaining field obviously worth filling, because they'd see the
gap it leaves.

---

# Part three: verdicts on the two proposals, and the five changes

## The two proposals

### "Show real matching briefs before the form" — **confirmed, with one correction**

The evidence is as strong as research gets: Airbnb, Bark and Stripe all put the
artefact before the ask, and they are the three fastest-to-first-win products in
the set. The instinct to move the win from week two to minute one is right, and
the mechanism is right.

**The correction is about the word "real."** Bark shows a *specimen*; Airbnb shows
an *estimate*. Neither shows live third-party data to a stranger. Three real
briefs from Baner, shown to a studio not yet verified, is homeowner data disclosed
to an unvetted party — and those homeowners gave it on the understanding that you
would be careful with it. Do it in two layers:

- **Before approval:** aggregate and de-identified. "Eleven briefs in Baner and
  Aundh this month · budgets ₹8–22L · 2 and 3BHK · 7 wanted work started within 60
  days." Plus one **fully worked specimen brief, marked as a sample**, in the real
  format, with the messy human sentences left in — that is the part Bark gets
  right and it's the part that persuades.
- **After approval:** the real ones, in full.

And do not write "you would have matched all three" unless the matcher genuinely
returns that. It is a checkable claim, and a studio that joins and finds it was
rhetoric will never trust a number you show them again.

### "Replace the wizard with a board of cards" — **confirmed, with one condition**

Stripe calls its equivalent an "account checklist" in its own documentation, and
the architecture already supports it: step state is derived from the data rather
than from a step pointer, and nothing enforces the order. So the wizard is a
costume over a board. Take it off.

**The condition is that a board must not be flat.** Etsy's published order puts the
rewarding step before the administrative ones on purpose. Give the board exactly
one card marked "Start here," put the portfolio card before the rate-card and
registration cards, and put a truthful time estimate on each card's face
("Registration numbers — about 5 minutes, have your GST certificate to hand"). A
board of five equal grey rectangles is not an improvement on a wizard; a board
with a recommended path and honest costs is.

---

## The five changes, in priority order

### 1. Move the first win to minute one: a live Pune demand panel, plus one specimen brief
*Borrowed from Bark's "See an example lead" and Airbnb's earnings estimator.*

On `studio.oneinteriors.in/apply`, above the form, and again on the first screen
after sign-in: a panel of aggregate, de-identified demand for the localities the
studio serves — brief count this month, budget bands, typical project size, how
many wanted a start within 60 days — with a line stating how it's computed, as
Airbnb does with "Learn how we estimate earnings." Directly beneath it, one
complete specimen brief, labelled **Sample**, in the real format, with the
homeowner's own phrasing preserved. Openable in one click, no account.

Then, during the two-week verification: the same panel, but counting forward from
their application date. *"Since you applied on the 4th: 4 briefs matched your
profile."* One number, updated daily, that turns silence into accumulating
appetite.

### 2. Publish the check: give every studio a verification file they can watch
*Borrowed from Toptal's published process and Stripe's account checklist — and it
goes past both.*

The moment a studio submits, open a **Verification** page listing all fifteen
checks by name, each with a state (Not started · In progress · Verified · Needs
something from you) and a date. Fill it in as the work is done, in the studio's
words, not internal shorthand: "Reference call — completed 8 Sept — spoke to the
client on the Baner project, confirmed timeline and budget held." "Site visit —
Kothrud — scheduled 12 Sept, 11am." Say at the top, before they submit, exactly
what Toptal says: how long it takes and what it proves.

This is the one nobody else does, and it is nearly free — the work is already
being done and the outcome already recorded somewhere. The studio stops
experiencing two weeks of silence and starts watching the thing they are buying
get built. It is also the best referral asset: this is what a studio describes to
another studio over chai.

### 3. Replace the wizard with a board — sequenced, timed, and honest about saving
*Borrowed from Stripe's account checklist, Etsy's published order, and the Acorns
critique.*

Five cards, state derived from data as it already is. One card marked "Start
here." Portfolio before rate card before registration numbers, so the rewarding
work comes first. Each card's face carries a truthful time cost and what to have
ready. At the top, before anything: **"About 40 minutes in total. It saves as you
go — you can stop and come back any time."** That sentence is free and removes the
single most common reason a busy owner closes a tab.

### 4. Put an escape hatch on the portfolio step
*Borrowed from Bark's "you can leave this blank" and Fiverr's "additional
verification may be required at a later stage."*

Today, three completed projects with no alternative is a wall that a studio hits
*after* being approved. Two changes:

- **On the card:** "Fewer than three completed projects? Tell us what you have —
  work in progress, a project completed under a previous practice, or a site we
  can visit. We'll take it from there." A young practice gets a path instead of a
  dead end, and you get to apply judgement, which at ten studios you can afford.
- **Before approval, on the application:** state the bar. One line, Fiverr-style:
  "Listed studios show three completed projects. If you're not there yet, say so
  on the form — we'll tell you what we can do." Nobody should learn the
  requirement after being accepted.

### 5. Let them see and share the thing they're building, while they wait
*Borrowed from Stripe's test mode.*

Ask the Stripe question: what here genuinely depends on verification? Only the
introduction to a homeowner. So during the two weeks, turn everything else on:

- **A live preview of their listing exactly as a homeowner will see it** — card,
  match reasoning, verified-checks list with items still greyed as pending. Every
  unfilled field becomes visibly a hole in their own shopfront.
- **The quote engine running against the specimen brief**, so their rate card does
  real work and they can check it produces a number they'd stand behind. That is a
  genuine bug-find for them, and a data-quality win for you.
- **A shareable private link to the preview.** A studio owner who can send their
  partner a link saying "this is us, on the thing we're joining" has been given
  something, and the two weeks stop being a void.

---

## What to check before building

Two things in this report are weaker than the rest.

**Four flows are described only up to their wall** — Houzz Pro, Toptal, Upwork and
Fiverr. For Houzz Pro in particular, the most relevant product to this question,
the marketing and pricing are known exactly and the post-signup onboarding not at
all. A free Houzz Pro account (no card required) closes that gap in an afternoon,
and it is the gap most worth closing.

**Mobbin is genuinely unread**, not skimmed. With Pro, the 630 web onboarding
flows could be run through the studio-owner filter properly. The expectation,
based on the index, is that it yields two or three things and a lot of
consumer-mobile noise — but that is a prediction, not a finding.
