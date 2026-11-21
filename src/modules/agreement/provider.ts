import 'server-only';

/**
 * The Aadhaar eSign provider, pluggable (owner, 21 Nov 2026: the provider is
 * still to be chosen — Setu, Cashfree, Leegality, Digio…). Everything else in
 * the agreement flow is provider-neutral; adding one is a file implementing
 * `EsignProvider` and a line in `PROVIDERS`, with its keys in Vercel (never
 * in a file) and `ESIGN_PROVIDER` naming it.
 *
 * The flow every provider supports:
 * 1. `createRequest`: the unsigned PDF and the signer → a request id and the
 *    URL the client opens to sign with an Aadhaar OTP;
 * 2. the provider redirects the client back to `/api/esign/<id>/return` and
 *    calls `/api/esign/<id>/webhook`; either makes us ask `fetchResult`,
 *    which, once signed, gives the signed PDF and the signer's name.
 *
 * Until a provider is named, `esignProvider()` is null: the studio uploads
 * the signed copy instead (store.ts `uploadSignedAgreement`).
 */

export interface EsignRequestInput {
  pdf: Uint8Array;
  fileName: string;
  /** Our ClientAgreement id: comes back on the redirect and webhook. */
  referenceId: string;
  signer: { name: string; phone: string | null; email: string | null };
  /** Where the provider sends the client after signing. */
  returnUrl: string;
}

export type EsignCreateResult = { ok: true; requestId: string; signUrl: string } | { ok: false; error: string };

export type EsignFetchResult =
  | { ok: true; state: 'pending' }
  | { ok: true; state: 'failed'; reason: string }
  | { ok: true; state: 'signed'; pdf: Uint8Array; signerName: string | null }
  | { ok: false; error: string };

export interface EsignProvider {
  /** Short and URL-safe: "setu", "cashfree"… Used in /api/esign/<id>/…. */
  id: string;
  label: string;
  createRequest(input: EsignRequestInput): Promise<EsignCreateResult>;
  fetchResult(requestId: string): Promise<EsignFetchResult>;
  /** Is this webhook call really from the provider? Checked before anything is believed. */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  /** The request id a webhook body is about, or null. */
  requestIdFromWebhook(body: unknown): string | null;
}

/**
 * A stand-in for local testing only: "signing" is a page of ours that marks it
 * signed and returns the same PDF. Refused in production, whatever the env says.
 */
const testProvider: EsignProvider = {
  id: 'test',
  label: 'Test eSign (local only)',
  async createRequest(input) {
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    testStore.set(`test_${input.referenceId}`, { pdf: input.pdf, signed: false, name: input.signer.name });
    return { ok: true, requestId: `test_${input.referenceId}`, signUrl: `${base}/api/esign/test/return?request=test_${input.referenceId}&sign=1` };
  },
  async fetchResult(requestId) {
    const r = testStore.get(requestId);
    if (!r) return { ok: false, error: 'Unknown request.' };
    return r.signed ? { ok: true, state: 'signed', pdf: r.pdf, signerName: r.name.toUpperCase() } : { ok: true, state: 'pending' };
  },
  verifyWebhook: () => false,
  requestIdFromWebhook: () => null,
};

/** The test provider's requests, in memory (dev server only). */
export const testStore = new Map<string, { pdf: Uint8Array; signed: boolean; name: string }>();

const PROVIDERS: Record<string, EsignProvider> = {
  /* Add the chosen provider here, e.g. setu: setuProvider. */
};

/** The connected provider, or null while none is chosen. */
export function esignProvider(): EsignProvider | null {
  const id = process.env.ESIGN_PROVIDER?.trim().toLowerCase() ?? '';
  if (id === 'test') return process.env.NODE_ENV === 'production' ? null : testProvider;
  return PROVIDERS[id] ?? null;
}

export function providerById(id: string): EsignProvider | null {
  if (id === 'test') return process.env.NODE_ENV === 'production' ? null : testProvider;
  return PROVIDERS[id] ?? null;
}
