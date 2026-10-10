'use client';

/**
 * Dream board (v79 design): photos you love, saved from your phone, with a
 * line each; your studio sees the board. Saved privately; only you and the
 * studio on your project can open them.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Frame, Head, Tabs } from '@/components/app/ui';
import { withShrunkPhotos } from '@/lib/shrink-image';
import { addPinAction, dreamAction, removePinAction, type Pin } from '../engage/actions';

export default function AppDream() {
  const [pins, setPins] = useState<Pin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    void dreamAction().then((r) => (r.ok ? setPins(r.pins) : setError(r.error)));
  }, []);
  useEffect(load, [load]);

  const add = async (picked: File) => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set('photo', picked);
    form.set('note', note);
    const r = await addPinAction(await withShrunkPhotos(form, 'photo'));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setNote('');
    load();
  };

  return (
    <Frame>
      <Head back="/app/me" meta={pins ? `${pins.length} saved` : undefined} />
      <main className="oa-body">
        <h1 className="oa-title">Your dream board</h1>
        <p className="oa-sub">Save any photo you love, from your phone, Instagram or Pinterest. Your designer sees it too.</p>
        <div className="oa-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="oa-input" style={{ fontSize: 18 }} placeholder="What you love about it (optional)" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void add(f);
            }}
          />
          <button type="button" className="oa-cta" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? 'Saving…' : 'Add a photo'}
          </button>
        </div>
        {error ? <p className="oa-note" style={{ color: 'var(--accent-ink)' }}>{error}</p> : null}
        {pins && pins.length === 0 ? <p className="oa-note">Nothing saved yet.</p> : null}
        <div className="oa-pins">
          {(pins ?? []).map((p) => (
            <figure key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.note ?? 'A saved photo'} loading="lazy" />
              {p.note ? <figcaption>{p.note}</figcaption> : null}
              <button type="button" aria-label="Remove" onClick={() => void removePinAction(p.id).then(load)}>
                ×
              </button>
            </figure>
          ))}
        </div>
      </main>
      <Tabs />
    </Frame>
  );
}
