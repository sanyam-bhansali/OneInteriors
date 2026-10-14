import { describe as it_describes, expect, it } from 'vitest';
import {
  cleanFilters,
  describe as describeFilters,
  isEmpty,
  MAX_VIEWS,
} from '@/modules/studio-practice/view-filters';

/**
 * A saved view holds JSON that came from a browser.
 *
 * So the interesting cases are all hostile or degraded: keys nobody declared,
 * values that are not strings, a megabyte of text aimed at a JSONB column, and
 * a view saved months ago that names a filter or a person who no longer
 * exists. Each of those has to end with the board showing something sensible
 * rather than throwing or quietly filtering on nonsense.
 */

/*
 * Leads at scale (12 Oct 2026): a view now holds the leads list's URL
 * filters (`query`), list or board (`view`) and `groupBy`. A view saved
 * before that carries `who`, which is read and turned into the same filter.
 */
it_describes('cleanFilters', () => {
  it('keeps only the keys a view is allowed to carry', () => {
    expect(cleanFilters({ who: 'pool', evil: 'x', nested: { a: 1 } })).toEqual({ query: 'owner=pool' });
    expect(cleanFilters({ query: 'due=today&evil=1', view: 'board', evil: 'x' })).toEqual({ query: 'due=today', view: 'board' });
  });

  it('drops empty strings, because the board already means that by nothing', () => {
    expect(cleanFilters({ who: '', groupBy: 'society' })).toEqual({ groupBy: 'society' });
    expect(cleanFilters({ query: '', groupBy: '  ' })).toEqual({});
  });

  it('trims', () => {
    expect(cleanFilters({ who: '  pool  ' })).toEqual({ query: 'owner=pool' });
    expect(cleanFilters({ groupBy: '  society ' })).toEqual({ groupBy: 'society' });
  });

  it('refuses a value long enough to be an attack on the column', () => {
    expect(cleanFilters({ who: 'x'.repeat(65) })).toEqual({});
    expect(cleanFilters({ who: 'x'.repeat(64) })).toEqual({ query: `owner=${'x'.repeat(64)}` });
    expect(cleanFilters({ groupBy: 'g'.repeat(65) })).toEqual({});
    // A megabyte of query keeps only what parses as a known filter.
    expect(cleanFilters({ query: `due=today&${'x'.repeat(1_000_000)}` })).toEqual({ query: 'due=today' });
  });

  it('ignores values that are not strings', () => {
    expect(cleanFilters({ who: 123, groupBy: null, query: 7, view: 1 })).toEqual({});
  });

  it('survives anything at all in the column', () => {
    for (const junk of [null, undefined, 'who=pool', 42, ['who'], true]) {
      expect(cleanFilters(junk)).toEqual({});
    }
  });
});

it_describes('isEmpty', () => {
  it('is true for a view that would show an unfiltered board', () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ view: 'list' })).toBe(true);
    expect(isEmpty({ query: 'owner=pool' })).toBe(false);
  });
});

it_describes('describe', () => {
  it('names the special filters in the list’s own words', () => {
    expect(describeFilters(cleanFilters({ who: 'pool' }))).toBe('Nobody has it (pool)');
    expect(describeFilters(cleanFilters({ who: 'quiet' }))).toBe('Gone quiet (7+ days)');
  });

  it('uses a member’s name when it can resolve one', () => {
    expect(describeFilters({ query: 'owner=m1' }, (id) => (id === 'm1' ? 'Anita' : null))).toBe("Anita's");
  });

  it('says so plainly when the person has left, rather than printing an id', () => {
    expect(describeFilters({ query: 'owner=gone' }, () => null)).toBe('Somebody who has left');
  });

  it('joins several filters', () => {
    expect(describeFilters({ query: 'owner=pool&due=missed', groupBy: 'society' })).toBe('Nobody has it (pool) · Missed follow-up · grouped by society');
  });

  it('is never blank', () => {
    expect(describeFilters({})).toBe('Everything');
  });
});

it_describes('MAX_VIEWS', () => {
  it('is small enough that the chips stay one row of reading', () => {
    expect(MAX_VIEWS).toBeLessThanOrEqual(12);
  });
});
