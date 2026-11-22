import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { balanceOf, differs, flagsFor, median, parseBillReply, parseRupees, readFlags, vendorKey, type FlagInput } from '@/modules/petty-cash/rules';

/* Owner, 21 Nov 2026: petty cash to site supervisors; expenses under a project with a mandatory bill; flags with reasons. */
const base: FlagInput = {
  amountPaise: 45_000,
  memberId: 'akash',
  memberName: 'Akash',
  projectName: 'Shubhangi · 3 BHK Baner',
  onSite: true,
  siteTeam: ['Sumil'],
  history: [40_000, 50_000, 30_000, 60_000, 45_000],
  sameHash: [],
  sameDetails: [],
  read: { isBill: true, amountPaise: 45_000, why: '' },
};
const codes = (x: Partial<FlagInput>) => flagsFor({ ...base, ...x }).map((f) => f.code);

describe('flags, each with a reason', () => {
  it('nothing off: no flag', () => {
    expect(flagsFor(base)).toEqual([]);
  });

  it('spent on a site they are not on: says who runs it', () => {
    const f = flagsFor({ ...base, onSite: false });
    expect(f.map((x) => x.code)).toEqual(['NOT_ON_SITE']);
    expect(f[0]!.reason).toBe("Akash is not on Shubhangi · 3 BHK Baner's team (Sumil runs it), yet spent on it.");
  });

  it('far above the usual, once there is enough history', () => {
    expect(codes({ amountPaise: 2_00_000 })).toEqual(['UNUSUAL_AMOUNT', 'AMOUNT_DIFFERS']);
    expect(flagsFor({ ...base, amountPaise: 2_00_000, read: null })[0]!.reason).toBe('₹2,000 is 4.4× the usual expense of ₹450.');
    expect(codes({ amountPaise: 2_00_000, history: [40_000, 50_000], read: null })).toEqual([]);
  });

  it('the same bill photo again, by them or by someone else', () => {
    expect(codes({ sameHash: [{ memberId: 'akash', memberName: 'Akash', day: '18 Nov', projectName: 'X' }] })).toEqual(['SAME_BILL']);
    const other = flagsFor({ ...base, sameHash: [{ memberId: 'sumil', memberName: 'Sumil', day: '18 Nov', projectName: 'X' }] });
    expect(other.map((x) => x.code)).toEqual(['BILL_BY_OTHER']);
    expect(other[0]!.reason).toBe('Sumil uploaded the same bill photo on 18 Nov, for X.');
  });

  it('a different photo of a bill with the same date, amount and shop', () => {
    expect(codes({ sameDetails: [{ memberName: 'Sumil', day: '18 Nov', projectName: 'X' }] })).toEqual(['SAME_DETAILS']);
  });

  it('the reader: not a bill, or a different amount (with a little room)', () => {
    expect(codes({ read: { isBill: false, amountPaise: null, why: 'a photo of a wall' } })).toEqual(['NOT_A_BILL']);
    expect(codes({ read: { isBill: true, amountPaise: 60_000, why: '' } })).toEqual(['AMOUNT_DIFFERS']);
    expect(codes({ read: { isBill: true, amountPaise: 45_500, why: '' } })).toEqual([]);
    expect(differs(45_500, 45_000)).toBe(false);
    expect(differs(60_000, 45_000)).toBe(true);
    // Reader down: no reader flags.
    expect(codes({ read: null })).toEqual([]);
  });
});

describe('money', () => {
  it('rupees typed', () => {
    expect(parseRupees('1,250')).toBe(1_25_000);
    expect(parseRupees('₹ 450.50')).toBe(45_050);
    expect(parseRupees('0')).toBeNull();
    expect(parseRupees('abc')).toBeNull();
    expect(parseRupees('9999999')).toBeNull();
  });

  it('what is still with a person: given − spent; rejected expenses do not count', () => {
    expect(
      balanceOf(
        [
          { amountPaise: 50_00_000, received: true },
          { amountPaise: 10_00_000, received: false },
        ],
        [
          { amountPaise: 12_00_000, rejected: false },
          { amountPaise: 3_00_000, rejected: true },
        ],
      ),
    ).toEqual({ given: 60_00_000, received: 50_00_000, spent: 12_00_000, pending: 48_00_000 });
  });

  it('the median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBeNull();
  });
});

describe('the bill reader’s reply', () => {
  it('reads the JSON, and refuses junk', () => {
    expect(parseBillReply('Sure: {"isBill": true, "amountRupees": 450, "date": "2026-11-20", "vendor": "Shree Hardware", "summary": "hinges", "why": ""}')).toEqual({
      ok: true,
      isBill: true,
      amountPaise: 45_000,
      day: '2026-11-20',
      vendor: 'Shree Hardware',
      summary: 'hinges',
      why: '',
    });
    expect(parseBillReply('no json')).toEqual({ ok: false, why: 'unreadable' });
    expect(vendorKey('Shree Hardware & Co.')).toBe('shreehardwareco');
  });

  it('stored flags drop anything unknown', () => {
    expect(readFlags([{ code: 'SAME_BILL', reason: 'x' }, { code: 'NOPE', reason: 'y' }, null])).toEqual([{ code: 'SAME_BILL', reason: 'x' }]);
  });
});

describe('wiring', () => {
  it('the bill is required, and the phone lists my sites first and every other site after', () => {
    const store = readFileSync('src/modules/petty-cash/store.ts', 'utf8');
    expect(store).toContain("return { ok: false, error: 'Add the bill photo or a screenshot of the payment. It is needed.' }");
    const ui = readFileSync('src/app/studio/site/cash/CashUi.tsx', 'utf8');
    expect(ui).toContain('<optgroup label="My sites">');
    expect(ui).toContain('<optgroup label="Other sites">');
  });

  it('only accounts gives cash and reviews', () => {
    const store = readFileSync('src/modules/petty-cash/store.ts', 'utf8');
    expect(store).toContain("if (!writer(me) || !isAccounts(me)) return { ok: false, error: 'Only the owner or accounts enters petty cash given.' };");
    expect(store).toContain("if (!writer(me) || !isAccounts(me)) return { ok: false, error: 'Only the owner or accounts reviews expenses.' };");
  });
});
