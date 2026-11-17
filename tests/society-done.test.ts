import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { returnsToPoolWhenDone } from '@/modules/studio-practice/society-rules';

/** A society marked done (owner, 17 Nov 2026), and possession for every wing. */

const col = (kind: string, isIntake = false, isCallStep = false) => ({ kind, isIntake, isCallStep });

describe('which leads go back to the pool when a society is done', () => {
  it('New and Calling 1–4 go back', () => {
    expect(returnsToPoolWhenDone(col('OPEN', true))).toBe(true);
    expect(returnsToPoolWhenDone(col('OPEN', false, true))).toBe(true);
  });
  it('Effective Lead and every later open column stay with the salesperson', () => {
    expect(returnsToPoolWhenDone(col('OPEN'))).toBe(false);
  });
  it('Junk, Lost and Converted are not touched', () => {
    expect(returnsToPoolWhenDone(col('LOST'))).toBe(false);
    expect(returnsToPoolWhenDone(col('WON'))).toBe(false);
    expect(returnsToPoolWhenDone(col('LOST', false, true))).toBe(false);
  });
});

describe('source guards', () => {
  const src = readFileSync('src/modules/studio-practice/societies.ts', 'utf8');
  it('the database filter is the same rule: open, and intake or a calling column', () => {
    expect(src).toMatch(/BACK_TO_POOL_STAGE: Prisma\.StudioStageWhereInput = \{ kind: 'OPEN', OR: \[\{ isIntake: true \}, \{ isCallStep: true \}\] \}/);
  });
  it('only leads someone has are sent back, through the Leads app’s own back-to-pool', () => {
    expect(src).toMatch(/assignedToId: \{ not: null \}, stage: BACK_TO_POOL_STAGE/);
    expect(src).toMatch(/bulkAssign\(\{ ids: rows\.map\(\(x\) => x\.id\) \}, null\)/);
  });
  it('marking done is for admins and sales heads, and leaves a note', () => {
    expect(src).toMatch(/markSocietyDone[\s\S]*?!access\.mayManage\) return \{ ok: false/);
    expect(src).toMatch(/Marked done: possession is long over/);
  });
  it('done societies drop off the list unless asked for, and sort last', () => {
    expect(src).toMatch(/filters\.status === 'done' \? \{ doneAt: \{ not: null \} \} : \{ doneAt: null \}/);
    expect(src).toMatch(/Number\(a\.done !== null\) - Number\(b\.done !== null\)/);
  });
  it('possession can be changed for every wing at once', () => {
    expect(src).toMatch(/export async function setSocietyPossession/);
    expect(readFileSync('src/app/studio/clients/societies/[id]/page.tsx', 'utf8')).toMatch(/<PossessionForm/);
  });
});
