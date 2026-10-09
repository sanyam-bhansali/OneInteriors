import type { Metadata } from 'next';
import { HomeCB } from '@/components/home/HomeCB';
import { currentOffer } from '@/modules/consultation/offer-store';
import { translator } from '@/modules/i18n/site';
import { getLang } from '@/modules/i18n/server';
import { HOME_DICT } from '@/modules/i18n/site/home';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang(), HOME_DICT);
  return { title: t('meta.title'), description: t('meta.description') };
}

/**
 * The home page — v4 (components/home), the customer side in the manner of
 * cuberto.com at the owner's request of 8 Oct 2026. The v3 layout it replaced
 * is in components/landing-v3 and git history. "Find", never
 * "request": the first quote is generated from the studio's own rates, and no
 * studio is asked for it.
 */

/** The page is in the visitor's language, read from the `oa.lang` cookie, so it renders per request. */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [offer, lang] = await Promise.all([currentOffer(), getLang()]);
  return (
    <HomeCB lang={lang} offer={offer} />
  );
}
