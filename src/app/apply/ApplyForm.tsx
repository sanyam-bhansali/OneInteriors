'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { PUNE_LOCALITIES } from '@/modules/brief/types';
import { submitApplicationAction, type ApplyState } from './actions';

const INITIAL: ApplyState = { status: 'idle' };

export function ApplyForm() {
  const [state, action, pending] = useActionState(submitApplicationAction, INITIAL);
  const err = state.errors ?? {};

  if (state.status === 'sent') {
    return (
      <div className="rounded-[14px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-7">
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
    <form action={action} className="flex flex-col gap-9">
      {err.form ? (
        <p role="alert" className="m-0 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-3 text-[14.5px] text-[var(--color-atrisk)]">
          {err.form}
        </p>
      ) : null}

      <Section title="The studio" hint="How you're known, and where we can find your work.">
        <Field label="Studio name" name="tradeName" required error={err.tradeName} placeholder="Akara Design Studio" />
        <Field label="Registered legal name" name="legalName" hint="If different. As on the GST certificate." placeholder="Akara Design Studio Private Limited" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Website" name="website" type="url" placeholder="https://" />
          <Field label="Instagram" name="instagram" placeholder="@akarastudio" />
        </div>
      </Section>

      <Section title="You" hint="Who we'll actually be speaking to.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your name" name="contactName" required error={err.contactName} />
          <Field label="Mobile" name="phone" type="tel" required error={err.phone} placeholder="98765 43210" />
        </div>
        <Field
          label="Email"
          name="email"
          type="email"
          required
          error={err.email}
          hint="We'll send your sign-in link here if you're approved."
        />
      </Section>

      <Section title="Where you work" hint="Only the areas you genuinely take projects in — we match on this.">
        {err.localities ? (
          <p role="alert" className="m-0 mb-2 text-[13.5px] text-[var(--color-atrisk)]">
            {err.localities}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {PUNE_LOCALITIES.map((l) => (
            <label
              key={l.slug}
              className="cursor-pointer rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2 text-[14.5px] text-[var(--color-ink-2)] has-[:checked]:border-[var(--color-petrol)] has-[:checked]:bg-[var(--color-petrol-soft)] has-[:checked]:text-[var(--color-ink)]"
            >
              <input type="checkbox" name="localities" value={l.slug} className="sr-only" />
              {l.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="The business" hint="Nothing here is a filter on its own. We'd rather know than guess.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Years active" name="yearsActive" type="number" placeholder="7" />
          <Field label="Team size" name="teamSize" type="number" placeholder="8" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Smallest project you take (₹ lakh)" name="minLakhs" type="number" placeholder="6" />
          <Field label="Largest (₹ lakh)" name="maxLakhs" type="number" placeholder="22" />
        </div>
        <Field
          label="GSTIN"
          name="gstin"
          error={err.gstin}
          hint="Optional. We check it against the GST portal — a proprietorship without one is fine."
          placeholder="27AAPFU0939F1ZV"
        />
      </Section>

      <Section title="Your work" hint="Plain words are better than a brochure. We'll write the polished version with you later.">
        <div>
          <label htmlFor="about" className="label m-0 mb-2 block">
            How would you describe what you do?
          </label>
          <textarea
            id="about"
            name="about"
            rows={4}
            placeholder="Warm, material-led homes. We supervise our own carpentry rather than subcontracting site management."
            className="w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3 text-[15px] leading-relaxed"
          />
        </div>
        <Field label="How did you hear about us?" name="howHeard" placeholder="A designer we know / Instagram / Google" />
      </Section>

      <div className="border-t border-[var(--color-rule)] pt-7">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Sending…' : 'Send application'}
        </Button>
        <p className="m-0 mt-4 max-w-[56ch] text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
          By applying you&rsquo;re agreeing that we may verify what you&rsquo;ve told us — GST
          filings, company records, past clients and completed sites. Nothing appears publicly until
          you&rsquo;ve seen and approved your profile.
        </p>
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1 p-0 font-[family-name:var(--font-display)] text-[24px] leading-tight">
        {title}
      </legend>
      {hint ? (
        <p className="m-0 mb-5 max-w-[52ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label m-0 mb-2 block">
        {label}
        {required ? '' : ' — optional'}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
      />
      {error ? (
        <p id={`${name}-error`} role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="m-0 mt-1.5 text-[13px] leading-snug text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
