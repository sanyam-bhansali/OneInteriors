# Reading a studio's quotations into a product master

Owner's decision, 10 Oct 2026: the web app never reads quotations through the
API. Uploads only store files. The owner reads them in **their own Claude app**
(Claude Code on the laptop, under their plan), and the result is a
**product master** — the one price list that prices the studio's own quotes and
the customer's first quote. Ops approves it; the studio checks and confirms it;
then the studio's quotation builder opens.

Trigger it by asking Claude, in this repo: **`/read-quotations <studio-slug>`**
(or "read Hauspire's quotations").

## The steps

1. **Fetch.** `npm run quotes:fetch -- <slug>` downloads every file the studio
   sent (all archives not refused) to `.quote-reading/<slug>/` with a
   `manifest.json`. Byte-identical copies are listed once (`duplicateOf`). The
   folder is git-ignored; these are a studio's private prices.
2. **Read.** Claude opens each unique file (PDF, image, spreadsheet) and pulls
   out every line: room, product, work code, details, width × height (mm) or
   quantity / sq ft / running ft, and amount. Note each quotation's BHK and
   date. Skip anything that is not a quotation, and say so.
3. **Build the master.** Group the lines into products (one product per
   distinct thing the studio sells, named the way the studio names it), and
   for each work out the rate from the studio's own figures — see *Rates*
   below. Write `.quote-reading/<slug>/product-master.json`.
4. **Show the owner.** A short table: product, unit, rate, how many quotations
   it came from, and anything doubtful. The owner can ask for changes.
5. **Submit.** `npm run quotes:submit -- <slug> .quote-reading/<slug>/product-master.json`
   files it as a PENDING run (it supersedes an older pending run).
6. **Approve.** On `/ops/<slug>` → "Product master from their quotations": fix
   any figure, drop any line, then *Approve all*. That writes it into the
   studio's product master and asks the studio to check it. Their builder
   opens when they confirm.

## `product-master.json`

```json
{
  "quotationCount": 56,
  "notes": ["Two files were floor plans, not quotations."],
  "unmapped": ["Site supervision charges"],
  "products": [
    {
      "name": "Base Cabinets",
      "code": "MO-01",
      "unit": "AREA",
      "rate": 2580,
      "details": "Below-counter kitchen cabinets. BWP plywood carcass, HDHMR shutters with laminate finish, G-profile handles and soft-close hinges.",
      "rooms": ["Kitchen"],
      "defaultWidthMm": null,
      "defaultHeightMm": 750,
      "standard": true,
      "rules": { "useRun": true },
      "fromQuotations": 51,
      "evidence": { "median": 2580, "p25": 2450, "p75": 2700 }
    },
    {
      "name": "Base Cabinets - Tandems (Horizontal)",
      "code": "NM-01",
      "unit": "UNIT",
      "rate": 10000,
      "details": "Soft-close horizontal tandem pull-out drawers.",
      "rooms": ["Kitchen"],
      "defaultQty": 3,
      "standard": true,
      "fromQuotations": 44
    },
    {
      "name": "Painting - 3BHK (Emulsion)",
      "code": "NM-01",
      "unit": "UNIT",
      "rate": 85000,
      "rooms": ["Whole home"],
      "standard": true,
      "rules": { "bhk": "3BHK" },
      "fromQuotations": 19
    }
  ]
}
```

### Fields

| Field | Meaning |
|---|---|
| `name` | The studio's own name for the product. Unique in the file. |
| `code` | `MO-01` / `MODULAR` = factory-made carpentry (gets the modular discount). `NM-01` / `ONSITE` = everything done on site. |
| `unit` | How it is priced. `AREA` = ₹ per sq ft of W × H (mm). `SQFT` = ₹ per sq ft of floor/ceiling area. `RFT` = ₹ per running foot. `UNIT` = ₹ each. |
| `rate` | Rupees, per the unit above. Never paise, never a range. |
| `details` | The material/spec line the client reads, in the studio's words. |
| `rooms` | Where it can go: `Kitchen`, `Bedroom`, `Living`, `Study`, `Bathroom`, `Whole home`. |
| `defaultWidthMm` / `defaultHeightMm` | Typical size for `AREA` items (e.g. wardrobe 1500 × 2100, base cabinet height 750). |
| `defaultQty` | Typical count for `UNIT` items. |
| `standard` | In the studio's standard build — the auto first quote includes it. |
| `rules` | First-quote rules: `useRun` (kitchen width = kitchen run), `perBath` (one per bathroom), `perBed` (one per bedroom), `balcony` (only with a dry balcony), `bhk` (`"1BHK"`–`"4BHK"`: only for that size of home), `sqft` / `rft` (default area / length for SQFT / RFT items). |
| `fromQuotations` | How many of the studio's quotations the rate came from. Under 8 is flagged to ops as thin. |
| `evidence` | Optional: median, quartiles, a few example quote numbers. Shown to ops. |

## Rates

- **AREA:** for each quotation line, `rate = amount ÷ (W mm × H mm ÷ 92,903.04)`.
  Use the median across quotations. Lines with no size do not give a rate.
- **SQFT / RFT:** `amount ÷ sq ft` or `amount ÷ running ft`.
- **UNIT:** the amount per piece; the median across quotations.
- **Per-BHK lump sums** (painting, electricals): make one product per BHK,
  each with `rules.bhk`.
- Read **list prices before discount**. The modular discount, professional fee
  and GST are the studio's pricing settings, applied by the builder — never
  baked into a rate.
- Prefer the studio's most recent quotations when rates changed over time, and
  say so in `notes`.
- A product seen in only one or two quotations still goes in, with an honest
  `fromQuotations`; ops decides.

## What not to do

- Do not invent a product the studio never quoted, or a rate from a market
  average. An empty line is better than a borrowed one.
- Do not print, paste or share a studio's rates outside this flow.
- Do not run it on the web app or through the API key.
