import 'server-only';

/**
 * The warranty claim's photo reader (owner, 20 Nov 2026: Claude Sonnet 5.5,
 * about ₹2 a claim). It looks at the client's photos and words and names the
 * coverage area (rules.ts `readerPrompt`, `parseReaderReply`); whether that
 * area is covered is the data's answer, not the model's.
 *
 * Same conventions as the floor-plan reader (floorplan/read.ts): a plain
 * call to the Messages API, a timeout, and errors reduced to a status — the
 * request is somebody's home. Without ANTHROPIC_API_KEY, or on any failure,
 * it answers "no answer" and the client's pick decides.
 */

import { hasAnthropic } from '@/lib/env';
import { parseReaderReply, readerPrompt, type CoverageRule, type ReaderAnswer } from './rules';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
/** The owner's pick. Classification: low effort is enough. */
export const READER_MODEL = 'claude-sonnet-5-5';
const TIMEOUT_MS = 40_000;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ReaderPhoto {
  mediaType: string;
  base64: string;
}

export async function readClaim(rules: readonly CoverageRule[], description: string, clientKey: string, photos: readonly ReaderPhoto[]): Promise<ReaderAnswer> {
  if (!hasAnthropic()) return { ok: false, why: 'not-configured' };
  const images = photos.filter((p) => IMAGE_TYPES.has(p.mediaType));
  if (images.length === 0) return { ok: false, why: 'no-photos' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!.trim(),
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: READER_MODEL,
        max_tokens: 4000,
        output_config: { effort: 'low' },
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } })),
              { type: 'text', text: readerPrompt(rules, description, clientKey) },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('[warranty-reader] returned', response.status);
      return { ok: false, why: 'reader-failed' };
    }
    const json = (await response.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
    if (json.stop_reason === 'refusal') return { ok: false, why: 'refused' };
    const text = (json.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
    return parseReaderReply(text, rules);
  } catch (error) {
    console.error('[warranty-reader] error', error instanceof Error ? (error.name === 'AbortError' ? 'timeout' : error.name) : 'unknown');
    return { ok: false, why: 'reader-failed' };
  } finally {
    clearTimeout(timer);
  }
}
