import Link from 'next/link';
import { siteLogForOffice, type OfficeLog } from '@/modules/project/site-log';
import { REASON_WORDS_STUDIO, countsAgainstStudio } from '@/modules/project/site-log-rules';
import { clock, shortDay } from '@/modules/studio/workspace-view';
import { CustomerSees, OnlyYourTeam } from '../marks';

/**
 * The Site log tab of the project workspace (studio workspace Phase 2):
 * every day of the last month as the site posted it — photos with the
 * sentence the customer reads under each, who was on site, what was ticked
 * off, nobody-on-site days with their reason, and corrections beside the
 * day they correct. What the supervisor actually said (the transcript) sits
 * in an "Only your team" box: it never reaches the customer. Working days
 * with no post are listed too, as the customer sees them.
 *
 * Read with `project.read` (site-log.ts `siteLogForOffice`); posting is
 * site mode's job (/studio/site/post/…).
 */

const muted = 'text-[12.5px] text-[var(--muted)]';
const LANG: Record<string, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi' };
const dayOf = (day: string) => shortDay(new Date(`${day}T12:00:00Z`));

interface Legacy {
  id: string;
  note: string;
  at: Date;
  byStudio: boolean;
  photos: number;
}

export async function SiteLogTab({ projectId, customer, now, legacy }: { projectId: string; customer: string; now: Date; legacy: Legacy[] }) {
  const log = await siteLogForOffice(projectId, now);
  if (!log) return <p className={muted}>The site log could not be read.</p>;
  const missed = new Set(log.missed);
  const rows = [...log.days.map((d) => ({ day: d.day, d })), ...log.missed.filter((m) => !log.days.some((d) => d.day === m)).map((m) => ({ day: m, d: null }))].sort((a, b) =>
    a.day < b.day ? 1 : -1,
  );

  return (
    <section aria-label="Site log" className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] font-semibold">
          Site log{' '}
          {log.score.pct !== null ? (
            <span className="mono text-[13px] font-normal text-[var(--muted)]">
              · posted {log.score.posted} of {log.score.due} working days ({log.score.pct}%), last 30 days
            </span>
          ) : null}
        </h2>
        <CustomerSees name={customer} />
      </div>
      <p className={`m-0 mt-1 ${muted}`}>
        Posted from site mode on the phone, one post a day; anything added later shows beside it.{' '}
        {log.canPost ? (
          <Link href={`/studio/site/post/${projectId}`} className="acc-t">
            Post today&rsquo;s update
          </Link>
        ) : null}
      </p>

      <ol className="m-0 mt-4 flex list-none flex-col p-0">
        {rows.map(({ day, d }) => (
          <li key={day} className="grid gap-3 border-t border-[var(--fill2)] py-4 sm:grid-cols-[110px_minmax(0,1fr)]">
            <span className="mono text-[12.5px] text-[var(--muted)]">{dayOf(day)}</span>
            <div className="flex min-w-0 flex-col gap-3">
              {d?.original ? <Entry log={d.original} customer={customer} /> : null}
              {!d?.original && missed.has(day) ? (
                <p className="m-0 text-[14px] font-medium text-[var(--warn)]">
                  Nothing posted. {customer} sees &ldquo;No update from the studio&rdquo; for this day.
                </p>
              ) : null}
              {d?.corrections.map((c) => (
                <div key={c.id} className="border-l-2 border-[var(--acc)] pl-3">
                  <p className="m-0 mb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] acc-t">Added at {clock(c.postedAt)}</p>
                  <Entry log={c} customer={customer} />
                </div>
              ))}
            </div>
          </li>
        ))}
        {rows.length === 0 ? <li className={`border-t border-[var(--fill2)] py-3 ${muted}`}>Nothing posted from site in the last 30 days.</li> : null}
      </ol>

      {legacy.length ? (
        <details className="mt-4 border-t border-[var(--fill2)] pt-3">
          <summary className="cursor-pointer text-[13.5px] font-medium text-[var(--text2)]">Earlier notes ({legacy.length}) · from before site mode</summary>
          <ul className="m-0 mt-2 flex list-none flex-col p-0">
            {legacy.map((u) => (
              <li key={u.id} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-[var(--fill2)] py-2.5 text-[14px]">
                <span className="mono text-[12.5px] text-[var(--muted)]">{shortDay(u.at)}</span>
                <span>
                  {u.note}
                  <span className={`block ${muted}`}>
                    {clock(u.at)}
                    {u.photos ? ` · ${u.photos} photo${u.photos === 1 ? '' : 's'}` : ''}
                    {u.byStudio ? '' : ' · from One Interiors'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function Entry({ log: l, customer }: { log: OfficeLog; customer: string }) {
  const late = l.arrivedAt.getTime() - l.postedAt.getTime() > 10 * 60_000;
  const said = [
    ...l.photos.map((p, i) => ({ key: `p${i}`, label: `Photo ${i + 1}`, ...p })),
    ...(l.voice ? [{ key: 'v', label: 'Something else', ...l.voice }] : []),
  ].filter((s) => s.transcript || s.hasRecording);
  return (
    <div className="flex flex-col gap-2.5">
      <p className={`m-0 ${muted}`}>
        {l.kind === 'NOBODY' ? 'Nobody on site' : 'Posted'} {clock(l.postedAt)} by {l.postedBy}
        {late ? ` · sent from the phone at ${clock(l.arrivedAt)} (no signal earlier)` : ''}
      </p>
      {l.kind === 'NOBODY' || l.reason ? (
        <p className="m-0 text-[14.5px]">
          <span className="font-medium">Nobody on site: {l.reason ? REASON_WORDS_STUDIO[l.reason] : 'no reason'}.</span>{' '}
          <span className="text-[var(--text2)]">{l.reason && !countsAgainstStudio(l.reason) ? 'Not counted against you.' : 'Counts in the studio delay.'}</span>
        </p>
      ) : null}
      {l.photos.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 p-0">
          {l.photos.map((p, i) => (
            <li key={i} className="flex flex-col gap-1">
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={`Site photo ${i + 1}`} className="aspect-[4/3] w-full rounded-[8px] bg-[var(--fill)] object-cover" />
              ) : (
                <span className="flex aspect-[4/3] w-full items-center justify-center rounded-[8px] bg-[var(--fill)] text-[12px] text-[var(--muted)]">Photo {i + 1}</span>
              )}
              {p.step ? <span className="text-[13px] font-semibold text-[var(--good)]">{p.step}</span> : null}
              <span className="text-[13.5px] leading-snug">{p.customerText ?? <span className="text-[var(--muted)]">No sentence</span>}</span>
              <span className={muted}>
                {clock(p.takenAt)}
                {p.fromGallery ? ' · from gallery' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {l.voice?.customerText ? <p className="m-0 text-[14.5px]">{l.voice.customerText}</p> : null}
      {l.crew.length ? (
        <p className="m-0 text-[13.5px] text-[var(--text2)]">
          On site: {l.crew.map((c) => `${c.name} (${c.role.toLowerCase()}${c.arrivedAt ? `, from ${clock(c.arrivedAt)}` : ''})`).join(', ')}
        </p>
      ) : null}
      {l.ticked.length ? (
        <p className="m-0 text-[13.5px] text-[var(--text2)]">Ticked off: {l.ticked.map((t) => t.label).join(', ')}</p>
      ) : null}
      {said.length ? (
        <OnlyYourTeam title={`Only your team · what was said (${customer} never hears or reads this)`}>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {said.map((s) => (
              <li key={s.key} className="text-[13px]">
                <span className="font-medium">{s.label}:</span>{' '}
                {s.transcript ? `“${s.transcript}”` : 'Recorded; not written down yet.'}
                {s.transcriptLang ? <span className={muted}> · {LANG[s.transcriptLang] ?? s.transcriptLang}</span> : null}
              </li>
            ))}
          </ul>
        </OnlyYourTeam>
      ) : null}
    </div>
  );
}
