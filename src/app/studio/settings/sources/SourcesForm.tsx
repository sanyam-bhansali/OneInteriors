'use client';

import { useState } from 'react';
import type { LeadSourceRow } from '@/modules/studio-sales/settings';
import { addLeadSourceAction, removeLeadSourceAction } from '../../sales-actions';
import { Said, useAct, inputClass, primaryClass } from '../../SalesUi';

export function SourcesForm({ sources }: { sources: LeadSourceRow[] }) {
  const [name, setName] = useState('');
  const { pending, result, run } = useAct();
  return (
    <div className="s-card flex flex-col gap-4 p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => addLeadSourceAction(name),
            (r) => {
              if (r.ok) setName('');
            },
          );
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Housing.com"
          aria-label="New source name"
          className={`${inputClass} w-auto min-w-[14rem] flex-1`}
        />
        <button type="submit" disabled={pending || name.trim().length < 2} className={primaryClass}>
          {pending ? 'Adding…' : 'Add source'}
        </button>
      </form>
      <Said result={result} />
      {sources.length === 0 ? (
        <p className="m-0 text-[13.5px] text-[var(--s-ink-3)]">None of your own yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {sources.map((s) => (
            <SourceRow key={s.id} s={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceRow({ s }: { s: LeadSourceRow }) {
  const [sure, setSure] = useState(false);
  const { pending, result, run } = useAct();
  return (
    <li className="flex flex-col rounded-[9px] bg-[var(--s-surface-2)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-3 text-[13.5px]">
        <span className="font-medium">{s.name}</span>
        <span className="text-[12.5px] text-[var(--s-ink-3)]">
          {s.leads} lead{s.leads === 1 ? '' : 's'}
        </span>
        {sure ? (
          <span className="ml-auto flex gap-3 text-[12.5px]">
            <button type="button" disabled={pending} onClick={() => run(() => removeLeadSourceAction(s.id))} className="text-[var(--s-bad)]">
              Yes, remove{s.leads ? ' (they become Other)' : ''}
            </button>
            <button type="button" onClick={() => setSure(false)} className="text-[var(--s-ink-3)]">
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setSure(true)} className="ml-auto text-[12.5px] text-[var(--s-ink-3)] hover:text-[var(--s-bad)]">
            Remove
          </button>
        )}
      </div>
      <Said result={result} />
    </li>
  );
}
