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
    <p role="status" className={result.ok ? 'ox-ok' : 'ox-err'}>
      {result.ok ? result.message : result.error}
    </p>
  );
}

function SiteChips({ sites, picked, onFlip, labelledBy }: { sites: Site[]; picked: Set<string>; onFlip: (id: string) => void; labelledBy: string }) {
  if (sites.length === 0) {
    return (
      <p className="muted sm" style={{ margin: 0 }}>
        No projects yet. Sites appear here once a client signs with you.
      </p>
    );
  }
  return (
    <div role="group" aria-labelledby={labelledBy} className="hstack" style={{ gap: 8 }}>
      {sites.map((s) => {
        const on = picked.has(s.id);
        return (
          <button key={s.id} type="button" aria-pressed={on} onClick={() => onFlip(s.id)} className="st-chip">
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Add someone": name, number, role card, sites. Sends the invite through
 * MessageSender. A salesperson (sales roles and teams, owner 22 Oct 2026)
 * also gets their sales role and who they report to.
 */
export function AddSomeone({
  roles,
  sites,
  seatsLeft,
  salesRoles = [],
  salespeople = [],
}: {
  roles: RoleCard[];
  sites: Site[];
  seatsLeft: number;
  salesRoles?: { id: string; name: string; system: string | null }[];
  salespeople?: { id: string; name: string }[];
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StudioRoleName>(roles.some((r) => r.role === 'SUPERVISOR') ? 'SUPERVISOR' : (roles[0]?.role ?? 'SALES'));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [salesRoleId, setSalesRoleId] = useState(salesRoles.find((r) => r.system === 'REP')?.id ?? salesRoles[0]?.id ?? '');
  const [reportsToId, setReportsToId] = useState('');
  const { pending, result, setResult, run } = useResult();

  const flip = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section aria-labelledby="h-invite" className="card st-invite" style={{ gap: 16 }}>
      <h2 id="h-invite" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
        Add someone
      </h2>
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => inviteAction({ name, phone, role, sites: PICKS_SITES.has(role) ? [...picked] : [], ...(role === 'SALES' ? { salesRoleId, reportsToId } : {}) }),
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
        <div className="st-grid2">
          <label className="ox-f">
            <span className="lbl">Name</span>
            <input className="fld" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required />
          </label>
          <label className="ox-f">
            <span className="lbl">Mobile number</span>
            <input className="fld mono" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" required />
          </label>
        </div>

        <div className="ox-f" style={{ gap: 8 }}>
          <span id="i-role" className="lbl">
            Role
          </span>
          <div role="radiogroup" aria-labelledby="i-role" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  className="st-role"
                >
                  <b>{r.name}</b>
                  <span>{r.line}</span>
                  {on ? <span>Can: {r.can.join(', ')}.</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {PICKS_SITES.has(role) ? (
          <div className="ox-f" style={{ gap: 8 }}>
            <span id="i-sites" className="lbl">
              Which sites?
            </span>
            <SiteChips sites={sites} picked={picked} onFlip={flip} labelledBy="i-sites" />
          </div>
        ) : null}

        {role === 'SALES' ? (
          <div className="st-grid2">
            <label className="ox-f">
              <span className="lbl">Sales role</span>
              <select className="fld" value={salesRoleId} onChange={(e) => setSalesRoleId(e.target.value)} required>
                {salesRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ox-f">
              <span className="lbl">Reports to</span>
              <select className="fld" value={reportsToId} onChange={(e) => setReportsToId(e.target.value)}>
                <option value="">The owner</option>
                {salespeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <button type="submit" className="btn pri lg" disabled={pending}>
          {pending ? 'Sending…' : 'Send invite on WhatsApp'}
        </button>
        <p className="muted sm" style={{ margin: 0, lineHeight: 1.45 }}>
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
    <div style={{ display: 'flex', minWidth: 180, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <div className="hstack" style={{ gap: 6 }}>
        {person.status === 'INVITED' ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => resendAction(person.id))}>
            Resend
          </button>
        ) : null}
        {PICKS_SITES.has(person.role) && person.status !== 'SUSPENDED' ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
            Sites
          </button>
        ) : null}
        {person.status === 'ACTIVE' ? (
          <button
            type="button"
            className="btn ghost sm"
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
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => reinstateAction(person.id))}>
            Reinstate
          </button>
        ) : (
          <button
            type="button"
            className="btn ghost sm bad-b"
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span id={`sites-${person.id}`} className="lbl">
            Sites {person.name} sees
          </span>
          <SiteChips sites={sites} picked={picked} onFlip={flip} labelledBy={`sites-${person.id}`} />
          <button
            type="button"
            className="btn pri sm"
            style={{ alignSelf: 'flex-start' }}
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
