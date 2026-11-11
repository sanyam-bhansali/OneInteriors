import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { ITEMS_DICT } from '@/modules/i18n/site/items';
import { publishedItems } from '@/modules/items/server';
import { wordsFor } from '@/modules/items/rules';
import { ITEM_ROOMS } from '@/modules/items/input';
import { itemUrl, itemsIndexable } from '@/modules/items/urls';
import { ItemCard } from './ItemCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang(), ITEMS_DICT);
  return { title: t('meta.indexTitle'), description: t('meta.indexDescription'), alternates: { canonical: itemUrl() }, ...(itemsIndexable() ? { robots: { index: true, follow: true } } : {}) };
}

/** Every published item, by room (owner, 10 Nov 2026). */
export default async function ItemsIndex() {
  const lang = await getLang();
  const t = translator(lang, ITEMS_DICT);
  const items = await publishedItems();
  const rooms = ITEM_ROOMS.map((room) => ({ room, items: items.filter((i) => i.room === room) })).filter((g) => g.items.length);

  return (
    <>
      <SiteHeader />
      <main className="py-10 sm:py-14">
        <Container size="wide">
          <p className="m-0 mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">{t('index.eyebrow')}</p>
          <h1 className="m-0 text-[clamp(2rem,1.4rem+2.4vw,3rem)] font-medium leading-[1.05] tracking-[-0.03em]">{t('index.title')}</h1>
          <p className="mx-0 mb-0 mt-4 max-w-[60ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">{t('index.lede')}</p>
          {rooms.length === 0 ? <p className="mx-0 mb-0 mt-10 text-[15px] text-[var(--color-ink-2)]">{t('index.empty')}</p> : null}
          {rooms.map((g) => (
            <section key={g.room} className="mt-12">
              <h2 className="m-0 text-[20px] font-medium">{t(`room.${g.room}` as keyof typeof ITEMS_DICT)}</h2>
              <ul className="mx-0 mb-0 mt-4 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
                {g.items.map((i) => (
                  <li key={i.id}>
                    <ItemCard slug={i.slug} name={wordsFor(i, lang).name} photo={i.photos[0] ?? null} noPhoto={t('item.noPhoto')} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
