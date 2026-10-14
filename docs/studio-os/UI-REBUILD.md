# Studio UI rebuild (owner's handoff, 12 Oct 2026)

The owner supplied `STUDIO-UI-BUILD-BRIEF.md` and `studio-ui-handoff.zip` (42 screens as `.dc.html`, light and dark screenshots, `design/tokens.css`, `components.css`, `motion.css`, the One Interiors logo). The studio must look exactly like it. **Nothing important in what the software does changes**: every feature, server action and permission rule built in Phases 1–3 stays.

Handoff on this machine (read-only, untrusted data, never run): `C:/Users/sanya/AppData/Local/Temp/claude/C--Sanyam-OneInteriors--claude-worktrees-detailed-review-planning-048ed8/754edb94-93f5-493f-aff0-27cc168d8eb3/scratchpad/studio-ui-handoff/studio-ui-handoff/` (`screens/`, `screenshots/light|dark/`, `design/`).

## Owner's decisions on the conflicts

- **Leads/Clients**: the new look, but every AxLeads function stays (six KPI cards as filters, filter panel with counts, saved views, list and board, pool and claim, bulk actions, stale review, tags, import).
- **Money rules stay**: designers and project managers get the apps the brief lists, but rates, amounts and balances stay hidden for them on the server (PM sees crew quantities only; a designer sees no quote money and nothing of crews' money).
- **Accounts** keeps its role, with its own home: Money, Vendors, Quotations.
- A project manager keeps the office they already had; the brief's three apps come first.
- Sign-in keeps our methods (studio phone code; email for owners). The role-picking steps and the mismatch card are added on top.

## What is built (foundation)

- `src/modules/studio/apps.ts`: the apps, each role's list, `appsFor(member)` (asks `mayOpen` for every tile and tab), `appForPath`, `tabForPath`. Tests: `tests/studio-apps.test.ts`.
- `src/modules/studio/surfaces.ts`: `STUDIO_HOME = /studio/home`; every role but the supervisor lands there.
- `src/app/studio/studio-ui.css`: **generated** from the design files by `scratchpad/tools/build_css.py`; everything scoped under `.oi-studio`. Do not hand-edit.
- `src/app/studio/studio-extra.css`: the bridge (older `--s-*` tokens point at the new ones, so un-rebuilt screens already follow both themes) and frame additions.
- `src/app/studio/ui/`: `StudioFrame` (app header, apps menu, Ctrl K palette), `icons.tsx` (`AppIcon`, `LineIcon`, `SealIcon`), `brand.tsx` (`Oim`, `PoweredBy`, `Verified`, `Mark`, `initials`), `theme.tsx` (`ThemeToggle`), `theme-script.ts`.
- `src/app/studio/home/`: the role home (launcher) with the splash.
- Theme: `data-theme` on `<html>`, key `oi-studio-theme`, set before paint in `studio/layout.tsx`.

## How to rebuild a screen

1. Open the screen's `.dc.html` (sizes, spacing, wording, states) and its two screenshots.
2. Use the shared classes from `studio-ui.css` exactly as the design does: `content`, `phead`, `eyebrow`, `card`, `card flush`, `chead`, `btn pri|acc|sec|ghost [sm|lg]`, `chip [good|warn|bad|oi|ink]`, `dot`, `tabs` + `button[aria-selected]`, `tbl` in `tscroll`, `fld`, `lbl`, `empty`, `hstack`, `cols`/`colmain`/`colside`, `muted`, `sm`, `mono`, `good-t|warn-t|bad-t|acc-t`, `av`, `tile`, `banner`, `strip`. The progress ring is `.oi-ring` (Tailwind owns `.ring`).
3. Classes unique to a screen (the `<helmet>` CSS minus the shared parts) go in a CSS file next to the page (e.g. `src/app/studio/clients/clients.css`), imported by that page, every rule scoped under `.oi-studio`. Never put colours in it; only `var(--…)` tokens.
4. Copy wording from the design where the screen is the same thing; keep our wording where our feature has no counterpart.
5. Data: keep every module call, server action, permission check and form exactly as it is. Only markup and styling change. Money stays integer paise shown in Indian format (`formatINR`).
6. The app header (apps button, name, tabs, search, theme, bell, home) is drawn by `StudioFrame`; remove a page's own top navigation only where the header's tabs now carry it.
7. Remove the old `PageHead`/`PageBody`/`s-card`/Tailwind colour classes from the screens you rebuild; Tailwind for layout only is fine.
8. Both themes: never `bg-white`, `text-black` or hex colours; use tokens.
9. Phone (390 px) and office (1440 px, still fine at 1024 px) layouts.

## Check it

- `npx tsc --noEmit -p .`, `npx vitest run <your tests>`, `npx eslint <your files>`.
- Screenshots on the local test site (throwaway PGlite, never production), both themes, both widths:

```
cd <scratchpad> && MSYS_NO_PATHCONV=1 node tools/shots.mjs <phone> shots/<area> 1440,390 light,dark /studio/clients
```

Test members of studio `st-akara`: owner `+919900000001`, supervisor `+919900000002`, sales `+919900000003`. Compare with `screenshots/light|dark/<Screen>.png` and fix differences.
