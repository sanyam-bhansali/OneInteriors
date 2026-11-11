import { useEffect, useState } from 'react';
import { apiBase } from './config';

/**
 * Quotation items (owner, 10 Nov 2026): every line has a photo and its own
 * page on the website. Shapes copied from src/modules/items/rules.ts
 * (`ItemRef`) and /api/items/catalogue. Change one, change the other.
 */

export interface ItemRef {
  slug: string;
  name: string;
  /** A full public URL, or null while our team has not added one. */
  photo: string | null;
}

/** A photo the website serves from its own folder (`/items/x.webp`) as a full address the app can load. */
export function photoUrl(photo: string): string {
  return photo.startsWith('/') ? `${apiBase()}${photo}` : photo;
}

/** The item's page on the website. */
export function itemPageUrl(slug: string): string {
  return `${apiBase()}/items/${encodeURIComponent(slug)}`;
}

let pending: Promise<Record<string, ItemRef>> | null = null;

/** The first quote's catalogue lines → items, fetched once per app run. Empty if it fails. */
export function useCatalogueItems(): Record<string, ItemRef> {
  const [items, setItems] = useState<Record<string, ItemRef>>({});
  useEffect(() => {
    let live = true;
    pending ??= fetch(`${apiBase()}/api/items/catalogue`)
      .then((r) => (r.ok ? r.json() : { items: {} }))
      .then((b: { items?: Record<string, ItemRef> }) => b.items ?? {})
      .catch(() => {
        pending = null;
        return {};
      });
    void pending.then((x) => {
      if (live) setItems(x);
    });
    return () => {
      live = false;
    };
  }, []);
  return items;
}
