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
    <section className="card">
      <div className="chead">
        <h2 className="h">More details</h2>
        {may && !editing ? (
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit details" title="Edit details" className="btn ghost sm">
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
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <input type="hidden" name="id" value={leadId} />
          {fields.map((f) => (
            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="lbl">{f.label}</span>
              {f.type === 'SELECT' ? (
                <select name={`custom.${f.key}`} defaultValue={values[f.key] ?? ''} className="fld">
                  <option value="">—</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input name={`custom.${f.key}`} type={f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'} defaultValue={values[f.key] ?? ''} className="fld" />
              )}
            </label>
          ))}
          <div className="hstack" style={{ gap: 8 }}>
            <button type="submit" disabled={pending} className="btn pri sm">
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn sec sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="kv">
          {fields.map((f) => (
            <div key={f.key} className="contents">
              <dt>{f.label}</dt>
              <dd>{values[f.key] || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {'ok' in state && !state.ok ? <p className="cl-err">{state.error}</p> : null}
    </section>
  );
}
