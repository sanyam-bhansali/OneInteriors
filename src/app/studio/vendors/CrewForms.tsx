'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { aadhaarError, KYC_ACCEPT, KYC_DOC_LABEL, panError, panHolderType, type KycDoc } from '@/modules/studio-crews/kyc';
import { expectedItems } from '@/modules/studio-crews/pricing';
import { CREW_UNIT_LABEL, CREW_UNITS, type CrewUnitName, type Trade } from '@/modules/studio-crews/trades';
import { addCrewAction, archiveCrewAction, deleteRateAction, loadTemplateAction, saveRateAction, updateCrewAction, uploadKycAction } from './actions';
import { Message, useRun } from './crews-ui';
import { muted } from './format';

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
      <button type="button" className="s-btn" onClick={() => setOpen(true)}>
        Add crew
      </button>
    );
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-[6vh]" role="dialog" aria-modal="true" aria-label="Add a crew">
      <div className="s-card w-full max-w-[640px] p-5">
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
      className="flex flex-col gap-3"
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
      {!v.id ? <h2 className="m-0 text-[17px] font-semibold">Add a crew</h2> : null}
      <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <legend className="s-label mb-1.5">Kind</legend>
        {(['TEMPORARY', 'PERMANENT'] as const).map((k) => (
          <label key={k} className={`flex max-w-[280px] cursor-pointer flex-col rounded-[10px] border p-3 ${v.kind === k ? 'border-[var(--s-accent)] bg-[var(--s-accent-wash)]' : 'border-[var(--s-rule)]'}`}>
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <input type="radio" name="kind" checked={v.kind === k} onChange={() => set('kind', k)} />
              {k === 'TEMPORARY' ? 'Temporary' : 'Permanent'}
            </span>
            <span className={muted}>{k === 'TEMPORARY' ? 'A one-site hire. A name and a trade are enough.' : 'Someone you use again and again: phone, PAN and Aadhaar on file.'}</span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="s-label">Name</span>
          <input className="s-input" value={v.name} onChange={(e) => set('name', e.target.value)} required minLength={2} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="s-label">Phone{permanent ? '' : ' (optional)'}</span>
          <input className="s-input" inputMode="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} required={permanent} />
        </label>
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="s-label mb-1.5">Trades</legend>
        <div className="flex flex-wrap gap-1.5">
          {live.map((t) => (
            <label key={t.key} className={`cursor-pointer rounded-full border px-3 py-1 text-[13px] ${v.trades.includes(t.key) ? 'border-[var(--s-accent)] bg-[var(--s-accent-wash)] text-[var(--s-accent)]' : 'border-[var(--s-rule)] text-[var(--s-ink-2)]'}`}>
              <input type="checkbox" className="sr-only" checked={v.trades.includes(t.key)} onChange={(e) => set('trades', e.target.checked ? [...v.trades, t.key] : v.trades.filter((x) => x !== t.key))} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <details open={Boolean(v.id)}>
        <summary className="cursor-pointer text-[13.5px] font-medium text-[var(--s-ink-2)]">Other number, address, since when</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input className="s-input" aria-label="Other number" placeholder="Other number (supervisor, brother…)" value={v.altPhone} onChange={(e) => set('altPhone', e.target.value)} />
          <input className="s-input" aria-label="Working with you since" placeholder="Working since (e.g. 2021)" value={v.workingSince} onChange={(e) => set('workingSince', e.target.value)} />
          <input className="s-input" aria-label="Address" placeholder="Address" value={v.address} onChange={(e) => set('address', e.target.value)} />
        </div>
      </details>
      {permanent ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="s-label">PAN {v.panNumber ? `(on file: ${v.panNumber})` : ''}</span>
            <input className="s-input uppercase" value={pan} onChange={(e) => setPan(e.target.value)} placeholder={v.panNumber ? 'Type to replace' : 'ABCDE1234F'} required={!v.panNumber} />
            <span className={`text-[12px] ${panMsg ? 'text-[var(--s-bad)]' : 'text-[var(--s-ink-3)]'}`}>{panMsg ?? holder ?? ' '}</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="s-label">Aadhaar {v.aadhaarMasked ? `(on file: ${v.aadhaarMasked})` : ''}</span>
            <input className="s-input" inputMode="numeric" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder={v.aadhaarMasked ? 'Type to replace' : '12 digits'} required={!v.aadhaarMasked} autoComplete="off" />
            <span className={`text-[12px] ${aadhaarMsg ? 'text-[var(--s-bad)]' : 'text-[var(--s-ink-3)]'}`}>{aadhaarMsg ?? 'Only the last four digits are kept.'}</span>
          </label>
        </div>
      ) : null}
      <details open={Boolean(v.id && (v.upiId || v.bankAccountNumber))}>
        <summary className="cursor-pointer text-[13.5px] font-medium text-[var(--s-ink-2)]">How to pay them (UPI or bank)</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className="s-input" aria-label="UPI ID" placeholder="UPI ID (name@bank)" value={v.upiId} onChange={(e) => set('upiId', e.target.value)} />
          <input className="s-input" aria-label="Account holder" placeholder="Account holder's name" value={v.bankAccountName} onChange={(e) => set('bankAccountName', e.target.value)} />
          <input className="s-input" aria-label="Account number" inputMode="numeric" placeholder="Account number" value={v.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value)} />
          <input className="s-input uppercase" aria-label="IFSC" placeholder="IFSC" value={v.bankIfsc} onChange={(e) => set('bankIfsc', e.target.value)} />
        </div>
      </details>
      <label className="flex flex-col gap-1">
        <span className="s-label">Notes</span>
        <textarea className="s-input min-h-[60px]" value={v.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="s-btn" disabled={r.pending || Boolean(panMsg) || Boolean(aadhaarMsg)}>
          {v.id ? 'Save' : 'Add crew'}
        </button>
        {onClose ? (
          <button type="button" className="s-btn-ghost" onClick={onClose}>
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
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" className="s-btn-ghost" disabled={r.pending} onClick={() => r.run(() => archiveCrewAction(id, !archived))}>
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
      className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--s-rule)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        form.set('crewId', crewId);
        form.set('doc', doc);
        r.run(() => uploadKycAction(form), () => (e.target as HTMLFormElement).reset());
      }}
    >
      <span className="text-[13.5px] font-semibold">{KYC_DOC_LABEL[doc]}</span>
      <span className={muted}>
        {onFile ? (
          link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-[var(--s-accent)]">
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
      <input name="file" type="file" accept={KYC_ACCEPT} className="text-[12.5px]" required />
      <button type="submit" className="s-btn-ghost self-start" disabled={r.pending}>
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
    <div className="flex flex-col gap-3">
      <datalist id={`items-${crewId}`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {rates.length === 0 ? <p className={`m-0 ${muted}`}>No rates yet. Load a trade&apos;s template or add items one by one.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
          <tbody>
            {rates.map((x) => (
              <RateLine key={x.id} crewId={crewId} x={x} tradeLabel={labelOf(x.trade)} run={r.run} pending={r.pending} />
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="flex flex-wrap items-end gap-2 rounded-[10px] bg-[var(--s-surface-2)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          r.run(() => saveRateAction(crewId, { item, unit, rateRupees: rate, trade }), () => {
            setItem('');
            setRate('');
          });
        }}
      >
        <input className="s-input w-[220px]" list={`items-${crewId}`} aria-label="Item" placeholder="Item (e.g. Modular installation)" value={item} onChange={(e) => setItem(e.target.value)} required />
        <select className="s-input w-auto" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as CrewUnitName)}>
          {CREW_UNITS.map((u) => (
            <option key={u} value={u}>
              per {CREW_UNIT_LABEL[u]}
            </option>
          ))}
        </select>
        <input className="s-input w-[110px]" inputMode="decimal" aria-label="Rate in rupees" placeholder="₹ (blank = agree per job)" value={rate} onChange={(e) => setRate(e.target.value)} />
        <select className="s-input w-auto" aria-label="Trade" value={trade} onChange={(e) => setTrade(e.target.value)}>
          {crewTrades.map((k) => (
            <option key={k} value={k}>
              {labelOf(k)}
            </option>
          ))}
        </select>
        <button type="submit" className="s-btn" disabled={r.pending}>
          Add item
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        {crewTrades.map((k) => (
          <button key={k} type="button" className="s-btn-ghost" disabled={r.pending} onClick={() => r.run(() => loadTemplateAction(crewId, k))}>
            Load {labelOf(k)} template
          </button>
        ))}
      </div>
      <p className={`m-0 ${muted}`}>Changing a rate prices new work orders only. Ones already raised keep the rate they were raised at.</p>
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
      <td className="border-t border-[var(--s-rule)] px-2 py-1.5">
        {x.item}
        <span className={`block ${muted}`}>{tradeLabel}</span>
      </td>
      <td className="border-t border-[var(--s-rule)] px-2 py-1.5">
        <select
          className="s-input w-auto px-2 py-1"
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
      <td className="border-t border-[var(--s-rule)] px-2 py-1.5">
        <span className="inline-flex items-center gap-1">
          ₹
          <input
            className="s-input s-num w-[100px] px-2 py-1 text-right"
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
      <td className="border-t border-[var(--s-rule)] px-2 py-1.5 text-right">
        <button type="button" className="text-[12px] text-[var(--s-ink-3)] hover:text-[var(--s-bad)]" disabled={pending} onClick={() => run(() => deleteRateAction(crewId, x.id))}>
          Remove
        </button>
      </td>
    </tr>
  );
}
