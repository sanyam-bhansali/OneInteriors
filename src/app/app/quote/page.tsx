import type { Metadata } from 'next';
import { appData } from '../data';
import { QuoteScreen } from './QuoteScreen';

export const metadata: Metadata = { title: 'Your quotes' };
export const dynamic = 'force-dynamic';

export default async function AppQuotePage() {
  return <QuoteScreen data={await appData()} />;
}
