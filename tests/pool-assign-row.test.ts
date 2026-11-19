import { describe, expect, it } from 'vitest';
import { mayAssignPoolRow } from '@/modules/studio-sales/lead-view';

/* Swarupa (head, reports to the owner) sees the studio pool and her team pool;
   her "Give leads to people" reaches her team only. */
const team = ['swarupa', 'mansi', 'kesiya'];

describe('mayAssignPoolRow (pool rows offer Assign only where the assign would work)', () => {
  it('anyone with studio-wide assigning: every row', () => {
    expect(mayAssignPoolRow('owner', null, { assignedToId: null, poolTeamId: null })).toBe(true);
    expect(mayAssignPoolRow('owner', null, { assignedToId: null, poolTeamId: 'otherhead' })).toBe(true);
  });
  it('a team head: her own team pool', () => {
    expect(mayAssignPoolRow('swarupa', team, { assignedToId: null, poolTeamId: 'swarupa' })).toBe(true);
  });
  it('a team head: not the studio pool, not another head’s pool (she claims those)', () => {
    expect(mayAssignPoolRow('swarupa', team, { assignedToId: null, poolTeamId: null })).toBe(false);
    expect(mayAssignPoolRow('swarupa', team, { assignedToId: null })).toBe(false);
    expect(mayAssignPoolRow('swarupa', team, { assignedToId: null, poolTeamId: 'otherhead' })).toBe(false);
  });
  it('a team head, All leads view: her team’s leads, not others’', () => {
    expect(mayAssignPoolRow('swarupa', team, { assignedToId: 'kesiya' })).toBe(true);
    expect(mayAssignPoolRow('swarupa', team, { assignedToId: 'otherrep' })).toBe(false);
  });
});
