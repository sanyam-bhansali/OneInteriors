# What I need from you

Last updated 8 September 2026.

Everything currently blocking or slowing the build, in the order it will bite.
Each item says **why** it matters and **what it unblocks**, so you can judge what
is worth your afternoon.

Nothing here is a nice-to-have. Where something can be worked around, I have
said so. Where you have already done it, it has moved to §6 so you can see the
list shrinking.

---

## 0. Do these today — 40 minutes, and they are all small

These are the ones where a small task is holding up something much larger.

### 0.1 Build and push

```
cd C:\Sanyam\OneInteriors
npm run build
git push origin main
```

Twelve commits are sitting unpushed. **Run the build first** — I cannot run it
from my side, and an unverified build is exactly what broke the last Vercel
deploy (`TypeError: Invalid URL` from an empty env var). Typecheck, lint and 119
tests already pass; the build is the one gap.

If the build fails, paste me the whole log rather than the last line.

---

### 0.2 Rotate the Supabase secret key

**Two minutes. Do it even though nothing uses it.**

`sb_secret_IJ7AQgl…` came through this chat. That key **bypasses Row Level
Security entirely** — it is the one credential that would undo the lockdown we
put on all 25 tables. Nothing in the codebase needs it and `SUPABASE_SECRET_KEY`
is deliberately blank, so rotating costs you nothing.

Supabase dashboard → Project Settings → API Keys → roll the secret key. Do not
paste the new one anywhere, including to me.

---

### 0.3 Set the production env vars in Vercel

**Five minutes. Without these, approving a studio silently fails in production.**

These exist only in your local `.env.local`. Vercel has never seen them:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | The `re_…` key |
| `EMAIL_FROM` | Currently `One Interiors <onboarding@resend.dev>` |
| `SESSION_SECRET` | Generate a **new** one for production, do not reuse local |
| `DATABASE_URL` | Transaction pooler, port 6543, `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Session pooler, port 5432 |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as local |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel production URL, **no trailing slash** |

`NEXT_PUBLIC_SITE_URL` is the one that bit us before. Vercel passes an unset
`NEXT_PUBLIC_*` as an empty string, not as undefined — `src/lib/site.ts` now
handles that, but set it properly anyway or every magic link will point at
localhost.

Leave `SUPABASE_SECRET_KEY` blank. Leave `NEXT_PUBLIC_ROSTER_IS_REAL` unset
until real studios are actually live — it controls the "these are placeholder
studios" disclaimer, and forgetting it over-discloses, which is the safe
direction.

---

## 1. Blocking the next piece of work

### 1.1 Which LLM provider — Anthropic, OpenAI, or Google

**A decision plus an API key. This is the only thing blocking the AI portfolio
agent.**

You asked for an agent that reads a studio's projects and drafts a polished
portfolio — aligning their photographs with written copy. I cannot start it
without knowing what it is calling.

My recommendation is **Anthropic**, for one specific reason rather than general
preference: this agent writes copy that goes on a page a customer makes a
₹8-lakh decision from, and the failure mode that matters is *invention* — an
agent writing "delivered in 40 days" because it reads well, when nobody measured
it. That risk is handled by how I prompt and constrain it, but longer-context
models handle "use only these facts, and say nothing where a fact is missing"
more reliably, and I would rather over-provision on that.

Either way I will build it so the studio approves every word before it
publishes. The agent drafts; it never publishes.

**Send:** the provider, and the API key. Costs are small — drafting one
portfolio is a few rupees.

---

### 1.2 The real contact person at Hauspire and Urbanline

**A name and a direct email each.**

Both are seeded in `/ops/applications` and waiting for you to approve them. But
I only had their published addresses:

| Studio | What I have | What I need |
|---|---|---|
| Hauspire | `info@hauspire.com` | The person who will actually build the profile |
| Urbanline Interiors | `connect@urbanlineinteriors.com` | Same |

Approving emails a sign-in link to that address. A shared `info@` inbox means
the link either goes unnoticed or gets clicked by whoever opens the mail — and
that person then owns the studio account.

Also worth knowing before you approve: **Urbanline's domain is
`urbanlineinteriors.com`, plural.** The `urbanlineinterior.com` you sent me does
not resolve. Worth checking whether they own the singular and let it lapse,
because someone else can take it.

---

### 1.3 Verify a sending domain in Resend

**15 minutes, mostly waiting on DNS.**

The Resend account is live and sending, but it is unverified — which means it
**can only send to `sanyambhansali1@gmail.com`.** Any other recipient gets a 403.

So today, approving Hauspire would create the studio, create their user, and
then fail to deliver the sign-in link. The approval itself survives (the email
send is deliberately outside the database transaction), but nobody gets in.

This needs a domain. If the name is not settled, use any domain you already
control — even a Hauspire subdomain — and change it later. It is one env var.

**Unblocks:** actually onboarding the first two studios.

---

## 2. The name — your call, but here is the clock

You said to decide the name later and focus on development, and I agree that
was the right call two weeks ago. It is worth knowing what it is costing now
that the product is real.

The site is `robots: noindex` until it has a permanent home. Locality cost pages
("interior designers in Baner", "2 BHK interior cost in Pune") are a primary
organic channel for this category and they take **months** to rank. Both
Hauspire and Urbanline already run exactly these pages — I saw them on both
sites while building the scraper. Every week on `noindex` is a week not
compounding, and that cost is invisible because nothing looks broken.

It also gates: the email sending domain, the Vercel production domain, and the
app store listings.

**Before committing to any name:** check the `.in` domain, the Instagram handle,
and run an MCA name-availability search. "One Interiors" is a category label —
it will fight every interiors business in India for search, and I would be
surprised if the `.in` is free.

Nothing in the codebase hardcodes the name. Changing it is a copy pass, not a
rebuild.

---

## 3. Needed within the next two sprints

### 3.1 DPDP position on the 20,000 Hauspire records — **in writing**

**A lawyer's two hours. Blocks your entire demand plan.**

Those records were collected by Hauspire for Hauspire's purpose. Marketing a
different entity to them is a live consent question under the DPDP Act 2023.

I can build the consent model without this — but you cannot legally send the
first campaign, and that campaign is what fills the pilot studios' pipeline. If
consent does not transfer, the acquisition timeline moves out by a quarter and
the budget changes shape. Better to know now than after the first complaint.

### 3.2 Agency baseline numbers

**You have these; nobody else in this market does.**

From the performance marketing business, per designer, over 6–12 months: cost
per lead, lead→meeting, meeting→signed. Anonymised is fine.

This is the anchor for the whole pricing ladder. It is how you tell a studio
"₹1L/month for five projects is half what you already pay per booked project."
Without it, that sentence is an assertion rather than a calculation.

### 3.3 WhatsApp Business API

**Meta business verification takes weeks. Start it now, use it later.**

Customers will sign in by phone, not email — it is the channel the rest of the
relationship happens on in India anyway. The auth code path already exists and
shares one implementation with email, so this is a provider swap rather than new
work.

Needs a Meta Business account, business verification, and a number. Then
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

### 3.4 Apple Developer + Google Play accounts

**Apple enrolment can take 2+ weeks. It becomes the blocker if left to the end.**

Apple ₹8,900/year, Google $25 one-time. The apps are a Capacitor wrap of the
same codebase, so there is no second app to build — but the account cannot be
rushed at the end.

---

## 4. For the quotation builder

### 4.1 GST treatment, from your CA

**The one genuinely blocking item here.**

18% is the headline, but composite supply versus works contract changes it, and
it is wrong on a signed document otherwise. **The Hauspire app has no GST
handling at all** — its TPV is pre-tax. Ours cannot be, because ours produces a
document a customer pays against.

### 4.2 One pilot-studio rate card that is not Hauspire's

I now have 980 Hauspire quotation files, which is more than enough to derive
structure. But Hauspire's catalogue is *one company's* structure until a second
one fits into it. Urbanline's would do.

This also matters for the rule in §5.1: I need to know the shape of the model
without anchoring its numbers to your cofounder's factory.

---

## 5. Decisions only you can make

### 5.1 Confirm the Hauspire rate rule

That studios load **their own** rates, and Hauspire's catalogue is used for
*structure* only, never as default prices.

Seeding the platform with your cofounder's factory pricing would be setting
market prices in favour of a business you own — and pricing is where a studio's
margin lives. It is also the single fact that, if it came out later, would cost
you the roster. I have written this into `FUTURE-SCOPE.md` §6 as settled. Tell
me if it is not.

### 5.2 Escrow — is it feasible at all?

Two weeks with a lawyer, and worth starting inside the three-month window rather
than at the end of it. If holding client funds turns out to be impractical for
an entity at this stage, the repositioning collapses and we are back to a
commission model with known failure modes.

Everything on the site currently says "we do not hold your money", and that
stays true until this is answered. Measurement is separate from money movement,
so the delivery record keeps accruing either way — that was the point of
deferring it.

### 5.3 The dispute and removal policy

Needs writing **before** launch, not after the first dispute. What triggers
suspension, what triggers permanent removal, who decides, and what the appeal
is.

The ops console already *requires* a written reason for any status change and
records who made it — that machinery exists. The policy it enforces does not.

---

## 6. Done — no longer needed from you

So you can see the list shrinking:

- ~~Supabase project and connection strings~~ — live, 25 tables, RLS enforced
- ~~Resend API key~~ — set, sending confirmed (domain verification still open, §1.3)
- ~~Admin email~~ — `kairossmma@gmail.com` and `sanyambhansali1@gmail.com` are both OPS
- ~~Hauspire quotation samples~~ — 980 `.xlsm` files, more than enough
- ~~The first two studios~~ — Hauspire and Urbanline seeded and waiting for approval

---

## 7. Things I do **not** need

So you do not spend time on them:

- **The Supabase secret key.** Nothing uses it, it bypasses RLS, leave it blank.
- **Design assets, logos, fonts.** The mark, palette and type scale are built.
- **Copy.** I draft it, you correct it.
- **A KYC vendor.** GSTIN validation runs offline with a real checksum. Only a
  *live portal lookup* needs a vendor, and reference calls and site visits are
  human work regardless.
- **Hosting decisions.** Vercel and Supabase are both provisioned.
- **Studio data typed out by hand.** The apply form and the website scraper
  collect it. That was the point of building them.

---

## If you only do four things this week

1. **Build and push** (§0.1) — five minutes, and the last two sprints go live.
2. **Rotate the Supabase key and set the Vercel env vars** (§0.2, §0.3) — ten minutes, and one of them is a security fix.
3. **Verify a sending domain in Resend** (§1.3) — without it you cannot onboard a single studio, and this is not obvious until it fails.
4. **Pick the LLM provider** (§1.1) — one decision, and it unblocks the largest remaining piece of work.

The name (§2) is the fifth, and it is the one with a compounding cost.
