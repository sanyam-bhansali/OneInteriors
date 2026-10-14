/**
 * The customer's tracker, from the plan, the ticks and the moved dates
 * (studio workspace Phase 3) — the `tracker`, `overallLateDays` and
 * `stageStatus` keys of the customer projection. Pure; called from
 * `toCustomerProject` in one line, tested in tests/customer-projection.test.ts
 * and tests/project-rules.test.ts.
 *
 * What crosses (brief §5): stage names, planned / original / actual /
 * forecast dates, the project's and each stage's percentage done (the step
 * tracker, docs/studio-workspace/STEP-TRACKER.md, counted from EVERY
 * in-scope step), and each moved date as old date, new date and the reason
 * in plain words.
 *
 * Steps (owner, 12 Oct 2026; docs/studio-os/CUSTOMER-MILESTONES.md): only
 * the steps the studio STARRED cross — each stage's 2–3 milestones (label,
 * group, its share as a percentage, done, the day it was done and its
 * planned day). `steps`, `checklist` and `current.rooms` carry the starred
 * in-scope steps only; every other step is the studio's own and never
 * leaves this file. Never the PM's note on a move, who moved it, who ticked
 * what, a step's stored weight, its photo (photos live in the site feed), a
 * step marked not in scope or a step not starred.
 *
 * Statuses are computed (project-rules.ts), never typed: "Carpentry · on
 * track", "Overall · 4 days late", with the customer's own share of the
 * delay labelled as theirs.
 */

import { calendarOf, dayFromDb, istDay } from '@/modules/project/working-days';
import {
  currentStatus,
  handoverStage,
  isCustomerDelay,
  isDelayReason,
  moveSentence,
  overallDelay,
  stageCompletion,
  stageStatuses,
  type DateField,
  type DelayReason,
  type RuleChange,
  type RuleStage,
  type StageKind,
  type StageStatusName,
} from '@/modules/project/project-rules';
import { bpToPct, progressOf } from '@/modules/project/step-rules';
import { KIND_KEY, PLAN_KINDS, type PlanKind, type StageView, type TrackerStageKey } from './tracker';

/** One step as the customer sees it: never its stored weight, who ticked it or its photo. */
export interface CustomerStep {
  label: string;
  /** The step's group inside its stage ("Execution stage 2A"). */
  group: string;
  /** Its share of the whole project, as a percentage (may have decimals: 0.5). */
  pct: number;
  done: boolean;
  /** The IST day it was ticked. */
  doneOn: string | null;
  /** The IST day it is planned for. */
  plannedOn: string | null;
}

export interface CustomerTrackerStage {
  /** The key the app already translates (tracker.ts `KIND_KEY`). */
  key: TrackerStageKey;
  kind: PlanKind;
  /** The studio's own name for the stage. */
  label: string;
  plannedStart: string;
  plannedEnd: string;
  /** The end as first planned; differs from `plannedEnd` once moved. */
  originalEnd: string;
  actualEnd: string | null;
  forecastEnd: string;
  state: StageView['state'];
  status: StageStatusName;
  lateDays: number;
  earlyDays: number;
  /** Starred in-scope steps (milestones) ticked, of starred in scope. */
  checklist: { done: number; total: number };
  /** Whole percent of the stage done, rounded down: 100 only when every step in it is ticked. */
  progressPct: number;
  /** The stage's milestones: its starred in-scope steps, in plan order. Never a step the studio did not star. */
  steps: CustomerStep[];
  /** The latest move of its end, in plain words; null if it never moved. */
  moved: { from: string; to: string; reason: DelayReason; customer: boolean; words: string } | null;
}

export interface CustomerMove {
  at: string;
  /** The stage's name, or null for a handover move with no stage row. */
  stage: string | null;
  field: 'start' | 'end' | 'handover';
  from: string;
  to: string;
  reason: DelayReason;
  /** Caused by the customer (a change they asked for, or a late decision): shown, not counted against the studio. */
  customer: boolean;
  /** Tied to one of the customer's decisions. */
  byDecision: boolean;
  /** Handover's new day when the same move pushed it, else null. */
  handoverTo: string | null;
  /** The sentence, in English (the app phrases its own from the fields above). */
  words: string;
}

export interface CustomerTracker {
  /** Whole percent of the project done, rounded down: 100 only when every step is ticked. */
  progressPct: number;
  stages: CustomerTrackerStage[];
  /** The stage under way and its milestones, group by group; null once handed over. */
  current: { key: TrackerStageKey; label: string; rooms: { room: string; items: { label: string; done: boolean }[] }[] } | null;
  /** Every moved date, newest first, one entry per move (later stages that moved with it fold in). */
  moves: CustomerMove[];
  overall: {
    plannedHandover: string | null;
    forecastHandover: string | null;
    handedOver: boolean;
    lateDays: number;
    earlyDays: number;
    /** The customer's share of `lateDays`. */
    customerDays: number;
    /** The studio's share. */
    studioDays: number;
  };
}

export interface CustomerStageStatus {
  key: TrackerStageKey;
  label: string;
  status: 'on-track' | 'late';
  lateDays: number;
}

/** The rows this reads, as loose as the select allows (older rows and test rows may lack fields). */
export interface TrackerInputRow {
  stages?: readonly {
    id?: string;
    kind: string;
    name: string;
    plannedStart?: Date;
    plannedEnd: Date;
    actualEnd: Date | null;
    items?: readonly { id?: string; room: string; label: string; doneAt: Date | null; weightBp?: number; inScope?: boolean; plannedOn?: Date | null; customerMilestone?: boolean }[];
  }[] | null;
  dateChanges?: readonly {
    stageId?: string | null;
    field?: string;
    fromDate?: Date;
    toDate?: Date;
    reason?: string;
    decisionId?: string | null;
    at?: Date;
  }[] | null;
  studio?: { workingDays?: unknown; holidays?: readonly { day: Date }[] | null } | null;
}

export interface TrackerOut {
  tracker: CustomerTracker | null;
  overallLateDays: number;
  stageStatus: CustomerStageStatus | null;
}

const isKind = (k: string): k is PlanKind => (PLAN_KINDS as readonly string[]).includes(k);
const FIELDS: readonly string[] = ['PLANNED_START', 'PLANNED_END', 'HANDOVER'];
const DAY_MS = 86_400_000;

/** A stage date column as an IST day. Plan dates are written at midnight UTC (quote-to-plan, plan-edit), which is the same day in India. */
const day = (d: Date) => istDay(d);

/**
 * The legacy figure for a project with no plan: whole days the latest late
 * stage is past its date (the app's old rule), so `overallLateDays` is
 * always sent.
 */
function legacyLateDays(stages: readonly StageView[], now: Date): number {
  return Math.max(0, ...stages.filter((s) => s.late).map((s) => Math.floor((now.getTime() - s.targetOn.getTime()) / DAY_MS)));
}

export function customerTracker(row: TrackerInputRow, views: readonly StageView[], now: Date): TrackerOut {
  const stored = (row.stages ?? []).filter((s) => isKind(s.kind));
  if (stored.length === 0) {
    const cur = views.find((s) => s.state === 'now') ?? null;
    return {
      tracker: null,
      overallLateDays: legacyLateDays(views, now),
      stageStatus: cur ? { key: cur.key, label: cur.label, status: cur.late ? 'late' : 'on-track', lateDays: legacyLateDays([cur], now) } : null,
    };
  }

  const cal = calendarOf({ workingDays: row.studio?.workingDays, holidays: row.studio?.holidays ?? [] });
  const today = istDay(now);
  const rules: RuleStage[] = stored.map((s, i) => ({
    id: s.id ?? `stage-${i}`,
    kind: s.kind as StageKind,
    name: s.name,
    plannedStart: day(s.plannedStart ?? s.plannedEnd),
    plannedEnd: day(s.plannedEnd),
    actualEnd: s.actualEnd ? day(s.actualEnd) : null,
  }));
  const changes: RuleChange[] = [];
  for (const c of row.dateChanges ?? []) {
    if (!c.fromDate || !c.toDate || !c.at || !c.field || !FIELDS.includes(c.field) || !isDelayReason(c.reason)) continue;
    changes.push({
      stageId: c.stageId ?? null,
      field: c.field as DateField,
      from: dayFromDb(c.fromDate),
      to: dayFromDb(c.toDate),
      reason: c.reason,
      decisionId: c.decisionId ?? null,
      at: c.at,
    });
  }

  /* The steps: in scope only. Older rows with no weight share equally. */
  const steps = stored.map((s, i) => (s.items ?? []).filter((it) => it.inScope !== false).map((it, j) => ({ ...it, key: it.id ?? `${i}-${j}` })));
  const progress = progressOf(
    steps.flatMap((list, i) => list.map((it) => ({ id: it.key, stageId: rules[i]!.id, weightBp: it.weightBp ?? 0, inScope: true, done: it.doneAt !== null }))),
  );

  const statuses = stageStatuses(rules, changes, today, cal);
  const overall = overallDelay(rules, changes, today, cal);
  const cur = currentStatus(statuses);
  const names = new Map(rules.map((r) => [r.id, r.name]));
  const handover = handoverStage(rules);

  /* What the customer reads by name: the starred steps. The percentages above count every step. */
  const milestones = steps.map((list) => list.filter((it) => it.customerMilestone === true));

  const stages: CustomerTrackerStage[] = statuses.map((s, i) => {
    const items = milestones[i]!;
    const c = stageCompletion(items.map((it) => ({ done: it.doneAt !== null })));
    const sp = progress.stages.get(s.id);
    const m = s.lastMove;
    return {
      key: KIND_KEY[s.kind],
      kind: s.kind,
      label: s.name,
      plannedStart: s.plannedStart,
      plannedEnd: s.plannedEnd,
      originalEnd: s.originalEnd,
      actualEnd: s.actualEnd,
      forecastEnd: s.forecastEnd,
      state: s.state,
      status: s.status,
      lateDays: s.lateDays,
      earlyDays: s.earlyDays,
      checklist: { done: c.done, total: c.total },
      // A stage with no step in scope is as done as the stage itself.
      progressPct: sp?.pct ?? (s.actualEnd ? 100 : 0),
      steps: items.map((it) => ({
        label: it.label,
        group: it.room,
        pct: bpToPct(progress.weights.get(it.key) ?? 0),
        done: it.doneAt !== null,
        doneOn: it.doneAt ? day(it.doneAt) : null,
        plannedOn: it.plannedOn ? dayFromDb(it.plannedOn) : null,
      })),
      moved: m
        ? {
            from: m.from,
            to: m.to,
            reason: m.reason,
            customer: isCustomerDelay(m),
            words: moveSentence({ stageName: s.name, field: m.field, from: m.from, to: m.to, reason: m.reason, decisionId: m.decisionId }),
          }
        : null,
    };
  });

  const currentIndex = statuses.findIndex((s) => s.state === 'now');
  const current =
    currentIndex >= 0
      ? {
          key: KIND_KEY[statuses[currentIndex]!.kind],
          label: statuses[currentIndex]!.name,
          rooms: byRoom(milestones[currentIndex]!),
        }
      : null;

  return {
    tracker: { progressPct: steps.some((l) => l.length) ? progress.pct : stages.every((s) => s.actualEnd) ? 100 : 0, stages, current, moves: movesOf(changes, names, handover?.id ?? null), overall: {

      plannedHandover: overall.plannedHandover,
      forecastHandover: overall.forecastHandover,
      handedOver: overall.handedOver,
      lateDays: overall.lateDays,
      earlyDays: overall.earlyDays,
      customerDays: overall.customerDays,
      studioDays: overall.studioDays,
    } },
    overallLateDays: overall.lateDays,
    stageStatus: cur ? { key: KIND_KEY[cur.kind], label: cur.name, status: cur.status, lateDays: cur.lateDays } : null,
  };
}

function byRoom(items: readonly { room: string; label: string; doneAt: Date | null }[]): { room: string; items: { label: string; done: boolean }[] }[] {
  const rooms = new Map<string, { label: string; done: boolean }[]>();
  for (const it of items) {
    const list = rooms.get(it.room) ?? [];
    list.push({ label: it.label, done: it.doneAt !== null });
    rooms.set(it.room, list);
  }
  return [...rooms.entries()].map(([room, list]) => ({ room, items: list }));
}

/**
 * One entry per move. A move writes all its rows with the same `at`
 * (plan-edit.ts), so rows sharing an instant are one move: the first row
 * (the stage the PM picked) leads, and a handover row in the same move
 * becomes "Handover moves to …".
 */
export function movesOf(changes: readonly RuleChange[], names: ReadonlyMap<string, string>, handoverId: string | null): CustomerMove[] {
  const groups = new Map<number, RuleChange[]>();
  for (const c of changes) {
    const k = c.at.getTime();
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const out: CustomerMove[] = [];
  for (const [at, rows] of groups) {
    const lead = rows[0]!;
    const hand = rows.find((r) => r !== lead && (r.field === 'HANDOVER' || (r.field === 'PLANNED_END' && r.stageId !== null && r.stageId === handoverId)));
    const stage = lead.stageId ? (names.get(lead.stageId) ?? null) : null;
    const handoverTo = hand ? hand.to : null;
    out.push({
      at: new Date(at).toISOString(),
      stage: lead.field === 'HANDOVER' ? (stage ?? 'Handover') : stage,
      field: lead.field === 'HANDOVER' ? 'handover' : lead.field === 'PLANNED_START' ? 'start' : 'end',
      from: lead.from,
      to: lead.to,
      reason: lead.reason,
      customer: isCustomerDelay(lead),
      byDecision: lead.decisionId !== null,
      handoverTo,
      words: moveSentence({ stageName: stage ?? 'Handover', field: lead.field, from: lead.from, to: lead.to, reason: lead.reason, decisionId: lead.decisionId, handoverTo }),
    });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
