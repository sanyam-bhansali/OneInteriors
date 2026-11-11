'use client';

import { useActionState, useState, useTransition } from 'react';
import { ITEM_ROOMS } from '@/modules/items/input';
import { createItemAction, linkProductAction } from './actions';

const field = 'rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px]';

export function NewItem() {
  const [state, action, pending] = useActionState(createItemAction, null);
  return (
    <form action={action} className="mt-8 flex flex-wrap items-end gap-3 rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4">
      <label className="grid gap-1 text-[12px] text-[var(--color-ink-2)]">
        New item
        <input name="name" required placeholder="Sliding wardrobe" className={field} />
      </label>
      <label className="grid gap-1 text-[12px] text-[var(--color-ink-2)]">
        Room
        <select name="room" className={field} defaultValue="Bedroom">
          {ITEM_ROOMS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-[14px] text-[var(--color-paper)]">
        {pending ? 'Adding…' : 'Add item'}
      </button>
      {state && !state.ok ? <span className="text-[13px] text-[var(--color-atrisk)]">{state.error}</span> : null}
    </form>
  );
}

export function ProductLink({ productId, studio, product, items }: { productId: string; studio: string; product: string; items: { id: string; name: string }[] }) {
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--color-rule)] px-3 py-2 text-[14px]">
      <span className="min-w-[10rem] text-[12px] text-[var(--color-ink-3)]">{studio}</span>
      <span className="min-w-[14rem] flex-1 font-medium">{product}</span>
      <select
        className={field}
        value={value}
        disabled={pending}
        aria-label={`Item for ${product}`}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          start(async () => {
            const r = await linkProductAction(productId, next);
            setMsg(r.ok ? 'Saved' : r.error);
          });
        }}
      >
        <option value="">Pick the item…</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      {msg ? <span className="text-[12px] text-[var(--color-ink-2)]">{msg}</span> : null}
    </div>
  );
}
