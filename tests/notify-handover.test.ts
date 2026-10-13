import { describe, expect, it } from 'vitest';
import { EMAILED_TO_STUDIO, messageFor } from '@/modules/notify/messages';

describe('client signs off the handover (owner, 13 Oct 2026)', () => {
  const e = { kind: 'handover-signed' as const, projectId: 'p1', client: 'Asha', home: 'Baner · 2 BHK', warrantyLabel: '13 Oct 2027' };

  it('tells the studio who signed off what, and when warranty ends', () => {
    const m = messageFor(e);
    expect(m.title).toBe('Handover signed off');
    expect(m.body).toBe('Asha signed off Baner · 2 BHK. Warranty runs to 13 Oct 2027.');
    expect(m.url).toBe('/studio/projects/p1');
  });

  it('goes to the studio by email as well as in the app', () => {
    expect(EMAILED_TO_STUDIO).toContain('handover-signed');
  });
});
