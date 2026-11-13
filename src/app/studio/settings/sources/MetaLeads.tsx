'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ConnectionRow, IntakeScreen } from '@/modules/studio-intake/connections';
import type { BackfillCursor, BackfillTally } from '@/modules/studio-intake/intake';
import type { CampaignChoice } from '@/modules/studio-intake/meta-account';
import { backfillStepAction, loadCampaignsAction, releaseStepAction, saveCampaignsAction } from './intake-actions';

/**
 * Meta lead ads on Settings → Lead sources (owner, 12 Nov 2026;
 * docs/studio-os/LEAD-INTAKE.md): Connect Facebook, which campaigns a Page's
 * leads come from, and bringing in its past leads (Meta keeps 90 days).
 */

const NOTICES: Record<string, string> = {
  cancelled: 'Facebook was not connected: the login was cancelled.',
  expired: 'That Facebook login had expired. Press Connect Facebook again.',
  refused: 'Your role does not include connecting where leads come in from. Ask your studio owner.',
  setup: 'One Interiors has not finished setting up Facebook yet. Try again later.',
  failed: 'Facebook did not finish connecting. Press Connect Facebook again, and allow every permission it asks for.',
};

export function MetaConnectBar({ screen, notice }: { screen: IntakeScreen; notice: string | null }) {
  const m = screen.metaConnect;
  const said = notice ? NOTICES[notice] : undefined;
  return (
    <div className="flex flex-col gap-2 rounded-[9px] border border-[var(--s-line,rgba(0,0,0,.12))] p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13.5px] font-medium">Facebook and Instagram lead ads</span>
        {m.blocker ? null : (
          /* A plain link: the login is a full-page trip to Facebook and back. */
          <a href="/api/studio/meta/connect" className="btn pri sm">
            {m.loggedIn ? 'Connect Facebook again' : 'Connect Facebook'}
          </a>
        )}
        {m.loggedIn ? (
          <Link href="/studio/settings/sources/meta" className="text-[13px] underline">
            Pick a Page
          </Link>
        ) : null}
      </div>
      {m.blocker ? (
        <p className="m-0 text-[12.5px] muted">{m.blocker}</p>
      ) : (
        <p className="m-0 text-[12.5px] muted">
          {m.loggedIn && m.loginName ? `Logged in as ${m.loginName}. ` : ''}
          Log in with the Facebook account that runs your ads, pick your Page, then pick which campaigns&rsquo; leads come in. You never paste a token.
        </p>
      )}
      {said ? (
        <p role="status" className="m-0 text-[12.5px] text-[var(--s-bad)]">
          {said}
        </p>
      ) : null}
    </div>
  );
}

/** The campaigns line on a Meta connection, and the picker behind it. */
export function MetaCampaigns({ c }: { c: ConnectionRow }) {
  const router = useRouter();
  const meta = c.meta!;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [list, setList] = useState<CampaignChoice[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [only, setOnly] = useState(meta.onlyCampaigns);
  const [picked, setPicked] = useState<Set<string>>(new Set(meta.campaigns.map((x) => x.id)));

  const summary = !meta.onlyCampaigns
    ? 'Every campaign'
    : meta.campaigns.length === 0
      ? 'No campaign picked yet: leads are kept aside, not put on your board'
      : meta.campaigns.map((x) => x.name).join(', ');

  async function load() {
    setOpen(true);
    setBusy(true);
    setError(null);
    try {
      const r = await loadCampaignsAction(c.id);
      if (!r.ok) setError(r.error);
      else {
        setList(r.campaigns);
        setNote(r.note);
        setOnly(r.only);
        setPicked(new Set(r.picked));
      }
    } catch {
      setError('That did not load. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!list) return;
    setBusy(true);
    setError(null);
    setSaid(null);
    try {
      const chosen = list.filter((x) => picked.has(x.id)).map((x) => ({ id: x.id, name: x.name }));
      const r = await saveCampaignsAction(c.id, only, chosen);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaid(r.message);
      /* Leads kept aside from campaigns now taken come in now. */
      const total = emptyTally();
      for (let i = 0; i < 40; i += 1) {
        const rel = await releaseStepAction(c.id);
        if (!rel.ok) {
          setError(rel.error);
          break;
        }
        add(total, rel.tally);
        if (rel.left === 0 || rel.tally.landed + rel.tally.duplicate + rel.tally.skipped + rel.tally.failed === 0) break;
        setSaid(`${r.message} Bringing in kept-aside leads: ${tallyLine(total)}…`);
      }
      if (total.landed + total.duplicate + total.failed > 0) setSaid(`${r.message} Kept-aside leads brought in: ${tallyLine(total)}.`);
      setOpen(false);
      router.refresh();
    } catch {
      setError('That did not go through. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 text-[12.5px]">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="muted">Campaigns</span>
        <span className={meta.onlyCampaigns && meta.campaigns.length === 0 ? 'text-[var(--s-bad)]' : ''}>{summary}</span>
        {meta.waiting > 0 ? <span className="muted">· {meta.waiting} kept aside</span> : null}
        {!open ? (
          <button type="button" className="underline" disabled={busy} onClick={load}>
            Choose campaigns
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-col gap-2 rounded-[8px] bg-[var(--s-surface)] p-3">
          {busy && !list ? <span className="muted">Asking Facebook for your campaigns…</span> : null}
          {list ? (
            <>
              <label className="flex items-center gap-2">
                <input type="radio" name={`only-${c.id}`} checked={!only} onChange={() => setOnly(false)} />
                Every campaign on this Page
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name={`only-${c.id}`} checked={only} onChange={() => setOnly(true)} />
                Only the campaigns I tick
              </label>
              {only ? (
                <ul className="m-0 flex max-h-[22rem] list-none flex-col gap-1 overflow-y-auto p-0 pl-5">
                  {list.map((x) => (
                    <li key={x.id}>
                      <label className="flex flex-wrap items-baseline gap-x-2">
                        <input
                          type="checkbox"
                          checked={picked.has(x.id)}
                          onChange={(e) => {
                            const next = new Set(picked);
                            if (e.target.checked) next.add(x.id);
                            else next.delete(x.id);
                            setPicked(next);
                          }}
                        />
                        <span>{x.name}</span>
                        {x.status ? <span className="muted">{statusWord(x.status)}</span> : null}
                        {x.landed > 0 ? <span className="muted">· {x.landed} on your board</span> : null}
                        {x.waiting > 0 ? <span className="muted">· {x.waiting} kept aside</span> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
              {note ? <p className="m-0 muted">{note}</p> : null}
              <p className="m-0 muted">Leads from campaigns you do not take are kept aside, not put on your board. Tick their campaign later and they come in.</p>
              <div className="flex gap-3">
                <button type="button" className="btn pri sm" disabled={busy || (only && picked.size === 0)} onClick={save}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="muted" disabled={busy} onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="m-0 text-[var(--s-bad)]">{error}</p> : null}
      {said ? (
        <p role="status" className="m-0">
          {said}
        </p>
      ) : null}
    </div>
  );
}

/** "Bring in past leads": the last 90 days, a stretch at a time. */
export function MetaBackfill({ c }: { c: ConnectionRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = c.meta!;

  async function go() {
    setBusy(true);
    setError(null);
    setLine('Reading your lead forms…');
    const total = emptyTally();
    let cursor: BackfillCursor | null = null;
    try {
      for (let i = 0; i < 200; i += 1) {
        const r = await backfillStepAction(c.id, cursor);
        if (!r.ok) {
          setError(r.error);
          break;
        }
        add(total, r.tally);
        if (r.done) {
          setLine(`Done: ${tallyLine(total)}.`);
          router.refresh();
          break;
        }
        cursor = r.next;
        setLine(`Working (form ${(r.next?.form ?? 0) + 1} of ${r.forms}): ${tallyLine(total)}…`);
      }
    } catch {
      setError('That stopped part way. Press it again: leads already brought in are not brought in twice.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-[12.5px]">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <button type="button" className="underline" disabled={busy || !c.enabled} onClick={go}>
          {busy ? 'Bringing in past leads…' : 'Bring in past leads (last 90 days)'}
        </button>
        <span className="muted">{meta.backfillLabel ? `Last done ${meta.backfillLabel}.` : 'Meta keeps leads for 90 days.'} Nobody is notified; someone already on your board is left as they are.</span>
      </div>
      {line ? <p className="m-0">{line}</p> : null}
      {error ? <p className="m-0 text-[var(--s-bad)]">{error}</p> : null}
    </div>
  );
}

function emptyTally(): BackfillTally {
  return { landed: 0, duplicate: 0, skipped: 0, failed: 0, seen: 0 };
}

function add(to: BackfillTally, t: BackfillTally) {
  to.landed += t.landed;
  to.duplicate += t.duplicate;
  to.skipped += t.skipped;
  to.failed += t.failed;
  to.seen += t.seen;
}

function tallyLine(t: BackfillTally): string {
  const parts = [`${t.landed} new`, `${t.duplicate} already on your board`];
  if (t.skipped > 0) parts.push(`${t.skipped} kept aside (campaign not taken)`);
  if (t.seen > 0) parts.push(`${t.seen} brought in before`);
  if (t.failed > 0) parts.push(`${t.failed} did not land`);
  return parts.join(', ');
}

function statusWord(s: string): string {
  if (s === 'ACTIVE') return 'running';
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED') return 'paused';
  if (s === 'ARCHIVED' || s === 'DELETED') return 'ended';
  return s.toLowerCase().replace(/_/g, ' ');
}
