import { describe, it, expect } from 'vitest';
import { mayShareWithStudios } from '@/modules/consent/share';

const row = (granted: boolean, day: number, withdrawn = false) => ({
  purpose: 'SHARE_WITH_STUDIO',
  granted,
  grantedAt: new Date(Date.UTC(2026, 9, day)),
  withdrawnAt: withdrawn ? new Date(Date.UTC(2026, 9, day + 1)) : null,
});

describe('sharing contact with studios', () => {
  it('needs an agreement to share with studios, not any consent', () => {
    expect(mayShareWithStudios([])).toBe(false);
    expect(mayShareWithStudios([{ ...row(true, 1), purpose: 'DATA_PROCESSING' }])).toBe(false);
    expect(mayShareWithStudios([row(true, 1)])).toBe(true);
  });

  it('lets the latest decision and a withdrawal win', () => {
    expect(mayShareWithStudios([row(true, 1), row(false, 2)])).toBe(false);
    expect(mayShareWithStudios([row(false, 1), row(true, 2)])).toBe(true);
    expect(mayShareWithStudios([row(true, 1, true)])).toBe(false);
  });
});
