'use client';

/**
 * "This or that" — four quick pairs after the style picks (build queue
 * item 12). Optional: skipping it leaves their likes exactly as picked.
 * The photos are a different room from the picker's where one exists, so
 * each pair is a fresh look at the style rather than the same picture again.
 */

import { useMemo, useState } from 'react';
import { STYLE_LABELS, type StyleTag } from '@/modules/brief/types';
import { applyChoices, pairsFor } from '@/modules/brief/this-or-that';
import { ROOM_STYLE_PHOTOS, stylePhotoFor, stylePhotoUrl, type PickerRoom } from '@/data/style-photos';

function otherRoom(tag: StyleTag, room: PickerRoom): PickerRoom {
  const rooms = ROOM_STYLE_PHOTOS[tag];
  if (room !== 'BEDROOM' && rooms?.BEDROOM) return 'BEDROOM';
  if (room !== 'KITCHEN' && rooms?.KITCHEN) return 'KITCHEN';
  return room;
}

export function ThisOrThat({
  likes,
  dislikes,
  room,
  onDone,
}: {
  likes: StyleTag[];
  dislikes: StyleTag[];
  room: PickerRoom;
  onDone: (likes: StyleTag[]) => void;
}) {
  const pairs = useMemo(() => pairsFor(likes, dislikes), [likes, dislikes]);
  const [open, setOpen] = useState(false);
  const [winners, setWinners] = useState<StyleTag[]>([]);
  const [done, setDone] = useState<StyleTag[] | null>(null);

  if (pairs.length === 0) return null;
  if (done) {
    return (
      <p className="mt-5 rounded-[10px] bg-[var(--acc-wash)] px-4 py-3 text-[15px] leading-relaxed text-[var(--ink2)]">
        Sharpened: you lean <strong className="text-[var(--ink)]">{STYLE_LABELS[done[0]!]}</strong> first
        {done.length > 1 ? <>, then {done.slice(1).map((t) => STYLE_LABELS[t]).join(' and ')}</> : null}.
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-5 py-2.5 text-[14px] font-semibold text-[var(--ink)] hover:border-[var(--ink2)]"
      >
        Sharpen it: four quick “this or that” pairs
      </button>
    );
  }

  const i = winners.length;
  const pair = pairs[i]!;
  const choose = (t: StyleTag) => {
    const next = [...winners, t];
    if (next.length >= pairs.length) {
      const result = applyChoices(likes, next);
      setDone(result);
      onDone(result);
    } else setWinners(next);
  };

  return (
    <div className="mt-6">
      <p className="oi-eyebrow m-0 mb-3">
        This or that · {i + 1} of {pairs.length}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {pair.map((t) => {
          const photo = stylePhotoFor(t, otherRoom(t, room));
          return (
            <button
              key={t}
              type="button"
              onClick={() => choose(t)}
              className="lift cursor-pointer overflow-hidden rounded-[10px] border-0 bg-transparent p-0 text-left"
              aria-label={`This one — ${photo.alt}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stylePhotoUrl(photo, 600)} alt={photo.alt} className="block aspect-[4/3] w-full object-cover" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[var(--ink2)] underline"
      >
        Skip this
      </button>
    </div>
  );
}
