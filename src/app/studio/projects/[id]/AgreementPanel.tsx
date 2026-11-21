'use client';

/**
 * The client agreement, at design closure (owner, 21 Nov 2026;
 * docs/studio-os/CLIENT-AGREEMENT.md). Confirm the client's details, preview
 * the PDF, and send it for the client's Aadhaar eSign (only the client signs;
 * the studio's side is printed as signed). Until an eSign provider is
 * connected, the studio can upload a copy the client signed elsewhere; either
 * way the signed copy files in the client's Locker.
 */

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import type { StudioAgreementView } from '@/modules/agreement/store';
import { sendAgreementAction, uploadSignedAgreementAction } from './agreement-actions';

const FIELDS: { key: keyof StudioAgreementView['prefill']; label: string; hint?: string }[] = [
  { key: 'clientName', label: 'Client’s full name', hint: 'As on their Aadhaar' },
  { key: 'relation', label: 'Relation (optional)', hint: 'e.g. daughter of Ramesh Shah' },
  { key: 'pan', label: 'PAN (optional)' },
  { key: 'address', label: 'Client’s residential address' },
  { key: 'siteAddress', label: 'Project site address' },
  { key: 'date', label: 'Date of the agreement' },
];

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function AgreementPanel({ projectId, view }: { projectId: string; view: StudioAgreementView }) {
  const [f, setF] = useState<Record<string, string>>({ ...view.prefill });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, go] = useTransition();
  const [previewing, setPreviewing] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const latest = view.latest;

  const preview = async () => {
    setPreviewing(true);
    setMsg(null);
    try {
      const res = await fetch('/api/studio/agreement/preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, ...f }),
      });
      if (res.ok && res.headers.get('content-type')?.includes('pdf')) {
        window.open(URL.createObjectURL(await res.blob()), '_blank', 'noopener');
      } else {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setMsg({ ok: false, message: b?.error ?? 'The preview could not be made.' });
      }
    } catch {
      setMsg({ ok: false, message: 'No connection. Try again.' });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <section className="card mt-4 flex flex-col gap-3 p-5" aria-label="Client agreement" data-testid="agreement-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[17px]">Client agreement</h2>
        {latest ? (
          <span className={`sm ${latest.status === 'SIGNED' ? 'good-t' : 'muted'}`}>
            {latest.status === 'SIGNED'
              ? `Signed ${latest.signedAt ? day(latest.signedAt) : ''}${latest.signerName ? ` by ${latest.signerName}` : ''}${latest.signedVia === 'upload' ? ' (uploaded copy)' : ''}`
              : `Sent ${day(latest.sentAt)}, waiting for the client’s eSign`}
          </span>
        ) : null}
      </div>

      {latest?.status === 'SIGNED' ? (
        <p className="m-0 text-[14px]">
          The signed agreement is in the client’s Locker.{' '}
          {latest.signedUrl ? (
            <a href={latest.signedUrl} target="_blank" rel="noopener" className="underline">
              Open the signed copy
            </a>
          ) : null}
        </p>
      ) : (
        <>
          <p className="m-0 muted text-[14px]">
            Signed by the client at design closure with Aadhaar eSign. Your side prints as signed. Check the client’s details, preview, then send.
          </p>
          {!view.ready.ok ? (
            <p className="m-0 bad-t sm">
              {view.ready.error}{' '}
              <Link href="/studio/settings/agreement" className="underline">
                Open the agreement
              </Link>
            </p>
          ) : null}
          {!view.designFinal ? <p className="m-0 muted sm">Make the Design Final first: its number goes in the agreement.</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELDS.map((x) => (
              <label key={x.key} className={`flex flex-col gap-1 ${x.key === 'address' || x.key === 'siteAddress' ? 'sm:col-span-2' : ''}`}>
                <span className="lbl">{x.label}</span>
                <input className="fld" value={f[x.key] ?? ''} placeholder={x.hint} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} disabled={pending} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn sec sm" disabled={previewing || !view.ready.ok || !view.designFinal} onClick={() => void preview()}>
              {previewing ? 'Making the PDF…' : 'Preview PDF'}
            </button>
            <button
              type="button"
              className="btn pri sm"
              disabled={pending || !view.provider || !view.ready.ok || !view.designFinal}
              title={view.provider ? undefined : 'Aadhaar eSign is not connected yet'}
              onClick={() =>
                go(async () => {
                  setMsg(await sendAgreementAction(projectId, f));
                })
              }
            >
              {latest ? 'Send again for eSign' : 'Send for eSign'}
            </button>
          </div>
          {!view.provider ? (
            <p className="m-0 muted sm">Aadhaar eSign is not connected yet. Until it is, the client can sign the preview another way and you upload the signed copy below.</p>
          ) : (
            <p className="m-0 muted sm">eSign by {view.provider}. The client signs in their app with an Aadhaar OTP.</p>
          )}
          <form
            className="flex flex-wrap items-center gap-2 border-t border-[var(--fill2)] pt-3"
            action={(form) =>
              go(async () => {
                form.set('projectId', projectId);
                setMsg(await uploadSignedAgreementAction(form));
                if (file.current) file.current.value = '';
              })
            }
          >
            <span className="lbl">Signed elsewhere?</span>
            <input ref={file} type="file" name="file" accept="application/pdf" className="sm" disabled={pending} required />
            <button type="submit" className="btn sec sm" disabled={pending}>
              Upload signed copy
            </button>
          </form>
        </>
      )}
      {latest?.pdfUrl && latest.status !== 'SIGNED' ? (
        <a href={latest.pdfUrl} target="_blank" rel="noopener" className="sm underline">
          The copy sent to the client
        </a>
      ) : null}
      {msg ? (
        <p role="status" className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`}>
          {msg.message}
        </p>
      ) : null}
    </section>
  );
}
