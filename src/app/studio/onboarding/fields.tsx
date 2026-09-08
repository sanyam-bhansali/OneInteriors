'use client';

/** Shared form primitives for the onboarding steps. Kept in one file so the
 *  four steps cannot drift into four slightly different-looking forms. */

export function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required = false,
  error,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
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
        defaultValue={defaultValue ?? undefined}
        required={required}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
      />
      <FieldNote name={name} error={error} hint={hint} />
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label m-0 mb-2 block">
        {label} — optional
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)]"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldNote name={name} error={error} />
    </div>
  );
}

export function Chips({
  label,
  name,
  options,
  selected = [],
  error,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  selected?: string[];
  error?: string;
  hint?: string;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="label m-0 mb-2 p-0">{label}</legend>
      {hint ? (
        <p className="m-0 mb-3 max-w-[52ch] text-[13.5px] leading-snug text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2 text-[14.5px] text-[var(--color-ink-2)] has-[:checked]:border-[var(--color-petrol)] has-[:checked]:bg-[var(--color-petrol-soft)] has-[:checked]:text-[var(--color-ink)]"
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={selected.includes(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      <FieldNote name={name} error={error} />
    </fieldset>
  );
}

export function Check({
  label,
  name,
  hint,
  error,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name={name}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-petrol)]"
        />
        <span>
          <span className="block text-[15px] leading-snug text-[var(--color-ink)]">{label}</span>
          {hint ? (
            <span className="mt-0.5 block text-[13.5px] leading-snug text-[var(--color-ink-3)]">
              {hint}
            </span>
          ) : null}
        </span>
      </label>
      <FieldNote name={name} error={error} />
    </div>
  );
}

export function FieldNote({
  name,
  error,
  hint,
}: {
  name: string;
  error?: string;
  hint?: string;
}) {
  if (error) {
    return (
      <p id={`${name}-error`} role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${name}-hint`} className="m-0 mt-1.5 text-[13px] leading-snug text-[var(--color-ink-3)]">
        {hint}
      </p>
    );
  }
  return null;
}

export function SaveBar({
  pending,
  saved,
  formError,
  label = 'Save and continue',
}: {
  pending: boolean;
  saved: boolean;
  formError?: string;
  label?: string;
}) {
  return (
    <div className="border-t border-[var(--color-rule)] pt-6">
      {formError ? (
        <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-atrisk)]">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-petrol-deep)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Saving…' : label}
        </button>
        {saved && !pending ? (
          <span className="text-[14px] text-[var(--color-ontrack)]">Saved.</span>
        ) : null}
      </div>
    </div>
  );
}
