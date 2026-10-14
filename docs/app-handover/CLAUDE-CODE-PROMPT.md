# Prompt to paste into Claude Code

Open Claude Code in the One Interiors project folder (the one with `src/`, `mobile/` and `docs/`), then paste everything between the lines.

---

We're bringing the One Interiors customer phone app (`mobile/`, Expo SDK 57, expo-router) up to the latest approved design, then getting it ready for the Play Store and App Store.

**Before anything else:** the Expo app (`mobile/`) and the newest backend work exist in the worktree branch at `.claude/worktrees/detailed-review-planning-048ed8`, not yet in the main folder. If `mobile/` is missing where you are, tell me and help me merge that branch first. Don't recreate the app.

**Read first, in this order:**
1. `docs/app-handover/README.md`
2. `docs/app-handover/DESIGN-SPEC.md`
3. `docs/app-handover/SCREENS.md`
4. `docs/app-handover/FLOWS.md`
5. `docs/app-handover/DECISIONS.md`
6. `docs/app-handover/COPY-AND-LANGUAGES.md`
7. `docs/app-handover/SAMPLE-DATA.md`
8. `docs/app-handover/STORE-CHECKLIST.md`

Also read `HANDOVER.md`, `CONTRIBUTING.md`, `docs/MOBILE-APP-PLAN.md`, `docs/CUSTOMER-PLATFORM-PLAN.md` and `mobile/AGENTS.md`, and follow their rules. In particular: **never write secrets into files; `.env.local` is git-ignored and must never be committed.**

**The designs** are in `docs/app-handover/designs/`. Run `npx serve docs/app-handover/designs`, open the index and click through all 42 screens. Each `*.dc.html` holds the exact layout, styles and behaviour (the `class Component` script). Match them closely in React Native: spacing, sizes, colours, copy and motion. Where the website's `/app` route (`src/app/app/*`, `src/components/app/*`) already implements a screen or its data hook, reuse the logic and API calls rather than inventing new ones.

**Work in this order. Stop after each step, show me what changed, and wait for my OK:**
1. **Audit.** List each design screen against `mobile/` (exists / outdated / missing) and against the backend (`/api/app/v1`, Prisma models): what data each screen needs, and whether the API provides it. Flag gaps. Don't build anything yet.
2. **Foundation.**
   - The theme from DESIGN-SPEC.md: colours, Geist and Geist Mono, the 13px minimum size.
   - Shared components: black pill button with arrow disc, soft card, dark card, option pill, circle option, segmented control, tinted tile, status chips, coin, GEIO orb.
   - The bottom bar (Home · Project · GEIO orb · Site · Me), with reduced-motion support.
3. **v1 screens:**
   - Opening (first launch only)
   - Welcome with the language switch
   - Sign-in (phone + OTP)
   - Home, Project, Decision (with family votes shown read-only for now), Snags, Site (3D button only for full-home orders), Me, Locker, Notifications
   - GEIO text chat (server-side AI; no keys in the app)
   - All of these read real data from `/api/app/v1`, with the sample data only in the test build.
4. **First-visit flow:** quiz Q1–Q7 (Q6 ranks by tapping circles in order), Style DNA, Matches (tier switch), Studio profile, All studios, Quote, Compare, Expert booking, then the Choose & sign steps (Visits, Final quote, Sign). Check what the website's `/quiz` and `/app/*` already do first.
5. **Languages:** English, Hindi and Marathi through one i18n layer shared with the website's keys where possible. List every new string for Sanyam to review.
6. **Testing:**
   - Type-check, lint and tests pass.
   - Run on my Android phone (Expo dev build) and in the iPhone Simulator on my MacBook.
   - Check reduce-motion, large text, Hindi and Marathi layouts, and the iPad layout.
   - Give me a short manual test script.
7. **Store preparation:** walk me through STORE-CHECKLIST.md, tell me exactly which accounts and assets you need from me, then set up `eas.json` profiles, icons, splash and permissions. Run `eas build` and `eas submit` only when I say so.

**Later (v1.1), not now:** Home Coins, Refer and society circle, Spot the mistake, Timelapse, Milestone cards, Family invites, Dream board, One Interiors Homes. They're designed (row 5), so keep the data model ready for them.

**Not yet:** the Self-managed / Assured plans, 3D beyond the static view, AR "try it in my room" and GEIO voice.

**On hold, ask me first:** the "Choosing" stage before signing (FLOWS.md, stage 1) isn't approved yet.

If anything in the designs conflicts with the code, the backend or these notes, ask me before choosing. Don't guess.

---
