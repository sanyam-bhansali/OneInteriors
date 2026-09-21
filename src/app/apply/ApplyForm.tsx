'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import {
  FormSection,
  FieldRow,
  FieldCluster,
  FormFooter,
  FIELD_WIDTH,
  type FieldWidth,
} from '@/components/ui/form';
import { LOCALITIES_BY_ZONE } from '@/modules/brief/types';
import {
  submitApplicationAction,
  lookupSiteAction,
  type ApplyState,
  type LookupState,
} from './actions';
import { Stepper } from './Stepper';

const INITIAL: ApplyState = { status: 'idle' };

/**
 * The three steps, and which fields belong to each.
 *
 * `needs` drives validation before advancing. Everything not listed there
 * is optional, which is why step 3 has an empty list and can say so.
 *
 * Moving a field between steps is editing this array. That is the whole
 * reason the steps are a VIEW over one form rather than three forms
 * feeding a state machine.
 */
const STEPS = [
  {
    label: 'You and the studio',
    heading: 'Who are you?',
    lede: 'The name you work under, and the person we will actually be speaking to.',
    minutes: 2,
    needs: ['tradeName', 'contactName', 'email', 'phone'],
  },
  {
    label: 'Where you work',
    heading: 'Which parts of Pune?',
    lede: 'We match customers to studios working in their area, so the zone matters more than the count.',
    minutes: 1,
    needs: ['localities'],
  },
  {
    label: 'Your practice',
    heading: 'Anything else worth knowing?',
    lede: 'All of this is optional. We would rather know than guess, but none of it decides anything on its own.',
    minutes: 4,
    needs: [],
  },
] as const;

/** Human names for the required fields, for the error line. */
const LABELS: Record<string, string> = {
  tradeName: 'the studio name',
  contactName: 'your name',
  email: 'your email',
  phone: 'your mobile',
  localities: 'at least one area',
};

const DRAFT_KEY = 'oi.apply.draft';

/**
 * The studio application.
 *
 * ## The layout, and why it changed
 *
 * This was one column of full-width pills in a 672px container: on a desktop
 * screen, a lonely strip of boxes with two-thirds of the window empty either
 * side, and a "Studio name" input wide enough for a paragraph.
 *
 * Both halves of that are the same mistake — sizing by the container instead of
 * by the content. It is now two columns: **what we are asking for on the left,
 * the boxes on the right**, with each box only as wide as its answer. Years
 * active gets 7rem because the answer is one or two digits. The description
 * gets the full column because it is prose.
 *
 * Space is used by adding a column, never by stretching one. A number in a
 * 900px box does not look generous, it looks broken.
 */
export function ApplyForm() {
  const [state, action, pending] = useActionState(submitApplicationAction, INITIAL);
  const err = state.errors ?? {};

  const form = useRef<HTMLFormElement | null>(null);
  const [step, setStep] = useState(0);
  /** The furthest step reached, so finished ones stay clickable. */
  const [furthest, setFurthest] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);

  /**
   * Draft to sessionStorage on every change, and restore on load.
   *
   * The sharpest line in the onboarding research is the Acorns critique:
   * "you can't pause and finish later." A studio owner interrupted by a
   * site visit halfway through fifteen fields currently loses all of it
   * and does not come back. This is an hour of work against the single
   * most common reason a busy person's form is never finished.
   *
   * sessionStorage rather than localStorage: this is somebody's name,
   * phone number and business details, and it should not outlive the
   * browser session on a shared machine. Every access is wrapped —
   * private mode throws on the accessor itself, and a storage failure
   * must never take the form down with it.
   */
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, string | string[]>;
      const el = form.current;
      if (!el) return;

      for (const [name, value] of Object.entries(saved)) {
        // Belt and braces with the `$` filter on the way in: an older
        // draft written before that filter existed is still in somebody's
        // session right now.
        if (name.startsWith('$')) continue;

        const nodes = el.querySelectorAll<HTMLInputElement>(`[name="${name}"]`);
        if (nodes.length === 0) continue;
        if (Array.isArray(value)) {
          nodes.forEach((n) => {
            n.checked = value.includes(n.value);
          });
        } else if (nodes[0]) {
          nodes[0].value = value;
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
           named `$ACTION_REF_1`, `$ACTION_KEY` and similar, which bind
           this form to that action for THIS page load. Saving them is
           noise; restoring them on the next load would write a stale key
           over a live one, and the failure would look like the submit
           button doing nothing. */
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
   * Done in JavaScript rather than with the `required` attribute, and not
   * by choice: a `required` field inside a hidden step makes the browser
   * refuse to submit AND refuse to focus the field, so the form dies with
   * "an invalid form control is not focusable" and no visible cause.
   *
   * The server validates all of this again regardless — see
   * `submitApplication`. This exists so somebody is told on the screen
   * they are looking at, not after a round trip.
   */
  function missingOn(i: number): string[] {
    const el = form.current;
    if (!el) return [];
    const data = new FormData(el);
    return STEPS[i]!.needs.filter((name) => {
      const values = data.getAll(name).filter((v) => typeof v === 'string' && v.trim() !== '');
      return values.length === 0;
    });
  }

  function go(next: number) {
    // Backwards is always free. Nobody should have to fix a field to
    // re-read the one before it.
    if (next < step) {
      setMissing([]);
      setStep(next);
      return;
    }
    const gaps = missingOn(step);
    setMissing(gaps);
    if (gaps.length > 0) {
      form.current?.querySelector<HTMLElement>(`[name="${gaps[0]}"]`)?.focus();
      return;
    }
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    // The next step starts at the top of itself, not at the scroll offset
    // the last one was left at.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (state.status === 'sent') {
    // The draft has served its purpose. Leaving it behind would restore a
    // sent application into an empty form on the next visit.
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* Nothing to clean up. */
    }
    return (
      <div className="mx-auto max-w-[62ch] rounded-[14px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-8">
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
    <form action={action} ref={form} onChange={saveDraft}>
      <Stepper steps={STEPS.map((x) => ({ label: x.label }))} current={step} furthest={furthest} onGo={go} />

      <div className="mb-8">
        <h2 className="h1 m-0 mb-2">{active.heading}</h2>
        <p className="m-0 max-w-[54ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          {active.lede}
        </p>
        <p className="m-0 mt-3 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.14em] text-[var(--color-ink-2)]">
          Step {step + 1} of {STEPS.length} · about {active.minutes} minute
          {active.minutes === 1 ? '' : 's'}
          {step === STEPS.length - 1 ? ' · all optional' : ''}
        </p>
        {restored && step === 0 ? (
          <p className="m-0 mt-3 text-[14px] leading-relaxed text-[var(--color-ontrack)]">
            We kept what you had already typed. Carry on where you left off.
          </p>
        ) : null}
      </div>

      {missing.length > 0 ? (
        <p
          role="alert"
          className="m-0 mb-6 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-3 text-[14.5px] text-[var(--color-atrisk)]"
        >
          Still needed: {missing.map((m) => LABELS[m] ?? m).join(', ')}.
        </p>
      ) : null}

      {err.form ? (
        <p
          role="alert"
          className="m-0 mb-8 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-3 text-[14.5px] text-[var(--color-atrisk)]"
        >
          {err.form}
        </p>
      ) : null}

      {/* Every step stays MOUNTED and is only hidden. That is what keeps
          this one form with one submit and one server action: the final
          FormData carries all fifteen fields whichever step is on screen.
          It also means browser autofill sees the whole application at
          once, and a step boundary can be moved by editing STEPS rather
          than by rewiring state. */}
      <div hidden={step !== 0}>
      <FormSection first title="The studio" hint="How you're known, and where we can find your work.">
        <Field
          label="Studio name"
          name="tradeName"
          required
          error={err.tradeName}
          placeholder="Akara Design Studio"
          width="md"
        />
        <Field
          label="Registered legal name"
          name="legalName"
          hint="If different. As on the GST certificate."
          placeholder="Akara Design Studio Private Limited"
          width="lg"
        />
        <FieldRow>
          <Field label="Website" name="website" type="url" placeholder="https://" />
          <Field label="Instagram" name="instagram" placeholder="@akarastudio" />
        </FieldRow>
        <SiteLookup form={form} onFilled={saveDraft} />
      </FormSection>

      <FormSection title="You" hint="Who we'll actually be speaking to.">
        <FieldRow>
          <Field label="Your name" name="contactName" required error={err.contactName} />
          <Field label="Mobile" name="phone" type="tel" required error={err.phone} placeholder="98765 43210" />
        </FieldRow>
        <Field
          label="Email"
          name="email"
          type="email"
          required
          error={err.email}
          hint="We'll send your sign-in link here if you're approved."
          width="md"
        />
      </FormSection>
      </div>

      <div hidden={step !== 1}>
      <FormSection
        first
        title="Where you work"
        hint="The areas you genuinely take projects in. We match customers to studios working in the same part of Pune, so ticking your zone properly matters more than ticking everything."
      >
        {err.localities ? (
          <p role="alert" className="m-0 text-[13.5px] text-[var(--color-atrisk)]">
            {err.localities}
          </p>
        ) : null}
        {/* One zone open at a time, and a count on every heading.

            Sixty-four pills in one wrap is a wall: nobody reads to the
            end of it, and the ones at the bottom never get ticked. The
            zone headings were already there to break it up, but all six
            open at once is still sixty-four things on screen.

            Collapsed, a studio sees six choices — West, East, Central —
            opens the one or two they work in, and is done. The count
            beside each heading means a closed zone still reports what is
            inside it, so nothing they have picked can hide. */}
        <ZonePicker />
      </FormSection>
      </div>

      <div hidden={step !== 2}>
      <FormSection first title="The business" hint="Nothing here is a filter on its own. We'd rather know than guess.">
        {/* Four short numbers on one line instead of four stacked pills. This is
            the row that made the old layout look most obviously wrong: a team
            size of 8 in a box 40 characters wide. */}
        <FieldCluster>
          <Field label="Years active" name="yearsActive" type="number" placeholder="7" width="xs" />
          <Field label="Team size" name="teamSize" type="number" placeholder="8" width="xs" />
          <Field label="Smallest project" name="minLakhs" type="number" placeholder="6" width="xs" suffix="₹ lakh" />
          <Field label="Largest" name="maxLakhs" type="number" placeholder="22" width="xs" suffix="₹ lakh" />
        </FieldCluster>
        <Field
          label="GSTIN"
          name="gstin"
          error={err.gstin}
          hint="Optional. We check it against the GST portal — a proprietorship without one is fine."
          placeholder="27AAPFU0939F1ZV"
          width="sm"
          mono
        />
      </FormSection>

      <FormSection
        title="Your work"
        hint="Plain words are better than a brochure. We'll write the polished version with you later."
      >
        <div>
          <label htmlFor="about" className="label m-0 mb-2 block">
            How would you describe what you do?
          </label>
          <textarea
            id="about"
            name="about"
            rows={5}
            placeholder="Warm, material-led homes. We supervise our own carpentry rather than subcontracting site management."
            className="w-full max-w-[60ch] rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3 text-[15px] leading-relaxed"
          />
          {/* The pitch page states the three-project bar and says to mention it
              here if you are short of it. This is the only free-text box on the
              form, so it has to invite that — otherwise the instruction lands
              nowhere and a young practice quietly does not apply. */}
          <p className="m-0 mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
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
      </FormSection>

      </div>

      {/* The bar. One forward action, a quiet way back, and the legal
          note only on the step that actually submits — repeating it on
          every screen would make a short form feel like a contract. */}
      <FormFooter>
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-4">
            {last ? (
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? 'Sending…' : 'Send it to One Interiors'}
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={() => go(step + 1)}>
                {step === 0 ? "That's us, continue" : 'Continue'}
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
              <span className="text-[13.5px] text-[var(--color-ink-2)]">
                Saved as you go — you can close this and come back.
              </span>
            ) : null}
          </div>

          {last ? (
            <>
              {/* The address is echoed back because it is the one field
                  that, typed wrong, makes us look like we ignored
                  somebody. Read live from the form rather than held in
                  state, so it cannot go stale. */}
              <p className="m-0 mt-4 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
                We will write to{' '}
                <strong className="text-[var(--color-ink)]">
                  {form.current
                    ? String(new FormData(form.current).get('email') ?? '').trim() ||
                      'the address you gave'
                    : 'the address you gave'}
                </strong>
                . Worth checking that is right.
              </p>
              <p className="m-0 mt-3 max-w-[58ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
                By applying you&rsquo;re agreeing that we may verify what you&rsquo;ve told us —
                GST filings, company records, past clients and completed sites. Nothing appears
                publicly until you&rsquo;ve seen and approved your profile.
              </p>
            </>
          ) : null}
        </div>
      </FormFooter>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  error,
  hint,
  placeholder,
  width = 'full',
  suffix,
  mono = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
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
        {/* `required` drives the LABEL and `aria-required`, never the HTML
            attribute — and that is load-bearing rather than fussy.

            The steps are hidden divs, so by the time the submit button
            exists on step 3 the required fields on step 1 are hidden. A
            hidden `required` field makes the browser refuse to submit and
            refuse to focus it, and the form dies with "an invalid form
            control with name='tradeName' is not focusable" — in the
            console, with nothing at all on screen.

            `missingOn` does the checking before each step advance, and
            `submitApplication` does it again on the server, which is the
            check that actually decides. A screen reader still hears the
            field is required through aria-required. */}
        <input
          id={name}
          name={name}
          type={type}
          aria-required={required || undefined}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={`${FIELD_WIDTH[width]} ${width === 'xs' ? '' : 'w-full'} rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-petrol)] ${
            mono ? 'font-[family-name:var(--font-mono)] tracking-[0.02em]' : ''
          } ${type === 'number' ? 'tabular-nums' : ''}`}
        />
        {suffix ? (
          <span className="whitespace-nowrap text-[14px] text-[var(--color-ink-3)]">{suffix}</span>
        ) : null}
      </div>

      {error ? (
        <p id={`${name}-error`} role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="m-0 mt-1.5 max-w-[52ch] text-[13px] leading-snug text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
    </div>
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
function ZonePicker() {
  const [open, setOpen] = useState<string | null>(LOCALITIES_BY_ZONE[0]?.zone ?? null);
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

  // Once on mount, so a restored draft shows its counts immediately
  // rather than waiting for the first click.
  useEffect(recount, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div ref={wrap} onChange={recount}>
      <p className="m-0 mb-4 text-[14.5px] text-[var(--color-ink-2)]">
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

      <div className="flex flex-col gap-2">
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
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-[var(--color-paper-2)]"
              >
                <span className="flex items-baseline gap-3">
                  <span className="text-[15.5px] font-bold text-[var(--color-ink)]">
                    {group.label}
                  </span>
                  <span className="text-[13px] text-[var(--color-ink-2)]">
                    {group.localities.length} areas
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
              <div hidden={!isOpen} className="border-t border-[var(--color-rule)] px-5 py-4">
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
    onFilled();
  }

  const aboutHasContent = Boolean(
    form.current?.querySelector<HTMLTextAreaElement>('[name="about"]')?.value.trim(),
  );

  return (
    <div className="mt-1">
      {/* `formAction` on the button rather than a nested <form>: the whole
          application is already one form, and a form inside a form is
          invalid HTML that browsers silently unnest. */}
      <button
        type="submit"
        formAction={action}
        disabled={pending}
        className="rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-3)] px-5 py-2.5 text-[14px] text-[var(--color-ink)] hover:border-[var(--color-petrol)] disabled:opacity-50"
      >
        {pending ? 'Reading your site…' : 'Fill this in from my website'}
      </button>
      <p className="m-0 mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--color-ink-2)]">
        Optional. We read the page you linked and offer what we find — you decide whether to keep
        it.
      </p>

      {state.status === 'found' ? (
        <div className="mt-4 rounded-[12px] border border-[var(--color-ontrack)] bg-[var(--color-paper-3)] p-5">
          <p className="label m-0 mb-2 text-[var(--color-ink-2)]">From your site</p>
          {state.about ? (
            <p className="m-0 mb-3 text-[14.5px] leading-relaxed text-[var(--color-ink)]">
              “{state.about}”
            </p>
          ) : null}
          {state.instagram ? (
            <p className="m-0 mb-3 text-[14px] text-[var(--color-ink-2)]">
              Instagram: <strong className="text-[var(--color-ink)]">{state.instagram}</strong>
            </p>
          ) : null}

          {aboutHasContent && state.about ? (
            <p className="m-0 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
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
