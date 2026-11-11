'use client';

import { useEffect, useState } from 'react';
import type { ItemRef } from '@/modules/items/rules';

/**
 * The first-quote catalogue's items (code → photo and page), fetched once per
 * page load from /api/items/catalogue and shared by every document on the page.
 * Empty until it arrives, or if it fails: the lines then read as plain names.
 */
let pending: Promise<Record<string, ItemRef>> | null = null;

function load(): Promise<Record<string, ItemRef>> {
  pending ??= fetch('/api/items/catalogue')
    .then((r) => (r.ok ? r.json() : { items: {} }))
    .then((b: { items?: Record<string, ItemRef> }) => b.items ?? {})
    .catch(() => {
      pending = null;
      return {};
    });
  return pending;
}

export function useCatalogueItems(): Record<string, ItemRef> {
  const [items, setItems] = useState<Record<string, ItemRef>>({});
  useEffect(() => {
    let live = true;
    void load().then((x) => {
      if (live) setItems(x);
    });
    return () => {
      live = false;
    };
  }, []);
  return items;
}
