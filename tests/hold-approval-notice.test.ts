import { describe, expect, it } from 'vitest';
import { messageFor } from '@/modules/notify/messages';
import { buildMyWork, KIND_ORDER, KIND_TITLE, type WorkSource } from '@/modules/studio/my-work-rules';
import { mayApproveHold } from '@/modules/studio-hold/rules';

describe('a hold asked reaches the design head (owner, 20 Nov 2026: "head isn\'t told")', () => {
  it('tells the approver who asked, for which client and why, and opens the hold card', () => {
    const m = messageFor({ kind: 'hold-asked', projectId: 'p1', client: 'Shah Devang Ratilal', by: 'Gunjan Joshi', reason: 'Possession is late' });
    expect(m.title).toBe('Gunjan Joshi asks to put Shah Devang Ratilal on hold');
    expect(m.body).toContain('Possession is late');
    expect(m.url).toBe('/studio/projects/p1#hold');
    expect(m.template).toBe('hold.asked');
  });

  it('tells the one who asked when it is approved or declined', () => {
    const yes = messageFor({ kind: 'hold-decided', projectId: 'p1', client: 'Shah', by: 'Renuka Gupta', approved: true });
    const no = messageFor({ kind: 'hold-decided', projectId: 'p1', client: 'Shah', by: 'Renuka Gupta', approved: false });
    expect(yes.title).toBe('Shah is on hold');
    expect(yes.template).toBe('hold.approved');
    expect(no.title).toBe('Hold declined for Shah');
    expect(no.template).toBe('hold.declined');
  });

  it('only the owner and the design head approve', () => {
    expect(mayApproveHold({ role: 'OWNER' })).toBe(true);
    expect(mayApproveHold({ role: 'DESIGNER', designHead: true })).toBe(true);
    expect(mayApproveHold({ role: 'DESIGNER', designHead: false })).toBe(false);
    expect(mayApproveHold({ role: 'PM' })).toBe(false);
  });

  it('lists a hold asked today first in Today, and as missed after', () => {
    expect(KIND_ORDER[0]).toBe('hold');
    expect(KIND_TITLE.hold).toBe('Holds to approve');
    const hold: WorkSource = { key: 'hold:h1', kind: 'hold', title: 'Hold asked: Possession is late', place: 'Shah · Pune', due: '2026-11-20', detail: 'Gunjan asks', href: '/studio/projects/p1#hold' };
    const step: WorkSource = { key: 'design:s1', kind: 'design', title: 'Final 3D', place: 'Bhushan · Pune', due: '2026-11-20', href: '/studio/projects/p2' };
    const today = buildMyWork([step, hold], '2026-11-20');
    expect(today.todayGroups[0]!.id).toBe('hold');
    const later = buildMyWork([hold], '2026-11-23');
    expect(later.missed.map((i) => i.key)).toEqual(['hold:h1']);
  });
});
