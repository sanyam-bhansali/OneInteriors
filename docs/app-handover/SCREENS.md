# All 42 screens

**Columns:**
- **Design file** is in `designs/`.
- **mobile/** is the Expo app file. "new" means it doesn't exist yet.
- **web /app** is the website's route, which already has data hooks (`components/app/useMyProject.ts`, `useJourney.ts`, `useAppData.ts`) worth reusing.

## Row 1 — First visit, from the opening to the expert call

| # | Design file | Screen | What it does | Goes to | mobile/ | web /app |
|---|---|---|---|---|---|---|
| 0 | Intro | Opening | Black, then a bulb video, then the logo with a gold sheen. "Tap anywhere to continue". **First launch only**; after that, a short logo then Home. | Start | `index.tsx` (splash) | — |
| 1 | Start | Welcome | Website hero: EN / हिं / मरा switch, large black logo, "Pune, 14 verified studios" pill, centred headline, "Find your designer", "I already have an account", tilted photo collage | Name; sign-in | new | `/app` |
| 2 | Name | Your name | First name only. Phone is asked later. | Q1 | new | `/app/name` |
| 3–9 | Q1–Q7 | Quiz | Q1 home type, locality, carpet area · Q2 scope · Q3 finish level · Q4 2–3 styles (photo tiles) · Q5 household counters and toggles · **Q6 priorities ranked by tapping circles in order** · Q7 involvement | next Q | new | `/app/q/[n]` |
| 10 | StyleDNA | Style DNA | "60% Warm modern, 40% Scandinavian" share card, +100 coins toast | Matches | new | `/app/style` |
| 11 | Matches | Matches | Essential / Premium / Luxury switch, 3 studios with count-up scores, "Why they suit you", "Edit my answers", "See all 14" | Studio, Studios, Phone | new | `/app/matches` |
| 12 | Phone | Phone and consent | +91 number, WhatsApp OTP, consent to share the brief with the 3 studios (required) and offers (optional) | Quote | `sign-in.tsx` | `/app/verify` |
| 13 | Quote | Quote | Studio tabs, line items, rolling total. "First quote, from each studio's own rate card. Final after measurement, usually ±5%. Valid till 8 Nov." "Ask GEIO" link | Compare | new | `/app/quote` |
| 14 | Compare | Compare | Dark "In plain words" panel, then a 3-column comparison: total, board, counter, time, lateness, checks | Expert | new | `/app/compare` |
| 15 | Expert | Expert call | Pick a day and time with Meera (paid by One Interiors, never by a studio). Booked state has confetti, then the next steps. | Visits | new | `/app/expert` |

## Row 2 — Choosing your studio

| # | Design file | Screen | What it does | Goes to | mobile/ | web /app |
|---|---|---|---|---|---|---|
| 16 | Studios | All studios | 14 studios, filters (Premium tier, Near Baner, Usually on time), best match first | Studio | new | `/app/studios` |
| 17 | Studio | Studio profile | Photo hero, "Verified by One Interiors", tiles (92 match, 4.6★, 48 homes), "Why they suit you", tabs: Past homes / Checks (15) / Delivery record / Reviews (verified only), save heart | Phone (quote) | new | `/app/studios/[slug]` |
| 18 | Visits | Choose 2 · Meet studios | Teakline visit and measurement booked; book Chitra's workshop visit; note from Meera | FinalQuote | new | `/app/choose` |
| 19 | FinalQuote | Choose 3 · Final quote | ₹18,40,000, "same as your first quote", the 3 changed lines that balance out, "37 unchanged", what gets locked when you sign | Sign; GeioHuman | new | `/app/choose/quote/[id]` |
| 20 | Sign | Choose 4 · Sign | Summary, 3 payment stages (40/40/20), agreement link, consent tickbox, "Sign with Aadhaar OTP". Signed state: "Your home starts now" | Main | new | `/app/choose/sign/[id]` |

## Row 3 — After signing (bottom bar: Home · Project · GEIO · Site · Me)

| # | Design file | Screen | What it does | Goes to | mobile/ | web /app |
|---|---|---|---|---|---|---|
| 21 | Main | Home | Photo hero, coin chip, bell, status chips (stage vs overall), stage track. Then: decision card, Today on site, weekly challenge, next payment, Home of the month, society circle | Notifications, Coins, Decision, Feed, SpotMistake, Homes, Refer | `(tabs)/home.tsx` | `/app/home` |
| 22 | Tracker | Project | Tinted tiles (Overall 4 days late / Paid ₹7.36 L of 18.4 / Handover 14 Dec), Snags and Decision tiles, savings meter, stage timeline with "Share this milestone" | Snags, Decision, Milestone | `(tabs)/project.tsx` | `/app/project` |
| 23 | Decision | Decision with a deadline | Photo, due date and its cost, 3 finish swatches with prices, **family votes**, "Ask Meera", confirm | — | `decision/[id].tsx` | `/app/decision` |
| 24 | Snags | Snags (inside Project) | Photograph a problem, Open / Fixed tabs, fix-by dates, handover walk-through note | — | `snags.tsx` | `/app/snags` |
| 25 | Feed | Site | "View in 3D" (full-home only), timelapse card, week strip, today's photos and note, a day nobody worked (counts toward the delay) | Home3D, Timelapse | `(tabs)/site.tsx` | `/app/site` |
| 26 | Home3D | 3D view | Isometric flat: Today vs Finished design, rooms coloured done / in progress / next, worker figures, tap a room for details. **Full-home orders only.** | — | new | `/app/3d` |
| 27 | Me | Me | Profile, home card, Locker, Notifications, Coins, Family, Dream board, Refer, language (EN/हिं/मरा), notification switches, help, privacy, log out | many | `(tabs)/me.tsx` | `/app/me` |
| 28 | Locker | Home locker (inside Me) | Search, materials used, documents (agreement, quote, drawings, receipts, warranties) | — | `locker.tsx` | `/app/locker` |
| 29 | Notifications | Notifications | Today / Earlier, unread dots, links to the source | — | `notifications.tsx` | `/app/notifications` |

## Row 4 — GEIO (One Interiors Expert Guide)

| # | Design file | Screen | What it does | mobile/ | web /app |
|---|---|---|---|---|---|
| 30 | GeioHome | Welcome and voice | Orb, "Good evening, Priya", one-line intro, EN / हिंदी / मराठी, home facts, 4 suggestion cards, composer: camera · text · mic (side) · send. Mic opens "Listening…" with a waveform | `(tabs)/geio.tsx` | `/app/geio` |
| 31 | GeioChat | Site answer | Streaming answer, site photos card, next-step card, follow-up chips | 〃 | 〃 |
| 32 | GeioPhoto | Photo check | Customer's photo, then "What I see" with Common / Needs fixing. Buttons: Add to snag list, Ask Meera | 〃 | 〃 |
| 33 | GeioHuman | Hand over to Meera | GEIO won't promise prices or dates. Context card passed to Meera, Call / Chat, Meera's reply marked as a person | 〃 | 〃 |

## Row 5 — Rewards and delight

| # | Design file | Screen | What it does | mobile/ | web /app |
|---|---|---|---|---|---|
| 34 | Coins | Home Coins | Count-up balance, 7-day streak, refer card, rewards from partners, recent earnings, ways to earn | new | `/app/coins` |
| 35 | Refer | Refer and society circle | "Give 5,000. Get 5,000.", Ivy Towers circle 2 of 3 flats, invite code, invites list, WhatsApp invite | new | `/app/refer` |
| 36 | SpotMistake | Spot the mistake | Weekly site photo with tap zones: a wrong tap gives a hint, the right one gives a ring, +50 and an explanation | new | `/app/challenge` |
| 37 | Timelapse | Your home's story | Crossfading site photos with play/pause, stats, share | new | `/app/story` |
| 38 | Milestone | Milestone share card | Confetti, a tilted card "Walls, wiring and floors: done.", WhatsApp / Instagram | new | `/app/engage`? |
| 39 | Family | Family | Members and what each can do, open family vote, invite on WhatsApp | new | `/app/family` |
| 40 | DreamBoard | Dream board | Two-column saved photos with notes, GEIO reading of your taste, shared with the studio | new | `/app/dream` |
| 41 | Homes | One Interiors Homes | Home of the month, filters, real homes with budget, studio, likes, save | new | `/app/homes` |

**Not designed:** "Try it in my room" (AR). It needs the camera and comes later.
