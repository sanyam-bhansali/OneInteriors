import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { crewList } from '@/modules/project/site-log-crew';
import { OnlyYourTeam } from '../../projects/marks';
import { AddCrew, CrewToggle } from './CrewControls';

export const metadata: Metadata = { title: 'Crew', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Crew (studio workspace Phase 2): the people a site supervisor
 * taps under "Who is on site?". The customer sees a crew member's first
 * name, their work and when they arrived — never the phone number. Someone
 * who leaves is switched off, not deleted, so their days on site stay true.
 */
export default async function CrewPage() {
  const crew = await crewList();
  if (!crew) {
    return (
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">Only the studio owner or a project manager manages the crew list.</p>
      </PageBody>
    );
  }
  const on = crew.filter((c) => c.active);
  const off = crew.filter((c) => !c.active);
  const th = 'whitespace-nowrap px-4 py-3 text-left text-[12.5px] font-semibold text-[var(--s-ink-3)]';
  const td = 'border-t border-[var(--s-rule)] px-4 py-3 align-middle text-[14px]';
  return (
    <PageBody>
      <p className="m-0 mb-5 max-w-[70ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
        Your carpenters, helpers and other trades. Supervisors tap them on the phone when they post the day&rsquo;s update; the customer sees
        &ldquo;Ramesh, carpenter, from 9 am&rdquo;. Supervisors can also add someone for a single day from the site.
      </p>
      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="h-crew" className="s-card min-w-0 flex-[999_1_520px]">
          <h2 id="h-crew" className="m-0 px-4 pb-1 pt-4 text-[16px] font-semibold">
            Crew <span className="font-[family-name:var(--font-mono)] text-[13px] font-normal text-[var(--s-ink-3)]">{on.length}</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  {['Name', 'Work', 'Phone', 'Days on site, 30 days', ''].map((h) => (
                    <th key={h} scope="col" className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...on, ...off].map((c) => (
                  <tr key={c.id} className={c.active ? undefined : 'text-[var(--s-ink-3)]'}>
                    <td className={`${td} font-medium`}>{c.name}</td>
                    <td className={td}>{c.role}</td>
                    <td className={`${td} font-[family-name:var(--font-mono)] text-[13px]`}>{c.phone ?? '—'}</td>
                    <td className={`${td} font-[family-name:var(--font-mono)] text-[13px]`}>{c.recentDays}</td>
                    <td className={`${td} text-right`}>
                      <CrewToggle id={c.id} active={c.active} />
                    </td>
                  </tr>
                ))}
                {crew.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${td} text-[var(--s-ink-3)]`}>
                      Nobody yet. Add the people who work on your sites.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-4">
          <AddCrew />
          <OnlyYourTeam>
            <p className="m-0 text-[13px] leading-relaxed text-[var(--s-ink-2)]">
              Phone numbers stay with your team. The customer&rsquo;s app shows first names and work only.
            </p>
          </OnlyYourTeam>
        </aside>
      </div>
    </PageBody>
  );
}
