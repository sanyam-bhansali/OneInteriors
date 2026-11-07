import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { discoverContext } from '@/modules/discover/server';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { DISCOVER_DICT } from '@/modules/i18n/site/discover';
import { DiscoverClient } from './DiscoverClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang(), DISCOVER_DICT);
  return { title: t('meta.title'), description: t('meta.description') };
}

export const dynamic = 'force-dynamic';

/**
 * Discover (owner, 7 Nov 2026): a Pinterest-style feed of real Pune rooms.
 * Save what you love; after about twenty saves we show your style and carry
 * it into the Home Profile. Saves live on the device until there is a Home
 * Profile, then on it too (Brief.discoverSaves), so the expert sees them and
 * the phone app shows the same boards. Research and plan: the "Design Your
 * Home" doc, Phase 1.
 */
export default async function DiscoverPage() {
  const ctx = await discoverContext();
  return (
    <>
      <SiteHeader />
      <main className="py-8 sm:py-12">
        <DiscoverClient
          pins={ctx.pins}
          sqft={ctx.sqft}
          sqftAssumed={ctx.sqftAssumed}
          hasProfile={ctx.hasProfile}
          serverSaves={ctx.saved}
        />
      </main>
      <SiteFooter />
    </>
  );
}
