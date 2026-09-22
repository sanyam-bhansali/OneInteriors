'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { MIN_ABOUT_LENGTH, MAX_ABOUT_LENGTH } from '@/modules/studio/onboarding-steps';
import { saveProfileAction, saveProfileDraftAction, type StepState } from './actions';
import { SaveBar } from './fields';
import { Section, Counter } from './Section';
import { AreaPicker } from './AreaPicker';
import { SiteLookup } from './SiteLookup';
import { useAutosave } from './useAutosave';

const INITIAL: StepState = { status: 'idle' };

export interface ProfileDefaults {
  about: string | null;
  localities: string[];
  website: string | null;
  instagram: string | null;
  yearsActive: number | null;
  teamSize: number | null;
  minLakhs: number | null;
  maxLakhs: number | null;
}

/**
 * Step one, as a guided setup rather than a form.
 *
 * ## Why the sections are controlled and the rest is not
 *
 * Four values are held in React state — the description, the areas, and the
 * two numbers the CTA depends on — and everything else stays uncontrolled
 * with a `defaultValue`. The split is not stylistic: the ticks, the counter
 * and the disabled button all have to recompute as somebody types, and those
 * four are the only inputs anything watches. Controlling the rest would buy
 * nothing and would put a render between every keystroke and the character
 * appearing.
 *
 * ## The CTA is disabled, and says what for
 *
 * A greyed-out button with no explanation is the most reliable way to lose
 * somebody in an onboarding flow, and this file already carries the scar: the
 * four numeric fields once rendered as "optional" while the step refused to
 * complete without them. So the disabled state is always paired with the list
 * of what is short, and each section shows its own tick so the list can be
 * found on the page without reading it.
 *
 * ## It is not the real check
 *
 * `saveProfile` validates everything again and is the thing that decides.
 * What is here is a courtesy so that somebody is told on the screen they are
 * looking at — the same division `missingOn` makes in the application form,
 * and for the same reason. It deliberately tests only presence, never format;
 * a client-side rule the server does not share is how a form ends up
 * refusing something that would have been accepted.
 */
export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, action, pending] = useActionState(saveProfileAction, INITIAL);
  const err = state.errors ?? {};

  const form = useRef<HTMLFormElement>(null);
  const draft = useAutosave(form, saveProfileDraftAction, { pending });

  const [about, setAbout] = useState(defaults.about ?? '');
  const [localities, setLocalities] = useState<string[]>(defaults.localities);
  const [years, setYears] = useState(defaults.yearsActive?.toString() ?? '');
  const [team, setTeam] = useState(defaults.teamSize?.toString() ?? '');
  const [minLakhs, setMinLakhs] = useState(defaults.minLakhs?.toString() ?? '');
  const [maxLakhs, setMaxLakhs] = useState(defaults.maxLakhs?.toString() ?? '');

  /**
   * Tell the form an area was picked.
   *
   * `AreaPicker` holds its selection in React state and writes it out as
   * hidden inputs. Setting an input's value from code fires no `input` or
   * `change` event — that only happens for a real edit by a person — so the
   * one listener `useAutosave` puts on the form never hears about the single
   * most important field on this step. Areas are what the matcher filters on.
   *
   * In an effect rather than in the click handler, because the hidden inputs
   * do not exist until React has committed the new state, and a save fired
   * before that would send the previous selection.
   */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    form.current?.dispatchEvent(new Event('change', { bubbles: true }));
  }, [localities]);

  const describedOk = about.trim().length >= MIN_ABOUT_LENGTH;
  const areasOk = localities.length > 0;
  const detailsOk = years !== '' && team !== '';
  const budgetOk = minLakhs !== '' && maxLakhs !== '';

  /**
   * One entry per FIELD, never per section.
   *
   * This was written as four entries, one of which read "years and team
   * size". Answering years then changed nothing on screen — the line still
   * named it, because team size was also outstanding — so the select looked
   * like it had not registered the answer. It had. The sentence was wrong,
   * which is this file's recurring failure mode and the reason the note on
   * `saveProfile` exists at all: the studio does the right thing and the
   * page tells them they did not.
   *
   * The rule that follows: an item leaves this list the moment the thing it
   * names is done, and nothing in it stands for two things at once.
   */
  const missing = [
    !describedOk ? 'a description' : null,
    !areasOk ? 'at least one area' : null,
    years === '' ? 'years active' : null,
    team === '' ? 'team size' : null,
    minLakhs === '' ? 'your smallest project' : null,
    maxLakhs === '' ? 'your largest project' : null,
  ].filter((m): m is string => m !== null);

  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      <Section
        n={1}
        title="Studio description"
        hint="Write it the way you would say it at a site visit. Customers read this before anything else, and the ones that sound like a brochure get skipped. Say what you are good at, and what you do not take on."
        done={describedOk}
      >
        <textarea
          id="about"
          name="about"
          rows={6}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={MAX_ABOUT_LENGTH}
          aria-invalid={Boolean(err.about)}
          aria-describedby="about-count"
          placeholder="We do warm, material-led homes — mostly 2 and 3 BHK. We supervise our own carpentry rather than subcontracting site management, which is why we take fewer projects at a time. We are not the right studio if you want a full classical or high-gloss look."
          className="oi-input w-full rounded-[12px] border border-[var(--color-rule)] px-4 py-3.5 text-[15.5px] leading-relaxed"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span id="about-count">
            <Counter value={about.trim().length} min={MIN_ABOUT_LENGTH} max={MAX_ABOUT_LENGTH} />
          </span>
          {/* Offered here rather than on the Links section, because this is
              the box it fills and an offer to help is worth nothing two
              questions away from the thing it helps with. */}
          <SiteLookup
            onFound={(text) => setAbout(text)}
            hasText={about.trim().length > 0}
          />
        </div>

        {err.about ? (
          <p role="alert" className="m-0 mt-2 text-[13.5px] text-[var(--color-atrisk)]">
            {err.about}
          </p>
        ) : null}
      </Section>

      <Section
        n={2}
        title="Areas you serve"
        hint="Only where you genuinely work. We match on this, so an area added optimistically becomes a drive you did not want."
        done={areasOk}
      >
        <AreaPicker
          name="localities"
          selected={localities}
          onChange={setLocalities}
          error={err.localities}
        />
      </Section>

      <Section
        n={3}
        title="The practice"
        hint="Both are shown on your profile. Neither decides anything on its own."
        done={detailsOk}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Picker
            label="Years active"
            name="yearsActive"
            value={years}
            onChange={setYears}
            placeholder="Select years"
            error={err.yearsActive}
            /* From 0, because a studio in its first year is a real answer and
               was briefly unrepresentable here — `count()` rejected zero and
               the step then asked for a field they had filled in. */
            options={range(0, 30).map((n) => ({
              value: String(n),
              label: n === 0 ? 'Our first year' : `${n} year${n === 1 ? '' : 's'}`,
            }))}
          />
          <Picker
            label="Team size"
            name="teamSize"
            value={team}
            onChange={setTeam}
            placeholder="Select team size"
            error={err.teamSize}
            hint="Including yourself."
            options={range(1, 50).map((n) => ({
              value: String(n),
              label: `${n} ${n === 1 ? 'person' : 'people'}`,
            }))}
          />
        </div>
      </Section>

      <Section
        n={4}
        title="Typical project budget"
        hint="In lakh, and halves are fine — 7.5 is a perfectly normal floor. It is the single most useful filter we have, and being matched below your floor wastes your time and theirs."
        done={budgetOk}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Money
            label="Smallest"
            name="minLakhs"
            value={minLakhs}
            onChange={setMinLakhs}
            placeholder="5"
            error={err.minLakhs}
          />
          <Money
            label="Largest"
            name="maxLakhs"
            value={maxLakhs}
            onChange={setMaxLakhs}
            placeholder="40"
            error={err.maxLakhs}
          />
        </div>
      </Section>

      <Section
        n={5}
        title="Links"
        optional
        hint="Somewhere a customer can see more of your work."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* `type="text"`, not `url`. A URL input silently refuses
              "yourstudio.com" with no hint that a scheme is required — the
              studio sees a form that will not submit and no explanation. */}
          <WithIcon icon={<LinkIcon />}>
            <input
              name="website"
              type="text"
              defaultValue={defaults.website ?? ''}
              placeholder="https://yourstudio.com"
              aria-label="Website"
              className="oi-input w-full rounded-[11px] border border-[var(--color-rule)] py-2.5 pl-10 pr-4 text-[14.5px]"
            />
          </WithIcon>
          <WithIcon icon={<InstagramIcon />}>
            <input
              name="instagram"
              type="text"
              defaultValue={defaults.instagram ?? ''}
              placeholder="@yourstudio"
              aria-label="Instagram"
              className="oi-input w-full rounded-[11px] border border-[var(--color-rule)] py-2.5 pl-10 pr-4 text-[14.5px]"
            />
          </WithIcon>
        </div>
      </Section>

      <SaveBar
        pending={pending}
        saved={state.status === 'saved'}
        formError={err.form}
        draft={draft}
        label="Save and continue"
        missing={missing}
      />
    </form>
  );
}

/**
 * A quiet marker on the field that is still empty.
 *
 * It disappears the instant the field is answered, which is the property
 * that matters: the fix for "years and team size" as one line was to make
 * every claim on this page belong to exactly one field, and this is the same
 * rule applied where somebody is actually looking. Two selects side by side
 * are the easiest place in the form to misread which one is outstanding.
 *
 * Deliberately not an asterisk. An asterisk marks a field as required
 * forever, including after it has been filled in, so it cannot answer the
 * question somebody is asking here — which is not "what is required" but
 * "what is left".
 */
function Needed({ when }: { when: boolean }) {
  if (!when) return null;
  return (
    <span className="rounded-full bg-[var(--color-brass-soft)] px-2 py-0.5 text-[10.5px] font-medium normal-case tracking-normal text-[var(--color-brass)]">
      Needed
    </span>
  );
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * A select that looks like the text inputs beside it.
 *
 * The values are exact integers, never bands. "5–10 years" would have to be
 * stored as one number or a new column, and storing the lower bound means the
 * profile says five when they said five-to-ten — a small lie that nobody can
 * later tell from a true five.
 */
function Picker({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label m-0 mb-1.5 flex items-center gap-2">
        {label}
        <Needed when={value === ''} />
      </label>
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={`oi-input w-full appearance-none rounded-[11px] border border-[var(--color-rule)] py-2.5 pl-4 pr-10 text-[14.5px] ${
            value === '' ? 'text-[var(--color-ink-3)]' : 'text-[var(--color-ink)]'
          }`}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-[var(--color-ink)]">
              {o.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6.5 L8 10.5 L12 6.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {hint && !error ? (
        <p className="m-0 mt-1.5 text-[13px] text-[var(--color-ink-3)]">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A rupee figure in lakh, with both ends of the unit on the field. */
function Money({
  label,
  name,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label m-0 mb-1.5 flex items-center gap-2">
        {label}
        <Needed when={value === ''} />
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[var(--color-ink-3)]"
        >
          ₹
        </span>
        <input
          id={name}
          name={name}
          type="number"
          /* `step="0.5"` so the browser accepts 7.5. A number input defaults
             to step=1, which makes an ordinary project floor unenterable and
             gives no reason why. */
          step="0.5"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="oi-input tabular-nums w-full rounded-[11px] border border-[var(--color-rule)] py-2.5 pl-9 pr-14 text-[14.5px]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13.5px] text-[var(--color-ink-3)]"
        >
          lakh
        </span>
      </div>
      {error ? (
        <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function WithIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]"
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.3-2.3a2.6 2.6 0 0 0-3.7-3.7l-1 1" strokeLinecap="round" />
      <path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.4 8.9a2.6 2.6 0 0 0 3.7 3.7l1-1" strokeLinecap="round" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="3.4" />
      <circle cx="8" cy="8" r="2.7" />
      <circle cx="11.3" cy="4.7" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
