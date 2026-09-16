# The studio CRM and vendor ledger — scope

Requested as *"we provide a basic crm, vendor management etc"*, alongside the
simplification of the studio dashboard. This is the scoping note, written before
any code, because the request as stated could mean four very different products
and three of them should not be built.

---

## 1. Why this is not a fourth page

The three shipped studio pages — home, calendar, listing — are all about **one
studio's presence on our marketplace**. Every number on them is something we
generated: briefs we matched them into, meetings we arranged, a listing we
publish.

Clients and vendors are the other thing entirely: **running the practice**.
Those records exist whether or not we exist. A studio's vendor list includes the
carpenter they have used for nine years and the glass supplier they found last
month, and none of it came through One Interiors.

That distinction is not pedantry — it decides three things:

1. **Data scope.** Presence data is derived from our tables and read-only to the
   studio. Practice data is theirs, written by them, and we are custodians of it.
2. **Deletion.** A studio that leaves the marketplace stops being listed. Their
   client and vendor records are their business records, and under DPDP they are
   a data fiduciary for their own clients, not us. We need an export before we
   need a delete.
3. **Price.** The revenue model already has this at **₹5,000/month as a separate
   SaaS line**, not bundled into the listing subscription. Building it into the
   dashboard for free removes a revenue line that the five-year model counts on
   for 100 customers.

**So: a fourth nav item, `/studio/practice`, gated behind its own subscription
flag, sharing auth and nothing else.** Not a section of the listing page.

---

## 2. What "basic CRM" has to mean here

An interior studio in Pune does not need Salesforce. Watching what Hauspire
actually does by hand, the job is four things:

| Need | What it replaces today |
| --- | --- |
| A list of clients with which stage each is at | A WhatsApp pinned-chat list and memory |
| What was quoted, what was agreed, what is paid | The quotation app's PDFs plus a notebook |
| A list of vendors with rates and what is owed | The vendor ledger spreadsheet |
| Which vendor is on which site this week | A group chat |

Anything beyond those four is a feature we imagined. Email sequences, lead
scoring, pipeline forecasting, a mobile app — all of it is the same mistake the
first dashboard made, one layer further out.

### 2a. Clients

One row per client, with a stage: **enquiry → quoted → booked → in progress →
handed over → closed**. Six stages, because the payment schedule in the
quotation app already has six and they should not disagree.

Fields: name, phone, site address, BHK, source (One Interiors / referral /
walk-in / Instagram), value, stage, next action + date, notes.

The one thing that earns its keep: **the next action and its date.** A client
list without it is a list. With it, the home page can say "4 clients need you
this week", which is the only reason anyone opens a CRM twice.

**Clients that came through us are created automatically** at the introduction,
pre-filled from the brief. That is the hook: the studio's own pipeline starts
partly filled, by us, which is worth more than any feature on the list.

### 2b. Vendors

One row per vendor: name, trade (carpentry, false ceiling, electrical, painting,
plumbing, glass, modular hardware, stone), phone, their rate for that trade,
notes.

Then **work orders**: vendor + client + scope + agreed amount + payments made +
balance. The balance is the whole point — "what do I owe Ramesh" is the question
this answers, and it is the question the Hauspire vendor-ledger spreadsheet
exists to answer today.

Rates entered here are **not** the studio's rate card and must never be confused
with it. The rate card is what we quote customers at; these are the studio's
costs. Mixing them would publish a studio's margins, which would end the
relationship on the day someone noticed.

### 2c. What is deliberately out of the first version

- Invoicing and GST. A half-correct invoice is worse than none, and this is a
  regulated document.
- Payments in or out. We are not moving money.
- Material inventory. Nobody asked and it is a warehouse product.
- Anything multi-user. One studio account, one set of records, until a studio
  asks for a second seat.

---

## 3. Schema sketch

Five tables, each with the standard treatment — `ENABLE`/`FORCE ROW LEVEL
SECURITY` and `REVOKE ALL FROM anon, authenticated` in the same migration that
creates them, per the rule that has held for every table so far.

```
Client        studioId, name, phone, address, locality, propertyType,
              source, stage, valuePaise, nextAction, nextActionOn,
              briefId?, introductionId?, notes, createdAt, updatedAt

ClientNote    clientId, body, createdAt, authorId

Vendor        studioId, name, trade, phone, ratePaise, rateUnit, notes

WorkOrder     studioId, vendorId, clientId?, scope, agreedPaise,
              status, createdAt

VendorPayment workOrderId, amountPaise, paidOn, mode, reference
```

Money in integer paise throughout, `fromDb`/`toDb` at the Prisma boundary. The
balance on a work order is `agreedPaise − sum(payments)` computed on read, never
stored — a stored balance and a payment list will disagree within a month.

`Client.studioId` is the tenancy boundary and **every single query must be
scoped by it**. This is the first place in the product where one studio's rows
sitting in the same table as another's could leak; the matching side never had
this problem because nothing there is studio-authored.

---

## 4. Sequencing

Launch is **16 September**. None of this is launch-blocking, and starting it now
would put half-built tables in front of the first studios.

1. **After launch, once a studio has asked for it twice.** Not before — the
   product is cheap to build and expensive to build wrong, and two real requests
   will specify it better than this document does.
2. **Vendors before clients.** The vendor ledger is the one Hauspire already
   maintains by hand, so there is a real workflow to copy and a real user to
   check it against on day one.
3. **Clients second**, with the auto-creation from introductions, because that
   is what makes it stickier than the spreadsheet it replaces.
4. **Then, and only then,** the home-page line: "4 clients need you this week".

---

## 5. The honest risk

A CRM is the most commonly built and least commonly used feature in vertical
SaaS. Studios already run on WhatsApp, and WhatsApp is free, already installed,
and already has the client in it.

The only version that beats WhatsApp is the one where **we put data in it that
WhatsApp cannot have** — the brief, the moodboard, the quote, the introduction,
pre-filled and current. A blank CRM with a nice table is a spreadsheet with worse
keyboard shortcuts, and it will be abandoned in three weeks.

So the test for every feature here is: *does this row arrive already filled in?*
If not, it probably should not ship.
