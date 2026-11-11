'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/modules/auth/session';
import { addItemPhotos, createItem, linkProduct, makeCoverPhoto, removeItemPhoto, saveItem, type OpsResult } from '@/modules/items/ops';

/**
 * Item photos and pages (owner, 10 Nov 2026). Every action checks the role
 * itself: the /ops layout guards pages, not actions.
 */

function refreshAll(slug?: string) {
  revalidatePath('/ops/items', 'layout');
  revalidatePath('/items', 'layout');
  if (slug) revalidatePath(`/items/${slug}`);
  revalidatePath('/studio/quotations', 'layout');
  revalidatePath('/studio/products');
}

export async function createItemAction(_prev: OpsResult | null, form: FormData): Promise<OpsResult> {
  await requireRole('OPS');
  const r = await createItem({ name: form.get('name'), room: form.get('room'), slug: form.get('slug') });
  if (!r.ok) return r;
  refreshAll();
  redirect(`/ops/items/${r.id}`);
}

export async function saveItemAction(id: string, input: Record<string, unknown>): Promise<OpsResult> {
  await requireRole('OPS');
  const r = await saveItem(String(id), input);
  if (r.ok) refreshAll(r.slug);
  return r;
}

/** One picture per call, so each stays under the 4 MB request limit (next.config.ts). */
export async function uploadItemPhotoAction(id: string, form: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireRole('OPS');
  const files = form.getAll('photo').filter((f): f is File => typeof f !== 'string' && f.size > 0);
  if (files.length === 0) return { ok: false, error: 'Pick a photo first.' };
  const r = await addItemPhotos(String(id), files);
  refreshAll();
  return r.errors.length ? { ok: r.added > 0, error: r.errors.join(' ') } : { ok: true };
}

export async function removeItemPhotoAction(id: string, url: string): Promise<OpsResult> {
  await requireRole('OPS');
  const r = await removeItemPhoto(String(id), String(url));
  refreshAll();
  return r;
}

export async function coverItemPhotoAction(id: string, url: string): Promise<OpsResult> {
  await requireRole('OPS');
  const r = await makeCoverPhoto(String(id), String(url));
  refreshAll();
  return r;
}

export async function linkProductAction(productId: string, itemId: string): Promise<OpsResult> {
  await requireRole('OPS');
  const r = await linkProduct(String(productId), itemId ? String(itemId) : null);
  refreshAll();
  return r;
}
