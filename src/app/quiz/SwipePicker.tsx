'use client';

/**
 * Swipe your style, on phones (build queue item 14): one photo at a time,
 * right for "yes", left for "not me" — the same likes the grid records, in
 * less time and with more signal (a "not me" is kept as a pass, never as a
 * dislike: ruling a style out is its own question on the next screen).
 *
 * Buttons do the same as the swipe, so it works for anyone who cannot drag.
 */

import { useEffect, useState } from 'react';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { STYLE_LABELS, STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { stylePhotoFor, stylePhotoUrl, type PickerRoom } from '@/data/style-photos';
import { useSiteT } from '@/components/app/i18n';
import { QUIZ_DICT, fillParts } from '@/modules/i18n/site/quiz';
import { PillButton } from '@/components/home/parts';

const THRESHOLD = 90;

export function SwipePicker({
  selected,
  exclude,
  max,
  room,
  onChange,
}: {
  selected: StyleTag[];
  exclude: StyleTag[];
  max: number;
  room: PickerRoom;
  onChange: (likes: StyleTag[]) => void;
}) {
  const reduced = useReducedMotion();
  const t = useSiteT(QUIZ_DICT);
  const deck = STYLE_TAGS.filter((t) => !exclude.includes(t));
  const [i, setI] = useState(0);
  const [likes, setLikes] = useState<StyleTag[]>(selected);
  const done = likes.length >= max || i >= deck.length;

  const decide = (yes: boolean) => {
    const tag = deck[i];
    if (!tag) return;
    const next = yes && !likes.includes(tag) ? [...likes, tag] : likes;
    setLikes(next);
    onChange(next);
    setI(i + 1);
  };

  if (done) {
    return (
      <p className="m-0 rounded-[var(--r-m)] bg-[var(--sand)] px-5 py-4 text-[15px] leading-relaxed text-[var(--ink-2)]">
        {likes.length === 0
          ? t('swipe.none')
          : fillParts(t('swipe.picked'), {
              styles: <strong className="font-medium text-[var(--ink)]">{likes.map((s) => STYLE_LABELS[s]).join(', ')}</strong>,
            })}
      </p>
    );
  }

  const tag = deck[i]!;
  const photo = stylePhotoFor(tag, room);
  return (
    <div className="mx-auto max-w-[26rem]">
      <p className="eyebrow !mb-3">
        {t('swipe.count', { i: i + 1, n: deck.length, k: likes.length, max })}
      </p>
      <motion.div
        key={tag}
        drag={reduced ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        onDragEnd={(_e: unknown, info: PanInfo) => {
          if (info.offset.x > THRESHOLD) decide(true);
          else if (info.offset.x < -THRESHOLD) decide(false);
        }}
        initial={reduced ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="touch-pan-y overflow-hidden rounded-[var(--r-l)] bg-[var(--soft)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stylePhotoUrl(photo, 800)} alt={photo.alt} draggable={false} className="block aspect-[4/5] w-full object-cover" />
      </motion.div>
      <div className="mt-3 flex gap-3">
        <PillButton tone="line" className="flex-1" onClick={() => decide(false)}>
          {t('swipe.no')}
        </PillButton>
        <PillButton className="flex-1" onClick={() => decide(true)}>
          {t('swipe.yes')}
        </PillButton>
      </div>
    </div>
  );
}

/** Swipe on phones by default, the grid everywhere else; either can switch to the other. */
export function SwipeOrGrid({ grid, swipe }: { grid: React.ReactNode; swipe: React.ReactNode }) {
  const [mode, setMode] = useState<'grid' | 'swipe' | null>(null);
  const t = useSiteT(QUIZ_DICT);
  useEffect(() => {
    setMode(matchMedia('(pointer: coarse)').matches ? 'swipe' : 'grid');
  }, []);
  const current = mode ?? 'grid';
  return (
    <div>
      {current === 'swipe' ? swipe : grid}
      <button
        type="button"
        onClick={() => setMode(current === 'swipe' ? 'grid' : 'swipe')}
        className="mt-3 min-h-11 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink)]"
      >
        {current === 'swipe' ? t('swipe.toGrid') : t('swipe.toSwipe')}
      </button>
    </div>
  );
}
