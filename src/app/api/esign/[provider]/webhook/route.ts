import { completeFromProvider } from '@/modules/agreement/store';
import { providerById } from '@/modules/agreement/provider';

/**
 * POST /api/esign/<provider>/webhook — the eSign provider's notice that a
 * request changed (docs/studio-os/CLIENT-AGREEMENT.md). The provider's own
 * check decides whether the call is genuine; then, as for the redirect, we ask
 * the provider for the result rather than believe the body. Filing twice
 * does nothing the second time.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 256 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  const provider = providerById(id.slice(0, 40));
  if (!provider) return new Response('unknown provider', { status: 404 });
  const raw = await req.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY) return new Response('bad request', { status: 400 });
  if (!provider.verifyWebhook(raw, req.headers)) return new Response('bad signature', { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad request', { status: 400 });
  }
  const requestId = provider.requestIdFromWebhook(body);
  if (!requestId) return new Response('ignored', { status: 200 });
  await completeFromProvider(provider.id, requestId);
  return new Response('ok', { status: 200 });
}
