'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One voice note at a time, with MediaRecorder. Tap to start, tap to stop;
 * stops by itself after 90 seconds. The recording stays inside the studio
 * (private storage); the customer never hears it.
 */

const MAX_MS = 90_000;
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export interface Recording {
  blob: Blob;
  /** The bare type for storage: 'audio/webm' or 'audio/mp4'. */
  type: string;
  seconds: number;
}

export type RecorderState = { status: 'idle' } | { status: 'recording'; key: string; startedAt: number } | { status: 'denied' } | { status: 'unsupported' };

export function canRecord(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export function useRecorder(onDone: (key: string, rec: Recording) => void) {
  const [state, setState] = useState<RecorderState>({ status: 'idle' });
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; key: string; started: number; timer: number } | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const stop = useCallback(() => {
    const r = rec.current;
    if (r && r.mr.state !== 'inactive') r.mr.stop();
  }, []);

  const start = useCallback(async (key: string) => {
    if (rec.current) return;
    if (!canRecord()) {
      setState({ status: 'unsupported' });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState({ status: 'denied' });
      return;
    }
    const mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const started = Date.now();
    mr.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    mr.onstop = () => {
      const r = rec.current;
      rec.current = null;
      stream.getTracks().forEach((t) => t.stop());
      if (r) window.clearTimeout(r.timer);
      setState({ status: 'idle' });
      const type = (mr.mimeType || mime || 'audio/webm').split(';')[0]!;
      const blob = new Blob(chunks, { type });
      if (blob.size > 0) done.current(key, { blob, type, seconds: Math.max(1, Math.round((Date.now() - started) / 1000)) });
    };
    const timer = window.setTimeout(() => mr.state !== 'inactive' && mr.stop(), MAX_MS);
    rec.current = { mr, stream, chunks, key, started, timer };
    mr.start();
    setState({ status: 'recording', key, startedAt: started });
  }, []);

  useEffect(
    () => () => {
      const r = rec.current;
      if (r) {
        r.mr.onstop = null;
        if (r.mr.state !== 'inactive') r.mr.stop();
        r.stream.getTracks().forEach((t) => t.stop());
        window.clearTimeout(r.timer);
      }
    },
    [],
  );

  return { state, start, stop };
}
