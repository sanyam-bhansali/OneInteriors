import type { Metadata } from 'next';
import { holidaysView } from '@/modules/studio-leave/store';
import { HolidaysForm } from './HolidaysForm';

export const metadata: Metadata = { title: 'Holidays', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Holidays (owner, 13 Nov 2026: "One holiday calendar as well.
 * I'll give you the list of holidays so that you can just directly publish.
 * The design timeline should change."). The owner and the design head add
 * or take off holidays, one at a time or a pasted list. A new holiday moves
 * the open design steps on and after it one working day later; taking one
 * off moves nothing back.
 */
export default async function HolidaysSettingsPage() {
  const view = await holidaysView();
  return (
    <div className="max-w-[48rem]">
      {!view ? (
        <p className="m-0 text-[14.5px] muted">Sign in to your studio to see its holidays.</p>
      ) : (
        <HolidaysForm view={view} />
      )}
    </div>
  );
}
