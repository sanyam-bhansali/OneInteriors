'use client';

import { useActionState, useMemo, useRef, useState, useTransition } from 'react';
import { DISCOUNT_NAMES } from '@/modules/studio-quote/pricing';
import { CONFIGS, planQuotation, standardRunFor, type CatalogueProduct, type ConfigName } from '@/modules/studio-quote/configure';
import type { StoredFileReading } from '@/modules/studio-quote/from-plan-rules';
import type { LeadPlan } from '@/modules/studio-quote/from-plan';
import type { ProductRow } from '@/modules/studio-quote/store';
import type { FoundClient } from '@/modules/studio-practice/clients';
import { checkLeadFile, LEAD_FILE_ACCEPT } from '@/modules/studio-sales/lead-rules';
import { FloorPlanView } from '@/components/floorplan/FloorPlanView';
import { addPlanLeadAction, leadPlansAction, readLeadPlanAction, saveFirstQuoteAction } from '../actions';
import { CLIENT_TITLES } from '@/modules/studio-quote/client-title';
import { attachFileAction } from '../../sales-actions';
import { searchAction } from '../../search-actions';
import type { State } from '../../form-state';
import { DiscountPicker, Sec } from '../[id]/HPanels';
import { rupeesToPaiseText } from '../[id]/TermsPanel';
import { PreviousQuotePicker, type PickedQuote } from '../PreviousQuotePicker';
import { PlanViewer } from '../PlanViewer';

type Lead = Pick<FoundClient, 'id' | 'name' | 'phone' | 'society'>;

/**
 * The quotation builder's start (owner, 19 Nov 2026: "first quote and full
 * builder shouldn't be different tabs"): the floor plan, the project, the
 * options and what the plan showed, then Build — which builds on our
 * standard build (`planQuotation`, the same function the builder's rebuild
 * runs on the server), saves it as a DRAFT on the lead and opens the full
 * builder on it, with no second step. The lead's floor plan stays in view on
 * the right while the details are filled in.
 */
export function FirstQuote({
  products,
  terms,
  canRead,
  leadRequired,
}: {
  products: ProductRow[];
  terms: { discountBps: number };
  canRead: boolean;
  leadRequired: boolean;
}) {
  // 2 · Project
  const [lead, setLead] = useState<Lead | null>(null);
  const [name, setName] = useState('');
  /* Mr / Mrs / Miss on the quotation (owner, 14 Nov 2026). */
  const [title, setTitle] = useState('');
  const [found, setFound] = useState<FoundClient[]>([]);
  const [mobile, setMobile] = useState('');
  const [location, setLocation] = useState('Pune');
  const [quoteDate, setQuoteDate] = useState(isoDay(new Date()));
  const [config, setConfig] = useState<ConfigName>('3 BHK');
  const [run, setRun] = useState('');
  // 3 · Options, 4 · Detected
  const [king, setKing] = useState(false);
  const [baths, setBaths] = useState('2');
  const [balcony, setBalcony] = useState(false);
  const [study, setStudy] = useState(false);
  const [sizeToPlan, setSizeToPlan] = useState(false);
  const [ceiling, setCeiling] = useState(false);
  const [ceilingRate, setCeilingRate] = useState('');
  // 5 · Discount
  const [onSpotLabel, setOnSpotLabel] = useState('');
  const [onSpot, setOnSpot] = useState('');
  /* "No discount on modular" (owner, 19 Nov 2026): the quotation is saved with 0% on modular. */
  const [noModular, setNoModular] = useState(false);
  // 1 · Floor plan
  const [plans, setPlans] = useState<LeadPlan[]>([]);
  const [planNote, setPlanNote] = useState('');
  const [reading, setReading] = useState<{ fileId: string; reading: StoredFileReading } | null>(null);
  const [planBusy, startPlan] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'plan' | 'drawn'>('plan');
  const [status, setStatus] = useState('');
  /* Start from a previous quotation (owner, 17 Nov 2026): its lines are the quotation; its terms are copied on save. */
  const [from, setFrom] = useState<PickedQuote | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const catalogue: CatalogueProduct[] = useMemo(() => products.map((p) => ({ ...p })), [products]);
  /** The quotation as the left panel says it, on the product master's rates. */
  function planned() {
    const rate = Number(ceilingRate.replace(/[,₹\s]/g, ''));
    /* The plan's rooms size wardrobes and ceilings when either tick is on. */
    const planRooms = sizeToPlan || ceiling ? reading?.reading.rooms : undefined;
    return planQuotation(
      {
        config,
        kitchenRunMm: Number(run) > 0 ? Math.round(Number(run)) : null,
        bathrooms: Math.max(0, Math.round(Number(baths) || 0)),
        study,
        balcony,
        kingMaster: king,
        falseCeiling: ceiling,
        falseCeilingRatePaise: ceilingRate.trim() && Number.isFinite(rate) && rate > 0 ? Math.round(rate * 100) : null,
        planRooms,
      },
      catalogue,
    );
  }

  /* Build = build, save as a draft on the lead, and open the full builder (the save redirects there). */
  const [state, save, saving] = useActionState(async (_prev: State, _f: FormData): Promise<State> => {
    const built = from ? null : planned();
    const lines = from
      ? from.lines.map((l) => ({ room: l.room, product: l.product, code: l.code, unit: l.unit, details: l.details, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, ratePaise: l.ratePaise, agreedPaise: l.agreedPaise ?? null, note: l.note ?? null }))
      : built!.lines.map((l) => ({ room: l.room, product: l.product, code: l.code, unit: l.unit, details: l.details, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, ratePaise: l.ratePaise, agreedPaise: null, note: null }));
    if (lines.length === 0) return { ok: false, error: built?.notes[0] ?? 'Nothing to build: tick “standard” in the Product master on what each room should have.' };
    const r = await saveFirstQuoteAction({
      clientId: lead?.id ?? '',
      newLead: lead ? null : { name, phone: mobile, society: '' },
      config,
      kitchenRunMm: Number(run) > 0 ? Math.round(Number(run)) : null,
      bathrooms: Math.max(0, Math.round(Number(baths) || 0)),
      locality: location,
      quoteDate,
      fileId: reading?.fileId ?? null,
      lines,
      onSpotPaise: rupeesToPaiseText(onSpot) ?? 0,
      onSpotLabel: onSpotLabel || null,
      clientTitle: title || null,
      fromQuoteId: from?.id ?? null,
      noModularDiscount: noModular,
    });
    return r ?? { ok: true };
  }, { ok: true } as State);

  async function look(text: string) {
    setName(text);
    setLead(null);
    setPlans([]);
    setReading(null);
    if (text.trim().length < 2) return setFound([]);
    try {
      setFound((await searchAction(text)).slice(0, 6));
    } catch {
      setFound([]);
    }
  }
  function loadPlans(clientId: string) {
    leadPlansAction(clientId)
      .then((p) => {
        setPlans(p);
        setTab('plan');
      })
      .catch(() => setPlans([]));
  }
  function pickLead(f: FoundClient) {
    setLead(f);
    setName(f.name);
    setMobile(f.phone ?? '');
    setFound([]);
    loadPlans(f.id);
  }

  /** What the plan showed, into 2 and 4; Build does the rest. */
  function apply(r: StoredFileReading, fileId: string, summary: string) {
    setReading({ fileId, reading: r });
    if (r.bedrooms >= 1) setConfig(`${Math.min(4, r.bedrooms)} BHK` as ConfigName);
    if (r.kitchenRunMm) setRun(String(r.kitchenRunMm));
    if (r.bathrooms > 0) setBaths(String(r.bathrooms));
    if (r.dryBalcony !== null) setBalcony(r.dryBalcony);
    setStudy(r.hasStudy);
    setSizeToPlan(r.rooms.length > 0);
    setCeiling(r.rooms.length > 0);
    setStatus(`Read the plan: ${summary}. Check 4, then Build: it opens in the full builder.${r.confidence ? ` Confidence: ${r.confidence}.` : ''}`);
  }
  function readPlan(ref: { fileId?: string; path?: string }, clientId = lead?.id) {
    if (!clientId) return;
    setStatus('Reading the floor plan…');
    startPlan(async () => {
      try {
        const r = await readLeadPlanAction(clientId, ref);
        if (r.ok) apply(r.reading, r.fileId, r.summary);
        else setStatus(`${r.error} Set the BHK and the counts in 2 and 4, then Build — it builds from the BHK template.`);
      } catch {
        setStatus('That did not go through. Check your connection and try again.');
      }
    });
  }
  /* A plan for somebody new (owner, 14 Nov 2026: "not able to upload floor plan"): they are added to the leads first, so the plan has a lead to live on. */
  const newClientReady = !lead && name.trim().length >= 2 && mobile.replace(/\D/g, '').length >= 10;
  async function upload(file: File) {
    let target = lead;
    if (!target) {
      if (!newClientReady) return setStatus('Type the client’s name and mobile in 2 · Project (or pick their lead) first.');
      setStatus('Adding them to your leads…');
      const added = await addPlanLeadAction(name, mobile, config);
      if (!added.ok) {
        if (picker.current) picker.current.value = '';
        return setStatus(added.error);
      }
      target = added.lead;
      setLead(added.lead);
      setFound([]);
    }
    const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    const check = checkLeadFile(type, file.size);
    if (!check.ok) return setStatus(check.error);
    setStatus('Uploading the floor plan…');
    try {
      const res = await fetch('/api/studio/leads/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: target.id, contentType: type, bytes: file.size }) });
      const ticket = (await res.json().catch(() => null)) as { ok: boolean; path?: string; url?: string | null; error?: string } | null;
      if (!ticket?.ok || !ticket.path) return setStatus(ticket?.error ?? 'We could not start the upload. Try again.');
      if (ticket.url) {
        const put = await fetch(ticket.url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'false' }, body: file });
        if (!put.ok) return setStatus('The upload did not finish. Check your connection and try again.');
      }
      const path = ticket.path;
      const attached = await attachFileAction({ clientId: target.id, path, name: file.name, contentType: type, bytes: file.size, kind: 'FLOOR_PLAN', quoteRequest: false, note: planNote });
      if (!attached.ok) return setStatus('error' in attached ? String(attached.error) : 'That did not attach.');
      setPlanNote('');
      loadPlans(target.id);
      if (canRead) readPlan({ path }, target.id);
      else setStatus(`Floor plan kept on ${target.name}'s lead. Reading plans isn't switched on yet: set the BHK and the counts in 2 and 4, then Build — it builds from the BHK template.`);
    } catch {
      setStatus('The upload did not finish. Check your connection and try again.');
    } finally {
      if (picker.current) picker.current.value = '';
    }
  }

  const whoReady = lead !== null || name.trim().length >= 2;

  return (
    <div className="hb">
      <aside className="hside" aria-label="Build a quotation">
        <Sec first>1 · Floor plan</Sec>
        <label className="hlab">
          Note for the quotation (optional)
          <textarea
            className="fld hfld"
            rows={2}
            maxLength={300}
            value={planNote}
            onChange={(e) => setPlanNote(e.target.value)}
            placeholder="Any specific requirement: e.g. no loft in the kids' room, budget near 8 lakh"
            disabled={planBusy}
          />
        </label>
        <label className={`hdrop ${lead || newClientReady ? '' : 'off'}`}>
          {lead || newClientReady ? (planBusy ? 'Reading…' : 'Upload floor plan (image or PDF)') : 'Type the client’s name and mobile in 2 · Project, or pick their lead — the plan is kept on their lead'}
          <input ref={picker} type="file" accept={LEAD_FILE_ACCEPT} disabled={!(lead || newClientReady) || planBusy} className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </label>
        {plans.length > 0 && canRead ? (
          <>
            <span className="hhelp">…or read a plan already on {lead?.name}&rsquo;s lead</span>
            <select className="fld hfld" defaultValue="" disabled={planBusy} onChange={(e) => e.target.value && readPlan({ fileId: e.target.value })} aria-label="A floor plan on the lead">
              <option value="">— pick —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.read ? ' · read' : ''}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {!canRead ? <p className="hhelp">Reading plans isn&rsquo;t switched on yet: the quotation is built from the BHK template and the counts below.</p> : null}

        <Sec>2 · Project</Sec>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <select className="fld hfld" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: '0 0 auto', width: 'auto' }}>
              <option value="">—</option>
              {CLIENT_TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input className="fld hfld" placeholder="Client name" aria-label="Client name — a lead's name or phone, or someone new" value={name} autoComplete="off" onChange={(e) => void look(e.target.value)} style={{ flex: '1 1 auto', minWidth: 0 }} />
          </div>
          {lead ? (
            <p className="qok" style={{ margin: '4px 0 0' }}>
              For the lead {lead.name}.{' '}
              <button type="button" className="linkbtn" style={{ textDecoration: 'underline' }} onClick={() => { setLead(null); setPlans([]); setReading(null); }}>
                Not them
              </button>
            </p>
          ) : found.length > 0 ? (
            <ul className="pick qfound">
              {found.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => pickLead(f)}>
                    <span style={{ fontWeight: 600 }}>{f.name}</span>
                    <span className="muted sm">{[f.phone, f.society, f.stageName].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : name.trim().length >= 2 ? (
            <p className="hhelp" style={{ marginTop: 4 }}>{leadRequired ? 'Someone new: they are added to your leads when you build.' : 'Someone new: added to the leads when you build.'}</p>
          ) : null}
        </div>
        <div className="hgrid2">
          <input className="fld hfld" placeholder="Mobile" aria-label="Mobile" inputMode="tel" value={mobile} disabled={lead !== null} onChange={(e) => setMobile(e.target.value)} />
          <input className="fld hfld" placeholder="Location" aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <label className="hdate">
          <span>Quotation date</span>
          <input className="fld hfld" type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value || isoDay(new Date()))} />
          {quoteDate !== isoDay(new Date()) ? (
            <button type="button" className="linkbtn hlink" onClick={() => setQuoteDate(isoDay(new Date()))}>
              Today
            </button>
          ) : null}
        </label>
        <div className="hgrid2">
          <select className="fld hfld" aria-label="Configuration" value={config} onChange={(e) => setConfig(e.target.value as ConfigName)}>
            {CONFIGS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input className="fld hfld num" aria-label="Kitchen run, mm" inputMode="numeric" placeholder={String(standardRunFor(config))} value={run} onChange={(e) => setRun(e.target.value)} />
        </div>
        <p className="hhelp">Kitchen run (mm) drives base + wall + loft width.</p>

        <Sec>3 · Options</Sec>
        <label className="hcheck">
          <input type="checkbox" checked={king} onChange={(e) => setKing(e.target.checked)} /> Master: King bed
        </label>
        <p className="hhelp">
          What each room includes is set in the <b>Product master</b> (tick &ldquo;standard&rdquo; there). Add one-off extras in the builder after Build.
        </p>

        <Sec>4 · Detected from plan — confirm</Sec>
        <label className="hlab">
          Bathrooms (→ vanities)
          <input className="fld hfld num" inputMode="numeric" value={baths} onChange={(e) => setBaths(e.target.value)} />
        </label>
        <label className="hcheck">
          <input type="checkbox" checked={balcony} onChange={(e) => setBalcony(e.target.checked)} /> Dry balcony present
        </label>
        <label className="hcheck">
          <input type="checkbox" checked={study} onChange={(e) => setStudy(e.target.checked)} /> Study / office room
        </label>
        <label className="hcheck">
          <input type="checkbox" checked={sizeToPlan} disabled={!reading} onChange={(e) => setSizeToPlan(e.target.checked)} /> Size wardrobes to plan walls
        </label>
        <p className="hhelp">Off = standard sizes. On = 55% of each bedroom&rsquo;s shorter wall, from the plan.</p>
        <label className="hcheck">
          <input type="checkbox" checked={ceiling} onChange={(e) => setCeiling(e.target.checked)} /> False ceiling (room-wise)
        </label>
        {ceiling ? (
          <label className="hlab">
            If you have no false-ceiling product: ₹ per sq ft
            <input className="fld hfld num" inputMode="numeric" value={ceilingRate} onChange={(e) => setCeilingRate(e.target.value)} />
          </label>
        ) : null}
        <p className="hhelp">Adds each room&rsquo;s &ldquo;False Ceiling (Room)&rdquo; product from the Product master; area from the plan when it was read.</p>

        <Sec>5 · Discount (optional)</Sec>
        <label className="hcheck">
          <input type="checkbox" checked={noModular} onChange={(e) => setNoModular(e.target.checked)} data-testid="no-modular-discount" /> No discount on modular
        </label>
        {terms.discountBps > 0 ? <p className="hhelp">{noModular ? 'Modular is quoted at full price (0%).' : `Your usual ${terms.discountBps / 100}% on modular applies. Tick to remove it.`}</p> : null}
        <DiscountPicker label={onSpotLabel} amount={onSpot} onLabel={setOnSpotLabel} onAmount={(v) => { setOnSpot(v); if (!onSpotLabel) setOnSpotLabel(DISCOUNT_NAMES[0]); }} />

        <label className="hcheck">
          <input
            type="checkbox"
            checked={copyOpen}
            onChange={(e) => {
              setCopyOpen(e.target.checked);
              if (!e.target.checked) setFrom(null);
            }}
          />{' '}
          Or start from a previous quotation
        </label>
        {copyOpen ? (
          <PreviousQuotePicker
            compact
            picked={from}
            onPick={(q) => {
              setFrom(q);
              if (q.config && (CONFIGS as readonly string[]).includes(q.config)) setConfig(q.config as ConfigName);
              setRun(q.kitchenRunMm ? String(q.kitchenRunMm) : '');
              if (q.bathrooms != null) setBaths(String(q.bathrooms));
              setOnSpot(q.onSpotPaise > 0 ? String(q.onSpotPaise / 100) : '');
              setOnSpotLabel(q.onSpotPaise > 0 ? (q.onSpotLabel ?? DISCOUNT_NAMES[0]) : '');
              setStatus(`Build copies ${q.number}'s ${q.lines.length} lines and its terms, then opens the builder.`);
            }}
            onClear={() => {
              setFrom(null);
              setStatus('');
            }}
          />
        ) : null}
        <form action={save}>
          <button type="submit" className="btn pri hwide" disabled={saving || planBusy || !whoReady} data-testid="build-quote">
            {saving ? 'Building…' : from ? `Build from ${from.number} ▸` : 'Build quotation ▸'}
          </button>
        </form>
        <p className="hhelp">{whoReady ? 'Build saves it as a draft on the lead and opens it in the builder, ready to edit.' : 'Pick the lead (or type a new client) in 2 · Project first.'}</p>
        {status ? <p className="hstatus">{status}</p> : null}
        {'ok' in state && !state.ok ? <p role="alert" className="qerr">{state.error}</p> : null}
      </aside>

      <section className="hwork" aria-label="Their floor plan">
        <div className="htabs">
          <div className="tabs" role="tablist" aria-label="Floor plan view">
            <button type="button" role="tab" aria-selected={tab === 'plan'} onClick={() => setTab('plan')}>
              Floor plan
            </button>
            <button type="button" role="tab" aria-selected={tab === 'drawn'} onClick={() => setTab('drawn')}>
              2D plan
            </button>
          </div>
        </div>
        {tab === 'plan' ? (
          <PlanViewer plans={plans} leadName={lead?.name ?? 'the client'} empty={lead ? `No floor plan on ${lead.name}’s lead yet. Upload it on the left.` : 'Pick the lead in 2 · Project: their floor plan shows here while you fill in the details.'} />
        ) : reading && reading.reading.rooms.length > 0 ? (
          <FloorPlanView rooms={reading.reading.rooms} />
        ) : (
          <p className="muted hempty">No floor plan read yet — the 2D plan is drawn from the rooms the plan shows.</p>
        )}
      </section>
    </div>
  );
}

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
