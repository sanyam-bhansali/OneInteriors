import type { Metadata } from 'next';
import { hasDatabase } from '@/lib/env';
import { chooseView } from '@/modules/portal/choose';
import { ChooseScreen } from './ChooseScreen';

export const metadata: Metadata = { title: 'Meet your studios', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Choose & sign, steps 1–2 (v79): the expert call, then the studios ops introduced and their visits. */
export default async function ChoosePage() {
  if (!hasDatabase()) return <ChooseScreen view={null} sample />;
  return <ChooseScreen view={await chooseView()} sample={false} />;
}
