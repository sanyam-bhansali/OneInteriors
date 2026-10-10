import type { Metadata } from 'next';
import { Quote } from './QuoteScreen';

export const metadata: Metadata = { title: 'Your quotes' };

/** Static, so it is prefetched; the data comes from the app's kept copy (`useAppData`). */
export default function AppQuotePage() {
  return <Quote />;
}
