import { after, NextResponse } from 'next/server';
import { appData } from '../data';
import { loadBrief } from '@/modules/brief/repository';
import { recordJourney } from '@/modules/app/record-journey';

/**
 * The studios and rates the matches, quote, compare and phone screens work
 * from, fetched once by the app and kept (`components/app/useAppData`), so
 * moving between those screens never waits on the server. The same public
 * data those pages used to receive as props.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await appData();
  /* The app ranks and prices in the browser; the record is kept here, after
     the response, so the expert and ops read the same quotes the customer
     saw — what /match does for the website. Nothing to keep without a
     finished brief or a database. */
  if (!data.sample) {
    const loaded = await loadBrief().catch(() => null);
    if (loaded?.found && loaded.brief.completedAt) {
      const brief = loaded.brief;
      after(() => recordJourney(brief, data));
    }
  }
  return NextResponse.json(data, {
    headers: { 'cache-control': 'private, max-age=300' },
  });
}
