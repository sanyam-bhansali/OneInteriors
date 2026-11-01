/**
 * Projects by designer (owner, 1 Nov 2026: "for the project head and the
 * owner, an option to filter projects by designer"). The board's own cards
 * say who designs each project, so the filter reads nothing more: the
 * choices are the designers on the cards, plus "No designer yet". Only a
 * studio-wide board (owner, PM, design head) offers it; a designer's board
 * is already theirs alone.
 *
 * Pure, tested in tests/studio-app-kpis.test.ts.
 */

/** `?designer=none`: projects nobody designs yet. */
export const NO_DESIGNER = 'none';

export interface DesignerChoice {
  id: string;
  name: string;
  projects: number;
}

/** Every designer on the cards, by name, then "No designer yet" when there are such projects. */
export function designerChoices(cards: readonly { designerId: string | null; designer: string | null }[]): DesignerChoice[] {
  const by = new Map<string, DesignerChoice>();
  let none = 0;
  for (const c of cards) {
    if (!c.designerId) {
      none += 1;
      continue;
    }
    const d = by.get(c.designerId) ?? { id: c.designerId, name: c.designer?.trim() || 'Designer', projects: 0 };
    d.projects += 1;
    by.set(c.designerId, d);
  }
  const out = [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (none) out.push({ id: NO_DESIGNER, name: 'No designer yet', projects: none });
  return out;
}

/** The designer asked for, when it is one of the choices; else null (everyone). */
export function pickDesigner(raw: string | undefined, choices: readonly DesignerChoice[]): string | null {
  const v = String(raw ?? '').slice(0, 64);
  return choices.some((c) => c.id === v) ? v : null;
}

/** Is this project the picked designer's? Null picks everyone. */
export const byDesigner = (designerId: string | null, picked: string | null): boolean =>
  picked === null || (picked === NO_DESIGNER ? designerId === null : designerId === picked);
