'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CALL_OUTCOMES, type CallOutcomeId } from '@/modules/studio-practice/event-copy';
import { suggestTags } from '@/modules/studio-sales/tag-rules';
import { dayLabel, dueBadge } from '@/modules/studio-sales/lead-view';
import { Avatar, Dot, Modal, PillDue, PillTag, SourceIcon, StageBadge, btnGhost, btnOutline, btnPrimary, useDismiss } from '../ax-ui';
import { LostReasonDialog } from '../AxBoard';
import { binAction, logContactAction, markLostAction } from '../actions';
import { addTagsAction, deleteNoteAction, editNoteAction, followUpDoneAction, moveLeadAction, removeTagAction } from '../list-actions';
import { addNoteAction, newQuoteForLeadAction } from '../../sales-actions';
import { Said, useAct } from '../../SalesUi';

const icon = (d: string, cls = '') => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cls}>
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
}: {
  lead: HeaderLead;
  tel: string | null;
  whatsapp: string | null;
  stages: { id: string; name: string; colour: string; kind: string }[];
  may: { edit: boolean; quote: boolean; delete: boolean };
  /** A sales final waits for its booking advance (Record booking is on this page). */
  canBook: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [lostTo, setLostTo] = useState<string | null>(null);
  const [askWrong, setAskWrong] = useState(false);
  const [explain, setExplain] = useState(false);
  const [sure, setSure] = useState(false);

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

  const logCall = (o: CallOutcomeId) => act(() => logContactAction(lead.id, o, null, null), 'Call logged', o === 'wrong_number' ? () => setAskWrong(true) : undefined);
  const moveTo = (to: string) => {
    if (to === lead.stageId) return;
    if (stages.find((s) => s.id === to)?.kind === 'LOST') return setLostTo(to);
    act(() => moveLeadAction(lead.id, to, null), `Moved to ${stages.find((s) => s.id === to)?.name ?? 'that column'}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <Link href="/studio/clients" onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }} className="inline-flex w-fit items-center gap-1 text-[13px] text-[var(--s-ink-3)] no-underline hover:text-[var(--s-ink)]">
        {icon('M15 18l-6-6 6-6')}
        Leads
      </Link>

      <div className="s-card px-5 py-[18px]">
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--s-rule)] px-2.5 py-1 text-[12px] font-medium">
            <SourceIcon source={lead.source} label={lead.sourceLabel} />
            {lead.sourceLabel}
          </span>
          {lead.tags.slice(0, 4).map((t) => (
            <PillTag key={t} tag={t} />
          ))}
          {lead.tags.length > 4 ? <span className="text-[12px] text-[var(--s-ink-3)]" title={lead.tags.slice(4).join(', ')}>+{lead.tags.length - 4}</span> : null}
          {may.edit ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={btnOutline} title={`Opens your own WhatsApp chat with ${lead.name}. We send nothing.`}>
                  {icon('M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.6z', 'text-[var(--s-good)]')}
                  WhatsApp
                </a>
              ) : null}
              <Menu label="Log call" iconPath="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" disabled={pending}>
                {(close) =>
                  CALL_OUTCOMES.map((o) => (
                    <MenuItem
                      key={o.id}
                      onClick={() => {
                        close();
                        logCall(o.id);
                      }}
                    >
                      {o.label}
                    </MenuItem>
                  ))
                }
              </Menu>
              <button type="button" onClick={() => goTo('notes', 'note-input')} className={btnOutline} title="Add internal note">
                {icon('M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5')}
                Note
              </button>
              <button type="button" onClick={() => goTo('tags', 'tag-input')} className={btnOutline} title="Add a tag">
                {icon('M20 12l-8 8-8-8V4h8zM8 8h.01')}
                Tag
              </button>
              <Menu label="Action" iconPath="M12 5v14M5 12h14" primary disabled={pending}>
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
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <Avatar name={lead.name} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-[19px] font-bold tracking-tight">{lead.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--s-ink-3)]">
              {lead.phone ? (
                tel ? (
                  <a href={tel} className="s-num inline-flex items-center gap-1.5 text-[var(--s-ink-2)] no-underline hover:underline" title="Call">
                    {icon('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2')}
                    {lead.phone}
                  </a>
                ) : (
                  <span className="s-num">{lead.phone}</span>
                )
              ) : (
                <span className="text-[var(--s-warn)]">No phone captured yet</span>
              )}
              {lead.email ? <span>{lead.email}</span> : null}
              {lead.society || lead.locality || lead.city ? <span>{[lead.society, lead.locality, lead.city].filter(Boolean).join(', ')}</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {may.edit ? (
            <Menu
              label={
                <span className="inline-flex items-center gap-1.5">
                  <StageBadge name={lead.stageName} colour={lead.stageColour} />
                </span>
              }
              plain
              disabled={pending}
            >
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
                    {s.id === lead.stageId ? <span className="ml-auto text-[var(--s-accent)]">✓</span> : null}
                  </MenuItem>
                ))
              }
            </Menu>
          ) : (
            <StageBadge name={lead.stageName} colour={lead.stageColour} />
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--s-rule)] px-2.5 py-1 text-[12px] ${lead.ownerName ? '' : 'text-[var(--s-warn)]'}`} title={may.delete ? 'Change the owner in the panel on the right' : undefined}>
            {icon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6')}
            {lead.ownerName ?? 'Unassigned'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {lead.booked ? (
              <span className={`${btnOutline} border-[var(--s-good)]/40 text-[var(--s-good)]`}>{icon('M5 12.5l4.5 4.5L19 7.5')}Converted</span>
            ) : (
              <button
                type="button"
                onClick={() => (canBook ? goTo('booking') : setExplain((x) => !x))}
                className={`${btnOutline} border-[var(--s-good)]/40 text-[var(--s-good)]`}
              >
                {icon('M5 12.5l4.5 4.5L19 7.5')}
                Converted
              </button>
            )}
            {may.delete ? (
              sure ? (
                <button type="button" disabled={pending} onClick={() => act(() => binAction([lead.id]), 'Deleted', () => router.push('/studio/clients'))} className={`${btnOutline} text-[var(--s-bad)]`}>
                  Yes, delete
                </button>
              ) : (
                <button type="button" onClick={() => setSure(true)} className={btnGhost} title="Delete lead" aria-label="Delete lead">
                  {icon('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3')}
                </button>
              )
            ) : null}
          </div>
        </div>
        {explain ? (
          <p className="m-0 mt-3 rounded-[10px] bg-[var(--s-surface-2)] px-3 py-2 text-[13px] text-[var(--s-ink-2)]">
            Converted means the booking advance is recorded. Mark a quotation&rsquo;s sales final first; then Record booking appears below and turns this lead into a project.
          </p>
        ) : null}
        {said ? (
          <p role={said.ok ? 'status' : 'alert'} className={`m-0 mt-2 text-[13px] ${said.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
            {said.text}
          </p>
        ) : null}
      </div>

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
      {askWrong ? (
        <Modal onClose={() => setAskWrong(false)} width="min(420px, 92vw)" labelledBy="wrong-title">
          <div className="px-5 py-4">
            <h2 id="wrong-title" className="m-0 text-[16px] font-semibold">
              Wrong number. Mark {lead.name} lost?
            </h2>
            <p className="m-0 mt-1 text-[13px] text-[var(--s-ink-2)]">Only if there is no other way to reach them. You can move it back any time.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAskWrong(false)} className={btnOutline}>
                Keep it open
              </button>
              <button type="button" onClick={() => act(() => markLostAction(lead.id, 'WRONG_NUMBER'), 'Marked lost — wrong number', () => setAskWrong(false))} className={btnPrimary}>
                Mark lost — wrong number
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Menu({ label, iconPath, children, primary, plain, disabled }: { label: React.ReactNode; iconPath?: string; children: (close: () => void) => React.ReactNode; primary?: boolean; plain?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative inline-flex">
      <button type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={plain ? 'inline-flex items-center gap-1' : primary ? btnPrimary : btnOutline}>
        {iconPath ? icon(iconPath) : null}
        {label}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="opacity-60">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 max-h-[22rem] min-w-[13rem] overflow-y-auto rounded-[10px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-1 shadow-[var(--s-lift)]">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--s-rail-active)]">
      {children}
    </button>
  );
}

/** Left column tabs (AxLeads: Timeline …). The panels are rendered on the server. */
export function LeadTabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [tab, setTab] = useState(tabs[0]?.key ?? '');
  useEffect(() => {
    const h = window.location.hash.slice(1);
    const owner = tabs.find((t) => t.key === h || (h && ['files', 'quotes', 'booking'].includes(h) && t.key === 'sales'));
    if (owner) setTab(owner.key);
  }, [tabs]);
  return (
    <div>
      <div role="tablist" className="mb-4 inline-flex rounded-[10px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-1 text-[13px] font-medium">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`rounded-[7px] px-3 py-1.5 ${tab === t.key ? 'bg-[var(--s-accent)] text-white' : 'hover:bg-[var(--s-rail-active)]'}`}>
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
    <section id="notes" className="s-card mt-4 scroll-mt-20 p-4">
      <h2 className="m-0 mb-3 text-[14.5px] font-semibold">Internal notes</h2>
      {notes.length === 0 ? <p className="m-0 mb-3 text-[13px] text-[var(--s-ink-3)]">No notes yet.</p> : null}
      <ul className="m-0 mb-3 flex list-none flex-col gap-2.5 p-0">
        {notes.map((n) => {
          const mine = seesAll || (meId !== null && n.byId === meId);
          return (
            <li key={n.id} className="rounded-[10px] bg-[var(--s-surface-2)] px-3 py-2.5 text-[13.5px]">
              {editing === n.id ? (
                <div className="flex flex-col gap-2">
                  <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full resize-y rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 py-1.5" />
                  <div className="flex gap-2">
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
                  <p className="m-0 whitespace-pre-wrap">{n.text}</p>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--s-ink-3)]">
                    <span>
                      {n.by ?? 'Someone'} · {dayLabel(n.at)}
                    </span>
                    {may && mine ? (
                      <>
                        <button type="button" onClick={() => { setEditing(n.id); setDraft(n.text); }} className="ml-auto underline">
                          Edit
                        </button>
                        <button type="button" disabled={pending} onClick={() => run(() => deleteNoteAction(leadId, n.id))} className="underline text-[var(--s-bad)]">
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
        <div className="flex flex-col gap-2">
          <textarea id="note-input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add internal note" className="w-full resize-y rounded-[9px] border border-[var(--s-rule)] px-3 py-2 text-[13.5px]" />
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
    <section className="s-card p-4">
      <h2 className="s-label m-0 mb-2">Follow-up</h2>
      {on ? (
        <label className="flex items-start gap-2 text-[13.5px]">
          <input type="checkbox" disabled={!may || pending} onChange={() => run(() => followUpDoneAction(leadId))} className="mt-1" aria-label="Mark the follow-up done" />
          <span>
            Next call: <span className="font-medium">{when}</span>
            {action ? <span className="block text-[12.5px] text-[var(--s-ink-3)]">{action}</span> : null}
          </span>
          {due ? <span className="ml-auto"><PillDue bucket={due.bucket} label={due.label} /></span> : null}
        </label>
      ) : (
        <p className="m-0 text-[13px] text-[var(--s-ink-3)]">No call scheduled.</p>
      )}
      <p className="m-0 mt-2 text-[12px] text-[var(--s-ink-3)]">Created {dayLabel(createdAt)}</p>
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
    <section id="tags" className="s-card scroll-mt-20 p-4">
      <h2 className="s-label m-0 mb-2">Tags</h2>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.length === 0 ? <span className="text-[13px] text-[var(--s-ink-3)]">No tags.</span> : null}
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-[7px] border border-[#7a4fa0]/30 bg-[#7a4fa0]/10 px-2 py-0.5 text-[12px] font-semibold text-[#6a3f90]">
            #{t}
            {may ? (
              <button type="button" aria-label={`Remove tag ${t}`} disabled={pending} onClick={() => run(() => removeTagAction(leadId, t))} className="opacity-70 hover:opacity-100">
                ×
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {may ? (
        <form
          className="relative mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add(text);
          }}
        >
          <input id="tag-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a tag" maxLength={40} className="h-[32px] w-full rounded-[8px] border border-[var(--s-rule)] px-2.5 text-[13px]" />
          {suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[9px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-1 shadow-[var(--s-lift)]">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => add(s)} className="block w-full rounded-[6px] px-2 py-1 text-left text-[13px] hover:bg-[var(--s-rail-active)]">
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
    <section className="s-card p-4">
      <h2 className="s-label m-0 mb-2">Attribution</h2>
      <div className="flex items-center gap-2 text-[13.5px]">
        <SourceIcon source={source} label={sourceLabel} />
        <span>Source: {sourceLabel}</span>
      </div>
      {note ? <p className="m-0 mt-1 text-[12.5px] text-[var(--s-ink-3)]">{note}</p> : null}
    </section>
  );
}
