import { describe, it, expect } from 'vitest';
import {
  briefSummary,
  budgetPhrase,
  cardFacts,
  firstActionOn,
  monthYear,
  type BriefFacts,
} from '@/modules/studio-practice/bridge-facts';

/**
 * The card a studio reads at 9am.
 *
 * None of this fails visibly — a wrong label is just a wrong label until
 * somebody quotes the wrong flat — so it is tested against the shapes that
 * actually occur: a full brief, an abandoned one, and the several ways an
 * enum can be wider than the TypeScript union that names it.
 */

const FULL: BriefFacts = {
  propertyType: 'BHK_3',
  carpetAreaSqft: 1150,
  locality: 'baner',
  scope: 'FULL_HOME',
  tier: 'PREMIUM',
  budgetMinLakhs: 12,
  budgetMaxLakhs: 18,
  moveInBy: new Date('2027-03-01T00:00:00Z'),
  possessionOn: new Date('2026-12-01T00:00:00Z'),
};

const EMPTY: BriefFacts = {
  propertyType: null,
  carpetAreaSqft: null,
  locality: null,
  scope: null,
  tier: null,
  budgetMinLakhs: null,
  budgetMaxLakhs: null,
  moveInBy: null,
  possessionOn: null,
};

describe('budgetPhrase', () => {
  it('reads like someone saying it out loud', () => {
    expect(budgetPhrase(12, 18)).toBe('₹12L–₹18L');
  });

  it('drops the trailing zero rather than printing 12.0', () => {
    expect(budgetPhrase(12, 18)).not.toContain('12.0');
    expect(budgetPhrase(12.5, 18)).toBe('₹12.5L–₹18L');
  });

  it('collapses an equal pair — a range of one is not a range', () => {
    expect(budgetPhrase(15, 15)).toBe('about ₹15L');
  });

  it('handles one-sided budgets', () => {
    expect(budgetPhrase(null, 18)).toBe('up to ₹18L');
    expect(budgetPhrase(12, null)).toBe('from ₹12L');
  });

  it('is null when they said nothing', () => {
    expect(budgetPhrase(null, null)).toBeNull();
  });
});

describe('briefSummary', () => {
  it('puts the property, the job and the timing in three sentences', () => {
    const s = briefSummary(FULL);
    expect(s).toContain('3 BHK');
    expect(s).toContain('Baner');
    expect(s).toContain('1,150 sqft');
    expect(s).toContain('Full home');
    expect(s).toContain('Premium finish');
    expect(s).toContain('₹12L–₹18L');
    expect(s).toContain('March 2027');
  });

  it('prefers move-in over possession — one is a target, the other is fixed', () => {
    expect(briefSummary(FULL)).not.toContain('December 2026');
    expect(briefSummary({ ...FULL, moveInBy: null })).toContain('Possession December 2026');
  });

  it('never prints "undefined" for an enum wider than the TS union', () => {
    /* PropertyType carries an OTHER the quiz never writes; a future migration
       can add more. This is the exact bug `propertyLabel` exists to prevent. */
    const odd = briefSummary({ ...FULL, propertyType: 'OTHER', scope: 'SOMETHING_NEW', tier: 'X' });
    expect(odd).not.toContain('undefined');
    expect(odd).toContain('Other');
  });

  it('never puts a comma before a preposition', () => {
    /* "3 BHK, in Baner" is the tell that a sentence was assembled by a
       machine. The place joins with a space, the size with a comma. */
    expect(briefSummary(FULL)).toContain('3 BHK in Baner, 1,150 sqft');
    expect(briefSummary(FULL)).not.toMatch(/,\s*in /);
  });

  it('degrades to a sentence however little is there', () => {
    const shapes = [
      { ...EMPTY, propertyType: 'BHK_2' },
      { ...EMPTY, locality: 'kharadi' },
      { ...EMPTY, carpetAreaSqft: 900 },
      { ...FULL, locality: null },
    ];
    for (const s of shapes) {
      const out = briefSummary(s);
      expect(out).not.toMatch(/,\s*\./);
      expect(out).not.toMatch(/\s,/);
      expect(out).not.toMatch(/,\s*in /);
      expect(out).not.toContain('undefined');
      expect(out).not.toContain('null');
    }
  });

  it('says so plainly rather than printing a row of blanks', () => {
    const s = briefSummary(EMPTY);
    expect(s).not.toContain('null');
    expect(s).not.toContain('undefined');
    expect(s).toContain('not filled in much');
  });
});

describe('cardFacts', () => {
  it('maps the columns the board actually renders', () => {
    const c = cardFacts(FULL);
    expect(c.config).toBe('3 BHK');
    expect(c.locality).toBe('Baner');
    expect(c.carpetSqft).toBe(1150);
    expect(c.summary.length).toBeGreaterThan(0);
  });

  it('is all-null-but-a-summary for an abandoned brief', () => {
    const c = cardFacts(EMPTY);
    expect(c.config).toBeNull();
    expect(c.locality).toBeNull();
    expect(c.carpetSqft).toBeNull();
    /* Never empty: the notes column is the only place that says where this
       lead came from. */
    expect(c.summary.length).toBeGreaterThan(0);
  });
});

describe('firstActionOn', () => {
  it('is tomorrow, not four minutes from now', () => {
    const introduced = new Date('2026-09-22T14:30:00');
    const due = firstActionOn(introduced);
    expect(due.getDate()).toBe(23);
    expect(due.getMonth()).toBe(8);
  });

  it('is 10am, not midnight — midnight sorts as already overdue', () => {
    const due = firstActionOn(new Date('2026-09-22T14:30:00'));
    expect(due.getHours()).toBe(10);
    expect(due.getMinutes()).toBe(0);
  });

  it('rolls over a month end', () => {
    const due = firstActionOn(new Date('2026-09-30T09:00:00'));
    expect(due.getMonth()).toBe(9); // October
    expect(due.getDate()).toBe(1);
  });

  it('does not mutate its argument', () => {
    const introduced = new Date('2026-09-22T14:30:00');
    firstActionOn(introduced);
    expect(introduced.getDate()).toBe(22);
    expect(introduced.getHours()).toBe(14);
  });
});

describe('monthYear', () => {
  it('is month precision, because that is the precision they gave', () => {
    expect(monthYear(new Date('2027-03-15T00:00:00Z'))).toBe('March 2027');
  });

  it('is null for null', () => {
    expect(monthYear(null)).toBeNull();
  });
});
