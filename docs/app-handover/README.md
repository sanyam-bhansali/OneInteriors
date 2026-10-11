# One Interiors app — design handover (11 Oct 2026)

Everything decided for the customer phone app, in one folder, for whoever builds it next (Claude Code or a person).

**Source of truth:** the One Interiors app design on claude.ai (version 86, "One Interiors App — v1 screens"). This folder is an export of it. If the two ever disagree, ask Sanyam which is newer.

**Where the code is:** the Expo phone app (`mobile/`) and the latest backend work live in the worktree branch at `.claude/worktrees/detailed-review-planning-048ed8`. The main folder doesn't have `mobile/` yet. Merge that branch before building.

## Read in this order

| File | What it is |
|---|---|
| `CLAUDE-CODE-PROMPT.md` | The prompt to paste into Claude Code. Start here. |
| `DESIGN-SPEC.md` | Colours, type, buttons, cards, motion, bottom bar, accessibility rules |
| `SCREENS.md` | All 42 screens: what each does, what it links to, and where it lives in `mobile/` and the website's `/app` |
| `FLOWS.md` | The customer journey in stages, plus the rules (full-home-only 3D, plans on hold, choosing stage) |
| `DECISIONS.md` | Product decisions: plans, Know Your Home, GEIO, coins, the feature list |
| `COPY-AND-LANGUAGES.md` | Text that must not drift, plus all Hindi and Marathi strings (draft, Sanyam reviews) |
| `SAMPLE-DATA.md` | The example customer and project used in every screen, and which names are placeholders |
| `STORE-CHECKLIST.md` | Everything needed for the Play Store and App Store |
| `designs/` | The 42 screens as clickable HTML, `canvas.json` (positions and flow order) and a viewer |

## Looking at the designs

```bash
npx serve docs/app-handover/designs
# open http://localhost:3000 — every screen, grouped by stage, clickable
```

Each `*.dc.html` is a self-contained screen. Markup is the layout, the `<style>` block is the look, and the `class Component` script at the bottom is the behaviour: state, taps and animations. Links between screens are ordinary `href`s, so you can click through the whole journey.

Photos are stored in the design tool and show as empty boxes here. For real images, Sanyam exports the screens as images or PDF from the design's Download menu into `designs/screenshots/`.
