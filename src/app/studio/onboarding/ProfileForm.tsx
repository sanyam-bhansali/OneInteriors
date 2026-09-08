'use client';

import { useActionState } from 'react';
import { PUNE_LOCALITIES } from '@/modules/brief/types';
import { saveProfileAction, type StepState } from './actions';
import { Field, Chips, SaveBar } from './fields';

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

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, action, pending] = useActionState(saveProfileAction, INITIAL);
  const err = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-8">
      <div>
        <label htmlFor="about" className="label m-0 mb-2 block">
          How would you describe what you do?
        </label>
        <p className="m-0 mb-3 max-w-[56ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
          Write it the way you would say it to someone at a site visit. Customers read this before
          they read anything else, and the ones that sound like a brochure get skipped. Say what
          you are actually good at, and what you do not take on.
        </p>
        <textarea
          id="about"
          name="about"
          rows={6}
          defaultValue={defaults.about ?? ''}
          aria-invalid={Boolean(err.about)}
          placeholder="We do warm, material-led homes — mostly 2 and 3 BHK. We supervise our own carpentry rather than subcontracting site management, which is why we take fewer projects at a time. We are not the right studio if you want a full classical or high-gloss look."
          className="w-full rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4 text-[15.5px] leading-relaxed"
        />
        {err.about ? (
          <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
            {err.about}
          </p>
        ) : null}
      </div>

      <Chips
        label="Areas you take projects in"
        name="localities"
        hint="Only where you genuinely work. We match on this, so an area you added optimistically becomes a drive you did not want."
        options={PUNE_LOCALITIES.map((l) => ({ value: l.slug, label: l.label }))}
        selected={defaults.localities}
        error={err.localities}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Years active" name="yearsActive" type="number" defaultValue={defaults.yearsActive} />
        <Field label="Team size" name="teamSize" type="number" defaultValue={defaults.teamSize} />
      </div>

      <div>
        <p className="label m-0 mb-2">Project size you take on</p>
        <p className="m-0 mb-3 max-w-[56ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
          In lakh. Be honest about the floor — it is the single most useful filter we have, and
          getting matched below your floor wastes your time and theirs.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Smallest" name="minLakhs" type="number" defaultValue={defaults.minLakhs} error={err.minLakhs} />
          <Field label="Largest" name="maxLakhs" type="number" defaultValue={defaults.maxLakhs} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Website" name="website" type="url" defaultValue={defaults.website} placeholder="https://" />
        <Field label="Instagram" name="instagram" defaultValue={defaults.instagram} placeholder="@yourstudio" />
      </div>

      <SaveBar pending={pending} saved={state.status === 'saved'} formError={err.form} />
    </form>
  );
}
