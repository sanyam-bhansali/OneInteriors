/**
 * Studio photographs in the style picker (build queue item 11; plan §5.2).
 *
 * Where a studio on the roster has a real, finished-home photograph of a
 * style — and has agreed it may appear, unnamed, in the picker
 * (`pickerConsent`) — it takes the stock photo's place for that style. The
 * customer picks on the room, never the brand: the studio is not named on the
 * tile, and it is not named after the pick either.
 *
 * A pick of a studio's photo is kept (`Brief.styleStudioPicks`) and read by
 * the style factor as direct evidence: they chose that studio's work before
 * they knew whose it was.
 *
 * Only a project whose FIRST style tag is the style counts — a warm-modern
 * flat with one Scandinavian lamp is not the picture of Scandinavian.
 * Renders never appear. Pure, and tested.
 */

import { STYLE_TAGS, type StyleTag } from './types';
import type { PortfolioProject } from '@/modules/studio/types';

export interface PickerPhoto {
  src: string;
  /** Describes the room, never the style or the studio. */
  alt: string;
  studioId: string;
}

/** Rooms that show a style best, in order. */
const ROOM_ORDER = ['LIVING', 'DINING', 'MASTER_BEDROOM', 'KITCHEN', 'BEDROOM'];

function bestImage(p: PortfolioProject): { src: string; room: string } | null {
  if (p.images.length === 0) return null;
  const rooms = p.imageRooms ?? [];
  const indexed = p.images.map((src, i) => ({ src, room: rooms[i] ?? '' }));
  for (const room of ROOM_ORDER) {
    const hit = indexed.find((x) => x.room === room);
    if (hit) return hit;
  }
  return indexed[0]!;
}

const ROOM_WORDS: Record<string, string> = {
  LIVING: 'living room',
  DINING: 'dining room',
  MASTER_BEDROOM: 'bedroom',
  BEDROOM: 'bedroom',
  KITCHEN: 'kitchen',
};

export function studioPickerPhotos(
  studios: { id: string; portfolio: PortfolioProject[] }[],
): Partial<Record<StyleTag, PickerPhoto>> {
  const out: Partial<Record<StyleTag, PickerPhoto>> = {};
  for (const tag of STYLE_TAGS) {
    for (const studio of studios) {
      const project = studio.portfolio.find(
        (p) => p.pickerConsent === true && !p.isRender && p.styleTags[0] === tag && p.images.length > 0,
      );
      const image = project ? bestImage(project) : null;
      if (image) {
        out[tag] = {
          src: image.src,
          alt: `A finished ${ROOM_WORDS[image.room] ?? 'room'} in a Pune home`,
          studioId: studio.id,
        };
        break;
      }
    }
  }
  return out;
}
