'use client';

import { useActionState } from 'react';
import { clearSignImageAction, saveInvoiceSettingsAction, uploadSignImageAction, type InvoiceFormState } from './actions';

const IDLE: InvoiceFormState = { status: 'idle' };

export interface InvoiceSettingsView {
  defaultPrefix: string;
  defaultSac: string;
  signatoryName: string;
  signatoryDesignation: string;
  invoicePrefix: string;
  sacCode: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
}

function Message({ state }: { state: InvoiceFormState }) {
  if (state.status === 'idle' || !state.message) return null;
  return (
    <p role="status" className="m-0 text-[13.5px]" style={{ color: state.status === 'error' ? 'var(--warn)' : 'var(--good)' }}>
      {state.message}
    </p>
  );
}

function Field({ name, label, value, placeholder, hint }: { name: string; label: string; value: string; placeholder?: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="lbl">{label}</span>
      <input className="fld" name={name} defaultValue={value} placeholder={placeholder} />
      {hint ? <span className="text-[12.5px] muted">{hint}</span> : null}
    </label>
  );
}

/** Settings → Invoices (owner, 21 Nov 2026): the text fields. */
export function InvoiceSettingsForm({ settings: s }: { settings: InvoiceSettingsView }) {
  const [state, action, pending] = useActionState(saveInvoiceSettingsAction, IDLE);
  return (
    <form action={action} className="card flex flex-col gap-4" data-testid="invoice-settings">
      <h2 className="m-0 text-[16px] font-semibold">Who signs</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="signatoryName" label="Authorised signatory" value={s.signatoryName} placeholder="Full name" />
        <Field name="signatoryDesignation" label="Designation" value={s.signatoryDesignation} placeholder="Accounts Head" />
      </div>
      <h2 className="m-0 text-[16px] font-semibold">Invoice numbers</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="invoicePrefix"
          label="Invoice prefix"
          value={s.invoicePrefix}
          placeholder={s.defaultPrefix}
          hint={`Numbers read ${s.invoicePrefix || s.defaultPrefix}/26-27/0001, counting up each financial year. Empty: ${s.defaultPrefix}.`}
        />
        <Field name="sacCode" label="SAC code" value={s.sacCode} placeholder={s.defaultSac} hint={`Empty: ${s.defaultSac}.`} />
      </div>
      <h2 className="m-0 text-[16px] font-semibold">Bank details</h2>
      <p className="m-0 -mt-2 text-[13px] muted">Optional. Printed on invoices and the statement only when the account number is filled.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="bankAccountName" label="Account name" value={s.bankAccountName} />
        <Field name="bankAccountNumber" label="Account number" value={s.bankAccountNumber} />
        <Field name="bankIfsc" label="IFSC" value={s.bankIfsc} placeholder="HDFC0001234" />
        <Field name="bankName" label="Bank" value={s.bankName} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn pri sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

/** Upload, replace or remove the signature or the stamp. Submits on choosing the file, as the logo does. */
export function SignImage({ kind, url }: { kind: 'signature' | 'stamp'; url: string | null }) {
  const [state, upload, uploading] = useActionState(uploadSignImageAction, IDLE);
  const [cleared, clear, clearing] = useActionState(clearSignImageAction, IDLE);
  const id = `${kind}-input`;
  const title = kind === 'signature' ? 'Signature' : 'Stamp';
  return (
    <div className="flex flex-col gap-2" data-testid={`${kind}-upload`}>
      <span className="lbl">{title}</span>
      <div className="grid h-[110px] w-full max-w-[220px] place-items-center overflow-hidden rounded-[10px] border border-dashed border-[var(--s-line)] bg-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Your ${kind}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[12px] muted">No {kind} yet</span>
        )}
      </div>
      <form action={upload}>
        <input type="hidden" name="kind" value={kind} />
        <input
          type="file"
          name="image"
          id={id}
          accept="image/png,image/jpeg"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
        <label htmlFor={id} className="inline-flex cursor-pointer items-center rounded-full border border-[var(--s-line)] px-4 py-2 text-[13.5px] font-medium">
          {uploading ? 'Uploading…' : url ? 'Replace' : 'Choose a file'}
        </label>
      </form>
      {url ? (
        <form action={clear}>
          <input type="hidden" name="kind" value={kind} />
          <button type="submit" disabled={clearing} className="text-[13px] muted underline underline-offset-4 disabled:opacity-50">
            {clearing ? 'Removing…' : 'Remove it'}
          </button>
        </form>
      ) : null}
      <Message state={state.status !== 'idle' ? state : cleared} />
    </div>
  );
}
