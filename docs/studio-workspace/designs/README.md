# Screen designs

Exported from the "One Interiors App — v1 screens" design canvas on 11 Oct 2026.

## How to read these files

- Each `.dc.html` file is **one screen mockup**, not production code. Read it for layout, copy, states and interactions, then build the real screen in the app's own components and the existing `.studio-app` / customer styles.
- The markup is inside `<x-dc>`. `{{name}}` holes and `<sc-for>` / `<sc-if>` blocks are filled from the `renderVals()` method in the `<script type="text/x-dc">` block at the bottom. That script holds the sample data, the per-state copy (including the Hindi and Marathi strings on the sign-in screen) and the interactive behaviour (ticks, mic states, tabs).
- `href="Something.dc.html"` links show the intended navigation between screens.
- Image paths like `/_blob/…` point to the design tool's asset store and will not load outside it. Use placeholder images.
- `./support.js` is the design tool's runtime and is not included. The files are not meant to run on their own.
- Phone screens are 390×844. Office screens are fluid desktop pages designed at 1440 wide.
- Names, flats, prices and studios (Priya, Teakline Studio, Flat 1204 Baner, Ramesh) are sample data, not real.
- `canvas.json` is the canvas index: screen titles, positions and the designers' notes.

## Studio side — what this feature builds

| File | Screen | Brief phase |
|---|---|---|
| `studio/StudioSignIn.dc.html` | Studio 1 Sign in (phone) | 1 |
| `studio/SiteToday.dc.html` | Site mode 1 My sites today | 2 |
| `studio/SiteUpdate.dc.html` | Site mode 2 Post today's update | 2 |
| `studio/SiteSnag.dc.html` | Site mode 3 Fix a snag | 4 |
| `studio/StudioProjects.dc.html` | Office 1 Projects, needs attention | 1 |
| `studio/StudioProject.dc.html` | Office 2 Project workspace | 1 (Plan), 2 (Site log), 4 (Snags), 5 (Payments) |
| `studio/StudioDecision.dc.html` | Office 3 New decision | 5 |
| `studio/StudioTeam.dc.html` | Office 4 Team and roles | 1 |

## Customer side — screens the studio work feeds

The whole customer app is included for context. These are the ones this feature has to make real, because they read what the studio records:

| File | Screen | What it needs from the studio side |
|---|---|---|
| `customer/Main.dc.html` | Home | Phase 2 — Home "Today on site" card; 3 progress; 5 decision + payment cards |
| `customer/Tracker.dc.html` | Project | Phase 3 — reads stages, checklist, dates |
| `customer/Decision.dc.html` | Decision with a deadline | Phase 5 — reads the studio decision, family votes |
| `customer/Snags.dc.html` | Snags (inside Project) | Phase 4 — raise and confirm snags |
| `customer/Feed.dc.html` | Site | Phase 2 — reads the daily update |
| `customer/Home3D.dc.html` | 3D view (inside Site, full-home only) | Phase later — from checklist per room |
| `customer/Locker.dc.html` | Home locker (inside Me) | Phase 5 — reads documents and materials |
| `customer/Notifications.dc.html` | Notifications | Phase 2–5 — generated from the event log |
| `customer/Timelapse.dc.html` | Your home's story (timelapse) | Phase later — from same-corner photos |

Everything else in `customer/` (quiz, matches, quote, GEIO, coins and the other engagement screens) is context only and out of scope for this feature.
