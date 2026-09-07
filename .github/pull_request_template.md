## What and why

<!-- What changed, and the reason. Not a list of files — the reviewer can see those. -->

Refs: #

---

## Definition of done

<!-- From CONTRIBUTING.md §7. Delete any line that genuinely does not apply. -->

- [ ] Types check, lint clean, tests pass
- [ ] New logic has tests — money and matching logic need **unit** tests, not a click-through
- [ ] Works at 360px wide and at 1440px
- [ ] Keyboard reachable, visible focus, labelled inputs
- [ ] Renders correctly in light **and** dark
- [ ] No secrets, no PII in logs, no raw IPs
- [ ] Money in integer paise — **no floats in a money path**
- [ ] Currency renders Indian-style (`₹8,50,000`)
- [ ] Any claim shown about a studio is backed by a real row, not a placeholder

## If this touches money or the trust record

<!-- Escrow, commission, milestones, verification, match score. Delete if not. -->

- [ ] Migration is reversible, or the rollback is written down
- [ ] Append-only tables stay append-only (corrections are new rows)
- [ ] An unmeasured value still renders as "not enough data yet", never a flattering default
- [ ] `ENGINE_VERSION` bumped if matching weights changed
