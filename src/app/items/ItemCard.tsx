import Link from 'next/link';

/** An item as a tile: its first photo and its name, linking to its page. */
export function ItemCard({ slug, name, photo, noPhoto }: { slug: string; name: string; photo: string | null; noPhoto: string }) {
  return (
    <Link href={`/items/${slug}`} className="group block text-[var(--color-ink)] no-underline">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-[14px] bg-[var(--color-paper-2)] object-cover transition-opacity group-hover:opacity-90" />
      ) : (
        <span className="flex aspect-[4/3] w-full items-center justify-center rounded-[14px] bg-[var(--color-paper-2)] text-[12.5px] text-[var(--color-ink-3)]">
          {noPhoto}
        </span>
      )}
      <span className="mt-2 block text-[15px] font-medium leading-snug group-hover:underline">{name}</span>
    </Link>
  );
}
