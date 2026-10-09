'use client';

import { useActionState, useState } from 'react';
import { saveMatchingProfileAction, type StepState } from './actions';
import { Section } from './Section';
import { Chips, Field, FieldNote, SaveBar, keepValues } from './fields';
import { LANGUAGES, LANGUAGE_LABELS, SCOPE_LABELS, type ScopeType } from '@/modules/brief/types';
import {
  CARCASSES,
  CARCASS_LABELS,
  CIVIL_LABELS,
  CIVIL_OPTIONS,
  FINISHES,
  FINISH_LABELS,
  HOME_TYPES,
  HOME_TYPE_LABELS,
  PRODUCTION,
  PRODUCTION_LABELS,
  SCOPES,
  SPECIALISMS,
  SPECIALISM_LABELS,
  UPDATE_CHANNELS,
  UPDATE_LABELS,
  VIEWS_3D,
  VIEWS_3D_LABELS,
  WORKING_STYLES,
  WORKING_STYLE_LABELS,
  WORK_MIXES,
  WORK_MIX_LABELS,
  type MatchingProfile,
  type SectionStatus,
} from '@/modules/studio/matching-profile';

const INITIAL: StepState = { status: 'idle' };

const opts = <T extends string>(list: readonly T[], labels: Record<T, string>) =>
  list.map((value) => ({ value, label: labels[value] }));

/** One choice from a few, as cards. Unchosen is a real state: "not said yet". */
function Pick({
  name,
  label,
  options,
  value,
  error,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string; detail?: string }[];
  value: string | null;
  error?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="label m-0 mb-2 p-0">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2.5 text-[14.5px] text-[var(--color-ink-2)] has-[:checked]:border-[var(--color-petrol)] has-[:checked]:bg-[var(--color-petrol-soft)] has-[:checked]:text-[var(--color-ink)]"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={value === o.value}
              onChange={() => onChange?.(o.value)}
              className="sr-only"
            />
            <span className="block">{o.label}</span>
            {o.detail ? <span className="block text-[12.5px] text-[var(--color-ink-3)]">{o.detail}</span> : null}
          </label>
        ))}
      </div>
      <FieldNote name={name} error={error} />
    </fieldset>
  );
}

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
const yn = (v: boolean | null) => (v === null ? null : v ? 'yes' : 'no');

/**
 * "How you work" — the matching profile (docs/STUDIO-PROFILE-REQUIREMENTS.md).
 *
 * Five required sections and three recommended ones, each headed by what it
 * gets the studio rather than by what we want. One form and one save: the
 * fields depend on each other (minimums and durations exist per scope; civil
 * work only for renovation; hardware brands not for a carpentry studio), and
 * saving section by section would store a half-true profile between presses.
 * A field with a wrong value comes back with its error; the rest is kept.
 */
export function PracticeForm({
  profile,
  sections,
  score,
}: {
  profile: MatchingProfile;
  sections: SectionStatus[];
  score: number;
}) {
  const [state, action, pending] = useActionState(saveMatchingProfileAction, INITIAL);
  const err = state.errors ?? {};
  const [scopes, setScopes] = useState<ScopeType[]>(profile.scopes);
  const [workMix, setWorkMix] = useState<string | null>(profile.workMix);
  const section = (id: SectionStatus['id']) => sections.find((s) => s.id === id)!;
  const hint = (id: SectionStatus['id']) => {
    const s = section(id);
    return s.done ? s.gets : `${s.gets} Still needed: ${s.missing.join('; ')}.`;
  };

  return (
    <form onSubmit={keepValues(action)} className="flex flex-col gap-4">
      <p className="m-0 text-[14px] text-[var(--color-ink-2)]">
        Profile {score}% complete. Blank means &ldquo;not said yet&rdquo; — we match on what you
        tell us, and never fill anything in for you.
      </p>

      <Section n={1} title="The work you take on" hint={hint('work')} done={section('work').done}>
        <div className="flex flex-col gap-5">
          <Pick
            name="workMix"
            label="How you build"
            value={profile.workMix}
            onChange={setWorkMix}
            options={WORK_MIXES.map((v) => ({ value: v, label: WORK_MIX_LABELS[v].label, detail: WORK_MIX_LABELS[v].detail }))}
          />
          <fieldset className="m-0 border-0 p-0">
            <legend className="label m-0 mb-2 p-0">The kinds of work you take</legend>
            <div className="flex flex-col gap-3">
              {SCOPES.map((s) => {
                const on = scopes.includes(s);
                return (
                  <div key={s} className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-3 text-[15px] text-[var(--color-ink)]">
                      <input
                        type="checkbox"
                        name="scopes"
                        value={s}
                        checked={on}
                        onChange={(e) =>
                          setScopes((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))
                        }
                        className="h-4 w-4 accent-[var(--color-petrol)]"
                      />
                      {SCOPE_LABELS[s]}
                    </label>
                    {on ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field
                          label="Minimum project"
                          name={`minimum_${s}`}
                          type="number"
                          step="any"
                          width="xs"
                          suffix="lakh"
                          defaultValue={profile.minimumLakhs[s] ?? null}
                          error={err[`minimum_${s}`]}
                        />
                        <Field
                          label="Typical duration, sign-off to handover"
                          name={`duration_${s}`}
                          type="number"
                          width="xs"
                          suffix="days"
                          defaultValue={profile.durationDays[s] ?? null}
                          error={err[`duration_${s}`]}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
          {scopes.includes('RENOVATION') ? (
            <Pick
              name="civil"
              label="Civil work (flooring, bathrooms, plumbing, rewiring) is done by"
              value={profile.civil}
              options={opts(CIVIL_OPTIONS, CIVIL_LABELS)}
            />
          ) : null}
          <Chips label="Home types" name="homeTypes" options={opts(HOME_TYPES, HOME_TYPE_LABELS)} selected={profile.homeTypes} />
        </div>
      </Section>

      <Section n={2} title="Where you work" hint={hint('where')} done={section('where').done}>
        <div className="flex flex-col gap-5">
          <p className="m-0 text-[13.5px] text-[var(--color-ink-3)]">
            Your areas are on the first step. Tell us here if you will take a home anywhere in Pune.
          </p>
          <Pick name="cityWide" label="Anywhere in Pune?" value={yn(profile.cityWide)} options={YES_NO} />
          <label className="block">
            <span className="label m-0 mb-2 block">Societies you have completed homes in — optional</span>
            <textarea
              name="societies"
              rows={3}
              defaultValue={profile.societies.join('\n')}
              placeholder={'Gera World of Joy\nKolte Patil Life Republic'}
              className="w-full rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3 text-[15px] text-[var(--color-ink)]"
            />
            <span className="mt-1 block text-[13px] text-[var(--color-ink-3)]">
              One per line. &ldquo;They have done three flats in your building&rdquo; is one of the strongest things we can tell a buyer.
            </span>
          </label>
        </div>
      </Section>

      <Section n={3} title="Capacity and timing" hint={hint('timing')} done={section('timing').done}>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Projects you can run at once" name="concurrentProjects" type="number" width="xs" defaultValue={profile.concurrentProjects} error={err.concurrentProjects} />
            <Field label="Running now" name="runningNow" type="number" width="xs" defaultValue={profile.runningNow} error={err.runningNow} />
          </div>
          <Field
            label="The earliest date you could start a new project"
            name="earliestStart"
            type="date"
            width="sm"
            defaultValue={profile.earliestStart}
            error={err.earliestStart}
            hint="Update it whenever it moves. Saving confirms it; after 60 days unconfirmed we treat it as unknown."
          />
          <Pick
            name="designBeforePossession"
            label="Do you start design before the client has possession?"
            value={yn(profile.designBeforePossession)}
            options={YES_NO}
          />
        </div>
      </Section>

      <Section n={4} title="How you work" hint={hint('how')} done={section('how').done}>
        <div className="flex flex-col gap-5">
          <Pick
            name="workingStyle"
            label="Which is closest to how you run a project?"
            value={profile.workingStyle}
            options={WORKING_STYLES.map((v) => ({ value: v, label: WORKING_STYLE_LABELS[v] }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Design revisions included before production" name="revisions" type="number" width="xs" defaultValue={profile.revisions} error={err.revisions} />
          </div>
          <Pick name="views3d" label="3D views" value={profile.views3d} options={opts(VIEWS_3D, VIEWS_3D_LABELS)} />
          <Pick name="dedicatedDesigner" label="A dedicated designer for each project?" value={yn(profile.dedicatedDesigner)} options={YES_NO} />
          <Pick name="dedicatedPM" label="A dedicated project manager on site?" value={yn(profile.dedicatedPM)} options={YES_NO} />
          <Chips label="How clients get updates" name="updates" options={opts(UPDATE_CHANNELS, UPDATE_LABELS)} selected={profile.updates} />
        </div>
      </Section>

      <Section n={5} title="Materials and workmanship" hint={hint('materials')} done={section('materials').done}>
        <div className="flex flex-col gap-5">
          <Chips label="Standard carcass material" name="carcass" options={opts(CARCASSES, CARCASS_LABELS)} selected={profile.carcass} />
          <Chips label="Shutter finishes you offer" name="finishes" options={opts(FINISHES, FINISH_LABELS)} selected={profile.finishes} />
          {workMix !== 'CARPENTRY' ? (
            <>
              <Field
                label="Hardware brands you use as standard"
                name="hardware"
                defaultValue={profile.hardware.join(', ')}
                placeholder="Hettich, Häfele, Blum"
              />
              <Pick name="production" label="Where your units are made" value={profile.production} options={opts(PRODUCTION, PRODUCTION_LABELS)} />
            </>
          ) : null}
          <Field label="Warranty on your work" name="warrantyYears" type="number" width="xs" suffix="years" defaultValue={profile.warrantyYears} error={err.warrantyYears} />
          <Pick name="ownInstallers" label="Your own installation team?" value={yn(profile.ownInstallers)} options={YES_NO} />
        </div>
      </Section>

      <Section n={6} title="What you are experienced in" hint={hint('experience')} done={section('experience').done} optional>
        <Chips
          label="Anything you have delivered at least twice"
          name="specialisms"
          options={opts(SPECIALISMS, SPECIALISM_LABELS)}
          selected={profile.specialisms}
          hint="Tag the projects in your portfolio that show it — two tagged projects make it count."
        />
      </Section>

      <Section n={7} title="Languages" hint={hint('languages')} done={section('languages').done} optional>
        <Chips label="Languages your team can hold a client meeting in" name="languages" options={opts(LANGUAGES, LANGUAGE_LABELS)} selected={profile.languages} />
      </Section>

      <Section n={8} title="Meet the studio" hint={hint('video')} done={section('video').done} optional>
        <Field
          label="A 20–30 second intro video"
          name="introVideoUrl"
          type="url"
          defaultValue={profile.introVideoUrl}
          placeholder="https://youtu.be/…"
          error={err.introVideoUrl}
          hint="Filmed on a phone is fine. A link to YouTube, Vimeo, Instagram or Google Drive."
        />
      </Section>

      {profile.curatedDiscountPct !== null ? (
        <p className="m-0 text-[13.5px] text-[var(--color-ink-2)]">
          Your One Interiors discount, as agreed: {profile.curatedDiscountPct}%. It appears as its own
          line on every quote. To change it, talk to us — it is part of your studio agreement.
        </p>
      ) : null}

      <SaveBar
        pending={pending}
        saved={state.status === 'saved'}
        formError={err.form ?? (state.status === 'error' ? 'Some answers need a second look — they are marked above. Everything else was saved.' : undefined)}
      />
    </form>
  );
}
