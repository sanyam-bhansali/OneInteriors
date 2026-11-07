/**
 * Discover: what our team records about each studio photo before it can
 * appear in the feed (owner, 7 Nov 2026).
 *
 * A studio says which room each photo shows and which styles the project is
 * (portfolio `imageRooms`, `styleTags`), and whether its photos may appear
 * unnamed (`pickerConsent`). Our team adds what a customer can't read off a
 * picture — the materials — and checks the rest once. Only a checked photo
 * reaches the feed, so a wrong room or a render passed off as a photo is
 * caught by a person before any customer sees it.
 *
 * Kept per image in `PortfolioProject.imageTags`, aligned with `images` by
 * index. Pure and tested.
 */

export const MATERIAL_TAGS = [
  'Laminate',
  'Wood veneer',
  'Acrylic',
  'PU paint',
  'Lacquered glass',
  'Fluted panels',
  'Cane',
  'Rattan',
  'Jaali',
  'Brass',
  'Quartz',
  'Granite',
  'Marble',
  'Kota stone',
  'Wooden flooring',
  'Vitrified tiles',
  'Texture paint',
  'Wallpaper',
  'Stone cladding',
  'Cove lighting',
  'Profile lights',
  'Mirror',
] as const;
export type MaterialTag = (typeof MATERIAL_TAGS)[number];

export interface ImageTag {
  materials: MaterialTag[];
  checked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
}

const EMPTY: ImageTag = { materials: [], checked: false, checkedBy: null, checkedAt: null };

function isMaterial(v: unknown): v is MaterialTag {
  return typeof v === 'string' && (MATERIAL_TAGS as readonly string[]).includes(v);
}

/** The stored JSON, read defensively and aligned to `count` images. */
export function readImageTags(raw: unknown, count: number): ImageTag[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: count }, (_, i) => {
    const v = list[i] as Partial<ImageTag> | null | undefined;
    if (!v || typeof v !== 'object') return { ...EMPTY };
    return {
      materials: Array.isArray(v.materials) ? [...new Set(v.materials.filter(isMaterial))] : [],
      checked: v.checked === true,
      checkedBy: typeof v.checkedBy === 'string' ? v.checkedBy : null,
      checkedAt: typeof v.checkedAt === 'string' ? v.checkedAt : null,
    };
  });
}

/** One image's tags changed; the rest kept as they were. */
export function withImageTag(
  tags: readonly ImageTag[],
  index: number,
  patch: { materials?: readonly string[]; checked?: boolean },
  by: string,
  now: Date,
): ImageTag[] {
  return tags.map((t, i) => {
    if (i !== index) return t;
    const materials = patch.materials ? [...new Set(patch.materials.filter(isMaterial))] : t.materials;
    const checked = patch.checked ?? t.checked;
    return {
      materials,
      checked,
      checkedBy: checked ? (patch.checked !== undefined ? by : t.checkedBy) : null,
      checkedAt: checked ? (patch.checked !== undefined ? now.toISOString() : t.checkedAt) : null,
    };
  });
}
