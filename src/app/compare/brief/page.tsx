import type { Metadata } from 'next';
import { publicStudios } from '@/modules/studio/public';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { resolveRatesForMany } from '@/modules/quotation/resolve-rates';
import { showUnverifiedStudios } from '@/lib/env';
import { AppFooter, AppHeader } from '@/components/oi/Chrome';
import { Wrap } from '@/components/oi';
import { BriefClient } from './BriefClient';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { COMPARE_DICT } from '@/modules/i18n/site/compare';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang(), COMPARE_DICT);
  return { title: t('meta.briefTitle'), robots: { index: false, follow: false } };
}

export const dynamic = 'force-dynamic';

/** The one-page brief of a comparison — the quotes come from the browser, as on /compare. */
export default async function ComparisonBriefPage() {
  const studios = await cachedRoster();
  const rates = await resolveRatesForMany(studios.map((s) => s.slug));
  return (
    <div className="oi-app min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Wrap className="py-10">
        <BriefClient
          studios={publicStudios(studios)}
          allowUnverified={showUnverifiedStudios()}
          filedRates={Object.fromEntries(Object.entries(rates).map(([slug, r]) => [slug, r.rates]))}
        />
      </Wrap>
      <AppFooter />
    </div>
  );
}
