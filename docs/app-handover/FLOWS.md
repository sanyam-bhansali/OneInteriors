# Flows and rules

## The customer's journey in stages

```
First launch: Opening video → Welcome → Name → Quiz 1–7 → Style DNA → Matches → Phone + OTP → Quote → Compare → Expert call
                                                                                       │
Stage 1 · Choosing (signed in, no project yet)  ◀───────────────────────────────────┘
   Meet studios → site measurement → Final quote → Sign
                                                     │
Stage 2 · Unlock moment  ◀────────────────────────────┘
Stage 3 · Building (full app): Home · Project · GEIO · Site · Me
```

**Returning users:** a short logo, then sign in (phone + OTP; Google or Apple later). They land on the stage their account is in.

## Stage 1 — Choosing (PLAN, awaiting Sanyam's approval; not in the designs yet)

Between booking the expert call and signing there is no project, quote, site feed or tracker. So:

- **Bottom bar:** Home · Studios · GEIO · Me. Project and Site are hidden.
- **Home becomes "Your next steps".** A checklist with one black button on the current step:
  1. Book the expert call
  2. Talk to Meera
  3. Meet your studios (visits and measurement)
  4. Review final quotes
  5. Sign
  
  It also shows a GEIO card.
- **Studios tab:** the 3 matches, their first quotes, Compare, all 14 studios, saved studios.
- **"What you get when you sign":** locked cards with blurred previews for site photos, tracker, snags, 3D (full-home only), Locker, timelapse and coins. Each says "Unlocks when you sign with a studio".
- **"See a sample home"** (optional): the real Home screen on demo data, with a permanent "Sample project" label.
- **Still works:** GEIO, Me (profile, language, family, dream board, coins earned so far) and notifications for next actions.

## Stage 2 — Unlock

The Sign success screen becomes "Your project is unlocked". The Project and Site tabs slide into the bar, and "Open my project" leads to Home.

## Rules that apply everywhere

- **3D is for full-home orders only.** Kitchen & wardrobes, one-room and renovation orders never see the "View in 3D" button. In the designs, the `fullHome` tweak on Site shows this.
- **Stage status and overall status are separate,** and both are always shown, e.g. "Carpentry · on track" and "Overall · 4 days late". Never show one without the other.
- **Plans** (Self-managed free vs Assured paid, about 1.5% of the project, minimum ₹5k, cap ₹75k) are **on hold**. Don't build plan screens yet.
  - Some copy still promises Assured-level service: Snags "Fixed by a date, or we chase it" and Tracker "Your expert checks each stage". Flag it; don't remove it.
- **GEIO:**
  - It never promises a price, date or discount. Those go to Meera, with the context attached.
  - Every answer ends with one next step.
  - It speaks English, Hindi and Marathi.
  - The AI runs on the server only. No keys in the app.
- **Coins:**
  - Never usable on the studio's bill.
  - No cash-out.
  - They expire 12 months after handover.
  - Daily limits apply.
  - Referral coins arrive only when the friend signs.
- **The expert (Meera)** is on One Interiors' payroll and earns the same whichever studio is picked. Say so wherever she appears.
- **Payments** go directly to the studio. The app tracks them and keeps receipts in the Locker.
- **The opening video** plays on first launch only.
