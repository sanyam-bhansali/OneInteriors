# What AXGEN's onboarding does, and what /apply/start should take from it

Written 22 September 2026, from six screenshots of the AXGEN client
onboarding flow.

---

## The honest first observation

**These two things are not the same kind of screen, and the difference
decides how much of it transfers.**

AXGEN's flow runs *after* the client has been invited by name, has a plan
already set up for them, and has agreements to sign. They are committed
before the first screen. Every step can therefore be small, because
nobody is deciding whether to leave — they are working through a list.

`/apply/start` is a **cold application from a stranger**. Nothing has been
agreed. The person can close the tab at any point and lose nothing, which
is exactly what makes a long form dangerous and also what makes naive
step-splitting dangerous: a multi-step form hides the end, and a stranger
who cannot see the end assumes it is longer than it is.

So the patterns below transfer, but two of them have to be inverted for a
cold audience, and I have marked those.

---

## What actually makes it feel alive

### 1. A stepper with three states, and the green accumulates

`1 → 2 → 3 → 4`, with labels. Done steps go **green with a tick**, the
current one goes **solid dark**, the rest stay grey outlines. The line
between them fills in behind you.

This is the single biggest difference and it costs nothing. Our form has
no progress model at all: five headed sections and a submit button, and
the only way to know how far in you are is to look at the scrollbar.

The ticks are the part that matters. They are a record of work already
done, and they make stopping feel like losing something — which is the
honest version of a progress bar, because they only appear once the work
is genuinely finished.

### 2. One decision per screen

Plan. Documents. Business. Review. Each screen asks for exactly one thing
and says what that thing is in a heading of four or five words.

Ours asks for fifteen fields at once under five headings. Even with only
five of them required, the *appearance* is of a long form, and appearance
is what somebody decides on in the first three seconds.

### 3. It shows what has been done FOR you before asking for anything

Step 1 is not a question. It is "Your Plan — here's what your team has set
up for you", with an Active badge and ticked features. They receive
something before they give anything.

This is the same finding as Bark's example lead and Airbnb's earnings
estimate in `docs/ONBOARDING-RESEARCH.md`, arrived at independently. It is
the most reliably good idea in this whole area.

**Inverted for us:** we have nothing set up for an applicant yet — that is
the point of applying. What we *can* put first is the thing the research
already recommended: the demand panel, or at minimum the introduction card
that already sits on `/apply`. Not a plan, but not a question either.

### 4. Time is stated before the work

"This takes about 5 minutes." Named up front, on the screen where the
decision to continue is made.

We say "About 10 minutes" under the apply button. That is right and it
should be repeated *inside* the form, per step, so the number stays true
as they go.

### 5. The buttons are sentences

"This looks good, continue." Not "Next". It reads as a person agreeing
rather than a form advancing, and it tells you what you are agreeing to.

### 6. Identity is confirmed, not assumed

"Signing as [avatar] ghostmodeinitiated / ghostmodeinitiated@gmail.com."
Small, and it removes the most common anxiety in any signing flow: *is
this going on the right account?*

**Ours has a version of this worth stealing:** the email they type is the
address the acknowledgement goes to, and it is the one thing that, typed
wrong, makes us look like we ignored them. Echoing it back at the end —
"we'll write to ..." — is free.

### 7. The end state is explicit and dated

"You're All Set! Your team is reviewing your submission... You'll receive
an email when everything is ready."

Ours already does this well — the confirmation says a week, either way,
with a reason. That copy is good and should survive the rebuild intact.

---

## What I would NOT take

**The four-step split as-is.** AXGEN can afford four screens because their
user is already committed. For a cold application, every extra screen is
another place to leave, and the research is explicit that Bark — the
closest analogue, a cold supplier signup — uses **three**.

**Anything that hides how much is left.** A stepper solves this only if
the total is visible from the first screen. "Step 1 of 3" from the start,
never a spinner-style reveal.

**Ceremony for its own sake.** No confetti, no celebratory interstitials.
The audience is a studio owner deciding whether we are worth their
Tuesday, and `docs/RESEARCH-BRIEF-ONBOARDING.md` rules this out
explicitly.

---

## The plan for /apply/start

Three steps, not four. Fifteen fields unchanged — this is a re-sequencing,
not a re-scoping, and nothing new is asked for.

```
1  You and the studio     tradeName*, contactName*, email*, phone*,
   ~2 minutes             legalName, website, instagram

2  Where you work         localities*  (all 64, by zone)
   ~1 minute

3  Your practice          yearsActive, teamSize, minLakhs, maxLakhs,
   ~4 minutes             gstin, about, howHeard
                          → review, then send
```

Why this order:

- **The five required fields are all in steps 1 and 2.** Somebody who
  completes two short screens has already given us everything we strictly
  need; step 3 is entirely optional and can say so. That is the opposite
  of the usual shape, where the easy questions come first and the
  commitment creeps up.
- **Localities earns its own screen.** Sixty-four checkboxes in six zones
  is the single heaviest thing on the page, and sharing a screen with
  anything else makes both look worse.
- **The optional step is last and labelled optional**, so the end is
  visible from step one and the last screen is the least demanding rather
  than the most.

### What each step gets

- A stepper: grey → dark → green tick, with labels and the total visible.
- A heading of four or five words, and one line under it.
- A truthful per-step time estimate.
- A sentence for a button: "That's us, continue" / "Send it to One
  Interiors".
- Back always available, and never destructive.

### Two things AXGEN does not do that we should

**Save as you go.** `docs/ONBOARDING-RESEARCH.md` quotes the sharpest line
in the DesignerUp piece, about Acorns: *"you can't pause and finish
later."* A studio owner interrupted by a site visit currently loses
everything. Draft the form to `sessionStorage` on every change and restore
it on load, and say so on screen. It is an hour of work and it is the
single most common reason a busy person's form is never finished.

**Echo the email back before sending.** One line on the last step: "We'll
write to `sanyam@…` — check that is right." The cheapest possible
insurance against the one mistake that makes us look like we ignored
somebody.

---

## The constraint the implementation must respect

**One `<form>`, one submit, one server action.** The steps are a view over
a single form, not four forms feeding a state machine. Every field stays
mounted; only the current step is visible.

That keeps `submitApplicationAction` and its validation completely
unchanged, keeps browser autofill working across the whole application,
and means a step boundary can be moved later by editing one array rather
than by rewiring state.

The one consequence to handle: a `required` attribute on a hidden field
makes the browser refuse to submit and refuse to focus it, so per-step
validation is ours to do in JavaScript — with the server's own validation
still the thing that actually decides.
