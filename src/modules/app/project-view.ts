/**
 * The after-signing screens' data, from a real project
 * (docs/CUSTOMER-PLATFORM-PLAN.md, step 1). Pure, and tested.
 *
 * The screens were drawn against the example project; this turns what the
 * API returns into the same pieces, and leaves out what a real project does
 * not record yet (payments made, the week strip) rather than inventing it.
 */

import { formatINR } from '@/lib/money';
import type { DecisionOption, DecisionState } from '@/modules/portal/decisions';

/** The short stage names the hero tracker has room for. */
export const STAGE_SHORT: Record<string, string> = {
  DESIGN: 'Design',
  PRODUCTION: 'Factory',
  SITE: 'Site work',
  INSTALL: 'Install',
  FINISH: 'Finish',
  HANDOVER: 'Handover',
};

export interface WireStage {
  key: string;
  label: string;
  targetOn: string;
  state: 'done' | 'now' | 'next' | 'later';
  late: boolean;
}

export interface WireDecision {
  id: string;
  title: string;
  why: string;
  dueOn: string;
  daysLeft: number;
  state: DecisionState;
  options: DecisionOption[];
  chosenIndex: number | null;
}

const IST = 'Asia/Kolkata';
export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }).replace(',', '');
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST }).toLowerCase();

/** "In quote" or "+₹14,500", as each option's price reads on the decision screen. */
export function optionPrice(o: DecisionOption): string {
  return o.extraPaise > 0 ? `+${formatINR(o.extraPaise)}` : 'In quote';
}

/** The stage happening now (or the last one when all are done), with its index. */
export function currentStage(stages: WireStage[]): { index: number; stage: WireStage | null } {
  const i = stages.findIndex((s) => s.state === 'now');
  if (i >= 0) return { index: i, stage: stages[i]! };
  return stages.length ? { index: stages.length, stage: null } : { index: 0, stage: null };
}

/** Day N of M since the project started, M being the planned days to handover. */
export function dayOf(startOn: string, stages: WireStage[], now = new Date()): { day: number; of: number } {
  const start = Date.parse(startOn);
  const end = stages.length ? Date.parse(stages[stages.length - 1]!.targetOn) : start;
  const DAY = 86_400_000;
  return { day: Math.max(1, Math.floor((now.getTime() - start) / DAY) + 1), of: Math.max(1, Math.round((end - start) / DAY)) };
}

/** How late the project runs: the latest stage past its target and not done, in whole days; 0 when on time. */
export function daysLate(stages: WireStage[], now = new Date()): number {
  const late = stages.filter((s) => s.late).map((s) => Math.floor((now.getTime() - Date.parse(s.targetOn)) / 86_400_000));
  return late.length ? Math.max(0, ...late) : 0;
}

/** The decision a screen should lead with: the asked-for one, else the first still open, else the latest. */
export function pickDecision(decisions: WireDecision[], id: string | null): WireDecision | null {
  if (id) {
    const hit = decisions.find((d) => d.id === id);
    if (hit) return hit;
  }
  return decisions.find((d) => d.state === 'due-soon' || d.state === 'open') ?? decisions[decisions.length - 1] ?? null;
}
