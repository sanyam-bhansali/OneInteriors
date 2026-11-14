'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { checkLeadFile, LEAD_FILE_ACCEPT } from '@/modules/studio-sales/lead-rules';
import { leadPlansAction } from '../actions';
import { attachFileAction } from '../../sales-actions';

/**
 * "Upload floor plan" in the Full builder (owner, 14 Nov 2026: "in our new
 * quotation builder we are not able to upload floor plan"). The plan is kept
 * on the quotation's lead, exactly as the lead page's Floor plan & quotations
 * tab keeps it (same upload route, same `lead-files` bucket), and it opens
 * from there.
 */
export function QuotePlanUpload({ clientId, leadName }: { clientId: string | null; leadName: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!clientId) return;
    leadPlansAction(clientId)
      .then((p) => setPlans(p.map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => setPlans([]));
  }, [clientId]);

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
      const attached = await attachFileAction({ clientId, path: ticket.path, name: file.name, contentType: type, bytes: file.size, kind: 'FLOOR_PLAN', quoteRequest: false });
      if (!attached.ok) return setSaid({ ok: false, text: 'error' in attached ? String(attached.error) : 'That did not attach.' });
      setSaid({ ok: true, text: `Floor plan saved on ${leadName}'s lead.` });
      const p = await leadPlansAction(clientId).catch(() => null);
      if (p) setPlans(p.map((x) => ({ id: x.id, name: x.name })));
    } catch {
      setSaid({ ok: false, text: 'The upload did not finish. Check your connection and try again.' });
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = '';
    }
  }

  return (
    <section className="card" aria-label="Floor plan" style={{ marginTop: 16 }}>
      <div className="chead">
        <h2>Floor plan</h2>
      </div>
      {clientId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="btn sec sm" style={{ alignSelf: 'flex-start', cursor: busy ? 'progress' : 'pointer' }}>
            {busy ? 'Uploading…' : 'Upload floor plan (image or PDF)'}
            <input ref={picker} type="file" accept={LEAD_FILE_ACCEPT} disabled={busy} className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
          {plans.length > 0 ? (
            <p className="muted sm" style={{ margin: 0 }}>
              On the lead: {plans.map((p) => p.name).join(', ')} ·{' '}
              <Link href={`/studio/clients/${clientId}`} className="underline">
                open them on the lead
              </Link>
            </p>
          ) : null}
          {said ? (
            <p role={said.ok ? 'status' : 'alert'} className={said.ok ? 'muted sm' : 'cl-err'} style={{ margin: 0 }}>
              {said.text}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="muted sm" style={{ margin: 0 }}>
          This quotation is not for a lead, so there is nowhere to keep a floor plan. Quotations for a lead keep the plan on the lead.
        </p>
      )}
    </section>
  );
}
