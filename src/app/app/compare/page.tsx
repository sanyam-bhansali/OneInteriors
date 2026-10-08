import type { Metadata } from 'next';
import { appData } from '../data';
import { CompareScreen } from './CompareScreen';

export const metadata: Metadata = { title: 'Side by side' };
export const dynamic = 'force-dynamic';

export default async function AppComparePage() {
  return <CompareScreen data={await appData()} />;
}
