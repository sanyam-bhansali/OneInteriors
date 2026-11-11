'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addSocietyAction,
  assignLeadsAction,
  editSocietyAction,
  heatAction,
  leadWingAction,
  noteAction,
  ownerAction,
  priorityAction,
  wingAction,
  type SocietyFormState,
} from './actions';

type Action = (s: SocietyFormState, f: FormData) => Promise<SocietyFormState>;

function Said({ state }: { state: SocietyFormState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="soc-err">{state.error}</p>;
  if (state.message) return <p role="status" className="soc-ok">{state.message}</p>;
  return null;
}

/** A form that resets itself after it worked. */
function useForm(action: Action) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return { state, run, pending, ref };
}

export function AddSociety() {
  const [open, setOpen] = useState(false);
  const { state, run, pending, ref } = useForm(addSocietyAction);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok && state.id) router.push(`/studio/clients/societies/${state.id}`);
  }, [state, router]);
  if (!open)
    return (
      <button type="button" className="btn pri" onClick={() => setOpen(true)}>
        Add a society
      </button>
    );
  return (
    <form ref={ref} action={run} className="card soc-form" aria-label="Add a society">
      <div className="soc-grid">
        <label>
          Society name
          <input name="name" required maxLength={120} placeholder="Life Republic, Sector R10" />
        </label>
        <label>
          Locality
          <input name="locality" maxLength={80} placeholder="Hinjewadi" />
        </label>
        <label>
          Builder <span className="muted">(optional)</span>
          <input name="builder" maxLength={80} placeholder="Kolte Patil" />
        </label>
        <label>
          Wings <span className="muted">(commas)</span>
          <input name="wings" maxLength={400} placeholder="A, B, C" />
        </label>
        <label>
          Possession month <span className="muted">(all wings; change each later)</span>
          <input name="possession" type="month" />
        </label>
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className="btn pri" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <Said state={state} />
    </form>
  );
}

export function NoteForm({ id }: { id: string }) {
  const { state, run, pending, ref } = useForm(noteAction);
  return (
    <form ref={ref} action={run} className="soc-note-form">
      <input type="hidden" name="id" value={id} />
      <textarea name="body" rows={3} maxLength={4000} required placeholder="Possession news, the society office, an event, anything the team should know" />
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className="btn pri sm" disabled={pending}>
          {pending ? 'Saving…' : 'Add note'}
        </button>
        <Said state={state} />
      </div>
    </form>
  );
}

const monthValue = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : '');

export function WingForm({ id, wing }: { id: string; wing?: { id: string; name: string; flats: number | null; possessionOn: Date | null } }) {
  const { state, run, pending, ref } = useForm(wingAction);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="linkbtn" onClick={() => setOpen(true)}>
        {wing ? 'Edit' : '+ Add a wing'}
      </button>
    );
  return (
    <form ref={wing ? undefined : ref} action={run} className="soc-wing-form" aria-label={wing ? `Edit wing ${wing.name}` : 'Add a wing'}>
      <input type="hidden" name="id" value={id} />
      {wing ? <input type="hidden" name="wingId" value={wing.id} /> : null}
      <input name="name" required maxLength={40} defaultValue={wing?.name} placeholder="Wing" aria-label="Wing name" />
      <input name="flats" type="number" min={1} max={4999} defaultValue={wing?.flats ?? ''} placeholder="Flats" aria-label="Flats" />
      <input name="possession" type="month" defaultValue={monthValue(wing?.possessionOn ?? null)} aria-label="Possession month" />
      <button type="submit" className="btn pri sm" disabled={pending}>
        Save
      </button>
      <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
        Close
      </button>
      <Said state={state} />
    </form>
  );
}

export function OwnerForm({ id, current, people }: { id: string; current: string | null; people: { id: string; name: string }[] }) {
  const [state, run, pending] = useActionState(ownerAction, null);
  return (
    <form action={run} className="hstack soc-inline">
      <input type="hidden" name="id" value={id} />
      <select name="owner" defaultValue={current ?? ''} aria-label="Owner">
        <option value="">Nobody</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn sm ghost" disabled={pending}>
        Change
      </button>
      <Said state={state} />
    </form>
  );
}

export function OverrideForm({
  id,
  kind,
  current,
}: {
  id: string;
  kind: 'priority' | 'heat';
  /** The hand-set value now, or null when automatic. */
  current: string | null;
}) {
  const [state, run, pending] = useActionState(kind === 'priority' ? priorityAction : heatAction, null);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="linkbtn" onClick={() => setOpen(true)}>
        {current ? 'Change or go back to automatic' : 'Set by hand'}
      </button>
    );
  const options = kind === 'priority' ? ['P1', 'P2', 'P3'] : ['HOT', 'WARM', 'COLD'];
  const label = (o: string) => (kind === 'priority' ? o : o[0] + o.slice(1).toLowerCase());
  return (
    <form action={run} className="soc-override">
      <input type="hidden" name="id" value={id} />
      <select name={kind} defaultValue={current ?? ''} aria-label={kind === 'priority' ? 'Priority' : 'Response'}>
        <option value="">Automatic</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </select>
      <input name="reason" maxLength={200} placeholder="Why, in a line (e.g. builder delayed to June)" aria-label="Reason" />
      <button type="submit" className="btn pri sm" disabled={pending}>
        Save
      </button>
      <Said state={state} />
    </form>
  );
}

export function EditSociety({ id, name, locality, builder }: { id: string; name: string; locality: string | null; builder: string | null }) {
  const [state, run, pending] = useActionState(editSocietyAction, null);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        Edit details
      </button>
    );
  return (
    <form action={run} className="card soc-form" aria-label="Edit society">
      <input type="hidden" name="id" value={id} />
      <div className="soc-grid">
        <label>
          Society name
          <input name="name" required maxLength={120} defaultValue={name} />
        </label>
        <label>
          Locality
          <input name="locality" maxLength={80} defaultValue={locality ?? ''} />
        </label>
        <label>
          Builder
          <input name="builder" maxLength={80} defaultValue={builder ?? ''} />
        </label>
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className="btn pri sm" disabled={pending}>
          Save
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <Said state={state} />
    </form>
  );
}

/**
 * Give the society's leads out (owner, 11 Nov 2026): all to one person,
 * split equally between two or more, or the first 100 / 200 / 300 to one.
 */
export function AssignLeads({ id, people, total, unassigned }: { id: string; people: { id: string; name: string }[]; total: number; unassigned: number }) {
  const [state, run, pending] = useActionState(assignLeadsAction, null);
  const [mode, setMode] = useState<'one' | 'split' | 'first'>('one');
  const [chosen, setOnly] = useState<'unassigned' | 'all'>(unassigned > 0 ? 'unassigned' : 'all');
  /* Once everything is given out there is nothing "unassigned" to pick. */
  const only = unassigned === 0 ? 'all' : chosen;
  const [count, setCount] = useState('100');
  const [picked, setPicked] = useState<string[]>([]);
  const pool = only === 'unassigned' ? unassigned : total;
  const firstN = count === 'other' ? null : Number(count);
  const each = picked.length >= 2 ? Math.floor(pool / picked.length) : null;
  if (total === 0) return null;
  return (
    <form action={run} className="card soc-assign" aria-label="Give out leads">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="mode" value={mode} />
      <h2 className="soc-h2">Give out leads</h2>
      <div className="soc-seg" role="radiogroup" aria-label="How">
        {(
          [
            ['one', 'All to one person'],
            ['split', 'Split equally'],
            ['first', 'First 100 / 200 / 300'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? 'on' : undefined} onClick={() => setMode(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="soc-assign-row">
        <label>
          Which leads
          <select name="only" value={only} onChange={(e) => setOnly(e.target.value as 'unassigned' | 'all')}>
            <option value="unassigned" disabled={unassigned === 0}>
              Only the {unassigned} nobody has yet
            </option>
            <option value="all">All {total} in this society</option>
          </select>
        </label>

        {mode === 'one' ? (
          <label>
            Give them to
            <select name="oneTo" required defaultValue="">
              <option value="" disabled>
                Pick a person
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === 'first' ? (
          <>
            <label>
              How many
              <select name="count" value={count} onChange={(e) => setCount(e.target.value)}>
                <option value="100">First 100</option>
                <option value="200">First 200</option>
                <option value="300">First 300</option>
                <option value="other">Another number</option>
              </select>
            </label>
            {count === 'other' ? (
              <label>
                Number
                <input name="countOther" type="number" min={1} max={30000} required placeholder="50" />
              </label>
            ) : null}
            <label>
              Give them to
              <select name="firstTo" required defaultValue="">
                <option value="" disabled>
                  Pick a person
                </option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>

      {mode === 'split' ? (
        <fieldset className="soc-people">
          <legend>Split between (pick two, three or more)</legend>
          {people.map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                name="people"
                value={p.id}
                checked={picked.includes(p.id)}
                onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((i) => i !== p.id)))}
              />{' '}
              {p.name}
            </label>
          ))}
        </fieldset>
      ) : null}

      <p className="muted soc-small">
        {mode === 'one'
          ? `${pool} lead${pool === 1 ? '' : 's'} go to one person, who also becomes the society’s owner.`
          : mode === 'split'
            ? each !== null
              ? `${pool} leads split between ${picked.length} people: about ${each} each, taken in turn so each gets a share of every wing.`
              : 'Tick at least two people.'
            : `The first ${firstN ? Math.min(firstN, pool) : 'N'} of ${pool}, in wing and sheet order, go to one person.`}{' '}
        They are told, and each lead’s history says who gave it.
      </p>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className="btn pri" disabled={pending || pool === 0 || (mode === 'split' && picked.length < 2)}>
          {pending ? 'Giving out…' : 'Give out'}
        </button>
        <Said state={state} />
      </div>
    </form>
  );
}

export function LeadWing({ societyId, clientId, wingId, wings }: { societyId: string; clientId: string; wingId: string | null; wings: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <select
        defaultValue={wingId ?? ''}
        disabled={pending}
        aria-label="Wing"
        onChange={(e) => {
          const v = e.target.value || null;
          start(async () => {
            const r = await leadWingAction(societyId, clientId, v);
            setError(r.error ?? null);
          });
        }}
      >
        <option value="">No wing</option>
        {wings.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      {error ? <span className="soc-err"> {error}</span> : null}
    </>
  );
}
