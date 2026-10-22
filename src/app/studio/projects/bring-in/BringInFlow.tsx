'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import type { BringInContext, LeadPick, OurQuotePick, PlanPreview, QuoteChoice, SourcePreview } from '@/modules/studio-bring-in/bring-in';
import type { SourceMatch } from '@/modules/studio-bring-in/hauspire-map';
import {
  bringInAction,
  builderQuoteAction,
  findLeadsAction,
  leadOnMobileAction,
  ourQuotesAction,
  planPreviewAction,
  previewSourceAction,
  searchSourceAction,
} from './actions';

/**
 * The guided flow, one step per screen (docs/studio-os/BRING-IN-PROJECTS.md).
 * Nothing is written until "Bring it in", except on the builder path, where
 * the new lead is saved so its quotation can be built. Every figure shown is
 * what the server worked out; the server checks it all again.
 */

const STEPS = ['Client', 'Quotation', 'Where it is now', 'Payments received', 'Team', 'Client app', 'Bring it in'] as const;
const PHASES = [
  { id: 'DESIGN', label: 'Design', hint: 'Design under way: pick the last design step done.' },
  { id: 'EXECUTION', label: 'Execution', hint: 'Design signed off, work on site: pick the last execution step done.' },
  { id: 'SNAGS', label: 'Snags', hint: 'Handed over; snags being closed. Every step is done.' },
  { id: 'WARRANTY', label: 'Warranty', hint: 'The client signed off the handover. Every step is done.' },
] as const;
type Phase = (typeof PHASES)[number]['id'];
const MODES = [
  ['UPI', 'UPI'],
  ['BANK', 'Bank transfer'],
  ['CHEQUE', 'Cheque'],
  ['CASH', 'Cash'],
] as const;

type NewLead = { name: string; phone: string; email: string; society: string; locality: string; config: string };
type PayRow = { amount: string; on: string; mode: string };

const fld = 'fld w-full';
const lbl = 'lbl mb-1.5 block';
const hint = 'm-0 mt-1 text-[12.5px] text-[var(--muted)]';
const toPaise = (s: string): number => {
  const n = Number(s.replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};
const inr = (p: number) => formatINR(p);

export function BringInFlow({ ctx, initialQuoteId }: { ctx: BringInContext; initialQuoteId: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // a. Client
  const [leadMode, setLeadMode] = useState<'pick' | 'new'>('pick');
  const [leadQuery, setLeadQuery] = useState('');
  const [leads, setLeads] = useState<LeadPick[]>([]);
  const [lead, setLead] = useState<LeadPick | null>(null);
  const [newLead, setNewLead] = useState<NewLead>({ name: '', phone: '', email: '', society: '', locality: '', config: '' });
  const [dup, setDup] = useState<{ name: string; why: string | null; pick: LeadPick | null } | null>(null);

  // b. Quotation
  const [quoteWay, setQuoteWay] = useState<'import' | 'ours'>(ctx.canImport ? 'import' : 'ours');
  const [srcQuery, setSrcQuery] = useState('');
  const [matches, setMatches] = useState<SourceMatch[]>([]);
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [ours, setOurs] = useState<OurQuotePick[]>([]);
  const [ourId, setOurId] = useState<string | null>(initialQuoteId);
  const [plan, setPlan] = useState<PlanPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // c–f
  const [phase, setPhase] = useState<Phase>('DESIGN');
  const [lastStep, setLastStep] = useState('');
  const [handoverOn, setHandoverOn] = useState(ctx.today);
  const [pays, setPays] = useState<PayRow[]>([]);
  const [team, setTeam] = useState({ designerId: ctx.me.role === 'DESIGNER' ? ctx.me.id : '', pmId: ctx.me.role === 'PM' ? ctx.me.id : '', supervisorId: '' });
  const [inviteNow, setInviteNow] = useState(true);

  const leadId = leadMode === 'pick' ? (lead?.id ?? null) : null;
  const clientName = leadMode === 'pick' ? (lead?.name ?? '') : newLead.name;
  const config = leadMode === 'pick' ? (lead?.config ?? null) : newLead.config || null;
  const choice: QuoteChoice | null = quoteWay === 'import' ? (preview ? { kind: 'import', sourceId: preview.sourceId } : null) : ourId ? { kind: 'ours', quoteId: ourId } : null;

  const run = (fn: () => Promise<void>) => {
    setError(null);
    start(async () => {
      try {
        await fn();
      } catch {
        setError('That did not go through. Try again.');
      }
    });
  };

  const loadOurs = (id: string | null) => {
    if (!id) return;
    run(async () => setOurs(await ourQuotesAction(id)));
  };

  // A quotation chosen: the stages and the steps to pick from.
  useEffect(() => {
    setPlan(null);
    setConfirmed(false);
    if (!choice) return;
    let live = true;
    void planPreviewAction(choice, config).then((r) => {
      if (!live) return;
      if (r.ok) {
        setPlan(r.preview);
        setPays(r.preview.stages.map(() => ({ amount: '', on: ctx.today, mode: 'BANK' })));
      } else setError(r.error);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read only when the quotation changes
  }, [choice?.kind, choice && 'sourceId' in choice ? choice.sourceId : choice && 'quoteId' in choice ? choice.quoteId : null]);

  const canNext = (): string | null => {
    if (step === 0) {
      if (leadMode === 'pick') return lead ? null : 'Pick the client’s lead, or add them.';
      if (newLead.name.trim().length < 2) return 'The client’s name, please.';
      if (newLead.phone.replace(/\D/g, '').length < 10) return 'The client’s 10-digit mobile number, please.';
      if (dup) return 'This mobile is already on your board: use that lead.';
      return null;
    }
    if (step === 1) {
      if (!choice) return quoteWay === 'import' ? 'Find and pick the quotation in the quotation app.' : 'Pick the client’s quotation from our builder.';
      if (!plan) return 'Reading the quotation…';
      return confirmed ? null : 'Confirm the total matches what the client signed.';
    }
    if (step === 2 && (phase === 'SNAGS' || phase === 'WARRANTY') && !handoverOn) return 'The handover day, please.';
    return null;
  };

  const next = () => {
    const why = canNext();
    if (why) return setError(why);
    setError(null);
    if (step === 0 && leadMode === 'new') {
      // The duplicate check on mobile, like the lead form.
      run(async () => {
        const r = await leadOnMobileAction(newLead.phone);
        if (!r.ok) return setError(r.error);
        if (r.match) return setDup({ name: r.match.name, why: r.match.why, pick: r.match.usable ? r.match : null });
        setStep(1);
      });
      return;
    }
    if (step === 0 && leadId) loadOurs(leadId);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = () =>
    run(async () => {
      const r = await bringInAction({
        lead: leadMode === 'pick' && lead ? { id: lead.id } : newLead,
        quote: choice!,
        confirmedTotalPaise: plan?.totalPaise ?? 0,
        phase,
        lastStep: lastStep || null,
        handoverOn,
        payments: pays.map((p, i) => ({ stageIndex: i, amountPaise: toPaise(p.amount), receivedOn: p.on, mode: p.mode })).filter((p) => p.amountPaise > 0),
        team,
        inviteNow,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/studio/projects/${r.projectId}?started=1`);
    });

  const choices = phase === 'DESIGN' ? (plan?.choices.DESIGN ?? []) : phase === 'EXECUTION' ? (plan?.choices.EXECUTION ?? []) : [];
  const paidPaise = pays.reduce((n, p) => n + toPaise(p.amount), 0);
  const name = (id: string, list: { id: string; name: string }[]) => list.find((t) => t.id === id)?.name ?? 'Nobody yet';

  return (
    <div className="grid max-w-[980px] gap-5">
      <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" className={`chip ${i === step ? 'oi' : i < step ? 'good' : ''}`} disabled={i > step || pending} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <section className="card" aria-labelledby="bi-step">
        <h2 id="bi-step" className="m-0 text-[19px] font-semibold">
          {step + 1}. {STEPS[step]}
        </h2>

        {step === 0 ? (
          <>
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={leadMode === 'pick'} onClick={() => setLeadMode('pick')}>
                A lead on your board
              </button>
              <button type="button" role="tab" aria-selected={leadMode === 'new'} onClick={() => setLeadMode('new')}>
                Add the client
              </button>
            </div>
            {leadMode === 'pick' ? (
              <div className="grid gap-3">
                <form
                  className="hstack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => setLeads(await findLeadsAction(leadQuery)));
                  }}
                >
                  <input aria-label="Name or mobile" className={fld} value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Name or mobile" />
                  <button type="submit" className="btn sec" disabled={pending}>
                    Find
                  </button>
                </form>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {leads.map((l) => (
                    <li key={l.id}>
                      <label className="card flex-row cursor-pointer items-center" style={lead?.id === l.id ? { boxShadow: 'inset 0 0 0 1.5px var(--acc)' } : undefined}>
                        <input type="radio" name="lead" checked={lead?.id === l.id} onChange={() => setLead(l)} />
                        <span className="min-w-0 flex-1">
                          <b>{l.name}</b>
                          <span className="block text-[13px] text-[var(--muted)]">{[l.phone, l.society, l.locality, l.config].filter(Boolean).join(' · ')}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {lead ? <p className={hint}>Bringing in {lead.name}.</p> : null}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['name', 'Client’s name', 'text'],
                    ['phone', 'Mobile', 'tel'],
                    ['society', 'Society and flat', 'text'],
                    ['locality', 'Locality', 'text'],
                    ['config', 'BHK (e.g. 3 BHK)', 'text'],
                    ['email', 'Email (optional)', 'email'],
                  ] as const
                ).map(([k, label, type]) => (
                  <div key={k}>
                    <label htmlFor={`bi-${k}`} className={lbl}>
                      {label}
                    </label>
                    <input
                      id={`bi-${k}`}
                      type={type}
                      className={fld}
                      value={newLead[k]}
                      onChange={(e) => {
                        setNewLead({ ...newLead, [k]: e.target.value });
                        if (k === 'phone') setDup(null);
                      }}
                      autoComplete="off"
                    />
                  </div>
                ))}
                {dup ? (
                  <div className="banner sm:col-span-2" role="status">
                    <b>{dup.name}</b> is already on your board with this mobile. {dup.why ?? ''}
                    {dup.pick ? (
                      <button
                        type="button"
                        className="btn sm sec ml-2"
                        onClick={() => {
                          setLeadMode('pick');
                          setLead(dup.pick);
                          setLeads([dup.pick!]);
                          setDup(null);
                        }}
                      >
                        Use that lead
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={quoteWay === 'import'} onClick={() => setQuoteWay('import')}>
                From the Hauspire quotation app
              </button>
              <button type="button" role="tab" aria-selected={quoteWay === 'ours'} onClick={() => setQuoteWay('ours')}>
                Built in our builder
              </button>
            </div>
            {quoteWay === 'import' ? (
              !ctx.canImport ? (
                <p className="m-0 text-[14.5px] text-[var(--text2)]">{ctx.notConnected} Until then, build the quotation in our builder.</p>
              ) : (
                <div className="grid gap-3">
                  <form
                    className="hstack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        const r = await searchSourceAction(srcQuery || clientName);
                        if (r.ok) setMatches(r.matches);
                        else setError(r.error);
                      });
                    }}
                  >
                    <input aria-label="Quotation number or client name" className={fld} value={srcQuery} onChange={(e) => setSrcQuery(e.target.value)} placeholder={`Quotation number or client name (${clientName || 'e.g. 2312'})`} />
                    <button type="submit" className="btn sec" disabled={pending}>
                      Search
                    </button>
                  </form>
                  {matches.length ? (
                    <div className="tscroll">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>No.</th>
                            <th>Client</th>
                            <th>BHK</th>
                            <th>Total (before GST)</th>
                            <th>Date</th>
                            <th>Stage</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {matches.map((m) => (
                            <tr key={m.id}>
                              <td className="mono">{m.number}</td>
                              <td>{m.client}</td>
                              <td>{m.bhk ?? '—'}</td>
                              <td className="mono">{inr(m.tpvPaise)}</td>
                              <td>{m.date ?? '—'}</td>
                              <td>{m.stage === 'design' ? 'Design final' : 'Sales final'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn sm sec"
                                  disabled={pending}
                                  onClick={() =>
                                    run(async () => {
                                      const r = await previewSourceAction(m.id);
                                      if (r.ok) setPreview(r.preview);
                                      else setError(r.error);
                                    })
                                  }
                                >
                                  {preview?.sourceId === m.id ? 'Picked' : 'Pick'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {preview ? <SourceLines preview={preview} /> : null}
                </div>
              )
            ) : (
              <div className="grid gap-3">
                {ours.length ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {ours.map((q) => (
                      <li key={q.id}>
                        <label className="card flex-row cursor-pointer items-center" style={ourId === q.id ? { boxShadow: 'inset 0 0 0 1.5px var(--acc)' } : undefined}>
                          <input type="radio" name="ourq" checked={ourId === q.id} onChange={() => setOurId(q.id)} />
                          <span className="min-w-0 flex-1">
                            <b className="mono">{q.number}</b> · {q.lines} lines {q.salesFinal ? `· sales final ${q.salesFinal}` : '· becomes the sales final'}
                          </span>
                          <span className="mono">{inr(q.totalPaise)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-[14.5px] text-[var(--text2)]">No quotation for {clientName || 'this client'} in our builder yet.</p>
                )}
                {ctx.canBuild ? (
                  <div className="hstack flex-wrap">
                    <button
                      type="button"
                      className="btn sec"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const r = await builderQuoteAction(leadMode === 'pick' && lead ? { id: lead.id } : newLead);
                          if (!r.ok) return setError(r.error);
                          if (leadMode === 'new') {
                            const saved: LeadPick = { id: r.leadId, name: newLead.name, phone: newLead.phone, society: newLead.society || null, locality: newLead.locality || null, config: newLead.config || null };
                            setLeadMode('pick');
                            setLead(saved);
                            setLeads([saved]);
                          }
                          window.open(`/studio/quotations/${r.quoteId}`, '_blank', 'noopener');
                        })
                      }
                    >
                      Build it in our builder
                    </button>
                    <button type="button" className="btn ghost" disabled={pending || !leadId} onClick={() => loadOurs(leadId)}>
                      I have built it — show it here
                    </button>
                  </div>
                ) : (
                  <p className={hint}>Ask your owner or a project manager to build the quotation in the builder, then pick it here.</p>
                )}
                <p className={hint}>The builder opens in a new tab. Build every room as the client agreed, then come back and press “show it here”.</p>
              </div>
            )}
            {plan ? (
              <div className="banner">
                <span>
                  Total the client pays: <b className="mono">{inr(plan.totalPaise)}</b>
                </span>
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  This matches what the client signed.
                </label>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {PHASES.map((p) => (
                <label key={p.id} className="card flex-row cursor-pointer items-start" style={phase === p.id ? { boxShadow: 'inset 0 0 0 1.5px var(--acc)' } : undefined}>
                  <input
                    type="radio"
                    name="phase"
                    checked={phase === p.id}
                    onChange={() => {
                      setPhase(p.id);
                      setLastStep('');
                    }}
                    className="mt-1"
                  />
                  <span>
                    <b>{p.label}</b>
                    <span className="block text-[13px] text-[var(--muted)]">{p.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {phase === 'DESIGN' || phase === 'EXECUTION' ? (
              <div>
                <label htmlFor="bi-last" className={lbl}>
                  The last step done
                </label>
                <select id="bi-last" className={fld} value={lastStep} onChange={(e) => setLastStep(e.target.value)}>
                  <option value="">{phase === 'DESIGN' ? 'Nothing yet' : 'Design is done; nothing on site yet'}</option>
                  {choices.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.stageName} · {c.group} · {c.label}
                    </option>
                  ))}
                </select>
                <p className={hint}>
                  Every step up to it is ticked “Done before joining One Interiors”, with no photo. The rest stay open, planned from today. From now on a tick needs a photo
                  and a sentence, as usual.
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor="bi-hand" className={lbl}>
                  Handed over on
                </label>
                <input id="bi-hand" type="date" max={ctx.today} className={fld} value={handoverOn} onChange={(e) => setHandoverOn(e.target.value)} />
                <p className={hint}>{phase === 'WARRANTY' ? 'The warranty runs from this day.' : 'The snag window counts from the handover payment.'}</p>
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3">
            <p className="m-0 text-[14.5px] text-[var(--text2)]">
              What {clientName || 'the client'} has already paid, stage by stage. These count as paid at once; the client is not asked to confirm past payments. Leave a
              stage empty if nothing came in.
            </p>
            {plan?.stages.map((s, i) => (
              <div key={s.label + i} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr]">
                <span>
                  <b>{s.label}</b>
                  <span className="block mono text-[13px] text-[var(--muted)]">{inr(s.amountPaise)}</span>
                </span>
                <input aria-label={`${s.label}: amount received (₹)`} inputMode="decimal" className={fld} placeholder="₹ received" value={pays[i]?.amount ?? ''} onChange={(e) => setPays(pays.map((p, j) => (j === i ? { ...p, amount: e.target.value } : p)))} />
                <input aria-label={`${s.label}: received on`} type="date" max={ctx.today} className={fld} value={pays[i]?.on ?? ctx.today} onChange={(e) => setPays(pays.map((p, j) => (j === i ? { ...p, on: e.target.value } : p)))} />
                <select aria-label={`${s.label}: mode`} className={fld} value={pays[i]?.mode ?? 'BANK'} onChange={(e) => setPays(pays.map((p, j) => (j === i ? { ...p, mode: e.target.value } : p)))}>
                  {MODES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className={hint}>Received so far: {inr(paidPaise)}</p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['designerId', 'Designer', ctx.designers],
                ['pmId', 'Project manager', ctx.pms],
                ['supervisorId', 'Site supervisor', ctx.supervisors],
              ] as const
            ).map(([k, label, list]) => (
              <div key={k}>
                <label htmlFor={`bi-${k}`} className={lbl}>
                  {label}
                </label>
                <select id={`bi-${k}`} className={fld} value={team[k]} onChange={(e) => setTeam({ ...team, [k]: e.target.value })}>
                  <option value="">Nobody yet</option>
                  {list.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="invite" checked={inviteNow} onChange={() => setInviteNow(true)} /> Send {clientName.split(' ')[0] || 'the client'} the app invite now (SMS, and
              email when known)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="invite" checked={!inviteNow} onChange={() => setInviteNow(false)} /> Later — I will send it from the project page
            </label>
          </div>
        ) : null}

        {step === 6 ? (
          <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            <dt className="muted">Client</dt>
            <dd className="m-0">{clientName}</dd>
            <dt className="muted">Quotation</dt>
            <dd className="m-0">
              {quoteWay === 'import' && preview ? `Q-${preview.quote.number} from the Hauspire quotation app` : `${ours.find((q) => q.id === ourId)?.number ?? ''} from our builder`} ·{' '}
              <span className="mono">{plan ? inr(plan.totalPaise) : ''}</span>
            </dd>
            <dt className="muted">Now in</dt>
            <dd className="m-0">
              {PHASES.find((p) => p.id === phase)?.label}
              {lastStep ? ` · last done: ${choices.find((c) => c.key === lastStep)?.label ?? ''}` : ''}
            </dd>
            <dt className="muted">Paid so far</dt>
            <dd className="m-0 mono">{inr(paidPaise)}</dd>
            <dt className="muted">Team</dt>
            <dd className="m-0">
              Designer {name(team.designerId, ctx.designers)} · PM {name(team.pmId, ctx.pms)} · Supervisor {name(team.supervisorId, ctx.supervisors)}
            </dd>
            <dt className="muted">Client app</dt>
            <dd className="m-0">{inviteNow ? 'Invite sent now' : 'Invite later'}</dd>
          </dl>
        ) : null}

        {error ? (
          <p role="alert" className="m-0 text-[13.5px] text-[var(--bad)]">
            {error}
          </p>
        ) : null}

        <div className="hstack">
          {step > 0 ? (
            <button type="button" className="btn ghost" disabled={pending} onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn pri" disabled={pending} onClick={next}>
              {pending ? 'Working…' : 'Next'}
            </button>
          ) : (
            <button type="button" className="btn pri lg" disabled={pending || !choice || !plan} onClick={submit}>
              {pending ? 'Bringing it in…' : 'Bring it in'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function SourceLines({ preview }: { preview: SourcePreview }) {
  const q = preview.quote;
  const flagged = new Set(preview.notInMaster);
  const rooms = [...new Set(q.lines.map((l) => l.room))];
  return (
    <div className="grid gap-2">
      <p className="m-0 text-[14.5px]">
        <b>Q-{q.number}</b> · {q.client} · {q.lines.length} lines · modular discount {q.terms.discountBps / 100}% · fee {q.terms.feeBps ? 'on' : 'off'} · GST {q.terms.gstBps ? 'on' : 'off'}
        {q.terms.onSpotPaise ? ` · ${q.terms.onSpotLabel ?? 'On-spot discount'} ${inr(q.terms.onSpotPaise)}` : ''}
        {q.terms.quoteDate ? ` · dated ${q.terms.quoteDate}` : ''}
      </p>
      {preview.design ? (
        <p className={hint}>
          The app also has a Design Final ({preview.design.lines} lines, {inr(preview.design.totalPaise)}): it comes in as this project’s Design Final.
        </p>
      ) : null}
      {preview.alreadyImported ? <p className={hint}>Already brought in as {preview.alreadyImported}; that quotation is used.</p> : null}
      {q.warnings.map((w) => (
        <p key={w} className="m-0 text-[13.5px] warn-t">
          {w}
        </p>
      ))}
      <div className="tscroll" style={{ maxHeight: 360 }}>
        <table className="tbl">
          <tbody>
            {rooms.map((room) => (
              <RoomRows key={room} room={room} lines={q.lines.map((l, i) => ({ l, i })).filter((x) => x.l.room === room)} flagged={flagged} />
            ))}
          </tbody>
        </table>
      </div>
      <p className={hint}>
        Kept exactly as agreed: every line’s amount stays the client’s figure. Lines marked “not in your products” are kept as typed, as in the builder.
      </p>
    </div>
  );
}

function RoomRows({ room, lines, flagged }: { room: string; lines: { l: SourcePreview['quote']['lines'][number]; i: number }[]; flagged: Set<number> }) {
  return (
    <>
      <tr>
        <th colSpan={4}>{room}</th>
      </tr>
      {lines.map(({ l, i }) => (
        <tr key={i}>
          <td>
            {l.product}
            {flagged.has(i) ? <span className="chip warn ml-1.5">not in your products</span> : null}
            {l.details ? <span className="block text-[12.5px] text-[var(--muted)]">{l.details}</span> : null}
          </td>
          <td>{l.code === 'MODULAR' ? 'MO-01' : 'NM-01'}</td>
          <td className="mono">{l.unit === 'AREA' ? `${l.widthMm} × ${l.heightMm}` : l.qtyMilli !== null ? `${l.qtyMilli / 1000} ${l.unit === 'SQFT' ? 'sq ft' : l.unit === 'RFT' ? 'rft' : 'no.'}` : ''}</td>
          <td className="mono">{formatINR(l.amountPaise)}</td>
        </tr>
      ))}
    </>
  );
}
