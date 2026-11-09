import { describe, expect, it } from 'vitest';
import { MARKUP } from '@/components/landing-v31/markup';
import { LANDING_WORDS } from '@/components/landing-v31/words';
import { HOME_SIZES, SCRIPT_WORDS, SHOWROOM } from '@/components/landing-v31/script-words';
import { landingData, landingHtml } from '@/components/landing-v31/Landing';
import { TIER } from '@/modules/quotation/tiers';
import { LANGS } from '@/modules/i18n/site';

/** The v3.1 home page (owner, 4 Nov 2026). */

const slots = new Set([...MARKUP.matchAll(/\{\{(w\d{3})\}\}/g)].map((m) => m[1]!));

describe('the v3.1 home page words', () => {
  it('has a word for every slot, and no word without a slot', () => {
    expect([...slots].filter((k) => !(k in LANDING_WORDS))).toEqual([]);
    expect(Object.keys(LANDING_WORDS).filter((k) => !slots.has(k))).toEqual([]);
  });

  it('is written in English, Hindi and Marathi everywhere', () => {
    const all = [
      ...Object.values(LANDING_WORDS),
      ...Object.values(SCRIPT_WORDS),
      ...Object.values(HOME_SIZES),
      ...SHOWROOM.flatMap((h) => [h.cat, h.meta, h.name, h.desc, h.loc, h.area, h.finish]),
    ];
    for (const e of all) for (const l of LANGS) expect(e[l.id], `${e.en} (${l.id})`).not.toBe('');
  });

  it('fills every slot, in every language', () => {
    for (const l of LANGS) expect(landingHtml(l.id)).not.toMatch(/\{\{w\d{3}\}\}/);
  });

  it('says Home Profile, never "brief", and never how studios pay us (owner, 4 Nov 2026)', () => {
    const en = landingHtml('en');
    expect(en).not.toMatch(/\bbrief\b/i);
    expect(en).not.toMatch(/pays us a fee|fee, only if you sign|how we are paid|make money/i);
    expect(en).toContain('Home Profile');
    expect(en).toContain('Who decides your matches?');
  });

  it('sends every start button to the Home Profile, and keeps every other link real', () => {
    const hrefs = [...MARKUP.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs).not.toContain('#start');
    expect(hrefs.filter((h) => !h.startsWith('#')).every((h) => ['/quiz', '/apply', '/privacy'].includes(h) || h.startsWith('/landing/'))).toBe(true);
  });

  it('escapes every word it places', () => {
    const before = LANDING_WORDS.w001!.en;
    LANDING_WORDS.w001!.en = '<script>x</script>"';
    try {
      expect(landingHtml('en')).toContain('&lt;script&gt;x&lt;/script&gt;&quot;');
    } finally {
      LANDING_WORDS.w001!.en = before;
    }
  });
});

describe('the v3.1 price estimator', () => {
  it('reads the real bands from the product', () => {
    const d = landingData('en');
    expect(d.tiers.E).toMatchObject({ from: TIER.ESSENTIAL.perSqftFrom, to: TIER.ESSENTIAL.perSqftTo });
    expect(d.tiers.P).toMatchObject({ from: TIER.PREMIUM.perSqftFrom, to: TIER.PREMIUM.perSqftTo });
    expect(d.tiers.L).toMatchObject({ from: TIER.LUXURY.perSqftFrom, to: null });
    expect(d.tiers.P.mats).toHaveLength(4);
  });

  it('speaks the visitor’s language', () => {
    expect(landingData('hi').words.stepOf).toBe('कदम {n} / 5');
    expect(landingData('mr').tiers.E.promise).not.toBe(landingData('en').tiers.E.promise);
  });
});
