'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { aadhaarError, KYC_ACCEPT, KYC_DOC_LABEL, panError, panHolderType, type KycDoc } from '@/modules/studio-crews/kyc';
import { expectedItems } from '@/modules/studio-crews/pricing';
import { CREW_UNIT_LABEL, CREW_UNITS, type CrewUnitName, type Trade } from '@/modules/studio-crews/trades';
import { addCrewAction, archiveCrewAction, deleteRateAction, loadTemplateAction, saveRateAction, updateCrewAction, uploadKycAction } from './actions';
import { Message, useRun } from './crews-ui';
import { muted } from './format';
import { LineIcon } from '../ui/icons';

/**
 * Adding and editing a crew, their scans and their rate card (Studio OS
 * Phase 3). A new crew starts TEMPORARY: most crews arrive mid-job with a
 * phone number, and demanding an Aadhaar then gets you a fake one. The PAN
 * and Aadhaar are checked as they are typed; only the Aadhaar's last four
 * digits are ever kept (the server drops the rest).
 */

export interface CrewFormValue {
  id?: string;
  name: string;
  kind: 'TEMPORARY' | 'PERMANENT';
  trades: string[];
  phone: string;
  altPhone: string;
  address: string;
  workingSince: string;
  notes: string;
  panNumber: string | null;
  aadhaarMasked: string | null;
  upiId: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
}

const EMPTY: CrewFormValue = {
  name: '',
  kind: 'TEMPORARY',
  trades: [],
  phone: '',
  altPhone: '',
  address: '',
  workingSince: '',
  notes: '',
  panNumber: null,
  aadhaarMasked: null,
  upiId: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
};

export function AddCrew({ trades }: { trades: Trade[] }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn pri" onClick={() => setOpen(true)}>
        <LineIcon name="plus" size={17} />
        Add a crew
      </button>
    );
  return (
    <div className="vd-dialog" role="dialog" aria-modal="true" aria-label="Add a crew">
      <div className="card">
        <CrewForm trades={trades} initial={EMPTY} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}

export function CrewForm({ trades, initial, onClose }: { trades: Trade[]; initial: CrewFormValue; onClose?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const r = useRun();
  const set = <K extends keyof CrewFormValue>(k: K, val: CrewFormValue[K]) => setV({ ...v, [k]: val });
  const panMsg = pan ? panError(pan) : null;
  const aadhaarMsg = aadhaar ? aadhaarError(aadhaar) : null;
  const holder = pan && !panMsg ? panHolderType(pan) : null;
  const permanent = v.kind === 'PERMANENT';
  const live = trades.filter((t) => t.active || v.trades.includes(t.key));
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        const input = { ...v, pan, aadhaar };
        r.run(
          () => (v.id ? updateCrewAction(v.id, input) : addCrewAction(input)),
          () => {
            setPan('');
            setAadhaar('');
            if (!v.id) {
              onClose?.();
              router.refresh();
            }
          },
        );
      }}
    >
      {!v.id ? (
        <div className="chead">
          <h2>Add a crew</h2>
          {onClose ? (
            <button type="button" className="btn ghost sm" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      ) : null}
      <fieldset className="vd-kinds">
        <legend className="lbl">Kind</legend>
        {(['TEMPORARY', 'PERMANENT'] as const).map((k) => (
          <label key={k} className={`vd-kind${v.kind === k ? ' on' : ''}`}>
            <b>
              <input type="radio" name="kind" checked={v.kind === k} onChange={() => set('kind', k)} />
              {k === 'TEMPORARY' ? 'Temporary' : 'Permanent'}
            </b>
            <span className={muted}>{k === 'TEMPORARY' ? 'A one-site hire. A name and a trade are enough.' : 'Someone you use again and again: phone, PAN and Aadhaar on file.'}</span>
          </label>
        ))}
      </fieldset>
      <div className="vd-grid2">
        <label className="ox-f">
          <span className="lbl">Name</span>
          <input className="fld" value={v.name} onChange={(e) => set('name', e.target.value)} required minLength={2} />
        </label>
        <label className="ox-f">
          <span className="lbl">Phone{permanent ? '' : ' (optional)'}</span>
          <input className="fld mono" inputMode="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} required={permanent} />
        </label>
      </div>
      <fieldset className="vd-trades">
        <legend className="lbl">Trades</legend>
        <div className="vd-chips">
          {live.map((t) => (
            <label key={t.key} className={v.trades.includes(t.key) ? 'on' : undefined}>
              <input type="checkbox" className="sr-only" checked={v.trades.includes(t.key)} onChange={(e) => set('trades', e.target.checked ? [...v.trades, t.key] : v.trades.filter((x) => x !== t.key))} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <details open={Boolean(v.id)} className="vd-more">
        <summary>Other number, address, since when</summary>
        <div className="vd-grid3" style={{ marginTop: 8 }}>
          <input className="fld" aria-label="Other number" placeholder="Other number (supervisor, brother…)" value={v.altPhone} onChange={(e) => set('altPhone', e.target.value)} />
          <input className="fld" aria-label="Working with you since" placeholder="Working since (e.g. 2021)" value={v.workingSince} onChange={(e) => set('workingSince', e.target.value)} />
          <input className="fld" aria-label="Address" placeholder="Address" value={v.address} onChange={(e) => set('address', e.target.value)} />
        </div>
      </details>
      {permanent ? (
        <div className="vd-grid2">
          <label className="ox-f">
            <span className="lbl">PAN {v.panNumber ? `(on file: ${v.panNumber})` : ''}</span>
            <input className="fld mono" style={{ textTransform: 'uppercase' }} value={pan} onChange={(e) => setPan(e.target.value)} placeholder={v.panNumber ? 'Type to replace' : 'ABCDE1234F'} required={!v.panNumber} />
            <span className={panMsg ? 'ox-err' : muted}>{panMsg ?? holder ?? ' '}</span>
          </label>
          <label className="ox-f">
            <span className="lbl">Aadhaar {v.aadhaarMasked ? `(on file: ${v.aadhaarMasked})` : ''}</span>
            <input className="fld mono" inputMode="numeric" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder={v.aadhaarMasked ? 'Type to replace' : '12 digits'} required={!v.aadhaarMasked} autoComplete="off" />
            <span className={aadhaarMsg ? 'ox-err' : muted}>{aadhaarMsg ?? 'Only the last four digits are kept.'}</span>
          </label>
        </div>
      ) : null}
      <details open={Boolean(v.id && (v.upiId || v.bankAccountNumber))} className="vd-more">
        <summary>How to pay them (UPI or bank)</summary>
        <div className="vd-grid2" style={{ marginTop: 8 }}>
          <input className="fld" aria-label="UPI ID" placeholder="UPI ID (name@bank)" value={v.upiId} onChange={(e) => set('upiId', e.target.value)} />
          <input className="fld" aria-label="Account holder" placeholder="Account holder's name" value={v.bankAccountName} onChange={(e) => set('bankAccountName', e.target.value)} />
          <input className="fld mono" aria-label="Account number" inputMode="numeric" placeholder="Account number" value={v.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value)} />
          <input className="fld mono" style={{ textTransform: 'uppercase' }} aria-label="IFSC" placeholder="IFSC" value={v.bankIfsc} onChange={(e) => set('bankIfsc', e.target.value)} />
        </div>
      </details>
      <label className="ox-f">
        <span className="lbl">Notes</span>
        <textarea className="fld" style={{ minHeight: 64 }} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className="btn pri" disabled={r.pending || Boolean(panMsg) || Boolean(aadhaarMsg)}>
          {v.id ? 'Save' : 'Add crew'}
        </button>
        {onClose ? (
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        ) : null}
      </div>
      <Message m={r.message} />
    </form>
  );
}

export function ArchiveCrew({ id, archived }: { id: string; archived: boolean }) {
  const r = useRun();
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className="btn sec" disabled={r.pending} onClick={() => r.run(() => archiveCrewAction(id, !archived))}>
        {archived ? 'Bring back' : 'Archive'}
      </button>
      <Message m={r.message} />
    </span>
  );
}

export function KycScan({ crewId, doc, onFile, link }: { crewId: string; doc: KycDoc; onFile: boolean; link: string | null }) {
  const r = useRun();
  return (
    <form
      className="vd-scan"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        form.set('crewId', crewId);
        form.set('doc', doc);
        r.run(() => uploadKycAction(form), () => (e.target as HTMLFormElement).reset());
      }}
    >
      <span className="hstack" style={{ justifyContent: 'space-between', gap: 8 }}>
        <b style={{ fontSize: 14, fontWeight: 600 }}>{KYC_DOC_LABEL[doc]}</b>
        {onFile ? (
          <span className="chip good">
            <span className="dot" />
            On file
          </span>
        ) : (
          <span className="chip">{doc === 'agreement' ? 'Optional' : 'Missing'}</span>
        )}
      </span>
      <span className={muted}>
        {onFile ? (
          link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="ox-link">
              Open the scan
            </a>
          ) : (
            'On file'
          )
        ) : doc === 'agreement' ? (
          'Not needed, but useful'
        ) : (
          'No scan yet'
        )}
      </span>
      <input name="file" type="file" accept={KYC_ACCEPT} required />
      <button type="submit" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} disabled={r.pending}>
        {onFile ? 'Replace' : 'Attach'}
      </button>
      <Message m={r.message} />
    </form>
  );
}

export interface RateRow {
  id: string;
  item: string;
  unit: CrewUnitName;
  ratePaise: number | null;
  trade: string | null;
}

export function RateCard({ crewId, rates, trades, crewTrades }: { crewId: string; rates: RateRow[]; trades: Trade[]; crewTrades: string[] }) {
  const r = useRun();
  const [item, setItem] = useState('');
  const [unit, setUnit] = useState<CrewUnitName>('SQFT');
  const [rate, setRate] = useState('');
  const [trade, setTrade] = useState(crewTrades[0] ?? '');
  const suggestions = [...new Set(crewTrades.flatMap((t) => expectedItems(t)))];
  const labelOf = (k: string | null) => trades.find((t) => t.key === k)?.label ?? 'Any trade';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <datalist id={`items-${crewId}`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {rates.length === 0 ? (
        <p className={muted} style={{ margin: 0 }}>
          No rates yet. Load a trade&apos;s template or add items one by one.
        </p>
      ) : null}
      <div className="tscroll">
        <table className="tbl" style={{ minWidth: 520 }}>
          <tbody>
            {rates.map((x) => (
              <RateLine key={x.id} crewId={crewId} x={x} tradeLabel={labelOf(x.trade)} run={r.run} pending={r.pending} />
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="vd-addrate"
        onSubmit={(e) => {
          e.preventDefault();
          r.run(() => saveRateAction(crewId, { item, unit, rateRupees: rate, trade }), () => {
            setItem('');
            setRate('');
          });
        }}
      >
        <input className="fld fit" size={26} list={`items-${crewId}`} aria-label="Item" placeholder="Item (e.g. Modular installation)" value={item} onChange={(e) => setItem(e.target.value)} required />
        <select className="fld fit" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as CrewUnitName)}>
          {CREW_UNITS.map((u) => (
            <option key={u} value={u}>
              per {CREW_UNIT_LABEL[u]}
            </option>
          ))}
        </select>
        <input className="fld fit num" size={18} inputMode="decimal" aria-label="Rate in rupees" placeholder="₹ (blank = agree per job)" value={rate} onChange={(e) => setRate(e.target.value)} />
        <select className="fld fit" aria-label="Trade" value={trade} onChange={(e) => setTrade(e.target.value)}>
          {crewTrades.map((k) => (
            <option key={k} value={k}>
              {labelOf(k)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn pri sm" disabled={r.pending}>
          Add item
        </button>
      </form>
      <div className="hstack" style={{ gap: 8 }}>
        {crewTrades.map((k) => (
          <button key={k} type="button" className="btn ghost sm" disabled={r.pending} onClick={() => r.run(() => loadTemplateAction(crewId, k))}>
            Load {labelOf(k)} template
          </button>
        ))}
      </div>
      <p className={muted} style={{ margin: 0 }}>
        Changing a rate prices new work orders only. Ones already raised keep the rate they were raised at.
      </p>
      <Message m={r.message} />
    </div>
  );
}

function RateLine({ crewId, x, tradeLabel, run, pending }: { crewId: string; x: RateRow; tradeLabel: string; run: ReturnType<typeof useRun>['run']; pending: boolean }) {
  const [rate, setRate] = useState(x.ratePaise === null ? '' : String(x.ratePaise / 100));
  const [unit, setUnit] = useState<CrewUnitName>(x.unit);
  const initial = x.ratePaise === null ? '' : String(x.ratePaise / 100);
  const save = (u: CrewUnitName, r: string) => run(() => saveRateAction(crewId, { id: x.id, item: x.item, unit: u, rateRupees: r, trade: x.trade ?? undefined }));
  return (
    <tr>
      <td>
        <b style={{ fontWeight: 600 }}>{x.item}</b>
        <span className={muted} style={{ display: 'block' }}>
          {tradeLabel}
        </span>
      </td>
      <td>
        <select
          className="fld sm fit"
          aria-label={`Unit for ${x.item}`}
          value={unit}
          disabled={pending}
          onChange={(e) => {
            setUnit(e.target.value as CrewUnitName);
            save(e.target.value as CrewUnitName, rate);
          }}
        >
          {CREW_UNITS.map((u) => (
            <option key={u} value={u}>
              per {CREW_UNIT_LABEL[u]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <span className="vd-money-in">
          <span className="muted">₹</span>
          <input
            className="fld sm fit num"
            size={12}
            inputMode="decimal"
            aria-label={`Rate for ${x.item}`}
            placeholder="agree per job"
            value={rate}
            disabled={pending}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => rate !== initial && save(unit, rate)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <button type="button" className="ox-plain" disabled={pending} onClick={() => run(() => deleteRateAction(crewId, x.id))}>
          Remove
        </button>
      </td>
    </tr>
  );
}
