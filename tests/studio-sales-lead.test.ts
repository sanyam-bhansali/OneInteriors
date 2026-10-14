import { describe, expect, it } from 'vitest';
import {
  budgetText,
  checkLeadFile,
  editSummary,
  leadFilePath,
  meetingInputs,
  meetingLabel,
  nextStep,
  parseBudget,
  parseMeeting,
  pathBelongsTo,
  telLink,
  whatsappLink,
  LEAD_FILE_MAX_BYTES,
} from '@/modules/studio-sales/lead-rules';

/** Studio OS Phase 1: the lead page's small rules (docs/studio-os/PHASE-1-SALES.md §2). */

describe('the next step', () => {
  const base = { contacted: false, hasFloorPlan: false, quoteCount: 0, sentRevisions: 0, hasSalesFinal: false, booked: false };

  it('walks Call · Attach floor plan · New quotation · send · Mark sales final · Record booking', () => {
    expect(nextStep(base).label).toBe('Call');
    expect(nextStep({ ...base, contacted: true }).label).toBe('Attach floor plan');
    expect(nextStep({ ...base, contacted: true, hasFloorPlan: true }).label).toBe('New quotation');
    expect(nextStep({ ...base, contacted: true, hasFloorPlan: true, quoteCount: 1 }).id).toBe('open-quote');
    expect(nextStep({ ...base, contacted: true, quoteCount: 1, sentRevisions: 3 }).label).toBe('Mark sales final');
    expect(nextStep({ ...base, contacted: true, quoteCount: 1, sentRevisions: 3, hasSalesFinal: true }).label).toBe('Record booking');
    expect(nextStep({ ...base, booked: true }).id).toBe('booked');
  });

  it('a quotation without a floor plan does not send them back for one', () => {
    expect(nextStep({ ...base, contacted: true, quoteCount: 1, sentRevisions: 1 }).id).toBe('sales-final');
  });
});

describe('budget, as people say it', () => {
  it.each([
    ['12 lakh', 120_000_000],
    ['12L', 120_000_000],
    ['1.2 cr', 1_200_000_000],
    ['12,00,000', 120_000_000],
    ['₹ 8.5 lakhs', 85_000_000],
    ['900k', 90_000_000],
  ])('%s', (typed, paise) => {
    expect(parseBudget(typed)).toEqual({ ok: true, paise });
  });

  it('empty is no budget, nonsense is a question back', () => {
    expect(parseBudget('')).toEqual({ ok: true, paise: null });
    expect(parseBudget('about twelve').ok).toBe(false);
  });

  it('reads back short', () => {
    expect(budgetText(120_000_000)).toBe('₹12 L');
    expect(budgetText(1_250_000_000)).toBe('₹1.25 Cr');
    expect(budgetText(null)).toBe('');
  });
});

describe('the meeting, in India time', () => {
  it('Sat 17 Oct, 11 am', () => {
    const at = parseMeeting('2026-10-17', '11:00')!;
    expect(at.toISOString()).toBe('2026-10-17T05:30:00.000Z');
    expect(meetingLabel(at)).toBe('Sat 17 Oct, 11 am');
    expect(meetingLabel(parseMeeting('2026-10-17', '16:30')!)).toBe('Sat 17 Oct, 4:30 pm');
    expect(meetingInputs(at)).toEqual(['2026-10-17', '11:00']);
  });

  it('refuses a day or time that is not one', () => {
    expect(parseMeeting('2026-02-30', '11:00')).toBeNull();
    expect(parseMeeting('2026-10-17', '25:00')).toBeNull();
  });
});

describe('talking to them: we send nothing', () => {
  it('tap to call, and the salesperson’s own WhatsApp', () => {
    expect(telLink('9876543210')).toBe('tel:+919876543210');
    expect(whatsappLink('9876543210')).toBe('https://wa.me/919876543210');
    expect(whatsappLink('+91 98765 43210')).toBe('https://wa.me/919876543210');
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink('12345')).toBeNull();
  });
});

describe('files', () => {
  it('takes a PDF or a photo up to 15 MB', () => {
    expect(checkLeadFile('application/pdf', 1000)).toEqual({ ok: true, ext: 'pdf' });
    expect(checkLeadFile('image/jpeg; charset=binary', 1000)).toEqual({ ok: true, ext: 'jpg' });
    expect(checkLeadFile('application/zip', 1000).ok).toBe(false);
    expect(checkLeadFile('image/png', LEAD_FILE_MAX_BYTES + 1).ok).toBe(false);
    expect(checkLeadFile('image/png', 0).ok).toBe(false);
  });

  it('a finished upload must be under this studio and this lead', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const p = leadFilePath('s1', 'c1', uuid, 'pdf');
    expect(p).toBe(`studio_s1/lead_c1/${uuid}.pdf`);
    expect(pathBelongsTo(p, 's1', 'c1')).toBe(true);
    expect(pathBelongsTo(p, 's1', 'c2')).toBe(false);
    expect(pathBelongsTo(p, 's2', 'c1')).toBe(false);
    expect(pathBelongsTo(`studio_s1/lead_c1/../lead_c2/${uuid}.pdf`, 's1', 'c1')).toBe(false);
    expect(pathBelongsTo(`dev-unstored/${p}`, 's1', 'c1')).toBe(true);
  });
});

describe('the timeline line for an edit', () => {
  it('names what changed', () => {
    expect(editSummary(['phone'])).toBe('Changed phone');
    expect(editSummary(['phone', 'budgetPaise'.replace('Paise', ''), 'source'])).toBe('Changed phone, budget and source');
    expect(editSummary([])).toBeNull();
  });
});
