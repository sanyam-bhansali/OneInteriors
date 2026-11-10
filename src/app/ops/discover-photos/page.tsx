import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { OpsHeader } from '../ui';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { opsWithoutAuth } from '@/lib/env';
import { readImageTags } from '@/modules/discover/tags';
import { canSuggestTags } from '@/modules/discover/suggest-read';
import { STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { PhotoProject } from './PhotoProject';

export const metadata: Metadata = { title: 'Discover photos · Ops' };
export const dynamic = 'force-dynamic';

type Show = 'todo' | 'checked' | 'all';

/**
 * Discover photos (owner, 7 Nov 2026): every studio photo that may appear in
 * the customer's Discover feed, waiting for a person to check it.
 *
 * Only projects the studio marked "may appear unnamed" (`pickerConsent`) and
 * that are not renders are here. Our team confirms the room, adds the
 * materials a customer can't read off a picture, fixes the project's styles
 * if the studio got them wrong, and ticks Checked. Only then does the photo
 * reach the feed. Claude can suggest tags; a person still decides.
 */
export default async function DiscoverPhotosPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  if (!opsWithoutAuth()) await requireRole('OPS');
  const sp = await searchParams;
  const show: Show = sp.show === 'checked' || sp.show === 'all' ? sp.show : 'todo';

  const projects = await prisma.portfolioProject.findMany({
    where: { pickerConsent: true, isRender: false },
    orderBy: [{ studioId: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      locality: true,
      images: true,
      imageRooms: true,
      imageTags: true,
      styleTags: true,
      studio: { select: { tradeName: true } },
    },
  });

  let todo = 0;
  let checked = 0;
  const rows = projects.map((p) => {
    const tags = readImageTags(p.imageTags, p.images.length);
    const photos = p.images.map((src, i) => ({ index: i, src, room: p.imageRooms[i] ?? '', ...tags[i]! }));
    photos.forEach((ph) => (ph.checked ? checked++ : todo++));
    return {
      id: p.id,
      title: p.title,
      locality: p.locality,
      studio: p.studio.tradeName,
      styles: p.styleTags.filter((s): s is StyleTag => (STYLE_TAGS as readonly string[]).includes(s)),
      photos: photos.filter((ph) => show === 'all' || (show === 'checked' ? ph.checked : !ph.checked)),
    };
  });
  const visible = rows.filter((r) => r.photos.length > 0);

  const tab = (value: Show, label: string, n: number | null) => (
    <Link
      href={value === 'todo' ? '/ops/discover-photos' : `/ops/discover-photos?show=${value}`}
      className={`rounded-full px-3.5 py-1.5 text-[13px] no-underline ${
        show === value ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'border border-[var(--color-rule)] text-[var(--color-ink)]'
      }`}
    >
      {label}
      {n !== null ? ` (${n})` : ''}
    </Link>
  );

  return (
    <>
      <OpsHeader />
      <main className="py-10">
        <Container size="wide">
          <h1 className="m-0 text-[28px]">Discover photos</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-2)]">
            Photos studios allowed to appear unnamed. Check the room, add what you can see, fix the project&apos;s styles if
            needed, then tick <strong>Checked</strong>. Only checked photos reach customers&apos; Discover feed.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {tab('todo', 'To check', todo)}
            {tab('checked', 'Checked', checked)}
            {tab('all', 'All', null)}
          </div>

          {visible.length === 0 ? (
            <p className="m-0 mt-10 text-[15px] text-[var(--color-ink-2)]">
              {show === 'todo'
                ? 'Nothing to check. New photos appear here when a studio adds a project and allows its photos to appear unnamed.'
                : 'No photos here yet.'}
            </p>
          ) : (
            <div className="mt-8 grid gap-10">
              {visible.map((p) => (
                <PhotoProject key={p.id} project={p} canSuggest={canSuggestTags()} />
              ))}
            </div>
          )}
        </Container>
      </main>
    </>
  );
}
