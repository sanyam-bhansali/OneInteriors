import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanFileName, incentiveTotals, parseMonth, parseRupees, REQUIRED_DOCS, salaryOn, STAFF_DOCS_LIMIT_BYTES, staffDocPath, staffFileError } from '@/modules/staff/rules';

/* Owner, 21 Nov 2026: employee records — 50 MB of documents (Aadhaar, offer letter, PAN, address proof, photo), salary, incentives and payouts, devices. */
const MB = 1024 * 1024;

describe('documents', () => {
  it('the five every employee should have', () => {
    expect(REQUIRED_DOCS).toEqual(['AADHAAR', 'PAN', 'OFFER_LETTER', 'ADDRESS_PROOF', 'PHOTO']);
  });

  it('JPG, PNG, WebP or PDF, up to 3.8 MB each and 50 MB a person', () => {
    expect(staffFileError({ type: 'application/pdf', size: 2 * MB }, 0)).toBeNull();
    expect(staffFileError({ type: 'image/heic', size: MB }, 0)).toMatch(/JPG, PNG, WebP or PDF/);
    expect(staffFileError({ type: 'image/jpeg', size: 4 * MB }, 0)).toMatch(/3\.8 MB/);
    expect(staffFileError({ type: 'image/jpeg', size: 0 }, 0)).toMatch(/empty/);
    expect(staffFileError({ type: 'image/jpeg', size: 2 * MB }, STAFF_DOCS_LIMIT_BYTES - MB)).toMatch(/50 MB/);
    expect(STAFF_DOCS_LIMIT_BYTES).toBe(50 * MB);
  });

  it('kept under the studio and the person, in the private bucket', () => {
    expect(staffDocPath('s1', 'm1', 'AADHAAR', 'u', 'pdf')).toBe('studio_s1/staff_m1/aadhaar-u.pdf');
    expect(cleanFileName('', 'PAN')).toBe('PAN card');
  });
});

describe('salary and incentives', () => {
  it('the salary in force: the latest that has started', () => {
    const rows = [
      { fromDay: '2026-04-01', monthlyPaise: 30_000_00 },
      { fromDay: '2026-10-01', monthlyPaise: 35_000_00 },
      { fromDay: '2027-04-01', monthlyPaise: 40_000_00 },
    ];
    expect(salaryOn(rows, '2026-11-22')?.monthlyPaise).toBe(35_000_00);
    expect(salaryOn(rows, '2026-03-01')).toBeNull();
  });

  it('earned, paid out, owed', () => {
    expect(incentiveTotals([{ amountPaise: 5_000_00, paid: true }, { amountPaise: 3_000_00, paid: false }])).toEqual({ earned: 8_000_00, paid: 5_000_00, owed: 3_000_00 });
  });

  it('amounts and months typed', () => {
    expect(parseRupees('35,000')).toBe(35_000_00);
    expect(parseRupees('-5')).toBeNull();
    expect(parseMonth('2026-11')).toBe('2026-11');
    expect(parseMonth('2026-13')).toBeNull();
  });
});

describe('who sees it', () => {
  it('owner and accounts only, never view-only', () => {
    const store = readFileSync('src/modules/staff/store.ts', 'utf8');
    /* Active only too (audit, 24 Nov 2026): a suspended member's live session reads nothing. */
    expect(store).toContain("m !== null && m.status === 'ACTIVE' && !m.viewOnly && (m.role === 'OWNER' || m.role === 'ACCOUNTS')");
    const migration = readFileSync('prisma/migrations/20261122100000_employee_records/migration.sql', 'utf8');
    for (const t of ['studio_staff_records', 'studio_staff_docs', 'studio_staff_salaries', 'studio_staff_incentives', 'studio_staff_devices']) {
      expect(migration).toContain(`REVOKE ALL ON "${t}" FROM anon, authenticated;`);
    }
  });
});
