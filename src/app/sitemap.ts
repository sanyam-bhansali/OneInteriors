import type { MetadataRoute } from 'next';
import { publishedItems } from '@/modules/items/server';
import { absoluteUrl, itemUrl, itemsOrigin } from '@/modules/items/urls';

/**
 * The sitemap: the home page and every published item page (owner, 10 Nov
 * 2026: "a page for every item helping in SEO"). robots.ts still disallows
 * everything until this deployment answers for the public domain, so nothing
 * here is crawled before then.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const items = await publishedItems().catch(() => []);
  return [
    { url: `${itemsOrigin()}/`, changeFrequency: 'weekly', priority: 1 },
    { url: itemUrl(), changeFrequency: 'weekly', priority: 0.7 },
    ...items.map((i) => ({
      url: itemUrl(i.slug),
      lastModified: i.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      ...(i.photos.length ? { images: i.photos.slice(0, 5).map((p) => absoluteUrl(p)) } : {}),
    })),
  ];
}
