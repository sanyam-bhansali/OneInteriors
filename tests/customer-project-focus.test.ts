import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { focusOf, projectFocus } from '@/modules/app/project-focus';

/** The customer's Project screen shows only what the phase needs (owner, 1 Nov 2026). */

const base = { designRunning: false, snags: 0, paymentToConfirm: false };

describe('what the Project screen shows, by phase', () => {
  it('in design: design progress on top, what is needed, the design, the next payment; no site, no snags', () => {
    const f = projectFocus({ ...base, phase: 'design', designRunning: true });
    expect(f.focus).toBe('design');
    expect(f.main).toEqual(['progress', 'lifecycle', 'signoffs', 'decision', 'design', 'nextPayment']);
    expect(f.main).not.toContain('site');
    expect(f.main).not.toContain('snags');
    expect(f.main).not.toContain('stages');
    expect(f.folded).toEqual(['stats', 'site', 'snags', 'stages', 'payments', 'changes']);
  });

  it('in execution: the home on top and today on site; snags once any are raised; the design folds away', () => {
    const f = projectFocus({ ...base, phase: 'execution' });
    expect(f.focus).toBe('site');
    expect(f.main).toEqual(['progress', 'stats', 'lifecycle', 'signoffs', 'decision', 'site', 'nextPayment']);
    expect(f.folded).toContain('design');
    expect(f.folded).toContain('snags');
    expect(projectFocus({ ...base, phase: 'execution', snags: 2 }).main).toContain('snags');
  });

  it('at handover: snags, the sign-off and the final payment; the site folds away', () => {
    for (const phase of ['closure', 'snags', 'warranty', 'closed'] as const) {
      const f = projectFocus({ ...base, phase });
      expect(f.focus).toBe('handover');
      expect(f.main).toEqual(['lifecycle', 'snags', 'signoffs', 'decision', 'nextPayment']);
      expect(f.folded).toContain('site');
      expect(f.folded).not.toContain('progress');
    }
  });

  it('a payment waiting for their yes keeps the full payments on screen, so they can confirm it', () => {
    const f = projectFocus({ ...base, phase: 'design', designRunning: true, paymentToConfirm: true });
    expect(f.main).toContain('payments');
    expect(f.main).not.toContain('nextPayment');
    expect(f.folded).not.toContain('payments');
  });

  it('never loses anything: every block is on screen or in the whole plan', () => {
    for (const phase of ['design', 'execution', 'closure', 'warranty'] as const) {
      const f = projectFocus({ ...base, phase, designRunning: phase === 'design' });
      for (const b of ['stats', 'design', 'site', 'snags', 'stages', 'payments', 'changes'] as const) expect([...f.main, ...f.folded]).toContain(b);
    }
  });

  it('an older server with no phase: design while the design runs, the site after', () => {
    expect(focusOf(null, true)).toBe('design');
    expect(focusOf(undefined, false)).toBe('site');
  });

  it('the website and the phone app both lay the screen out from it', () => {
    expect(readFileSync('src/app/app/project/page.tsx', 'utf8')).toContain('projectFocus(');
    expect(readFileSync('mobile/src/app/(tabs)/project.tsx', 'utf8')).toContain('projectFocus(');
  });
});
