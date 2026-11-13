/**
 * Expected closing (owner, 13 Nov 2026: "I need to see when, per the system,
 * my closure will be. I have to close 35 projects by December end."): every
 * running project with the day the system now expects its handover, sorted
 * by that day, against a target day (31 Dec of this year unless the URL says
 * ?by=YYYY-MM-DD).
 *
 * The expected day is the tracker's own forecast handover (project-rules.ts
 * `overallDelay`, through workspace-view.ts `overallOf`), so this list, the
 * project page and the client's app cannot disagree. "Days late" is the same
 * "Overall · n days late": working days from the handover as first planned.
 * A project on hold is never late (owner, 12 Nov 2026).
 *
 * Also the on-site carcass flag (owner, 13 Nov 2026: "which projects can we
 * take manual?"): carcass built on site, only the shutters from the factory.
 *
 * Pure; the reads are in expected-closing-store.ts. Tested in
 * tests/expected-closing.test.ts.
 */

import { isDay } from '@/modules/project/working-days';
import { mayApproveHold } from '@/modules/studio-hold/rules';
import { can, type MemberRole } from './roles';
import { overallOf, type WorkspaceInput } from './workspace-view';

/** Running: not handed over yet. Closure, snags, warranty and closed are past the handover. */
export const RUNNING_PHASES = ['DESIGN', 'PRE_EXECUTION', 'EXECUTION'] as const;
export type RunningPhase = (typeof RUNNING_PHASES)[number];
export const isRunningPhase = (v: unknown): v is RunningPhase => typeof v === 'string' && (RUNNING_PHASES as readonly string[]).includes(v);

export const RUNNING_PHASE_LABEL: Record<RunningPhase, string> = { DESIGN: 'Design', PRE_EXECUTION: 'Pre-execution', EXECUTION: 'Execution' };

/**
 * Who sees the list and sets the on-site carcass flag: the owner, the design
 * head (as for a hold, studio-hold/rules.ts) and a PM (`plan.edit`, on their
 * own projects). Developer view-as reads the list but never sets the flag.
 */
export function maySeeClosing(m: MemberRole & { designHead?: boolean | null }): boolean {
  if (!can(m, 'project.read', { assigned: true })) return false;
  return mayApproveHold(m) || (m.role === 'PM' && can(m, 'plan.edit', { assigned: true }));
}

export function mayFlagCarcass(m: MemberRole & { designHead?: boolean | null }): boolean {
  return m.viewOnly !== true && maySeeClosing(m);
}

/** The target day: ?by=YYYY-MM-DD when it is a real day, else 31 Dec of today's year. */
export function targetDay(raw: string | undefined | null, today: string): string {
  return raw && isDay(raw) ? raw : `${today.slice(0, 4)}-12-31`;
}

export interface ClosingInput extends Pick<WorkspaceInput, 'planStages' | 'dateChanges' | 'calendar'> {
  id: string;
  client: string;
  home: string;
  phase: RunningPhase;
  designer: string | null;
  category: string | null;
  onHold: boolean;
  onSiteCarcass: boolean;
}

export interface ClosingRow {
  id: string;
  client: string;
  home: string;
  phase: RunningPhase;
  phaseLabel: string;
  designer: string | null;
  category: string | null;
  /** The handover the system now expects; null without a plan. */
  expectedOn: string | null;
  /** The handover as first planned; null without a plan. */
  plannedOn: string | null;
  /** Working days late against the first plan; 0 on hold. */
  lateDays: number;
  onHold: boolean;
  onSiteCarcass: boolean;
}

/** One project's row; null when its handover is already done (it is past running). */
export function closingRow(p: ClosingInput, now: Date): ClosingRow | null {
  const o = overallOf(p, now);
  if (o?.handedOver) return null;
  return {
    id: p.id,
    client: p.client,
    home: p.home,
    phase: p.phase,
    phaseLabel: RUNNING_PHASE_LABEL[p.phase],
    designer: p.designer,
    category: p.category,
    expectedOn: o?.forecastHandover ?? null,
    plannedOn: o?.plannedHandover ?? null,
    lateDays: p.onHold ? 0 : (o?.lateDays ?? 0),
    onHold: p.onHold,
    onSiteCarcass: p.onSiteCarcass,
  };
}

export interface ClosingList {
  rows: ClosingRow[];
  /** The target day, 'YYYY-MM-DD'. */
  by: string;
  /** Rows expected to close on or before `by`. */
  inTime: number;
  /** Rows expected after `by`, or with no plan to tell. */
  after: number;
}

/** Earliest expected first; no plan last; then by client. Counts against the target day. */
export function closingList(rows: readonly ClosingRow[], by: string): ClosingList {
  const sorted = [...rows].sort((a, b) => {
    if (a.expectedOn !== b.expectedOn) {
      if (a.expectedOn === null) return 1;
      if (b.expectedOn === null) return -1;
      return a.expectedOn < b.expectedOn ? -1 : 1;
    }
    return a.client.localeCompare(b.client);
  });
  const inTime = sorted.filter((r) => isInTime(r, by)).length;
  return { rows: sorted, by, inTime, after: sorted.length - inTime };
}

/** Expected on or before the target day. No plan is never in time: nobody can say. */
export const isInTime = (r: Pick<ClosingRow, 'expectedOn'>, by: string): boolean => r.expectedOn !== null && r.expectedOn <= by;
