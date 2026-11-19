'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LeadPlan } from '@/modules/studio-quote/from-plan';
import { checkLeadFile, LEAD_FILE_ACCEPT } from '@/modules/studio-sales/lead-rules';
import { leadPlansAction } from '../actions';
import { attachFileAction } from '../../sales-actions';
import { PlanViewer } from '../PlanViewer';

/**
 * The builder's Floor plan tab (owner, 19 Nov 2026: "floor plan should be
 * visible when they are making quotation"): the lead's plan itself, with the
 * note typed when it was uploaded, and "Upload floor plan" (owner, 14 Nov
 * 2026). The plan is kept on the quotation's lead, exactly as the lead
 * page's Floor plan and files box keeps it (same upload route, same
 * `lead-files` bucket).
 */
export function QuotePlanUpload({ clientId, leadName }: { clientId: string | null; leadName: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const [plans, setPlans] = useState<LeadPlan[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    if (!clientId) return;
    leadPlansAction(clientId)
      .then(setPlans)
      .catch(() => setPlans([]));
  }, [clientId]);
  useEffect(load, [load]);

  async function upload(file: File) {
    if (!clientId) return;
    const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    const check = checkLeadFile(type, file.size);
    if (!check.ok) return setSaid({ ok: false, text: check.error });
    setBusy(true);
    setSaid({ ok: true, text: 'Uploading the floor plan…' });
    try {
      const res = await fetch('/api/studio/leads/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId, contentType: type, bytes: file.size }) });
      const ticket = (await res.json().catch(() => null)) as { ok: boolean; path?: string; url?: string | null; error?: string } | null;
      if (!ticket?.ok || !ticket.path) return setSaid({ ok: false, text: ticket?.error ?? 'We could not start the upload. Try again.' });
      if (ticket.url) {
        const put = await fetch(ticket.url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'false' }, body: file });
        if (!put.ok) return setSaid({ ok: false, text: 'The upload did not finish. Check your connection and try again.' });
      }
      const attached = await attachFileAction({ clientId, path: ticket.path, name: file.name, contentType: type, bytes: file.size, kind: 'FLOOR_PLAN', quoteRequest: false, note });
      if (!attached.ok) return setSaid({ ok: false, text: 'error' in attached ? String(attached.error) : 'That did not attach.' });
      setSaid({ ok: true, text: `Floor plan saved on ${leadName}'s lead.` });
      setNote('');
      load();
    } catch {
      setSaid({ ok: false, text: 'The upload did not finish. Check your connection and try again.' });
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = '';
    }
  }

  if (!clientId) {
    return (
      <p className="muted hempty">
        This quotation is not for a lead, so there is nowhere to keep a floor plan. Quotations for a lead keep the plan on the lead.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {plans === null ? <p className="muted hempty">Loading the floor plan…</p> : <PlanViewer plans={plans} leadName={leadName} />}
      <section className="card" aria-label="Upload a floor plan" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="muted sm" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Note for the quotation (optional)
          <textarea className="fld" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any specific requirement that comes with this plan" disabled={busy} />
        </label>
        <label className="btn sec sm" style={{ alignSelf: 'flex-start', cursor: busy ? 'progress' : 'pointer' }}>
          {busy ? 'Uploading…' : plans && plans.length > 0 ? 'Upload another floor plan' : 'Upload floor plan (image or PDF)'}
          <input ref={picker} type="file" accept={LEAD_FILE_ACCEPT} disabled={busy} className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </label>
        <p className="muted sm" style={{ margin: 0 }}>
          Kept on {leadName}&rsquo;s lead ·{' '}
          <Link href={`/studio/clients/${clientId}#files`} className="underline">
            open the lead
          </Link>
        </p>
        {said ? (
          <p role={said.ok ? 'status' : 'alert'} className={said.ok ? 'muted sm' : 'cl-err'} style={{ margin: 0 }}>
            {said.text}
          </p>
        ) : null}
      </section>
    </div>
  );
}
