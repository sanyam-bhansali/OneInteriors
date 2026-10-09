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
import { useSiteT } from '@/components/app/i18n';
import { QUIZ_DICT, fillParts } from '@/modules/i18n/site/quiz';
import { PillButton } from '@/components/home/parts';

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
  const t = useSiteT(QUIZ_DICT);

  if (pairs.length === 0) return null;
  if (done) {
    return (
      <p className="mt-5 rounded-[var(--r-m)] bg-[var(--sand)] px-5 py-4 text-[15px] leading-relaxed text-[var(--ink-2)]">
        {fillParts(
          t('tot.done', {
            rest:
              done.length > 1
                ? t('tot.then', { others: done.slice(1).map((s) => STYLE_LABELS[s]).join(` ${t('and')} `) })
                : '',
          }),
          { first: <strong className="font-medium text-[var(--ink)]">{STYLE_LABELS[done[0]!]}</strong> },
        )}
      </p>
    );
  }
  if (!open) {
    return (
      <div className="mt-5">
        <PillButton tone="line" size="sm" onClick={() => setOpen(true)}>
          {t('tot.open')}
        </PillButton>
      </div>
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
      <p className="eyebrow !mb-3">
        {t('tot.eyebrow', { i: i + 1, n: pairs.length })}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {pair.map((tag) => {
          const photo = stylePhotoFor(tag, otherRoom(tag, room));
          return (
            <button
              key={tag}
              type="button"
              onClick={() => choose(tag)}
              className="lift cursor-pointer overflow-hidden rounded-[var(--r-m)] border-0 bg-[var(--soft)] p-0 text-left"
              aria-label={t('tot.aria', { alt: photo.alt })}
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
        className="mt-3 min-h-11 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink)]"
      >
        {t('tot.skip')}
      </button>
    </div>
  );
}
