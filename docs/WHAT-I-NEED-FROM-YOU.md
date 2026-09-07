# What I need from you

Everything currently blocking or slowing the build, in the order it will bite.
Each item says **why** it matters and **what it unblocks**, so you can judge
what's worth your afternoon.

Nothing here is a nice-to-have. Where something can be worked around, I've said
so.

---

## 1. Blocking now — nothing progresses past these

### 1.1 Resend account → `RESEND_API_KEY`, `EMAIL_FROM`
**5 minutes. Free tier is 3,000 emails/month.**

Sign-in is a magic link. Without an email provider the link only prints to your
local dev console, which means **`/ops` is unusable from the deployed site** —
you could not onboard a studio from anywhere but your own laptop.

1. Sign up at resend.com
2. Add and verify a sending domain (a DNS record or two). A subdomain like
   `mail.yourdomain.in` is fine and keeps your main domain's reputation separate.
3. Create an API key → `RESEND_API_KEY`
4. Set `EMAIL_FROM` to something like `One Interiors <hello@yourdomain.in>`

**Unblocks:** ops sign-in in production, and later every milestone notification.

> Needs the brand name and domain settled first — see 1.2.

---

### 1.2 The brand name and domain
**A decision, not a task. Currently the largest blocker by knock-on effect.**

"One Interiors" is a category label, not a brand. It competes on search with
every interiors business in India, and I'd be surprised if the `.in` were free.

It blocks more than it looks: the email sending domain, the Vercel production
domain, `NEXT_PUBLIC_SITE_URL`, the app store listings, and whether we can drop
`robots: noindex` and start accumulating SEO on locality cost pages — which is a
primary organic channel and takes months to compound. Every week on `noindex` is
a week not compounding.

**Before committing:** check the `.in` domain, the Instagram handle, and run an
MCA name-availability search.

---

### 1.3 The six to eight pilot studios
**The critical path to the entire business.**

The ops console can now onboard a studio end to end — but there are none to
onboard. Everything downstream waits on this: real projects, delivery variance,
Tier 3 "Proven", which is the only part of the product a competitor cannot buy
from a KYC vendor.

For each studio I need:

| Field | Notes |
|---|---|
| Legal name and trade name | As on the GST certificate |
| GSTIN | Validated offline on entry; an invalid checksum is rejected |
| Localities served | From the twelve Pune areas in the quiz |
| Project value range | Their realistic floor and ceiling |
| Years active, team size | Self-declared; shown but never used for a tier |
| A one-paragraph description | I'll write these from a call if easier |
| 3–6 past projects | Title, locality, BHK, scope, value, duration, completion date |

**Concentrate the pilot across six to eight studios, not twenty** — several
studios reaching three completed projects each is what produces a delivery
record. Twenty studios with one project each produces nothing.

---

## 2. Needed within the next two sprints

### 2.1 WhatsApp Business API
**Meta business verification has a lead time of weeks. Start it now.**

Customers sign in by phone, not email — it's the channel the rest of the
relationship happens on in India anyway. The code path already exists and shares
one implementation with email, so this is a provider swap rather than new work.

Needs: a Meta Business account, business verification, a phone number, then
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

**Unblocks:** customer accounts, briefs surviving a device change, milestone
notifications.

### 2.2 DPDP position on the 20,000 records — **in writing**
**A lawyer's two hours. Blocks your entire demand plan.**

Those records were collected by Hauspire for its own purpose. Marketing a
different entity to them is a live consent question under the DPDP Act 2023.

I can build the consent model without this — but you cannot legally send the
first campaign, and that campaign is what fills the pilot studios' pipeline. If
consent doesn't transfer, the acquisition timeline moves out by a quarter and
the budget changes shape. Better to know now.

### 2.3 Agency baseline numbers
**You have these; nobody else does.**

From the performance marketing business, per designer, over 6–12 months:
cost per lead, lead→meeting, meeting→signed. Anonymised is fine.

This is the anchor for the whole pricing ladder — it's how you tell a studio
"₹1L/month for five projects is half what you already pay per booked project."
Without it that conversation is an assertion.

### 2.4 Apple Developer + Google Play accounts
**Apple enrolment can take 2+ weeks. It becomes the blocker if left.**

Apple ₹8,900/year, Google $25 one-time. The apps are a Capacitor wrap of the
same codebase, so there's no second app to build — but the account can't be
rushed at the end.

---

## 3. Needed for the quotation builder (Sprint 5–6)

This is the highest-value thing for studio retention, and it is **fully blocked**
on real data. I will not invent a line-item model — that guarantees rework.

### 3.1 Two or three real Hauspire quotations
With line items intact. I've read the app's ProductMaster, but I need to see how
a quote is actually *presented* to a client.

### 3.2 Two pilot-studio rate cards
The categories and units Pune studios genuinely price in. Hauspire's catalogue
is one company's structure until a second one fits it.

### 3.3 GST treatment, from your CA
18% is the headline, but composite supply vs works contract changes it, and it's
wrong on a signed document otherwise. **The Hauspire app has no GST handling at
all** — its TPV is pre-tax. Ours can't be.

---

## 4. Decisions only you can make

### 4.1 Confirm the Hauspire rate rule
That studios load **their own** rates, and Hauspire's catalogue is used for
structure only. Seeding the platform with your cofounder's factory pricing would
be setting market prices in favour of a business you own — and pricing is where
a studio's margin lives. I've written this into `FUTURE-SCOPE.md` §6 as settled;
tell me if it isn't.

### 4.2 Escrow — is it feasible at all?
Two weeks with a lawyer. If holding client funds turns out to be impractical at
this stage, the repositioning in §03 of the build plan collapses and we're back
to a commission model with known failure modes. Everything currently says "we do
not hold your money" and that stays true until this is answered.

### 4.3 The dispute and removal policy
Needs writing before launch, not after the first dispute. What triggers
suspension, what triggers permanent removal, who decides, what the appeal is.
The ops console already **requires** a written reason for any status change and
records who made it — that machinery exists, but the policy it enforces doesn't.

---

## 5. Things I do NOT need

So you don't spend time on them:

- **The Supabase secret key.** Nothing uses it and it bypasses RLS. Leave it
  blank, and rotate the one that went through chat.
- **Design assets, logos, fonts.** The mark, palette and type scale are built.
- **Copy.** I'll draft it; you correct it.
- **A KYC vendor yet.** GSTIN validation runs offline. Only the *live* portal
  lookup needs one, and reference calls and site visits are human work anyway.
- **Hosting decisions.** Vercel and Supabase are both provisioned.

---

## If you only do three things this week

1. **Name and domain.** Unblocks email, SEO, the app stores, and the launch date.
2. **Resend account.** Five minutes, and `/ops` becomes usable from the deployed site.
3. **First two pilot studios.** Two is enough to prove the onboarding flow against real data — the other six can follow.
