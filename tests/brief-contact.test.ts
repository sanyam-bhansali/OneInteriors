import { describe, it, expect } from 'vitest';
import { EMPTY_CONTACT, checkContact } from '@/modules/brief/contact';

/**
 * The last screen of the brief: name, number, the notice. The same rules run
 * on the screen and in the server action.
 */

const good = { ...EMPTY_CONTACT, name: 'Sanyam', phone: '98765 43210', agreed: true };

describe('checkContact', () => {
  it('accepts a name, an Indian mobile and the notice', () => {
    const result = checkContact(good);
    expect(result).toEqual({
      ok: true,
      value: { name: 'Sanyam', phone: '+919876543210', email: null, whatsappUpdates: false },
    });
  });

  it('takes the mobile however it is written', () => {
    for (const phone of ['09876543210', '+91 98765 43210', '919876543210']) {
      const result = checkContact({ ...good, phone });
      expect(result.ok && result.value.phone).toBe('+919876543210');
    }
  });

  it('says what is missing, field by field', () => {
    const result = checkContact(EMPTY_CONTACT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['agreed', 'name', 'phone']);
    }
  });

  it('refuses a landline or a short number, and says to check it', () => {
    const result = checkContact({ ...good, phone: '020 2567 8900' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.phone).toMatch(/check the number/);
  });

  /**
   * The notice is the one purpose without which we cannot introduce them to
   * anyone. It cannot be skipped — but WhatsApp updates can, and default off.
   */
  it('requires the notice, and nothing else by way of consent', () => {
    expect(checkContact({ ...good, agreed: false }).ok).toBe(false);
    const result = checkContact({ ...good, whatsappUpdates: false });
    expect(result.ok && result.value.whatsappUpdates).toBe(false);
    expect(EMPTY_CONTACT.whatsappUpdates).toBe(false);
    expect(EMPTY_CONTACT.agreed).toBe(false);
  });

  it('keeps an optional email, and refuses a malformed one', () => {
    const withEmail = checkContact({ ...good, email: ' Sanyam@Example.com ' });
    expect(withEmail.ok && withEmail.value.email).toBe('sanyam@example.com');
    expect(checkContact({ ...good, email: 'not-an-email' }).ok).toBe(false);
  });
});
