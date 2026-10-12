import type { Metadata } from 'next';
import { teamView } from '@/modules/studio/team-store';
import { ROLE_LINES, ROLE_NAMES, ROLE_ORDER, STATUS_LINES, roleCan, seatLine } from '@/modules/studio/team-rules';
import { AddSomeone, PersonActions } from './TeamControls';

export const metadata: Metadata = { title: 'Team', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Team (design: StudioTeam.dc.html). Who is on the team, what
 * each can see, and the owner's controls. The layout already keeps everyone
 * but the owner out (`mayOpen`); `teamView` checks `team.manage` again on
 * its own.
 */
export default async function TeamPage() {
  const view = await teamView();
  if (!view) {
    return <p className="ox-note">Only your studio owner manages the team.</p>;
  }

  const roles = ROLE_ORDER.map((role) => ({ role, name: ROLE_NAMES[role], line: ROLE_LINES[role], can: roleCan(role) }));
  const used = Math.min(view.seatsUsed, view.freeSeats);

  return (
    <>
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
            <table className="tbl" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'Can see', 'Last active', 'Language', 'Status'].map((h) => (
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
                            ? 'Their own leads'
                            : p.sites.length
                              ? p.sites.map((s) => s.label).join(' · ')
                              : 'No sites yet'}
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
                      {p.isYou ? null : (
                        <PersonActions person={{ id: p.id, name: p.name, role: p.role, status: p.status, siteIds: p.sites.map((s) => s.id) }} sites={view.sites} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AddSomeone roles={roles} sites={view.sites} seatsLeft={Math.max(0, view.freeSeats - view.seatsUsed)} />
      </div>
    </>
  );
}
