import { describe, expect, it } from 'vitest';
import { asClientTitle, titleOf, withTitle, withoutTitle } from '@/modules/studio-quote/client-title';

/** Mr / Mrs / Miss before the client's name on a quotation (owner, 14 Nov 2026). */
describe('client title', () => {
  it('puts the title before the name', () => {
    expect(withTitle('Mrs', 'Asha Patil')).toBe('Mrs Asha Patil');
    expect(withTitle('Mr', '  Rahul   Shah ')).toBe('Mr Rahul Shah');
  });
  it('replaces a title already typed, never doubles it', () => {
    expect(withTitle('Miss', 'Mrs. Asha Patil')).toBe('Miss Asha Patil');
    expect(withTitle('Mr', 'mr Rahul')).toBe('Mr Rahul');
  });
  it('no title (or an unknown one) leaves the name as typed', () => {
    expect(withTitle('', 'Asha Patil')).toBe('Asha Patil');
    expect(withTitle('Sir', 'Asha Patil')).toBe('Asha Patil');
    expect(asClientTitle('mrs.')).toBe('Mrs');
  });
  it('reads a title back and takes it off', () => {
    expect(titleOf('Mrs Asha Patil')).toBe('Mrs');
    expect(titleOf('Asha Patil')).toBe('');
    expect(titleOf('Missy Rao')).toBe('');
    expect(withoutTitle('Miss Asha Patil')).toBe('Asha Patil');
  });
});
