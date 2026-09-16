'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
// Pure module — `fields.ts` carries `server-only`. CONTRIBUTING §9.5.
import {
  FIELD_TYPE_LABELS,
  GROUPABLE_TYPES,
  fieldKeyFrom,
  type FieldTypeName,
} from '@/modules/studio-practice/vocabulary';
import type { FieldRow } from '@/modules/studio-practice/fields';
import {
  addFieldAction,
  renameFieldAction,
  setGroupingAction,
  removeFieldAction,
  IDLE,
  type State,
} from './actions';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldTypeName[];

/** The group-by switch. A switch and not a checkbox because it takes effect at once. */
function Toggle({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[22px] w-[38px] flex-none rounded-full transition-colors disabled:opacity-40 ${
        on ? 'bg-[var(--s-accent)]' : 'bg-[var(--s-rule)]'
      }`}
    >
      <span
        className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${
          on ? 'left-[19px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}

function FieldLine({ field }: { field: FieldRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(field.label);

  useEffect(() => setLabel(field.label), [field.label]);

  const run = (fn: () => Promise<State>) =>
    start(async () => {
      const result = await fn();
      setError('ok' in result && !result.ok ? result.error : null);
    });

  const groupable = GROUPABLE_TYPES.includes(field.type);

  return (
    <li className="flex flex-col gap-1.5 border-b border-[var(--s-rule-soft)] py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label.trim() !== field.label) run(() => renameFieldAction(field.id, label));
          }}
          disabled={pending}
          className={`${input} min-w-[12rem] flex-1`}
        />

        <Toggle
          on={field.groupBy}
          disabled={pending || !groupable}
          label={`Group the client list by ${field.label}`}
          onChange={(next) => run(() => setGroupingAction(field.id, next))}
        />
        <span
          className={`flex-none text-[13px] ${groupable ? 'text-[var(--s-ink-2)]' : 'text-[var(--s-ink-3)]'}`}
          title={groupable ? undefined : 'A number field cannot group the list usefully.'}
        >
          Group by
        </span>

        <button
          type="button"
          aria-label={`Delete ${field.label}`}
          disabled={pending}
          onClick={() => run(() => removeFieldAction(field.id))}
          className="flex-none px-1 text-[15px] leading-none text-[var(--s-ink-3)] hover:text-[var(--s-bad)] disabled:opacity-25"
        >
          ×
        </button>
      </div>

      {/* The key is shown because it is what the values are filed under, and a
          studio that renames the label should be able to see that it did not
          move. Same reasoning as AxLeads showing `carpet_area_sqft`. */}
      <p className="m-0 text-[12.5px] text-[var(--s-ink-3)]">
        <code className="font-mono">{field.key}</code> · {FIELD_TYPE_LABELS[field.type]}
        {field.options.length > 0 ? ` · ${field.options.join(', ')}` : ''}
      </p>

      {error ? (
        <p role="alert" className="m-0 text-[12.5px] text-[var(--s-bad)]">{error}</p>
      ) : null}
    </li>
  );
}

function NewField() {
  const [state, action, pending] = useActionState(addFieldAction, IDLE);
  const [type, setType] = useState<FieldTypeName>('TEXT');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState(0);

  useEffect(() => {
    if ('ok' in state && state.ok) {
      setKey((k) => k + 1);
      setLabel('');
      setType('TEXT');
    }
  }, [state]);

  return (
    <form key={key} action={action} className="flex flex-col gap-3 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
          <span className="s-label">Another field</span>
          <input
            name="label"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Possession month"
            className={input}
          />
        </label>

        <label className="flex flex-none flex-col gap-1.5">
          <span className="s-label">Kind</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as FieldTypeName)}
            className={input}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={pending} className={primary}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>

      {type === 'SELECT' ? (
        <label className="flex flex-col gap-1.5">
          <span className="s-label">The choices, separated by commas</span>
          <input name="options" placeholder="1BHK, 2BHK, 3BHK, 4BHK+, Villa" className={input} />
        </label>
      ) : null}

      {label.trim().length > 1 ? (
        <p className="m-0 text-[12.5px] text-[var(--s-ink-3)]">
          Values will be filed under <code className="font-mono">{fieldKeyFrom(label)}</code>.
          Renaming the label later will not move them.
        </p>
      ) : null}

      {'ok' in state && !state.ok ? (
        <p role="alert" className="m-0 text-[12.5px] text-[var(--s-bad)]">{state.error}</p>
      ) : null}
    </form>
  );
}

export function FieldEditor({ fields }: { fields: FieldRow[] }) {
  return (
    <div className="s-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[15.5px] font-semibold">Your fields</h2>
        <p className="m-0 text-[13px] text-[var(--s-ink-3)]">
          {fields.length === 0 ? 'None yet.' : `${fields.length} on every client`}
        </p>
      </div>

      {fields.length === 0 ? (
        <p className="m-0 max-w-[66ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          Nothing here, and nothing pre-filled — a field we invented is a question we decided you
          should ask your clients. Add the thing you keep writing into the notes.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {fields.map((field) => (
            <FieldLine key={field.id} field={field} />
          ))}
        </ul>
      )}

      <NewField />
    </div>
  );
}
