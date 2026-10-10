import type { Metadata } from 'next';
import { hasDatabase } from '@/lib/env';
import { availableSlots } from '@/modules/consultation/availability';
import { openSlots } from '@/modules/consultation/slots';
import { ARCHITECT } from '@/modules/consultation/architect';
import { ExpertScreen } from './ExpertScreen';

export const metadata: Metadata = { title: 'Talk to an expert', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * A test build has no calendar, so it shows the architect's usual hours
 * (Tue–Sun, 11 am – 7 pm) and books nothing.
 */
function sampleSlots() {
  const hours = [2, 3, 4, 5, 6, 0].map((weekday) => ({ expertUserId: 'sample', weekday, startMin: 660, endMin: 1140 }));
  return openSlots({ hours, blocked: new Map(), booked: new Map(), now: new Date() });
}

export default async function AppExpertPage() {
  const sample = !hasDatabase();
  const slots = sample ? sampleSlots() : await availableSlots();
  return <ExpertScreen slots={slots.map((s) => s.startsAt)} sample={sample} expert={ARCHITECT.name} />;
}
