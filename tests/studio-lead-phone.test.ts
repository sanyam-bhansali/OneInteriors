import { describe, expect, it } from 'vitest';
import { leadPhone, normalisePhone } from '@/modules/studio-practice/capture-fields';
import { telLink, whatsappLink } from '@/modules/studio-sales/lead-rules';
import { shapeLead } from '@/modules/studio-intake/payloads';

/* Owner, 25 Nov 2026: "number should show on the phone number tab not notes". */
describe('a lead phone in the Phone box', () => {
  it('keeps Indian mobiles as ten digits, however typed', () => {
    expect(leadPhone('+91 98765 43210')).toBe('9876543210');
    expect(leadPhone('091-98765-43210')).toBe('9876543210');
    expect(leadPhone('9876543210')).toBe('9876543210');
  });

  it('keeps any other number with + and its digits', () => {
    expect(leadPhone('+1 (202) 555-0123')).toBe('+12025550123');
    expect(leadPhone('+971 50 123 4567')).toBe('+971501234567');
    expect(leadPhone('+44 7911 123456')).toBe('+447911123456');
    expect(leadPhone('+91 20 4000 0000')).toBe('+912040000000');
    expect(leadPhone('020 4000 0000')).toBe('+912040000000');
    expect(leadPhone('00971 50 123 4567')).toBe('+971501234567');
    expect(leadPhone('5123456789')).toBe('+915123456789');
  });

  it('refuses blanks and numbers too short or too long', () => {
    expect(leadPhone('+')).toBeNull();
    expect(leadPhone('')).toBeNull();
    expect(leadPhone(null)).toBeNull();
    expect(leadPhone('12345')).toBeNull();
    expect(leadPhone('+1234567890123456')).toBeNull();
  });

  it('leaves sign-in phones Indian only', () => {
    expect(normalisePhone('+12025550123')).toBeNull();
  });

  it('calls and WhatsApps a foreign number with its own code', () => {
    expect(telLink('+12025550123')).toBe('tel:+12025550123');
    expect(whatsappLink('+971501234567')).toBe('https://wa.me/971501234567');
    expect(telLink('9876543210')).toBe('tel:+919876543210');
    expect(whatsappLink('9876543210')).toBe('https://wa.me/919876543210');
    expect(telLink('+919876543210')).toBe('tel:+919876543210');
    expect(telLink(null)).toBeNull();
  });

  it('a Meta lead with a foreign number lands with it in the Phone box', () => {
    const r = shapeLead({
      name: 'NRI Buyer', phone: '+1 202 555 0123', email: null, city: null, locality: null, society: null, config: null, budget: null,
      message: null, answers: [], sourceHint: null, attribution: [], externalId: null, platform: null, isTest: false,
      ads: { adPlatform: null, leadgenId: null, campaignId: null, campaignName: null, adsetId: null, adsetName: null, adId: null, adName: null, formId: null, gclid: null, utm: {} },
    });
    expect(r.ok && r.draft.phone).toBe('+12025550123');
    expect(r.ok && r.draft.notes).toBeNull();
  });
});
