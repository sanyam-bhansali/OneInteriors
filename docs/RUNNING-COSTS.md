# What we pay for

Every external service the product depends on: what it does, what it costs,
whether we are paying for it yet, and what makes the number move.

Written 13 September 2026. **Prices change — re-check anything here before you
put it in a budget or a deck.** Every figure was looked up on the date above and
the source is named.

Rupee conversions use **₹95.7 to the dollar** (mid-market, 11 Sep 2026). Your
card will do worse: Indian credit cards add a forex markup of roughly 3.5%
before GST, so treat the rupee column as a floor rather than the bill.

---

## 1. The short version

| When | Monthly | What changes |
| --- | --- | --- |
| **Today** | **₹0–₹4,300** | Everything is on a free tier except possibly Vercel. |
| **At launch (16 Sep)** | **~₹4,300** | Vercel Pro becomes non-optional — see §2.1. Domain, one-off. |
| **First paying studios** | **~₹6,700** | Supabase Pro for backups; WhatsApp starts metering. |
| **At 24 studios / 120 projects a month** | **~₹15,000–25,000** | WhatsApp and Anthropic scale with volume; the rest barely moves. |

Software is not where this business spends money. For scale: one month of the
lead budget in the year-one model is **₹20,000**, and verifying a single studio
is about **₹25,000**. The entire software stack at launch costs less than
verifying one studio.

That is worth saying out loud in the deck, because "our infrastructure costs
₹4,300 a month" is a more credible answer than a rounded-up guess.

---

## 2. Paying now, or about to

### 2.1 Vercel — hosting · **$20/mo (₹1,915)**

Runs the whole application. Production region is `bom1` (Mumbai), pinned in
`vercel.json`.

**This is the one item that is a compliance problem rather than a preference.**
Vercel's Hobby plan is free and restricted to non-commercial, personal use.
Their fair-use definition of commercial explicitly includes advertising a
product or service and being paid to work on the site — a marketplace that
charges studios is squarely inside it, and so is a pre-launch waitlist for one.

So: if the project is currently on Hobby, it has to move to **Pro at $20 per
deploying seat per month** before the site is public. One seat is enough for
now; viewer seats are free and unlimited. Each seat carries $20 of usage credit,
and 1 TB of data transfer plus 10M edge requests sit outside that credit, which
at our traffic means the $20 is the whole bill.

**Action: confirm which plan the account is on.** If it is Hobby, this is a
launch blocker and not a finance question.

### 2.2 Supabase — Postgres and file storage · **Free now, $25/mo (₹2,393) soon**

The database (25 tables, RLS forced on every one) and the private `floor-plans`
bucket.

The free tier works today and has one disqualifying gap for a live business:
**backups**. Paid plans bring daily backups and point-in-time recovery; the free
tier does not. We hold studio registration data, customer briefs, phone numbers
and floor plans. Losing that is not a bad week, it is the end of the company.

**Move to Pro before the first real customer, not the first real studio.** Pro is
$25/month per organisation with $10 of compute credit included.

### 2.3 Resend — transactional email · **Free now, $20/mo (₹1,914) later**

Studio approval emails and magic links. Free covers 3,000 emails a month, capped
at 100 a day. Pro starts at $20/month for 50,000.

At ten studios and a few hundred waitlist customers we are nowhere near 3,000 a
month, so this stays free well past launch. The cap that will bite first is the
**100 a day**, not the monthly total — a single bulk send to a waitlist would
hit it.

**Not a cost problem today. It is a configuration problem**: the sending domain
is still unverified, which means Resend will only deliver to one address. That
is on the blocker list, and it is free to fix.

### 2.4 Anthropic API — the portfolio drafting agent · **usage, pennies**

Drafts studio profile copy from facts already in our database. Claude Sonnet 5
is $2 per million input tokens and $10 per million output.

A studio profile draft is perhaps 4,000 input and 1,500 output tokens — under
**₹2.50 per studio**, once, and only when a studio asks for it. Fifty studios is
about ₹125 for the year.

The feature degrades cleanly to "the studio writes it themselves" with no key
configured, so this is genuinely optional spend.

### 2.5 Domain · **₹1,000–3,000/year, one-off-ish**

A `.in` and the matching handles. **Blocked on the name**, which is itself the
blocker on the launch date. Budget a few thousand rupees and be prepared to pay
more if the name you want is held.

---

## 3. Metered, and it starts when we launch

### 3.1 WhatsApp Business API — sign-in codes and notifications

Meta's India rates, effective July 2026, before any provider markup and before
18% GST:

| Category | Per message | What we use it for |
| --- | --- | --- |
| Authentication | **₹0.1150** | Every sign-in code |
| Utility | **₹0.1150** | Milestone and appointment notifications |
| Marketing | **₹0.8631** | We do not send these |

Meta charges only on delivered messages. Two things to know:

- **From 1 October 2026 Meta starts charging for service and utility messages
  sent inside an open 24-hour window**, which were previously free. If you
  modelled anything on the old free window, re-do it.
- We will almost certainly go through a **BSP** (business solution provider)
  rather than direct, and they add either a platform fee or a per-message
  markup. That choice is not made yet and it is the number that actually
  determines this line.

**Scale check:** at 120 projects a month with, say, six messages each, that is
720 utility messages — about **₹83 plus GST**. This will never be a significant
cost at our volume. The reason it matters is the **weeks of Meta business
verification**, not the rupees.

### 3.2 Studio verification — not software, but it is the real per-unit cost

₹25,000 per studio for twelve checks, from the year-one model. At 37 studios
verified across year one that is **₹9.3 lakh**, and roughly 37 paise in every
rupee of it is spent on studios who then churn out.

Listed here because it dwarfs everything above and is the number people forget
when they say "our costs are low".

---

## 4. Configured but not bought, and not used

These have environment variables in `.env.example` and **zero references
anywhere in `src/`** — I checked. They are placeholders for planned work, not
services we are paying for. Nobody should see them on a bill.

| Service | For | Status |
| --- | --- | --- |
| Razorpay | Subscription billing from month 4 | **Not integrated.** Three empty env vars. Standard Indian gateway pricing is around 2% domestic — confirm current rates before modelling. |
| Escrow provider | Holding client funds, year two | **Not contracted, and not yet legally cleared.** Needs an RBI-compliant partner. |
| KYC provider (IDfy / Signzy / Surepass / AuthBridge) | Registry lookups | **Not chosen.** None publishes flat pricing — you have to ask. GSTIN validation currently runs offline with a real checksum, free. |
| PostHog | Product analytics | **Not used, and deliberately.** We built our own event table so no visitor data leaves our database — the cheapest defensible DPDP position. The env vars should be deleted. |
| Redis | Caching / rate limiting | **Not used.** `REDIS_URL` is unset and unreferenced. |
| S3 | Object storage | **Not used.** Supabase Storage does this instead. Delete the four `S3_*` vars. |

**Housekeeping:** six of these have no consumer. An `.env.example` that lists
services we do not use makes the real list harder to read and invites somebody
to go and sign up for one. Worth a ten-minute tidy.

---

## 5. Mobile, when the apps ship

The apps are a Capacitor wrap of the same codebase, so there is no second build
to pay for — only the store fees.

| | Cost | Shape |
| --- | --- | --- |
| Apple Developer Program | **$99/yr (~₹8,500–8,900)** | Annual, recurring. Enrolment takes 2+ weeks. |
| Google Play Console | **$25 (~₹2,400)** | One-time, never renews. |

Neither is on the critical path for September. Both have lead times, so start
them before you need them rather than when you do.

---

## 6. What we deliberately do not buy

Worth recording, because each was a decision and each will be questioned again.

- **No analytics vendor.** Our own `AnalyticsEvent` table, with a prop guard
  that rejects anything resembling personal data. Under the DPDP Act the
  cheapest position is not to ship visitor data to a third party at all.
- **No error-tracking SaaS** (Sentry and similar). Vercel's logs cover us at
  this size. Revisit when there is somebody whose job is to watch them.
- **No CRM.** The ops console is the CRM.
- **No design tooling subscription.** The brand, palette and type scale are
  built in code.
- **No KYC vendor yet.** GSTIN checksum validation is offline and free; the paid
  lookups only become necessary at a volume we are nowhere near.
- **No CDN, no separate image service.** Vercel includes both.

---

## 7. Things that will surprise you on the bill

1. **Everything above is billed in USD.** The rupee number moves with the rate,
   and your card adds roughly 3.5% forex markup plus GST on that markup.
2. **18% GST** applies to Indian services and to imported digital services under
   reverse charge. The dollar figures here are all pre-tax.
3. **Vercel and Supabase are usage-metered above the included allowances.** At
   our traffic the base fee is the whole bill — but a misconfigured cron, a
   crawler, or an image-heavy launch can change that inside a day. Both have
   spend caps. Set them.
4. **Supabase bills per organisation, not per project.** A second project for
   staging does not double the base fee.
5. **Vercel charges per deploying seat.** Adding a developer is $20/month, not
   free. Viewer seats are free — use those for anyone who only needs to look.

---

## 8. What to do about all this, in order

1. **Check whether Vercel is on Hobby.** If it is, moving to Pro is a launch
   blocker, not a budget line. (§2.1)
2. **Verify the Resend sending domain.** Free, and without it you cannot onboard
   a single studio. (§2.3)
3. **Set spend caps** on Vercel and Supabase before the site is public. (§7.3)
4. **Move Supabase to Pro** before the first real customer, for backups. (§2.2)
5. **Delete the dead env vars** — PostHog, Redis, S3. (§4)
6. **Pick a WhatsApp BSP** and get the actual markup, since that is the only
   number in this document we cannot look up. (§3.1)

---

## Sources

Looked up 13 September 2026.

- [Vercel Hobby plan terms](https://vercel.com/docs/plans/hobby) and the
  commercial-use clause
- [Vercel pricing 2026](https://costbench.com/software/developer-tools/vercel/)
- [Supabase pricing 2026](https://www.nocode.mba/articles/supabase-pricing)
- [Resend pricing 2026](https://www.stackscored.com/pricing/transactional-email/resend/)
- [WhatsApp Business API India rates 2026](https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026)
- [Anthropic API pricing 2026](https://www.aipricing.guru/anthropic-pricing/)
- [Apple Developer Program cost in India](https://colorleaves.in/blog/apple-developer-account-cost-india/)
- [Google Play Console fee](https://primetestlab.com/blog/google-play-developer-fee)
- [USD/INR, 11 Sep 2026](https://www.exchangerates.org.uk/USD-INR-spot-exchange-rates-history-2026.html)
