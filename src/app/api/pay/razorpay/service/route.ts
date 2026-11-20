import { NextResponse } from 'next/server';
import { markServicePaid } from '@/modules/aftercare/store';
import { razorpayKeySecret } from '@/modules/aftercare/razorpay';
import { linkCallbackValid, readLinkCallback } from '@/modules/aftercare/razorpay-sign';

/**
 * GET /api/pay/razorpay/service — where Razorpay sends the client after
 * paying a service visit's charge (docs/studio-os/AFTERCARE.md). The
 * signature is checked before anything is believed; a paid link books the
 * visit. Then back to the client's page, which re-reads the visit.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (state: 'booked' | 'not-paid' | 'check') => NextResponse.redirect(new URL(`/app/aftercare?visit=${state}`, url.origin), 303);
  const cb = readLinkCallback(url.searchParams);
  if (!cb || !linkCallbackValid(cb, razorpayKeySecret())) return back('check');
  if (cb.status !== 'paid') return back('not-paid');
  const r = await markServicePaid(cb.linkId, cb.paymentId);
  return back(r.ok ? 'booked' : 'check');
}
