import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BULK_CONVERT, CONVERT_FIRST, HANDOVER_MIN, checkHandover, wonMoveRefusal } from '@/modules/studio-sales/convert-rules';
import { can } from '@/modules/studio/roles';
import { messageFor, EMAILED_TO_STUDIO } from '@/modules/notify/messages';

/** Convert (owner, 13 Nov 2026): sales final + handover, project starts, design head assigns. */

describe('a plain move into a won column', () => {
  it('is refused for a lead not yet converted', () => {
    expect(wonMoveRefusal({ toKind: 'WON', fromKind: 'OPEN', converted: false })).toBe(CONVERT_FIRST);
  });
  it('is allowed once converted, between won columns, and into any other column', () => {
    expect(wonMoveRefusal({ toKind: 'WON', fromKind: 'OPEN', converted: true })).toBeNull();
    expect(wonMoveRefusal({ toKind: 'WON', fromKind: 'WON', converted: false })).toBeNull();
    expect(wonMoveRefusal({ toKind: 'OPEN', fromKind: 'OPEN', converted: false })).toBeNull();
    expect(wonMoveRefusal({ toKind: 'LOST', fromKind: 'WON', converted: true })).toBeNull();
    expect(wonMoveRefusal({ toKind: null, fromKind: 'OPEN', converted: false })).toBeNull();
  });
});

describe('the handover to design', () => {
  it(`needs at least ${HANDOVER_MIN} characters`, () => {
    const r = checkHandover('3 BHK, modular kitchen.');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(`${HANDOVER_MIN}`);
  });
  it('is kept tidy', () => {
    const long = `Rooms: kitchen, master bedroom, living.   Style: warm wood, beige.\r\n\r\n\r\nMust-haves: tall unit, loft storage. ${'Detail. '.repeat(30)}`;
    const r = checkHandover(long);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).not.toMatch(/\r|\n{3,}| {2,}/);
      expect(r.value.length).toBeGreaterThanOrEqual(HANDOVER_MIN);
    }
  });
  it('refuses nothing written at all', () => {
    expect(checkHandover(undefined).ok).toBe(false);
  });
});

describe('the design head assigns the designer', () => {
  const base = { id: 'm1', status: 'ACTIVE' as const, fullSoftware: true };
  it('a design head may assign; a designer may not', () => {
    expect(can({ ...base, role: 'DESIGNER', designHead: true }, 'design.assign')).toBe(true);
    expect(can({ ...base, role: 'DESIGNER', designHead: false }, 'design.assign', { assigned: true })).toBe(false);
  });
  it('is told in the app and by email, with the project to open', () => {
    const m = messageFor({ kind: 'project-needs-designer', projectId: 'p1', client: 'Asha Patil', by: 'Mansi' });
    expect(m.title).toContain('Asha Patil');
    expect(m.body).toContain('Mansi converted');
    expect(m.url).toBe('/studio/projects/p1?tab=design');
    expect(EMAILED_TO_STUDIO).toContain('project-needs-designer');
  });
});

describe('source guards', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('every way of moving a lead checks the won rule', () => {
    expect(read('src/modules/studio-practice/clients.ts').match(/wonMoveRefusal\(/g)?.length).toBe(2);
    expect(read('src/modules/studio-sales/bulk.ts')).toMatch(/stage\.kind === 'WON'\) return \{ ok: false, error: BULK_CONVERT \}/);
    expect(BULK_CONVERT).toContain('one at a time');
  });
  it('convert checks the salesperson may mark a sales final on this lead before skipping the role check', () => {
    const src = read('src/modules/studio-sales/convert.ts');
    expect(src).toMatch(/mayOnLead\(scope, 'quote\.salesFinal', lead\)/);
    expect(src).toMatch(/leadChecked: true/);
    expect(read('src/modules/project/own-project.ts')).toMatch(/if \(!opts\.leadChecked && !can\(/);
  });
  it('convert writes no payment (accounts records the advance later)', () => {
    expect(read('src/modules/studio-sales/convert.ts')).not.toMatch(/homeProjectPayment\.create/);
  });
});
