# What is left to build, what others do better, and what we should add

**29 September 2026.** Companion to `docs/CUSTOMER-JOURNEY-PLAN.md`. Three
parts: every feature still to build, grouped and marked with what it waits on;
what the competitor research found; and the additions it argues for — each
checked against the rule that makes One Interiors worth using: **no fabricated
reviews, no paid ranking, every number traceable.**

---

## Part 1 — Every remaining feature

Legend: **✅ done** · **🔨 buildable now** · **⏳ waits on you** (the thing it
waits on is named).

### Done (29 Sep)

✅ CI · ✅ waitlist lockdown · ✅ one score per card · ✅ false claims removed ·
✅ bands ₹1,200 / 1,800 / 2,500 · ✅ possession question · ✅ name first,
chapters, locality search, society · ✅ home needs, language · ✅ contact step,
consent, `/privacy` · ✅ Google sign-in (⏳ OAuth client) · ✅ "Welcome,
Sanyam" · ✅ brief held for any tab · ✅ AI read on the whole brief ·
✅ `/tier` retired · ✅ **scope-aware quotes, checklist, scope-scaled bands,
civil block**

### Phase 2 — the quote

| Feature | State |
|---|---|
| Floor-plan reader (Claude reads the plan; customer confirms) in the brief, with the Hauspire app's eight faults fixed | 🔨 |
| Every matched studio priced at once, build animation once | 🔨 |
| Payment phases on the quote, from each studio (studio profile / archive) | 🔨 structure · ⏳ studios' figures |
| Platform quotation format: studio logo + "Powered by One Interiors", "Prepared for Sanyam" | 🔨 |
| Quote PDF | 🔨 (print stylesheet first; true PDF later) |
| Each studio's own modular discount, falling back to 10% | 🔨 structure · ⏳ archives |
| Where the total lands against the chosen band | 🔨 |
| Lower the archive threshold 100 → 50 with a per-item minimum; read Excel quotations | 🔨 |

### Phase 3 — the studio profile

| Feature | State |
|---|---|
| Onboarding "matching profile": work mix (modular / carpentry / mixed), scopes + minimums, city-wide, lead time, durations, how they work, specialisms, languages, materials, warranty, curated discount, payment phases, intro video | 🔨 |
| Portfolio: carpet area, society, household/needs tags, room-tagged photos, picker consent | 🔨 |
| Studio band computed from rates, ops confirms | 🔨 |
| Fixtures grown to ~15 studios across bands, zones and scopes | 🔨 |
| Coverage grid for ops (band × zone × scope) | 🔨 |

### Phase 4 — matching v2 and the match page

| Feature | State |
|---|---|
| Engine `match@2.0.0`: band / scope / zone filters, style from photos, priorities with their own signals, similar work, working style, household & needs, timeline from possession, confidence-adjusted ranking | 🔨 on fixtures |
| Server-side ranking, matches stored | 🔨 |
| Photo style picker (licensed + portfolio), this-or-that, swipe on phones | 🔨 structure · ⏳ licensed images |
| Style DNA card, shareable | 🔨 |
| Evidence per factor, "their work like yours", timeline line on every card | 🔨 |
| Fewer than three: city-wide widening; "one band up" | 🔨 · ⏳ your yes on "one band up" |
| "Why not the others" | 🔨 |

### Phase 5 — compare

| Feature | State |
|---|---|
| Fit block above price | 🔨 |
| Per-room and per-material prices, material ids not sentences | 🔨 |
| AI comparison summary with a figure checker, in English / हिन्दी / मराठी, with "listen" | 🔨 |
| Comparison brief (one page, shareable) | 🔨 |

### Phase 6 — expert and after

| Feature | State |
|---|---|
| Book a 30-minute slot; availability in the ops console | 🔨 · ⏳ the expert and their hours |
| Confirmation email + calendar invite; WhatsApp | 🔨 email · ⏳ WhatsApp template |
| Expert's pack (everything the customer did) | 🔨 |
| Customer portal ("Your home"): brief, matches, quotes, booking, introduction, mood board (from `/prepare`), 3D slot | 🔨 · ⏳ your 3D tool |
| Benefits pass (states: available / unlocks when / claimed) | 🔨 structure · ⏳ benefit terms |
| Post-meeting check-in feeding the engine | 🔨 |

### Phase 7 — the rest

| Feature | State |
|---|---|
| Apple / Facebook sign-in | ⏳ accounts |
| Inspiration upload → style | 🔨 |
| Society floor-plan library | 🔨 (after the reader) |
| Customer-side project tracker (milestones, site photos) | 🔨 — must exist before "Project tracker" is promised |
| Referrals (code, tracking) | 🔨 · ⏳ terms |

---

## Part 2 — What the research found

Full notes and sources came from a research pass on 29 Sep; the summary:

**Every large Indian player is a single brand, not a marketplace** — Livspace,
HomeLane, Design Cafe, Bonito, DecorPot, Arrivae, NoBroker Interiors, Asian
Paints Beautiful Homes, Interior Company. They assign you *their* designer and
never show a competing quote. Their warranties are real but conditional, their
payment schedules take 60–100% before installation, and the recurring
complaints are the same everywhere: the quote grows after booking (reported
1.5–2× at Livspace), delays, and support that goes quiet once paid.

**Only two resemble One Interiors:**

- **HeyBuddy** — a home visit by their executive, AI turns it into one
  standard brief, several designers quote on the identical brief, compared side
  by side; raw-material checks on site; before/after property scan; contact
  hidden from designers you do not shortlist.
- **TatvaOps** (Bangalore-first) — milestone escrow, released after site
  verification and client sign-off; weekly site photos.

**Where others are genuinely ahead of us today:** an in-person visit before
the final quote (HeyBuddy), real escrow (TatvaOps), live price as you change
the design (HomeLane SpaceCraft), comparing design concepts not just prices
(Decorilla, US), reviews tied to real projects (Houzz, Checkatrade), a
homeowner dashboard with daily logs (Houzz Pro), long written warranties and
EMI (the brands).

**Where we are already ahead:** nobody else gives an instant, line-item first
quote from *each* studio's own rates, on identical lines, with the material
under every price — before any studio has the customer's number. Nobody else
builds the match around the possession date. Nobody else publishes what a
score does not measure.

---

## Part 3 — What we should add to make choosing the right designer perfect

Ordered by how much each improves the decision, not by effort. Each says where
it fits and what keeps it honest.

1. **Publish the shared scope sheet.** Show, above every comparison, the exact
   list every studio priced — the checklist from the brief. It turns "these
   quotes differ" into "these studios priced the same work differently". Fits
   Phase 5. *Honest by construction.*
2. **Quote drift, published per studio.** For every project that signs, record
   the first quote, the signed contract and the final bill. Publish each
   studio's median drift. The single biggest complaint in this market is the
   quote growing after booking; no one measures it. Fits Phase 6 onwards.
   *A studio cannot buy a better number.*
3. **A measured visit before the final quote.** Optional and free: our person
   measures the flat once and every shortlisted studio re-prices on the same
   measurements. Fair comparison, less drift. Operational; the software records
   the measurements and re-prices (the floor-plan path already does this).
4. **A fair payment standard.** Show each studio's payment phases side by side
   and mark the share paid before installation. Encourage (then require) 5–10%
   held until snag closure. Fits Phase 2 (phases on the quote) and Phase 5.
5. **Delay terms, the same for every studio,** written into the introduction —
   and each studio's on-time record next to it. HomeLane's ₹1,000/day is void
   for custom work; ours should not be.
6. **Reviews only from signed customers, bad ones included.** One review per
   signed project, collected by us after handover, published whole. No review
   from anyone we did not introduce. Placement never changes.
7. **Material spot-check at the site.** At the factory-dispatch milestone, check
   the board grade, hardware brand and laminate against the quote. The whole
   point of comparing materials is lost if the site gets the cheaper board.
8. **Before/after property scan** (photos of walls, floors, electrical, plumbing)
   at the start. It settles damage disputes and feeds the cinematic handover.
9. **Concept compare.** For the final two, an optional short mood board from
   each — taste, not only price. (Decorilla does this in the US.)
10. **A switch path.** If it goes wrong before production, we re-match, and the
    customer does not start again. Requires the brief and quotes we already keep.
11. **Live price as they change the scope** — the checklist is already the
    quote; next is a finish toggle (laminate / acrylic / veneer) that re-prices
    every studio at once.
12. **Timeline per band and per studio**, counted from possession (partly
    built). No one else plans backwards from the keys.
13. **Warranty in plain words, side by side** — years, what is excluded, who pays
    after month three. Fits the studio profile (Phase 3) and compare (Phase 5).
14. **Cancellation and refund policy next to every quote**, before booking.
15. **Contact stays private until they choose** — already true; say it on every
    screen where a number is asked, as a promise.
16. **One neutral EMI partner**, stated identically for every studio.
17. **A contract template** that is fair and the same across studios: retention,
    delay terms, material specs by brand and grade, cancellation.
18. **The handover dossier** — as-built materials, warranty cards, the scan, the
    cinematic video — one link the owner keeps.
19. **A Pune interiors price index** built from signed contracts, by band and
    scope. Public, useful to every buyer, and marketing no one can copy.
20. **Escrow, when it is legal to do** — FUTURE-SCOPE already sets the trigger.
    TatvaOps proves customers want it.

**Deliberately not recommended:** a "lowest price guarantee" (NoBroker,
Interior Company) — it rewards the cheaper board, which is the substitution
problem the comparison exists to expose; and paid lead credits (Bark) — the
opposite of "no studio pays for position".

---

## What I need from you to finish everything

- Google OAuth client (and later Apple, Meta accounts)
- The expert at launch and their weekly hours
- A licensed image library for the style picker
- Terms for cashback, curated discount, referrals, free cab
- Yes / no on offering "one band up" when fewer than three studios fit
- Your 3D design tool, when ready
- WhatsApp template approval (Meta)
- A lawyer's read of `/privacy` and the studio agreement
