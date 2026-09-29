import { describe, it, expect } from 'vitest';
import { PUNE_SOCIETIES } from '@/data/pune-societies';
import { PUNE_LOCALITIES } from '@/modules/brief/types';
import { canonicalSociety, knownSociety, sameSociety, searchSocieties } from '@/modules/brief/society';
import { societyKey } from '@/modules/floorplan/society-library';
import { cleanSociety } from '@/modules/brief/mapping';

describe('the society list', () => {
  it('puts every society in an area we know', () => {
    const slugs = new Set<string>(PUNE_LOCALITIES.map((l) => l.slug));
    for (const s of PUNE_SOCIETIES) expect(slugs.has(s.locality), s.name).toBe(true);
  });

  it('has no alias that points at two buildings', () => {
    const seen = new Map<string, string>();
    for (const s of PUNE_SOCIETIES) {
      for (const n of [s.name, ...(s.aliases ?? [])]) {
        const k = n.toLowerCase().replace(/[^a-z0-9]/g, '');
        expect(seen.get(k) ?? s.name, n).toBe(s.name);
        seen.set(k, s.name);
      }
    }
  });
});

describe('suggestions as they type', () => {
  it('finds Gera World of Joy, and knows it is in Kharadi', () => {
    const [first] = searchSocieties('gera');
    expect(first).toMatchObject({ name: 'Gera World of Joy', locality: 'kharadi' });
  });

  it('matches aliases and words inside the name', () => {
    expect(searchSocieties('world of joy')[0]!.name).toBe('Gera World of Joy');
    expect(searchSocieties('blue ridge')[0]!.name).toBe('Paranjape Blue Ridge');
  });

  it('waits for two letters', () => {
    expect(searchSocieties('g')).toEqual([]);
  });
});

describe('one spelling per building', () => {
  it('resolves spellings and aliases to the one name, and keeps unknown names as typed', () => {
    expect(canonicalSociety('  gera   woj ')).toBe('Gera World of Joy');
    expect(canonicalSociety('Sapphire Heights')).toBe('Sapphire Heights');
    expect(knownSociety('Trump Towers')!.locality).toBe('kalyani-nagar');
  });

  it('treats an alias and the name as the same building — for matching and the plan library', () => {
    expect(sameSociety('Gera WOJ', 'Gera World of Joy')).toBe(true);
    expect(sameSociety('Sapphire-Heights', 'sapphire heights')).toBe(true);
    expect(sameSociety('Nyati Elysia', 'Marvel Zephyr')).toBe(false);
    expect(societyKey('World of Joy')).toBe(societyKey('Gera World of Joy'));
  });

  it('stores the brief under the one spelling', () => {
    expect(cleanSociety('gera world of joy')).toBe('Gera World of Joy');
  });
});
