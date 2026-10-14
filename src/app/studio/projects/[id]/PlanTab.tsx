'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { StudioPlan, PlanStageView, PlanStepView, PlanEditResult } from '@/modules/project/plan-edit';
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
import { doneLabel, parsePercent } from '@/modules/project/step-rules';
import { CustomerSees, OnlyYourTeam } from '../marks';
import { MilestoneCount, STAR_HINT, StarToggle } from './StarToggle';
import { newClientRef, uploadFile } from '../../site/lib/queue';
import { readyPhoto, type ReadyPhoto } from '../../site/lib/photo';
import {
  addStepAction,
  markStageDoneAction,
  moveDateAction,
  removeStepAction,
  renameStageAction,
  renameStepAction,
  reweightStepAction,
  scopeStepAction,
  untickStepAction,
} from './plan-actions';

/**
 * The Plan tab (studio workspace Phase 3 and the step tracker, design
 * StudioProject.dc.html; docs/studio-workspace/STEP-TRACKER.md): the
 * project's percentage done, every stage planned against actual or forecast
 * with its own percentage and what the customer sees for it, each stage's
 * steps group by group with their share of the project, and "Move a date"
 * with a reason and a preview of exactly what the customer will read before
 * anything is saved.
 *
 * One obvious action per place: tick a step (with a photo and a sentence,
 * posted to today's site log), move a date, mark a stage done. The owner or
 * PM also edits steps: name, weight, in or out of scope, add, remove, untick.
 * Nothing here is typed by hand for the customer's tracker: statuses and
 * percentages come from project-rules.ts and step-rules.ts, the same rules
 * the customer's app reads.
 */

type Toast = { ok: boolean; text: string } | null;

const muted = 'text-[12.5px] text-[var(--muted)]';
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

      <div className="card flush">
        <div className="chead">
          <div className="flex flex-col gap-[3px]">
            <h2>Plan</h2>
            <span className="muted sm">
              Hauspire&rsquo;s steps, each worth a share of the project. A stage finishes when its last step in scope is ticked, each with its photo.
            </span>
          </div>
          {/* The client sees the stages and only the starred steps; the rest stays with the team. */}
          <span className="sees">{customer} sees the stages and ★ steps only</span>
        </div>
        <div className="oi-prow oi-prow-h">
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
            style={toast.ok ? { background: 'var(--ink)', color: 'var(--paper)' } : { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad)' }}
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
    <div className="card oi-overall">
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="lbl">Project done</span>
          <span className="mono text-[22px] font-semibold">{plan.progressPct}%</span>
        </div>
        <Bar pct={plan.progressPct} label={`Project ${plan.progressPct}% done`} />
        <span className={muted}>From the steps ticked, each by its share. {customer} sees this percentage go up as steps are ticked.</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap gap-2">

          <Chip tone={c?.status === 'late' ? 'bad' : 'good'}>{stageLine}</Chip>
          <Chip tone={o.studioDays > 0 ? 'bad' : o.lateDays > 0 ? 'warn' : 'good'}>{overallLine}</Chip>
        </div>
        {o.plannedHandover && o.forecastHandover ? (
          <p className="m-0 mt-1 text-[13.5px] text-[var(--text2)]">
            Handover planned <b className="mono font-medium">{dayWords(o.plannedHandover)}</b>
            {o.forecastHandover !== o.plannedHandover ? (
              <>
                , {o.handedOver ? 'done' : 'now expected'} <b className="mono font-medium">{dayWords(o.forecastHandover)}</b>
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
        <button type="button" className="btn ghost" onClick={onMove}>
          Move a date
        </button>
      ) : null}
    </div>
  );
}

function Chip({ tone, children }: { tone: 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  return (
    <span className={`chip ${tone}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

// ── One stage ──────────────────────────────────────────────────

/** What the customer's tracker says for this stage, in the app's own words. */
function customerLine(s: PlanStageView): { text: string; tone: string } {
  if (s.status === 'done') {
    const when = `Done ${dayWords(s.actualEnd!)}`;
    if (s.lateDays > 0) return { text: `${when} · ${days(s.lateDays)} late`, tone: 'var(--bad)' };
    if (s.earlyDays > 0) return { text: `${when} · ${days(s.earlyDays)} early`, tone: 'var(--good)' };
    return { text: `${when} · on time`, tone: 'var(--good)' };
  }
  if (s.status === 'late') return { text: `Now · ${days(s.lateDays)} late, was due ${dayWords(s.plannedEnd)}`, tone: 'var(--bad)' };
  if (s.status === 'on-track') return { text: `Now · on track, due ${dayWords(s.plannedEnd)}`, tone: 'var(--good)' };
  return { text: s.state === 'next' ? 'Next' : 'Later', tone: 'var(--muted)' };
}

/** A thin progress bar: only ever goes up. */
function Bar({ pct, label }: { pct: number; label: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} className="pbar block w-full">
      <i style={{ width: `${v}%`, background: v >= 100 ? 'var(--good-s)' : 'var(--ink)' }} />
    </span>
  );
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
  const hasSteps = s.groups.some((g) => g.steps.length > 0);
  const pct = s.progressPct ?? (s.state === 'done' ? 100 : 0);

  const mark = (done: boolean) => {
    if (!done && !window.confirm(`Reopen ${s.name}? ${customer} will see it as not done again.`)) return;
    start(async () => say(await markStageDoneAction(plan.projectId, s.id, done)));
  };

  return (
    <li className={`oi-stage${s.state === 'now' ? ' now' : ''}`}>
      <div className="oi-prow">
        <div className="min-w-0">
          {renaming ? (
            <Rename plan={plan} stage={s} onDone={(r) => { setRenaming(false); if (r) say(r); }} />
          ) : (
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <span className="text-[14.5px] font-semibold">{s.name}</span>
              {plan.canEdit ? (
                <button type="button" onClick={() => setRenaming(true)} className="text-[12.5px] text-[var(--muted)] underline-offset-2 hover:text-[var(--acc)] hover:underline" aria-label={`Rename ${s.name}`}>
                  Rename
                </button>
              ) : null}
            </span>
          )}
          <span className="mt-1.5 flex items-center gap-2">
            <span className="w-[120px] flex-none">
              <Bar pct={pct} label={`${s.name}: ${pct}% done`} />
            </span>
            <span className="mono text-[13px] font-semibold">{pct}%</span>
          </span>
          <span className={`block ${muted}`}>
            {s.completion.total ? `${s.completion.done} of ${s.completion.total} steps ticked` : 'No step in scope'} · {s.sharePct}% of the project · {s.photos} photo
            {s.photos === 1 ? '' : 's'}
          </span>
          {hasSteps ? (
            <span className="mt-0.5 block">
              <MilestoneCount n={s.milestones} />
            </span>
          ) : null}
        </div>
        <span className="mono text-[13px] text-[var(--text2)]">
          <span className="md:hidden">Planned </span>
          {dayWords(s.plannedStart)} – {dayWords(s.plannedEnd)}
          {s.originalEnd !== s.plannedEnd ? <span className={`block ${muted}`}>first {dayWords(s.originalEnd)}</span> : null}
        </span>
        <span className="mono text-[13px] text-[var(--text2)]">
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

      <div className="oi-stage-acts">
        {hasSteps ? (
          <button type="button" className="btn ghost sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide steps' : s.completion.open ? `Show steps (${s.completion.open} to do)` : 'Show steps'}
          </button>
        ) : null}
        {plan.canEdit && s.state !== 'done' ? (
          <button type="button" className="btn ghost sm" onClick={onMove}>
            Move a date
          </button>
        ) : null}
        {plan.canTick && s.state !== 'done' && (s.completion.total === 0 || s.completion.complete) ? (
          s.gate.ok ? (
            <button type="button" className="btn pri sm" disabled={pending} onClick={() => mark(true)}>
              {pending ? 'Saving…' : 'Mark done'}
            </button>
          ) : (
            <span className="text-[13px] text-[var(--warn)]">{gateWords(s.gate)}</span>
          )
        ) : null}
        {plan.canTick && s.state === 'done' ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => mark(false)}>
            Reopen
          </button>
        ) : null}
      </div>

      {open && hasSteps ? <Steps plan={plan} stage={s} customer={customer} say={say} /> : null}
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
        className="min-h-[40px] w-[220px] rounded-[8px] border border-[var(--fill2)] bg-[var(--paper)] px-3 text-[14.5px]"
      />
      <button type="submit" className="btn pri sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="btn ghost sm" onClick={() => onDone(null)}>
        Cancel
      </button>
    </form>
  );
}

// ── The steps ──────────────────────────────────────────────────

const field = 'min-h-[40px] rounded-[8px] border border-[var(--fill2)] bg-[var(--paper)] px-3 text-[14.5px]';

/**
 * A stage's steps, group by group. One obvious action per step: "Tick with
 * a photo" while it is open, "Untick" once it is done (owner or PM: a
 * correction), and "Edit" for the owner or PM (name, weight, scope, remove).
 */
function Steps({ plan, stage, customer, say }: { plan: StudioPlan; stage: PlanStageView; customer: string; say: (r: PlanEditResult) => void }) {
  const [ticking, setTicking] = useState<PlanStepView | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Studio OS Phase 2: design steps are ticked on the Design tab (payment gates, files), never with a site photo.
  const design = stage.kind === 'DESIGN';
  const canTick = plan.canTick && plan.canPost && !design;

  const untick = (st: PlanStepView) => {
    if (!window.confirm(`Untick “${st.label}”? ${customer}'s percentage goes back down. The photo stays in the site log.`)) return;
    start(async () => say(await untickStepAction(plan.projectId, st.id)));
  };

  return (
    <div className="oi-steps">
      <p className={`m-0 ${muted}`}>
        <span className="sees">★ {STAR_HINT}</span> {customer} sees each stage&rsquo;s % from every step, and only the starred ones by name.{' '}
        A step is ticked with a photo and a sentence: both go into today&rsquo;s site log. Each % is the step&rsquo;s share of the whole project.
        {plan.canEdit ? ` Weights in scope add up to ${plan.weightTotalPct}%; every share is worked out again so the project always totals 100%.` : ''}
      </p>
      {design ? (
        <p className={`m-0 ${muted}`}>
          Design steps are ticked on the{' '}
          <Link href={`/studio/projects/${plan.projectId}?tab=design`} className="acc-t">
            Design tab
          </Link>
          , with their files and payment gates.
        </p>
      ) : null}
      {stage.groups.map((g) => (
        <div key={g.group} className="flex flex-col">
          <p className="m-0 py-1.5 text-[13px] font-semibold text-[var(--muted)]">{g.group}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {g.steps.map((st) =>
              editing === st.id ? (
                <StepEditor key={st.id} plan={plan} step={st} customer={customer} onDone={(r) => { setEditing(null); if (r) say(r); }} />
              ) : (
                <StepRow
                  key={st.id}
                  plan={plan}
                  step={st}
                  customer={customer}
                  busy={pending}
                  say={say}
                  onTick={canTick ? () => setTicking(st) : null}
                  onUntick={plan.canEdit ? () => untick(st) : null}
                  onEdit={plan.canEdit ? () => setEditing(st.id) : null}
                />
              ),
            )}
          </ul>
          {plan.canEdit ? (
            adding === g.group ? (
              <AddStep plan={plan} stageId={stage.id} group={g.group} onDone={(r) => { setAdding(null); if (r) say(r); }} />
            ) : (
              <button type="button" onClick={() => setAdding(g.group)} className="btn ghost sm mt-1.5 self-start">
                + Add a step to {g.group}
              </button>
            )
          ) : null}
        </div>
      ))}
      {ticking ? <TickDialog plan={plan} step={ticking} customer={customer} onClose={() => setTicking(null)} say={say} /> : null}
    </div>
  );
}

function StepRow({
  plan,
  step: st,
  customer,
  busy,
  say,
  onTick,
  onUntick,
  onEdit,
}: {
  plan: StudioPlan;
  step: PlanStepView;
  customer: string;
  busy: boolean;
  say: (r: PlanEditResult) => void;
  onTick: (() => void) | null;
  onUntick: (() => void) | null;
  onEdit: (() => void) | null;
}) {
  const how = st.hasPhoto ? 'photo in the site log' : st.backfilled ? 'done with its stage, no photo' : st.fromVoice ? 'from a voice note' : null;
  const meta = !st.inScope
    ? `Not in scope · ${customer} does not see it`
    : st.done
      ? `Done ${st.doneOn ? dayWords(st.doneOn) : ''}${how ? ` · ${how}` : ''}`
      : st.plannedOn
        ? `Planned ${dayWords(st.plannedOn)}`
        : 'Open';
  return (
    <li className="oi-ci">
      <StarToggle projectId={plan.projectId} stepId={st.id} label={st.label} starred={st.milestone} canEdit={plan.canEdit} say={say} />
      <span
        aria-hidden="true"
        className="oi-box"
        style={st.done ? { background: 'var(--good-s)' } : { boxShadow: `inset 0 0 0 1.5px ${st.inScope ? 'var(--ring)' : 'var(--line)'}`, opacity: st.inScope ? 1 : 0.6 }}
      >
        {st.done ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1 basis-[220px]">
        <span className={`block text-[14px] ${st.done || !st.inScope ? 'text-[var(--muted)]' : ''} ${!st.inScope ? 'line-through' : ''}`}>
          {st.label}
          <span className="sr-only">{st.done ? ' (done)' : st.inScope ? ' (open)' : ' (not in scope)'}</span>
        </span>
        <span className={`block ${muted}`}>{meta}</span>
      </span>
      <span className="tabular-nums w-[52px] flex-none text-right mono text-[13px] text-[var(--text2)]" title="Its share of the whole project">
        {st.inScope ? `${st.effectivePct}%` : '—'}
      </span>
      <span className="flex flex-none flex-wrap items-center gap-1.5">
        {!st.done && st.inScope && onTick ? (
          <button type="button" className="btn sec sm" disabled={busy} onClick={onTick}>
            Tick with a photo
          </button>
        ) : null}
        {st.done && onUntick ? (
          <button type="button" className="btn ghost sm" disabled={busy} onClick={onUntick}>
            Untick
          </button>
        ) : null}
        {onEdit ? (
          <button type="button" className="btn ghost sm" disabled={busy} onClick={onEdit} aria-label={`Edit ${st.label}`}>
            Edit
          </button>
        ) : null}
      </span>
    </li>
  );
}

/** Owner or PM: the step's name, its weight, whether it is in scope; remove it if it was never ticked. Saves together. */
function StepEditor({ plan, step, customer, onDone }: { plan: StudioPlan; step: PlanStepView; customer: string; onDone: (r: PlanEditResult | null) => void }) {
  const [label, setLabel] = useState(step.label);
  const [weight, setWeight] = useState(String(step.weightPct));
  const [inScope, setInScope] = useState(step.inScope);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const typed = parsePercent(weight);

  const save = () =>
    start(async () => {
      setError(null);
      const said: string[] = [];
      const run = async (r: PlanEditResult) => {
        if (!r.ok) throw new Error(r.error);
        if (r.message !== 'No change.') said.push(r.message);
      };
      try {
        if (label.trim() !== step.label) await run(await renameStepAction(plan.projectId, step.id, label));
        if (typed === null) throw new Error('Type a percentage from 0 to 100, like 4 or 0.5.');
        if (typed !== step.weightBp) await run(await reweightStepAction(plan.projectId, step.id, weight));
        if (inScope !== step.inScope) await run(await scopeStepAction(plan.projectId, step.id, inScope));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That did not save. Try again.');
        return;
      }
      onDone(said.length ? { ok: true, message: said.join(' ') } : null);
    });

  const remove = () => {
    if (!window.confirm(`Remove “${step.label}” from the plan?${step.milestone ? ` ${customer} stops seeing it.` : ''} Its weight is shared across the other steps.`)) return;
    start(async () => {
      const r = await removeStepAction(plan.projectId, step.id);
      if (r.ok) onDone(r);
      else setError(r.error);
    });
  };

  return (
    <li className="rounded-[10px] border border-[var(--acc)] bg-[var(--paper)] p-3">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-[var(--text2)]">
          Step name{step.milestone ? ` (starred: ${customer} sees this)` : ''}
          <input value={label} maxLength={120} autoFocus onChange={(e) => setLabel(e.target.value)} className={`${field} font-normal text-[var(--ink)]`} />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-[var(--text2)]">
          Weight, % of the project
          <span className="flex flex-wrap items-center gap-2 font-normal">
            <input value={weight} inputMode="decimal" onChange={(e) => setWeight(e.target.value)} className={`${field} w-[90px] text-[var(--ink)]`} aria-invalid={typed === null} />
            <span className={muted}>
              {typed === null ? 'Type a number from 0 to 100, like 4 or 0.5.' : `Counts for ${step.effectivePct}% now. In-scope weights add up to ${plan.weightTotalPct}%; shares are worked out so the project totals 100%.`}
            </span>
          </span>
        </label>
        <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-[14px]">
          <input type="checkbox" checked={inScope} disabled={step.done && step.inScope} onChange={(e) => setInScope(e.target.checked)} className="h-5 w-5 accent-[var(--acc)]" />
          In scope for this home
          {step.done && step.inScope ? <span className={muted}>· ticked, so it stays in scope (untick it first)</span> : null}
        </label>
        {!inScope && step.inScope ? <p className={`m-0 ${muted}`}>Not in scope: its weight is shared across the other steps{step.milestone ? `, and ${customer} stops seeing it` : ''}.</p> : null}
        {error ? (
          <p role="alert" className="m-0 text-[13.5px] font-medium text-[var(--bad)]">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn pri sm" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => onDone(null)}>
            Cancel
          </button>
          {!step.done ? (
            <button type="button" className="ml-auto min-h-[40px] px-2 text-[13px] text-[var(--bad)] underline-offset-2 hover:underline" disabled={pending} onClick={remove}>
              Remove step
            </button>
          ) : null}
        </div>
      </form>
    </li>
  );
}

function AddStep({ plan, stageId, group, onDone }: { plan: StudioPlan; stageId: string; group: string; onDone: (r: PlanEditResult | null) => void }) {
  const [label, setLabel] = useState('');
  const [weight, setWeight] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await addStepAction(plan.projectId, { stageId, group, label, percent: weight });
      if (r.ok) onDone(r);
      else setError(r.error);
    });
  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-[10px] border border-[var(--acc)] bg-[var(--paper)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="m-0 text-[13px] font-semibold">New step in {group}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12.5px] text-[var(--text2)]">
          Name
          <input value={label} maxLength={120} autoFocus onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Kitchen backsplash tiles fixed" className={`${field} text-[var(--ink)]`} />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-[var(--text2)]">
          Weight, %
          <input value={weight} inputMode="decimal" onChange={(e) => setWeight(e.target.value)} className={`${field} w-[90px] text-[var(--ink)]`} />
        </label>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[13.5px] font-medium text-[var(--bad)]">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className="btn pri sm" disabled={pending}>
          {pending ? 'Adding…' : 'Add step'}
        </button>
        <button type="button" className="btn ghost sm" disabled={pending} onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Why the post route refused a tick, in plain words. */
function tickError(code: unknown): string {
  switch (code) {
    case 'sign_in':
      return 'You were signed out. Sign in again, then tick it.';
    case 'not_your_role':
    case 'not_yours':
      return 'Your role cannot post to this site log. Ask your studio owner.';
    case 'tick_photo':
      return 'Each tick needs its own photo with a sentence under it.';
    case 'items':
      return 'That step is not open on this plan any more. Reload the page.';
    case 'storage':
      return 'Photos cannot be stored right now. Try again in a minute.';
    case 'busy':
      return 'Someone posted to this site at the same moment. Try again.';
    case 'locked':
      return 'This step opens once its payment is recorded by accounts. Nothing was ticked.';
    default:
      return 'That did not post, and nothing was ticked. Try again.';
  }
}

/**
 * "Tick with a photo": the photo that shows the step done and one sentence
 * for the customer, previewed exactly as they will read it, then posted to
 * today's site log (an update, or added to today's if there is one) through
 * the same route site mode uses, which ticks the step.
 */
function TickDialog({ plan, step, customer, onClose, say }: { plan: StudioPlan; step: PlanStepView; customer: string; onClose: () => void; say: (r: PlanEditResult) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [photo, setPhoto] = useState<{ url: string; ready: ReadyPhoto } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'photo' | 'posting' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  const close = () => {
    ref.current?.close();
    onClose();
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy('photo');
    try {
      // From a laptop it is a picked file, never a camera capture: the customer sees "from gallery".
      const ready = await readyPhoto(file, true);
      setPhoto({ url: URL.createObjectURL(ready.blob), ready });
    } catch {
      setError('That photo could not be read. Pick another one.');
    }
    setBusy(null);
  };

  const sentence = text.replace(/\s+/g, ' ').trim();
  const post = async () => {
    if (!photo) return setError('Add the photo that shows it done.');
    if (sentence.length < 3) return setError(`Write one sentence for ${customer} about what was done.`);
    setError(null);
    setBusy('posting');
    try {
      const path = await uploadFile(plan.projectId, 'site', photo.ready.blob, photo.ready.type);
      const res = await fetch('/api/studio/site/post', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          projectId: plan.projectId,
          clientRef: newClientRef(),
          kind: 'UPDATE',
          postedAt: new Date().toISOString(),
          photos: [{ path, takenAt: photo.ready.takenAt, fromGallery: photo.ready.fromGallery, lat: null, lng: null, text: sentence }],
          voice: null,
          crew: [],
          ticks: [{ itemId: step.id, source: 'TICK', photoIndex: 0 }],
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; post?: { ticked?: number } };
      if (!res.ok || !json.ok) {
        setError(tickError(json.error));
        setBusy(null);
        return;
      }
      say(
        json.post?.ticked
          ? { ok: true, message: `Ticked: ${step.label}. The photo and your sentence are in today's site log, and ${customer} sees them now.` }
          : { ok: false, error: `The photo is in today's site log, but “${step.label}” was already ticked.` },
      );
      close();
      router.refresh();
    } catch {
      setError('That did not post: check the connection and try again. Nothing was ticked.');
      setBusy(null);
    }
  };

  const label = 'mb-1.5 block text-[13px] font-semibold text-[var(--text2)]';
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (busy !== 'posting') close();
      }}
      aria-labelledby="tick-title"
      className="m-auto w-[min(560px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-y-auto rounded-[16px] border bg-[var(--paper)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[rgba(var(--sh),0.38)]"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="tick-title" className="m-0 text-[19px] font-semibold">
              Add photo and what was done
            </h2>
            <p className={`m-0 mt-1 ${muted}`}>
              {step.label} · {step.effectivePct}% of the project
            </p>
          </div>
          <button type="button" onClick={close} disabled={busy === 'posting'} className="btn ghost sm" aria-label="Close without ticking">
            Close
          </button>
        </div>

        <div>
          <span className={label}>1 · The photo that shows it done</span>
          {photo ? (
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Photo for ${step.label}`} className="h-[120px] w-[160px] flex-none rounded-[10px] bg-[var(--fill)] object-cover" />
              <button type="button" className="btn ghost sm" disabled={busy !== null} onClick={() => input.current?.click()}>
                Change photo
              </button>
            </div>
          ) : (
            <button type="button" className="btn pri lg" disabled={busy !== null} onClick={() => input.current?.click()}>
              {busy === 'photo' ? 'Getting the photo ready…' : 'Choose a photo'}
            </button>
          )}
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />
        </div>

        <div>
          <label htmlFor="tick-text" className={label}>
            2 · One sentence for {customer}
          </label>
          <textarea
            id="tick-text"
            rows={2}
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. POP framing is up in the living room and both bedrooms."
            className="w-full resize-y rounded-[8px] border border-[var(--fill2)] bg-[var(--paper)] px-3 py-2 text-[14.5px]"
          />
          <span className={muted}>{300 - text.length} characters left</span>
        </div>

        <div className="oi-sees flex flex-col gap-2 p-4">
          <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] oi-im">{customer} will read, in the site feed</p>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="" className="max-h-[180px] w-full rounded-[8px] object-cover" />
          ) : null}
          <p className="m-0 text-[15.5px] font-semibold leading-snug">{doneLabel(step.label)}</p>
          <p className="m-0 text-[15px] leading-snug">{sentence || 'Your sentence shows here.'}</p>
          <p className="m-0 text-[12.5px] oi-im">Today, with the time you post it · from gallery</p>
        </div>

        {error ? (
          <p role="alert" className="m-0 text-[14px] font-medium text-[var(--bad)]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn pri lg" disabled={busy !== null} onClick={() => void post()}>
            {busy === 'posting' ? 'Posting…' : 'Tick and post'}
          </button>
          <button type="button" className="btn ghost lg" disabled={busy === 'posting'} onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ── Moved dates ────────────────────────────────────────────────

function Moves({ plan, customer }: { plan: StudioPlan; customer: string }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] font-semibold">Moved dates</h2>
        <CustomerSees name={customer} />
      </div>
      <p className={`m-0 mt-1 ${muted}`}>Kept for good: a move is never edited or deleted. Move it again to change it.</p>
      <ul className="m-0 mt-3 flex list-none flex-col p-0">
        {plan.moves.map((m) => (
          <li key={m.at} className="grid gap-1 border-t border-[var(--fill2)] py-3 text-[14px] sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
            <span className="mono text-[12.5px] text-[var(--muted)]">{dayWords(istDay(new Date(m.at)))}</span>
            <span className="flex flex-col gap-1.5">
              <span>
                {m.words}
                {m.customer ? <span className={`ml-1.5 ${muted}`}>· {customer}&rsquo;s delay, not counted against you</span> : null}
              </span>
              {m.note ? (
                <OnlyYourTeam>
                  <span className="text-[13px] text-[var(--text2)]">{m.note}</span>
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

  const label = 'mb-1.5 block text-[13px] font-semibold text-[var(--text2)]';
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="move-title"
      className="m-auto w-[min(640px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-y-auto rounded-[16px] border bg-[var(--paper)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[rgba(var(--sh),0.38)]"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="move-title" className="m-0 text-[19px] font-semibold">
            Move a date
          </h2>
          <button type="button" onClick={close} className="btn ghost sm" aria-label="Close without moving">
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
              <button type="button" className="btn pri lg" disabled={pending} onClick={save} autoFocus>
                {pending ? 'Moving…' : 'Yes, move it'}
              </button>
              <button type="button" className="btn ghost lg" disabled={pending} onClick={() => setConfirming(false)}>
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
                  className="min-h-[44px] w-full rounded-[8px] border border-[var(--fill2)] bg-[var(--paper)] px-3 text-[15px]"
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
                      style={field === f ? { borderColor: 'var(--acc)', background: 'var(--acc-soft)', color: 'var(--acc)' } : { borderColor: 'var(--fill2)' }}
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
                <span className="font-normal text-[var(--muted)]">
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
                className="min-h-[44px] w-full rounded-[8px] border border-[var(--fill2)] bg-[var(--paper)] px-3 text-[15px] sm:w-[240px]"
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
                      style={on ? { borderColor: 'var(--acc)', background: 'var(--acc-soft)', boxShadow: 'inset 0 0 0 1px var(--acc)' } : { borderColor: 'var(--fill2)' }}
                    >
                      <span className="text-[14.5px] font-semibold">{c.label}</span>
                      <span className="text-[12.5px] text-[var(--muted)]">{c.help}</span>
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
                    className="min-h-[44px] w-full rounded-[8px] border border-[var(--fill2)] bg-[var(--paper)] px-3 text-[15px]"
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
                <input type="checkbox" checked={shiftLater} onChange={(e) => setShiftLater(e.target.checked)} className="h-5 w-5 accent-[var(--acc)]" />
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
                className="w-full resize-y rounded-[8px] border border-[var(--fill2)] bg-[var(--paper)] px-3 py-2 text-[13.5px]"
              />
            </OnlyYourTeam>

            {preview ? (
              <Preview customer={customer} sentence={preview.sentence} overall={preview.overall} />
            ) : (
              <p className={`m-0 rounded-[10px] border border-dashed border-[var(--fill2)] p-3 ${muted}`}>
                {result.ok ? `Pick why it is moving to see exactly what ${customer} will read.` : result.error}
              </p>
            )}

            {error ? (
              <p role="alert" className="m-0 text-[14px] font-medium text-[var(--bad)]">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn pri lg" onClick={review}>
                Review the move
              </button>
              <button type="button" className="btn ghost lg" onClick={close}>
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
    <div className="oi-sees flex flex-col gap-2 p-4">
      <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] oi-im">{customer} will read</p>
      <p className="m-0 text-[15.5px] leading-snug">{sentence}</p>
      <p className="m-0 text-[13.5px] oi-im">
        {line}
        {overall.customerDays > 0 ?  ` · ${days(overall.customerDays)} from ${customer}'s side, labelled as such` : ''}
      </p>
    </div>
  );
}
