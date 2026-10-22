'use client';

import { useActionState, useMemo, useRef, useState, useTransition } from 'react';
import { computeTotals, DISCOUNT_NAMES, FEE_BPS, lineAmount } from '@/modules/studio-quote/pricing';
import { CONFIGS, planQuotation, standardRunFor, type CatalogueProduct, type ConfigName } from '@/modules/studio-quote/configure';
import { orderedRooms } from '@/modules/studio-quote/rooms';
import type { StoredFileReading } from '@/modules/studio-quote/from-plan-rules';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { ProductRow } from '@/modules/studio-quote/store';
import type { PaymentPhase } from '@/modules/studio/payment-phases';
import type { FoundClient } from '@/modules/studio-practice/clients';
import { checkLeadFile, LEAD_FILE_ACCEPT } from '@/modules/studio-sales/lead-rules';
import { formatINR } from '@/lib/money';
import { FloorPlanView } from '@/components/floorplan/FloorPlanView';
import { leadPlansAction, readLeadPlanAction, saveFirstQuoteAction } from '../actions';
import { attachFileAction } from '../../sales-actions';
import { searchAction } from '../../search-actions';
import type { State } from '../../form-state';
import { QuoteTable } from '../[id]/QuoteTable';
import { TotalsTable } from '../[id]/HTotals';
import { DocumentPreview } from '../[id]/QuotePanels';
import { DiscountPicker, Sec } from '../[id]/HPanels';
import { rupeesToPaiseText } from '../[id]/TermsPanel';
import type { EditableLine } from '../[id]/QuoteLines';

type Lead = Pick<FoundClient, 'id' | 'name' | 'phone' | 'society'>;
type Plan = { id: string; name: string; read: boolean };

/**
 * Hauspire's First Quote page, on our standard build: the plan read (when
 * reading is switched on) fills "4 · Detected from plan"; Build lays the
 * quotation out on the right from the product master (`planQuotation`, the
 * same function the builder's rebuild runs on the server); "Revise in Full
 * Builder" saves it as a DRAFT on the lead and opens the builder.
 */
export function FirstQuote({
  products,
  studioName,
  terms,
  canRead,
  leadRequired,
}: {
  products: ProductRow[];
  studioName: string;
  terms: { discountBps: number; gstBps: number; bookingAdvancePaise: number; phases: PaymentPhase[] | null };
  canRead: boolean;
  leadRequired: boolean;
}) {
  // 2 · Project
  const [lead, setLead] = useState<Lead | null>(null);
  const [name, setName] = useState('');
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
  // 1 · Floor plan
  const [plans, setPlans] = useState<Plan[]>([]);
  const [reading, setReading] = useState<{ fileId: string; reading: StoredFileReading } | null>(null);
  const [planBusy, startPlan] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  // The quotation
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [tab, setTab] = useState<'quote' | 'plan' | 'pdf'>('quote');
  const [status, setStatus] = useState('');
  const [state, save, saving] = useActionState(async (_prev: State, _f: FormData): Promise<State> => {
    const r = await saveFirstQuoteAction({
      clientId: lead?.id ?? '',
      newLead: lead ? null : { name, phone: mobile, society: '' },
      config,
      kitchenRunMm: Number(run) > 0 ? Math.round(Number(run)) : null,
      bathrooms: Math.max(0, Math.round(Number(baths) || 0)),
      locality: location,
      quoteDate,
      fileId: reading?.fileId ?? null,
      lines: lines.map((l) => ({ room: l.room, product: l.product, code: l.code, unit: l.unit, details: l.details, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, ratePaise: l.ratePaise, agreedPaise: l.agreedPaise, note: l.note ?? null })),
      onSpotPaise: rupeesToPaiseText(onSpot) ?? 0,
      onSpotLabel: onSpotLabel || null,
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
  function pickLead(f: FoundClient) {
    setLead(f);
    setName(f.name);
    setMobile(f.phone ?? '');
    setFound([]);
    leadPlansAction(f.id)
      .then(setPlans)
      .catch(() => setPlans([]));
  }

  /** What the plan showed, into §2 and §4, then a build. */
  function apply(r: StoredFileReading, fileId: string, summary: string) {
    setReading({ fileId, reading: r });
    const bhk = r.bedrooms >= 1 ? (`${Math.min(4, r.bedrooms)} BHK` as ConfigName) : config;
    setConfig(bhk);
    if (r.kitchenRunMm) setRun(String(r.kitchenRunMm));
    if (r.bathrooms > 0) setBaths(String(r.bathrooms));
    if (r.dryBalcony !== null) setBalcony(r.dryBalcony);
    setStudy(r.hasStudy);
    setSizeToPlan(r.rooms.length > 0);
    setCeiling(r.rooms.length > 0);
    setStatus(`Read the plan: ${summary}. Check 4 and Build.${r.confidence ? ` Confidence: ${r.confidence}.` : ''}`);
    build({ config: bhk, run: r.kitchenRunMm, baths: r.bathrooms, balcony: r.dryBalcony ?? balcony, study: r.hasStudy, rooms: r.rooms, ceiling: r.rooms.length > 0 });
  }
  function readPlan(ref: { fileId?: string; path?: string }) {
    if (!lead) return;
    setStatus('Reading the floor plan…');
    startPlan(async () => {
      try {
        const r = await readLeadPlanAction(lead.id, ref);
        if (r.ok) apply(r.reading, r.fileId, r.summary);
        else setStatus(`${r.error} Set the BHK and the counts in 2 and 4, then Build — it builds from the BHK template.`);
      } catch {
        setStatus('That did not go through. Check your connection and try again.');
      }
    });
  }
  async function upload(file: File) {
    if (!lead) return;
    const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    const check = checkLeadFile(type, file.size);
    if (!check.ok) return setStatus(check.error);
    setStatus('Uploading the floor plan…');
    try {
      const res = await fetch('/api/studio/leads/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: lead.id, contentType: type, bytes: file.size }) });
      const ticket = (await res.json().catch(() => null)) as { ok: boolean; path?: string; url?: string | null; error?: string } | null;
      if (!ticket?.ok || !ticket.path) return setStatus(ticket?.error ?? 'We could not start the upload. Try again.');
      if (ticket.url) {
        const put = await fetch(ticket.url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'false' }, body: file });
        if (!put.ok) return setStatus('The upload did not finish. Check your connection and try again.');
      }
      const path = ticket.path;
      const attached = await attachFileAction({ clientId: lead.id, path, name: file.name, contentType: type, bytes: file.size, kind: 'FLOOR_PLAN', quoteRequest: false });
      if (!attached.ok) return setStatus('error' in attached ? String(attached.error) : 'That did not attach.');
      leadPlansAction(lead.id).then(setPlans).catch(() => undefined);
      if (canRead) readPlan({ path });
      else setStatus(`Floor plan kept on ${lead.name}'s lead. Reading plans isn't switched on yet: set the BHK and the counts in 2 and 4, then Build — it builds from the BHK template.`);
    } catch {
      setStatus('The upload did not finish. Check your connection and try again.');
    } finally {
      if (picker.current) picker.current.value = '';
    }
  }

  const catalogue: CatalogueProduct[] = useMemo(() => products.map((p) => ({ ...p })), [products]);
  function build(o: { config?: ConfigName; run?: number | null; baths?: number; balcony?: boolean; study?: boolean; rooms?: StoredFileReading['rooms']; ceiling?: boolean } = {}) {
    const rate = Number(ceilingRate.replace(/[,₹\s]/g, ''));
    /* The plan's rooms size wardrobes and ceilings when either tick is on. */
    const planRooms = o.rooms ?? (sizeToPlan || ceiling ? reading?.reading.rooms : undefined);
    const { lines: planned, notes } = planQuotation(
      {
        config: o.config ?? config,
        kitchenRunMm: o.run !== undefined ? o.run : Number(run) > 0 ? Math.round(Number(run)) : null,
        bathrooms: o.baths ?? Math.max(0, Math.round(Number(baths) || 0)),
        study: o.study ?? study,
        balcony: o.balcony ?? balcony,
        kingMaster: king,
        falseCeiling: o.ceiling ?? ceiling,
        falseCeilingRatePaise: ceilingRate.trim() && Number.isFinite(rate) && rate > 0 ? Math.round(rate * 100) : null,
        planRooms,
      },
      catalogue,
    );
    let n = 0;
    setLines(planned.map((l) => ({ ...l, key: `fq-${(n += 1)}`, agreedPaise: null })));
    setTab('quote');
    if (planned.length > 0 && notes.length > 0) setStatus(notes[0]!);
    else if (planned.length === 0) setStatus(notes[0] ?? 'Nothing to build.');
  }

  const priced = lines.map((l) => ({ ...l, amountPaise: lineAmount({ ...l, amountPaise: l.agreedPaise ?? undefined }) }));
  const onSpotPaise = rupeesToPaiseText(onSpot) ?? 0;
  const totals = computeTotals(priced, { feeBps: FEE_BPS, discountBps: terms.discountBps, onSpotPaise, bookingAdvancePaise: terms.bookingAdvancePaise, gstBps: terms.gstBps, phases: terms.phases });
  const rooms = orderedRooms([], lines);
  const update = (key: string, patch: Partial<EditableLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const nothing = () => undefined;
  const preview = previewQuote({ name, mobile, location, config, quoteDate, terms, onSpotPaise, onSpotLabel });

  return (
    <div className="hb">
      <aside className="hside" aria-label="First quote">
        <Sec first>1 · Floor plan</Sec>
        <label className={`hdrop ${lead ? '' : 'off'}`}>
          {lead ? (planBusy ? 'Reading…' : 'Upload floor plan (image or PDF)') : 'Pick the client in 2 · Project first — the plan is kept on their lead'}
          <input ref={picker} type="file" accept={LEAD_FILE_ACCEPT} disabled={!lead || planBusy} className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </label>
        {plans.length > 0 ? (
          <>
            <span className="hhelp">…or use a plan already on {lead?.name}&rsquo;s lead</span>
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
          <input className="fld hfld" placeholder="Client name" aria-label="Client name — a lead's name or phone, or someone new" value={name} autoComplete="off" onChange={(e) => void look(e.target.value)} />
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
            <p className="hhelp" style={{ marginTop: 4 }}>{leadRequired ? 'Someone new: they are added to your leads when you save.' : 'Someone new: added to the leads when you save.'}</p>
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
          What each room includes is set in the <b>Product master</b> (tick &ldquo;standard&rdquo; there). Add one-off extras in the Full Builder.
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
        <p className="hhelp">Off = standard sizes. On = 55% of each bedroom&rsquo;s shorter wall, from the plan; rebuild to apply.</p>
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
        <DiscountPicker label={onSpotLabel} amount={onSpot} onLabel={setOnSpotLabel} onAmount={(v) => { setOnSpot(v); if (!onSpotLabel) setOnSpotLabel(DISCOUNT_NAMES[0]); }} />

        <button type="button" className="btn pri hwide" onClick={() => build()}>
          Build first quotation ▸
        </button>
        <form action={save}>
          <button type="submit" className="btn sec hwide" disabled={saving || lines.length === 0 || (!lead && name.trim().length < 2)}>
            {saving ? 'Saving…' : 'Revise in Full Builder →'}
          </button>
        </form>
        <p className="hhelp">Revise saves it as a draft quotation on the lead and opens it in the Full Builder.</p>
        {status ? <p className="hstatus">{status}</p> : null}
        {'ok' in state && !state.ok ? <p role="alert" className="qerr">{state.error}</p> : null}
      </aside>

      <section className="hwork" aria-label="First quotation">
        <div className="htabs">
          <div className="tabs" role="tablist" aria-label="First quote view">
            {(['quote', 'plan', 'pdf'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t === 'quote' ? 'Quotation' : t === 'plan' ? '2D plan' : 'PDF preview'}
              </button>
            ))}
          </div>
        </div>
        {lines.length === 0 ? (
          <p className="muted hempty">Upload a plan (or set the flat), set the project, then Build.</p>
        ) : tab === 'quote' ? (
          <>
            <div className="hdochead">
              <div>
                <div className="hbig">{studioName}</div>
                <div className="muted hsmall">First-draft quotation · {formatINR(totals.totalPaise)}</div>
              </div>
              <div className="hwho">
                <b>{name.trim() || '—'}</b>
                <br />
                {location} · {config}
              </div>
            </div>
            <QuoteTable
              lines={priced}
              rooms={rooms}
              products={products}
              discountBps={terms.discountBps}
              onUpdate={update}
              onRemove={(key) => setLines((ls) => ls.filter((l) => l.key !== key))}
              onDuplicate={nothing}
              onMove={nothing}
              onReorder={nothing}
              onSwap={(key, p) => update(key, { product: p.name, code: p.code, unit: p.unit, details: p.details, ratePaise: p.ratePaise, agreedPaise: null })}
              onAddItem={nothing}
            />
            <TotalsTable
              totals={totals}
              feeBps={FEE_BPS}
              feeOn
              gstOn={terms.gstBps > 0}
              discountPct={String(terms.discountBps / 100)}
              onSpotLabel={onSpotLabel || null}
              ownSchedule={(terms.phases?.length ?? 0) > 0}
            />
          </>
        ) : tab === 'plan' ? (
          reading && reading.reading.rooms.length > 0 ? (
            <FloorPlanView rooms={reading.reading.rooms} />
          ) : (
            <p className="muted hempty">No floor plan read yet — the 2D plan is drawn from the rooms the plan shows.</p>
          )
        ) : (
          <DocumentPreview quote={preview} lines={priced} rooms={rooms} totals={totals} branding={{ legalName: studioName, addressLine: null, city: '', pincode: null, gstin: null, phone: null, email: null, accentHex: '' }} showMark={false} markText="" logoUrl={null} />
        )}
      </section>
    </div>
  );
}

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A quotation-shaped object for the preview; nothing is saved yet. */
function previewQuote(o: {
  name: string;
  mobile: string;
  location: string;
  config: string;
  quoteDate: string;
  terms: { discountBps: number; gstBps: number; bookingAdvancePaise: number; phases: PaymentPhase[] | null };
  onSpotPaise: number;
  onSpotLabel: string;
}): QuoteRow {
  return {
    id: 'first-quote',
    number: 'Draft',
    stage: 'SALES',
    status: 'DRAFT',
    clientName: o.name.trim() || '—',
    clientId: null,
    clientPhone: o.mobile || null,
    clientEmail: null,
    society: null,
    locality: o.location || null,
    config: o.config,
    carpetSqft: null,
    kitchenRunMm: null,
    bathrooms: null,
    issuedLines: [],
    fromMarketplace: false,
    feeBps: FEE_BPS,
    discountBps: o.terms.discountBps,
    onSpotPaise: o.onSpotPaise,
    bookingAdvancePaise: o.terms.bookingAdvancePaise,
    gstBps: o.terms.gstBps,
    onSpotLabel: o.onSpotLabel || null,
    quoteDate: new Date(`${o.quoteDate}T00:00:00`),
    phases: o.terms.phases,
    basedOnId: null,
    planRooms: [],
    welcomeNote: null,
    terms: null,
    issuedOn: null,
    updatedAt: new Date(),
    lines: [],
  };
}
