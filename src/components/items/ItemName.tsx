'use client';

/**
 * A quotation line's name that shows what the thing is (owner, 10 Nov 2026):
 * "when someone hovers over a line item it should show a picture of it and
 * when someone clicks on it a new page should open in new tab".
 *
 * - Mouse: hovering (or keyboard focus) shows the item's photo beside the
 *   name; clicking opens /items/<slug> in a new tab.
 * - Touch: the first tap shows the photo with a button to open the page; a
 *   tap on the name while the photo is showing opens the page.
 * - No item: the plain name, nothing to hover.
 *
 * The card is drawn on <body> (a portal), `position: fixed` from the name's
 * own position, so neither an `overflow: hidden` table nor a transformed app
 * frame around the line can clip or shift it.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ItemRef } from '@/modules/items/rules';

const CARD_W = 248;

export interface ItemNameWords {
  /** "Opens in a new tab" */
  opens: string;
  /** "See what it is" — the touch button. */
  open: string;
  /** "Photo coming soon" */
  noPhoto: string;
}

const EN: ItemNameWords = {
  opens: 'Click to see what it is (opens in a new tab)',
  open: 'See what it is',
  noPhoto: 'Photo coming soon',
};

export function ItemName({ item, children, words = EN, className }: { item: ItemRef | null; children: ReactNode; words?: ItemNameWords; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const touched = useRef(false);
  const id = useId();

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(8, Math.min(r.left, vw - CARD_W - 8));
    const above = r.bottom + 230 > vh && r.top > 240;
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || document.getElementById(id)?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, id]);

  if (!item) return <span className={className}>{children}</span>;
  const href = `/items/${item.slug}`;

  return (
    <>
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener"
        className={`oi-itemname${className ? ` ${className}` : ''}`}
        aria-describedby={open ? id : undefined}
        title={words.opens}
        data-item={item.slug}
        onPointerDown={(e) => {
          touched.current = e.pointerType !== 'mouse';
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setOpen(false);
        }}
        onFocus={() => {
          if (!touched.current) show();
        }}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          /* Touch: the first tap shows the photo; the next one (or the button) opens the page. */
          if (touched.current && !open) {
            e.preventDefault();
            show();
          }
        }}
      >
        {children}
      </a>
      {open && pos
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              className="oi-itemcard"
              style={{
                left: pos.left,
                top: pos.top,
                width: CARD_W,
                transform: pos.above ? 'translateY(-100%)' : undefined,
              }}
            >
              {item.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photo} alt={item.name} width={CARD_W} height={186} loading="eager" />
              ) : (
                <span className="oi-itemcard-none">{words.noPhoto}</span>
              )}
              <span className="oi-itemcard-name">{item.name}</span>
              {touched.current ? (
                <a href={href} target="_blank" rel="noopener" className="oi-itemcard-open" onClick={() => setOpen(false)}>
                  {words.open} ↗
                </a>
              ) : (
                <span className="oi-itemcard-hint">{words.opens}</span>
              )}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
