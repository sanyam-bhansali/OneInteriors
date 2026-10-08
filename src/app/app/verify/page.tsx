import type { Metadata } from 'next';
import { appData } from '../data';
import { VerifyScreen } from './VerifyScreen';

export const metadata: Metadata = { title: 'Your quotes are ready' };
export const dynamic = 'force-dynamic';

export default async function AppVerifyPage() {
  return <VerifyScreen data={await appData()} />;
}
