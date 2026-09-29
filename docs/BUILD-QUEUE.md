# Customer side — the build queue

From the audit of 30 Sep 2026: everything in `CUSTOMER-JOURNEY-PLAN.md` that
is not yet built or only partly built, in the order we will build it. One
item at a time; each ships with its tests, green typecheck, lint and suite,
and is ticked here when it lands.

The order: first what makes the product **correct and safe to launch**, then
what **changes results for the customer**, then the **style signal**, then
**delight and return visits**, then the **bigger immersive pieces**.

Legend: ✅ done · 🔨 next · ⏳ waits on the owner (named)

## P1 — Correct and safe to launch

| # | Item | Why first | State |
|---|---|---|---|
| 1 | **Consent to share with studios**, recorded when the customer picks studios at the expert step; contact is released to a studio only with it | DPDP: the plan (§3.3) requires it before any studio sees a name or number | ✅ |
| 2 | **Reschedule and cancel links** for a booked expert call | A booked call with no way to move it becomes a no-show | ✅ |
| 3 | **"Rates not filed yet"** at launch — a studio without its own live rates is shown without a borrowed price once the roster is real | No placeholder price under a real studio's name (§7.3) | ✅ |
| 4 | **Send the browser only what the page shows** — the match page stops receiving full studio records | Privacy and page weight (§5.8) | ✅ ops-only fields stripped; ranking stays in the browser for instant widenings |

## P2 — Answers that change the result

| # | Item | Why | State |
|---|---|---|---|
| 5 | **Household and needs add quote lines** — study unit for work from home, mandir for a pooja room, extra lofts for storage | "Every answer affects the result" — these two answers do not touch the quote yet (§7.2) | |
| 6 | **The customer's top priority leads each card's evidence** | "You put finishing on time first → they can start in January…" (§6) | |
| 7 | **Society typeahead** — picking "Gera World of Joy" fills Kharadi, and society names stay consistent for matching and the plan library | §2 screen 2; makes "a home in your building" match reliably | |
| 8 | **Skip screens the floor plan already answered** | Fewer questions for the customers who did the most work (§2 rules) | |
| 9 | **Expert questions from household and possession**, not only the price gap | The call starts with their real worries (§9) | |

## P3 — The style signal

| # | Item | Why | State |
|---|---|---|---|
| 10 | **Style photos from the owner's Pinterest board**, assigned to style and room; **scope-aware** (kitchens for kitchen customers) | The stock photos are stand-ins | ⏳ the Pinterest board |
| 11 | **Studio portfolio photos in the picker** (with picker consent), and a match boost when a customer picks a studio's own photo | §5.2 direct affinity | |
| 12 | **This or that** — four pairs from the styles closest to their picks | Sharpens style fit (§2 screen 8) | |
| 13 | **Style DNA card** — their styles as shares, a palette, three materials; shareable to WhatsApp | Delight and reach (§18.4) | |
| 14 | **Swipe your style** on phones | More signal in less time (§18.3) | |

## P4 — Delight and return visits

| # | Item | State |
|---|---|---|
| 15 | **The reveal counted down** — "Verified studios: 18 → at Premium: 7 → … → for you" | |
| 16 | **Welcome back** — "one new studio fits your brief since Tuesday" | |
| 17 | **Possession countdown** in "Your home" — "Keys in 84 days", with the plan laid against it | |
| 18 | **Studio intro video** on the match card | |
| 19 | **"Their work like yours" on the card itself**, not only beside it | |
| 20 | **"Built in 9.6 seconds"** — a live stopwatch on the quote build | |
| 21 | **Fold `/prepare` into "Your home"** — drop its duplicate floor-plan upload | |
| 22 | **Tracker site photos, and studios posting updates themselves** | |

## P5 — The bigger immersive pieces

| # | Item | State |
|---|---|---|
| 23 | **Material close-ups** — every spec opens a photo, the cheaper alternative, and the price difference per sq ft | |
| 24 | **Ask your quote** — "Why is Akara's kitchen ₹60,000 more?", answered only from their numbers and checked | |
| 25 | **Walk the quote on your floor plan** — tap a room to see its lines | |
| 26 | **Your home, assembling** — the brief's side panel becomes a picture of their home | |

## Waiting on the owner (not in the queue)

Google / Apple / Meta credentials · WhatsApp template · the named expert and
hours · benefit terms (cashback, referrals, cab, shoot, hamper) · the 3D tool
· "one band up" yes/no · bands with or without GST · a lawyer's read of
`/privacy` · running `npm run db:deploy` · the Pinterest board (item 10).
