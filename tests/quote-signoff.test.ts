import { describe, expect, it } from 'vitest';
import { contentHash } from '@/modules/project/signoff-hash';
import {
  canonical,
  checkSignerName,
  requestFacts,
  requestRefusal,
  signedLine,
  signoffState,
  signRefusal,
  toCustomerSignoff,
} from '@/modules/project/signoff-rules';
import { generatedDocLink } from '@/modules/portal/documents';

/**
 * The client's digital sign-off of a quotation (owner, 15 Oct 2026):
 * project/signoff-rules.ts and signoff-hash.ts.
 */

const content = {
  quoteNumber: 'HSP-2026-014-D',
  n: 2,
  lines: [{ room: 'Kitchen', product: 'Base unit', amountPaise: 1_20_000_00, code: 'MODULAR' }],
  terms: { gstBps: 1800, discountBps: 1000 },
  totalPaise: 2_50_000_00,
  termsText: '50% before production.',
};

describe('the fingerprint of what is signed', () => {
  it('is the same for the same content, whatever the key order', () => {
    expect(canonical({ b: 1, a: [{ y: 2, x: 1 }] })).toBe(canonical({ a: [{ x: 1, y: 2 }], b: 1 }));
    expect(contentHash(content)).toBe(contentHash({ ...content, terms: { discountBps: 1000, gstBps: 1800 } }));
    expect(contentHash(content)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes with any line, the total, the revision or the terms printed with it', () => {
    const h = contentHash(content);
    expect(contentHash({ ...content, lines: [{ ...content.lines[0]!, amountPaise: 1_20_000_01 }] })).not.toBe(h);
    expect(contentHash({ ...content, totalPaise: 1 })).not.toBe(h);
    expect(contentHash({ ...content, n: 3 })).not.toBe(h);
    expect(contentHash({ ...content, termsText: '60% before production.' })).not.toBe(h);
  });
});

describe('who may sign, and when', () => {
  const ok = { state: 'waiting' as const, owner: true, agreed: true, storedHash: 'h', currentHash: 'h', shownHash: 'h' };

  it('signs with the tick and an unchanged quotation', () => {
    expect(signRefusal(ok)).toBeNull();
  });

  it('refuses without the tick, for anyone but the owner, and when it changed', () => {
    expect(signRefusal({ ...ok, agreed: false })).not.toBeNull();
    expect(signRefusal({ ...ok, agreed: 'true' })).not.toBeNull();
    expect(signRefusal({ ...ok, owner: false })).not.toBeNull();
    expect(signRefusal({ ...ok, currentHash: 'x' })).not.toBeNull();
    expect(signRefusal({ ...ok, shownHash: 'x' })).not.toBeNull();
  });

  it('refuses a signed, withdrawn or superseded request', () => {
    for (const state of ['signed', 'withdrawn', 'superseded'] as const) expect(signRefusal({ ...ok, state })).not.toBeNull();
  });

  it('keeps a signature on its revision when a newer one is sent, and supersedes an unsigned request', () => {
    expect(signoffState({ signedAt: new Date(), withdrawnAt: null, revisionN: 2 }, 3)).toBe('signed');
    expect(signoffState({ signedAt: null, withdrawnAt: null, revisionN: 2 }, 3)).toBe('superseded');
    expect(signoffState({ signedAt: null, withdrawnAt: null, revisionN: 3 }, 3)).toBe('waiting');
    expect(signoffState({ signedAt: null, withdrawnAt: new Date(), revisionN: 3 }, 3)).toBe('withdrawn');
  });

  it('takes a typed full name in any script, and nothing else', () => {
    expect(checkSignerName('  Asha   Rao ')).toEqual({ ok: true, name: 'Asha Rao' });
    expect(checkSignerName('आशा राव').ok).toBe(true);
    expect(checkSignerName("D'Souza-Pereira").ok).toBe(true);
    expect(checkSignerName('Al').ok).toBe(false);
    expect(checkSignerName('<script>').ok).toBe(false);
    expect(checkSignerName('1234').ok).toBe(false);
  });
});

describe('the studio asks', () => {
  it('asks on a version the client received, once per version', () => {
    expect(requestRefusal({ hasRevision: false, kind: 'DESIGN_FINAL', pendingSameRevision: false, signedSameRevision: false })).toMatch(/Send the design final/);
    expect(requestRefusal({ hasRevision: true, kind: 'DESIGN_FINAL', pendingSameRevision: true, signedSameRevision: false })).not.toBeNull();
    expect(requestRefusal({ hasRevision: true, kind: 'SALES_FINAL', pendingSameRevision: false, signedSameRevision: true })).not.toBeNull();
    expect(requestRefusal({ hasRevision: true, kind: 'SALES_FINAL', pendingSameRevision: false, signedSameRevision: false })).toBeNull();
  });
});

describe('what is kept and shown', () => {
  it('keeps the first forwarded IP and a trimmed user agent', () => {
    expect(requestFacts({ forwardedFor: '203.0.113.9, 10.0.0.1', userAgent: 'Mozilla/5.0\r\nX' })).toEqual({ ip: '203.0.113.9', userAgent: 'Mozilla/5.0 X' });
    expect(requestFacts({ forwardedFor: 'not an ip', realIp: null, userAgent: '' })).toEqual({ ip: null, userAgent: null });
  });

  it('says "Signed by … on …" in IST', () => {
    expect(signedLine('Asha Rao', new Date('2026-10-15T20:00:00Z'))).toBe('Signed by Asha Rao on 16 Oct 2026');
  });

  it('opens the signed copy from the locker at the signing page', () => {
    expect(generatedDocLink('signoff:abc123', 'https://oneinteriors.in/')).toBe('https://oneinteriors.in/app/signoff/abc123');
    expect(generatedDocLink('signoff:../../x', 'https://oneinteriors.in')).toBeNull();
  });

  it('shows the client only what they need, and drops a withdrawn request', () => {
    const base = { id: 's1', kind: 'DESIGN_FINAL', quoteNumber: 'Q-1', revisionN: 2, totalPaise: 100, requestedOn: '2026-10-15', signedOn: null, signerName: null, signedAt: null, withdrawnAt: null };
    expect(toCustomerSignoff(base, 2, true)).toMatchObject({ state: 'waiting', canSign: true, revision: 2 });
    expect(toCustomerSignoff(base, 2, false)!.canSign).toBe(false);
    expect(toCustomerSignoff(base, 3, true)).toMatchObject({ state: 'superseded', canSign: false });
    expect(toCustomerSignoff({ ...base, withdrawnAt: new Date() }, 2, true)).toBeNull();
    expect(toCustomerSignoff({ ...base, kind: 'NOPE' }, 2, true)).toBeNull();
  });
});
