import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { OpsHeader } from '../ui';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { opsWithoutAuth } from '@/lib/env';
import { matchByName } from '@/modules/items/rules';
import { imageUploadEnabled } from '@/modules/storage/portfolio-images';
import { NewItem, ProductLink } from './ItemsClient';

export const metadata: Metadata = { title: 'Item photos · Ops' };
export const dynamic = 'force-dynamic';

/**
 * Item photos (owner, 10 Nov 2026): the One Interiors items every quotation
 * line is shown as, with the photos a customer sees on hover and on the
 * item's public page. A studio cannot send a quotation while a line's item
 * has no photo, so the "No photo" rows here are what is holding studios up.
 */
export default async function ItemsPage() {
  if (!opsWithoutAuth()) await requireRole('OPS');

  const [items, products] = await Promise.all([
    prisma.itemPage.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, room: true, photos: true, aliases: true, published: true, summary: true, _count: { select: { products: true } } },
    }),
    prisma.studioProduct.findMany({
      where: { isActive: true, itemId: null, studio: { status: { not: 'REMOVED' } } },
      select: { id: true, name: true, studio: { select: { tradeName: true } } },
      orderBy: [{ studioId: 'asc' }, { sortOrder: 'asc' }],
    }),
  ]);
  const unmatched = products.filter((p) => !matchByName(p.name, items)).slice(0, 200);
  const noPhoto = items.filter((i) => i.photos.length === 0).length;

  return (
    <>
      <OpsHeader />
      <main className="py-10">
        <Container size="wide">
          <h1 className="m-0 text-[28px]">Item photos</h1>
          <p className="m-0 mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--color-ink-2)]">
            Every line on a quotation is one of these items. Its first photo shows when a customer hovers or taps the line, and the
            item has its own public page. <strong>A studio cannot send a quotation while any of its lines has no photo</strong>, so
            add photos to the items marked <em>No photo</em> first. Never use a studio&apos;s name, logo or price in a photo or the
            text: this is public.
          </p>
          {!imageUploadEnabled() ? (
            <p className="m-0 mt-3 rounded-[12px] bg-[var(--color-paper-2)] px-4 py-3 text-[13px] text-[var(--color-atrisk)]">
              Photo upload is not switched on for this deployment (storage key missing).
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px]">
            <span className="rounded-full border border-[var(--color-rule)] px-3 py-1">{items.length} items</span>
            <span className={`rounded-full px-3 py-1 text-white ${noPhoto ? 'bg-[var(--color-atrisk)]' : 'bg-[var(--color-ontrack)]'}`}>
              {noPhoto} with no photo
            </span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-[var(--color-ink-3)]">
                  <th className="py-2 pr-3 font-normal">Photo</th>
                  <th className="py-2 pr-3 font-normal">Item</th>
                  <th className="py-2 pr-3 font-normal">Room</th>
                  <th className="py-2 pr-3 font-normal">Photos</th>
                  <th className="py-2 pr-3 font-normal">Linked products</th>
                  <th className="py-2 pr-3 font-normal">Public page</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-[var(--color-rule)]">
                    <td className="py-2 pr-3">
                      {i.photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.photos[0]} alt="" className="h-12 w-16 rounded-[8px] object-cover" />
                      ) : (
                        <span className="inline-block rounded-full bg-[var(--color-atrisk)] px-2 py-0.5 text-[11px] text-white">No photo</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Link href={`/ops/items/${i.id}`} className="font-medium">
                        {i.name}
                      </Link>
                      {!i.summary ? <span className="ml-2 text-[12px] text-[var(--color-ink-3)]">needs words</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-[var(--color-ink-2)]">{i.room}</td>
                    <td className="py-2 pr-3 tabular-nums">{i.photos.length}</td>
                    <td className="py-2 pr-3 tabular-nums">{i._count.products}</td>
                    <td className="py-2 pr-3">
                      {i.published ? (
                        <a href={`/items/${i.slug}`} target="_blank" rel="noopener" className="text-[13px]">
                          /items/{i.slug}
                        </a>
                      ) : (
                        <span className="text-[12px] text-[var(--color-ink-3)]">Hidden</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <NewItem />

          <h2 className="m-0 mt-12 text-[20px]">Studio products not matched to an item</h2>
          <p className="m-0 mt-2 max-w-3xl text-[14px] text-[var(--color-ink-2)]">
            Lines with these products show as missing a photo. Pick the item each one is; studios can also pick it themselves in
            Product master. {unmatched.length === 200 ? 'Showing the first 200.' : ''}
          </p>
          {unmatched.length === 0 ? (
            <p className="m-0 mt-4 text-[14px] text-[var(--color-ink-2)]">Every active product matches an item.</p>
          ) : (
            <div className="mt-4 grid gap-2">
              {unmatched.map((p) => (
                <ProductLink key={p.id} productId={p.id} studio={p.studio.tradeName} product={p.name} items={items.map((i) => ({ id: i.id, name: i.name }))} />
              ))}
            </div>
          )}
        </Container>
      </main>
    </>
  );
}
