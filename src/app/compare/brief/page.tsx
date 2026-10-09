import type { Metadata } from 'next';
import { publicStudios } from '@/modules/studio/public';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { resolveRatesForMany } from '@/modules/quotation/resolve-rates';
import { showUnverifiedStudios } from '@/lib/env';
import { AppFooter, AppHeader } from '@/components/oi/Chrome';
import { FlowShell } from '@/components/home/FlowShell';
import { BriefClient } from './BriefClient';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { COMPARE_DICT } from '@/modules/i18n/site/compare';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang(), COMPARE_DICT);
  return { title: t('meta.briefTitle'), robots: { index: false, follow: false } };
}

export const dynamic = 'force-dynamic';

/**
 * The one-page brief of a comparison — the quotes come from the browser, as on /compare.
 *
 * The landing's canvas, without its cursor: this page is read, then printed,
 * and nothing on it waits for a scroll reveal, so the paper copy is complete.
 */
export default async function ComparisonBriefPage() {
  const studios = await cachedRoster();
  const rates = await resolveRatesForMany(studios.map((s) => s.slug));
  return (
    <FlowShell cursor={false} className="oi-quick">
      <AppHeader />
      <div className="wrap py-[clamp(40px,6vw,80px)] print:!p-0">
        <BriefClient
          studios={publicStudios(studios)}
          allowUnverified={showUnverifiedStudios()}
          filedRates={Object.fromEntries(Object.entries(rates).map(([slug, r]) => [slug, r.rates]))}
        />
      </div>
      <AppFooter />
    </FlowShell>
  );
}
