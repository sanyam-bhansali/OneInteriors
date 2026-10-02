'use client';

import dynamic from 'next/dynamic';
import type { LayoutRoomKey } from '@/modules/brief/flat-layout';
import type { StyleTag } from '@/modules/brief/types';

const Flat3D = dynamic(() => import('@/components/oi/Flat3D').then((m) => m.Flat3D), {
  ssr: false,
  loading: () => <p className="m-0 text-[14px] text-[var(--color-ink-3)]">Drawing your flat…</p>,
});

/** Their flat in 3D on "Your home" — built once as it opens, then theirs to turn. */
export function HomeIn3D(props: {
  bedrooms: number;
  carpetAreaSqft: number;
  style: StyleTag | null;
  inScope: LayoutRoomKey[] | null;
  label: string;
}) {
  return (
    <div className="h-[22rem] w-full overflow-hidden rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
      <Flat3D {...props} className="h-full w-full cursor-grab" />
    </div>
  );
}
