# Running the customer flow in a studio meeting

The deck has three "switch to the software" slides. This is what to do when you
get to the first one.

Read it once before your first meeting. After that the only part you need is
[The walk](#the-walk).

---

## 1. Run it locally, not on production

```
cd C:\Sanyam\OneInteriors
npm run dev
```

Then open **http://localhost:3000**.

`.env.development.local` is already set up for exactly this and Next loads it
ahead of `.env.local` in development, so `npm run dev` puts the app into
**fixtures mode**: `DATABASE_URL` is empty, which means nothing you type
reaches the production database, no email is sent, and no WhatsApp message
goes out. Walk the flow as many times as you like.

**What that costs you:** the roster is fixture studios, and quotes are priced
from the placeholder rate table in `src/data/filed-rates.ts` rather than a real
studio's filed rates. The arithmetic on screen is real; the rates behind it are
ours, not a partner's.

**If someone asks whose rates those are** — and it is the best question in the
meeting — the honest answer is: *"Yours, once you have filed them. What you are
seeing now is a pilot rate card built from a real Pune archive."* Then move on.

### Do not do this instead

Do **not** delete `.env.development.local` to "see real data". `.env.local`
holds the production connection string, the live Resend key and the live
WhatsApp token. A demo brief typed in a meeting would become a real row in the
production database, and the email would go to whatever address you typed.

Do **not** demo from the deployed site in front of a studio. Same problem, plus
you are one bad network away from a dead meeting.

---

## 2. Before they arrive

Five minutes, and it is the difference between a demo and an apology.

1. **Start the server early.** First boot compiles for a while, and each page
   compiles the first time you visit it. Walk the whole flow once yourself
   before the meeting so every route is warm. In the meeting it is instant.
2. **Open a second tab on the studio software** (demo 2 and 3), with a
   part-finished onboarding ready and a sample quotation PDF on the desktop to
   drag in. Never upload a real studio's document in front of another studio.
3. **Close everything else.** Your inbox is not part of the pitch.
4. **Know your BHK.** Pick the configuration you will answer with and use the
   same one every time, so you stop thinking about it and watch their face
   instead.

---

## 3. The walk

Five screens. About four minutes. Run it **as the homeowner**, not as the
person who built it.

| # | Where | What to do | What to say |
|---|---|---|---|
| 1 | `/` | Scroll once, slowly. Do not read the page aloud. | "This is what a homeowner lands on." |
| 2 | `/quiz` — **OneBrief** | Answer three or four out loud, then move quickly. | "Nine questions. Notice it is teaching them the words — most people cannot tell you what they want because they do not know what things are called." |
| 3 | the budget question | **Slow down here.** | "This is where they pick their finish level. Those ranges are real rupees for their own carpet area — they are choosing what they want to spend, not guessing." |
| 4 | `/match` — **OneMatch** | Read one match reason aloud. | "Every match comes with the sentence behind it. And nobody can pay to sit higher — that is a contractual promise, not a policy." |
| 5 | the quote — **OneQuote** | Open it. **This is the moment.** Stop talking and let them read. | "That is a full quotation. Built from the studio's own rate card, in about three seconds. Nobody phoned them. The studio was not asked to quote." |
| 6 | `/compare` — **OneCompare** | Show the **materials** row, not just the totals. | "Carcass, shutter, hardware. This is what the arguments are actually about." |

Then stop. Do not carry on into the studio software — that is demo 2 and it
answers a different question.

### The one line that has to land

At step 5, before you move on:

> "By the time you are introduced, they have answered nine questions, chosen a
> budget band with real numbers in front of them, seen a full quotation and
> compared it against two others. You have not quoted. You have not visited.
> You have not spent a Saturday."

---

## 4. Questions you will get, and the answers

**"Whose rates are those?"** — Yours, once filed. Today it is a pilot card from
a real Pune archive. (Do not oversell this. It is the honest answer and studios
respect it.)

**"How accurate is that quote?"** — It is a range, never a single number,
because nobody has seen the flat. It is built line by line from a real rate
card, so it is an estimate made the same way the studio would make it — not a
number we invented to get attention.

**"Can I pay to rank higher?"** — No, and there is a test in the build that
fails if the matching code so much as mentions a subscription. Clause 2.4.

**"What if I do not like the homeowner?"** — You are introduced, not assigned.
Nothing obliges you to take the work.

**"Is this live?"** — The flow is built and running. The roster is being
assembled now, which is why you are in this meeting.

---

## 5. If something breaks

Do not debug in front of them. You lose the room in about ninety seconds.

- **A page will not load** — go back to the deck and keep talking. Say "the
  local copy is being slow, I will send you a link after this." Then do.
- **A quote comes out empty or absurd** — that is the placeholder rate table,
  not the engine. Say so plainly and move to the comparison screen.
- **Anything 500s** — close the tab, carry on from the deck. Write down what
  you clicked; that is worth more than the recovery attempt.

A calm "that is the local copy misbehaving, here is what it does" costs you
nothing. Ten minutes of refreshing costs you the meeting.

---

## 6. What this does not cover

Fixtures mode has no database, so **the studio CRM, the quotation builder, ops
and sign-in are not exercised by it** — those are demos 2 and 3 and they need a
real login. If you want to run those locally too, put a *local* Postgres URL in
`DATABASE_URL` and `DIRECT_URL` and run `npm run db:deploy` against it. Never
point it at production; `prisma/guard-destructive.ts` is the backstop, not the
plan.
