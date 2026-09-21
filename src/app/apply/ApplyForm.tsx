'use client';

import { useActionState } from 'react';
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
import { submitApplicationAction, type ApplyState } from './actions';

const INITIAL: ApplyState = { status: 'idle' };

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

  if (state.status === 'sent') {
    return (
      <div className="mx-auto max-w-[62ch] rounded-[14px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-8">
        <h2 className="h2 mb-3">Thank you — we&rsquo;ve got it.</h2>
        <p className="m-0 mb-3 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          We read every application ourselves. You&rsquo;ll hear from us within a week, either way
          — and if it&rsquo;s a no, we&rsquo;ll tell you why rather than going quiet.
        </p>
        <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          If it&rsquo;s a yes, we&rsquo;ll email you a sign-in link and you&rsquo;ll build your
          profile from there. Expect a call before that.
        </p>
      </div>
    );
  }

  return (
    <form action={action}>
      {err.form ? (
        <p
          role="alert"
          className="m-0 mb-8 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-3 text-[14.5px] text-[var(--color-atrisk)]"
        >
          {err.form}
        </p>
      ) : null}

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

      <FormSection
        title="Where you work"
        hint="The areas you genuinely take projects in. We match customers to studios working in the same part of Pune, so ticking your zone properly matters more than ticking everything."
      >
        {err.localities ? (
          <p role="alert" className="m-0 text-[13.5px] text-[var(--color-atrisk)]">
            {err.localities}
          </p>
        ) : null}
        {/* Grouped by zone, because sixty-four pills in one wrap is a wall
            rather than a choice — nobody reads to the end of it, and the ones
            at the bottom never get ticked. The zone headings also tell a
            studio how matching actually works: we show you to customers in
            your part of Pune, so ticking the zone you work in is enough. */}
        <div className="flex flex-col gap-5">
          {LOCALITIES_BY_ZONE.map((group) => (
            <fieldset key={group.zone} className="m-0 border-0 p-0">
              <legend className="label m-0 mb-2.5 p-0">{group.label}</legend>
              <div className="flex flex-wrap gap-2">
                {group.localities.map((l) => (
                  <label
                    key={l.slug}
                    className="cursor-pointer rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2 text-[14.5px] text-[var(--color-ink-2)] has-[:checked]:border-[var(--color-petrol)] has-[:checked]:bg-[var(--color-petrol-soft)] has-[:checked]:text-[var(--color-ink)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-petrol)]"
                  >
                    <input type="checkbox" name="localities" value={l.slug} className="sr-only" />
                    {l.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </FormSection>

      <FormSection title="The business" hint="Nothing here is a filter on its own. We'd rather know than guess.">
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
        </div>
        <Field
          label="How did you hear about us?"
          name="howHeard"
          placeholder="A designer we know / Instagram / Google"
          width="md"
        />
      </FormSection>

      <FormFooter>
        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Sending…' : 'Send application'}
          </Button>
          <p className="m-0 mt-4 max-w-[58ch] text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
            By applying you&rsquo;re agreeing that we may verify what you&rsquo;ve told us — GST
            filings, company records, past clients and completed sites. Nothing appears publicly
            until you&rsquo;ve seen and approved your profile.
          </p>
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
        <input
          id={name}
          name={name}
          type={type}
          required={required}
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
