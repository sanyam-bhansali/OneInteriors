import { describe, expect, it } from 'vitest';
import { emptyPoolMessage } from '@/modules/studio-sales/pool-empty';

describe('emptyPoolMessage', () => {
  it('an unfiltered empty pool: every lead has an owner', () => {
    expect(emptyPoolMessage('owner=pool&sort=recent', false)).toBe('Nothing in the pool — every lead has an owner.');
    expect(emptyPoolMessage('owner=pool&pool=abc&sort=recent', false)).toBe('Nothing in the pool — every lead has an owner.');
  });
  it('a search with no match says so, not that the pool is empty', () => {
    expect(emptyPoolMessage('owner=pool&q=zzzz&sort=recent', false)).toBe('No pool leads match this search or these filters.');
    expect(emptyPoolMessage('owner=pool&stage=s1', false)).toBe('No pool leads match this search or these filters.');
  });
  it('the All leads view', () => expect(emptyPoolMessage('sort=recent&all=1', true)).toBe('No leads here.'));
});
