/**
 * "Use the Hauspire pipeline" (owner, 12 Oct 2026): Hauspire's columns as a
 * one-click preset in Settings → Pipeline. Pure, tested in
 * tests/studio-leads-look.test.ts; `stages.ts applyHauspirePipeline` writes it.
 *
 * It only adds and renames, and puts the preset's columns first in its
 * order. It never deletes a column (a column holding leads cannot go
 * anyway), and a column of yours it does not know keeps its place after
 * the preset's.
 */

import type { ColourToken, StageKindName } from './vocabulary';

export interface PresetStage {
  name: string;
  kind: StageKindName;
  colour: ColourToken;
  isIntake?: boolean;
}

export const HAUSPIRE_PIPELINE: readonly PresetStage[] = [
  { name: 'New', kind: 'OPEN', colour: 'blue', isIntake: true },
  { name: 'Calling 1', kind: 'OPEN', colour: 'slate' },
  { name: 'Calling 2', kind: 'OPEN', colour: 'slate' },
  { name: 'Calling 3', kind: 'OPEN', colour: 'slate' },
  { name: 'Calling 4', kind: 'OPEN', colour: 'slate' },
  { name: 'Junk', kind: 'OPEN', colour: 'rose' },
  { name: 'Effective Lead', kind: 'OPEN', colour: 'teal' },
  { name: 'Requirement / Floor Plan Pending', kind: 'OPEN', colour: 'amber' },
  { name: 'Quotation Pending', kind: 'OPEN', colour: 'amber' },
  { name: 'Quotation Shared', kind: 'OPEN', colour: 'orange' },
  { name: 'Visit Planned', kind: 'OPEN', colour: 'violet' },
  { name: 'Office Visit Done', kind: 'OPEN', colour: 'violet' },
  { name: 'Revised Quotation Pending', kind: 'OPEN', colour: 'orange' },
  { name: 'Finalisation', kind: 'OPEN', colour: 'teal' },
  { name: 'Converted', kind: 'WON', colour: 'green' },
  { name: 'Future Requirement', kind: 'OPEN', colour: 'slate' },
  { name: 'Lost', kind: 'LOST', colour: 'rose' },
];

export interface ExistingStage {
  id: string;
  name: string;
  kind: StageKindName;
  isIntake: boolean;
  sortOrder: number;
}

export interface PresetPlan {
  renames: { id: string; from: string; to: string }[];
  creates: PresetStage[];
  /** Final order: an existing id, or `new:<name>`. */
  order: string[];
  /** The id (or `new:<name>`) to make the intake column. */
  intake: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * What applying the preset would do. A preset column matches one of yours by
 * name (any case); "New" otherwise takes over your intake column, "Lost" your
 * first lost column and "Converted" your first won column — renamed, leads
 * and all. Everything else is created.
 */
export function planPreset(existing: readonly ExistingStage[], preset: readonly PresetStage[] = HAUSPIRE_PIPELINE): PresetPlan {
  const sorted = [...existing].sort((a, b) => a.sortOrder - b.sortOrder);
  const used = new Set<string>();
  const renames: PresetPlan['renames'] = [];
  const creates: PresetStage[] = [];
  const slots: string[] = [];
  const presetNames = new Set(preset.map((p) => norm(p.name)));

  for (const p of preset) {
    let match = sorted.find((s) => !used.has(s.id) && norm(s.name) === norm(p.name));
    if (!match) {
      /* Take over a column of the same meaning — but never one whose own
         name is another preset column (that one will be matched by name). */
      const free = (s: ExistingStage) => !used.has(s.id) && !presetNames.has(norm(s.name));
      if (p.isIntake) match = sorted.find((s) => free(s) && s.isIntake);
      else if (p.kind === 'LOST') match = sorted.find((s) => free(s) && s.kind === 'LOST');
      else if (p.kind === 'WON') match = sorted.find((s) => free(s) && s.kind === 'WON');
      if (match) renames.push({ id: match.id, from: match.name, to: p.name });
    }
    if (match) {
      used.add(match.id);
      slots.push(match.id);
    } else {
      creates.push(p);
      slots.push(`new:${p.name}`);
    }
  }

  const rest = sorted.filter((s) => !used.has(s.id)).map((s) => s.id);
  const intakePreset = preset.find((p) => p.isIntake);
  const intakeSlot = intakePreset ? slots[preset.indexOf(intakePreset)]! : (sorted.find((s) => s.isIntake)?.id ?? slots[0]!);
  return { renames, creates, order: [...slots, ...rest], intake: intakeSlot };
}

/** "Adds 12 columns, renames Enquiry to New and Booked to Converted." */
export function presetSummary(plan: PresetPlan): string {
  const bits: string[] = [];
  if (plan.creates.length) bits.push(`adds ${plan.creates.length} column${plan.creates.length === 1 ? '' : 's'}`);
  if (plan.renames.length) bits.push(`renames ${plan.renames.map((r) => `${r.from} to ${r.to}`).join(', ')}`);
  if (!bits.length) return 'Your pipeline already matches; this only puts the columns in Hauspire’s order.';
  const s = bits.join(', and ');
  return `${s[0]!.toUpperCase()}${s.slice(1)}. Nothing is deleted; your other columns stay, after these.`;
}
