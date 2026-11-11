import { describe, expect, it } from 'vitest';
import { clusterSocieties, matchSociety, parseSociety, sameSociety, tidySocietyName } from '@/modules/studio-practice/society-match';

const same = (a: string, b: string) => sameSociety(parseSociety(a), parseSociety(b));

describe('Society names: typos merge, phases and towers never do (Hauspire’s real names)', () => {
  it('merges typos and filler words', () => {
    expect(same('Godrej Medow', 'Godrej Meadows')).toBe(true);
    expect(same('Kohinoor sports villa', 'Kohinoor Sportsville')).toBe(true);
    expect(same('VTP SEIRRA', 'vtp sierra')).toBe(true);
    expect(same('Global Inspira', 'Global insperia')).toBe(true);
    expect(same('star solesta', 'Star Solasta')).toBe(true);
    expect(same('MY HOME', 'My Home Society')).toBe(true);
    expect(same('canary', 'The Canary')).toBe(true);
    expect(same('Godrej Woods ville', 'Godrej Woodsville')).toBe(true);
    expect(same('BELLA CASA NEW DATA', 'Bella Casa')).toBe(true);
    expect(same('4th Axis (Punawale)', '4th Axis')).toBe(true);
  });

  it('never merges different phases, towers, numbers or different societies', () => {
    expect(same('The Canary Phase I', 'The Canary Phase 2')).toBe(false);
    expect(same('Neelanchal Phase I', 'Neelanchal Phase II')).toBe(false);
    expect(same('Nyati Era III', 'Nyati Era IV')).toBe(false);
    expect(same('27 Grand Residences Tower 1', '27 Grand Residences Tower 2')).toBe(false);
    expect(same('Vtp Sierra Phase1', 'VTP SEIRRA')).toBe(false);
    expect(same('MAHINDRA NESTOLGIA PHASE 1', 'Mahindra Nestalgia Ph2')).toBe(false);
    expect(same('Bella Casa', 'Bella Casa Royal')).toBe(false);
    expect(same('Sukhwani', 'Sukwani kingsway')).toBe(false);
    expect(same('Austin', 'Austin one')).toBe(false);
    expect(same('Arena', 'Aros')).toBe(false);
  });

  it('takes a wing out of the name', () => {
    expect(parseSociety('Eastern River Residency Wing D')).toMatchObject({ base: 'Eastern River Residency', wing: 'D' });
    expect(parseSociety('VJ Supernova B Wing')).toMatchObject({ base: 'VJ Supernova', wing: 'B' });
    expect(parseSociety('Anshul Casa J Building')).toMatchObject({ base: 'Anshul Casa', wing: 'J' });
    expect(parseSociety('Legacy Kairos A And B Building')).toMatchObject({ base: 'Legacy Kairos', wing: 'A & B' });
    expect(parseSociety('Basil Maximus Wing D And E')).toMatchObject({ base: 'Basil Maximus', wing: 'D & E' });
    expect(same('Eastern River Residency Wing D', 'EASTERN RIVER RESIDENCY')).toBe(true);
    expect(parseSociety('Presidential Towers').wing).toBeNull();
  });

  it('reads "A / B" as A, and knows sources are not societies', () => {
    expect(parseSociety('Bella Casa Royal / Canary').base).toBe('Bella Casa Royal');
    expect(parseSociety('Refferal / VTP SEIRRA')).toMatchObject({ base: 'VTP SEIRRA', notSociety: false });
    expect(parseSociety('Direct Lead / KUNAL CANARY').base).toBe('KUNAL CANARY');
    for (const n of ['Digital', 'Direct Visit', 'Direct call', 'Refferal', 'Instagram lead', 'Sanyam Digital Lead', 'Livspace', 'Square yard', 'Commercial Digital', 'Montage Brochure']) {
      expect(parseSociety(n).notSociety, n).toBe(true);
    }
    expect(parseSociety('Godrej Meadows').notSociety).toBe(false);
  });

  it('groups names into societies, most-used spelling first', () => {
    const { clusters, notSocieties } = clusterSocieties([
      { name: 'Godrej Meadows', leads: 1093 },
      { name: 'Godrej Medow', leads: 16 },
      { name: 'MY HOME', leads: 39 },
      { name: 'My Home Society', leads: 153 },
      { name: 'EASTERN RIVER RESIDENCY', leads: 211 },
      { name: 'Eastern River Residency Wing D', leads: 118 },
      { name: 'The Canary Phase 2', leads: 465 },
      { name: 'The Canary Phase I', leads: 12 },
      { name: 'Digital', leads: 175 },
    ]);
    const by = Object.fromEntries(clusters.map((c) => [c.name, c.leads]));
    expect(by).toEqual({ 'Godrej Meadows': 1109, 'Eastern River Residency': 329, 'The Canary Phase 2': 465, 'My Home Society': 192, 'The Canary Phase I': 12 });
    expect(clusters.find((c) => c.name === 'Godrej Meadows')!.aliases).toEqual(['godrejmedow']);
    expect(notSocieties.map((n) => n.name)).toEqual(['Digital']);
  });

  it('finds the society for a newly typed name, typos included', () => {
    const list = [
      { id: 'a', key: 'godrejmeadows', aliases: ['godrejmedow'] },
      { id: 'b', key: parseSociety('The Canary Phase 2').key, aliases: [] },
    ];
    expect(matchSociety('Godrej Medow', list)?.id).toBe('a');
    expect(matchSociety('godrej meadow', list)?.id).toBe('a');
    expect(matchSociety('The Canary Phase II', list)?.id).toBe('b');
    expect(matchSociety('The Canary Phase I', list)).toBeNull();
    expect(matchSociety('Digital', list)).toBeNull();
  });

  it('tidies names typed in one case', () => {
    expect(tidySocietyName('GODREJ MEADOWS')).toBe('Godrej Meadows');
    expect(tidySocietyName('godrej hill retreat')).toBe('Godrej Hill Retreat');
    expect(tidySocietyName('VTP Seirra')).toBe('VTP Seirra');
  });
});
