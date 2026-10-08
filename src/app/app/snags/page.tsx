'use client';

/**
 * Snags (the owner's v1 screens): fixed by a date, or we chase it, and the
 * last payment waits for the list to close. On a real project, "Photograph a
 * problem" opens the camera and raises the snag with the studio.
 */

import { useRef, useState } from 'react';
import { AskGeio, CameraIcon, ExampleTag, Frame, Tabs } from '@/components/app/ui';
import { raiseSnagOnline, useMyProject } from '@/components/app/useMyProject';
import { shrinkToFile } from '@/components/app/photos';
import { EXAMPLE, SNAGS } from '@/modules/app/example-project';
import { dayLabel } from '@/modules/app/project-view';

interface SnagRow {
  key: string;
  title: string;
  where: string;
  status: string;
  img: string | null;
  urgent: boolean;
}

export default function AppSnags() {
  const mine = useMyProject();
  const [tab, setTab] = useState<'open' | 'fixed'>('open');
  const [tried, setTried] = useState(false);
  const [draft, setDraft] = useState<{ photo: File; preview: string } | null>(null);
  const [title, setTitle] = useState('');
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const camera = useRef<HTMLInputElement>(null);

  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  const real = mine.state === 'real';

  const rows: Record<'open' | 'fixed', SnagRow[]> = real
    ? {
        open: mine.project.snags
          .filter((s) => s.status === 'OPEN')
          .map((s) => ({
            key: s.id,
            title: s.title,
            where: [s.room, `raised ${dayLabel(s.raisedAt)}`].filter(Boolean).join(', '),
            status: s.line ?? 'With the studio',
            img: s.photos[0] ?? null,
            urgent: Boolean(s.line?.startsWith('Fix by')),
          })),
        fixed: mine.project.snags
          .filter((s) => s.status === 'FIXED')
          .map((s) => ({
            key: s.id,
            title: s.title,
            where: [s.room, `raised ${dayLabel(s.raisedAt)}`].filter(Boolean).join(', '),
            status: [s.line, s.fixedNote].filter(Boolean).join(' · '),
            img: s.fixedPhotos[0] ?? s.photos[0] ?? null,
            urgent: false,
          })),
      }
    : {
        open: SNAGS.open.map((s) => ({ key: s.title, title: s.title, where: s.where, status: s.status, img: s.img, urgent: s.status.startsWith('Fix by') })),
        fixed: SNAGS.fixed.map((s) => ({ key: s.title, title: s.title, where: s.where, status: s.status, img: s.img, urgent: false })),
      };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const photo = await shrinkToFile(f);
      setDraft({ photo, preview: URL.createObjectURL(photo) });
      setNote(null);
    } catch {
      setNote({ ok: false, text: 'That photo could not be read. Try another.' });
    }
  };

  const send = async () => {
    if (!real || !draft) return;
    setBusy(true);
    const err = await raiseSnagOnline(mine.project.id, title, room, [draft.photo]);
    setBusy(false);
    if (err) return setNote({ ok: false, text: err });
    setDraft(null);
    setTitle('');
    setRoom('');
    setNote({ ok: true, text: `Sent to ${mine.project.studio}. You will hear when it has a fix-by date.` });
    mine.reload();
  };

  return (
    <Frame>
      {real ? null : <ExampleTag />}
      <header className="oa-page-head">
        <span className="oa-meta">Fixed by a date, or we chase it</span>
        <h1>Snags</h1>
      </header>
      <main className="oa-body">
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void onPhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {draft ? (
          <div className="oa-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.preview} alt="Your photo" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12 }} />
            <label className="oa-label" htmlFor="snag-title">
              What is wrong
            </label>
            <input id="snag-title" className="oa-input" maxLength={120} placeholder="Gap between wardrobe and ceiling" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="oa-label" htmlFor="snag-room">
              Where (optional)
            </label>
            <input id="snag-room" className="oa-input" maxLength={40} placeholder="Bedroom 1" value={room} onChange={(e) => setRoom(e.target.value)} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="oa-cta light" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }} onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="button" className="oa-cta" disabled={busy || title.trim().length < 3} onClick={send}>
                Send to the studio
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="oa-cta" onClick={() => (real ? camera.current?.click() : setTried(true))}>
            <CameraIcon />
            Photograph a problem
          </button>
        )}
        {tried && !real ? (
          <p className="oa-sample" role="status">
            Example · in your project this opens the camera
          </p>
        ) : null}
        {note ? (
          <p className={note.ok ? 'oa-toast' : 'oa-note'} role="status" style={note.ok ? undefined : { color: 'var(--accent-ink)' }}>
            {note.text}
          </p>
        ) : null}
        <div className="oa-chips">
          <button type="button" className="oa-chip" aria-pressed={tab === 'open'} onClick={() => setTab('open')}>
            Open <small>{rows.open.length}</small>
          </button>
          <button type="button" className="oa-chip" aria-pressed={tab === 'fixed'} onClick={() => setTab('fixed')}>
            Fixed <small>{rows.fixed.length}</small>
          </button>
        </div>
        <div>
          {rows[tab].map((s) => (
            <div key={s.key} className="oa-snag">
              {s.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.img} alt={s.title} />
              ) : null}
              <div className="min-w-0">
                <b style={{ display: 'block', fontSize: 17, fontWeight: 600, lineHeight: 1.25 }}>{s.title}</b>
                <p style={{ margin: '6px 0 0', font: '400 12.5px var(--mono)', color: 'var(--ink-2)' }}>{s.where}</p>
                <p style={{ margin: '4px 0 0', font: '400 12.5px var(--mono)', color: s.urgent && tab === 'open' ? 'var(--accent-ink)' : 'var(--ink-2)' }}>
                  {s.status}
                </p>
              </div>
            </div>
          ))}
          {rows[tab].length === 0 ? <p className="oa-note">{tab === 'open' ? 'Nothing open. Good.' : 'Nothing fixed yet.'}</p> : null}
        </div>
        <div className="oa-card-dark">
          <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
            {real ? 'Handover walk-through' : `Handover walk-through, ${EXAMPLE.handover}`}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 15.5, lineHeight: 1.5, color: 'rgba(255,255,255,.85)' }}>
            We walk the flat with you room by room and add everything here. The last payment is due only once these are closed.
          </p>
        </div>
      </main>
      <AskGeio from="snags" />
      <Tabs />
    </Frame>
  );
}
