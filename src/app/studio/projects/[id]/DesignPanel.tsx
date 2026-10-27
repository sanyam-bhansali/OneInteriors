'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { DesignStepView, DesignTab, FinalView } from '@/modules/studio-design/store';
import type { DocType } from '@/modules/studio-design/documents';
import { UploadDocument } from './UploadDocument';
import { CLIENT_REASONS, STUDIO_REASONS } from '@/modules/studio-design/rules';
import { RESPONSIBLE_LABEL, RESPONSIBLES } from '@/modules/studio-design/template';
import { formatINR } from '@/lib/money';
import { CustomerSees, OnlyYourTeam } from '../marks';
import { MilestoneCount, STAR_HINT, StarToggle } from './StarToggle';
import {
  addDesignStepBelowAction,
  addMoodBoardPiecesAction,
  addStepTaskAction,
  applyDesignStepsAction,
  assignDesignerAction,
  bookVisitAction,
  closeDesignAction,
  editDesignStepAction,
  makeDesignFinalAction,
  moveDesignStepAction,
  moveDesignStepOrderAction,
  saveMeasurementsAction,
  setStepTaskAction,
  setVisitStatusAction,
  shareDrawingAction,
  shareMoodBoardAction,
  tickDesignStepAction,
} from './design-actions';

/**
 * The project's Design tab (Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md):
 * the designer, the design steps with their payment gates and files, the site
 * visit and measurements, the mood board, drawings for approval and the design
 * final. One obvious action per row. Everything the client sees carries the
 * "sees this" mark; the team's notes sit in "Only your team".
 */

const muted = 'text-[12.5px] text-[var(--muted)]';
const h2 = 'm-0 text-[16px] font-semibold';
const small = 'text-[12.5px]';

const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '') : '';
const whenWords = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

type Result = { ok: true; message: string } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) after?.();
    });
  return { pending, message, run };
}

function Message({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p role={m.ok ? 'status' : 'alert'} className={`m-0 ${small} ${m.ok ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>
      {m.text}
    </p>
  );
}

export function DesignPanel({ tab }: { tab: DesignTab }) {
  return (
    <div className="flex flex-col gap-5">
      <Overview tab={tab} />
      <Steps tab={tab} />
      <VisitAndSizes tab={tab} />
      <MoodBoard tab={tab} />
      <Drawings tab={tab} />
      <DesignFinal tab={tab} />
    </div>
  );
}

// ── Overview and the designer ─────────────────────────────────

function Overview({ tab }: { tab: DesignTab }) {
  const { pending, message, run } = useRun();
  const [pick, setPick] = useState(tab.designer?.id ?? '');
  const next = tab.next;
  return (
    <section aria-label="Design" className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>
          Design {tab.pct !== null ? <span className="mono acc-t">{tab.pct}%</span> : null}
        </h2>
        <CustomerSees name={tab.customerFirst} />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--fill2)]" role="progressbar" aria-label={`Design ${tab.pct ?? 0}% done`} aria-valuenow={tab.pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-[var(--acc)]" style={{ width: `${tab.pct ?? 0}%` }} />
      </div>
      {tab.stage ? (
        <p className={`m-0 ${muted}`}>
          {tab.stage.done ? 'Design is done.' : `Planned ${dayWords(tab.stage.plannedStart)} to ${dayWords(tab.stage.plannedEnd)}`}
          {tab.bhk ? ` · ${tab.bhk} BHK` : ''}
        </p>
      ) : (
        <p className={`m-0 ${muted}`}>This project has no design stage in its plan.</p>
      )}
      {next ? (
        <p className="m-0 text-[14.5px]">
          <span className="font-semibold">Next: {next.label}</span>
          {next.plannedOn ? ` · ${dayWords(next.plannedOn)}` : ''}
          {next.lockedBy ? <span className="ml-1 text-[var(--warn)]"> · opens when the {next.lockedBy} is recorded</span> : null}
        </p>
      ) : null}
      {tab.category ? (
        <p className={`m-0 ${muted}`}>
          <span className="font-semibold text-[var(--ink)]">{CATEGORY_WORD[tab.category]}</span>
          {tab.category === 'PREMIUM' ? ` · 3D changes asked: ${tab.changeRounds} of the 2 rounds included${tab.changeRounds > 2 ? ' (an extra round: note it as agreed with the client)' : ''}` : ''}
        </p>
      ) : null}
      {tab.fromSales ? (
        // Sales' notes for the design team, from the sales final (DESIGN-PROCESS-PLAN.md §4.2).
        <div className="rounded-[10px] bg-[var(--fill)] p-3 text-[13.5px]">
          <p className="m-0 font-semibold">
            From sales{tab.fromSales.by ? ` (${tab.fromSales.by}${tab.fromSales.on ? `, ${dayWords(tab.fromSales.on)}` : ''})` : ''}
          </p>
          {tab.fromSales.notes ? <p className="m-0 mt-1 whitespace-pre-wrap">{tab.fromSales.notes}</p> : null}
          {tab.fromSales.voiceUrl ? <audio controls src={tab.fromSales.voiceUrl} className="mt-2 h-8" /> : null}
        </div>
      ) : null}
      {tab.overrunDays > 0 ? (
        <p className="m-0 rounded-[10px] bg-[var(--warn-bg)] p-3 text-[13.5px] text-[var(--warn)]">
          Design now ends {tab.overrunDays} day{tab.overrunDays === 1 ? '' : 's'} after the plan&rsquo;s date.{' '}
          {tab.canEditPlan ? (
            <Link href={`/studio/projects/${tab.projectId}`} className="acc-t">
              Move the plan&rsquo;s dates
            </Link>
          ) : (
            'Tell your project manager.'
          )}
        </p>
      ) : null}
      {tab.legacySteps && tab.canEditPlan ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--fill)] p-3">
          <span className="text-[13.5px]">This project started before design steps. Give it your studio&rsquo;s design steps?</span>
          <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => applyDesignStepsAction(tab.projectId))}>
            Use our design steps
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--fill2)] pt-3">
        <span className="text-[13.5px] font-semibold">Designer</span>
        {tab.canAssign ? (
          <>
            <select className="fld min-h-[36px] max-w-[240px]" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Designer">
              <option value="">Nobody yet</option>
              {tab.designers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.role !== 'DESIGNER' ? ` (${d.role === 'OWNER' ? 'owner' : 'project manager'})` : ''}
                </option>
              ))}
            </select>
            <button type="button" className="btn pri sm" disabled={pending || pick === (tab.designer?.id ?? '')} onClick={() => run(() => assignDesignerAction(tab.projectId, pick))}>
              Save
            </button>
            {tab.designers.every((d) => d.role !== 'DESIGNER') ? <span className={muted}>Add designers in Settings, Team.</span> : null}
          </>
        ) : (
          <span className="text-[13.5px]">{tab.designer?.name ?? 'Nobody yet'}</span>
        )}
      </div>
      <Message m={message} />
    </section>
  );
}

// ── Steps ─────────────────────────────────────────────────────

/** The category words (BudgetTier LUXURY reads "Luxe", DESIGN-PROCESS-PLAN.md §4.3). */
const CATEGORY_WORD: Record<'ESSENTIAL' | 'PREMIUM' | 'LUXURY', string> = { ESSENTIAL: 'Essential', PREMIUM: 'Premium', LUXURY: 'Luxe' };

/** "2 h", "30 min", "16 h". */
const effortWords = (min: number | null): string | null => (min === null || min <= 0 ? null : min < 60 ? `${min} min` : `${Math.round((min / 60) * 10) / 10} h`);

function Steps({ tab }: { tab: DesignTab }) {
  const [open, setOpen] = useState<{ id: string; what: 'tick' | 'move' | 'edit' | 'below' } | null>(null);
  const { message, run, pending } = useRun();
  const [starred, setStarred] = useState<{ ok: boolean; text: string } | null>(null);
  if (tab.steps.length === 0) return null;
  const stars = tab.steps.filter((s) => s.inScope && s.milestone).length;
  /* The client sees every design step, without dates (DESIGN-PROCESS-PLAN.md Decision 11), on every plan since 27 Oct 2026. */
  const process = true;
  /* Weights by effort on the new steps; an older plan's are its own. */
  const byEffort = tab.steps.some((s) => s.effortMin !== null);
  return (
    <section aria-label="Design steps" className="card flex flex-col gap-2 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Design steps</h2>
        <CustomerSees name={tab.customerFirst} />
      </div>
      {process ? (
        <p className={`m-0 ${muted}`}>
          {tab.customerFirst} sees every step and the design&rsquo;s %, never the dates. Each % is the step&rsquo;s share of the design{byEffort ? ', by its effort' : ''}. A step after an unrecorded payment waits for it, and is
          never late. ★ marks a milestone.
        </p>
      ) : (
        <>
          <p className={`m-0 ${muted}`}>
            <span className="font-medium acc-t">★ {STAR_HINT}</span> {tab.customerFirst} sees the design&rsquo;s % from every step. Each % is the step&rsquo;s share of the design. A locked step opens when its
            payment is recorded by accounts.
          </p>
          <MilestoneCount n={stars} />
        </>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {tab.steps.map((st, k) => (
          <StepHeads key={`h-${st.id}`} st={st} before={k > 0 ? tab.steps[k - 1]! : null} />
        )).flatMap((head, k) => {
          const st = tab.steps[k]!;
          return [
          head,
          <li key={st.id} id={`step-${st.id}`} className="flex items-start gap-1.5 rounded-[8px] px-1.5 py-2 hover:bg-[var(--fill)]">
            <StarToggle
              projectId={tab.projectId}
              stepId={st.id}
              label={st.label}
              starred={st.milestone}
              canEdit={tab.canEditPlan}
              say={(r) => setStarred(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })}
            />
            <div className="min-w-0 flex-1">
            <StepLine tab={tab} st={st} onOpen={(what) => setOpen(open?.id === st.id && open.what === what ? null : { id: st.id, what })} />
            {open?.id === st.id && open.what === 'tick' ? <TickForm tab={tab} st={st} onDone={() => setOpen(null)} /> : null}
            {open?.id === st.id && open.what === 'move' ? <MoveForm tab={tab} st={st} onDone={() => setOpen(null)} /> : null}
            {open?.id === st.id && open.what === 'edit' ? (
              <EditForm
                tab={tab}
                st={st}
                busy={pending}
                onSave={(v) => run(() => editDesignStepAction({ projectId: tab.projectId, stepId: st.id, ...v }), () => setOpen(null))}
              />
            ) : null}
            {open?.id === st.id && open.what === 'below' ? <AddBelowForm tab={tab} st={st} onDone={() => setOpen(null)} /> : null}
            <Tasks tab={tab} st={st} />
            {tab.canEditPlan && open?.id === st.id && open.what === 'edit' ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button type="button" className="btn ghost sm" disabled={pending || st.done} onClick={() => run(() => moveDesignStepOrderAction(tab.projectId, st.id, 'up'))}>
                  ↑ Move up
                </button>
                <button type="button" className="btn ghost sm" disabled={pending || st.done} onClick={() => run(() => moveDesignStepOrderAction(tab.projectId, st.id, 'down'))}>
                  ↓ Move down
                </button>
                <button type="button" className="btn ghost sm" onClick={() => setOpen({ id: st.id, what: 'below' })}>
                  + Add a step below
                </button>
              </div>
            ) : null}
            </div>
          </li>,
          ];
        })}
      </ul>
      <Message m={message} />
      <Message m={starred} />
    </section>
  );
}

function StepLine({ tab, st, onOpen }: { tab: DesignTab; st: DesignStepView; onOpen: (what: 'tick' | 'move' | 'edit') => void }) {
  const meta = !st.inScope
    ? `Not in scope · ${tab.customerFirst} does not see it`
    : st.done
      ? `Done ${dayWords(st.doneOn)}`
      : st.plannedOn
        ? `Planned ${dayWords(st.plannedOn)}${st.lateDays ? ` · ${st.lateDays} day${st.lateDays === 1 ? '' : 's'} late` : ''}`
        : 'Open';
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span
        aria-hidden="true"
        className="oi-box"
        style={st.done ? { background: 'var(--good-s)' } : { boxShadow: 'inset 0 0 0 1.5px var(--ring)' }}
      >
        {st.done ? '✓' : st.lockedBy ? '🔒' : ''}
      </span>
      <span className="min-w-0 flex-1 basis-[240px]">
        <span className={`block text-[14px] ${st.done || !st.inScope ? 'text-[var(--muted)]' : ''}`}>
          {st.label}
          <span className="sr-only">{st.done ? ' (done)' : st.lockedBy ? ' (locked)' : ' (open)'}</span>
        </span>
        <span className={`block ${muted} ${st.lateDays && !st.done ? '!text-[var(--bad)]' : ''}`}>
          {meta}
          {st.responsibleLabel ? ` · ${st.responsibleLabel}` : ''}
          {st.group === 'Pre-execution' && st.responsible === 'DESIGNER' ? ' (support)' : ''}
          {effortWords(st.effortMin) ? ` · ${effortWords(st.effortMin)}` : ''}
          {st.approvalKind && !st.done ? ` · ticks when ${tab.customerFirst} approves in the app` : ''}
          {st.needsDocument ? ' · needs its file' : ''}
          {st.lockedBy ? ` · opens when the ${st.lockedBy} is recorded` : ''}
        </span>
        {st.moves.length ? (
          <span className={`block ${muted}`}>
            Moved {st.moves.length === 1 ? 'once' : `${st.moves.length} times`}: last {dayWords(st.moves.at(-1)!.from)} → {dayWords(st.moves.at(-1)!.to)} ({st.moves.at(-1)!.side === 'CLIENT' ? 'client side' : 'studio side'}: {st.moves.at(-1)!.reason.toLowerCase()})
          </span>
        ) : null}
        {st.done && st.beforeJoining ? <span className={`block ${muted}`}>Done before joining One Interiors</span> : null}
        {st.done && (st.doneNote || st.doneFile) ? (
          <span className={`block ${muted}`}>
            {st.doneNote ? `Team note: ${st.doneNote}` : ''}
            {st.doneFile ? (
              <>
                {st.doneNote ? ' · ' : ''}
                <a href={st.doneFile.url} target="_blank" rel="noreferrer" className="acc-t">
                  {st.doneFile.title}
                </a>
              </>
            ) : null}
          </span>
        ) : null}
      </span>
      <span className="tabular-nums w-[48px] flex-none text-right mono text-[13px] text-[var(--text2)]" title="Its share of the design">
        {st.inScope ? `${st.sharePct}%` : '—'}
      </span>
      <span className="flex flex-none flex-wrap items-center gap-1.5">
        {tab.canWork && st.inScope && !st.done ? (
          <button type="button" className="btn pri sm" disabled={Boolean(st.lockedBy)} onClick={() => onOpen('tick')} title={st.lockedBy ? `Opens when the ${st.lockedBy} is recorded` : undefined}>
            Tick
          </button>
        ) : null}
        {tab.canWork && st.inScope && !st.done && st.plannedOn && !st.lockedBy ? (
          <button type="button" className="btn ghost sm" onClick={() => onOpen('move')}>
            Running late
          </button>
        ) : null}
        {tab.canEditPlan ? (
          <button type="button" className="btn ghost sm" onClick={() => onOpen('edit')} aria-label={`Edit ${st.label}`}>
            Edit
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** The part headings and payment lines above a step: Design, Pre-execution, and each payment the steps wait on. */
function StepHeads({ st, before }: { st: DesignStepView; before: DesignStepView | null }) {
  const part = st.group !== (before?.group ?? null);
  if (!part && !st.payment) return null;
  return (
    <li aria-hidden={false} className="list-none">
      {part ? (
        st.group === 'Pre-execution' ? (
          <p className="m-0 mt-3 border-t border-[var(--fill2)] pt-3 text-[13px] font-semibold">
            Pre-execution <span className={`font-normal ${muted}`}>· the execution team owns it from here; the designer supports</span>
          </p>
        ) : before ? (
          <p className="m-0 mt-3 text-[13px] font-semibold">{st.group}</p>
        ) : null
      ) : null}
      {st.payment ? (
        <p className={`m-0 mt-2 rounded-[8px] px-2 py-1 text-[12.5px] ${st.payment.recorded ? 'bg-[var(--fill)] text-[var(--text2)]' : 'bg-[var(--warn-bg)] text-[var(--warn)]'}`}>
          {st.payment.label}: {st.payment.recorded ? 'recorded' : 'not recorded yet. The steps from here wait for it.'}
        </p>
      ) : null}
    </li>
  );
}

/** The to-dos inside a step: tick them, add one (design work). Never the step's own tick. */
function Tasks({ tab, st }: { tab: DesignTab; st: DesignStepView }) {
  const { pending, message, run } = useRun();
  const [adding, setAdding] = useState('');
  if (st.tasks.length === 0 && !tab.canWork) return null;
  return (
    <div className="mt-1 flex flex-col gap-1 pl-8">
      {st.tasks.map((t) => (
        <label key={t.id} className={`flex items-center gap-2 text-[13px] ${t.done ? 'text-[var(--muted)] line-through' : ''}`}>
          <input type="checkbox" checked={t.done} disabled={!tab.canWork || pending} onChange={(e) => run(() => setStepTaskAction(tab.projectId, t.id, e.target.checked))} />
          {t.label}
        </label>
      ))}
      {tab.canWork && !st.done ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (adding.trim().length < 2) return;
            run(() => addStepTaskAction(tab.projectId, st.id, adding), () => setAdding(''));
          }}
        >
          <input value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={120} placeholder="+ Add a task" aria-label={`Add a task to ${st.label}`} className="fld min-h-[30px] max-w-[260px] text-[12.5px]" />
          {adding.trim().length >= 2 ? (
            <button type="submit" className="btn ghost sm" disabled={pending}>
              Add
            </button>
          ) : null}
        </form>
      ) : null}
      <Message m={message} />
    </div>
  );
}

/** A new step below this one, in its part: name, who, days after, effort (owner, PM). */
function AddBelowForm({ tab, st, onDone }: { tab: DesignTab; st: DesignStepView; onDone: () => void }) {
  const { pending, message, run } = useRun();
  const [v, setV] = useState({ label: '', responsible: 'DESIGNER', days: '1', hours: '1' });
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 rounded-[14px] bg-[var(--soft)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addDesignStepBelowAction({ projectId: tab.projectId, afterId: st.id, ...v }), onDone);
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]">
        New step
        <input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} maxLength={120} required className="fld min-w-[200px]" />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Who
        <select value={v.responsible} onChange={(e) => setV({ ...v, responsible: e.target.value })} className="fld">
          {RESPONSIBLES.map((r) => (
            <option key={r} value={r}>
              {RESPONSIBLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Days after
        <input type="number" min={0} max={30} value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })} className="fld w-[70px]" />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Effort (h)
        <input type="number" min={0} max={40} step={0.25} value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} className="fld w-[80px]" />
      </label>
      <button type="submit" className="btn pri sm" disabled={pending}>
        Add the step
      </button>
      <button type="button" className="btn ghost sm" onClick={onDone}>
        Cancel
      </button>
      <Message m={message} />
    </form>
  );
}

function TickForm({ tab, st, onDone }: { tab: DesignTab; st: DesignStepView; onDone: () => void }) {
  const { pending, message, run } = useRun();
  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-[14px] bg-[var(--soft)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set('projectId', tab.projectId);
        data.set('stepId', st.id);
        run(() => tickDesignStepAction(data), onDone);
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]">
        {st.needsDocument ? 'The file (required): PDF or image' : 'A file, if there is one'}
        <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={st.needsDocument} className="text-[13px]" />
      </label>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="share" /> Show the file to {tab.customerFirst} too
      </label>
      {st.lateDays > 0 ? (
        // A late step says why (DESIGN-PROCESS-PLAN.md Decision 6): it goes on the Delays list for the owner to check.
        <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--s-rule-soft)] bg-[var(--s-paper)] p-2">
          <label className="flex flex-col gap-1 text-[13px]">
            {st.lateDays === 1 ? '1 day late' : `${st.lateDays} days late`}: why?{st.responsible === 'CLIENT' ? ' (left empty: the client was not responding)' : ''}
            <select name="reason" className="fld" required={st.responsible !== 'CLIENT'} defaultValue="">
              <option value="">Pick one</option>
              <optgroup label="Client side">
                {Object.entries(CLIENT_REASONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Studio side">
                {Object.entries(STUDIO_REASONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <OnlyYourTeam>
            <label className="flex flex-col gap-1 text-[13px]">
              About the delay (optional)
              <input name="reasonNote" maxLength={500} className="fld" />
            </label>
          </OnlyYourTeam>
        </div>
      ) : null}
      <OnlyYourTeam>
        <label className="flex flex-col gap-1 text-[13px]">
          What was done (optional)
          <textarea name="note" rows={2} maxLength={500} className="fld" />
        </label>
      </OnlyYourTeam>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn pri sm" disabled={pending}>
          Tick {st.label}
        </button>
        <button type="button" className="btn ghost sm" onClick={onDone}>
          Cancel
        </button>
      </div>
      <Message m={message} />
    </form>
  );
}

function MoveForm({ tab, st, onDone }: { tab: DesignTab; st: DesignStepView; onDone: () => void }) {
  const { pending, message, run } = useRun();
  const [to, setTo] = useState(st.plannedOn ?? tab.today);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-[14px] bg-[var(--soft)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => moveDesignStepAction({ projectId: tab.projectId, stepId: st.id, to, reason, note }), onDone);
      }}
    >
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[13px]">
          New day
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="fld" required />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          Why
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="fld" required>
            <option value="">Pick one</option>
            <optgroup label="Client side">
              {Object.entries(CLIENT_REASONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </optgroup>
            <optgroup label="Studio side">
              {Object.entries(STUDIO_REASONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>
      <OnlyYourTeam>
        <label className="flex flex-col gap-1 text-[13px]">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="fld" />
        </label>
      </OnlyYourTeam>
      <p className={`m-0 ${muted}`}>The open steps after this one move by the same days. {tab.customerFirst} sees the new day and the reason, never the note.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn pri sm" disabled={pending}>
          Move
        </button>
        <button type="button" className="btn ghost sm" onClick={onDone}>
          Cancel
        </button>
      </div>
      <Message m={message} />
    </form>
  );
}

function EditForm({ tab, st, busy, onSave }: { tab: DesignTab; st: DesignStepView; busy: boolean; onSave: (v: { responsible: string; needsDocument: boolean; gatePayment: string }) => void }) {
  const [responsible, setResponsible] = useState<string>(st.responsible ?? '');
  const [needsDocument, setNeedsDocument] = useState(st.needsDocument);
  const [gate, setGate] = useState(st.gatePayment === null ? '' : String(st.gatePayment));
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-[14px] bg-[var(--soft)] p-3">
      <label className="flex flex-col gap-1 text-[13px]">
        Who does it
        <select value={responsible} onChange={(e) => setResponsible(e.target.value)} className="fld">
          <option value="">Not set</option>
          {RESPONSIBLES.map((r) => (
            <option key={r} value={r}>
              {RESPONSIBLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Opens when this payment is recorded
        <select value={gate} onChange={(e) => setGate(e.target.value)} className="fld">
          <option value="">No payment needed</option>
          {tab.payments.map((p) => (
            <option key={p.index} value={String(p.index)}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-[36px] items-center gap-2 text-[13px]">
        <input type="checkbox" checked={needsDocument} onChange={(e) => setNeedsDocument(e.target.checked)} /> Needs its file to tick
      </label>
      <button type="button" className="btn pri sm" disabled={busy} onClick={() => onSave({ responsible, needsDocument, gatePayment: gate })}>
        Save
      </button>
      <span className={muted}>Rename, weight or scope it in the Plan tab.</span>
    </div>
  );
}

// ── Site visit and measurements ──────────────────────────────

function VisitAndSizes({ tab }: { tab: DesignTab }) {
  const { pending, message, run } = useRun();
  const [day, setDay] = useState(tab.today);
  const [time, setTime] = useState('11:00');
  const [purpose, setPurpose] = useState('Measurement');
  const [note, setNote] = useState('');
  const blank = { room: '', length: '', width: '', height: '', note: '' };
  const [rows, setRows] = useState(tab.measurements.length ? tab.measurements.map((m) => ({ ...m, note: m.note ?? '' })) : [blank]);
  const set = (i: number, k: keyof typeof blank, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <section aria-label="Site visit and measurements" className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Site visit and measurements</h2>
        <CustomerSees name={tab.customerFirst} />
      </div>
      {tab.visits.length ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {tab.visits.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className={v.status === 'CANCELLED' ? 'text-[var(--muted)] line-through' : ''}>
                {v.purpose} · {whenWords(v.at)}
              </span>
              <span className={muted}>{v.status === 'DONE' ? 'Done' : v.status === 'CANCELLED' ? 'Cancelled' : 'Booked'}</span>
              {v.note ? <span className={muted}>· Team note: {v.note}</span> : null}
              {tab.canWork && v.status === 'BOOKED' ? (
                <>
                  <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => setVisitStatusAction(tab.projectId, v.id, 'DONE'))}>
                    Done
                  </button>
                  <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => setVisitStatusAction(tab.projectId, v.id, 'CANCELLED'))}>
                    Cancel
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`m-0 ${muted}`}>No visit booked yet.</p>
      )}
      {tab.canWork ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => bookVisitAction({ projectId: tab.projectId, day, time, purpose, note }), () => setNote(''));
          }}
        >
          <label className="flex flex-col gap-1 text-[13px]">
            Day
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="fld" required />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            Time
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="fld" required />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            For
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={80} className="fld" required />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            Team note
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="fld" />
          </label>
          <button type="submit" className="btn pri sm" disabled={pending}>
            Book the visit
          </button>
        </form>
      ) : null}
      <div className="border-t border-[var(--fill2)] pt-3">
        <p className="m-0 mb-2 text-[13.5px] font-semibold">Rooms, in feet (like 10.5 or 10&apos;6&quot;)</p>
        <div className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-1.5 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_minmax(0,2fr)]">
              <input aria-label={`Room ${i + 1}`} placeholder="Room" value={r.room} onChange={(e) => set(i, 'room', e.target.value)} className="fld" disabled={!tab.canWork} />
              <input aria-label={`Length ${i + 1}`} placeholder="Length" value={r.length} onChange={(e) => set(i, 'length', e.target.value)} className="fld" disabled={!tab.canWork} />
              <input aria-label={`Width ${i + 1}`} placeholder="Width" value={r.width} onChange={(e) => set(i, 'width', e.target.value)} className="fld" disabled={!tab.canWork} />
              <input aria-label={`Height ${i + 1}`} placeholder="Height" value={r.height} onChange={(e) => set(i, 'height', e.target.value)} className="fld" disabled={!tab.canWork} />
              <input aria-label={`Note ${i + 1}`} placeholder="Note (team only)" value={r.note} onChange={(e) => set(i, 'note', e.target.value)} className="fld" disabled={!tab.canWork} />
            </div>
          ))}
        </div>
        {tab.canWork ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn ghost sm" onClick={() => setRows((rs) => [...rs, blank])}>
              + Add a room
            </button>
            <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => saveMeasurementsAction(tab.projectId, rows))}>
              Save the sizes
            </button>
          </div>
        ) : null}
      </div>
      <p className={`m-0 ${muted}`}>Site photos go in Drawings below as &ldquo;Site photo&rdquo;.</p>
      <Message m={message} />
    </section>
  );
}

// ── Mood board ────────────────────────────────────────────────

function MoodBoard({ tab }: { tab: DesignTab }) {
  const { pending, message, run } = useRun();
  const mb = tab.moodBoard;
  const [note, setNote] = useState(mb.note ?? '');
  const [room, setRoom] = useState(mb.roomOptions[0]?.key ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const pieces = mb.roomOptions.find((r) => r.key === room)?.pieces ?? [];
  return (
    <section aria-label="Mood board" className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Mood board</h2>
        <CustomerSees name={tab.customerFirst} />
      </div>
      <p className={`m-0 ${muted}`}>
        {mb.sharedOn ? `Shared ${dayWords(mb.sharedOn)}. ${tab.customerFirst} fills it in the app.` : `Not shared yet. ${tab.customerFirst} picks what they like for each room in the app.`}
      </p>
      {tab.canWork ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[13px]">
            Message to {tab.customerFirst}
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="fld" placeholder="Pick two looks you like for the living room" />
          </label>
          <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => shareMoodBoardAction(tab.projectId, note))}>
            {mb.sharedOn ? 'Share again' : 'Share the mood board'}
          </button>
        </div>
      ) : null}
      {mb.rooms.length ? (
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {mb.rooms.map((r) => (
            <li key={r.roomKey} className="rounded-[10px] bg-[var(--fill)] p-3 text-[13.5px]">
              <p className="m-0 font-semibold">
                {r.label}
                {r.styleLabel ? <span className={`ml-1 ${muted}`}>· {r.styleLabel}</span> : null}
              </p>
              {r.choice ? <p className="m-0">Chose: {r.choice}</p> : null}
              {r.board.length ? <p className="m-0">{r.board.map((b) => b.label).join(' · ')}</p> : null}
              {r.note ? <p className={`m-0 ${muted}`}>&ldquo;{r.note}&rdquo;</p> : null}
              {r.budgetFlag ? <p className="m-0 text-[12.5px] text-[var(--warn)]">{r.budgetFlag}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`m-0 ${muted}`}>Nothing picked yet.</p>
      )}
      {tab.canWork ? (
        <details className="rounded-[14px] bg-[var(--soft)] p-3">
          <summary className="cursor-pointer text-[13.5px] font-semibold">Add pieces to a room for {tab.customerFirst}</summary>
          <div className="mt-2 flex flex-col gap-2">
            <select value={room} onChange={(e) => { setRoom(e.target.value); setPicked([]); }} className="fld max-w-[260px]" aria-label="Room">
              {mb.roomOptions.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="flex max-h-[220px] flex-wrap gap-1.5 overflow-auto">
              {pieces.map((p) => (
                <label key={p.slug} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fill2)] px-2.5 py-1 text-[13px]">
                  <input type="checkbox" checked={picked.includes(p.slug)} onChange={(e) => setPicked((xs) => (e.target.checked ? [...xs, p.slug] : xs.filter((x) => x !== p.slug)))} />
                  {p.label}
                </label>
              ))}
            </div>
            <button type="button" className="btn pri sm self-start min-h-[36px] px-3 text-[13.5px]" disabled={pending || picked.length === 0} onClick={() => run(() => addMoodBoardPiecesAction(tab.projectId, room, picked), () => setPicked([]))}>
              Add {picked.length || ''} to the board
            </button>
          </div>
        </details>
      ) : null}
      <Message m={message} />
    </section>
  );
}

// ── Drawings ──────────────────────────────────────────────────

const STATE_WORDS: Record<DesignTab['drawings'][number]['state'], { text: string; tone: string }> = {
  draft: { text: 'Draft · only your team', tone: 'var(--muted)' },
  waiting: { text: 'Waiting for the client', tone: 'var(--warn)' },
  approved: { text: 'Approved', tone: 'var(--good)' },
  changes: { text: 'Changes asked', tone: 'var(--bad)' },
  shared: { text: 'Shared', tone: 'var(--acc)' },
};

/** The tag on a document's version (DESIGN-PROCESS-PLAN.md §3.3). */
const FINAL_WORDS: Record<FinalView['state'], { text: string; tone: string }> = {
  approved: { text: 'Approved', tone: 'var(--good)' },
  waiting: { text: 'Waiting for approval', tone: 'var(--warn)' },
  changes: { text: 'Changes asked', tone: 'var(--bad)' },
  shared: { text: 'Shared', tone: 'var(--text2)' },
  draft: { text: 'Draft (team only)', tone: 'var(--muted)' },
};

/**
 * Documents (owner and Hauspire's design team, 24 Oct 2026;
 * DESIGN-PROCESS-PLAN.md §3): one line per type and room, the version that
 * counts (the approved one, else the newest shared), downloads named for
 * you; the newest version's actions under it; "Show all versions" for the
 * repository and "Handover documents" for the pack.
 */
function Drawings({ tab }: { tab: DesignTab }) {
  const { pending, message, run } = useRun();
  const [replacing, setReplacing] = useState<{ type: DocType; room: string | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const newest = (type: string, room: string | null) => tab.drawings.find((d) => d.kind === type && (d.room ?? '').toLowerCase() === (room ?? '').toLowerCase()) ?? null;
  return (
    <section aria-label="Documents" className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Documents</h2>
        <span className="flex flex-wrap items-center gap-3 text-[13px]">
          <Link href={`/studio/projects/${tab.projectId}/documents`} className="acc-t">
            Show all versions
          </Link>
          <Link href={`/studio/projects/${tab.projectId}/documents/handover`} className="acc-t">
            Handover documents
          </Link>
          <CustomerSees name={tab.customerFirst} />
        </span>
      </div>
      {tab.finals.length === 0 ? <p className={`m-0 ${muted}`}>Nothing uploaded yet.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {tab.finals.map((f) => {
          const s = FINAL_WORDS[f.state];
          const d = newest(f.type, f.room);
          return (
            <li key={f.id} className="flex flex-col gap-1 border-t border-[var(--fill2)] pt-2 text-[14px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--ink)]">
                  {f.typeLabel}
                  {f.room ? `, ${f.room}` : ''}
                </span>
                <span className="mono text-[12.5px]">v{f.versionLabel}</span>
                <span className="text-[12.5px] font-medium" style={{ color: s.tone }}>
                  {s.text}
                </span>
                <span className={muted}>{dayWords(f.on)}</span>
                {f.url ? (
                  <a href={f.url} className="text-[12.5px] acc-t" title={f.fileName}>
                    Download
                  </a>
                ) : null}
              </div>
              {f.newerWaiting && d ? (
                <span className={muted}>
                  v{d.versionLabel} shared, {STATE_WORDS[d.state].text.toLowerCase()}
                  {d.state === 'waiting' && d.waitingDays ? ` · ${d.waitingDays} day${d.waitingDays === 1 ? '' : 's'}` : ''}
                </span>
              ) : null}
              {d?.askedFor ? <span className={muted}>Asked for: &ldquo;{d.askedFor}&rdquo;</span> : null}
              {d?.answer?.comment ? (
                <span className={muted}>
                  {tab.customerFirst} on {dayWords(d.answer.on)}: &ldquo;{d.answer.comment}&rdquo;
                </span>
              ) : null}
              {d?.reminder ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className={muted}>Remind {tab.customerFirst} yourself (we send nothing):</span>
                  <button
                    type="button"
                    className="text-[12.5px] acc-t underline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(d.reminder!).then(() => setCopied(d.id));
                    }}
                  >
                    {copied === d.id ? 'Copied' : 'Copy the reminder'}
                  </button>
                </span>
              ) : null}
              {tab.canWork ? (
                <span className="flex flex-wrap gap-2">
                  {d && d.state === 'draft' ? (
                    <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => shareDrawingAction(tab.projectId, d.id))}>
                      Share v{d.versionLabel} with {tab.customerFirst}
                    </button>
                  ) : null}
                  <button type="button" className="btn ghost sm" onClick={() => setReplacing({ type: f.type, room: f.room })}>
                    Upload a new version
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {tab.canWork ? (
        <UploadDocument key={replacing ? `${replacing.type}|${replacing.room}` : 'new'} projectId={tab.projectId} customerFirst={tab.customerFirst} preset={replacing} onDone={replacing ? () => setReplacing(null) : undefined} />
      ) : null}
      <Message m={message} />
    </section>
  );
}

// ── Design final ──────────────────────────────────────────────

function DesignFinal({ tab }: { tab: DesignTab }) {
  const { pending, message, run } = useRun();
  const f = tab.final;
  return (
    <section aria-label="Design final" className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Design final</h2>
        <CustomerSees name={tab.customerFirst} />
      </div>
      {!f.seesQuotes ? (
        // Only a member who sees no money lands here (a designer sees it since the lifecycle, 13 Oct 2026).
        <p className={`m-0 ${muted}`}>The sales final and the Design Final are kept by the owner and the project manager.</p>
      ) : f.signed ? (
        <p className="m-0 text-[14px]">
          Sales final:{' '}
          <Link href={`/studio/quotations/${f.signed.id}`} className="acc-t">
            {f.signed.number}
          </Link>
          {f.designFinal ? (
            <>
              {' '}
              · Design Final:{' '}
              <Link href={`/studio/quotations/${f.designFinal.id}`} className="acc-t">
                {f.designFinal.number}
              </Link>{' '}
              <span className={muted}>({f.designFinal.status === 'DRAFT' ? 'draft' : f.designFinal.status === 'ISSUED' ? 'sent' : f.designFinal.status.toLowerCase()})</span> ·{' '}
              <Link href={`/studio/quotations/${f.designFinal.id}/compare`} className="acc-t">
                Compare with the sales final
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <p className={`m-0 ${muted}`}>This project was not started from a quotation.</p>
      )}
      {f.closedOn ? (
        <div className="flex flex-col gap-1 text-[14px]">
          <p className="m-0 font-semibold text-[var(--good)]">Design signed off {dayWords(f.closedOn)}. The project is in execution.</p>
          {f.changes ? (
            <p className="m-0">
              {tab.customerFirst} sees {f.changes.lines.length} change{f.changes.lines.length === 1 ? '' : 's'}: {formatINR(f.changes.salesTotalPaise)} → {formatINR(f.changes.designTotalPaise)}.
            </p>
          ) : null}
        </div>
      ) : f.seesQuotes && (tab.canAssign || tab.canClose) && f.signed ? (
        <div className="flex flex-wrap items-center gap-2">
          {!f.designFinal ? (
            tab.canAssign ? (
              <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => makeDesignFinalAction(tab.projectId))}>
                Make Design Final
              </button>
            ) : null
          ) : (
            <button
              type="button"
              className="btn pri sm"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Sign off the design on ${f.designFinal!.number}? The project moves to execution, and ${tab.customerFirst} sees what changed against the sales final.`)) run(() => closeDesignAction(tab.projectId));
              }}
              hidden={!tab.canClose}
            >
              Design sign-off
            </button>
          )}
          <span className={muted}>
            {!f.designFinal
              ? tab.canAssign
                ? 'A copy of the sales final for the changes the design made.'
                : 'The owner or project manager makes the Design Final from the sales final.'
              : 'Send the Design Final first, then sign off. The project then moves to execution.'}
          </span>
        </div>
      ) : null}
      <Message m={message} />
    </section>
  );
}
