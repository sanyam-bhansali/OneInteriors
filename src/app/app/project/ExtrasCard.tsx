'use client';

/**
 * Change orders and digital sign-off on the customer's project page (owner,
 * 15 Oct 2026; project/change-order-rules.ts, project/signoff-rules.ts):
 *
 * - Extra work: what, its size, the price (discount and GST the quotation's
 *   way), why, and Approve / Decline (with a reason). Once approved: the
 *   amount due and how to pay (the studio directly; confirm it under
 *   Payments when they record it).
 * - To sign: the quotations the studio asked them to sign, opening the
 *   reading and signing page; "Signed by … on …" once signed.
 *
 * The owner of the brief answers; family see the same and cannot.
 */

import Link from 'next/link';
import { useState } from 'react';
import { useLang } from '@/components/app/i18n';
import type { MyProject } from '@/components/app/useMyProject';
import { formatINR } from '@/lib/money';
import { lw } from '@/modules/app/lifecycle-words';
import { shortDate } from '@/modules/app/project-view';

type Extra = MyProject['extras'][number];
type Signoff = MyProject['signoffs'][number];

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;
const day = (d: string) => shortDate(`${d}T12:00:00Z`);

export function SignoffsCard({ signoffs }: { signoffs: Signoff[] }) {
  const lang = useLang();
  return (
    <section aria-label={lw(lang, 'life.sign.title')} className="oa-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="signoffs">
      <span className="oa-meta">{lw(lang, 'life.sign.title')}</span>
      {signoffs.map((s) => (
        <Link key={s.id} href={`/app/signoff/${s.id}`} className="oa-row" style={{ textDecoration: 'none' }}>
          <span>
            <span className="oa-row-title">{lw(lang, `life.sign.kind.${s.kind}`, { number: `${s.quoteNumber} R${s.revision}` })}</span>
            <span className="oa-row-sub">
              {s.state === 'signed' && s.signerName && s.signedOn
                ? `✓ ${lw(lang, 'life.sign.signed', { name: s.signerName, date: day(s.signedOn) })}`
                : s.state === 'superseded'
                  ? lw(lang, 'life.sign.superseded')
                  : `${formatINR(s.totalPaise)} · ${lw(lang, 'life.sign.read')}`}
            </span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      ))}
    </section>
  );
}

export function ExtrasCard({ extras, onChanged }: { extras: Extra[]; onChanged: () => void }) {
  const lang = useLang();
  return (
    <section aria-label={lw(lang, 'life.extra.title')} className="oa-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="extras">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="oa-meta">{lw(lang, 'life.extra.title')}</span>
        <span className="oa-row-sub">{lw(lang, 'life.extra.intro')}</span>
      </div>
      {extras.map((e) => (
        <ExtraItem key={e.id} e={e} onChanged={onChanged} />
      ))}
    </section>
  );
}

function ExtraItem({ e, onChanged }: { e: Extra; onChanged: () => void }) {
  const lang = useLang();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function answer(approve: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/app/v1/extras/${encodeURIComponent(e.id)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(approve ? { approve: true } : { approve: false, reason }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) {
        setMsg({ ok: true, text: lw(lang, 'life.extra.done') });
        setDeclining(false);
        onChanged();
      } else setMsg({ ok: false, text: body?.error ?? lw(lang, 'life.extra.failed') });
    } catch {
      setMsg({ ok: false, text: lw(lang, 'life.extra.failed') });
    } finally {
      setBusy(false);
    }
  }

  const stateLine =
    e.state === 'approved' ? lw(lang, 'life.extra.state.approved', { amount: formatINR(e.duePaise) }) : lw(lang, `life.extra.state.${e.state}`);
  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)' }} data-testid="extra" data-state={e.state}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <b>
          {lw(lang, 'life.extra.number', { n: e.number })}: {e.title}
        </b>
        <b className="mono">{formatINR(e.totalPaise)}</b>
      </div>
      <span className="oa-meta">{stateLine}</span>
      {e.reason ? (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>
          <span className="oa-meta">{lw(lang, 'life.extra.why')}: </span>
          {e.reason}
        </p>
      ) : null}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
        {e.lines.map((l, i) => (
          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>
              {l.product}
              {l.room ? ` · ${l.room}` : ''}
              {l.size ? <span className="oa-row-sub"> · {l.size}</span> : null}
            </span>
            <span className="mono">{formatINR(l.amountPaise)}</span>
          </li>
        ))}
        {e.discountPaise > 0 ? (
          <li style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{lw(lang, 'life.extra.discount')}</span>
            <span className="mono">− {formatINR(e.discountPaise)}</span>
          </li>
        ) : null}
        {e.gstPaise > 0 ? (
          <li style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{lw(lang, 'life.extra.gst', { pct: pct(e.gstBps) })}</span>
            <span className="mono">{formatINR(e.gstPaise)}</span>
          </li>
        ) : null}
        <li style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 600 }}>
          <span>{lw(lang, 'life.extra.total')}</span>
          <span className="mono">{formatINR(e.totalPaise)}</span>
        </li>
      </ul>
      {e.photoUrl ? (
        <a href={e.photoUrl} target="_blank" rel="noreferrer" className="oa-inline-link" style={{ textDecoration: "underline", fontSize: 14 }}>
          {lw(lang, 'life.extra.photo')}
        </a>
      ) : null}
      {e.state === 'declined' && e.declineReason ? <span className="oa-row-sub">“{e.declineReason}”</span> : null}
      {e.state === 'approved' ? <span className="oa-row-sub">{lw(lang, 'life.extra.howToPay')}</span> : null}
      {e.canAnswer ? (
        declining ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="oa-label" htmlFor={`decline-${e.id}`}>
              {lw(lang, 'life.extra.declineReason')}
            </label>
            <textarea id={`decline-${e.id}`} className="oa-input" rows={3} maxLength={600} value={reason} onChange={(ev) => setReason(ev.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="oa-chip" onClick={() => setDeclining(false)} disabled={busy}>
                ×
              </button>
              <button type="button" className="oa-chip" aria-pressed="true" onClick={() => void answer(false)} disabled={busy || reason.trim().length < 3}>
                {lw(lang, 'life.extra.sendDecline')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="oa-chip" aria-pressed="true" onClick={() => void answer(true)} disabled={busy} data-testid="extra-approve">
              {lw(lang, 'life.extra.approve')}
            </button>
            <button type="button" className="oa-chip" onClick={() => setDeclining(true)} disabled={busy} data-testid="extra-decline">
              {lw(lang, 'life.extra.decline')}
            </button>
          </div>
        )
      ) : null}
      {msg ? (
        <p className="oa-note" role={msg.ok ? 'status' : 'alert'} style={msg.ok ? undefined : { color: 'var(--accent-ink)' }}>
          {msg.text}
        </p>
      ) : null}
    </article>
  );
}
