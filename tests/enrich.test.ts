import { describe, expect, it } from 'vitest';
import { instagramHandle } from '@/modules/studio/handle';

/**
 * The handle parser is the only pure piece of enrichment, and it is the piece
 * that puts a link in front of an ops reviewer. A wrong handle is worse than
 * none: it sends somebody to a stranger's account and they judge a studio on
 * it.
 */
describe('instagramHandle', () => {
  it('takes a handle out of an ordinary profile URL', () => {
    expect(instagramHandle('https://www.instagram.com/teakline.studio/')).toBe('teakline.studio');
    expect(instagramHandle('http://instagram.com/Teakline')).toBe('teakline');
    expect(instagramHandle('instagram.com/teak_line_99')).toBe('teak_line_99');
  });

  it('accepts something already written as a handle', () => {
    expect(instagramHandle('@chitra.co')).toBe('chitra.co');
    expect(instagramHandle('chitra.co')).toBe('chitra.co');
  });

  it('refuses post and reel URLs', () => {
    // instagram.com/p/xyz is a post. Treating the "p" as a handle puts a dead
    // link in front of somebody deciding whether to approve a business.
    expect(instagramHandle('https://instagram.com/p/Cabc123/')).toBeNull();
    expect(instagramHandle('https://instagram.com/reel/Xyz/')).toBeNull();
    expect(instagramHandle('https://instagram.com/explore/tags/interiors/')).toBeNull();
    expect(instagramHandle('https://instagram.com/stories/someone/')).toBeNull();
  });

  it('refuses anything that is not a valid handle', () => {
    expect(instagramHandle('https://facebook.com/teakline')).toBeNull();
    expect(instagramHandle('not a handle')).toBeNull();
    expect(instagramHandle('...')).toBeNull();
    expect(instagramHandle('trailing.')).toBeNull();
    expect(instagramHandle('a'.repeat(31))).toBeNull();
  });

  it('survives null, undefined and empty', () => {
    expect(instagramHandle(null)).toBeNull();
    expect(instagramHandle(undefined)).toBeNull();
    expect(instagramHandle('')).toBeNull();
    expect(instagramHandle('   ')).toBeNull();
  });

  it('lowercases, so the same account is never stored twice', () => {
    expect(instagramHandle('@TeakLine.Studio')).toBe('teakline.studio');
  });
});
