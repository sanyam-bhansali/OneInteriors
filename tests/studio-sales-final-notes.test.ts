import { describe, expect, it } from 'vitest';
import { checkSalesNotes, voiceExtOf } from '@/modules/studio-sales/revision-rules';

/** Sales' notes for the design team at the sales final (the design meeting, 24 Oct 2026; DESIGN-PROCESS-PLAN.md §4.2). */

describe('notes for the design team', () => {
  it('are required to mark the sales final', () => {
    expect(checkSalesNotes('', null)).toMatchObject({ ok: false });
    expect(checkSalesNotes('ok', null)).toMatchObject({ ok: false });
    expect(checkSalesNotes('  Budget 3 lakh, Luxe laminates, a study in bedroom 2.  ', null)).toEqual({ ok: true, notes: 'Budget 3 lakh, Luxe laminates, a study in bedroom 2.' });
  });

  it('keep the notes already there when changing the same sales final', () => {
    expect(checkSalesNotes('', 'Budget 3 lakh, Luxe laminates.')).toEqual({ ok: true, notes: 'Budget 3 lakh, Luxe laminates.' });
  });

  it('refuse a novel', () => {
    expect(checkSalesNotes('x'.repeat(3001), null)).toMatchObject({ ok: false });
  });
});

describe('the voice note', () => {
  it('is kept as webm, m4a or ogg, as the browser records it', () => {
    expect(['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/wav', null].map(voiceExtOf)).toEqual(['webm', 'm4a', 'ogg', null, null]);
  });
});
