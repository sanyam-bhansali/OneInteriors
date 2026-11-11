import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { OpsHeader } from '../../ui';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { opsWithoutAuth } from '@/lib/env';
import { imageUploadEnabled, MAX_IMAGE_MB, ACCEPTED_IMAGES } from '@/modules/storage/portfolio-images';
import { MAX_ITEM_PHOTOS } from '@/modules/items/ops';
import { ItemEditor } from './ItemEditor';

export const metadata: Metadata = { title: 'Item · Ops' };
export const dynamic = 'force-dynamic';

/** One item: its photos (the first shows on hover), its words in three languages, its address. */
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  if (!opsWithoutAuth()) await requireRole('OPS');
  const { id } = await params;
  const item = await prisma.itemPage.findUnique({ where: { id } });
  if (!item) notFound();
  const tr = (item.translations && typeof item.translations === 'object' ? item.translations : {}) as Record<string, Record<string, unknown> | undefined>;
  /* Only what was actually written in that language, so an empty box means "English shows". */
  const own = (lang: 'hi' | 'mr') => {
    const r = tr[lang] ?? {};
    const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
    const l = (k: string) => (Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x) => typeof x === 'string').join('\n') : '');
    return { name: s('name'), summary: s('summary'), whatItDoes: s('whatItDoes'), materials: l('materials'), finishes: l('finishes'), typicalSize: s('typicalSize') };
  };

  return (
    <>
      <OpsHeader />
      <main className="py-10">
        <Container size="wide">
          <Link href="/ops/items" className="text-[13px]">
            ← Item photos
          </Link>
          <h1 className="m-0 mt-2 text-[28px]">{item.name}</h1>
          <ItemEditor
            id={item.id}
            photos={item.photos}
            uploadOn={imageUploadEnabled()}
            uploadHint={`${ACCEPTED_IMAGES}, under ${Math.min(MAX_IMAGE_MB, 4)} MB each, up to ${MAX_ITEM_PHOTOS}. The first one is what customers see on hover.`}
            initial={{
              name: item.name,
              slug: item.slug,
              room: item.room,
              summary: item.summary,
              whatItDoes: item.whatItDoes,
              materials: item.materials.join('\n'),
              finishes: item.finishes.join('\n'),
              typicalSize: item.typicalSize ?? '',
              aliases: item.aliases.join('\n'),
              published: item.published,
              hi: own('hi'),
              mr: own('mr'),
            }}
          />
        </Container>
      </main>
    </>
  );
}
