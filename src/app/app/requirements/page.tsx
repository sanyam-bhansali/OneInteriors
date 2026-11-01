'use client';

/**
 * The requirement form (walkthrough, 27 Oct 2026; owner, 1 Nov 2026): the
 * questions the designer needs before the design starts, from Hauspire's
 * pre-design form. Filled once; after sending it is read only, the
 * commitment reference. The questions come from the server
 * (project/requirement-form-rules.ts), so the website and the phone ask the
 * same thing.
 */

import { useEffect, useRef, useState } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import type { CustomerRequirementForm } from '@/modules/project/requirement-form';

type Load = { state: 'loading' } | { state: 'none' } | { state: 'error'; text: string } | { state: 'ready'; form: CustomerRequirementForm };

export default function RequirementsPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string; questionId?: string } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const fetchForm = async () => {
    try {
      const res = await fetch('/api/app/v1/requirements', { credentials: 'same-origin', cache: 'no-store' });
      const b = (await res.json()) as { ok: boolean; form?: CustomerRequirementForm | null; error?: string };
      if (!b.ok) return setLoad({ state: 'error', text: b.error ?? 'Could not open the form.' });
      if (!b.form) return setLoad({ state: 'none' });
      setAnswers(b.form.answers);
      setLoad({ state: 'ready', form: b.form });
    } catch {
      setLoad({ state: 'error', text: 'No connection. Try again in a moment.' });
    }
  };
  useEffect(() => {
    void fetchForm();
  }, []);

  const send = async () => {
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch('/api/app/v1/requirements', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const b = (await res.json()) as { ok: boolean; message?: string; error?: string; questionId?: string };
      if (b.ok) {
        setSaid({ ok: true, text: b.message ?? 'Sent.' });
        await fetchForm();
        top.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setSaid({ ok: false, text: b.error ?? 'Could not send it.', questionId: b.questionId });
        if (b.questionId) document.getElementById(`rq-${b.questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch {
      setSaid({ ok: false, text: 'No connection. Your answers are still here; try again.' });
    } finally {
      setBusy(false);
    }
  };

  if (load.state === 'loading') return <Frame>{null}</Frame>;
  if (load.state !== 'ready') {
    return (
      <Frame>
        <Head back="/app/project" />
        <Body>
          <h1 className="oa-title">Requirement form</h1>
          <p className="oa-note">{load.state === 'none' ? 'Your designer sends this form with your mood board. It shows here once they do.' : load.text}</p>
        </Body>
      </Frame>
    );
  }

  const f = load.form;
  const filled = f.state === 'filled';
  return (
    <Frame>
      <Head back="/app/project" meta={f.studio} />
      <Body>
        <div ref={top} />
        <h1 className="oa-title">{f.title}</h1>
        <p className="oa-note">{filled ? `Sent on ${dayWords(f.filledOn!)}. This is your commitment reference; for any change, write to your designer in Chats.` : f.intro}</p>
        {said?.ok ? (
          <p className="oa-note" role="status" style={{ fontWeight: 600 }}>
            {said.text}
          </p>
        ) : null}
        {f.sections.map((s) => (
          <section key={s.id} aria-label={s.title} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{s.title}</h2>
            {s.questions.map((q) => {
              const v = answers[q.id] ?? '';
              const wrong = said && !said.ok && said.questionId === q.id;
              return (
                <div key={q.id} id={`rq-${q.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="oa-label" style={{ color: wrong ? 'var(--accent-ink)' : undefined }}>
                    {q.label}
                  </span>
                  {q.help ? <span className="oa-note" style={{ fontSize: 13 }}>{q.help}</span> : null}
                  {filled ? (
                    <p className="m-0 text-[15px] leading-[1.45]" style={{ whiteSpace: 'pre-wrap' }}>
                      {v || '—'}
                    </p>
                  ) : q.kind === 'choice' ? (
                    <div role="radiogroup" aria-label={q.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {q.options!.map((o) => (
                        <label key={o} className="oa-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
                          <input type="radio" name={q.id} checked={v === o} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))} className="h-5 w-5 accent-[var(--accent)]" />
                          <span className="text-[15px]">{o}</span>
                        </label>
                      ))}
                    </div>
                  ) : q.kind === 'long' ? (
                    <textarea
                      className="oa-input"
                      rows={3}
                      maxLength={2000}
                      value={v}
                      aria-label={q.label}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      style={{ minHeight: 84, resize: 'vertical' }}
                    />
                  ) : (
                    <input className="oa-input" maxLength={200} value={v} aria-label={q.label} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                  )}
                </div>
              );
            })}
          </section>
        ))}
        {said && !said.ok ? (
          <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)', marginTop: 12 }}>
            {said.text}
          </p>
        ) : null}
      </Body>
      {filled ? null : (
        <Foot>
          <Cta onClick={() => void send()} disabled={busy}>
            {busy ? 'Sending…' : 'Send the form'}
          </Cta>
        </Foot>
      )}
    </Frame>
  );
}

const dayWords = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
