import { describe, it, expect } from 'vitest';
import { resolveSiteUrl, siteUrl, safeNext } from '@/lib/site';

/**
 * An open-redirect guard, so the negative cases matter far more than the
 * positive one. This value ends up inside an emailed sign-in link: the mail
 * really is from us and the link really does sign the person in, so anything
 * it wrongly accepts is somewhere an attacker can land a trusting,
 * freshly-authenticated user.
 */
describe('safeNext', () => {
  it('allows a same-site absolute path', () => {
    expect(safeNext('/quotes')).toBe('/quotes');
    expect(safeNext('/studio/onboarding/rates')).toBe('/studio/onboarding/rates');
    expect(safeNext('/compare?from=email')).toBe('/compare?from=email');
  });

  it('rejects an absolute URL to another origin', () => {
    expect(safeNext('https://evil.example/login')).toBeNull();
    expect(safeNext('http://evil.example')).toBeNull();
  });

  // Both of these are protocol-relative in a browser: they leave the site
  // while sailing past a naive startsWith('/') check.
  it('rejects protocol-relative paths', () => {
    expect(safeNext('//evil.example/login')).toBeNull();
    expect(safeNext('/\\evil.example')).toBeNull();
  });

  it('rejects a scheme smuggled into the middle', () => {
    expect(safeNext('/redirect?to=https://evil.example')).toBeNull();
  });

  it('rejects control characters, which can split a header or a log line', () => {
    expect(safeNext(['/quotes', 'Location: https://evil.example'].join('\n'))).toBeNull();
    expect(safeNext(['/a', 'b'].join('\t'))).toBeNull();
    expect(safeNext(['/a', 'b'].join('\r'))).toBeNull();
    expect(safeNext('/a' + String.fromCharCode(0) + 'b')).toBeNull();
  });

  it('rejects anything that is not a path', () => {
    expect(safeNext('quotes')).toBeNull();
    expect(safeNext('javascript:alert(1)')).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });

  it('trims surrounding whitespace rather than rejecting on it', () => {
    expect(safeNext('  /quotes  ')).toBe('/quotes');
  });
});

describe('resolveSiteUrl', () => {
  // The regression that broke the first Vercel deploy. Next inlines
  // NEXT_PUBLIC_* at build time and Vercel supplies unset ones as '', so a
  // `??` fallback never fires and new URL('') throws ERR_INVALID_URL.
  it('treats an empty string as absent, not as a value', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '' })).toBe('http://localhost:3000');
  });

  it('treats whitespace as absent too', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '   ' })).toBe('http://localhost:3000');
  });

  it('falls back to localhost when nothing is set', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });

  it('prefers an explicit site URL', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://oneinteriors.in' })).toBe(
      'https://oneinteriors.in',
    );
  });

  it('uses the Vercel deployment host when no explicit URL is set', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '', VERCEL_URL: 'one-interiors.vercel.app' })).toBe(
      'https://one-interiors.vercel.app',
    );
  });

  it('adds a protocol to a bare host', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'oneinteriors.in' })).toBe(
      'https://oneinteriors.in',
    );
  });

  it('keeps an existing protocol', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'http://localhost:4000' })).toBe(
      'http://localhost:4000',
    );
  });
});

describe('siteUrl', () => {
  it('returns a URL rather than throwing on garbage', () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'not a url at all' }).origin).toBeTruthy();
  });

  it('never throws for any input — a bad env var must not fail the build', () => {
    for (const value of ['', '   ', ':::', 'http://', '//', 'ht!tp://x']) {
      expect(() => siteUrl({ NEXT_PUBLIC_SITE_URL: value })).not.toThrow();
    }
  });
});
