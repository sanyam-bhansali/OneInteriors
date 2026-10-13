'use client';

/**
 * Snags (the owner's v1 screens): fixed by a date, or we chase it, and the
 * last payment waits for the list to close. On a real project, "Photograph a
 * problem" opens the camera and raises the snag with the studio.
 *
 * Studio workspace Phase 4: only the customer closes a snag. A fix waiting
 * for them sits on top with the before and after photos side by side, the
 * studio's sentence, and two buttons, Confirm and Not fixed; unanswered, it
 * closes by itself seven days after the fix.
 */

import { useRef, useState } from 'react';
import { CameraIcon, ExampleTag, Frame, Tabs } from '@/components/app/ui';
import { raiseSnagOnline, useMyProject, type MyProject } from '@/components/app/useMyProject';
import { shrinkImage } from '@/lib/shrink-image';
import { EXAMPLE, SNAGS } from '@/modules/app/example-project';
import { dayLabel } from '@/modules/app/project-view';

type Live = MyProject['snags'][number];

/** The customer's answer to a fix; the error to show, or null on success. */
async function answerSnag(snagId: string, answer: 'confirm' | 'not-fixed', reason = ''): Promise<string | null> {
  try {
    const res = await fetch(`/api/app/v1/snags/${encodeURIComponent(snagId)}/${answer}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(answer === 'not-fixed' ? { reason } : {}),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? 'That did not go through. Try again.';
  } catch {
    return 'No connection. Try again.';
  }
}

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

  // Phase 4: the owner's fixes to answer sit on top, out of the lists while they wait.
  const toCheck: Live[] = real ? mine.project.snags.filter((s) => s.progress?.canAnswer) : [];
  const waiting = new Set(toCheck.map((s) => s.id));
  const isOpen = (s: Live) => (s.progress ? s.progress.state !== 'closed' : s.status === 'OPEN');
  const rows: Record<'open' | 'fixed', SnagRow[]> = real
    ? {
        open: mine.project.snags
          .filter((s) => !waiting.has(s.id) && isOpen(s))
          .map((s) => ({
            key: s.id,
            title: s.title,
            where: [s.warranty ? 'Warranty' : null, s.room, `raised ${dayLabel(s.raisedAt)}`].filter(Boolean).join(', '),
            status: s.progress?.state === 'reopened' ? 'You said not fixed · with the studio' : s.progress?.state === 'fixed' ? 'Fixed · waiting for the owner' : (s.line ?? 'With the studio'),
            img: s.photos[0] ?? null,
            urgent: Boolean(s.line?.startsWith('Fix by')),
          })),
        fixed: mine.project.snags
          .filter((s) => !waiting.has(s.id) && !isOpen(s))
          .map((s) => ({
            key: s.id,
            title: s.title,
            where: [s.warranty ? 'Warranty' : null, s.room, `raised ${dayLabel(s.raisedAt)}`].filter(Boolean).join(', '),
            status: [s.line, s.fixedNote, s.progress?.closedBy === 'auto' ? 'closed after 7 days' : s.progress?.closedBy === 'you' ? 'you confirmed' : null].filter(Boolean).join(' · '),
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
      const photo = await shrinkImage(f);
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
        {toCheck.length ? (
          <section aria-label="Check the fix" style={{ display: 'grid', gap: 12 }}>
            <p className="oa-meta" style={{ margin: 0 }}>
              {toCheck.length === 1 ? 'Check the fix' : `Check ${toCheck.length} fixes`}
            </p>
            {toCheck.map((s) => (
              <CheckFix
                key={s.id}
                snag={s}
                studio={mine.state === 'real' ? mine.project.studio : ''}
                onDone={(text) => {
                  setNote({ ok: true, text });
                  mine.reload();
                }}
              />
            ))}
          </section>
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
                <p style={{ margin: '6px 0 0', font: '400 13px var(--mono)', color: 'var(--ink-2)' }}>{s.where}</p>
                <p style={{ margin: '4px 0 0', font: '400 13px var(--mono)', color: s.urgent && tab === 'open' ? 'var(--accent-ink)' : 'var(--ink-2)' }}>
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
      <Tabs />
    </Frame>
  );
}

/** One fix to answer: before and after side by side, the sentence, Confirm / Not fixed; or a studio's reason and Agree. */
function CheckFix({ snag: s, studio, onDone }: { snag: Live; studio: string; onDone: (text: string) => void }) {
  const g = s.progress!;
  const disputed = g.state === 'disputed';
  const [telling, setTelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async (answer: 'confirm' | 'not-fixed') => {
    setBusy(true);
    setError(null);
    const err = await answerSnag(s.id, answer, reason.trim());
    setBusy(false);
    if (err) return setError(err);
    onDone(answer === 'confirm' ? 'Closed. Thank you.' : `Sent back to ${studio}.`);
  };
  const fixedOn = g.fixedAt ? dayLabel(g.fixedAt) : null;
  const closesOn = g.autoClosesOn ? dayLabel(g.autoClosesOn) : null;
  const pic = (src: string | undefined, caption: string) => (
    <figure style={{ margin: 0, display: 'grid', gap: 6 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={caption} style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 14 }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '3 / 4', borderRadius: 14, background: 'var(--soft, #f3f3f1)' }} />
      )}
      <figcaption style={{ font: '400 13px var(--mono)', color: 'var(--ink-2)' }}>{caption}</figcaption>
    </figure>
  );
  return (
    <div className="oa-card" style={{ display: 'grid', gap: 14 }}>
      <div>
        <b style={{ display: 'block', fontSize: 17, fontWeight: 600, lineHeight: 1.25 }}>{s.title}</b>
        {s.room ? <p style={{ margin: '4px 0 0', font: '400 13px var(--mono)', color: 'var(--ink-2)' }}>{s.room}</p> : null}
      </div>
      {disputed ? (
        <div>
          <p style={{ margin: 0, font: '400 13px var(--mono)', color: 'var(--ink-2)' }}>{studio} says</p>
          <p style={{ margin: '6px 0 0', fontSize: 16, lineHeight: 1.45 }}>&ldquo;{g.studioReason}&rdquo;</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {pic(s.photos[0], s.raisedByStudio ? 'Before' : 'Before · your photo')}
            {pic(s.fixedPhotos[0], fixedOn ? `After · ${fixedOn}` : 'After')}
          </div>
          {g.fixSentence ? <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>&ldquo;{g.fixSentence}&rdquo;</p> : null}
        </>
      )}
      {telling ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <label className="oa-label" htmlFor={`nf-${s.id}`}>
            What is still wrong (optional)
          </label>
          <input id={`nf-${s.id}`} className="oa-input" maxLength={300} placeholder="Still a gap on the left side" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="oa-cta light" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }} onClick={() => setTelling(false)}>
              Cancel
            </button>
            <button type="button" className="oa-cta" disabled={busy} onClick={() => void go('not-fixed')}>
              Send back to the studio
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <button type="button" className="oa-cta" disabled={busy} onClick={() => void go('confirm')}>
            {disputed ? 'Agree, close it' : 'Confirm, it is fixed'}
          </button>
          {disputed ? null : (
            <button type="button" className="oa-cta light" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }} disabled={busy} onClick={() => setTelling(true)}>
              Not fixed
            </button>
          )}
        </div>
      )}
      {error ? (
        <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)', margin: 0 }}>
          {error}
        </p>
      ) : null}
      <p style={{ margin: 0, font: '400 13px var(--mono)', color: 'var(--ink-2)' }}>
        {disputed ? 'Not agreed? Leave it open and our team will look at it with you.' : closesOn ? `If you do not answer, it closes by itself on ${closesOn}.` : ''}
      </p>
    </div>
  );
}
