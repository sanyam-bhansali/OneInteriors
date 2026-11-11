import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { ITEMS_DICT } from '@/modules/i18n/site/items';
import { priceRangeFor, publicItem, publishedItems, relatedTo } from '@/modules/items/server';
import { isSlug, itemJsonLd, safeJsonForScript, wordsFor } from '@/modules/items/rules';
import { absoluteUrl, itemUrl, itemsIndexable } from '@/modules/items/urls';
import { isStarterPhoto } from '@/modules/items/starter-photos';
import { formatINRCompact } from '@/lib/money';
import { ItemCard } from '../ItemCard';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return isSlug(slug) ? publicItem(slug) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await load(slug);
  if (!item) return { title: 'Not found', robots: { index: false } };
  const lang = await getLang();
  const t = translator(lang, ITEMS_DICT);
  const w = wordsFor(item, lang);
  const url = itemUrl(item.slug);
  const title = t('meta.itemTitle', { name: w.name });
  const description = `${w.summary} ${w.whatItDoes}`.slice(0, 300);
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(itemsIndexable() ? { robots: { index: true, follow: true } } : {}),
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: 'One Interiors',
      images: item.photos.slice(0, 4).map((src) => ({ url: src, alt: w.name })),
    },
    twitter: { card: item.photos.length ? 'summary_large_image' : 'summary', title, description },
  };
}

/**
 * One item's own page (owner, 10 Nov 2026): what a quotation line is, with
 * photos, for the customer who clicked it and for search engines. One
 * Interiors' words only: never a studio's name, product name or rate. The
 * price shows only when three or more live studios price it (rules.ts).
 */
export default async function ItemPage({ params }: Props) {
  const { slug } = await params;
  const item = await load(slug);
  if (!item) notFound();

  const lang = await getLang();
  const t = translator(lang, ITEMS_DICT);
  const w = wordsFor(item, lang);
  const [range, all] = await Promise.all([priceRangeFor(item.id).catch(() => null), publishedItems()]);
  const related = relatedTo(item, all);
  const roomKey = `room.${item.room}` as keyof typeof ITEMS_DICT;
  const roomName = roomKey in ITEMS_DICT ? t(roomKey) : item.room;
  const url = itemUrl(item.slug);
  const ld = itemJsonLd({ url, words: { ...w, name: item.name }, photos: item.photos.map((p) => absoluteUrl(p)), category: item.room, range });
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Quotation items', item: itemUrl() },
      { '@type': 'ListItem', position: 2, name: item.name, item: url },
    ],
  };
  const [cover, ...rest] = item.photos;

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonForScript(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonForScript(crumbs) }} />
      <main className="py-8 sm:py-12" data-testid="item-page">
        <Container size="wide">
          <nav aria-label="Breadcrumb" className="mb-5 text-[13px] text-[var(--color-ink-3)]">
            <Link href="/items" className="text-[var(--color-ink-2)]">
              {t('crumb.items')}
            </Link>{' '}
            › <span>{roomName}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
            <section aria-label={w.name}>
              {cover ? (
                <figure className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover}
                    alt={t('item.photoOf', { name: w.name, n: 1 })}
                    className="aspect-[4/3] w-full rounded-[20px] bg-[var(--color-paper-2)] object-cover"
                    fetchPriority="high"
                  />
                </figure>
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[20px] bg-[var(--color-paper-2)] text-[15px] text-[var(--color-ink-3)]">
                  {t('item.noPhoto')}
                </div>
              )}
              {rest.length ? (
                <ul className="mx-0 mb-0 mt-3 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4">
                  {rest.map((src, i) => (
                    <li key={src}>
                      <a href={src} target="_blank" rel="noopener">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={t('item.photoOf', { name: w.name, n: i + 2 })} loading="lazy" className="aspect-square w-full rounded-[12px] object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {cover ? (
                <p className="mx-0 mb-0 mt-3 text-[12.5px] text-[var(--color-ink-3)]">
                  {/* Our starter photos are free stock pictures, said so like Discover's (owner, 10 Nov 2026). */}
                  {isStarterPhoto(cover) ? `${t('item.examplePhoto')} · ` : null}
                  {t('item.photoNote')}
                </p>
              ) : null}
            </section>

            <section>
              <p className="m-0 mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">{roomName}</p>
              <h1 className="m-0 text-[clamp(2rem,1.4rem+2.4vw,3rem)] font-medium leading-[1.05] tracking-[-0.03em]">{w.name}</h1>
              <p className="mx-0 mb-0 mt-4 max-w-[52ch] text-[18px] leading-relaxed text-[var(--color-ink)]">{w.summary}</p>

              <h2 className="m-0 pt-8 text-[18px] font-medium">{t('item.whatItDoes')}</h2>
              <p className="mx-0 mb-0 mt-2 max-w-[58ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">{w.whatItDoes}</p>

              <dl className="mx-0 mb-0 mt-8 grid gap-5 sm:grid-cols-2">
                {w.materials.length ? (
                  <div>
                    <dt className="text-[13px] font-medium text-[var(--color-ink-3)]">{t('item.materials')}</dt>
                    <dd className="mx-0 mb-0 mt-1.5">
                      <ul className="m-0 grid gap-1 pl-4 text-[15px]">
                        {w.materials.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
                {w.finishes.length ? (
                  <div>
                    <dt className="text-[13px] font-medium text-[var(--color-ink-3)]">{t('item.finishes')}</dt>
                    <dd className="mx-0 mb-0 mt-1.5">
                      <ul className="m-0 grid gap-1 pl-4 text-[15px]">
                        {w.finishes.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
                {w.typicalSize ? (
                  <div>
                    <dt className="text-[13px] font-medium text-[var(--color-ink-3)]">{t('item.size')}</dt>
                    <dd className="mx-0 mb-0 mt-1.5 text-[15px]">{w.typicalSize}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[13px] font-medium text-[var(--color-ink-3)]">{t('item.price')}</dt>
                  {range ? (
                    <dd className="mx-0 mb-0 mt-1.5">
                      <span className="text-[20px] font-medium tabular-nums">
                        {formatINRCompact(range.lowPaise)}–{formatINRCompact(range.highPaise)}
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-snug text-[var(--color-ink-3)]">{t('item.priceNote', { n: range.studios })}</span>
                    </dd>
                  ) : (
                    <dd className="mx-0 mb-0 mt-1.5 text-[14px] leading-snug text-[var(--color-ink-2)]">{t('item.noPrice')}</dd>
                  )}
                </div>
              </dl>

              <div className="mt-10 rounded-[20px] bg-[var(--color-paper-2)] p-5">
                <p className="m-0 text-[15px] text-[var(--color-ink-2)]">{t('item.ctaLede')}</p>
                <Link
                  href="/"
                  className="mt-3 inline-block rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-[15px] text-[var(--color-paper)] no-underline"
                >
                  {t('item.cta')}
                </Link>
              </div>
            </section>
          </div>

          {related.length ? (
            <section className="mt-16">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="m-0 text-[22px] font-medium">{t('item.related')}</h2>
                <Link href="/items" className="text-[14px]">
                  {t('item.all')}
                </Link>
              </div>
              <ul className="mx-0 mb-0 mt-5 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-4">
                {related.map((r) => (
                  <li key={r.id}>
                    <ItemCard slug={r.slug} name={wordsFor(r, lang).name} photo={r.photos[0] ?? null} noPhoto={t('item.noPhoto')} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
