'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { StudioPlan, PlanStageView, PlanEditResult } from '@/modules/project/plan-edit';
import {
  dayWords,
  gateWords,
  isCustomerDelay,
  moveSentence,
  overallDelay,
  planMove,
  reasonWords,
  type DelayReason,
  type RuleChange,
  type RuleStage,
} from '@/modules/project/project-rules';
import { calendarOf, daysBetween, istDay } from '@/modules/project/working-days';
import { CustomerSees, OnlyYourTeam } from '../marks';
import { markStageDoneAction, moveDateAction, renameStageAction, tickItemAction } from './plan-actions';

/**
 * The Plan tab (studio workspace Phase 3, design StudioProject.dc.html):
 * every stage planned against actual or forecast, what the customer sees for
 * it, each room's checklist with ticks, and "Move a date" with a reason and
 * a preview of exactly what the customer will read before anything is saved.
 *
 * One obvious action per place: tick an item, move a date, mark a stage
 * done. Ticks answer at once and undo themselves if the server says no.
 * Nothing here is typed by hand for the customer: statuses come from
 * project-rules.ts, the same rules the customer's app reads.
 */

type Toast = { ok: boolean; text: string } | null;

const muted = 'text-[12.5px] text-[var(--s-ink-3)]';
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

export function PlanTab({ plan, customer }: { plan: StudioPlan; customer: string }) {
  const [toast, setToast] = useState<Toast>(null);
  const [moving, setMoving] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const say = (r: PlanEditResult) => setToast(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
  const current = plan.stages.find((s) => s.state === 'now') ?? null;

  return (
    <section aria-label="Plan" className="flex flex-col gap-4">
      <Overall plan={plan} customer={customer} onMove={plan.canEdit ? () => setMoving(current?.id ?? plan.stages[0]!.id) : null} />

      <div className="s-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-[16px] font-semibold">Stages</h2>
          <CustomerSees name={customer} />
        </div>
        <p className={`m-0 mt-1 ${muted}`}>
          Made from the signed quote. A stage finishes when its last item is ticked and a site photo from it is posted.
        </p>
        <div className="mt-4 hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.4fr)] gap-3 px-1 pb-2 text-[12px] font-semibold text-[var(--s-ink-3)] md:grid">
          <span>Stage</span>
          <span>Planned</span>
          <span>Actual or forecast</span>
          <span>{customer} sees</span>
        </div>
        <ol className="m-0 flex list-none flex-col p-0">
          {plan.stages.map((s) => (
            <StageRow key={s.id} plan={plan} stage={s} customer={customer} onMove={() => setMoving(s.id)} say={say} />
          ))}
        </ol>
      </div>

      {plan.moves.length ? <Moves plan={plan} customer={customer} /> : null}

      {moving ? <MoveDialog plan={plan} customer={customer} initialStage={moving} onClose={() => setMoving(null)} say={say} /> : null}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        {toast ? (
          <p
            role="status"
            className="pointer-events-auto m-0 max-w-[560px] rounded-[12px] px-4 py-3 text-[14px] font-medium shadow-lg"
            style={toast.ok ? { background: 'var(--s-accent-deep)', color: '#fff' } : { background: 'var(--s-bad-wash)', color: 'var(--s-bad)', border: '1px solid var(--s-bad)' }}
          >
            {toast.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ── The overall line ───────────────────────────────────────────

function Overall({ plan, customer, onMove }: { plan: StudioPlan; customer: string; onMove: (() => void) | null }) {
  const o = plan.overall;
  const c = plan.current;
  const stageLine = c ? `${c.name} · ${c.status === 'late' ? `${days(c.lateDays)} late` : 'on track'}` : 'Handed over';
  const overallLine = o.lateDays > 0 ? `Overall · ${days(o.lateDays)} late` : o.earlyDays > 0 ? `Overall · ${days(o.earlyDays)} early` : 'Overall · on time';
  return (
    <div className="s-card flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap gap-2">
          <Chip tone={c?.status === 'late' ? 'bad' : 'good'}>{stageLine}</Chip>
          <Chip tone={o.studioDays > 0 ? 'bad' : o.lateDays > 0 ? 'warn' : 'good'}>{overallLine}</Chip>
        </div>
        {o.plannedHandover && o.forecastHandover ? (
          <p className="m-0 mt-1 text-[13.5px] text-[var(--s-ink-2)]">
            Handover planned <b className="s-num font-[family-name:var(--font-mono)] font-medium">{dayWords(o.plannedHandover)}</b>
            {o.forecastHandover !== o.plannedHandover ? (
              <>
                , {o.handedOver ? 'done' : 'now expected'} <b className="s-num font-[family-name:var(--font-mono)] font-medium">{dayWords(o.forecastHandover)}</b>
              </>
            ) : null}
            .
          </p>
        ) : null}
        {o.lateDays > 0 ? (
          <p className={`m-0 ${muted}`}>
            {o.customerDays > 0 ? `${days(o.customerDays)} of it ${o.customerDays === 1 ? 'is' : 'are'} from ${customer}'s changes or late decisions: shown in the app, not counted against you. ` : ''}
            {o.studioDays > 0 ? `${days(o.studioDays)} count${o.studioDays === 1 ? 's' : ''} against the studio` : 'Nothing counts against the studio'}
            {o.overrunDays > 0 ? `, ${days(o.overrunDays)} of that from the stage under way running past its date — move the date with a reason if it is not yours.` : '.'}
          </p>
        ) : (
          <p className={`m-0 ${muted}`}>Worked out from the plan, the ticks and the moved dates. Nobody types it.</p>
        )}
      </div>
      {onMove ? (
        <button type="button" className="s-btn min-h-[44px]" onClick={onMove}>
          Move a date
        </button>
      ) : null}
    </div>
  );
}

function Chip({ tone, children }: { tone: 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  const style =
    tone === 'good'
      ? { background: 'var(--s-good-wash)', color: 'var(--s-good)' }
      : tone === 'warn'
        ? { background: 'var(--s-warn-wash)', color: 'var(--s-warn)' }
        : { background: 'var(--s-bad-wash)', color: 'var(--s-bad)' };
  return (
    <span className="inline-flex min-h-[30px] items-center rounded-full px-3 text-[14px] font-semibold" style={style}>
      {children}
    </span>
  );
}

// ── One stage ──────────────────────────────────────────────────

/** What the customer's tracker says for this stage, in the app's own words. */
function customerLine(s: PlanStageView): { text: string; tone: string } {
  if (s.status === 'done') {
    const when = `Done ${dayWords(s.actualEnd!)}`;
    if (s.lateDays > 0) return { text: `${when} · ${days(s.lateDays)} late`, tone: 'var(--s-bad)' };
    if (s.earlyDays > 0) return { text: `${when} · ${days(s.earlyDays)} early`, tone: 'var(--s-good)' };
    return { text: `${when} · on time`, tone: 'var(--s-good)' };
  }
  if (s.status === 'late') return { text: `Now · ${days(s.lateDays)} late, was due ${dayWords(s.plannedEnd)}`, tone: 'var(--s-bad)' };
  if (s.status === 'on-track') return { text: `Now · on track, due ${dayWords(s.plannedEnd)}`, tone: 'var(--s-accent)' };
  return { text: s.state === 'next' ? 'Next' : 'Later', tone: 'var(--s-ink-3)' };
}

function StageRow({
  plan,
  stage: s,
  customer,
  onMove,
  say,
}: {
  plan: StudioPlan;
  stage: PlanStageView;
  customer: string;
  onMove: () => void;
  say: (r: PlanEditResult) => void;
}) {
  const [open, setOpen] = useState(s.state === 'now');
  const [renaming, setRenaming] = useState(false);
  const [pending, start] = useTransition();
  const line = customerLine(s);
  const moved = s.lastMove;
  const hasItems = s.completion.total > 0;

  const mark = (done: boolean) => {
    if (!done && !window.confirm(`Reopen ${s.name}? ${customer} will see it as not done again.`)) return;
    start(async () => say(await markStageDoneAction(plan.projectId, s.id, done)));
  };

  return (
    <li className="border-t border-[var(--s-rule)] py-3.5">
      <div className="grid gap-x-3 gap-y-1.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.4fr)] md:items-baseline">
        <div className="min-w-0">
          {renaming ? (
            <Rename plan={plan} stage={s} onDone={(r) => { setRenaming(false); if (r) say(r); }} />
          ) : (
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <span className="text-[15px] font-semibold">{s.name}</span>
              {plan.canEdit ? (
                <button type="button" onClick={() => setRenaming(true)} className="text-[12.5px] text-[var(--s-ink-3)] underline-offset-2 hover:text-[var(--s-accent)] hover:underline" aria-label={`Rename ${s.name}`}>
                  Rename
                </button>
              ) : null}
            </span>
          )}
          <span className={`block ${muted}`}>
            {hasItems ? `${s.completion.done} of ${s.completion.total} ticked` : 'No checklist'} · {s.photos} photo{s.photos === 1 ? '' : 's'}
          </span>
        </div>
        <span className="s-num font-[family-name:var(--font-mono)] text-[13px] text-[var(--s-ink-2)]">
          <span className="md:hidden">Planned </span>
          {dayWords(s.plannedStart)} – {dayWords(s.plannedEnd)}
          {s.originalEnd !== s.plannedEnd ? <span className={`block ${muted}`}>first {dayWords(s.originalEnd)}</span> : null}
        </span>
        <span className="s-num font-[family-name:var(--font-mono)] text-[13px] text-[var(--s-ink-2)]">
          <span className="md:hidden">{s.actualEnd ? 'Done ' : 'Forecast '}</span>
          {s.actualEnd ? dayWords(s.actualEnd) : dayWords(s.forecastEnd)}
          {!s.actualEnd ? <span className={`block ${muted}`}>forecast</span> : null}
        </span>
        <span className="text-[13.5px]">
          <span className="font-medium" style={{ color: line.tone }}>
            {line.text}
          </span>
          {moved ? (
            <span className={`block ${muted}`}>
              Moved {dayWords(moved.from)} → {dayWords(moved.to)}: {reasonWords(moved)}
              {isCustomerDelay(moved) ? ` · ${customer}'s, not counted against you` : ''}
            </span>
          ) : null}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {hasItems ? (
          <button type="button" className="s-btn-ghost min-h-[40px]" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide checklist' : `Show checklist (${s.completion.open} open)`}
          </button>
        ) : null}
        {plan.canEdit && s.state !== 'done' ? (
          <button type="button" className="s-btn-ghost min-h-[40px]" onClick={onMove}>
            Move a date
          </button>
        ) : null}
        {plan.canTick && s.state !== 'done' && (!hasItems || s.completion.complete) ? (
          s.gate.ok ? (
            <button type="button" className="s-btn min-h-[40px]" disabled={pending} onClick={() => mark(true)}>
              {pending ? 'Saving…' : 'Mark done'}
            </button>
          ) : (
            <span className="text-[13px] text-[var(--s-warn)]">{gateWords(s.gate)}</span>
          )
        ) : null}
        {plan.canTick && s.state === 'done' ? (
          <button type="button" className="s-btn-ghost min-h-[40px]" disabled={pending} onClick={() => mark(false)}>
            Reopen
          </button>
        ) : null}
      </div>

      {open && hasItems ? <Checklist plan={plan} stage={s} say={say} /> : null}
    </li>
  );
}

function Rename({ plan, stage, onDone }: { plan: StudioPlan; stage: PlanStageView; onDone: (r: PlanEditResult | null) => void }) {
  const [name, setName] = useState(stage.name);
  const [pending, start] = useTransition();
  const save = () => start(async () => onDone(await renameStageAction(plan.projectId, stage.id, name)));
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor={`rename-${stage.id}`} className="sr-only">
        New name for {stage.name}
      </label>
      <input
        id={`rename-${stage.id}`}
        autoFocus
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone(null)}
        className="min-h-[40px] w-[220px] rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[14.5px]"
      />
      <button type="submit" className="s-btn min-h-[40px]" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="s-btn-ghost min-h-[40px]" onClick={() => onDone(null)}>
        Cancel
      </button>
    </form>
  );
}

// ── The checklist ──────────────────────────────────────────────

function Checklist({ plan, stage, say }: { plan: StudioPlan; stage: PlanStageView; say: (r: PlanEditResult) => void }) {
  /* Ticks show at once; a refusal puts the box back and says why. */
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const [, start] = useTransition();
  const toggle = (id: string, next: boolean) => {
    setLocal((m) => ({ ...m, [id]: next }));
    start(async () => {
      const r = await tickItemAction(plan.projectId, id, next);
      if (!r.ok) setLocal((m) => ({ ...m, [id]: !next }));
      say(r);
    });
  };
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {stage.rooms.map((room) => (
        <div key={room.room} className="rounded-[10px] bg-[var(--s-surface-2)] p-3">
          <p className="m-0 mb-1.5 text-[12.5px] font-semibold text-[var(--s-ink-2)]">{room.room}</p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {room.items.map((it) => {
              const done = local[it.id] ?? it.done;
              const box = (
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-[6px] border text-[12px] font-bold"
                  style={done ? { background: 'var(--s-accent)', borderColor: 'var(--s-accent)', color: '#fff' } : { borderColor: 'var(--s-ink-3)', background: 'var(--s-surface)' }}
                >
                  {done ? '✓' : ''}
                </span>
              );
              const text = (
                <span className="min-w-0 flex-1 text-left">
                  <span className={done ? 'text-[var(--s-ink-3)]' : undefined}>{it.label}</span>
                  {done && it.doneOn ? <span className={`ml-1.5 ${muted}`}>{dayWords(it.doneOn)}</span> : null}
                  {it.fromVoice ? <span className={`ml-1.5 ${muted}`}>· from a voice note</span> : null}
                </span>
              );
              return (
                <li key={it.id}>
                  {plan.canTick ? (
                    <button
                      type="button"
                      aria-pressed={done}
                      onClick={() => toggle(it.id, !done)}
                      className="flex min-h-[40px] w-full items-center gap-2.5 rounded-[8px] px-1.5 text-[14px] hover:bg-[var(--s-surface)]"
                    >
                      {box}
                      {text}
                    </button>
                  ) : (
                    <span className="flex min-h-[36px] items-center gap-2.5 px-1.5 text-[14px]">
                      {box}
                      {text}
                      <span className="sr-only">{done ? '(done)' : '(open)'}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Moved dates ────────────────────────────────────────────────

function Moves({ plan, customer }: { plan: StudioPlan; customer: string }) {
  return (
    <div className="s-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[16px] font-semibold">Moved dates</h2>
        <CustomerSees name={customer} />
      </div>
      <p className={`m-0 mt-1 ${muted}`}>Kept for good: a move is never edited or deleted. Move it again to change it.</p>
      <ul className="m-0 mt-3 flex list-none flex-col p-0">
        {plan.moves.map((m) => (
          <li key={m.at} className="grid gap-1 border-t border-[var(--s-rule)] py-3 text-[14px] sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
            <span className="s-num font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--s-ink-3)]">{dayWords(istDay(new Date(m.at)))}</span>
            <span className="flex flex-col gap-1.5">
              <span>
                {m.words}
                {m.customer ? <span className={`ml-1.5 ${muted}`}>· {customer}&rsquo;s delay, not counted against you</span> : null}
              </span>
              {m.note ? (
                <OnlyYourTeam>
                  <span className="text-[13px] text-[var(--s-ink-2)]">{m.note}</span>
                </OnlyYourTeam>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Move a date ────────────────────────────────────────────────

type Choice = DelayReason | 'DECISION';

const choices = (c: string): { key: Choice; label: string; help: string }[] => [
  { key: 'SUPPLIER', label: 'Supplier delay', help: 'Material or a vendor came late. Counts as your delay.' },
  { key: 'CUSTOMER_CHANGE', label: `${c} asked for a change`, help: `Shown to ${c}, not counted against you.` },
  { key: 'DECISION', label: `Waiting on ${c}'s decision`, help: 'A decision not made in time. Not counted against you.' },
  { key: 'SITE_CONDITION', label: 'Site condition', help: 'Something on site needed extra work. Counts as your delay.' },
  { key: 'STUDIO', label: 'Our delay', help: 'Counts as your delay.' },
  { key: 'OTHER', label: 'Other', help: `Counts as your delay. ${c} reads a general line; your note stays with your team.` },
];

function MoveDialog({
  plan,
  customer,
  initialStage,
  onClose,
  say,
}: {
  plan: StudioPlan;
  customer: string;
  initialStage: string;
  onClose: () => void;
  say: (r: PlanEditResult) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = plan.stages.filter((s) => s.state !== 'done');
  const [stageId, setStageId] = useState(open.some((s) => s.id === initialStage) ? initialStage : (open[0]?.id ?? initialStage));
  const stage = plan.stages.find((s) => s.id === stageId)!;
  const [field, setField] = useState<'PLANNED_START' | 'PLANNED_END'>('PLANNED_END');
  const [to, setTo] = useState(stage.plannedEnd);
  const [choice, setChoice] = useState<Choice | null>(null);
  const waiting = plan.decisions.filter((d) => !d.picked);
  const [decisionId, setDecisionId] = useState(waiting[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [shiftLater, setShiftLater] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const pickStage = (id: string) => {
    const s = plan.stages.find((x) => x.id === id)!;
    setStageId(id);
    setTo(field === 'PLANNED_START' ? s.plannedStart : s.plannedEnd);
    setConfirming(false);
  };
  const pickField = (f: 'PLANNED_START' | 'PLANNED_END') => {
    setField(f);
    setTo(f === 'PLANNED_START' ? stage.plannedStart : stage.plannedEnd);
    setConfirming(false);
  };

  const cal = useMemo(() => calendarOf({ workingDays: plan.calendar.workingDays, holidays: plan.calendar.holidays }), [plan.calendar]);
  const reason: DelayReason | null = choice === 'DECISION' ? 'CUSTOMER_CHANGE' : choice;
  const linked = choice === 'DECISION' && decisionId ? decisionId : null;
  const rules: RuleStage[] = plan.stages.map((s) => ({ id: s.id, kind: s.kind, name: s.name, plannedStart: s.plannedStart, plannedEnd: s.plannedEnd, actualEnd: s.actualEnd }));
  const result = planMove(rules, { stageId, field, to, reason: reason ?? 'OTHER', shiftLater: field === 'PLANNED_END' && shiftLater });

  const preview = (() => {
    if (!result.ok || !reason) return null;
    const rows = result.plan.rows;
    const lead = rows[0]!;
    const hand = rows.find((r, i) => i > 0 && r.field === 'HANDOVER');
    const sentence = moveSentence({ stageName: stage.name, field: lead.field, from: lead.from, to: lead.to, reason, decisionId: linked, handoverTo: hand?.to ?? null });
    const next = new Map(result.plan.stages.map((s) => [s.stageId, s]));
    const after: RuleStage[] = rules.map((r) => {
      const n = next.get(r.id);
      return n ? { ...r, plannedStart: n.plannedStart, plannedEnd: n.plannedEnd } : r;
    });
    const at = new Date();
    const changes: RuleChange[] = [...plan.changes, ...rows.map((r) => ({ ...r, reason, decisionId: linked, at }))];
    return { sentence, overall: overallDelay(after, changes, plan.today, cal), later: result.plan.stages.length - 1 };
  })();

  const shift = daysBetween(field === 'PLANNED_START' ? stage.plannedStart : stage.plannedEnd, to);

  const close = () => {
    ref.current?.close();
    onClose();
  };

  const review = () => {
    setError(null);
    if (!choice) return setError('Pick why the date is moving. It decides whose delay it is.');
    if (choice === 'DECISION' && !decisionId) return setError('Pick which decision is late.');
    if (!result.ok) return setError(result.error);
    setConfirming(true);
  };

  const save = () =>
    start(async () => {
      const r = await moveDateAction({
        projectId: plan.projectId,
        stageId,
        field,
        to,
        reason: reason ?? '',
        decisionId: linked,
        note,
        shiftLater: field === 'PLANNED_END' && shiftLater,
      });
      if (r.ok) {
        say(r);
        close();
      } else {
        setConfirming(false);
        setError(r.error);
      }
    });

  const label = 'mb-1.5 block text-[13px] font-semibold text-[var(--s-ink-2)]';
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="move-title"
      className="m-auto w-[min(640px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-y-auto rounded-[16px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-0 text-[var(--s-ink)] shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="move-title" className="m-0 text-[19px] font-semibold">
            Move a date
          </h2>
          <button type="button" onClick={close} className="s-btn-ghost min-h-[40px]" aria-label="Close without moving">
            Close
          </button>
        </div>

        {confirming && preview ? (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-[16px] leading-relaxed">
              Move {stage.name}&rsquo;s {field === 'PLANNED_START' ? 'start' : 'end'} from{' '}
              <b>{dayWords(field === 'PLANNED_START' ? stage.plannedStart : stage.plannedEnd)}</b> to <b>{dayWords(to)}</b>
              {preview.later > 0 ? `, and ${preview.later} later stage${preview.later === 1 ? '' : 's'} with it` : ''}?
            </p>
            <Preview customer={customer} sentence={preview.sentence} overall={preview.overall} />
            <p className={`m-0 ${muted}`}>{customer}&rsquo;s app changes straight away. The old date stays in the history; nothing is overwritten.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="s-btn min-h-[48px] px-6 text-[15px]" disabled={pending} onClick={save} autoFocus>
                {pending ? 'Moving…' : 'Yes, move it'}
              </button>
              <button type="button" className="s-btn-ghost min-h-[48px]" disabled={pending} onClick={() => setConfirming(false)}>
                Go back
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="move-stage" className={label}>
                  Stage
                </label>
                <select
                  id="move-stage"
                  value={stageId}
                  onChange={(e) => pickStage(e.target.value)}
                  className="min-h-[44px] w-full rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[15px]"
                >
                  {open.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="m-0 border-0 p-0">
                <legend className={label}>Which date</legend>
                <div className="flex gap-2">
                  {(['PLANNED_END', 'PLANNED_START'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={field === f}
                      onClick={() => pickField(f)}
                      className="min-h-[44px] flex-1 rounded-[8px] border px-3 text-[14.5px] font-medium"
                      style={field === f ? { borderColor: 'var(--s-accent)', background: 'var(--s-accent-wash)', color: 'var(--s-accent)' } : { borderColor: 'var(--s-rule)' }}
                    >
                      {f === 'PLANNED_END' ? (stage.kind === 'HANDOVER' ? 'Handover day' : 'Ends') : 'Starts'}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div>
              <label htmlFor="move-to" className={label}>
                New date{' '}
                <span className="font-normal text-[var(--s-ink-3)]">
                  (now {dayWords(field === 'PLANNED_START' ? stage.plannedStart : stage.plannedEnd)}
                  {shift !== 0 ? `, ${shift > 0 ? `${days(shift)} later` : `${days(-shift)} earlier`}` : ''})
                </span>
              </label>
              <input
                id="move-to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setError(null);
                }}
                className="min-h-[44px] w-full rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[15px] sm:w-[240px]"
              />
            </div>

            <fieldset className="m-0 border-0 p-0">
              <legend className={label}>Why is it moving?</legend>
              <div role="radiogroup" aria-label="Why is it moving?" className="grid gap-2 sm:grid-cols-2">
                {choices(customer).filter((c) => c.key !== 'DECISION' || waiting.length > 0).map((c) => {
                  const on = choice === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setChoice(c.key);
                        setError(null);
                      }}
                      className="flex min-h-[56px] flex-col items-start justify-center rounded-[10px] border px-3 py-2 text-left"
                      style={on ? { borderColor: 'var(--s-accent)', background: 'var(--s-accent-wash)', boxShadow: 'inset 0 0 0 1px var(--s-accent)' } : { borderColor: 'var(--s-rule)' }}
                    >
                      <span className="text-[14.5px] font-semibold">{c.label}</span>
                      <span className="text-[12.5px] text-[var(--s-ink-3)]">{c.help}</span>
                    </button>
                  );
                })}
              </div>
              {choice === 'DECISION' ? (
                <div className="mt-3">
                  <label htmlFor="move-decision" className={label}>
                    Which decision
                  </label>
                  <select
                    id="move-decision"
                    value={decisionId}
                    onChange={(e) => setDecisionId(e.target.value)}
                    className="min-h-[44px] w-full rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[15px]"
                  >
                    {waiting.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} · due {dayWords(d.dueOn)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </fieldset>

            {field === 'PLANNED_END' && open.findIndex((s) => s.id === stageId) < open.length - 1 ? (
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[14.5px]">
                <input type="checkbox" checked={shiftLater} onChange={(e) => setShiftLater(e.target.checked)} className="h-5 w-5 accent-[var(--s-accent)]" />
                Move the later stages by the same number of days
              </label>
            ) : null}

            <OnlyYourTeam title="Only your team · a note on why (optional)">
              <label htmlFor="move-note" className="sr-only">
                A note for your team
              </label>
              <textarea
                id="move-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Laminate batch held at the depot. Never shown to the customer."
                className="w-full resize-y rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[13.5px]"
              />
            </OnlyYourTeam>

            {preview ? (
              <Preview customer={customer} sentence={preview.sentence} overall={preview.overall} />
            ) : (
              <p className={`m-0 rounded-[10px] border border-dashed border-[var(--s-rule)] p-3 ${muted}`}>
                {result.ok ? `Pick why it is moving to see exactly what ${customer} will read.` : result.error}
              </p>
            )}

            {error ? (
              <p role="alert" className="m-0 text-[14px] font-medium text-[var(--s-bad)]">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="s-btn min-h-[48px] px-6 text-[15px]" onClick={review}>
                Review the move
              </button>
              <button type="button" className="s-btn-ghost min-h-[48px]" onClick={close}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

function Preview({ customer, sentence, overall }: { customer: string; sentence: string; overall: ReturnType<typeof overallDelay> }) {
  const line = overall.lateDays > 0 ? `Overall · ${days(overall.lateDays)} late` : overall.earlyDays > 0 ? `Overall · ${days(overall.earlyDays)} early` : 'Overall · on time';
  return (
    <div className="flex flex-col gap-2 rounded-[12px] p-4 text-white" style={{ background: 'var(--s-accent-deep)' }}>
      <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70">{customer} will read</p>
      <p className="m-0 text-[15.5px] leading-snug">{sentence}</p>
      <p className="m-0 text-[13.5px] text-white/80">
        {line}
        {overall.customerDays > 0 ?  ` · ${days(overall.customerDays)} from ${customer}'s side, labelled as such` : ''}
      </p>
    </div>
  );
}
