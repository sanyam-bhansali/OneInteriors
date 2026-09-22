'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { FIELD_WIDTH, type FieldWidth } from '@/components/ui/form';
import { LOCALITIES_BY_ZONE } from '@/modules/brief/types';
import { normalisePhone } from '@/modules/studio/phone';
import {
  submitApplicationAction,
  lookupSiteAction,
  type ApplyState,
  type LookupState,
} from './actions';
import { Stepper } from './Stepper';

const INITIAL: ApplyState = { status: 'idle' };

/**
 * Five steps, and why it is five rather than three.
 *
 * Three steps measured 727, 790 and 974 pixels tall against roughly 370
 * of usable height once the rail, the heading and the button bar were
 * accounted for. Every one of them scrolled, which defeats the point of
 * stepping at all: a step exists so somebody can see the whole of one
 * question and answer it, and a step you have to scroll is just a long
 * form wearing a progress bar.
 *
 * So the work was split further rather than the copy squeezed harder.
 * Five short screens beat three scrolling ones — and the required fields
 * still all sit in the first three, so somebody who stops after step 3
 * has already given us everything we strictly need.
 *
 * `needs` drives the check before advancing. Moving a field between steps
 * is editing this array and nothing else.
 */
/**
 * `needs` is what this step will not let you past without. `owns` is every
 * field the SERVER can reject that lives on this step.
 *
 * The two are not the same list and conflating them was a bug. `needs` is an
 * emptiness check — `missingOn` only asks whether something was typed. The
 * server checks whether what was typed is real: an email that parses, a
 * ten-digit mobile, a GSTIN whose checksum holds. So a malformed-but-present
 * value walks through every step and fails at the end.
 *
 * `owns` is what sends the applicant back to the field that failed. It must
 * name every key `submitApplication` can put in `errors`, including `gstin`,
 * which is optional and therefore appears in no `needs` list at all.
 */
const STEPS = [
  {
    label: 'Studio',
    heading: 'What are you called?',
    lede: 'The name you work under.',
    needs: ['tradeName'],
    owns: ['tradeName'],
  },
  {
    label: 'You',
    heading: 'Who do we speak to?',
    lede: 'One person, so nothing falls between two inboxes.',
    needs: ['contactName', 'phone', 'email'],
    owns: ['contactName', 'phone', 'email'],
  },
  {
    label: 'Areas',
    heading: 'Which parts of Pune?',
    lede: 'We match customers to studios working in their area.',
    needs: ['localities'],
    owns: ['localities'],
  },
  {
    label: 'Numbers',
    heading: 'How big is the practice?',
    lede: 'All optional. Nothing here decides anything on its own.',
    needs: [],
    owns: ['gstin'],
  },
  {
    label: 'Your work',
    heading: 'How would you describe it?',
    lede: 'Plain words beat a brochure. We write the polished version with you later.',
    needs: [],
    owns: [],
  },
] as const;

/**
 * Which step a server-rejected field lives on, or null if nothing claims it.
 *
 * Null is handled rather than assumed away: a new validation added to
 * `submitApplication` without a matching entry in `owns` would otherwise
 * silently route nowhere, which is the failure this whole change is about.
 * An unclaimed key still gets its message printed in the summary.
 */
function stepOwning(field: string): number | null {
  const i = STEPS.findIndex((s) => (s.owns as readonly string[]).includes(field));
  return i === -1 ? null : i;
}

/** Human names for the required fields, for the error line. */
const LABELS: Record<string, string> = {
  tradeName: 'the studio name',
  contactName: 'your name',
  email: 'your email',
  phone: 'your mobile',
  localities: 'at least one area',
  /* Not a required field, so it appears in no `needs` list — but the server
     can still reject it, and the summary needs a name for it. */
  gstin: 'your GSTIN',
};

/**
 * Bumped whenever the fields change shape.
 *
 * A draft written by an older version of this form can no longer be applied
 * safely to a newer one, and the failure is invisible and per-browser: the
 * device with the stale draft cannot submit while every other device can.
 * Changing the key retires every old draft at once, which costs somebody a
 * half-finished form and saves them an application they cannot send.
 */
const DRAFT_KEY = 'oi.apply.draft.v2';

/**
 * The studio application, as a five-step wizard over one form.
 *
 * ## One form, one submit, one server action
 *
 * The steps are a VIEW. Every field stays mounted and only the current
 * step is visible, so the final FormData carries all fifteen fields
 * whichever screen is on show. `submitApplicationAction` is untouched,
 * browser autofill sees the whole application, and a step boundary moves
 * by editing STEPS.
 *
 * ## No FormSection in here
 *
 * The shared `FormSection` puts the question in an 18rem rail on the
 * left and the answers on the right. That is right for a long scrolling
 * form and wrong inside this one: the page already has a left column
 * carrying the context, so a section rail is a column inside a column —
 * and it was the single biggest thing making each step too tall. The
 * step heading says what the section header used to.
 */
export function ApplyForm() {
  const [state, action, pending] = useActionState(submitApplicationAction, INITIAL);
  const err = state.errors ?? {};
  /* `form` is the one key that already renders above the steps on its own. */
  const fieldErrors = Object.entries(err).filter(([k]) => k !== 'form');

  const form = useRef<HTMLFormElement | null>(null);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  /* Whether the phone box had anything in it when the check last ran, so
     "still needed" and "that is not a number" can be told apart. The form is
     uncontrolled, so this is recorded at check time rather than per
     keystroke — nothing here needs to re-render as somebody types. */
  const [phoneTyped, setPhoneTyped] = useState(false);
  const [restored, setRestored] = useState(false);

  /**
   * Draft to sessionStorage on every change, and restore on load.
   *
   * The sharpest line in the onboarding research is the Acorns critique:
   * "you can't pause and finish later." A studio owner interrupted by a
   * site visit halfway through currently loses all of it.
   *
   * sessionStorage rather than local: this is somebody's name, phone and
   * business details and should not outlive the session on a shared
   * machine. Every access is wrapped — private mode throws on the
   * accessor itself, and storage must never take the form down with it.
   */
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, string | string[]>;
      const el = form.current;
      if (!el) return;

      for (const [name, value] of Object.entries(saved)) {
        /**
         * Only names this form actually has, and only in the shape the
         * control expects.
         *
         * Both guards are load-bearing and neither was here.
         *
         * The name went straight into a CSS selector. A saved key with a
         * bracket or a quote in it — from an older shape of this form, or
         * from anything else that has ever written to this key — makes
         * `querySelectorAll` throw a SyntaxError, and the whole restore is
         * abandoned silently.
         *
         * Worse, the shape was assumed. `localities` is a set of checkboxes;
         * if a draft holds it as a string rather than an array, the else
         * branch wrote that string into the first checkbox's `value`. The
         * box then submits a value the server does not recognise, the studio
         * is told to pick an area they can see is already ticked, and the
         * application cannot be sent from that browser — while the same form
         * works perfectly on any device without that draft.
         *
         * A field this form no longer has is skipped rather than restored,
         * which is also why the allow-list is derived from the DOM rather
         * than from a hard-coded list that would drift.
         */
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) continue;

        const nodes = el.querySelectorAll<HTMLInputElement>(`[name="${name}"]`);
        if (nodes.length === 0) continue;

        const isCheckable = nodes[0]!.type === 'checkbox' || nodes[0]!.type === 'radio';

        if (isCheckable) {
          /* A lone string is tolerated as a one-element selection rather
             than written over the control's value. */
          const chosen = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
          nodes.forEach((n) => {
            n.checked = chosen.includes(n.value);
          });
        } else if (typeof value === 'string') {
          nodes[0]!.value = value;
        }
      }
      setRestored(true);
    } catch {
      /* Private mode, or a draft from an older shape. Start clean. */
    }
  }, []);

  function saveDraft() {
    const el = form.current;
    if (!el) return;
    try {
      const data = new FormData(el);
      const out: Record<string, string | string[]> = {};
      for (const key of new Set(data.keys())) {
        /* Skip Next's own fields. A server action injects hidden inputs
           named `$ACTION_REF_1`, `$ACTION_KEY` and similar, binding this
           form to that action for THIS page load. Restoring them later
           writes a stale key over a live one, and the failure looks like
           the submit button doing nothing. */
        if (key.startsWith('$')) continue;
        const all = data.getAll(key).filter((v): v is string => typeof v === 'string');
        if (all.length === 0) continue;
        out[key] = key === 'localities' ? all : (all[0] as string);
      }
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(out));
    } catch {
      /* Storage full or unavailable. The form still works in memory. */
    }
  }

  /**
   * What is still missing on this step.
   *
   * In JavaScript rather than with `required`, and not by choice: a
   * `required` field inside a hidden step makes the browser refuse to
   * submit AND refuse to focus it, so the form dies with "an invalid
   * form control is not focusable" and nothing on screen.
   *
   * `submitApplication` validates all of it again on the server, which
   * is the check that decides. This exists so somebody is told on the
   * screen they are looking at.
   */
  function missingOn(i: number): string[] {
    const el = form.current;
    if (!el) return [];
    const data = new FormData(el);
    /* `string[]`, not the inferred type. STEPS is `as const`, so a step with
       an empty `needs` infers `never[]` and nothing can be pushed onto it. */
    const gaps: string[] = [...STEPS[i]!.needs].filter((name) => {
      const values = data.getAll(name).filter((v) => typeof v === 'string' && v.trim() !== '');
      return values.length === 0;
    });

    /**
     * The one format checked before the end, because it is the one that was
     * costing applications.
     *
     * The division everywhere else in this file is deliberate: the client
     * checks presence, the server checks validity, and a client-side rule the
     * server does not share is how a form refuses something that would have
     * been accepted. This does not break that rule — it calls the SAME pure
     * function the server calls, so the two cannot drift.
     *
     * It earns the exception because a mistyped mobile is not a typo the
     * applicant can see. An email with no @ looks wrong on the screen; a
     * nine-digit phone number looks exactly like a ten-digit one, and being
     * sent back for it three steps later is how somebody gives up.
     */
    const phone = String(data.get('phone') ?? '').trim();
    if (
      (STEPS[i]!.needs as readonly string[]).includes('phone') &&
      !gaps.includes('phone') &&
      normalisePhone(phone) === null
    ) {
      gaps.push('phone');
    }

    return gaps;
  }

  /**
   * A rejected submit must land you on the field that was rejected.
   *
   * ## The bug this fixes
   *
   * Every step stays mounted and hidden, and each field's error renders
   * beside the field. That is right on the step you are looking at and
   * useless on the step you are not: submit from step five and an error on
   * `email` renders into a `hidden` div on step two. Nothing appears, nothing
   * scrolls, the button un-greys, and the form has silently refused you.
   *
   * It was reachable with a perfectly ordinary mistake, because the client
   * gate (`missingOn`) only checks that a field is non-empty while the server
   * checks that it is valid. A mistyped email, a nine-digit mobile or a GSTIN
   * with a bad checksum all pass the first and fail the second — and
   * `submitApplication` sets no `errors.form` for any of them, so the one
   * message that does render above the steps stayed empty too.
   *
   * ## Why it moves the step rather than surfacing the message in place
   *
   * Because the fix has to end with the cursor in the box that is wrong. A
   * summary alone tells somebody their email is malformed while leaving them
   * on a screen with no email field on it, and they then have to work out
   * which of five steps to go back to. The summary below is the belt; this is
   * the braces.
   */
  useEffect(() => {
    if (state.status !== 'error') return;
    const fields = Object.keys(state.errors ?? {}).filter((k) => k !== 'form');

    /* The earliest step with a problem, so somebody fixing several works
       forwards through the form the way they filled it in. */
    const target = fields
      .map(stepOwning)
      .filter((i): i is number => i !== null)
      .sort((a, b) => a - b)[0];

    if (target === undefined) return;

    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    /* After the step has been painted, or the field is still `hidden` and
       refuses focus — the same reason `required` could not be used here. */
    const first = fields.find((f) => stepOwning(f) === target);
    if (!first) return;
    const timer = setTimeout(() => {
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [state]);

  function go(next: number) {
    // Backwards is always free. Nobody should have to fix a field to
    // re-read the one before it.
    if (next < step) {
      setMissing([]);
      setStep(next);
      return;
    }
    const gaps = missingOn(step);
    setPhoneTyped(
      String(new FormData(form.current!).get('phone') ?? '').trim().length > 0,
    );
    setMissing(gaps);
    if (gaps.length > 0) {
      form.current?.querySelector<HTMLElement>(`[name="${gaps[0]}"]`)?.focus();
      return;
    }
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (state.status === 'sent') {
    // The draft has served its purpose. Leaving it would restore a sent
    // application into an empty form on the next visit.
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* Nothing to clean up. */
    }
    return (
      <div className="rounded-[16px] border border-[var(--color-ontrack)] bg-[var(--card,#fcfcfa)] p-8">
        <h2 className="h2 mb-3">Thank you — we&rsquo;ve got it.</h2>
        <p className="m-0 mb-3 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          A confirmation is on its way to the address you gave — check the spam folder if it is
          not there in a minute. We read every application ourselves, and you will hear back
          within a week either way. If it is a no, we tell you why rather than going quiet.
        </p>
        <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          If it&rsquo;s a yes, we&rsquo;ll email you a sign-in link and you&rsquo;ll build your
          profile from there. Expect a call before that.
        </p>
      </div>
    );
  }

  const active = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    /* White card. The page ground is Raw Silk; the thing you are filling
       in sits on Alabaster, so the form reads as a document on a desk
       rather than as more page. */
    <form
      action={action}
      ref={form}
      onChange={saveDraft}
      /**
       * Enter must advance, not submit — and not fire the site lookup.
       *
       * Pressing Enter in a text field activates the form's first submit
       * button. For most of this form that was the ONLY submit button:
       * "Fill this in from my website". So typing an email on step 2 and
       * hitting Enter ran a scrape of whatever was in the website field,
       * burned a rate-limit slot, and did not advance.
       *
       * The lookup is a plain button now (see SiteLookup), and this
       * turns Enter into Continue everywhere except the last step, where
       * submitting is what Enter should do.
       */
      onSubmit={(e) => {
        if (!last) {
          e.preventDefault();
          go(step + 1);
        }
      }}
      /**
       * And Enter has to be handled explicitly, because removing the
       * submit button removed implicit submission with it.
       *
       * A browser only submits on Enter when the form has a default
       * button, or when it has exactly one field. This form has neither
       * on steps 1 to 4 — so after the fix above, Enter did nothing at
       * all. Trading a wrong action for no action is not a fix.
       *
       * A textarea is left alone: Enter there is a new paragraph, which
       * is the one place in this form somebody writes prose. Buttons are
       * left alone too, so Enter still activates the one under focus.
       */
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        const el = e.target as HTMLElement;
        if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
        if (last) return; // Let it submit.
        e.preventDefault();
        go(step + 1);
      }}
      className="rounded-[16px] border border-[var(--color-rule)] bg-[var(--card,#fcfcfa)] p-5 sm:p-7"
    >
      <Stepper
        steps={STEPS.map((x) => ({ label: x.label }))}
        current={step}
        furthest={furthest}
        onGo={go}
      />

      <div className="mb-5">
        <h2 className="h2 m-0 mb-1.5">{active.heading}</h2>
        <p className="m-0 max-w-[48ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          {active.lede}
        </p>
        {restored && step === 0 ? (
          <p className="m-0 mt-2 text-[13.5px] text-[var(--color-ontrack)]">
            We kept what you had already typed.
          </p>
        ) : null}
      </div>

      {missing.length > 0 ? (
        <p
          role="alert"
          className="m-0 mb-5 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14px] text-[var(--color-atrisk)]"
        >
          {/* "Still needed" is wrong for a number that IS there and is not a
              number, so that one case gets its own sentence. */}
          {missing.length === 1 && missing[0] === 'phone' && phoneTyped
            ? 'That mobile number does not look right — ten digits, starting 6 to 9.'
            : `Still needed: ${missing.map((m) => LABELS[m] ?? m).join(', ')}.`}
        </p>
      ) : null}

      {err.form ? (
        <p
          role="alert"
          className="m-0 mb-5 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14px] text-[var(--color-atrisk)]"
        >
          {err.form}
        </p>
      ) : null}

      {/* Outside the step divs, so it cannot be the thing that is hidden.
          Every field error is repeated here as well as beside its field: the
          effect above moves to the first one, and this says how many others
          are waiting, which a single focused field cannot. */}
      {fieldErrors.length > 0 ? (
        <div
          role="alert"
          className="mb-5 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-3"
        >
          <p className="m-0 mb-1 text-[14px] font-semibold text-[var(--color-atrisk)]">
            {fieldErrors.length === 1
              ? 'One thing needs fixing before this can go.'
              : `${fieldErrors.length} things need fixing before this can go.`}
          </p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {fieldErrors.map(([name, message]) => (
              <li key={name} className="text-[14px] leading-relaxed text-[var(--color-atrisk)]">
                <span className="font-medium">{LABELS[name] ?? name}</span> — {message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Every step stays MOUNTED and is only hidden — see the note on the
          component. */}
      <div hidden={step !== 0} className="flex flex-col gap-5">
        <Field label="Studio name" name="tradeName" required error={err.tradeName} width="md" />
        <Field label="Registered name, if different" name="legalName" width="md" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Website" name="website" type="url" placeholder="https://" width="full" />
          <Field label="Instagram" name="instagram" placeholder="@akarastudio" width="full" />
        </div>
        <SiteLookup form={form} onFilled={saveDraft} />
      </div>

      <div hidden={step !== 1} className="flex flex-col gap-5">
        <Field label="Your name" name="contactName" required error={err.contactName} width="md" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Mobile"
            name="phone"
            type="tel"
            required
            error={err.phone}
            placeholder="98765 43210"
            width="full"
          />
          <Field
            label="Email"
            name="email"
            type="email"
            required
            error={err.email}
            width="full"
          />
        </div>
      </div>

      <div hidden={step !== 2}>
        {err.localities ? (
          <p role="alert" className="m-0 mb-3 text-[13.5px] text-[var(--color-atrisk)]">
            {err.localities}
          </p>
        ) : null}
        <ZonePicker restored={restored} />
      </div>

      <div hidden={step !== 3} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Field label="Years active" name="yearsActive" type="number" placeholder="7" width="xs" />
          <Field label="Team size" name="teamSize" type="number" placeholder="8" width="xs" />
          <Field label="Smallest" name="minLakhs" type="number" placeholder="6" width="xs" suffix="L" />
          <Field label="Largest" name="maxLakhs" type="number" placeholder="22" width="xs" suffix="L" />
        </div>
        <Field
          label="GSTIN"
          name="gstin"
          error={err.gstin}
          hint="A proprietorship without one is fine."
          placeholder="27AAPFU0939F1ZV"
          width="sm"
          mono
        />
      </div>

      <div hidden={step !== 4} className="flex flex-col gap-5">
        <div>
          <label htmlFor="about" className="label m-0 mb-2 block">
            What you do — optional
          </label>
          <textarea
            id="about"
            name="about"
            rows={4}
            placeholder="Warm, material-led homes. We supervise our own carpentry rather than subcontracting site management."
            className="w-full rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-[15px] leading-relaxed"
          />
          {/* /apply states the three-project bar and says to mention it
              here if you are short of it. This is the only free-text box
              on the form, so it has to invite that — otherwise the
              instruction lands nowhere and a young practice quietly does
              not apply. */}
          <p className="m-0 mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            Fewer than three finished projects? Say so here — what is running, what you finished
            elsewhere, anywhere we could come and look. It is read, not scored.
          </p>
        </div>
        <Field
          label="How did you hear about us?"
          name="howHeard"
          placeholder="A designer we know / Instagram / Google"
          width="md"
        />
      </div>

      {/* One forward action, a quiet way back, and the legal note only on
          the step that submits — repeating it everywhere would make a
          short form feel like a contract. */}
      <div className="mt-7 border-t border-[var(--color-rule)] pt-5">
        <div className="flex flex-wrap items-center gap-4">
          {last ? (
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? 'Sending…' : 'Send it to One Interiors'}
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={() => go(step + 1)}>
              Continue
            </Button>
          )}

          {step > 0 ? (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="text-[14.5px] text-[var(--color-ink-2)] underline underline-offset-4 hover:text-[var(--color-ink)]"
            >
              Back
            </button>
          ) : null}

          {!last ? (
            <span className="text-[13px] text-[var(--color-ink-2)]">Saved as you go.</span>
          ) : null}
        </div>

        {last ? (
          <>
            {/* The address is echoed back because it is the one field
                that, typed wrong, makes us look like we ignored somebody.
                Read live from the form so it cannot go stale. */}
            <p className="m-0 mt-4 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              We will write to{' '}
              <strong className="text-[var(--color-ink)]">
                {form.current
                  ? String(new FormData(form.current).get('email') ?? '').trim() ||
                    'the address you gave'
                  : 'the address you gave'}
              </strong>
              .
            </p>
            <p className="m-0 mt-2 max-w-[56ch] text-[13px] leading-relaxed text-[var(--color-ink-2)]">
              By applying you&rsquo;re agreeing that we may verify what you&rsquo;ve told us — GST
              filings, company records, past clients and completed sites. Nothing appears publicly
              until you&rsquo;ve seen and approved your profile.
            </p>
          </>
        ) : null}
      </div>
    </form>
  );
}

/**
 * The area picker: six zones, one open at a time.
 *
 * ## Why a count on a closed heading is the whole trick
 *
 * A collapsed section that hides a ticked box is worse than no
 * collapsing at all — somebody scrolls past "East Pune" with two areas
 * selected inside it and has no way to know. The count means a closed
 * zone still reports what is in it, so nothing can hide.
 *
 * ## Uncontrolled, deliberately
 *
 * The checkboxes are plain DOM inputs with no React value. The count is
 * read off the form after each change rather than mirrored into state,
 * so there is exactly one source of truth for what is ticked — the form
 * itself, which is also what FormData reads and what the draft restore
 * writes into. A mirrored copy would need reconciling with all three.
 */
function ZonePicker({ restored }: { restored: boolean }) {
  /* Starts CLOSED. Opening the first zone by default put sixteen pills
     on screen before anybody had chosen a zone, and made this the
     tallest step in the form by a wide margin. Six headings is the
     question; the pills are the answer to it. */
  const [open, setOpen] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const wrap = useRef<HTMLDivElement | null>(null);

  function recount() {
    const el = wrap.current;
    if (!el) return;
    const next: Record<string, number> = {};
    for (const group of LOCALITIES_BY_ZONE) {
      next[group.zone] = group.localities.filter(
        (l) => el.querySelector<HTMLInputElement>(`input[value="${l.slug}"]`)?.checked,
      ).length;
    }
    setCounts(next);
  }

  /**
   * On mount AND whenever a draft lands.
   *
   * Mount alone was wrong, and the reason is ordering: React runs CHILD
   * effects before parent ones, so this counted before `ApplyForm` had
   * written the saved localities into the checkboxes. A studio came back
   * to a restored application, three areas genuinely ticked, and read
   * "Open the zones you work in and tick the areas" with no badges —
   * exactly the hidden-selection failure the counts exist to prevent,
   * and worse, because the data was right and the display was lying.
   */
  useEffect(recount, [restored]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div ref={wrap} onChange={recount}>
      <p className="m-0 mb-3 text-[14px] text-[var(--color-ink-2)]">
        {total === 0 ? (
          'Open the zones you work in and tick the areas.'
        ) : (
          <>
            <strong className="text-[var(--color-ink)]">
              {total} area{total === 1 ? '' : 's'}
            </strong>{' '}
            selected. Add more, or carry on.
          </>
        )}
      </p>

      <div className="flex flex-col gap-1.5">
        {LOCALITIES_BY_ZONE.map((group) => {
          const isOpen = open === group.zone;
          const n = counts[group.zone] ?? 0;

          return (
            <div
              key={group.zone}
              className="overflow-hidden rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)]"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : group.zone)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-paper-2)]"
              >
                <span className="flex items-baseline gap-3">
                  <span className="text-[15px] font-bold text-[var(--color-ink)]">
                    {group.label}
                  </span>
                  <span className="text-[12.5px] text-[var(--color-ink-2)]">
                    {group.localities.length}
                  </span>
                </span>

                <span className="flex items-center gap-3">
                  {n > 0 ? (
                    <span className="tabular rounded-full bg-[var(--color-ontrack)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-white">
                      {n}
                    </span>
                  ) : null}
                  <Chevron open={isOpen} />
                </span>
              </button>

              {/* `hidden` rather than unmounting. An unmounted checkbox
                  leaves the form, so closing a zone would silently drop
                  everything ticked inside it. */}
              <div hidden={!isOpen} className="border-t border-[var(--color-rule)] px-4 py-3.5">
                <div className="flex flex-wrap gap-2">
                  {group.localities.map((l) => (
                    <label
                      key={l.slug}
                      className="cursor-pointer rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2 text-[14.5px] text-[var(--color-ink-2)] has-[:checked]:border-[var(--color-petrol)] has-[:checked]:bg-[var(--color-petrol-soft)] has-[:checked]:font-bold has-[:checked]:text-[var(--color-ink)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-petrol)]"
                    >
                      <input
                        type="checkbox"
                        name="localities"
                        value={l.slug}
                        className="sr-only"
                      />
                      {l.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-[var(--color-ink-2)] transition-transform duration-200 motion-reduce:transition-none ${
        open ? 'rotate-180' : ''
      }`}
    >
      <path
        d="M3.5 6 L8 10.5 L12.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "Fill this in from my website."
 *
 * ## An offer, never an autofill
 *
 * What comes back is scraped text about somebody's business, not a fact
 * we have checked. It lands in the description box only when they press
 * Use this, and it is theirs to edit or ignore — the same rule
 * `enrich.ts` applies for ops, for the same reason.
 *
 * Silently overwriting a description a studio had already typed would be
 * the worst version of this, so the button refuses when the box has
 * content and says why.
 *
 * ## Why a button and not a fetch on blur
 *
 * This is the one public caller of the site scraper. Firing on blur, or
 * on a debounce while somebody types a URL, turns one applicant into
 * dozens of outbound requests from our server. One press, one fetch —
 * see the note on `lookupSiteAction`.
 */
function SiteLookup({
  form,
  onFilled,
}: {
  form: React.RefObject<HTMLFormElement | null>;
  onFilled: () => void;
}) {
  const [state, action, pending] = useActionState(lookupSiteAction, {
    status: 'idle',
  } as LookupState);
  const [used, setUsed] = useState(false);

  /** Write a value in the way React's own inputs would see it. */
  function put(name: string, value: string) {
    const el = form.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[name="${name}"]`,
    );
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function accept() {
    if (state.status !== 'found') return;
    if (state.about) put('about', state.about);
    if (state.instagram) put('instagram', state.instagram);
    if (state.yearsActive) put('yearsActive', String(state.yearsActive));
    if (state.minLakhs) put('minLakhs', String(state.minLakhs));

    /* Ticking areas is the longest job in the form, so this is the part
       that actually saves somebody time. Additive: it ticks what the
       site named and leaves anything already chosen alone. */
    if (state.localities?.length) {
      const el = form.current;
      for (const slug of state.localities) {
        const box = el?.querySelector<HTMLInputElement>(
          `input[name="localities"][value="${slug}"]`,
        );
        if (box && !box.checked) box.checked = true;
      }
    }
    onFilled();
    setUsed(true);
  }

  const aboutHasContent = Boolean(
    form.current?.querySelector<HTMLTextAreaElement>('[name="about"]')?.value.trim(),
  );

  return (
    <div className="mt-1">
      {/* `type="button"`, and the action called by hand.
          
          As a submit button this was the form's FIRST submit control, so
          Enter anywhere in the application fired it — a scrape of the
          website field from the middle of the "who do we speak to" step.
          A plain button cannot be reached by Enter, and the form's own
          onSubmit now turns Enter into Continue.
          
          `startTransition` because a `useActionState` action must be
          dispatched inside one; called bare it throws. */}
      <button
        type="button"
        onClick={() => {
          const el = form.current;
          if (!el) return;
          const data = new FormData();
          data.set('website', String(new FormData(el).get('website') ?? ''));
          startTransition(() => action(data));
        }}
        disabled={pending}
        className="rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-3)] px-5 py-2.5 text-[14px] text-[var(--color-ink)] hover:border-[var(--color-petrol)] disabled:opacity-50"
      >
        {pending ? 'Reading your site…' : 'Fill this in from my website'}
      </button>
      <p className="m-0 mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
        {pending
          ? 'This can take up to ten seconds — some sites are slow to answer.'
          : 'Optional. We read it and offer what we find — keeping it is your call.'}
      </p>

      {state.status === 'found' ? (
        <div className="mt-4 rounded-[12px] border border-[var(--color-ontrack)] bg-[var(--color-paper)] p-4">
          <p className="label m-0 mb-2 text-[var(--color-ink-2)]">From your site</p>

          {state.about ? (
            <p className="m-0 mb-2 text-[14px] leading-relaxed text-[var(--color-ink)]">
              &ldquo;{state.about.slice(0, 180)}
              {state.about.length > 180 ? '…' : ''}&rdquo;
            </p>
          ) : null}

          {/* Everything else as one compact line. Four separate rows for
              four short facts made the panel taller than the step. */}
          <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13.5px] text-[var(--color-ink-2)]">
            {state.instagram ? <li>Instagram {state.instagram}</li> : null}
            {state.yearsActive ? <li>{state.yearsActive} years active</li> : null}
            {state.minLakhs ? <li>From ₹{state.minLakhs} L</li> : null}
            {state.localityLabels?.length ? (
              <li>
                Areas: {state.localityLabels.slice(0, 6).join(', ')}
                {state.localityLabels.length > 6 ? ` +${state.localityLabels.length - 6}` : ''}
              </li>
            ) : null}
          </ul>

          {used ? (
            <p className="m-0 text-[13.5px] text-[var(--color-ontrack)]">
              Added. Everything is editable — check the later steps before you send.
            </p>
          ) : aboutHasContent && state.about ? (
            <p className="m-0 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
              You have already written a description, so this will not replace it. Clear that box
              first if you would rather use this one.
            </p>
          ) : (
            <button
              type="button"
              onClick={accept}
              className="rounded-full bg-[var(--acc-d,#a94f2e)] px-5 py-2 text-[14px] font-bold text-[var(--on-acc,#fff8f1)]"
            >
              Use this
            </button>
          )}
        </div>
      ) : null}

      {state.status === 'nothing' || state.status === 'error' ? (
        <p role="status" className="m-0 mt-3 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One labelled control.
 *
 * `required` drives the LABEL and `aria-required`, never the HTML
 * attribute — and that is load-bearing rather than fussy. The steps are
 * hidden divs, so by the time the submit button exists on the last step
 * the required fields on the first are hidden. A hidden `required` field
 * makes the browser refuse to submit AND refuse to focus it, and the
 * form dies with "an invalid form control with name='tradeName' is not
 * focusable" — in the console, with nothing at all on screen.
 *
 * `missingOn` checks before each advance and `submitApplication` checks
 * again on the server, which is what actually decides. A screen reader
 * still hears the field is required through `aria-required`.
 */
function Field({
  label,
  name,
  type = 'text',
  placeholder,
  hint,
  error,
  required = false,
  width = 'md',
  suffix,
  mono = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  width?: FieldWidth;
  /** A unit shown beside the box, so it need not bloat the label. */
  suffix?: string;
  mono?: boolean;
}) {
  return (
    <div className={width === 'xs' ? '' : 'w-full'}>
      <label htmlFor={name} className="label m-0 mb-2 block">
        {label}
        {required ? '' : ' — optional'}
      </label>

      <div className="flex items-center gap-2">
        <input
          id={name}
          name={name}
          type={type}
          aria-required={required || undefined}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={`${FIELD_WIDTH[width]} ${width === 'xs' ? '' : 'w-full'} rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-petrol)] ${
            mono ? 'font-[family-name:var(--font-mono)] tracking-[0.02em]' : ''
          } ${type === 'number' ? 'tabular-nums' : ''}`}
        />
        {suffix ? (
          <span className="whitespace-nowrap text-[14px] text-[var(--color-ink-2)]">{suffix}</span>
        ) : null}
      </div>

      {error ? (
        <p id={`${name}-error`} role="alert" className="m-0 mt-1.5 text-[13px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="m-0 mt-1.5 text-[13px] leading-snug text-[var(--color-ink-2)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
