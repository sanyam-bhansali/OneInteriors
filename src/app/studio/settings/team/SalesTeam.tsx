'use client';

import { useMemo, useState } from 'react';
import {
  REACH_LABELS,
  SALES_GROUPS,
  SALES_PERMISSIONS,
  type SalesPermissionKey,
  type SalesPermissionMap,
  type SalesReach,
} from '@/modules/studio/sales-permissions';
import { subtreeOf } from '@/modules/studio/sales-access';
import { Said, useAct } from '../../SalesUi';
import { createRoleAction, deleteRoleAction, setReportsToAction, setSalesRoleAction, updateRoleAction } from './actions';

/**
 * Settings → Team, the sales side (owner, 22 Oct 2026; docs/studio-os/
 * SALES-ROLES.md): the Roles tab (each role as a permission matrix: on/off,
 * and a reach for the lead permissions), each salesperson's role and who
 * they report to, and the reporting tree. Every save goes through
 * sales-team-store.ts, which checks the right, the studio and loops again.
 */

export type RoleCard = { id: string; name: string; description: string | null; system: string | null; permissions: SalesPermissionMap; people: number };
export type SalesPerson = { id: string; name: string; role: string; status: string; salesRoleId: string | null; reportsToId: string | null; isYou: boolean };

const SYSTEM_WORDS: Record<string, string> = { ADMIN: 'Built in', HEAD: 'Built in', REP: 'Built in' };

/** One role, editable: name, a line, and the matrix. */
function RoleEditor({ role, onDone }: { role: RoleCard | null; onDone?: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [perms, setPerms] = useState<SalesPermissionMap>(role?.permissions ?? { 'leads.view': 'own' });
  const { pending, result, run } = useAct();

  const flip = (key: SalesPermissionKey, reaches: readonly SalesReach[] | null) =>
    setPerms((p) => {
      const next = { ...p };
      if (next[key] !== undefined) delete next[key];
      else next[key] = reaches ? reaches[0]! : true;
      return next;
    });
  const reach = (key: SalesPermissionKey, value: SalesReach) => setPerms((p) => ({ ...p, [key]: value }));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const input = { name, description, permissions: perms as Record<string, unknown> };
        run(() => (role ? updateRoleAction(role.id, input) : createRoleAction(input)), (r) => {
          if (r.ok && !role) {
            setName('');
            setDescription('');
            setPerms({ 'leads.view': 'own' });
          }
          if (r.ok) onDone?.();
        });
      }}
    >
      <div className="st-grid2">
        <label className="ox-f">
          <span className="lbl">Role name</span>
          <input className="fld" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        </label>
        <label className="ox-f">
          <span className="lbl">What it is for</span>
          <input className="fld" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        </label>
      </div>
      {SALES_GROUPS.map((group) => {
        const rows = SALES_PERMISSIONS.filter((p) => p.group === group);
        if (rows.length === 0) return null;
        return (
          <fieldset key={group} className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="lbl" style={{ marginBottom: 4 }}>
              {group}
            </legend>
            {rows.map((p) => {
              const on = perms[p.key] !== undefined;
              const value = perms[p.key];
              return (
                <div key={p.key} className="flex flex-wrap items-start gap-2" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                  <label className="flex min-w-0 flex-1 items-start gap-2" style={{ minWidth: 220 }}>
                    <input type="checkbox" checked={on} onChange={() => flip(p.key, p.reaches)} style={{ marginTop: 3 }} />
                    <span className="flex flex-col">
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</span>
                      <span className="muted sm">{p.hint}</span>
                    </span>
                  </label>
                  {p.reaches ? (
                    <select
                      aria-label={`${p.label}: how far`}
                      className="fld w-auto"
                      disabled={!on}
                      value={typeof value === 'string' ? value : p.reaches[0]}
                      onChange={(e) => reach(p.key, e.target.value as SalesReach)}
                    >
                      {p.reaches.map((r) => (
                        <option key={r} value={r}>
                          {REACH_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
        );
      })}
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className="btn pri sm" disabled={pending}>
          {pending ? 'Saving…' : role ? 'Save role' : 'Make role'}
        </button>
      </div>
      <Said result={result} />
    </form>
  );
}

function DeleteRole({ role }: { role: RoleCard }) {
  const { pending, result, run } = useAct();
  if (role.system) return <span className="muted sm">{SYSTEM_WORDS[role.system] ?? 'Built in'}: rename or edit, not delete.</span>;
  return (
    <>
      <button
        type="button"
        className="btn ghost sm bad-b"
        disabled={pending || role.people > 0}
        title={role.people > 0 ? 'Give its people another role first.' : undefined}
        onClick={() => {
          if (window.confirm(`Delete the role ${role.name}?`)) run(() => deleteRoleAction(role.id));
        }}
      >
        Delete
      </button>
      <Said result={result} />
    </>
  );
}

/** The Roles tab: every role, each opening into its matrix; and a new one. */
export function RolesTab({ roles }: { roles: RoleCard[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3" style={{ maxWidth: 880 }}>
      <p className="muted" style={{ margin: 0 }}>
        A role is what a salesperson may do and how far it reaches: <b>their own</b> leads, <b>their team</b> (everyone below them in the reporting lines, and their team pools), or <b>everyone</b>. Editing a role changes everyone on it. The owner, project managers and the other roles keep their own rights.
      </p>
      {roles.map((r) => (
        <section key={r.id} className="card flex flex-col gap-2 p-4">
          <div className="hstack" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{r.name}</h2>
              <span className="muted sm">
                {r.description ? `${r.description} · ` : ''}
                {r.people} {r.people === 1 ? 'person' : 'people'}
              </span>
            </div>
            <div className="hstack" style={{ gap: 8 }}>
              <button type="button" className="btn ghost sm" aria-expanded={open === r.id} onClick={() => setOpen((o) => (o === r.id ? null : r.id))}>
                {open === r.id ? 'Close' : 'Edit'}
              </button>
              <DeleteRole role={r} />
            </div>
          </div>
          {open === r.id ? <RoleEditor role={r} onDone={() => setOpen(null)} /> : <RoleSummary permissions={r.permissions} />}
        </section>
      ))}
      <section className="card flex flex-col gap-2 p-4">
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>New role</h2>
        <RoleEditor role={null} />
      </section>
    </div>
  );
}

/** "See leads: Their team · Work leads: Their own · …" */
function RoleSummary({ permissions }: { permissions: SalesPermissionMap }) {
  const on = SALES_PERMISSIONS.filter((p) => permissions[p.key] !== undefined);
  if (on.length === 0) return <span className="muted sm">Nothing switched on.</span>;
  return (
    <p className="muted sm" style={{ margin: 0, lineHeight: 1.5 }}>
      {on.map((p) => {
        const v = permissions[p.key];
        return `${p.label}${typeof v === 'string' ? `: ${REACH_LABELS[v]}` : ''}`;
      }).join(' · ')}
    </p>
  );
}

/** A salesperson's role and reporting line, on the People table. Loops are left out of the list (and refused by the server). */
export function SalesPersonControls({ person, roles, people }: { person: SalesPerson; roles: RoleCard[]; people: SalesPerson[] }) {
  const { pending, result, run } = useAct();
  const below = useMemo(() => new Set(subtreeOf(person.id, people.map((p) => ({ id: p.id, reportsToId: p.reportsToId })))), [person.id, people]);
  const bosses = people.filter((p) => p.role === 'SALES' && !below.has(p.id));
  if (person.isYou) {
    return <span className="muted sm">{roles.find((r) => r.id === person.salesRoleId)?.name ?? 'No sales role'}</span>;
  }
  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 190 }}>
      <select
        aria-label={`${person.name}'s sales role`}
        className="fld w-auto"
        disabled={pending}
        value={person.salesRoleId ?? ''}
        onChange={(e) => run(() => setSalesRoleAction(person.id, e.target.value || null))}
      >
        <option value="">No sales role (own leads, the studio pool)</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select
        aria-label={`Who ${person.name} reports to`}
        className="fld w-auto"
        disabled={pending}
        value={person.reportsToId ?? ''}
        onChange={(e) => run(() => setReportsToAction(person.id, e.target.value || null))}
      >
        <option value="">Reports to the owner</option>
        {bosses.map((b) => (
          <option key={b.id} value={b.id}>
            Reports to {b.name}
          </option>
        ))}
      </select>
      <Said result={result} />
    </div>
  );
}

/** The reporting lines as a tree: the owner at the top, each person under who they report to. */
export function TeamTree({ people, roles }: { people: SalesPerson[]; roles: RoleCard[] }) {
  const sales = people.filter((p) => p.role === 'SALES');
  const ids = new Set(sales.map((p) => p.id));
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? 'No sales role';
  const children = (bossId: string | null) => sales.filter((p) => (bossId === null ? !p.reportsToId || !ids.has(p.reportsToId) : p.reportsToId === bossId));
  const branch = (bossId: string | null, seen: Set<string>): React.ReactNode => {
    const kids = children(bossId).filter((k) => !seen.has(k.id));
    if (kids.length === 0) return null;
    return (
      <ul style={{ listStyle: 'none', margin: 0, paddingLeft: bossId === null ? 0 : 22, borderLeft: bossId === null ? 0 : '1px solid var(--line)' }}>
        {kids.map((k) => {
          const next = new Set(seen).add(k.id);
          return (
            <li key={k.id} style={{ padding: '6px 0 6px 8px' }}>
              <span style={{ fontWeight: 600 }}>{k.name}</span>
              <span className="muted sm"> · {roleName(k.salesRoleId)}{k.status !== 'ACTIVE' ? ` · ${k.status === 'INVITED' ? 'invited' : 'suspended'}` : ''}</span>
              {branch(k.id, next)}
            </li>
          );
        })}
      </ul>
    );
  };
  return (
    <section className="card flex flex-col gap-2 p-4" style={{ maxWidth: 720 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Who reports to whom</h2>
      <p className="muted sm" style={{ margin: 0 }}>
        A person’s team is everyone below them. With a role that reaches “their team”, they see and work those people’s leads and hand out their team pool.
      </p>
      <div>
        <span style={{ fontWeight: 600 }}>Owner</span>
        {sales.length === 0 ? <p className="muted sm">No salespeople yet.</p> : branch(null, new Set())}
      </div>
    </section>
  );
}
