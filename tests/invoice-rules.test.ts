import { describe, expect, it } from 'vitest';
import {
  amountInWords,
  bareLabel,
  checkAccountNumber,
  checkIfsc,
  checkPrefix,
  checkSac,
  deliverableFor,
  fyLabel,
  indianFyStart,
  indianWords,
  invoiceFigures,
  invoiceNumber,
  prefixFromLegalName,
  receivedOn,
  stageGst,
  stateOf,
} from '@/modules/project/invoice-rules';
import { gstSplit } from '@/modules/project/project-gst';
import { PROJECT_EVENT_TYPES } from '@/modules/project/events';
import { mayOpen } from '@/modules/studio/surfaces';

describe('amount in words (Indian system)', () => {
  it('reads the approved sample', () => {
    expect(amountInWords(11_558_200)).toBe('Rupees One Lakh Fifteen Thousand Five Hundred Eighty-Two Only');
  });
  it('reads crore, lakh and thousand', () => {
    expect(indianWords(11_577_644)).toBe('One Crore Fifteen Lakh Seventy-Seven Thousand Six Hundred Forty-Four');
    expect(indianWords(100_000)).toBe('One Lakh');
    expect(indianWords(10_000_000)).toBe('One Crore');
    expect(indianWords(1_500_000_000)).toBe('One Hundred Fifty Crore');
    expect(indianWords(2_500_000)).toBe('Twenty-Five Lakh');
    expect(indianWords(1001)).toBe('One Thousand One');
    expect(indianWords(90)).toBe('Ninety');
    expect(indianWords(13)).toBe('Thirteen');
  });
  it('adds paise, and reads zero', () => {
    expect(amountInWords(317_550)).toBe('Rupees Three Thousand One Hundred Seventy-Five and Fifty Paise Only');
    expect(amountInWords(1)).toBe('Rupees Zero and One Paise Only');
    expect(amountInWords(0)).toBe('Rupees Zero Only');
  });
});

describe('invoice numbers', () => {
  it('uses the Indian financial year, April to March, in India time', () => {
    expect(indianFyStart(new Date('2026-11-21T10:00:00Z'))).toBe(2026);
    expect(indianFyStart(new Date('2027-03-31T10:00:00Z'))).toBe(2026);
    expect(indianFyStart(new Date('2027-04-01T10:00:00Z'))).toBe(2027);
    /* 31 Mar 2027 19:00 UTC is already 1 Apr in India. */
    expect(indianFyStart(new Date('2027-03-31T19:00:00Z'))).toBe(2027);
  });
  it('formats prefix/yy-yy/0001', () => {
    expect(fyLabel(2026)).toBe('26-27');
    expect(fyLabel(2099)).toBe('99-00');
    expect(invoiceNumber('HPL', 2025, 41)).toBe('HPL/25-26/0041');
    expect(invoiceNumber('HPL', 2026, 1)).toBe('HPL/26-27/0001');
    expect(invoiceNumber('HPL', 2026, 12345)).toBe('HPL/26-27/12345');
  });
  it('defaults the prefix to the legal name initials', () => {
    expect(prefixFromLegalName('Hauspire Private Limited')).toBe('HPL');
    expect(prefixFromLegalName('  urban  nest interiors llp ')).toBe('UNIL');
    expect(prefixFromLegalName('A & B Studio (Pune)')).toBe('ABSP');
    expect(prefixFromLegalName('')).toBe('INV');
    expect(prefixFromLegalName(null)).toBe('INV');
  });
  it('checks the typed prefix, SAC, IFSC and account number', () => {
    expect(checkPrefix(' hpl ')).toEqual({ ok: true, prefix: 'HPL' });
    expect(checkPrefix('')).toEqual({ ok: true, prefix: null });
    expect(checkPrefix('HP/L').ok).toBe(false);
    expect(checkPrefix('ABCDEFGHIJK').ok).toBe(false);
    expect(checkSac('998391')).toEqual({ ok: true, sac: '998391' });
    expect(checkSac('')).toEqual({ ok: true, sac: null });
    expect(checkSac('99x').ok).toBe(false);
    expect(checkIfsc('hdfc0001234')).toEqual({ ok: true, ifsc: 'HDFC0001234' });
    expect(checkIfsc('HDFC1001234').ok).toBe(false);
    expect(checkAccountNumber('5010 0123 4567')).toEqual({ ok: true, number: '501001234567' });
    expect(checkAccountNumber('12ab').ok).toBe(false);
  });
});

describe('GST on one stage', () => {
  it('matches the approved sample: share ₹6,351 on a 30% project', () => {
    const g = stageGst(635_100);
    expect(g.taxablePaise).toBe(3_528_333);
    expect(g.cgstPaise).toBe(317_550);
    expect(g.sgstPaise).toBe(317_550);
  });
  it('puts the odd paisa on SGST', () => {
    const g = stageGst(635_101);
    expect(g.cgstPaise + g.sgstPaise).toBe(635_101);
    expect(g.sgstPaise - g.cgstPaise).toBe(1);
  });
  it('splits the project GST over the stages after the design advance, and prints the stage', () => {
    const stages = [
      { label: 'Booking Advance (Fully refundable within 3 days)', pct: null, amountPaise: 2_500_000 },
      { label: 'Design Advance', pct: 5, amountPaise: 5_660_300 },
      { label: 'Design Closure', pct: 10, amountPaise: 10_923_100 + 635_100 },
    ];
    const shares = gstSplit(stages, 635_100 * 2);
    expect(shares[0]).toBe(0);
    expect(shares[1]).toBe(0);
    const f = invoiceFigures({ index: 2, label: 'Design Closure', pct: 10, signedPaise: 11_558_200, changesPaise: 0, amountPaise: 11_558_200, paidPaise: 11_558_200 }, 635_100);
    expect(f.title).toBe('TAX INVOICE');
    expect(f.stageLabel).toBe('Design Closure (10%)');
    expect(f.basePaise).toBe(10_923_100);
    expect(f.totalPaise).toBe(11_558_200);
    expect(f.balancePaise).toBe(0);
    const none = invoiceFigures({ index: 0, label: 'Booking Advance (Fully refundable within 3 days)', pct: null, signedPaise: 2_500_000, changesPaise: 0, amountPaise: 2_500_000, paidPaise: 0 }, 0);
    expect(none.title).toBe('INVOICE');
    expect(none.gst).toBeNull();
    expect(none.stageLabel).toBe('Booking Advance (Fully refundable within 3 days)');
    expect(none.balancePaise).toBe(2_500_000);
  });
  it('keeps changes landed on the stage apart from its base', () => {
    const f = invoiceFigures({ index: 5, label: 'Project Handover', pct: 5, signedPaise: 5_000_000, changesPaise: 300_000, amountPaise: 5_300_000, paidPaise: 1_000_000 }, 200_000);
    expect(f.basePaise).toBe(4_800_000);
    expect(f.basePaise + f.changesPaise + (f.gst?.gstPaise ?? 0)).toBe(f.totalPaise);
    expect(f.balancePaise).toBe(4_300_000);
  });
});

describe('what the invoice prints', () => {
  it('reads the state from the GSTIN', () => {
    expect(stateOf('27AABCH1234F1Z5')).toBe('Maharashtra (27)');
    expect(stateOf('29AABCH1234F1Z5')).toBe('Karnataka (29)');
    expect(stateOf(null)).toBe('Maharashtra (27)');
  });
  it('finds the stage deliverable by name, without the bold marks', () => {
    expect(bareLabel('Booking Advance (Fully refundable within 3 days)')).toBe('Booking Advance');
    const sched = [{ label: 'Design closure', note: 'Your design is **locked**.' }];
    expect(deliverableFor('Design Closure (10%)', [null, sched])).toBe('Your design is locked.');
    expect(deliverableFor('Site visit', [sched])).toBeNull();
  });
  it('gives the last payment day and one mode', () => {
    expect(receivedOn([])).toEqual({ day: null, mode: null });
    expect(receivedOn([{ receivedOn: '2026-11-18', mode: 'UPI' }, { receivedOn: '2026-11-02', mode: 'UPI' }])).toEqual({ day: '2026-11-18', mode: 'UPI' });
    expect(receivedOn([{ receivedOn: '2026-11-18', mode: 'UPI' }, { receivedOn: '2026-11-02', mode: 'CASH' }])).toEqual({ day: '2026-11-18', mode: null });
  });
  it('logs the issue as a project event', () => {
    expect(PROJECT_EVENT_TYPES).toContain('invoice.issued');
  });
});

describe('who opens invoices and their settings', () => {
  const m = (role: 'OWNER' | 'ACCOUNTS' | 'DESIGNER' | 'PM' | 'SUPERVISOR') => ({ role, status: 'ACTIVE' as const, designHead: false });
  it('an invoice: as the statement (accounts included); the settings: the owner only', () => {
    expect(mayOpen(m('ACCOUNTS'), '/studio/projects/p1/invoice/3')).toBe(true);
    expect(mayOpen(m('OWNER'), '/studio/projects/p1/invoice/3')).toBe(true);
    expect(mayOpen(m('SUPERVISOR'), '/studio/projects/p1/invoice/3')).toBe(false);
    expect(mayOpen(m('OWNER'), '/studio/settings/invoices')).toBe(true);
    expect(mayOpen(m('PM'), '/studio/settings/invoices')).toBe(false);
    expect(mayOpen(m('ACCOUNTS'), '/studio/settings/invoices')).toBe(false);
  });
});
