# App decisions — 9 Oct 2026

## 1. Plans (subscription model) — on hold, not yet in the app design

**Self-managed (free)**
- Every app feature is available: On site feed, tracker, snags, locker, GEIO by text.
- The relationship is between the customer and the studio. One Interiors provides the software only.
- The app tells the customer this plainly, in soft wording: "Your studio posts site updates here. With Assured, our team makes sure it happens every day and checks the work."
- The software still checks studios automatically, at no cost to us:
  - The studio gets a reminder after 2 missed days of updates.
  - Missed updates lower the studio's score and ranking.

**Assured (paid)**
- One Interiors oversees every feature:
  - We follow up with studios so daily updates are posted.
  - Our own inspector checks each stage.
  - A personal expert (Meera).
  - Snags fixed within a promised time.
  - Help with payments, released stage by stage.
  - GEIO voice and photo checks.

**Pricing:** a percentage of the project value. Sanyam proposed 1–2%. The current working number is about 1.5%, with:
- a minimum of about ₹5,000 (so small one-room projects still cover an inspector visit)
- a cap of about ₹75,000 (so luxury projects don't feel overcharged)
- payment collected in parts at each project payment stage, not all upfront.

**Open points**
- Upgrading mid-project: proposed yes, paying only for the remaining stages.
- If studios also pay One Interiors a commission, Assured oversight must look independent, with our own inspector and photo reports.
- The quote screen line "One Interiors adds nothing on top" must change once Assured is priced as a percentage.
- Final names: "Self-managed" vs "Assured" are proposed.
- Screens still promise Assured-only things: Snags says "Fixed by a date, or we chase it", and Tracker says "Your expert checks each stage". Change these when the plans go in.

## 2. Know Your Home (learning, not a blog)
- Short, visual tips that show up at the moment they're needed, instead of articles.
- Formats: tip stories on Home, tap-to-explain hard words, and checklists ("Before you pay", "At handover").
- Design topics to start with:
  - room-by-room basics
  - small-flat tricks for Pune 2 BHKs
  - before and after breakdowns of real projects
- Later: style guides, colour and material pairings, lighting, Vastu basics.
- Every tip links to "Ask GEIO more".
- Content should be written or checked by a senior designer. The same knowledge also feeds GEIO.
- The website gets a full SEO blog from the same content.

## 3. GEIO (already designed)
- One Interiors Expert Guide, built on the knowledge of designers with 25 years' experience.
- Speaks Hindi, Marathi and English.
- Never promises a price or date; those go to Meera.
- Text first; voice and photo checks come in a later phase.

## 4. UX review fixes (designed, version 77 of the app design)
- **Studio profile:** photo header, match score, "why they suit you", and four tabs: Past homes, Checks, Delivery record, Reviews.
  - Reviews come from verified customers only.
- **Matches:**
  - Essential / Premium / Luxury tier switch.
  - "Edit my answers" option.
  - Tappable studio cards and a "See all 14 studios" list with filters.
- **Quote:** labelled "First quote, from each studio's own rate card".
  - The final price comes after site measurement and usually moves by under 5%.
  - Valid 30 days. The "made in under 10 s" line is gone.
- **New "Choose & sign" stage:**
  - Expert call → meet studios (visits and site measurement) → final quote (shows exactly what changed) → sign (summary, 3 payment stages, agreement, Aadhaar OTP).
- **One delay message:** the stage status and the overall status are shown separately, e.g. "Carpentry · on track" and "Overall · 4 days late".
- **New bottom bar:** Home · Project · GEIO (centre orb) · Site · Me.
  - Snags and decisions sit inside Project.
  - 3D sits inside Site as "View in 3D", for full-home orders only.
  - The Locker sits inside Me.
  - No floating button.
- **Me screen:** profile, home, Locker, language, notification switches, help (call or WhatsApp), privacy, log out.
- **Notifications screen** behind the bell.
- **Text size:** at least 13px everywhere, no all-caps labels. The mono font is kept for numbers and dates.
- **Language:** English / हिंदी / मराठी picker on Welcome and in Me. The Hindi and Marathi copy is a first draft that needs a native speaker's review.
- **Opening video:** plays on first launch only.

## 5. Engagement features — chosen 9 Oct 2026
Sanyam picked 11 features: Home Coins plus 10 others.

| # | Feature | Where it lives |
|---|---|---|
| 1 | Home Coins (see section 6) | Balance on Home, wallet in Me |
| 2 | Refer a neighbour + society circle (bonus when 3 flats in one society book) | Me, plus a card on Home after signing |
| 3 | Weekly "Spot the mistake" challenge on a real site photo | Card on Home, once a week |
| 4 | Timelapse film of the home, built from daily site photos; full film at handover | Site |
| 5 | Milestone cards to share on WhatsApp and Instagram ("Our kitchen is done!") | Pop up when a stage finishes |
| 7 | Family access and family voting on decisions | Me (invite), Decision screen (votes) |
| 8 | Style DNA card from the quiz ("60% Warm Modern, 40% Scandinavian") | Right after the quiz, before Matches |
| 9 | Dream board: save photos you love; the studio sees it | Me, plus a save button on photos |
| 10 | Try it in my room (AR), which opens the products marketplace | Later phase, needs the real app build |
| 13 | Savings meter: money saved through One Interiors | Project |
| 17 | One Interiors Homes feed and "Home of the month" | New section, reachable from Home |

**Not picked for now:**
- 6 Griha pravesh planner
- 11 Swatch kit
- 12 Site visit mode
- 14 Home Care
- 15 Yearly health check
- 16 Next project

## 6. Home Coins — rules (approved by Sanyam, 9 Oct)
- **Value:** 1 coin = ₹1.
- **Earning:**

| Action | Coins |
|---|---|
| Finish the quiz | 100 |
| Sign with a studio (welcome) | 1,000 |
| Open the daily site update | 10 a day, plus 100 for a 7-day streak |
| Make a decision before its due date | 200 |
| Report a real snag with a photo | 50 |
| Get "Spot the mistake" right | 50 |
| Share a milestone card | 25, up to 5 times |
| A family member joins | 100 |
| Review your studio after handover | 500 |
| A referred friend signs | 5,000 for each family |
| Society circle: 3 flats in one society sign | 10,000 bonus |

- **Spending:**
  - partner furniture, decor and appliances
  - a deep clean after handover
  - One Interiors services, such as a discount on the Assured plan when the plans launch
- **Not spendable on the studio's bill**, so studios aren't caught up in coin payments.
- **Rules:**
  - Coins can't be cashed out.
  - They expire 12 months after handover.
  - Daily limits stop people gaming the system.
  - Referral coins unlock only when the friend signs.
- **Who pays:** partner brands fund most rewards. Referral coins come out of One Interiors' margin on the new project.
- **Typical customer:** about ₹3,000–4,000 in coins over a project without referrals.

## 7. Engagement features designed (version 79 of the app design)
**New screens**
- Style DNA, shown after Q7 and before Matches
- Home Coins wallet
- Refer and society circle
- Spot the mistake
- Your home's story (timelapse)
- Milestone share card
- Family
- Dream board
- One Interiors Homes

**Hooks into existing screens**
- Home: coin balance chip, weekly challenge card, Home of the month card, society circle card.
- Site: timelapse card.
- Project: savings meter, plus "Share this milestone" on a finished stage.
- Me: Coins, Family, Dream board, Refer.
- Decision: family votes.

**Not designed yet:** AR "try it in my room". It comes with the real app build.

**Placeholders:** these names and figures in the design are not real partners or data:
- Ivy Towers, the Kulkarnis, the Deshpandes
- partner brands: Oakhaus Furniture, Loom & Knot Rugs, Hearth Appliances
- the savings figures
