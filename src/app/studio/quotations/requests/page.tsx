import Link from 'next/link';
import type { Metadata } from 'next';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { myQuoteRequests, requestsOverview, type RequestView } from '@/modules/studio-quote/quote-requests';
import { FinishRequest, OpenRequest, ReassignRequest } from './RequestControls';
import '../quotes.css';

export const metadata: Metadata = {
  title: 'To build',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Quotations → To build (owner, 22 Oct 2026; docs/studio-os/
 * QUOTE-REQUESTS.md). The quotation requests handed to me in turns — the
 * lead, its size, its floor plans, who asked and how long it has waited —
 * each opening the builder on its draft (the first quote built from the
 * floor plan). Below, for a head (owner, PM, anyone who gives leads to
 * people): every request within their reach, with who has it, to hand over
 * or cancel.
 */
export default async function ToBuildPage() {
  const member = await currentMember();
  const builds = member ? can(member, 'quote.build') : false;
  const [mine, overview] = await Promise.all([builds ? myQuoteRequests() : Promise.resolve([] as RequestView[]), requestsOverview()]);

  if (!builds && !overview) {
    return (
      <main className="content qpage">
        <div className="empty">
          <b>Quotation requests are not part of your role.</b>
          <span className="muted sm">They go to the people who build quotations.</span>
        </div>
      </main>
    );
  }

  return (
    <main className="content qpage hhome">
      <div>
        <h1>To build</h1>
        <p className="muted qsub">
          Quotations asked for on leads (a floor plan added, or “Request quotation”), handed out in turns so nobody builds the same one twice. Sending the
          quotation closes the request.
        </p>
      </div>

      {builds ? (
        <section aria-labelledby="h-mine" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 id="h-mine" className="hsec">
            Yours to build {mine.length ? <span className="chip hchip">{mine.length}</span> : null}
          </h2>
          {mine.length === 0 ? (
            <div className="empty">
              <b>Nothing to build right now.</b>
              <span className="muted sm">When a floor plan is added to a lead and it is your turn, it lands here and you are told.</span>
            </div>
          ) : (
            mine.map((r) => <RequestCard key={r.id} r={r} />)
          )}
        </section>
      ) : null}

      {overview ? (
        <section aria-labelledby="h-all" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 id="h-all" className="hsec">
            Requests
          </h2>
          <p className="muted sm" style={{ margin: 0 }}>
            {overview.rule}
            {overview.nextUp ? ` Next in turn: ${overview.nextUp}.` : ''}
          </p>
          {overview.open.length === 0 ? (
            <div className="empty">
              <b>No open requests.</b>
            </div>
          ) : (
            <div className="tscroll">
              <table className="htable">
                <thead>
                  <tr className="hhead">
                    <th scope="col">Lead</th>
                    <th scope="col">Building it</th>
                    <th scope="col">Asked by</th>
                    <th scope="col">Waiting</th>
                    <th scope="col">
                      <span className="sr-only">Hand over</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.open.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/studio/clients/${r.lead.id}`} style={{ fontWeight: 600 }}>
                          {r.lead.name}
                        </Link>
                        <div className="muted sm">{[r.lead.config, r.lead.society, r.reasonLabel].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td>
                        {r.assignedName ?? <span className="warn-t">Nobody yet</span>}
                        <div className="muted sm">
                          {r.statusLabel}
                          {r.assignedName ? (r.byTurn ? ' · in turn' : ' · handed over') : ''}
                        </div>
                      </td>
                      <td>{r.requestedByName ?? '—'}</td>
                      <td className="mono">{r.waiting}</td>
                      <td>
                        <ReassignRequest requestId={r.id} currentId={r.assignedToId} builders={overview.builders} allowCancel />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {overview.recent.length > 0 ? (
            <details>
              <summary className="sm">Done or cancelled in the last two weeks ({overview.recent.length})</summary>
              <ul className="sm" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
                {overview.recent.map((r) => (
                  <li key={r.id}>
                    <Link href={`/studio/clients/${r.lead.id}`}>{r.lead.name}</Link> · {r.statusLabel}
                    {r.status === 'DONE' && r.assignedName ? ` by ${r.assignedName}` : ''}
                    {r.status === 'CANCELLED' && r.cancelNote ? ` (${r.cancelNote.replace(/\.$/, '')})` : ''}
                    {r.quote ? ` · ${r.quote.number}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function RequestCard({ r }: { r: RequestView }) {
  const size = [r.lead.config, r.lead.carpetSqft ? `${r.lead.carpetSqft} sq ft` : null].filter(Boolean).join(' · ');
  return (
    <article className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 16 }}>{r.lead.name}</b>
          <div className="muted sm">{[size || 'Size not known yet', r.lead.society].filter(Boolean).join(' · ')}</div>
          <div className="muted sm" style={{ marginTop: 2 }}>
            {r.reasonLabel}
            {r.requestedByName ? ` by ${r.requestedByName}` : ''} · waiting {r.waiting}
            {r.lead.ownerName && r.lead.ownerName !== r.requestedByName ? ` · lead with ${r.lead.ownerName}` : ''}
            {r.byTurn ? '' : ' · handed to you by a head'}
          </div>
        </div>
        <span className={`chip hchip ${r.status === 'IN_PROGRESS' ? 'warn' : ''}`}>{r.statusLabel}</span>
      </div>

      {r.note ? <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>“{r.note}”</p> : null}

      {r.plans.length > 0 ? (
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }} aria-label="Floor plans">
          {r.plans.map((p) =>
            p.url ? (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={p.name} className="chip hchip" style={{ padding: p.isImage ? 2 : undefined }}>
                {p.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived storage link; next/image cannot optimise it
                  <img src={p.url} alt={`Floor plan: ${p.name}`} style={{ height: 56, width: 'auto', borderRadius: 6, display: 'block' }} />
                ) : (
                  <>📄 {p.name}</>
                )}
              </a>
            ) : (
              <span key={p.id} className="chip hchip muted">
                {p.name}
              </span>
            ),
          )}
        </div>
      ) : (
        <span className="muted sm">No floor plan on the lead: the draft is built from its BHK.</span>
      )}

      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <OpenRequest requestId={r.id} started={r.status === 'IN_PROGRESS'} />
        <FinishRequest requestId={r.id} clientId={r.lead.id} />
        <span className="muted sm" style={{ alignSelf: 'center' }}>
          {r.quote ? `Draft ${r.quote.number}${r.quote.lines ? ` · ${r.quote.lines} lines` : ' · no lines yet'}` : 'No draft yet: opening builds one from the lead and its plan.'}
        </span>
      </div>
    </article>
  );
}
