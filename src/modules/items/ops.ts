import 'server-only';

/**
 * Item pages: our team's writes (owner, 10 Nov 2026). Callers check the OPS
 * role first (app/ops/items/actions.ts); nothing here does, so nothing here
 * is imported by a page a studio or a customer can reach.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isOurImageUrl, removePortfolioImage, storePublicImage } from '@/modules/storage/portfolio-images';
import { cleanItemInput, type ItemInput } from './input';

export type OpsResult = { ok: true; id?: string; slug?: string } | { ok: false; error: string };

/** Most photos an item keeps. The hover shows one; the page shows a gallery. */
export const MAX_ITEM_PHOTOS = 12;

export async function createItem(raw: { name: unknown; room: unknown; slug?: unknown }): Promise<OpsResult> {
  const clean = cleanItemInput({ name: raw.name, room: raw.room, slug: raw.slug, summary: '', whatItDoes: '' }, { partial: true });
  if (!clean.ok) return clean;
  try {
    const row = await prisma.itemPage.create({
      data: { slug: clean.value.slug, name: clean.value.name, room: clean.value.room, summary: '', whatItDoes: '', published: false },
      select: { id: true, slug: true },
    });
    return { ok: true, id: row.id, slug: row.slug };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, error: 'An item already has that address. Change the name or the address.' };
    return { ok: false, error: 'That did not save.' };
  }
}

export async function saveItem(id: string, raw: Record<string, unknown>): Promise<OpsResult> {
  const clean = cleanItemInput(raw as Partial<Record<keyof ItemInput, unknown>>);
  if (!clean.ok) return clean;
  const v = clean.value;
  const current = await prisma.itemPage.findUnique({ where: { id }, select: { photos: true } });
  if (!current) return { ok: false, error: 'That item is gone.' };
  if (v.published && (!v.summary || !v.whatItDoes)) return { ok: false, error: 'Write what it is and what it does before publishing the page.' };
  try {
    const row = await prisma.itemPage.update({
      where: { id },
      data: {
        slug: v.slug,
        name: v.name,
        room: v.room,
        summary: v.summary,
        whatItDoes: v.whatItDoes,
        materials: v.materials,
        finishes: v.finishes,
        typicalSize: v.typicalSize,
        aliases: v.aliases,
        published: v.published,
        translations: v.translations as Prisma.InputJsonValue,
      },
      select: { id: true, slug: true },
    });
    return { ok: true, id: row.id, slug: row.slug };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, error: 'Another item already has that address.' };
    return { ok: false, error: 'That did not save.' };
  }
}

/** Store each picture and append it. Returns what failed, by file, so the others still land. */
export async function addItemPhotos(id: string, files: File[]): Promise<{ added: number; errors: string[] }> {
  const item = await prisma.itemPage.findUnique({ where: { id }, select: { photos: true } });
  if (!item) return { added: 0, errors: ['That item is gone.'] };
  const room = MAX_ITEM_PHOTOS - item.photos.length;
  const errors: string[] = [];
  if (files.length > room) errors.push(`An item keeps ${MAX_ITEM_PHOTOS} photos; the last ${files.length - Math.max(room, 0)} were not added.`);
  const urls: string[] = [];
  for (const f of files.slice(0, Math.max(room, 0))) {
    const r = await storePublicImage(`items/${id}`, f);
    if (r.ok) urls.push(r.url);
    else errors.push(r.error);
  }
  if (urls.length) {
    /* Appended in one statement, so two uploads at once do not drop each other's photos. */
    await prisma.$executeRaw`UPDATE "item_pages" SET "photos" = "photos" || ${urls}::text[], "updatedAt" = NOW() WHERE "id" = ${id}`;
  }
  return { added: urls.length, errors };
}

export async function removeItemPhoto(id: string, url: string): Promise<OpsResult> {
  const item = await prisma.itemPage.findUnique({ where: { id }, select: { photos: true } });
  if (!item || !item.photos.includes(url)) return { ok: false, error: 'That photo is not on this item.' };
  await prisma.itemPage.update({ where: { id }, data: { photos: item.photos.filter((p) => p !== url) } });
  if (isOurImageUrl(url)) await removePortfolioImage(url);
  return { ok: true };
}

/** Make this photo the first one: the one a customer sees on hover. */
export async function makeCoverPhoto(id: string, url: string): Promise<OpsResult> {
  const item = await prisma.itemPage.findUnique({ where: { id }, select: { photos: true } });
  if (!item || !item.photos.includes(url)) return { ok: false, error: 'That photo is not on this item.' };
  await prisma.itemPage.update({ where: { id }, data: { photos: [url, ...item.photos.filter((p) => p !== url)] } });
  return { ok: true };
}

/** Tie any studio's product to an item, from the console's "not matched" list. */
export async function linkProduct(productId: string, itemId: string | null): Promise<OpsResult> {
  if (itemId && !(await prisma.itemPage.findUnique({ where: { id: itemId }, select: { id: true } }))) return { ok: false, error: 'That item is gone.' };
  const { count } = await prisma.studioProduct.updateMany({ where: { id: productId }, data: { itemId } });
  return count ? { ok: true } : { ok: false, error: 'That product is gone.' };
}
