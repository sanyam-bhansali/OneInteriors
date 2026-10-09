'use client';

/**
 * Family (v79 design): everyone sees the site updates and the project; family
 * vote on decisions; only the owner chooses and approves payments. The owner
 * invites on WhatsApp; the invitee joins by signing in with that number.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Frame, Head, Tabs } from '@/components/app/ui';
import { useMyProject } from '@/components/app/useMyProject';
import { COINS } from '@/modules/engagement/coin-rules';
import { familyAction, inviteFamilyAction, removeFamilyAction } from '../engage/actions';

const RELATIONS = ['Husband', 'Wife', 'Partner', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];

type Row = { id: string; name: string; relation: string | null; joined: boolean; token: string };

export default function AppFamily() {
  const mine = useMyProject();
  const project = mine.state === 'real' ? mine.project : null;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', relation: 'Mother', phone: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!project || project.role !== 'owner') return;
    void familyAction(project.id).then((r) => (r.ok ? setRows(r.family) : setError(r.error)));
  }, [project]);
  useEffect(load, [load]);

  const invite = async () => {
    if (!project) return;
    setBusy(true);
    setError(null);
    const r = await inviteFamilyAction(project.id, form);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const link = `${location.origin}/app/family/join/${r.token}`;
    const text = `I've added you to our home in the One Interiors app. You'll see the site updates every day and can vote on choices like finishes. Join with this number: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    setSent(form.name);
    setForm({ name: '', relation: 'Mother', phone: '' });
    load();
  };

  if (mine.state === 'loading') return <Frame>{null}</Frame>;

  return (
    <Frame>
      <Head back="/app/me" />
      <main className="oa-body">
        <h1 className="oa-title">Your family</h1>
        {!project ? (
          <p className="oa-sub">Family can join once your project has started. Then they see every site update and vote on decisions.</p>
        ) : project.role === 'family' ? (
          <p className="oa-sub">
            You are following this home with {project.studio}. You see every update and can vote on decisions; the owner chooses.
          </p>
        ) : (
          <>
            <p className="oa-sub">Everyone sees the site updates. Family can vote on decisions; only you choose and approve payments.</p>
            {sent ? (
              <p className="oa-toast">
                Invite sent to {sent}. +{COINS.FAMILY_JOINED.coins} coins when they join.
              </p>
            ) : null}
            <div className="oa-list">
              {(rows ?? []).map((r) => (
                <div key={r.id} className="oa-row" style={{ cursor: 'default' }}>
                  <span className="oa-avatar small" aria-hidden>
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="oa-row-title" style={{ fontSize: 16 }}>
                      {r.name}
                      {r.relation ? ` · ${r.relation}` : ''}
                    </span>
                    <span className="oa-row-sub">{r.joined ? 'Sees everything, votes on decisions' : 'Invited, not joined yet'}</span>
                  </span>
                  <button
                    type="button"
                    className="oa-inline-link"
                    onClick={() => void removeFamilyAction(r.id).then(load)}
                    aria-label={`Remove ${r.name}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <section className="oa-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <b style={{ fontSize: 16 }}>Invite family on WhatsApp</b>
              <label className="oa-label" htmlFor="f-name" style={{ margin: 0 }}>
                Their name
              </label>
              <input id="f-name" className="oa-input" style={{ fontSize: 20 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rahul" />
              <div className="oa-chips" role="group" aria-label="Relation">
                {RELATIONS.map((x) => (
                  <button key={x} type="button" className="oa-chip" aria-pressed={form.relation === x} onClick={() => setForm({ ...form, relation: x })}>
                    {x}
                  </button>
                ))}
              </div>
              <label className="oa-label" htmlFor="f-phone" style={{ margin: 0 }}>
                Their mobile
              </label>
              <input id="f-phone" className="oa-input mono" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98220 41736" />
              <p className="oa-note">They join by signing in with this number.</p>
              {error ? (
                <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)' }}>
                  {error}
                </p>
              ) : null}
              <button type="button" className="oa-cta" disabled={busy || form.name.trim().length < 2 || form.phone.replace(/\D/g, '').length < 10} onClick={() => void invite()}>
                Invite on WhatsApp
              </button>
            </section>
          </>
        )}
        {!project ? (
          <Link href="/app/home" className="oa-inline-link">
            Back to home
          </Link>
        ) : null}
      </main>
      <Tabs />
    </Frame>
  );
}
