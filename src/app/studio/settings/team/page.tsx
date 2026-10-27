import type { Metadata } from 'next';
import Link from 'next/link';
import { teamView } from '@/modules/studio/team-store';
import { currentMember } from '@/modules/studio/access';
import { FULL_SOFTWARE_ROLES } from '@/modules/studio/roles';
import { ROLE_LINES, ROLE_NAMES, ROLE_ORDER, STATUS_LINES, roleCan, seatLine } from '@/modules/studio/team-rules';
import { AddSomeone, PersonActions } from './TeamControls';
import { studioSignInMode } from '@/modules/auth/studio-password-rules';
import { RolesTab, SalesPersonControls, TeamTree, type SalesPerson } from './SalesTeam';
import { buildersSettings } from '@/modules/studio-quote/quote-requests';
import { QuoteBuilders } from './QuoteBuilders';

export const metadata: Metadata = { title: 'Team', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Team (design: StudioTeam.dc.html). Who is on the team, what
 * each can see, and the owner's controls. The layout already keeps everyone
 * but the owner out (`mayOpen`); `teamView` checks `team.manage` again on
 * its own.
 *
 * Sales roles and teams (owner, 22 Oct 2026; docs/studio-os/SALES-ROLES.md):
 * three tabs — People (each salesperson's sales role and who they report
 * to), Roles (the permission matrix) and Reporting lines (the tree). Someone
 * whose sales role manages the sales team opens it too, for the salespeople.
 */
const TABS = [
  { key: 'people', label: 'People' },
  { key: 'roles', label: 'Roles' },
  { key: 'tree', label: 'Reporting lines' },
  /* Quotation requests (owner, 22 Oct 2026; docs/studio-os/QUOTE-REQUESTS.md): who builds quotations, in turn. */
  { key: 'quotes', label: 'Quotations' },
] as const;

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [view, member, sp] = await Promise.all([teamView(), currentMember(), searchParams]);
  /* Password sign-in until WhatsApp codes are live (owner, 27 Oct 2026; auth/studio-password-rules.ts). */
  const passwordMode = studioSignInMode() === 'password';
  if (!view) {
    return <p className="ox-note">Only your studio owner manages the team.</p>;
  }
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? 'people';

  /* On Pro (owner, 21 Oct 2026) the owner adds salespeople; the other roles come with Max. Managing the sales team: salespeople only. */
  const pro = member?.fullSoftware === false;
  const roles = ROLE_ORDER.filter((role) => (!pro || !FULL_SOFTWARE_ROLES.includes(role)) && (view.full || role === 'SALES')).map((role) => ({ role, name: ROLE_NAMES[role], line: ROLE_LINES[role], can: roleCan(role) }));
  const used = Math.min(view.seatsUsed, view.freeSeats);
  const salesPeople: SalesPerson[] = view.people.map((p) => ({ id: p.id, name: p.name, role: p.role, status: p.status, salesRoleId: p.salesRoleId, reportsToId: p.reportsToId, isYou: p.isYou }));
  const roleCards = view.roles.map((r) => ({ id: r.id, name: r.name, description: r.description, system: r.system, permissions: r.permissions, people: r.people }));

  const tabs = (
    <nav className="tabs st-tabs" aria-label="Team" style={{ marginBottom: 12 }}>
      {TABS.map((t) => (
        <Link key={t.key} href={t.key === 'people' ? '/studio/settings/team' : `/studio/settings/team?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );

  if (tab === 'roles') {
    return (
      <>
        {tabs}
        <RolesTab roles={roleCards} />
      </>
    );
  }
  if (tab === 'quotes') {
    const builders = await buildersSettings();
    return (
      <>
        {tabs}
        {builders ? <QuoteBuilders settings={builders} /> : <p className="ox-note">Only your studio owner or a sales admin decides who builds quotations.</p>}
      </>
    );
  }
  if (tab === 'tree') {
    return (
      <>
        {tabs}
        <TeamTree people={salesPeople} roles={roleCards} />
      </>
    );
  }

  return (
    <>
      {tabs}
      <div className="hstack st-seatrow">
        <div className="st-seats">
          <div role="img" aria-label={seatLine(view.seatsUsed)} style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(view.freeSeats, 10)}, 18px)`, gap: 4 }}>
            {Array.from({ length: view.freeSeats }, (_, i) => (
              <span key={i} className={`st-seat${i < used ? ' on' : ''}`} />
            ))}
          </div>
          <span style={{ fontSize: 14 }}>{seatLine(view.seatsUsed)}</span>
        </div>
      </div>

      <div className="cols">
        <section aria-labelledby="h-people" className="card flush st-people">
          <div className="chead" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3, paddingBottom: 6 }}>
            <h2 id="h-people">People</h2>
            <span className="muted sm">Everyone signs in with their mobile number. A project manager or site supervisor only sees the sites listed against them.</span>
          </div>
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 1020 }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'Can see', 'Sales role and reports to', 'Last active', 'Language', 'Status'].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.people.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      {p.isYou ? (
                        <span className="chip" style={{ marginLeft: 8, minHeight: 22 }}>
                          You
                        </span>
                      ) : null}
                      <div className="mono muted sm" style={{ marginTop: 3 }}>
                        {p.phone ? p.phone.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2') : p.email}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{ROLE_NAMES[p.role]}</td>
                    <td>
                      {p.role === 'OWNER'
                        ? 'Everything'
                        : p.role === 'ACCOUNTS'
                          ? 'Payments on all projects'
                          : p.role === 'SALES'
                            ? p.salesRoleName
                              ? `As their role says (${p.salesRoleName})`
                              : 'Their own leads'
                            : p.sites.length
                              ? p.sites.map((s) => s.label).join(' · ')
                              : 'No sites yet'}
                    </td>
                    <td>
                      {p.role === 'SALES' ? (
                        <SalesPersonControls person={salesPeople.find((s) => s.id === p.id)!} roles={roleCards} people={salesPeople} />
                      ) : (
                        <span className="muted sm">—</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.lastActive ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }} className="muted">
                      {p.language}
                    </td>
                    <td>
                      <span className={p.status === 'ACTIVE' ? 'chip good' : p.status === 'SUSPENDED' ? 'chip bad' : 'chip warn'}>
                        <span className="dot" />
                        {STATUS_LINES[p.status]}
                      </span>
                      {p.status === 'INVITED' ? (
                        <div className="muted sm" style={{ marginTop: 3 }}>
                          Not using a seat
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {p.isYou || !view.full ? null : (
                        <PersonActions person={{ id: p.id, name: p.name, role: p.role, status: p.status, siteIds: p.sites.map((s) => s.id), designHead: p.designHead }} sites={view.sites} passwordMode={passwordMode} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AddSomeone
          passwordMode={passwordMode}
          roles={roles}
          sites={view.sites}
          seatsLeft={Math.max(0, view.freeSeats - view.seatsUsed)}
          salesRoles={roleCards.map((r) => ({ id: r.id, name: r.name, system: r.system }))}
          salespeople={view.people.filter((p) => p.role === 'SALES' && p.status !== 'SUSPENDED').map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </>
  );
}
