import { NextResponse } from 'next/server';
import { appData } from '../data';

/**
 * The studios and rates the matches, quote, compare and phone screens work
 * from, fetched once by the app and kept (`components/app/useAppData`), so
 * moving between those screens never waits on the server. The same public
 * data those pages used to receive as props.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await appData(), {
    headers: { 'cache-control': 'private, max-age=300' },
  });
}
