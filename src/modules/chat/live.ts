import 'server-only';

/**
 * Instant delivery for in-app chat (owner, 1 Nov 2026: "works very smooth
 * like WhatsApp"), through Supabase Realtime, which our database already
 * runs on.
 *
 * Nothing private goes through it. After a message is saved, the server
 * sends a bare ping on the conversation's channel; a screen that hears it
 * fetches the new message through the API, which checks who may read it as
 * always. The channel's name is a keyed hash of the conversation, handed only
 * to people the API has just let read it, so it cannot be guessed. Without
 * Supabase configured (a laptop, a test build) there is no channel and the
 * screens keep checking every few seconds.
 */

import { createHmac } from 'node:crypto';
import { supabaseConfig } from '@/lib/env';

const secret = () => process.env.SUPABASE_SECRET_KEY?.trim() || process.env.CRON_SECRET?.trim() || null;

/** What a screen needs to listen: the websocket, the public key, and this conversation's channel. */
export interface LiveChannel {
  socket: string;
  key: string;
  topic: string;
}

/** The channel for one conversation, or null when Realtime is not set up here. */
export function liveChannel(projectId: string, kind: string): LiveChannel | null {
  const config = supabaseConfig();
  const s = secret();
  if (!config || !s) return null;
  const topic = `chat-${createHmac('sha256', `oi-chat-live:${s}`).update(`${projectId}:${kind}`).digest('hex').slice(0, 40)}`;
  const socket = `${config.url.replace(/^http/, 'ws').replace(/\/$/, '')}/realtime/v1/websocket?apikey=${encodeURIComponent(config.publishableKey)}&vsn=1.0.0`;
  return { socket, key: config.publishableKey, topic };
}

/** Tell anyone listening that the conversation has something new. Never throws, never waits long. */
export async function ping(projectId: string, kind: string): Promise<void> {
  const config = supabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  const live = liveChannel(projectId, kind);
  if (!config || !key || !live) return;
  try {
    await fetch(`${config.url.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: live.topic, event: 'new', payload: { at: Date.now() }, private: false }] }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* the screens' own check every few seconds still finds it */
  }
}
