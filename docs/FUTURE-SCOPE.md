# Future scope

Everything deliberately deferred, why, and **what has to be true before we build
it**. This file exists so deferred work stays a decision rather than becoming an
accident — the failure mode is that in six months nobody remembers whether
escrow was skipped on purpose or just forgotten.

**Rules for this file**

- Nothing gets deferred without a trigger written down. "Later" is not a trigger.
- If a deferred item is already implied by live copy, that is a bug, not a
  roadmap entry. Fix the copy today.
- When something ships, move it out of here and into `CHANGELOG.md`.

---

## 1. Escrow — deferred to ~Sprint 7

**What it is.** Client funds held by an RBI-compliant licensed partner,
releasing to the studio only on customer approval of each milestone.

**Why deferred.** It is the heaviest thing in the plan — a licensed partner, a
contract, a dispute process, a payments integration — and we cannot design it
well before watching twenty real projects run. Three months of monitored
delivery tells us the real milestone structure, which is exactly its input. The
legal work runs in parallel instead of blocking a sprint.

**What we do instead (v1, live).** A **monitored milestone plan**. We author the
schedule, the customer pays the studio directly, the studio uploads site
photographs and material invoices per stage, we verify against the quote, and we
publish the variance. Roughly 80% of the trust value, ~10% of the legal work,
and **no client funds touch us, so no licensing question.**

**Triggers — all must be true**

- [ ] Escrow partner contracted, sandbox access working
- [ ] Legal sign-off that the structure is RBI-compliant and we never hold funds directly
- [ ] 20+ projects completed on monitored milestone plans, so the schedule is drawn from reality
- [ ] Dispute policy written and published (see §4)

> ⚠️ **Live copy must never imply we hold money until this ships.** The homepage
> says "we verify and hold the schedule — we do not hold your money, and we
> won't say otherwise until we do." That sentence is load-bearing. See
> `MilestoneTrack.tsx`, which carries the same warning.

**Tell the pilot studios at signing that escrow is coming.** Not holding their
money makes onboarding the first eight easier — right up to the month it
changes, when it feels like something being taken away. Same lesson as the
pricing ladder: an always-stated plan is an easy transition, a surprise is a
fight.

---

## 2. Subscription billing — after the pilot 20

**What it is.** Tiered monthly plans replacing the pilot commission —
Signature ₹1,00,000/mo (5 guaranteed projects), Verified ₹40,000/mo (2), Listed
free.

**Why deferred.** The pricing ladder only works in one direction. The pilot runs
at 3.5–4% (≈₹35–40k per project) so the subscription reads as a **volume
discount** at ≈₹20k per project, not a price rise.

**Triggers**

- [ ] 20 projects signed, with a published delivery record to price against
- [ ] Allocation engine can actually deliver the guaranteed volume
- [ ] Contract defines "project" as **a signed contract, not a qualified lead** — the 10× ambiguity that will otherwise break the relationship
- [ ] Make-good defined: shortfall rolls forward as credit, never a cash refund

**Schema already present.** `Subscription` and `AllocationPeriod` in
`prisma/schema.prisma`.

---

## 3. Material margin via Hauspire — Sprint 8+

**What it is.** 8–15% on modular, hardware and lighting routed through preferred
supply. Likely larger than subscription revenue at scale — it is where Livspace
gets its ~51% gross margin.

**Why deferred.** Needs the quotation builder (§6) and real supply agreements
first.

**Non-negotiable governance.** Hauspire is backend-only: no studio profile, no
ranking, never surfaced to customers. Ownership **disclosed once in writing** in
the studio agreement, and the factory is **never mandated**. If it wins volume on
price and lead time, nobody objects; if it wins by default, everyone eventually
does — and forty Pune studios all know each other.

---

## 4. Dispute resolution and removal policy — Sprint 5

**Why it matters now.** The first serious dispute will arrive inside the first
twenty projects. Improvising the policy in that moment is how platforms lose both
sides at once.

**Must define before launch, publicly:** what triggers suspension, what triggers
permanent removal, who decides, and what the studio's appeal is. Upheld disputes
stay on the profile permanently — we do not delete a record to make the roster
look better.

---

## 5. Warranty product — Phase 3, not before

**What it is.** We underwrite delay and material-substitution risk for a 2–4% fee.

**Why deferred.** This makes us an insurer. Pricing it without loss data is
gambling.

**Trigger:** 100+ completed projects of claims history.

---

## 6. Quotation builder — Sprint 5–6

See [`QUOTATION-BUILDER.md`](./QUOTATION-BUILDER.md) for the full plan, revised
after reviewing the existing Hauspire quotation app. Large parts port directly:
the product catalogue structure, the four price types, the auto-build engine,
and the domain constants.

**Carry one rule out of that document into everything else:** Hauspire's rates
are used for *structure*, never as any studio's default prices. Seeding a
platform catalogue with the cofounder's factory pricing is setting market prices
in favour of a business we own, and pricing is where a studio's margin lives —
it would do more damage there than the supply conflict in §3. Studios load their
own rates. Aggregate benchmarks are anonymised and only once no single studio is
identifiable.

---

## 7. Native apps via Capacitor — after web is stable

**Why deferred.** Store presence is a trust signal, not a functional need; the
web flow has to be right first.

**Start the Apple Developer enrolment now** — it takes weeks and becomes the
blocker otherwise. Apple rejects thin web wrappers under Guideline 4.2, so the
wrap must carry real native capability: camera for site photos, push for
milestone approvals, native share. We need all three regardless.

---

## 8. Second city — only after Pune is deep

**Trigger:** 40 studios and ~200 projects/month in Pune, with the verification
playbook written down.

This business has **zero network effect across cities** — a Bangalore studio is
worthless to a Pune homeowner. Width before depth is the most expensive mistake
available here.

---

## 9. Languages — Phase 3

Marathi and Hindi. Strings should be externalised as we go; retrofitting i18n is
miserable.

---

## 10. 3D / AR visualisation — deliberately last, possibly never

**Why.** Modsy raised $73M building exactly this and shut down in 2022. The
visualisation was never why customers stayed or left. It competes for the same
engineering months as the things that are actually the product.

**Trigger:** customers ask for it unprompted, repeatedly. Based on the complaint
corpus — which is about delays, material substitution and refunds — they will not.

---

## 11. ML in matching — not before 500 completed projects

The engine is deliberately rules-based and explainable. A customer who cannot
check the reasoning does not trust the score, and at this stage transparency is
worth more than accuracy. When it does change, bump `ENGINE_VERSION` — stored
matches must never be reinterpreted under new weights.

---

## Never

Not deferred. Ruled out.

- **Lead resale / paid placement.** The moment ranking can be bought, the match
  score is a lie the customer eventually detects — and the honest ranking is the
  only differentiation we have. This is what destroyed Magicbricks' credibility.
- **Fabricated or unlabelled social proof.** Testimonials from projects completed
  *before* the platform must be labelled as such, never presented as
  platform-verified outcomes.
- **Flattering defaults for missing data.** An unmeasured value renders as "not
  enough data yet". Always.
