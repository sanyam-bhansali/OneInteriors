import 'server-only';

/**
 * Reading a floor plan with Claude — the call.
 *
 * The rules (prompt, parsing, checks) are in `reading.ts`, pure and tested.
 * This file sends the file and hands the reply to them. Same conventions as
 * the archive reader (`quotation/extract-agent.ts`): our configured model, a
 * timeout, and errors reduced to a status or a name — a response body can
 * echo the request, and the request is somebody's home.
 */

import { anthropicModel, hasAnthropic } from '@/lib/env';
import { FLOOR_PLAN_PROMPT, extractJson, normalisePlan, type ReadingResult } from './reading';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
/** A plan is one page. Long enough for a slow read, short enough to wait on. */
const TIMEOUT_MS = 45_000;

/** The file types Claude reads, and how it wants each one sent. */
const KIND: Record<string, 'document' | 'image'> = {
  'application/pdf': 'document',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
};

export function canReadPlans(): boolean {
  return hasAnthropic();
}

export function readablePlanType(mediaType: string): boolean {
  return mediaType in KIND;
}

export async function readFloorPlan(base64: string, mediaType: string): Promise<ReadingResult> {
  if (!hasAnthropic()) return { ok: false, reason: 'not-configured' };
  const kind = KIND[mediaType];
  if (!kind) return { ok: false, reason: 'file-type' };

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
        model: anthropicModel(),
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              { type: kind, source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: FLOOR_PLAN_PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('[floorplan] reader returned', response.status);
      return { ok: false, reason: 'reader-failed' };
    }

    // Every text block, joined: a model can put reasoning before the JSON.
    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
    const found = extractJson(text);
    if (!found) return { ok: false, reason: 'unreadable' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(found);
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
    return normalisePlan(parsed);
  } catch (error) {
    console.error(
      '[floorplan] reader error',
      error instanceof Error ? (error.name === 'AbortError' ? 'timeout' : error.name) : 'unknown',
    );
    return { ok: false, reason: 'reader-failed' };
  } finally {
    clearTimeout(timer);
  }
}
