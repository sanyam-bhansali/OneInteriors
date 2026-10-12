'use client';

import { useActionState, useState } from 'react';
import { updateClientAction } from '../actions';
import { IDLE } from '../../form-state';

/**
 * The studio's own fields on the lead (Society, Possession Month, Wing…),
 * read in the details column and edited with the pencil (AxLeads' Lead
 * details panel). Saved through the same path as the board card's form.
 */
export function CustomFieldsPanel({
  leadId,
  fields,
  values,
  may,
}: {
  leadId: string;
  fields: { key: string; label: string; type: string; options: string[] }[];
  values: Record<string, string>;
  may: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateClientAction, IDLE);
  if (fields.length === 0) return null;
  return (
    <section className="s-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="s-label m-0">More details</h2>
        {may && !editing ? (
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit details" title="Edit details" className="rounded-[6px] p-1 text-[var(--s-ink-3)] hover:bg-[var(--s-rail-active)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
            </svg>
          </button>
        ) : null}
      </div>
      {editing ? (
        <form
          action={async (fd) => {
            await action(fd);
            setEditing(false);
          }}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="id" value={leadId} />
          {fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-[12.5px]">
              <span className="text-[var(--s-ink-3)]">{f.label}</span>
              {f.type === 'SELECT' ? (
                <select name={`custom.${f.key}`} defaultValue={values[f.key] ?? ''} className="h-[32px] rounded-[8px] border border-[var(--s-rule)] px-2 text-[13px]">
                  <option value="">—</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input name={`custom.${f.key}`} type={f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'} defaultValue={values[f.key] ?? ''} className="h-[32px] rounded-[8px] border border-[var(--s-rule)] px-2 text-[13px]" />
              )}
            </label>
          ))}
          <div className="mt-1 flex gap-2">
            <button type="submit" disabled={pending} className="s-btn">
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="s-btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          {fields.map((f) => (
            <div key={f.key} className="contents">
              <dt className="text-[var(--s-ink-3)]">{f.label}</dt>
              <dd className="m-0">{values[f.key] || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {'ok' in state && !state.ok ? <p className="m-0 mt-2 text-[12.5px] text-[var(--s-bad)]">{state.error}</p> : null}
    </section>
  );
}
