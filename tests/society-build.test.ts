import { describe, expect, it } from 'vitest';
import { planSocietyBuild, type BuildLead } from '@/modules/studio-practice/society-build';

let n = 0;
const lead = (society: string | null, extra: Partial<BuildLead> = {}): BuildLead => ({ id: `l${n++}`, society, locality: null, wing: null, assignedToId: null, ...extra });

describe('Building societies from leads', () => {
  it('makes a society for names on 3+ leads, merging typos, and leaves the rest', () => {
    const leads = [
      lead('Godrej Meadows', { assignedToId: 'asha', locality: 'Hinjewadi', wing: 'b wing' }),
      lead('Godrej Meadows', { assignedToId: 'asha', locality: 'Hinjewadi', wing: 'A' }),
      lead('Godrej Medow', { assignedToId: 'ravi', locality: 'Hinjewadi' }),
      lead('Eastern River Residency Wing D'),
      lead('EASTERN RIVER RESIDENCY'),
      lead('Eastern River Residency'),
      lead('Tiny Towers'),
      lead('Digital'),
      lead(null),
    ];
    const plan = planSocietyBuild(leads, [], 3);
    expect(plan.societies.map((s) => [s.name, s.leads, s.wings, s.ownerId, s.locality])).toEqual([
      ['Eastern River Residency', 3, ['D'], null, null],
      ['Godrej Meadows', 3, ['A', 'B'], 'asha', 'Hinjewadi'],
    ]);
    const gm = plan.societies.find((s) => s.name === 'Godrej Meadows')!;
    const er = plan.societies.find((s) => s.name === 'Eastern River Residency')!;
    expect(gm.aliases).toEqual(['godrejmedow']);
    expect(plan.small.map((s) => s.name)).toEqual(['Tiny Towers']);
    expect(plan.notSocieties.map((s) => s.name)).toEqual(['Digital']);
    expect(plan.links.size).toBe(6);
    expect(plan.links.get(leads[0]!.id)).toEqual({ ref: gm.ref, wing: 'B' });
    expect(plan.links.get(leads[3]!.id)).toEqual({ ref: er.ref, wing: 'D' });
  });

  it('reuses an existing society, even for a group under the minimum, and adds the spellings', () => {
    const leads = [lead('godrej medow'), lead('Godrej Meadows')];
    const plan = planSocietyBuild(leads, [{ id: 'gm', name: 'Godrej Meadows', aliases: [] }], 3);
    expect(plan.societies).toHaveLength(1);
    expect(plan.societies[0]).toMatchObject({ ref: 'gm', existing: true, name: 'Godrej Meadows', leads: 2 });
    expect(plan.societies[0]!.aliases).toEqual(['godrejmedow']);
    expect([...plan.links.values()].every((l) => l.ref === 'gm')).toBe(true);
  });

  it('gives a society to nobody when most of its leads are nobody’s', () => {
    const plan = planSocietyBuild([lead('Aros', { assignedToId: 'asha' }), lead('Aros'), lead('Aros')], [], 3);
    expect(plan.societies[0]!.ownerId).toBeNull();
  });
});
