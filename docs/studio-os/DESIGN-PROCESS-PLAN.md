# Design process: plan for approval

*Source: the owner's meeting with Hauspire's design team on 24 Oct 2026. Written 25 Oct 2026. Nothing below is built yet.*

Hauspire moves every project onto the software on **Tuesday 27 Oct**. This plan covers every change discussed in that meeting:
- what already exists and is reused;
- what is new;
- the decisions taken (each is marked **Decision**, and any of them can be overruled);
- how each screen looks;
- the order of work.

---

## 0. What already exists (so we change, not rebuild)

| Area | Already there | Missing |
|---|---|---|
| Design steps | 19 Hauspire design steps. Each has an owner (Designer / PM / Client …), days after the previous step, a payment lock (Design advance / Design closure), "needs a file", and a star. They are editable in Settings → Design. | Effort hours. The pre-execution boundary. Exact days: today the days are stretched to fit a fixed design length. Tasks under a step. Moving a step up or down. |
| Lateness | A step is late when its date has passed. | A step waiting on a payment is counted late (bug: "BOQ 7 days late · opens when Design closure is recorded"). A late step never asks for a reason. |
| Client view | % done, plus the starred steps **with dates**. | All steps shown, **without dates**. |
| Documents | One document table with versions R1, R2, a "Share with client" tick, and client "Approve / Ask for changes" on 2D, furniture and 3D. | Fixed document types for everything. Auto-naming. Versions like 1.0 / 1.1 / 2.0. "Approved" becoming the final. A finals-only view. A Documents app. A handover pack. A notice to the studio when the client answers. Files above 3.8 MB or other than PDF/image. |
| Quotations | Sales final, a Design final copied from it, a compare page. | The design comparison is not tied to the sales-final snapshot. No handover notes at sales final. No Premium / Essential / Luxe category. |
| Home / projects | My work (Today / Next 3 days / Missed), and My design / My execution / My snags on the Design page. | Design listed before site in My work. Those three tabs on Projects. Star priority. A Documents tile. |

---

## 1. Design steps: the new template

### 1.1 The steps (2BHK)

| # | Step | Group | Days after previous | Effort | Owner | Client sees |
|---|---|---|---|---|---|---|
| 1 | Project allocation + mood board | Design | 0 | 30 min | Designer | ✓ |
| 2 | Site visit | Design | 1 | 2 h | Designer | ✓ |
| 3 | 2D layout | Design | 1 | 2 h | Designer | ✓ |
| 4 | 2D approval | Design | 0 | 0 | **Client** | ✓ |
| 5 | Final 2D | Design | 0 | 1 h | Designer | ✓ |
| — | 💰 **Design advance** *(payment stage, renamed from "First draft payment")* | | | | | |
| 6 | First draft (3D) | Design | 4 | 16 h | Designer | ✓ |
| 7 | Design changes | Design | 1 | 4 h | Designer | ✓ |
| 8 | Material selection | Design | 2 | 4 h | Designer | ✓ |
| 9 | Final 3D & renders | Design | 3 | 4 h | Designer | ✓ |
| 10 | Final 3D approval | Design | 0 | 0 | **Client** | ✓ |
| 11 | Final design quotation | Design | 3 | 30 min | Designer | ✓ |
| 12 | Final quotation meeting | Design | 1 | 3 h | Designer | ✓ |
| 13 | Post-quotation changes | Design | 1 | 4 h | Designer | ✓ |
| 14 | Final design approval | Design | 0 | 0 | **Client** | ✓ |
| — | 💰 **Design closure** *(payment stage)*: working drawings stay locked until it is paid | | | | | |
| 15 | Site visit with electrician & carpenter | Design | 3 | 3 h | Designer | ✓ |
| 16 | Electrical drawings & quotation | Design | 1 | 2 h | Designer | ✓ |
| 17 | Working drawings | Design | 5 | 24 h | Designer | ✓ |
| 18 | Working drawings approval | Design | 0 | 0 | **Client** | ✓ |
| 19 | Working drawings final | Design | 2 | 2 h | Designer | ✓ |
| | **— Pre-execution: from here the execution team owns the project —** | | | | | |
| 20 | Site validation | Pre-execution | 3 | 4 h | **PM** | ✓ |
| 21 | Post-validation changes | Pre-execution | 1 | 2 h | Designer *(support)* | ✓ |
| 22 | Post-validation approval | Pre-execution | 0 | 0 | **Client** | ✓ |
| 23 | Final documentation for handover | Pre-execution | 3 | 4 h | Designer *(support)* | ✓ |
| 24 | Agreement signed (e-sign) | Pre-execution | 0 | 0 | **Client** | ✓ |
| 25 | Handover to execution team | Pre-execution | 3 | 2 h | **PM** | ✓ |
| 26 | Material procurement & vendor alignment | Pre-execution | 5 | — | **PM** | ✓ |

**Removed:** BOQ, and "Manual and factory work split, material list". Their content becomes documents: the material list and the factory cut list (§3).

**Total:** design steps 1–19 add up to **28 days and 72 hours of effort** (2BHK), plus however long the client takes to pay the two design payments. Pre-execution adds **15 days**. These are the meeting's numbers. The meeting gave no effort for three steps, so I set them: site visit 2 h, site visit with electrician & carpenter 3 h, electrical drawings & quotation 2 h. Change them if they're wrong.

### 1.2 Decisions on the steps

**Decision 1: days are exact, never stretched.**
- Each step's date is the previous step's date plus its days.
- Today's code stretches the days to fit a fixed design length. That goes.
- "0 days" means the step falls on the same day as the previous one.

**Decision 2: size changes days and effort together.**

| Size | Multiplier |
|---|---|
| 1BHK | ×0.8 |
| 2BHK | ×1 |
| 3BHK | ×1.2 (the meeting's "add 20% everywhere") |
| 4BHK and larger | ×1.4 |

- The plan's running total is scaled and rounded, not each step on its own, so the whole plan is exactly the factor longer or shorter (a 2 BHK's 43 days become 34 / 52 / 60 for 1 / 3 / 4 BHK).
- A 0-day step stays 0.
- 1BHK and 4BHK were not discussed. These multipliers are my choice.

**Decision 3: weight % comes from effort.**
- A step's share of design progress is its effort ÷ total effort. For example, First draft is 16 h out of 72 h, so about 22%.
- Client steps (0 h) carry 0%. They still show and tick.
- No more hand-set weights.

**Decision 4: client steps are the client's delay, automatically.**
- A Client-owned step that is late is recorded as a **client-side delay**.
- Where a matching approval exists, it ticks itself:

| Step | Ticks when |
|---|---|
| 2D approval | The client approves the 2D in the app |
| Final 3D approval | The client approves the 3D |
| Working drawings approval / Post-validation approval | The client approves the working drawings |
| Final design approval | The client signs the Design final quotation |
| Agreement signed | The client e-signs |

- The studio can still tick these by hand, with a note, when the client approved on WhatsApp or in person.

**Decision 5: steps waiting on a payment are never late.**
- Steps 6–14 wait on the Design advance; steps 15–19 wait on Design closure.
- They show **"Waiting on Design advance"** in grey, not in Missed.
- Their dates start counting from the day the payment is recorded.

**Decision 6: a late step needs a reason.**
- When a step's date has passed, ticking it (or opening it) asks: **whose delay?** (Client / Us) and **why?** (pick a reason, or type one). This uses the delay table that already exists.
- The owner and the design head get a **Delays** list, so someone can check each reason.

**Decision 7: tasks under steps.**
- A step can carry small tasks (checkboxes).
- The template seeds one task the meeting named: under step 1, *"Send the requirement form with the mood board"*.
- The design team can add more task templates in Settings, and add tasks on any project.
- Tasks don't change % or dates. They are a to-do list inside the step.

**Decision 8: add or move a step anywhere.**
- Every step has ↑ ↓ and "Add a step below", both in Settings (the template) and on one project.
- A new step asks for its name, owner, days after the previous step, and effort.

**Decision 9: site visit date.**
- The designer proposes a date, and the client sees **Confirm / Ask for another day** in the app.
- If the client asks for another day, the move is recorded as the client's delay.
- On the day, the designer's My work shows "Site visit today: Ramesh Kulkarni, 11 am".
- No possession yet: tick the step with the note "No possession, visit later". Edge cases go in notes, as agreed.
- Customers get the app notice only, never WhatsApp (a standing rule).

**Decision 10: the pre-execution boundary.**
- Ticking **Working drawings final** (step 19) ends design. The project moves to a new phase, **Pre-execution**, and the **internal execution clock starts**.
- In pre-execution, the PM owns the project.
- The designer sees only steps 21 and 23, marked **"Support"**. Her design list shows a line: *"Design done. Pre-execution with Arjun (PM). You support: post-validation changes, handover documents."*
- Ticking step 26 (material procurement & vendor alignment) moves the project to **Execution**.
- Today, sending the Design final moves a project straight to execution. That changes: sending the Design final only records the quote changes (it still does that today).

**Decision 11: the client sees every step, no design dates.**
- In the client's app, design and pre-execution show **every step** with ✓ done / ● now / ○ next, plus the % bar.
- **No dates** for design or pre-execution steps, and no "late".
- Payment-locked steps say "Starts after your Design advance".
- Execution keeps today's milestone tracker with dates. The meeting was about design only.

**Decision 12: switching running projects (Tuesday).**
- A one-time screen, **Settings → Design → Move projects to the new steps**, lists every design and pre-execution project.
- For each, the design team picks **"Where is this project now?"** from the 26 steps.
- Everything before that step is ticked as *"before the switch"*. That needs no photo or file, and it is marked so in the history.
- Dates for the remaining steps start from today.
- Old ticks are kept on the project's history.
- This is the "sit together and set each project's stage" from the meeting.

### 1.3 How it looks: studio, project → Design tab

```
 Design · 38% · day 9 of 28                       [ Delays (2) ]  [ ⋯ Edit steps ]
 ─────────────────────────────────────────────────────────────────────────────────
 ✓ Project allocation + mood board    Neha      30m    Thu 1 Oct   ☐ 1 task done
 ✓ Site visit                         Neha       2h    Fri 2 Oct   "No possession — later"
 ✓ 2D layout                          Neha       2h    Sat 3 Oct
 ✓ 2D approval                        Client     —     Sat 3 Oct   approved in app
 ✓ Final 2D                           Neha       1h    Sat 3 Oct
   💰 Design advance — received 5 Oct
 ● First draft (3D)                   Neha      16h    due Fri 9 Oct · 1 day late  [Tick] [Reason]
 ○ Design changes                     Neha       4h    Sat 10 Oct
 ○ …
   💰 Design closure — not yet
 ◌ Site visit with electrician…       Neha       3h    waits for Design closure
 ─── Pre-execution · Arjun (PM) owns from here ───
 ◌ Site validation                    Arjun      4h    …
```

### 1.4 How it looks: client app → My home → Design

```
 Design  ▓▓▓▓▓▓▓░░░░░░░░  38%
 ✓ Mood board         ✓ Site visit        ✓ 2D layout     ✓ You approved the 2D
 ✓ Final 2D           ● First draft (3D) — your designer is working on it
 ○ Design changes     ○ Material selection   ○ Final 3D   ○ Your approval of the 3D
 ○ … (all steps, no dates)
 Steps after "Final design approval" start after your Design closure payment.
```

---

## 2. My work, Projects and lateness

1. **Design before site.** In My work, design steps come before site steps in Today, Next 3 days and Missed.
2. **Locked steps move out of Missed** into a small grey **"Waiting on payment (3)"** line (Decision 5). This fixes Neha's "BOQ 7 days late".
3. **Projects gets the three tabs.** /studio/projects gets **My design · My execution · My snags** for everyone. Today they exist only on the Design page.
   - Design = the Design phase.
   - Execution = Pre-execution + Execution + Closure.
   - Snags = Snags + Warranty.
   - Finished projects drop off on their own. Phases move automatically, as today, plus the pre-execution move above.
4. **Priority, ★ to ★★★★★.**
   - Every project card gets a 1–5 star priority. The owner, the PM and the project's designer can set it. Everyone sees the same stars.
   - Lists sort by stars first, then by days late.
   - **Decision:** stars are one studio-wide value per project, not a personal one. That way the design head and the designer see the same priority.
5. **Category on the card.** The project name becomes *"Premium · Kolte Patil Life Republic · 2BHK"* (§4.3).
6. **Design head.** A designer can be marked **Design head** in Settings → Team. A design head sees every designer's projects and their next 3 days, as in the meeting: "Gunjan's quotation is due, Dhanashree's 3D is due".
   - **Decision:** this is a tick on the member, not a new role.

---

## 3. Documents

### 3.1 One list of document types

| Type | Short name | Needs client approval |
|---|---|---|
| 2D layout | `2D` | ✓ |
| 3D & renders | `3D` | ✓ |
| Working drawings | `WD` | ✓ |
| Electrical drawings & quotation | `ELEC` | ✓ |
| Quotation (PDF) | `QUOTE` | ✓ (the existing quote sign-off) |
| Material list | `MATLIST` | — |
| Factory cut list | `CUTLIST` | — |
| Other | `DOC` | — |

**Decision:** the two upload places today, the Design tab's "Drawings and 3D" and the Home locker, become **one "Documents" card** with this one picker. Receipts, agreements and warranties keep their automatic entries.

### 3.2 Names and versions: automatic, nobody types them
- You pick the **type** (and a room, if it's per room), then upload. The software names it:
  `2D_Hauspire_RohanKulkarni_2026-10-25_1430_v1.0.pdf`
  (type _ studio _ client _ date _ time _ version). The studio part is the "Name on quotations" setting, which already exists.
- Uploading the same type again makes **v1.1**, then v1.2, and so on.
- When the client **approves**, that version becomes **v2.0** and is tagged **Approved**. The next change round is v2.1, and the next approval is v3.0.
- Because the name is generated, a wrongly named file can't happen, so there is nothing to reject. (The meeting's "reject bad names" is met by never letting people name files.)
- Downloads keep the generated name.

### 3.3 Sharing and approval
- Each upload has **"Share with Rohan now"** (already there).
  - Ticked: the client gets one app notice.
  - Unticked: a team-only draft.
- For types that need approval, the client sees **Approve / Ask for changes**.
  - The studio now gets a notice when the client answers (new).
  - The step ticks itself (Decision 4).
- Tags on each version: **Draft · Shared · Approved · Changes asked**.

### 3.4 Where documents show
- **Project page → Documents card: finals only.** One line per type: the latest **Approved** version, or, if none is approved yet, the latest shared version marked "Waiting for Rohan". **"Show all versions"** opens the repository for that project.
- **Documents app** (a new tile for Owner, PM and Designer): one **folder per project** you can see, each holding every version of every type, newest first, with search.
- **Client app → Home locker:** the latest shared version of each type, with its Approved tag. The client never sees old versions.

### 3.5 Handover pack
- On step 23, "Final documentation for handover", and on the project page, a **"Handover documents"** button gathers the final of each type into one list, with **Download all (.zip)**.
- **Decision:** step 23 can't be ticked until the pack has a final for WD, ELEC, MATLIST and CUTLIST. 2D, 3D and the quotation are included when present.

### 3.6 Bigger files
- Today the limit is 3.8 MB, PDF and images only.
- **Decision:** files go straight to storage, as floor plans already do, **up to 50 MB**. Allowed: PDF, JPG, PNG, WebP, XLSX, DWG, SKP, ZIP.
- This needs the storage bucket's size limit raised in Supabase. That is a one-line setting **you** change (I'll give the exact step).

### 3.7 How it looks: project → Documents card

```
 Documents                                   [ + Upload ]  [ Handover documents ]
 2D layout        v2.0  Approved ✓   25 Oct   ⬇
 3D & renders     v1.2  Waiting for Rohan     ⬇
 Working drawings —     not yet
 Electrical       —     not yet
 Material list    v1.0  Draft (team only)     ⬇
                                               Show all versions →
```

---

## 4. Quotations

### 4.1 Design final is compared with the sales final, always
- The Design final is made **from the frozen sales-final revision**, the one the booking was made on, not from the quote's live lines.
- Every design revision (R1, R2 …) compares against that **sales final**, never against the previous design revision. That covers the compare page, the builder's "Final" tab and the PDF. This is what the client needs: *"what changed since what you booked"*.
- Sales quotes keep comparing with the previous revision, as today.

**Decision: the designer makes the Design final** (the meeting: "designers will manage"). Today only the owner or PM can, so the designer on the project gets that right.

The flow is the one described in the meeting:
1. Open the project's sales final.
2. Press **Make design final**.
3. Edit it.
4. Send it.
5. Revise and resend as needed.

### 4.2 Handover notes at sales final (compulsory)
- **Mark as sales final** gets a **"Notes for the design team"** box, and you can't mark without it. Example: *"Budget 3 lakh, consider Luxe laminates; client wants a study in bedroom 2…"*.
- A 🎙 **voice note** button sits next to it (up to 2 minutes). The recording is kept and plays on the project.
- The notes appear at the top of the project's Design tab, **"From sales (Swarupa, 12 Oct)"**, so the designer starts with them.
- **Decision:** typing is required. Voice is an extra for now, because **speech-to-text is not switched on in the app yet**: there is no provider, and turning one on is a cost decision for you (§7). When it is on, a voice note fills the text box by itself.

### 4.3 Category: Essential / Premium / Luxe
- The quote builder header gets a **Category** pick: Essential · Premium · Luxe. It is copied to the Design final and to the project.
- The category shows on the quote, the quote list, the project name and the project cards.
- **Decision:** the meeting said Premium projects get **2 rounds of design changes**. The "Design changes" step shows *"Round 1 of 2"* for Premium. A third round is allowed, but it is flagged on the Delays list as a studio-approved extra. Essential and Luxe rounds weren't set, so they show no limit until you set them.

---

## 5. Smaller items from the meeting

| Item | Plan |
|---|---|
| Designer's home: no Quotations tile | Remove it from the designer's default tiles. The design final is reached from the project. |
| Ctrl K search finds projects, quotes, documents and notes ("Rohan 2D layout", "iron bar") | Extend search from clients only to projects, quotations, documents (by type and client) and team notes. **Phase 3.** |
| "After signing in, open: My home / Projects" | Already there (Profile). Nothing to build. |
| Step and task list a little smaller on home | Tighten My work rows (6 shown, "show more"). Small CSS. |

---

## 6. Order of work

| When | What | Needs from you |
|---|---|---|
| **Sun 25 – Mon 26** (phase 1, needed for Tuesday) | §1 all: new template, exact days, size multiplier, effort and %, client steps, payment-lock fix, late reasons, tasks, move and add steps, pre-execution phase, client view without dates, **"Move projects to the new steps" screen**. §2.1–2.3. | Run 1 database migration. Approve this plan. |
| **Mon 26 – Tue 27** (phase 2) | §3 documents: types, auto-name, versions, approval tags, studio notice, finals-only card, Documents app, handover pack, 50 MB uploads. Site-visit confirm / postpone (Decision 9). | 1 migration. Raise the bucket size limit in Supabase. |
| **Wed 28 – Fri 30** (phase 3) | §4 quotations: sales-final comparison, design final by the designer, compulsory notes with voice, category. §2.4–2.6: stars, category on cards, design head. §5 search. | 1 migration. The speech-to-text decision. |

Each phase:
- is tested on the laptop's test copy (never production);
- goes out as one PR;
- is then checked by me in "View as" for a designer, the PM and the owner.

On Tuesday morning the design team uses the **Move projects** screen with you to place every project.

---

## 7. Your decisions (defaults in bold, used unless you say otherwise)

1. 1BHK ×0.8, 4BHK ×1.4? **Yes.**
2. Approval steps tick themselves from the client's in-app approval, with a hand tick allowed? **Yes.**
3. Design ends at "Working drawings final", and the execution clock starts there? **Yes.**
4. Material procurement & vendor alignment is the last pre-execution step, and its tick starts execution? **Yes.**
5. The designer can make the Design final? **Yes.**
6. Stars are one shared value per project? **Yes.**
7. "Design head" is a tick on a designer? **Yes.** Who is it: Renuka?
8. Uploads up to 50 MB, including DWG, SKP and XLSX? **Yes.**
9. Speech-to-text for voice notes: switch on a provider (a small cost per minute), or **text only for now, voice kept as audio**?
10. Design-change rounds for Essential and Luxe: **not limited** until you set them.
11. Two numbers that were unclear in the meeting:
    - Design changes after the first draft: **1 day** (said both 2 days and "next day").
    - Changes between Final 3D and its approval: **no extra step** (only in the first pass).
