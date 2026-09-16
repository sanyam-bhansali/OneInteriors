'use client';

import { useMemo, useState } from 'react';
import { ElementTile } from '@/components/art/ElementTile';
import { pickerFor, readBoard } from '@/modules/prepare/board';
import { elementBySlug, CATEGORY_LABELS, type ElementCategory } from '@/modules/prepare/catalogue';
import type { RoomKey } from '@/modules/prepare/rooms';
import type { BudgetTier, StyleTag } from '@/modules/brief/types';

/**
 * Where the customer actually builds their board.
 *
 * ## The one thing this does that Pinterest cannot
 *
 * Tell you what the board costs. Every tile carries the band it belongs to, and
 * when a board drifts above the customer's own band the page says so — once,
 * plainly, without scolding. Nobody's Pinterest board has ever done that,
 * because Pinterest has no idea what they have. We do.
 *
 * That is the whole argument for building this instead of importing theirs.
 *
 * ## Why above-band items are shown rather than hidden
 *
 * Two reasons and both matter. A catalogue filtered down to what someone can
 * afford reads as thin, and people can tell. And more importantly: wanting the
 * marble is legitimate. Plenty of good projects start above band and get
 * negotiated down on purpose. What must not happen is somebody discovering the
 * cost in month two — so they can have it, they just cannot have it by
 * accident.
 */
export function BoardEditor({
  room,
  likes,
  dislikes,
  tier,
  items,
  onChange,
}: {
  room: RoomKey;
  likes: StyleTag[];
  dislikes: StyleTag[];
  tier: BudgetTier | null;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ElementCategory | 'all'>('all');

  // Pure, and derived from props that rarely change — but it walks the whole
  // catalogue and sorts it, per room, and there are up to nine of these on the
  // page at once.
  const picker = useMemo(
    () => pickerFor(room, likes, dislikes, tier),
    [room, likes, dislikes, tier],
  );

  const reading = readBoard(items, tier);

  const categories = useMemo(() => {
    const present = new Set(picker.map((entry) => entry.element.category));
    return [...present];
  }, [picker]);

  const shown = category === 'all' ? picker : picker.filter((e) => e.element.category === category);

  function toggle(slug: string) {
    onChange(items.includes(slug) ? items.filter((s) => s !== slug) : [...items, slug]);
  }

  return (
    <div>
      {/* The board itself. Empty is a real state and says so plainly rather
          than showing a dashed rectangle with a plus in it. */}
      {items.length > 0 ? (
        <ul className="m-0 mb-3 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4">
          {items.map((slug) => {
            const element = elementBySlug(slug);
            if (!element) return null;
            const above = picker.find((e) => e.element.slug === slug)?.aboveBand ?? false;

            return (
              <li key={slug}>
                <button
                  type="button"
                  onClick={() => toggle(slug)}
                  aria-label={`Remove ${element.label} from this board`}
                  className="group block w-full overflow-hidden rounded-[8px] border border-[var(--color-rule)] text-left"
                >
                  <span className="relative block">
                    <ElementTile element={element} className="block aspect-[4/3] w-full" />
                    <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-ink)]/0 text-[12px] font-medium text-transparent group-hover:bg-[var(--color-ink)]/55 group-hover:text-[var(--color-paper)]">
                      Remove
                    </span>
                  </span>
                  <span className="block px-2 py-1.5">
                    <span className="block truncate text-[11.5px] leading-tight text-[var(--color-ink-2)]">
                      {element.label}
                    </span>
                    {above ? (
                      <span className="block font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--color-brass)]">
                        Above band
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 mb-3 rounded-[8px] border border-dashed border-[var(--color-rule)] px-4 py-5 text-[13.5px] italic text-[var(--color-ink-3)]">
          Nothing on this board yet. Add a few things below, or leave it — an empty room is a fine
          answer and the expert will ask you about it rather than assume.
        </p>
      )}

      {/* The budget reading. Said once, and null most of the time — a running
          commentary on every board becomes noise and then becomes nagging. */}
      {reading.message ? (
        <p className="m-0 mb-3 rounded-[8px] border-l-2 border-[var(--color-brass)] bg-[var(--color-paper)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {reading.message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-rule)] px-4 py-2 text-[13.5px] text-[var(--color-ink-2)] hover:border-[var(--color-petrol)] hover:text-[var(--color-ink)]"
      >
        {open ? 'Done adding' : 'Add to this board'}
        <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-ink-3)]">
          {picker.length}
        </span>
      </button>

      {open ? (
        <div className="mt-4 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Tab active={category === 'all'} onClick={() => setCategory('all')}>
              Everything
            </Tab>
            {categories.map((c) => (
              <Tab key={c} active={category === c} onClick={() => setCategory(c)}>
                {CATEGORY_LABELS[c]}
              </Tab>
            ))}
          </div>

          <ul className="m-0 grid max-h-[26rem] list-none grid-cols-2 gap-2 overflow-y-auto p-0 sm:grid-cols-3">
            {shown.map(({ element, aboveBand }) => {
              const picked = items.includes(element.slug);
              return (
                <li key={element.slug}>
                  <button
                    type="button"
                    onClick={() => toggle(element.slug)}
                    aria-pressed={picked}
                    className={`block w-full overflow-hidden rounded-[8px] border text-left ${
                      picked ? 'border-[var(--color-petrol)]' : 'border-[var(--color-rule)]'
                    }`}
                  >
                    <ElementTile element={element} className="block aspect-[4/3] w-full" />
                    <span className="block px-2.5 py-2">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[12.5px] text-[var(--color-ink)]">
                          {element.label}
                        </span>
                        {picked ? (
                          <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-petrol)]">
                            On board
                          </span>
                        ) : null}
                      </span>
                      {aboveBand ? (
                        <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--color-brass)]">
                          Above your band
                        </span>
                      ) : null}
                      {/* The sentence that teaches something. It is the reason
                          this is a catalogue and not a mood board of colours —
                          a customer who learns why acrylic shows fingerprints
                          has had a better ten minutes than one who liked a
                          picture. */}
                      <span className="mt-1 block text-[11.5px] leading-snug text-[var(--color-ink-3)]">
                        {element.note}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-[12.5px] ${
        active
          ? 'bg-[var(--color-petrol)] text-[var(--color-paper)]'
          : 'bg-[var(--color-paper-3)] text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  );
}
