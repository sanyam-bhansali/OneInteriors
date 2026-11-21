import { NextResponse } from 'next/server';
import { completeFromProvider } from '@/modules/agreement/store';
import { providerById, testStore } from '@/modules/agreement/provider';

/**
 * GET /api/esign/<provider>/return — where the eSign provider sends the client
 * after signing (docs/studio-os/CLIENT-AGREEMENT.md). We never trust the
 * redirect itself: we ask the provider for the result (store.ts
 * `completeFromProvider`), file the signed copy if it is signed, and send the
 * client back to their agreement page.
 *
 * The request id is read from `request` (our own test provider) or the
 * provider's usual names; a provider added later says which in its file.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  const url = new URL(req.url);
  const back = (state: string) => NextResponse.redirect(new URL(`/app/agreement?esign=${state}`, url.origin), 303);
  const provider = providerById(id.slice(0, 40));
  if (!provider) return back('check');
  const requestId = (url.searchParams.get('request') ?? url.searchParams.get('id') ?? url.searchParams.get('signatureId') ?? '').slice(0, 200);
  if (!requestId) return back('check');
  /* The local test provider's "signing page" is this redirect with sign=1. */
  if (provider.id === 'test' && url.searchParams.get('sign') === '1') {
    const r = testStore.get(requestId);
    if (r) r.signed = true;
  }
  const r = await completeFromProvider(provider.id, requestId);
  return back(r.ok ? r.state : 'check');
}
