/**
 * The address search engines are told an item page lives at: the public
 * domain once this deployment answers for it (`PUBLIC_HOST`), else this
 * deployment's own URL (lib/site.ts). Pure.
 */

import { resolveSiteUrl } from '@/lib/site';

export function itemsOrigin(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): string {
  const host = env.PUBLIC_HOST?.trim();
  if (host) return `https://${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  return resolveSiteUrl(env).replace(/\/+$/, '');
}

/** `/items` or `/items/<slug>`, absolute. */
export function itemUrl(slug?: string, env?: Record<string, string | undefined>): string {
  return `${itemsOrigin(env)}/items${slug ? `/${slug}` : ''}`;
}

/**
 * Item pages are for search engines, unlike the rest of the site, which the
 * root layout keeps out of them for now. Indexable only once this deployment
 * answers for the public domain (the same test robots.ts uses), so a preview
 * or the *.vercel.app address is never indexed.
 */
export function itemsIndexable(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): boolean {
  return Boolean(env.PUBLIC_HOST?.trim());
}

/** A photo path served by this site (`/items/x.webp`) as a full address; full URLs pass through. */
export function absoluteUrl(src: string, env?: Record<string, string | undefined>): string {
  return src.startsWith('/') ? `${itemsOrigin(env)}${src}` : src;
}
