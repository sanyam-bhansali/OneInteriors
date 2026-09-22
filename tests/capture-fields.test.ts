import { describe, expect, it } from 'vitest';
import {
  localitySlug,
  looksLikeEmail,
  normalisePhone,
  validate,
  type CaptureInput,
} from '@/modules/studio-practice/capture-fields';

/**
 * A public form takes input from strangers, so the interesting cases are the
 * hostile and the sloppy: a bot filling every field, a phone typed six
 * different ways, an area nobody recognises, a megabyte in a textarea.
 *
 * Every one of these has to end with either a usable lead or a refusal a
 * person can act on — never a crash and never a row full of rubbish.
 */

const GOOD: CaptureInput = { name: 'Anita Kulkarni', phone: '98765 43210' };

describe('normalisePhone', () => {
  it('takes a ten-digit mobile however it was typed', () => {
    for (const raw of [
      '9876543210',
      '98765 43210',
      '+91 98765 43210',
      '091-98765-43210',
      '(098765) 43210',
    ]) {
      expect(normalisePhone(raw), raw).toBe('9876543210');
    }
  });

  it('peels prefixes rather than matching lengths, because they combine', () => {
    /* `091...` carries both a trunk zero AND a country code. */
    expect(normalisePhone('09198765 43210')).toBe('9876543210');
  });

  it('does not eat a leading 9 off a plain number', () => {
    /* The peel must only run while there is something left over, or
       9876543210 loses its first digit and becomes a different person. */
    expect(normalisePhone('9876543210')).toBe('9876543210');
  });

  it('refuses a landline or a typo', () => {
    /* Indian mobiles start 6-9. A wrong number here is a callback that fails
       silently three days later, which is the worst outcome for both sides. */
    expect(normalisePhone('2026543210')).toBeNull();
    expect(normalisePhone('123456789')).toBeNull();
    expect(normalisePhone('98765432101234')).toBeNull();
    expect(normalisePhone('')).toBeNull();
    expect(normalisePhone('not a number')).toBeNull();
  });
});

describe('looksLikeEmail', () => {
  it('catches the typos that matter and lets the rest through', () => {
    expect(looksLikeEmail('a@b.in')).toBe(true);
    expect(looksLikeEmail('anita.k+studio@example.co.in')).toBe(true);
    expect(looksLikeEmail('anita at example.com')).toBe(false);
    expect(looksLikeEmail('anita@example')).toBe(false);
    expect(looksLikeEmail('anita @example.com')).toBe(false);
  });
});

describe('localitySlug', () => {
  it('resolves a known area to its slug, case and space insensitive', () => {
    expect(localitySlug('Baner')).toBe('baner');
    expect(localitySlug('  baner  ')).toBe('baner');
  });

  it('is null for anything it does not know', () => {
    /* Stored raw, a free-text "Baner " would sit beside the slug `baner` and
       split one area into two that never compare equal — the trap AxLeads'
       grouping module spends three defences on. */
    expect(localitySlug('Somewhere Else')).toBeNull();
  });
});

describe('validate', () => {
  it('accepts the two required fields alone', () => {
    const v = validate(GOOD);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.name).toBe('Anita Kulkarni');
      expect(v.value.phone).toBe('9876543210');
      expect(v.value.email).toBeNull();
    }
  });

  it('refuses the honeypot SILENTLY, with no field named', () => {
    /**
     * The caller must not say why. A bot told it failed tries again with the
     * field blank; a bot told it succeeded goes away. So this is a distinct
     * shape from a validation error and the action turns it into a
     * thank-you page.
     */
    const v = validate({ ...GOOD, company: 'Acme Corp' });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect('silent' in v).toBe(true);
      expect('field' in v).toBe(false);
    }
  });

  it('names the field that was wrong, so the page can focus it', () => {
    const noName = validate({ ...GOOD, name: 'x' });
    expect(noName.ok).toBe(false);
    if (!noName.ok && !('silent' in noName)) expect(noName.field).toBe('name');

    const badPhone = validate({ ...GOOD, phone: '12345' });
    expect(badPhone.ok).toBe(false);
    if (!badPhone.ok && !('silent' in badPhone)) expect(badPhone.field).toBe('phone');

    const badEmail = validate({ ...GOOD, email: 'nope' });
    expect(badEmail.ok).toBe(false);
    if (!badEmail.ok && !('silent' in badEmail)) expect(badEmail.field).toBe('email');
  });

  it('keeps an unrecognised area in the message rather than dropping it', () => {
    /* The slug is what the board groups on, so an unknown value cannot go in
       that column. But what the person actually said still reaches the
       studio, because they said it for a reason. */
    const v = validate({ ...GOOD, locality: 'Near the Mula river' });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.locality).toBeNull();
      expect(v.value.message).toContain('Near the Mula river');
    }
  });

  it('refuses a config it did not offer', () => {
    /* Free text here would produce forty spellings of "3 BHK". */
    const v = validate({ ...GOOD, config: '3bhk maybe' });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.config).toBeNull();
  });

  it('refuses a message long enough to be an attack on the column', () => {
    const v = validate({ ...GOOD, message: 'x'.repeat(2000) });
    expect(v.ok).toBe(false);
    if (!v.ok && !('silent' in v)) expect(v.field).toBe('message');
  });

  it('never returns a message that is an empty string', () => {
    /* Null, so the notes panel on the lead is absent rather than blank. */
    const v = validate({ ...GOOD, message: '   ' });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.message).toBeNull();
  });
});
