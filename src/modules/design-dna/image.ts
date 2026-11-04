import 'server-only';

/**
 * Drawing one mock-up with an image AI, through Vercel's AI Gateway (owner,
 * 4 Nov 2026).
 *
 * On Vercel the gateway signs in with the deployment's own OIDC token, so
 * there is no key to keep; the cost lands on the Vercel bill, under the
 * team's AI Gateway budget. Locally it needs AI_GATEWAY_API_KEY, and without
 * one a development build draws a plain placeholder instead, so the screens
 * can be walked end to end without spending anything. Production never fakes
 * a picture: no gateway, no mock-up, and the page says so.
 *
 * The model is a setting, not code (AI_IMAGE_MODEL, an id from
 * https://ai-gateway.vercel.sh/v1/models), so it can be changed for quality
 * or price without a release.
 */

import { generateImage } from 'ai';
import { isProduction } from '@/lib/env';

const DEFAULT_MODEL = 'bfl/flux-3-image-klein';

export function imageModel(): string {
  return process.env.AI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
}

/** Can this deployment reach the gateway at all? */
export function gatewayAvailable(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim() || process.env.VERCEL);
}

export type DrawResult =
  | { ok: true; bytes: Uint8Array; mediaType: string; model: string; placeholder: boolean }
  | { ok: false; error: string };

export async function drawRoom(prompt: string, seed: number, caption: string): Promise<DrawResult> {
  if (!gatewayAvailable()) {
    if (isProduction()) return { ok: false, error: 'Room ideas are not switched on yet.' };
    return { ok: true, bytes: placeholder(caption, seed), mediaType: 'image/svg+xml', model: 'placeholder', placeholder: true };
  }
  const model = imageModel();
  try {
    const { image } = await generateImage({ model, prompt, aspectRatio: '4:3', seed, maxRetries: 1 });
    return { ok: true, bytes: image.uint8Array, mediaType: image.mediaType || 'image/png', model, placeholder: false };
  } catch (error) {
    console.error('[design-dna] image generation failed:', error);
    return { ok: false, error: 'We could not draw this room just now. Try again in a minute.' };
  }
}

/** A plain, honest stand-in for local development: says what it would have drawn. */
function placeholder(caption: string, seed: number): Uint8Array {
  const hue = (seed * 47) % 360;
  const safe = caption.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="hsl(${hue},25%,88%)"/><rect y="420" width="800" height="180" fill="hsl(${hue},20%,72%)"/><text x="400" y="290" font-family="sans-serif" font-size="26" text-anchor="middle" fill="#333">Sample picture (no AI on this laptop)</text><text x="400" y="330" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#555">${safe}</text></svg>`;
  return new TextEncoder().encode(svg);
}
