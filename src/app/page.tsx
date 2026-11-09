import type { Metadata } from 'next';
import { Landing } from '@/components/landing-v31/Landing';
import { translator } from '@/modules/i18n/site';
import { getLang } from '@/modules/i18n/server';
import { HOME_DICT } from '@/modules/i18n/site/home';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang(), HOME_DICT);
  return { title: t('meta.title'), description: t('meta.description') };
}

/**
 * The home page — v3.1 (owner, 4 Nov 2026): the design in components/landing-v31,
 * its words in the visitor's language and its price bands from the product.
 * The v4 page it replaced is components/home/HomeCB.tsx, kept for now.
 */

/** The page is in the visitor's language, read from the `oa.lang` cookie, so it renders per request. */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  return <Landing lang={await getLang()} />;
}
