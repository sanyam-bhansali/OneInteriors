import { NextResponse } from 'next/server';
import { itemRefsForCatalogue } from '@/modules/items/server';

/**
 * Each first-quote line's item: name, address and first photo (owner, 10 Nov
 * 2026). Public data, the same for everyone, so it is cached for five
 * minutes. Read by the first-quote document on the site and by the phone app.
 */
export const revalidate = 300;

export async function GET() {
  const items = await itemRefsForCatalogue().catch(() => ({}));
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
}
