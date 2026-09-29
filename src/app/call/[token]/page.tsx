import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppFooter, AppHeader } from '@/components/oi/Chrome';
import { Wrap, Sheet } from '@/components/oi';
import { cleanToken } from '@/modules/consultation/manage';
import { callByToken } from '@/modules/consultation/manage-store';
import { availableSlots } from '@/modules/consultation/availability';
import { slotLabel } from '@/modules/consultation/slots';
import { ManageCall } from './ManageCall';

export const metadata: Metadata = {
  title: 'Your expert call',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Move or cancel a booked expert call, from the private link in the
 * confirmation email (build queue item 2). No sign-in: the link is the key,
 * and it shows nothing beyond the call itself — no name, no number.
 */
export default async function CallPage({ params }: { params: Promise<{ token: string }> }) {
  const token = cleanToken((await params).token);
  if (!token) notFound();
  const call = await callByToken(token);
  if (!call) notFound();
  const when = call.scheduledFor ? slotLabel(call.scheduledFor.toISOString()) : null;
  const slots = call.state === 'open' ? (await availableSlots()).map((s) => s.startsAt) : [];

  return (
    <div className="oi-app min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Wrap className="py-12">
        <p className="oi-eyebrow m-0 mb-3">Your expert call</p>
        <h1 className="oi-display m-0 mb-3 text-[clamp(1.6rem,1.3rem+1.2vw,2.2rem)]">
          {call.status === 'cancelled' ? 'Cancelled.' : when ? `${when.day}, ${when.time}.` : 'Not booked yet.'}
        </h1>
        {call.studioNames.length > 0 ? (
          <p className="m-0 mb-8 text-[15px] text-[var(--ink2)]">About {call.studioNames.join(', ')}. Thirty minutes; we ring you.</p>
        ) : null}
        <Sheet className="max-w-[44rem] p-6">
          {call.state === 'open' ? (
            <ManageCall token={token} slots={slots} />
          ) : call.state === 'too-late' ? (
            <p className="m-0 text-[15px]">It is less than an hour to your call, so it can no longer be changed here. Reply to your confirmation email and we will sort it out.</p>
          ) : call.status === 'cancelled' ? (
            <p className="m-0 text-[15px]">
              Your brief and quotes are still in <Link href="/account">Your home</Link>. Book another time from{' '}
              <Link href="/expert">the expert page</Link> whenever you like.
            </p>
          ) : (
            <p className="m-0 text-[15px]">This call can no longer be changed.</p>
          )}
        </Sheet>
      </Wrap>
      <AppFooter />
    </div>
  );
}
