'use client';

/**
 * Where the project is (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * the current step, the next step, and the one thing the customer must do to
 * unlock it — or "Nothing needed from you" with what the studio is doing.
 * Once every snag is closed, the owner signs off the handover here, which
 * starts the warranty. In English, Hindi or Marathi.
 */

import Link from 'next/link';
import { useState } from 'react';
import { useLang } from '@/components/app/i18n';
import type { MyProject } from '@/components/app/useMyProject';
import { formatINR } from '@/lib/money';
import { lifecycleLines, lw } from '@/modules/app/lifecycle-words';
import { shortDate } from '@/modules/app/project-view';

const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

export function LifecycleCard({ project, onChanged }: { project: MyProject; onChanged: () => void }) {
  const lang = useLang();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const l = project.lifecycle;
  if (!l) return null;
  const lines = lifecycleLines(l, lang, { studio: project.studio, money: (p) => formatINR(p), date: (d) => shortDate(d), today: today() });

  async function signOff() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/app/v1/project/${encodeURIComponent(project.id)}/handover`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; warrantyEndsOn?: string; error?: string } | null;
      if (res.ok && body?.ok && body.warrantyEndsOn) {
        setMsg(lw(lang, 'life.signoff.done', { date: shortDate(body.warrantyEndsOn) }));
        onChanged();
      } else setMsg(body?.error ?? lw(lang, 'life.signoff.failed'));
    } catch {
      setMsg(lw(lang, 'life.signoff.failed'));
    } finally {
      setBusy(false);
    }
  }

  const snagBlock = l.blocker?.kind === 'confirm_snag';
  return (
    <section aria-label={lw(lang, 'life.title')} className="oa-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="lifecycle">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="oa-meta">{lw(lang, 'life.title')}</span>
        <b style={{ fontSize: 13 }}>{lines.phase}</b>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', alignItems: 'baseline' }}>
        <span className="oa-meta">{lw(lang, 'life.now')}</span>
        <b>{lines.current}</b>
        {lines.next ? (
          <>
            <span className="oa-meta">{lw(lang, 'life.next')}</span>
            <span>{lines.next}</span>
          </>
        ) : null}
      </div>
      {lines.blocker ? (
        <div className="oa-flag" data-testid="lifecycle-blocker">
          <span className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
            {lw(lang, 'life.yourTurn')}
          </span>
          <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{lines.blocker}</p>
          {snagBlock ? (
            <Link href="/app/snags" className="oa-meta" style={{ color: 'var(--accent-ink)', display: 'inline-block', marginTop: 6 }}>
              {lw(lang, 'life.phase.snags')} →
            </Link>
          ) : null}
        </div>
      ) : (
        <div data-testid="lifecycle-nothing">
          <b>{lw(lang, 'life.nothing')}</b>
          <p className="oa-note" style={{ margin: '4px 0 0' }}>
            {lines.doing}
          </p>
        </div>
      )}
      {lines.warranty ? <p style={{ margin: 0, fontWeight: 600, color: 'var(--ok)' }}>{lines.warranty}</p> : null}
      {lines.snagWindow ? (
        <p className="oa-note" style={{ margin: 0 }} data-testid="snag-window">
          {lines.snagWindow}
        </p>
      ) : null}
      {l.canSignOff ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="oa-note" style={{ margin: 0 }}>
            {lw(lang, 'life.signoff.body')}
          </p>
          <button type="button" className="oa-cta" disabled={busy} onClick={signOff}>
            {lw(lang, 'life.signoff.button')}
          </button>
        </div>
      ) : null}
      {msg ? (
        <p role="status" style={{ margin: 0 }}>
          {msg}
        </p>
      ) : null}
    </section>
  );
}
