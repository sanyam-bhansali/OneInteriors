import { describe, it, expect } from 'vitest';
import { resolveSiteUrl, siteUrl } from '@/lib/site';

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
