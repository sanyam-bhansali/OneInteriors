import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STEP_TEMPLATE, TEMPLATE_MILESTONES, templateFor } from '@/modules/project/step-template';
import { DESIGN_MILESTONES, HAUSPIRE_DESIGN, checkDesignTemplate, readDesignTemplate } from '@/modules/studio-design/template';
import { designSteps } from '@/modules/studio-design/rules';
import { quoteToPlan } from '@/modules/portal/quote-to-plan';
import { MILESTONES_WARN_ABOVE, milestoneWarning, milestonesShown } from '@/modules/project/step-rules';
import { PLAN_KINDS } from '@/modules/portal/tracker';

/**
 * Customer milestones (owner, 12 Oct 2026; docs/studio-os/CUSTOMER-MILESTONES.md):
 * the defaults a new plan starts with, how they are copied, and the soft
 * warning. What reaches the customer is tested in tests/customer-projection.test.ts.
 */

describe('the default stars', () => {
  it('star 1 to 3 steps in every execution stage, each a step that exists in the template', () => {
    for (const kind of PLAN_KINDS) {
      const starred = templateFor(kind).filter((s) => s.milestone).map((s) => s.label);
      expect(starred, kind).toEqual(TEMPLATE_MILESTONES[kind]);
      expect(starred.length, kind).toBeGreaterThanOrEqual(1);
      expect(starred.length, kind).toBeLessThanOrEqual(3);
    }
    expect(STEP_TEMPLATE.filter((s) => s.milestone).map((s) => s.label)).toEqual([
      'Final design and drawings signed off',
      'POP, civil, fabrication and electrical work started',
      'POP sheets',
      'Materials delivered from the factory',
      'Carcass complete with hardware',
      'Shutters delivered',
      'Painting started',
      'Painting complete',
      'Snags listed',
      'Provisional handover',
    ]);
  });

  it('star three of Hauspire’s design steps', () => {
    expect(HAUSPIRE_DESIGN.filter((s) => s.milestone).map((s) => s.label)).toEqual(['Site visit', 'Final 3D & renders', 'Working drawings final']);
    for (const label of DESIGN_MILESTONES) expect(HAUSPIRE_DESIGN.some((s) => s.label === label), label).toBe(true);
  });

  it('match the migration’s backfill, name for name', () => {
    const sql = readFileSync(join(__dirname, '..', 'prisma/migrations/20261012170000_customer_milestones/migration.sql'), 'utf8');
    const pairs = [...sql.matchAll(/\('([A-Z]+)', '([^']+)'\)/g)].map((m) => `${m[1]}|${m[2]}`).sort();
    const expected = [
      // The lifecycle migration (20261013120000) renamed Hauspire's "Handover" step to "Provisional handover"; this backfill ran before, under the old name.
      ...PLAN_KINDS.flatMap((k) => TEMPLATE_MILESTONES[k].map((l) => `${k}|${l === 'Provisional handover' ? 'Handover' : l}`)),
      // The design steps of 12 Oct 2026, before the design process of 24 Oct 2026 renamed them; the backfill ran under these names.
      ...['Site visit and measurement', 'First 3D and renders', 'Design closure'].map((l) => `DESIGN|${l}`),
    ].sort();
    expect(pairs).toEqual(expected);
    expect(sql).toContain('ADD COLUMN "customerMilestone" BOOLEAN NOT NULL DEFAULT false');
    // Expand-only: nothing dropped or renamed (comments aside).
    expect(sql.replace(/--.*$/gm, '')).not.toMatch(/DROP|RENAME/i);
  });
});

describe('a studio’s own design steps and their stars', () => {
  it('keep the star the owner set', () => {
    const c = checkDesignTemplate([
      { label: 'Kick-off call', responsible: 'DESIGNER', days: 0, milestone: true },
      { label: 'Site visit and measurement', responsible: 'DESIGNER', days: 1, milestone: false },
    ]);
    expect(c.ok && c.steps.map((s) => s.milestone)).toEqual([true, false]);
  });

  it('give a template saved before stars existed Hauspire’s stars, by name', () => {
    const old = [
      { label: 'Site visit', responsible: 'DESIGNER', needsDocument: false, gate: null, days: 0, weight: 2 },
      { label: 'Our own step', responsible: 'DESIGNER', needsDocument: false, gate: null, days: 1, weight: 1 },
    ];
    expect(readDesignTemplate(old).map((s) => s.milestone)).toEqual([true, false]);
  });
});

describe('copying the stars onto a plan', () => {
  it('a new plan’s steps carry the template’s stars, execution and design', () => {
    const plan = quoteToPlan({ lines: [], startOn: new Date('2026-10-01T00:00:00Z'), totalDays: 100, contractPaise: 0, stages: [], design: { bhk: 2 } });
    for (const s of plan.stages) {
      const starred = s.items.filter((i) => i.customerMilestone).map((i) => i.label);
      expect(starred, s.kind).toEqual(s.kind === 'DESIGN' ? [...DESIGN_MILESTONES] : TEMPLATE_MILESTONES[s.kind]);
    }
  });

  it('a studio’s design template carries its own stars', () => {
    const steps = designSteps(
      [
        { label: 'Brief', responsible: 'DESIGNER', needsDocument: false, gate: null, days: 0, effortMin: 60, group: 'Design', approval: null, tasks: [], milestone: false },
        { label: 'Concept shared', responsible: 'DESIGNER', needsDocument: false, gate: null, days: 2, effortMin: 60, group: 'Design', approval: null, tasks: [], milestone: true },
      ],
      '2026-10-01',
      [],
    );
    expect(steps.map((s) => s.customerMilestone)).toEqual([false, true]);
  });
});

describe('the soft warning on a stage’s stars', () => {
  it('says how many the client sees, and warns at none or more than four — never blocks', () => {
    expect(milestonesShown(2)).toBe('2 shown to the client');
    expect(milestoneWarning(0)).toMatch(/No step is starred/);
    for (const n of [1, 2, 3, MILESTONES_WARN_ABOVE]) expect(milestoneWarning(n), String(n)).toBeNull();
    expect(milestoneWarning(5)).toMatch(/5 starred/);
  });
});
