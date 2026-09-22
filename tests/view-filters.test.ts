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

it_describes('cleanFilters', () => {
  it('keeps only the keys a view is allowed to carry', () => {
    expect(cleanFilters({ who: 'pool', evil: 'x', nested: { a: 1 } })).toEqual({ who: 'pool' });
  });

  it('drops empty strings, because the board already means that by nothing', () => {
    /* Two views that filter identically have to compare equal, or the chip
       for the one you just applied will not light. */
    expect(cleanFilters({ who: '', groupBy: 'society' })).toEqual({ groupBy: 'society' });
  });

  it('trims', () => {
    expect(cleanFilters({ who: '  pool  ' })).toEqual({ who: 'pool' });
  });

  it('refuses a value long enough to be an attack on the column', () => {
    expect(cleanFilters({ who: 'x'.repeat(65) })).toEqual({});
    expect(cleanFilters({ who: 'x'.repeat(64) })).toEqual({ who: 'x'.repeat(64) });
  });

  it('ignores values that are not strings', () => {
    expect(cleanFilters({ who: 123, groupBy: null })).toEqual({});
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
    expect(isEmpty({ who: 'pool' })).toBe(false);
  });
});

it_describes('describe', () => {
  it('names the two special filters in the board’s own words', () => {
    expect(describeFilters({ who: 'pool' })).toBe('Nobody has taken');
    expect(describeFilters({ who: 'quiet' })).toBe('Gone quiet');
  });

  it('uses a member’s name when it can resolve one', () => {
    expect(describeFilters({ who: 'm1' }, (id) => (id === 'm1' ? 'Anita' : null))).toBe(
      "Anita's",
    );
  });

  it('says so plainly when the person has left, rather than printing an id', () => {
    /* The view still loads — the board simply matches nothing — and this
       label is what tells the owner to delete it. */
    expect(describeFilters({ who: 'gone' }, () => null)).toBe('Somebody who has left');
  });

  it('joins several filters', () => {
    expect(describeFilters({ who: 'pool', groupBy: 'society' })).toBe(
      'Nobody has taken · grouped by society',
    );
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
