import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { teamView } from '@/modules/studio/team-store';
import { ROLE_LINES, ROLE_NAMES, ROLE_ORDER, STATUS_LINES, roleCan, seatLine } from '@/modules/studio/team-rules';
import { AddSomeone, PersonActions } from './TeamControls';

export const metadata: Metadata = { title: 'Team', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Team (design: StudioTeam.dc.html, in the studio's own palette).
 * Who is on the team, what each can see, and the owner's controls. The
 * layout already keeps everyone but the owner out (`mayOpen`); `teamView`
 * checks `team.manage` again on its own.
 */
export default async function TeamPage() {
  const view = await teamView();
  if (!view) {
    return (
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">Only your studio owner manages the team.</p>
      </PageBody>
    );
  }

  const roles = ROLE_ORDER.map((role) => ({ role, name: ROLE_NAMES[role], line: ROLE_LINES[role], can: roleCan(role) }));
  const used = Math.min(view.seatsUsed, view.freeSeats);

  return (
    <PageBody>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="m-0 max-w-[70ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          Everyone signs in with their mobile number. A project manager or site supervisor only sees the sites listed
          against them.
        </p>
        <div className="s-card flex items-center gap-3 px-4 py-2.5">
          <div role="img" aria-label={seatLine(view.seatsUsed)} className="grid grid-cols-5 gap-1">
            {Array.from({ length: view.freeSeats }, (_, i) => (
              <span
                key={i}
                className={`h-[18px] w-[18px] rounded-[5px] ${i < used ? 'bg-[var(--s-accent)]' : 'shadow-[inset_0_0_0_1.5px_var(--s-ink-3)]'}`}
              />
            ))}
          </div>
          <span className="s-num text-[14px]">{seatLine(view.seatsUsed)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="h-people" className="s-card min-w-0 flex-[999_1_560px]">
          <h2 id="h-people" className="m-0 px-5 pb-1 pt-4 text-[16px] font-semibold">
            People
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="text-[12.5px] text-[var(--s-ink-3)]">
                  {['Name', 'Role', 'Can see', 'Last active', 'Language', 'Status'].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.people.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--s-rule-soft)] align-top text-[14px]">
                    <td className="px-4 py-3.5">
                      <span className="font-semibold">{p.name}</span>
                      {p.isYou ? <span className="s-tag ml-2">You</span> : null}
                      <div className="s-num mt-0.5 font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--s-ink-3)]">
                        {p.phone ? p.phone.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2') : p.email}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">{ROLE_NAMES[p.role]}</td>
                    <td className="px-4 py-3.5 text-[var(--s-ink-2)]">
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
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--s-ink-2)]">{p.lastActive ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--s-ink-2)]">{p.language}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          className={`s-dot ${p.status === 'ACTIVE' ? 'bg-[var(--s-good)]' : p.status === 'SUSPENDED' ? 'bg-[var(--s-bad)]' : 'bg-[var(--s-warn)]'}`}
                        />
                        {STATUS_LINES[p.status]}
                      </span>
                      {p.status === 'INVITED' ? <div className="mt-0.5 text-[12.5px] text-[var(--s-ink-3)]">Not using a seat</div> : null}
                    </td>
                    <td className="px-4 py-3.5">
                      {p.isYou ? null : (
                        <PersonActions
                          person={{ id: p.id, name: p.name, role: p.role, status: p.status, siteIds: p.sites.map((s) => s.id) }}
                          sites={view.sites}
                        />
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
    </PageBody>
  );
}
