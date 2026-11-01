/**
 * Listening for "something new" on a conversation's Supabase Realtime channel
 * (modules/chat/live.ts), with the smallest client that does it: Realtime's
 * websocket protocol is Phoenix channels, so this joins one channel, sends a
 * heartbeat every 25 seconds, calls `onNew` on each broadcast, and reconnects
 * after a drop. No library; the phone app keeps an identical copy
 * (mobile/src/lib/live-socket.ts).
 *
 * The ping carries nothing private: on hearing it the screen fetches through
 * the API, which checks who may read, as it always does.
 */

export interface LiveChannel {
  socket: string;
  key: string;
  topic: string;
}

/** Connect and listen; returns a function that stops listening. `onState` says whether it is connected. */
export function listen(live: LiveChannel, onNew: () => void, onState: (connected: boolean) => void = () => {}): () => void {
  let ws: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let ref = 0;
  let stopped = false;
  let wait = 1000;

  const send = (msg: Record<string, unknown>) => {
    if (ws?.readyState === 1) ws.send(JSON.stringify({ ...msg, ref: String(++ref) }));
  };

  const connect = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(live.socket);
    } catch {
      return schedule();
    }
    ws.onopen = () => {
      wait = 1000;
      send({ topic: `realtime:${live.topic}`, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: '' } }, access_token: live.key } });
      heartbeat = setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {} }), 25_000);
    };
    ws.onmessage = (e) => {
      let m: { event?: string; payload?: { status?: string } } | null = null;
      try {
        m = JSON.parse(String(e.data)) as { event?: string; payload?: { status?: string } };
      } catch {
        return;
      }
      if (m?.event === 'phx_reply' && m.payload?.status === 'ok') onState(true);
      if (m?.event === 'broadcast') onNew();
    };
    ws.onclose = () => {
      onState(false);
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      schedule();
    };
    ws.onerror = () => ws?.close();
  };

  const schedule = () => {
    if (stopped) return;
    retry = setTimeout(connect, wait);
    wait = Math.min(wait * 2, 30_000);
  };

  connect();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    if (heartbeat) clearInterval(heartbeat);
    ws?.close();
  };
}
