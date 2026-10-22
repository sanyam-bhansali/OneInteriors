'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { type CallOutcomeId } from '@/modules/studio-practice/event-copy';
import { CALL_MENU } from '@/modules/studio-practice/call-log';
import { CallSheet } from '../CallLogger';
import { suggestTags } from '@/modules/studio-sales/tag-rules';
import { dayLabel, dueBadge } from '@/modules/studio-sales/lead-view';
import { initials } from '@/modules/studio-sales/lead-view';
import { LineIcon } from '../../ui/icons';
import { Dot, PillDue, PillTag, SourceIcon, btnGhost, btnOutline, btnPrimary, useDismiss } from '../ax-ui';
import { LostReasonDialog } from '../AxBoard';
import { binAction } from '../actions';
import { addTagsAction, deleteNoteAction, editNoteAction, followUpDoneAction, moveLeadAction, removeTagAction } from '../list-actions';
import { addNoteAction, newQuoteForLeadAction } from '../../sales-actions';
import { Said, useAct } from '../../SalesUi';
import { CALL_LOGGED_EVENT } from './LeadNav';

const icon = (d: string, cls = '') => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cls}>
    <path d={d} />
  </svg>
);

/** Scroll to a panel on this page and (for inputs) focus it. */
function goTo(id: string, focus?: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (focus) window.setTimeout(() => (document.getElementById(focus) as HTMLInputElement | null)?.focus(), 350);
}

export interface HeaderLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  society: string | null;
  locality: string | null;
  city: string | null;
  source: string;
  sourceLabel: string;
  stageId: string;
  stageName: string;
  stageColour: string;
  ownerName: string | null;
  tags: string[];
  booked: boolean;
}

/**
 * The lead's header, as AxLeads lays it out (12 Oct 2026): the source chip and
 * tags, then WhatsApp · Log call · Note · Tag · + Action; the name and phone;
 * the stage dropdown and the owner, then Converted and delete. "WhatsApp"
 * opens the person's own WhatsApp chat — we send nothing.
 */
export function LeadHeader({
  lead,
  tel,
  whatsapp,
  stages,
  may,
  canBook,
  previousCalls = 0,
}: {
  lead: HeaderLead;
  tel: string | null;
  whatsapp: string | null;
  /** In board order, with the flags the call sheet's suggested move reads (calling steps, 21 Oct 2026). */
  stages: { id: string; name: string; colour: string; kind: 'OPEN' | 'WON' | 'DONE' | 'LOST'; sortOrder?: number; isIntake?: boolean; isCallStep?: boolean }[];
  may: { edit: boolean; quote: boolean; delete: boolean };
  /** A sales final waits for its booking advance (Record booking is on this page). */
  canBook: boolean;
  /** Calls already logged on this lead: the Picked up sheet's "attempt N". */
  previousCalls?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [lostTo, setLostTo] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const [sure, setSure] = useState(false);
  /* Log call → the outcome's sheet (AxLeads, 13 Oct 2026; calling steps,
     21 Oct 2026): Picked up, a missed call's retry and suggested move, or
     wrong number. The same sheet the list, the board and Today open. */
  const [calling, setCalling] = useState<CallOutcomeId | 'picked_up' | null>(null);

  const act = (fn: () => Promise<object | undefined>, okText: string, after?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (r && 'error' in r && typeof r.error === 'string') setSaid({ ok: false, text: r.error });
        else {
          setSaid({ ok: true, text: okText });
          after?.();
          router.refresh();
        }
      } catch (e) {
        if (e && typeof e === 'object' && 'digest' in e && String((e as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')) throw e;
        setSaid({ ok: false, text: 'That did not go through. Try again.' });
      }
    });

  const moveTo = (to: string) => {
    if (to === lead.stageId) return;
    if (stages.find((s) => s.id === to)?.kind === 'LOST') return setLostTo(to);
    act(() => moveLeadAction(lead.id, to, null), `Moved to ${stages.find((s) => s.id === to)?.name ?? 'that column'}`);
  };

  const home = [lead.society, lead.locality, lead.city].filter(Boolean).join(', ');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link
        href="/studio/clients"
        onClick={(e) => {
          if (window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        }}
        className="cl-back"
      >
        {icon('M15 18l-6-6 6-6')}
        Clients
      </Link>

      <div className="cl-lhead">
        <span className="av big" aria-hidden>
          {initials(lead.name) ?? '?'}
        </span>
        <div className="who">
          <h1>{lead.name}</h1>
          <div className="hstack muted" style={{ gap: 8 }}>
            {lead.phone ? (
              tel ? (
                <a href={tel} className="mono" style={{ color: 'var(--text2)' }} title="Call">
                  {lead.phone}
                </a>
              ) : (
                <span className="mono">{lead.phone}</span>
              )
            ) : (
              <span className="warn-t">No phone captured yet</span>
            )}
            {lead.email ? <span>· {lead.email}</span> : null}
            {home ? <span>· {home}</span> : null}
            <span className={`chip xs ${lead.source === 'ONE_INTERIORS' ? 'oi' : ''}`}>
              <SourceIcon source={lead.source} label={lead.sourceLabel} />
              {lead.sourceLabel}
            </span>
            {lead.tags.slice(0, 4).map((t) => (
              <PillTag key={t} tag={t} />
            ))}
            {lead.tags.length > 4 ? (
              <span className="sm" title={lead.tags.slice(4).join(', ')}>
                +{lead.tags.length - 4}
              </span>
            ) : null}
          </div>
        </div>
        <div className="acts">
          {tel ? (
            <a href={tel} className="btn sec">
              <LineIcon name="phone" size={16} />
              Call
            </a>
          ) : null}
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn sec" title={`Opens your own WhatsApp chat with ${lead.name}. We send nothing.`}>
              <LineIcon name="chat" size={16} />
              WhatsApp
            </a>
          ) : null}
          {may.edit ? (
            <Menu label={lead.stageName} stage disabled={pending}>
              {(close) =>
                stages.map((s) => (
                  <MenuItem
                    key={s.id}
                    onClick={() => {
                      close();
                      moveTo(s.id);
                    }}
                  >
                    <Dot colour={s.colour} />
                    {s.name}
                    {s.id === lead.stageId ? <span className="ok">✓</span> : null}
                  </MenuItem>
                ))
              }
            </Menu>
          ) : (
            <span className="btn" style={{ background: 'var(--acc-soft)', color: 'var(--acc-ink)', fontWeight: 600, cursor: 'default' }}>
              {lead.stageName}
            </span>
          )}
        </div>
      </div>

      <div className="hstack" style={{ gap: 8 }}>
        {may.edit ? (
          <>
            <span id="log-call" style={{ scrollMarginTop: 90 }} />
            <Menu label="Log call" iconPath="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" disabled={pending} left>
              {(close) => (
                <>
                  <span className="cl-menuhead">Call outcome</span>
                  {CALL_MENU.map((o) => (
                    <MenuItem
                      key={o.id}
                      onClick={() => {
                        close();
                        setCalling(o.id as CallOutcomeId | 'picked_up');
                      }}
                    >
                      <span className={o.id === 'picked_up' ? 'good-t' : o.id === 'wrong_number' ? 'bad-t' : 'warn-t'} aria-hidden>
                        {o.id === 'picked_up' ? '✓' : o.id === 'wrong_number' ? '⚠' : o.id === 'voicemail' ? '◌' : '☎'}
                      </span>{' '}
                      {o.label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
            <button type="button" onClick={() => goTo('notes', 'note-input')} className={btnOutline} title="Add internal note">
              {icon('M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5')}
              Note
            </button>
            <button type="button" onClick={() => goTo('tags', 'tag-input')} className={btnOutline} title="Add a tag">
              {icon('M20 12l-8 8-8-8V4h8zM8 8h.01')}
              Tag
            </button>
            <Menu label="Action" iconPath="M12 5v14M5 12h14" primary disabled={pending} left>
              {(close) => (
                <>
                  <MenuItem
                    onClick={() => {
                      close();
                      window.location.hash = 'schedule-call';
                      goTo('next');
                    }}
                  >
                    Schedule a call
                  </MenuItem>
                  {may.quote ? (
                    <MenuItem
                      onClick={() => {
                        close();
                        act(() => newQuoteForLeadAction(lead.id), 'Quotation started');
                      }}
                    >
                      Send quotation
                    </MenuItem>
                  ) : null}
                  <MenuItem
                    onClick={() => {
                      close();
                      goTo('meeting');
                    }}
                  >
                    Schedule site visit
                  </MenuItem>
                </>
              )}
            </Menu>
          </>
        ) : null}
        <span className={`chip ${lead.ownerName ? '' : 'warn'}`} title={may.delete ? 'Change the owner in the panel on the right' : undefined}>
          {icon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6')}
          {lead.ownerName ?? 'Unassigned'}
        </span>
        <span style={{ flex: 1 }} />
        {lead.booked ? (
          <span className="chip good">
            {icon('M5 12.5l4.5 4.5L19 7.5')}
            Converted
          </span>
        ) : (
          <button type="button" onClick={() => (canBook ? goTo('booking') : setExplain((x) => !x))} className="btn sm" style={{ background: 'var(--good-bg)', color: 'var(--good)' }}>
            {icon('M5 12.5l4.5 4.5L19 7.5')}
            Converted
          </button>
        )}
        {may.delete ? (
          sure ? (
            <button type="button" disabled={pending} onClick={() => act(() => binAction([lead.id]), 'Deleted', () => router.push('/studio/clients'))} className="btn sec sm bad-b">
              Yes, delete
            </button>
          ) : (
            <button type="button" onClick={() => setSure(true)} className={btnGhost} title="Delete lead" aria-label="Delete lead">
              {icon('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3')}
            </button>
          )
        ) : null}
      </div>
      {explain ? (
        <p className="sm" style={{ margin: 0, padding: '10px 14px', borderRadius: 12, background: 'var(--soft)', color: 'var(--text2)' }}>
          Converted means the booking advance is recorded. Mark a quotation&rsquo;s sales final first; then Record booking appears below and turns this lead into a project.
        </p>
      ) : null}
      {said ? (
        <p role={said.ok ? 'status' : 'alert'} className={said.ok ? 'cl-ok' : 'cl-err'}>
          {said.text}
        </p>
      ) : null}

      {lostTo ? (
        <LostReasonDialog
          name={lead.name}
          onClose={() => setLostTo(null)}
          onPick={(reason) => {
            const to = lostTo;
            setLostTo(null);
            act(() => moveLeadAction(lead.id, to, reason), 'Marked lost');
          }}
        />
      ) : null}
      {calling ? (
        <CallSheet
          lead={{ id: lead.id, name: lead.name, phone: lead.phone, stageId: lead.stageId }}
          stages={stages}
          outcome={calling}
          previousCalls={previousCalls}
          onClose={() => setCalling(null)}
          onLogged={(r) => {
            setSaid({ ok: true, text: r.movedTo ? `Call logged · moved to ${r.movedTo.name}` : 'Call logged' });
            /* "Next lead →" (improvement 8, owner 22 Oct 2026): LeadNav offers the next lead in the list this page came from. */
            window.dispatchEvent(new CustomEvent(CALL_LOGGED_EVENT, { detail: { leadId: lead.id } }));
          }}
        />
      ) : null}
    </div>
  );
}

function Menu({ label, iconPath, children, primary, stage, left, disabled }: { label: React.ReactNode; iconPath?: string; children: (close: () => void) => React.ReactNode; primary?: boolean; stage?: boolean; left?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="cl-pop">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={stage ? 'btn' : primary ? btnPrimary : btnOutline}
        style={stage ? { background: 'var(--acc-soft)', color: 'var(--acc-ink)', fontWeight: 600 } : undefined}
      >
        {iconPath ? icon(iconPath) : null}
        {label}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ opacity: 0.6 }}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className={`cl-menu ${left ? '' : 'r'}`} style={{ minWidth: 208 }}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="cl-mi">
      {children}
    </button>
  );
}

/** Left column tabs (Timeline, Floor plan and quotations, Tasks), the design's tabs. The panels are rendered on the server. */
export function LeadTabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [tab, setTab] = useState(tabs[0]?.key ?? '');
  useEffect(() => {
    const h = window.location.hash.slice(1);
    const owner = tabs.find((t) => t.key === h || (h && ['files', 'quotes', 'booking'].includes(h) && t.key === 'sales'));
    if (owner) setTab(owner.key);
  }, [tabs]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <div role="tablist" className="tabs">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={tab !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** Internal notes (AxLeads): newest first, edit and delete your own, "Add internal note". */
export function NotesPanel({ leadId, notes, meId, seesAll, may }: { leadId: string; notes: { id: string; text: string; by: string | null; byId: string | null; at: Date }[]; meId: string | null; seesAll: boolean; may: boolean }) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const { pending, result, run } = useAct();
  return (
    <section id="notes" className="card" style={{ scrollMarginTop: 80 }}>
      <h2 className="h">Internal notes</h2>
      {notes.length === 0 ? <p className="cl-sub">No notes yet.</p> : null}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.map((n) => {
          const mine = seesAll || (meId !== null && n.byId === meId);
          return (
            <li key={n.id} style={{ borderRadius: 12, background: 'var(--soft)', padding: '10px 12px' }}>
              {editing === n.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} className="fld" />
                  <div className="hstack" style={{ gap: 8 }}>
                    <button type="button" disabled={pending || !draft.trim()} onClick={() => run(() => editNoteAction(leadId, n.id, draft), (r) => r.ok && setEditing(null))} className={btnPrimary}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className={btnOutline}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{n.text}</p>
                  <div className="hstack muted" style={{ gap: 8, marginTop: 4, fontSize: 12.5 }}>
                    <span>
                      {n.by ?? 'Someone'} · {dayLabel(n.at)}
                    </span>
                    {may && mine ? (
                      <>
                        <button type="button" onClick={() => { setEditing(n.id); setDraft(n.text); }} className="btn xs" style={{ marginLeft: 'auto', background: 'transparent' }}>
                          Edit
                        </button>
                        <button type="button" disabled={pending} onClick={() => run(() => deleteNoteAction(leadId, n.id))} className="btn xs bad-b" style={{ background: 'transparent' }}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {may ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea id="note-input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add internal note" className="fld" />
          <div>
            <button type="button" disabled={pending || !text.trim()} onClick={() => run(() => addNoteAction(leadId, text.trim()), (r) => r.ok && setText(''))} className={btnPrimary}>
              Add internal note
            </button>
          </div>
        </div>
      ) : null}
      <Said result={result} />
    </section>
  );
}

/** Follow-up (AxLeads): "Next call: 14 Oct · 3:02 pm" with a done tick. */
export function FollowUpPanel({ leadId, action, on, createdAt, may }: { leadId: string; action: string | null; on: Date | null; createdAt: Date; may: boolean }) {
  const { pending, result, run } = useAct();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const due = now && on ? dueBadge(on, now) : null;
  const when = on ? new Date(on).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).replace(',', ' ·') : null;
  return (
    <section className="card">
      <h2 className="h">Follow-up</h2>
      {on ? (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <input type="checkbox" disabled={!may || pending} onChange={() => run(() => followUpDoneAction(leadId))} style={{ marginTop: 3 }} aria-label="Mark the follow-up done" />
          <span>
            Next call: <span style={{ fontWeight: 600 }}>{when}</span>
            {action ? <span className="muted sm" style={{ display: 'block' }}>{action}</span> : null}
          </span>
          {due ? <span style={{ marginLeft: 'auto' }}><PillDue bucket={due.bucket} label={due.label} /></span> : null}
        </label>
      ) : (
        <p className="cl-sub">No call scheduled.</p>
      )}
      <p className="cl-sub">Created {dayLabel(createdAt)}</p>
      <Said result={result} />
    </section>
  );
}

/** Tags (AxLeads): the lead's tags, × to remove, and an input with the studio's tags as suggestions. */
export function TagsPanel({ leadId, tags, vocab, may }: { leadId: string; tags: string[]; vocab: string[]; may: boolean }) {
  const [text, setText] = useState('');
  const { pending, result, run } = useAct();
  const suggestions = text ? suggestTags(vocab, text, tags, 6) : [];
  const add = (t: string) => run(() => addTagsAction(leadId, [t]), (r) => r.ok && setText(''));
  return (
    <section id="tags" className="card" style={{ scrollMarginTop: 80 }}>
      <h2 className="h">Tags</h2>
      <div className="hstack" style={{ gap: 6 }}>
        {tags.length === 0 ? <span className="cl-sub">No tags.</span> : null}
        {tags.map((t) => (
          <span key={t} className='chip tag' style={{ maxWidth: 'none' }}>
            #{t}
            {may ? (
              <button type="button" aria-label={`Remove tag ${t}`} disabled={pending} onClick={() => run(() => removeTagAction(leadId, t))} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                ×
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {may ? (
        <form
          style={{ position: 'relative' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add(text);
          }}
        >
          <input id="tag-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a tag" maxLength={40} className="fld sm" style={{ width: '100%' }} />
          {suggestions.length > 0 ? (
            <div className="cl-menu" style={{ right: 0 }}>
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => add(s)} className="cl-mi">
                  #{s}
                </button>
              ))}
            </div>
          ) : null}
        </form>
      ) : null}
      <Said result={result} />
    </section>
  );
}

/** Attribution (AxLeads): where the lead came from. */
export function Attribution({ source, sourceLabel, note }: { source: string; sourceLabel: string; note: string | null }) {
  return (
    <section className="card">
      <h2 className="h">Where they came from</h2>
      <div className="hstack" style={{ gap: 8 }}>
        <SourceIcon source={source} label={sourceLabel} />
        <span>Source: {sourceLabel}</span>
      </div>
      {note ? <p className="cl-sub">{note}</p> : null}
    </section>
  );
}
