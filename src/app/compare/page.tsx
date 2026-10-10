import { currentOffer } from '@/modules/consultation/offer-store';
import type { Metadata } from 'next';
import { publicStudios } from '@/modules/studio/public';
import { CompareClient } from './CompareClient';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { resolveRatesForMany } from '@/modules/quotation/resolve-rates';
import { showUnverifiedStudios } from '@/lib/env';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { COMPARE_DICT } from '@/modules/i18n/site/compare';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang(), COMPARE_DICT);
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    robots: { index: false, follow: false },
  };
}

/**
 * Side by side.
 *
 * A thin server shell: the comparison is built entirely from quotes the
 * customer generated in this session, which live in the browser. Nothing here
 * reads the database, and there is deliberately no server-side re-pricing —
 * a quote that changed between the studio's page and this one would be a quote
 * nobody could rely on.
 *
 * The previous version of this page ranked the roster itself and quoted the
 * top few on the fly, so the customer's own choices had no bearing on what
 * they saw. See CompareClient.
 */
export default async function ComparePage() {
  /* The quotes still come from the browser — the ones the customer saw. The
     roster and rates come from here, for the fit block, which ranks exactly
     as the match page does (same gate, same rates). */
  const studios = await cachedRoster();
  const [rates, offer] = await Promise.all([
    resolveRatesForMany(studios.map((s) => s.slug)),
    currentOffer(),
  ]);
  return (
    <CompareClient
      offer={offer}
      studios={publicStudios(studios)}
      allowUnverified={showUnverifiedStudios()}
      filedRates={Object.fromEntries(Object.entries(rates).map(([slug, r]) => [slug, r.rates]))}
    />
  );
}
