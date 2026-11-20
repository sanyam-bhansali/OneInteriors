'use client';

/**
 * After the handover (owner, 20 Nov 2026; docs/studio-os/AFTERCARE.md): a
 * Warranty claim and a Service visit, side by side, always open. On submit
 * the server checks the project is 100% paid first ("Please clear your
 * payments first" with the amount), then:
 *
 * - Warranty claim: an area, a line, photos. Decided automatically from the
 *   warranty's coverage list and the photos: covered opens a warranty snag;
 *   not covered says so and offers a service visit.
 * - Service visit: a category with the studio's visiting charge, a 2-hour
 *   slot from 5 days ahead, paid on Razorpay; booked once paid.
 *
 * Same API as the Expo app (/api/app/v1/aftercare).
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraIcon, Frame, Tabs } from '@/components/app/ui';
import { useMyProject } from '@/components/app/useMyProject';
import { shrinkImage } from '@/lib/shrink-image';
import { formatINR } from '@/lib/money';

interface View {
  projectId: string;
  studio: string;
  owner: boolean;
  warranty: { open: boolean; message: string | null; endsOn: string | null; areas: { key: string; label: string }[] };
  service: { ready: boolean; free: boolean; freeUntil: string | null; categories: { key: string; label: string; chargePaise: number; listPaise: number | null }[]; days: { date: string; label: string; slots: { start: string; label: string; left: number }[] }[] };
  requests: { id: string; category: string; when: string; chargePaise: number; listPaise: number | null; state: 'held' | 'booked' | 'expired' | 'cancelled'; payUrl: string | null }[];
  claims: { id: string; at: string; covered: boolean; area: string; snagId: string | null }[];
}

type Note = { ok: boolean; text: string; pending?: number | null } | null;

const STATE_WORD = { held: 'Waiting for payment', booked: 'Booked', expired: 'Not paid in time', cancelled: 'Cancelled' } as const;

async function post(path: string, form: FormData): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  try {
    const res = await fetch(path, { method: 'POST', credentials: 'same-origin', body: form });
    const body = ((await res.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    return { ok: res.ok, body };
  } catch {
    return { ok: false, body: { error: 'No connection. Try again.' } };
  }
}

export default function Aftercare() {
  const mine = useMyProject();
  const projectId = mine.state === 'real' ? mine.project.id : null;
  const [view, setView] = useState<View | null>(null);
  const [closed, setClosed] = useState<string | null>(null);
  const [tab, setTab] = useState<'warranty' | 'service'>('warranty');
  const [note, setNote] = useState<Note>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/app/v1/aftercare?projectId=${encodeURIComponent(projectId)}`, { credentials: 'same-origin' });
      const body = (await res.json().catch(() => null)) as (View & { error?: string }) | null;
      if (res.ok && body) setView(body);
      else setClosed(body?.error ?? 'This is not open for your project yet.');
    } catch {
      setClosed('No connection. Try again.');
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const visit = new URLSearchParams(window.location.search).get('visit');
    if (visit === 'booked') {
      setTab('service');
      setNote({ ok: true, text: 'Paid. Your visit is booked; you will see it below.' });
    } else if (visit === 'not-paid') {
      setTab('service');
      setNote({ ok: false, text: 'The payment did not go through, so the visit is not booked. Pick a slot and try again.' });
    }
  }, []);

  if (mine.state === 'loading') return <Frame>{null}</Frame>;

  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">After your handover</span>
        <h1>Warranty and service</h1>
      </header>
      <main className="oa-body">
        {mine.state !== 'real' ? (
          <p className="oa-note">Once your home is handed over, you raise warranty claims and book service visits here.</p>
        ) : closed ? (
          <p className="oa-note">{closed}</p>
        ) : !view ? null : (
          <>
            <div className="oa-chips">
              <button type="button" className="oa-chip" aria-pressed={tab === 'warranty'} onClick={() => setTab('warranty')}>
                Warranty claim
              </button>
              <button type="button" className="oa-chip" aria-pressed={tab === 'service'} onClick={() => setTab('service')}>
                Service visit
              </button>
            </div>
            {note ? (
              <div className={note.ok ? 'oa-toast' : 'oa-note'} role="status" style={note.ok ? undefined : { color: 'var(--accent-ink)' }}>
                {note.text}
                {note.pending !== undefined ? (
                  <>
                    {' '}
                    <Link href="/app/project" style={{ textDecoration: 'underline' }}>
                      See your payments
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}
            {tab === 'warranty' ? (
              <WarrantyClaim
                view={view}
                onResult={(n, toService) => {
                  setNote(n);
                  if (toService) setTab('service');
                  void load();
                }}
              />
            ) : (
              <ServiceVisit
                view={view}
                onResult={(n) => {
                  setNote(n);
                  void load();
                }}
              />
            )}
            {view.requests.length > 0 ? (
              <section aria-label="Your visits" style={{ display: 'grid', gap: 8 }}>
                <p className="oa-meta" style={{ margin: 0 }}>
                  Your visits
                </p>
                {view.requests.map((r) => (
                  <div key={r.id} className="oa-card" style={{ padding: 14 }}>
                    <b style={{ fontSize: 16 }}>{r.category}</b>
                    <p style={{ margin: '4px 0 0', font: '400 13px var(--mono)', color: 'var(--ink-2)' }}>
                      {r.when} · <Price paise={r.chargePaise} list={r.listPaise} /> · {STATE_WORD[r.state]}
                    </p>
                    {r.payUrl ? (
                      <a className="oa-cta" style={{ marginTop: 10 }} href={r.payUrl}>
                        Pay {formatINR(r.chargePaise)}
                      </a>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}
            {view.claims.length > 0 ? (
              <section aria-label="Your warranty claims" style={{ display: 'grid', gap: 8 }}>
                <p className="oa-meta" style={{ margin: 0 }}>
                  Your warranty claims
                </p>
                {view.claims.map((c) => (
                  <div key={c.id} className="oa-card" style={{ padding: 14 }}>
                    <b style={{ fontSize: 16 }}>{c.area}</b>
                    <p style={{ margin: '4px 0 0', font: '400 13px var(--mono)', color: 'var(--ink-2)' }}>
                      {new Date(c.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {c.covered ? 'Covered, raised as a snag' : 'Not covered'}
                    </p>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        )}
      </main>
      <Tabs />
    </Frame>
  );
}

/** The price; in the free month, the studio's charge struck out beside "Free". */
function Price({ paise, list }: { paise: number; list: number | null }) {
  if (paise > 0) return <>{formatINR(paise)}</>;
  return (
    <>
      {list ? (
        <s aria-label={`was ${formatINR(list)}`} style={{ opacity: 0.6, marginRight: 4 }}>
          {formatINR(list)}
        </s>
      ) : null}
      Free
    </>
  );
}

function WarrantyClaim({ view, onResult }: { view: View; onResult: (n: Note, toService: boolean) => void }) {
  const [area, setArea] = useState('');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files).slice(0, 4 - photos.length)) {
      try {
        const file = await shrinkImage(f);
        next.push({ file, preview: URL.createObjectURL(file) });
      } catch {
        /* an unreadable photo is skipped */
      }
    }
    setPhotos(next);
  };

  const send = async () => {
    setBusy(true);
    const form = new FormData();
    form.append('projectId', view.projectId);
    form.append('area', area);
    form.append('description', text);
    for (const p of photos) form.append('photos', p.file);
    const r = await post('/api/app/v1/aftercare/warranty', form);
    setBusy(false);
    const b = r.body;
    if (!r.ok) return onResult({ ok: false, text: String(b.error ?? 'That did not go through.'), ...(b.gate === 'payments' ? { pending: (b.pendingPaise as number | null) ?? null } : {}) }, false);
    if (b.covered) {
      setArea('');
      setText('');
      setPhotos([]);
      return onResult({ ok: true, text: String(b.message) }, false);
    }
    return onResult({ ok: false, text: String(b.message) }, true);
  };

  return (
    <div className="oa-card">
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
        {view.warranty.open
          ? `Your warranty${view.warranty.endsOn ? ` runs to ${new Date(`${view.warranty.endsOn}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. It covers your modular furniture. Tell us what is wrong and add photos; we check it straight away.`
          : (view.warranty.message ?? '')}
      </p>
      <p className="oa-label" style={{ marginTop: 14 }}>
        What is it about
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {view.warranty.areas.map((a) => (
          <label key={a.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 15 }}>
            <input type="radio" name="area" value={a.key} checked={area === a.key} onChange={() => setArea(a.key)} />
            {a.label}
          </label>
        ))}
      </div>
      <label className="oa-label" htmlFor="claim-text">
        What is wrong
      </label>
      <textarea id="claim-text" className="oa-input" rows={3} maxLength={500} placeholder="The kitchen drawer next to the hob does not close" value={text} onChange={(e) => setText(e.target.value)} />
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = '';
        }}
      />
      {photos.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.preview} src={p.preview} alt={`Photo ${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
          ))}
        </div>
      ) : null}
      {photos.length < 4 ? (
        <button type="button" className="oa-cta light" style={{ marginTop: 10, boxShadow: 'inset 0 0 0 1px var(--line)' }} onClick={() => input.current?.click()}>
          <CameraIcon />
          {photos.length ? 'Add another photo' : 'Add photos'}
        </button>
      ) : null}
      <button type="button" className="oa-cta" style={{ marginTop: 10 }} disabled={busy || !area || text.trim().length < 5 || photos.length === 0} onClick={() => void send()}>
        {busy ? 'Checking…' : 'Raise warranty claim'}
      </button>
    </div>
  );
}

function ServiceVisit({ view, onResult }: { view: View; onResult: (n: Note) => void }) {
  const [category, setCategory] = useState('');
  const [text, setText] = useState('');
  const [day, setDay] = useState(view.service.days[0]?.date ?? '');
  const [start, setStart] = useState('');
  const [busy, setBusy] = useState(false);
  const picked = view.service.categories.find((c) => c.key === category);
  const slots = view.service.days.find((d) => d.date === day)?.slots ?? [];

  const book = async () => {
    setBusy(true);
    const form = new FormData();
    form.append('projectId', view.projectId);
    form.append('category', category);
    form.append('description', text);
    form.append('day', day);
    form.append('start', start);
    const r = await post('/api/app/v1/aftercare/service', form);
    setBusy(false);
    const b = r.body;
    if (!r.ok) return onResult({ ok: false, text: String(b.error ?? 'That did not go through.'), ...(b.gate === 'payments' ? { pending: (b.pendingPaise as number | null) ?? null } : {}) });
    if (b.payUrl) {
      window.location.href = String(b.payUrl);
      return;
    }
    setCategory('');
    setText('');
    setStart('');
    onResult({ ok: true, text: `Booked: ${String(b.when)}. Free, in your first month after the handover.` });
  };

  if (view.service.categories.length === 0) {
    return <p className="oa-note">{view.studio} has not opened service visits yet.</p>;
  }
  return (
    <div className="oa-card">
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
        {view.service.free
          ? `Service visits are free in your first month after the handover${view.service.freeUntil ? `, until ${new Date(`${view.service.freeUntil}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}. Pick a slot and book.`
          : 'Each kind of visit has a fixed visiting charge. Pick a slot and pay it; the visit is booked once it is paid.'}
      </p>
      <p className="oa-label" style={{ marginTop: 14 }}>
        Kind of work
      </p>
      <div className="oa-chips" style={{ flexWrap: 'wrap' }}>
        {view.service.categories.map((c) => (
          <button key={c.key} type="button" className="oa-chip" aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>
            {c.label} <small><Price paise={c.chargePaise} list={c.listPaise} /></small>
          </button>
        ))}
      </div>
      <label className="oa-label" htmlFor="svc-text">
        What needs doing
      </label>
      <textarea id="svc-text" className="oa-input" rows={3} maxLength={500} placeholder="The LED strip in the wardrobe stopped working" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="oa-label">Day</p>
      <div className="oa-chips" style={{ flexWrap: 'wrap' }}>
        {view.service.days.map((d) => (
          <button
            key={d.date}
            type="button"
            className="oa-chip"
            aria-pressed={day === d.date}
            onClick={() => {
              setDay(d.date);
              setStart('');
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="oa-label">Time</p>
      <div className="oa-chips" style={{ flexWrap: 'wrap' }}>
        {slots.map((s) => (
          <button key={s.start} type="button" className="oa-chip" aria-pressed={start === s.start} disabled={s.left === 0} onClick={() => setStart(s.start)}>
            {s.label} {s.left === 0 ? <small>full</small> : null}
          </button>
        ))}
      </div>
      {!view.service.ready ? <p className="oa-note">Paying for a visit is not switched on yet.</p> : null}
      <button
        type="button"
        className="oa-cta"
        style={{ marginTop: 12 }}
        disabled={busy || !picked || !start || text.trim().length < 5 || !view.service.ready}
        onClick={() => void book()}
      >
        {busy ? 'Booking…' : view.service.free ? 'Book free visit' : picked ? `Pay ${formatINR(picked.chargePaise)} and book` : 'Pay and book'}
      </button>
    </div>
  );
}
