'use client';

import { useCallback, useState } from 'react';
import { canRecord, useRecorder, type Recording } from '../../site/lib/useRecorder';
import { salesVoiceTicketAction } from '../../sales-actions';

/**
 * A voice note for the design team with the sales final (the design
 * meeting, 24 Oct 2026; DESIGN-PROCESS-PLAN.md §4.2). Kept as audio in the
 * lead's private files; nobody types it out (no speech-to-text yet, owner
 * 25 Oct 2026). The typed notes stay required. Up to 90 seconds.
 */
export function SalesVoice({ quoteId, onPath }: { quoteId: string; onPath: (path: string | null) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ url: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onDone = useCallback(
    async (_key: string, rec: Recording) => {
      setError(null);
      setBusy('Saving the voice note…');
      try {
        const t = await salesVoiceTicketAction(quoteId, rec.type, rec.blob.size);
        if (!t.ok) throw new Error(t.error);
        if (t.url) {
          const put = await fetch(t.url, { method: 'PUT', headers: { 'Content-Type': rec.type, 'x-upsert': 'false' }, body: rec.blob });
          if (!put.ok) throw new Error('The voice note did not upload. Record it again.');
        }
        setSaved({ url: URL.createObjectURL(rec.blob), seconds: rec.seconds });
        onPath(t.path);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That did not save.');
        onPath(null);
      } finally {
        setBusy(null);
      }
    },
    [quoteId, onPath],
  );
  const { state, start, stop } = useRecorder((k, r) => void onDone(k, r));
  if (!canRecord()) return null;
  const recording = state.status === 'recording';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={recording ? 'btn acc sm' : 'btn ghost sm'} disabled={busy !== null} onClick={() => (recording ? stop() : void start('sales-final'))}>
          {recording ? '■ Stop recording' : saved ? '🎙 Record again' : '🎙 Add a voice note'}
        </button>
        {busy ? <span className="muted sm">{busy}</span> : null}
        {state.status === 'denied' ? <span className="qerr sm">The microphone is blocked. Allow it in the browser, or type the notes.</span> : null}
      </div>
      {saved ? (
        <span className="hstack sm" style={{ gap: 8 }}>
          <audio controls src={saved.url} style={{ height: 32 }} /> {saved.seconds}s · saved with the sales final
        </span>
      ) : null}
      {error ? <span className="qerr sm">{error}</span> : null}
    </div>
  );
}
