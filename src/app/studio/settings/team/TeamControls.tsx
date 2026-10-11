'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { StudioMemberStatusName, StudioRoleName } from '@/modules/studio/roles';
import type { TeamResult } from '@/modules/studio/team-store';
import {
  inviteAction,
  reinstateAction,
  resendAction,
  setSitesAction,
  signOutEverywhereAction,
  suspendAction,
} from './actions';

type Site = { id: string; label: string };
type RoleCard = { role: StudioRoleName; name: string; line: string; can: string[] };

/** Project managers and supervisors see only the sites picked for them (roles.ts `needsAssignment`). */
const PICKS_SITES: ReadonlySet<StudioRoleName> = new Set(['PM', 'SUPERVISOR']);

function useResult() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TeamResult | null>(null);
  const run = (fn: () => Promise<TeamResult>, after?: (r: TeamResult) => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
      after?.(r);
    });
  return { pending, result, setResult, run };
}

function Note({ result }: { result: TeamResult | null }) {
  if (!result) return null;
  return (
    <p role="status" className={`m-0 text-[13px] leading-relaxed ${result.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
      {result.ok ? result.message : result.error}
    </p>
  );
}

function SiteChips({ sites, picked, onFlip, labelledBy }: { sites: Site[]; picked: Set<string>; onFlip: (id: string) => void; labelledBy: string }) {
  if (sites.length === 0) {
    return <p className="m-0 text-[13px] text-[var(--s-ink-3)]">No projects yet. Sites appear here once a client signs with you.</p>;
  }
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {sites.map((s) => {
        const on = picked.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => onFlip(s.id)}
            className={`min-h-9 rounded-full px-3 text-[13px] font-medium ${
              on ? 'bg-[var(--s-accent)] text-white' : 'bg-[var(--s-surface-2)] text-[var(--s-ink)] hover:bg-[var(--s-rail-active)]'
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Add someone": name, number, role card, sites. Sends the invite through MessageSender. */
export function AddSomeone({ roles, sites, seatsLeft }: { roles: RoleCard[]; sites: Site[]; seatsLeft: number }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StudioRoleName>('SUPERVISOR');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { pending, result, setResult, run } = useResult();

  const flip = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section aria-labelledby="h-invite" className="s-card flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-5">
      <h2 id="h-invite" className="m-0 text-[16px] font-semibold">
        Add someone
      </h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => inviteAction({ name, phone, role, sites: PICKS_SITES.has(role) ? [...picked] : [] }),
            (r) => {
              if (r.ok) {
                setName('');
                setPhone('');
                setPicked(new Set());
              }
            },
          );
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--s-ink-2)]">
            Name
            <input className="s-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--s-ink-2)]">
            Mobile number
            <input
              className="s-input font-[family-name:var(--font-mono)]"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span id="i-role" className="text-[13px] font-semibold text-[var(--s-ink-2)]">
            Role
          </span>
          <div role="radiogroup" aria-labelledby="i-role" className="flex flex-col gap-2">
            {roles.map((r) => {
              const on = r.role === role;
              return (
                <button
                  key={r.role}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setRole(r.role);
                    setResult(null);
                  }}
                  className={`flex flex-col gap-1 rounded-[12px] px-3.5 py-2.5 text-left ${
                    on ? 'bg-[var(--s-accent)] text-white' : 'bg-[var(--s-surface-2)] text-[var(--s-ink)] hover:bg-[var(--s-rail-active)]'
                  }`}
                >
                  <span className="text-[14.5px] font-semibold">{r.name}</span>
                  <span className={`text-[12.5px] leading-snug ${on ? 'text-white/85' : 'text-[var(--s-ink-2)]'}`}>{r.line}</span>
                  {on ? <span className="text-[12px] leading-snug text-white/75">Can: {r.can.join(', ')}.</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {PICKS_SITES.has(role) ? (
          <div className="flex flex-col gap-2">
            <span id="i-sites" className="text-[13px] font-semibold text-[var(--s-ink-2)]">
              Which sites?
            </span>
            <SiteChips sites={sites} picked={picked} onFlip={flip} labelledBy="i-sites" />
          </div>
        ) : null}

        <button type="submit" className="s-btn min-h-11" disabled={pending}>
          {pending ? 'Sending…' : 'Send invite on WhatsApp'}
        </button>
        <p className="m-0 text-[12.5px] leading-relaxed text-[var(--s-ink-3)]">
          They get a link and sign in with this number. A seat is used only once they sign in
          {seatsLeft > 0 ? ` (${seatsLeft} free ${seatsLeft === 1 ? 'seat' : 'seats'} left)` : ''}.
          {PICKS_SITES.has(role) ? ` ${picked.size} ${picked.size === 1 ? 'site' : 'sites'} selected.` : ''}
        </p>
        <Note result={result} />
      </form>
    </section>
  );
}

/** Per-person controls: resend, sites, sign out everywhere, suspend / reinstate. */
export function PersonActions({
  person,
  sites,
}: {
  person: { id: string; name: string; role: StudioRoleName; status: StudioMemberStatusName; siteIds: string[] };
  sites: Site[];
}) {
  const { pending, result, run } = useResult();
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(person.siteIds));
  const flip = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex min-w-[180px] flex-col items-start gap-2">
      <div className="flex flex-wrap gap-1.5">
        {person.status === 'INVITED' ? (
          <button type="button" className="s-btn-ghost" disabled={pending} onClick={() => run(() => resendAction(person.id))}>
            Resend
          </button>
        ) : null}
        {PICKS_SITES.has(person.role) && person.status !== 'SUSPENDED' ? (
          <button type="button" className="s-btn-ghost" disabled={pending} onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
            Sites
          </button>
        ) : null}
        {person.status === 'ACTIVE' ? (
          <button
            type="button"
            className="s-btn-ghost"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Sign ${person.name} out of every phone and computer? They can sign in again with their number.`)) {
                run(() => signOutEverywhereAction(person.id));
              }
            }}
          >
            Sign out everywhere
          </button>
        ) : null}
        {person.status === 'SUSPENDED' ? (
          <button type="button" className="s-btn-ghost" disabled={pending} onClick={() => run(() => reinstateAction(person.id))}>
            Reinstate
          </button>
        ) : (
          <button
            type="button"
            className="s-btn-ghost"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Suspend ${person.name}? They are signed out everywhere and cannot sign in until you reinstate them.`)) {
                run(() => suspendAction(person.id));
              }
            }}
          >
            Suspend
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <span id={`sites-${person.id}`} className="text-[12.5px] font-semibold text-[var(--s-ink-2)]">
            Sites {person.name} sees
          </span>
          <SiteChips sites={sites} picked={picked} onFlip={flip} labelledBy={`sites-${person.id}`} />
          <button
            type="button"
            className="s-btn self-start"
            disabled={pending}
            onClick={() => run(() => setSitesAction(person.id, [...picked]), (r) => r.ok && setEditing(false))}
          >
            Save sites
          </button>
        </div>
      ) : null}
      <Note result={result} />
    </div>
  );
}
