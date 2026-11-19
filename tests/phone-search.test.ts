import { describe, expect, it } from 'vitest';
import { phoneSearchDigits } from '@/modules/studio/phone-search';

describe('phoneSearchDigits (search boxes find a phone however it was typed)', () => {
  it('keeps a plain ten-digit number', () => expect(phoneSearchDigits('9876543210')).toBe('9876543210'));
  it('peels +91 and spaces off a full number', () => expect(phoneSearchDigits('+91 98765 43210')).toBe('9876543210'));
  it('peels 91 without the plus off a full number', () => expect(phoneSearchDigits('919876543210')).toBe('9876543210'));
  it('peels a trunk zero', () => expect(phoneSearchDigits('098765 43210')).toBe('9876543210'));
  it('peels +91 off a partial number', () => expect(phoneSearchDigits('+91 98765')).toBe('98765'));
  it('keeps a partial number', () => expect(phoneSearchDigits('43210')).toBe('43210'));
  it('null below the minimum, or with no digits', () => {
    expect(phoneSearchDigits('987')).toBeNull();
    expect(phoneSearchDigits('987', 3)).toBe('987');
    expect(phoneSearchDigits('Kulkarni')).toBeNull();
    expect(phoneSearchDigits('')).toBeNull();
  });
});
