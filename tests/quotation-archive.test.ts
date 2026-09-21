import { describe, it, expect } from 'vitest';
import {
  MIN_QUOTATIONS_TO_SEND,
  confidenceFor,
  studioMessage,
  manualFormLeads,
  type ArchiveSummary,
} from '@/modules/studio/quotation-archive';
import { MIN_QUOTATIONS_FOR_RATES } from '@/modules/quotation/catalogue';

/**
 * The two thresholds, and what a studio is told.
 *
 * The expensive mistake here is not a crash. It is calling a rate card
 * "filed" when it was derived from twenty quotations — a median with twenty
 * samples in it moves visibly on one unusual project, and that number then
 * prices somebody's home. So the tests that matter are the boundary ones.
 */

function summary(over: Partial<ArchiveSummary> = {}): ArchiveSummary {
  return { state: 'RECEIVED', quotationCount: null, fileCount: 3, note: null, ...over };
}

describe('confidence', () => {
  it('needs something to have been counted at all', () => {
    expect(confidenceFor(null, MIN_QUOTATIONS_FOR_RATES)).toBe('none');
  });

  it('is none below the send threshold, on both sides of the line', () => {
    expect(confidenceFor(MIN_QUOTATIONS_TO_SEND - 1, MIN_QUOTATIONS_FOR_RATES)).toBe('none');
    expect(confidenceFor(MIN_QUOTATIONS_TO_SEND, MIN_QUOTATIONS_FOR_RATES)).toBe('draft');
  });

  it('is a draft between the two thresholds, and filed only at the top one', () => {
    expect(confidenceFor(MIN_QUOTATIONS_FOR_RATES - 1, MIN_QUOTATIONS_FOR_RATES)).toBe('draft');
    expect(confidenceFor(MIN_QUOTATIONS_FOR_RATES, MIN_QUOTATIONS_FOR_RATES)).toBe('filed');
    expect(confidenceFor(500, MIN_QUOTATIONS_FOR_RATES)).toBe('filed');
  });

  it('keeps the two thresholds apart', () => {
    // If these ever collapse into one number, either nobody clears the bar or
    // a twenty-quote median gets presented as fact. Both are silent.
    expect(MIN_QUOTATIONS_TO_SEND).toBeLessThan(MIN_QUOTATIONS_FOR_RATES);
  });
});

describe('what the studio is told', () => {
  it('always says what happens next', () => {
    for (const state of ['RECEIVED', 'READING', 'FILED', 'REJECTED'] as const) {
      const message = studioMessage(summary({ state, quotationCount: 40 }), MIN_QUOTATIONS_FOR_RATES);
      expect(message.length, state).toBeGreaterThan(20);
    }
  });

  it('hedges a rate card built from too few quotations', () => {
    const message = studioMessage(
      summary({ state: 'FILED', quotationCount: 30 }),
      MIN_QUOTATIONS_FOR_RATES,
    );
    expect(message).toContain('starting point');
    expect(message).toContain('30');
  });

  it('does not hedge one built from enough', () => {
    const message = studioMessage(
      summary({ state: 'FILED', quotationCount: MIN_QUOTATIONS_FOR_RATES }),
      MIN_QUOTATIONS_FOR_RATES,
    );
    expect(message).not.toContain('starting point');
  });

  it('passes an ops rejection through verbatim', () => {
    const note = 'Fourteen of these are revisions of the same four projects.';
    expect(studioMessage(summary({ state: 'REJECTED', note }), MIN_QUOTATIONS_FOR_RATES)).toBe(note);
  });

  it('still says something useful when ops rejected without a note', () => {
    // reviewArchive refuses this, but the database can hold an older row and a
    // studio must never be shown an empty box where a reason should be.
    const message = studioMessage(summary({ state: 'REJECTED' }), MIN_QUOTATIONS_FOR_RATES);
    expect(message).toContain('Fill the rates in');
  });
});

describe('the manual form', () => {
  it('leads in every state except a filed archive', () => {
    expect(manualFormLeads(null)).toBe(true);
    expect(manualFormLeads(summary({ state: 'RECEIVED' }))).toBe(true);
    expect(manualFormLeads(summary({ state: 'READING' }))).toBe(true);
    expect(manualFormLeads(summary({ state: 'REJECTED' }))).toBe(true);
    expect(manualFormLeads(summary({ state: 'FILED' }))).toBe(false);
  });
});
