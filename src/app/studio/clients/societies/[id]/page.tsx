import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../../clients.css';
import '../societies.css';
import { getSociety, mySocietyAccess, societyPeople } from '@/modules/studio-practice/societies';
import { PRIORITY_LABEL, HEAT_LABEL, monthLabel } from '@/modules/studio-practice/society-rules';
import { HeatChip, PriorityChip } from '../Chips';
import { AssignLeads, EditSociety, LeadWing, NoteForm, OverrideForm, OwnerForm, WingForm } from '../SocietyForms';

export const metadata: Metadata = {
  title: 'Society',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const when = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** One society: its wings, notes and leads (owner, 11 Nov 2026; Max plan). */
export default async function SocietyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await mySocietyAccess();
  if (!access) notFound();
  const s = await getSociety(access, id);
  if (!s) notFound();
  const people = access.mayManage ? await societyPeople(access.scope.studioId) : [];
  const noWing = s.leads.filter((l) => !l.wingId).length;

  return (
    <main className="content cl-page soc-page">
      <p style={{ margin: 0 }}>
        <Link href="/studio/clients/societies" className="linkbtn">
          ← All societies
        </Link>
      </p>
      <div className="phead">
        <div>
          <h1>{s.name}</h1>
          <p className="muted">
            {[s.locality, s.builder, `${s.wings.length} wing${s.wings.length === 1 ? '' : 's'}`, `${s.leads.length} lead${s.leads.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
            {s.sourceSheet ? ` · from ${s.sourceSheet}${s.sourceImportedAt ? `, ${when(s.sourceImportedAt)}` : ''}` : ''}
          </p>
        </div>
        {s.mayChange ? <EditSociety id={s.id} name={s.name} locality={s.locality} builder={s.builder} /> : null}
      </div>

      <div className="soc-facts">
        <section className="card">
          <span className="soc-k">Priority</span>
          <div className="hstack" style={{ gap: 8 }}>
            <PriorityChip p={s.priority} byHand={s.priorityByHand} />
            <b>{PRIORITY_LABEL[s.priority]}</b>
          </div>
          <p className="muted soc-small">
            {s.priorityByHand
              ? `Set by hand: ${s.priorityReason}. Automatic would be ${s.autoPriority.priority}.`
              : s.autoPriority.dateMissing
                ? 'No wing has a possession date yet. Add one below.'
                : `From possession in ${monthLabel(s.autoPriority.possessionOn!)}.`}
          </p>
          {s.mayChange ? <OverrideForm id={s.id} kind="priority" current={s.priorityByHand ? s.priority : null} /> : null}
        </section>
        <section className="card">
          <span className="soc-k">Response</span>
          <div className="hstack" style={{ gap: 8 }}>
            <HeatChip h={s.heat} byHand={s.heatByHand} />
            <b>{s.heat ? HEAT_LABEL[s.heat] : 'Too early to say'}</b>
          </div>
          <p className="muted soc-small">
            {s.heatByHand
              ? `Set by hand: ${s.heatReason}. Goes back to the calls after 30 days.`
              : `Last 60 days: ${s.calls.reached} lead${s.calls.reached === 1 ? '' : 's'} reached, ${s.calls.good} good, ${s.calls.bad} not interested.`}
          </p>
          {s.mayChange ? <OverrideForm id={s.id} kind="heat" current={s.heatByHand ? s.heat : null} /> : null}
        </section>
        <section className="card">
          <span className="soc-k">Owner</span>
          <b>{s.assignedTo ?? 'Nobody yet'}</b>
          {access.mayManage && !access.scope.member.viewOnly ? <OwnerForm id={s.id} current={s.assignedToId} people={people} /> : null}
        </section>
      </div>

      <section className="card">
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <h2 className="soc-h2">Wings</h2>
          <WingForm id={s.id} />
        </div>
        <table className="tbl soc-wings">
          <thead>
            <tr>
              <th>Wing</th>
              <th>Possession</th>
              <th className="num">Flats</th>
              <th className="num">Leads</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.wings.map((w) => (
              <tr key={w.id}>
                <td>
                  <b>{w.name}</b>
                </td>
                <td>{w.possessionOn ? monthLabel(w.possessionOn) : <span className="chip xs warn">Date missing</span>}</td>
                <td className="num mono">{w.flats ?? '—'}</td>
                <td className="num mono">{w.leads}</td>
                <td>
                  <WingForm id={s.id} wing={w} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {access.mayManage && !access.scope.member.viewOnly ? (
        <AssignLeads id={s.id} people={people} total={s.leads.length} unassigned={s.leads.filter((l) => !l.owner).length} />
      ) : null}

      <div className="soc-two">
        <section className="card">
          <h2 className="soc-h2">
            Leads <span className="mono muted">{s.leads.length}</span>
          </h2>
          {noWing ? <p className="muted soc-small">{noWing} without a wing. Pick one so the wing counts stay right.</p> : null}
          {s.leads.length === 0 ? (
            <p className="muted">No leads linked yet. Leads whose society is typed with this name are linked automatically, and an import adds the owners on a sheet.</p>
          ) : (
            <div className="tscroll">
              <table className="tbl soc-leads">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Wing</th>
                    <th>Stage</th>
                    <th>Last call</th>
                  </tr>
                </thead>
                <tbody>
                  {s.leads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/studio/clients/${l.id}`}>{l.name}</Link>
                        <div className="sub">{l.owner ?? 'Unassigned'}</div>
                      </td>
                      <td>
                        <LeadWing societyId={s.id} clientId={l.id} wingId={l.wingId} wings={s.wings.map((w) => ({ id: w.id, name: w.name }))} />
                      </td>
                      <td>{l.stage}</td>
                      <td>{l.lastCall ? <span className="soc-clip" title={l.lastCall.summary}>{when(l.lastCall.at)} · {l.lastCall.summary}</span> : <span className="muted">Not called</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="soc-h2">Notes</h2>
          <NoteForm id={s.id} />
          {s.notes.length === 0 ? <p className="muted">No notes yet.</p> : null}
          <ol className="soc-notes">
            {s.notes.map((n) => (
              <li key={n.id}>
                <span className="muted soc-small">
                  {when(n.at)} · {n.by}
                </span>
                <p>{n.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
