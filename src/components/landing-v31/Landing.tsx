import { tx, type Lang } from '@/modules/i18n/site';
import { FINISH_TX } from '@/modules/i18n/site/labels';
import { TIER } from '@/modules/quotation/tiers';
import { MARKUP } from './markup';
import { LANDING_WORDS } from './words';
import { HOME_SIZES, SCRIPT_WORDS, SHOWROOM } from './script-words';
import { LandingClient } from './LandingClient';
import type { LandingData, LandingTier } from './script';

/**
 * The home page, v3.1 (owner, 4 Nov 2026): the design file's markup with every
 * word in the visitor's language and the price bands from the product.
 *
 * Words are escaped as they are placed: the markup is ours, the words are ours,
 * and nothing a visitor typed ever reaches this string.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function landingHtml(lang: Lang): string {
  return MARKUP.replace(/\{\{(w\d{3})\}\}/g, (whole, key: string) => {
    const entry = LANDING_WORDS[key];
    return entry ? escapeHtml(tx(lang, entry)) : whole;
  });
}

function tier(lang: Lang, key: keyof typeof TIER): LandingTier {
  const t = TIER[key];
  const words = FINISH_TX[key];
  return {
    name: t.label,
    from: t.perSqftFrom,
    to: t.perSqftTo,
    promise: tx(lang, words.promise),
    mats: words.materials.slice(0, 4).map((m) => tx(lang, m)),
  };
}

export function landingData(lang: Lang): LandingData {
  const words = Object.fromEntries(Object.entries(SCRIPT_WORDS).map(([k, v]) => [k, tx(lang, v)])) as LandingData['words'];
  return {
    words,
    showroom: SHOWROOM.map((h) => ({
      cat: tx(lang, h.cat), meta: tx(lang, h.meta), name: tx(lang, h.name), desc: tx(lang, h.desc),
      loc: tx(lang, h.loc), area: tx(lang, h.area), finish: tx(lang, h.finish), cost: h.cost, studio: h.studio,
    })),
    homes: Object.fromEntries(Object.entries(HOME_SIZES).map(([k, v]) => [Number(k), tx(lang, v)])),
    tiers: { E: tier(lang, 'ESSENTIAL'), P: tier(lang, 'PREMIUM'), L: tier(lang, 'LUXURY') },
  };
}

export function Landing({ lang }: { lang: Lang }) {
  return <LandingClient html={landingHtml(lang)} data={landingData(lang)} lang={lang} />;
}
