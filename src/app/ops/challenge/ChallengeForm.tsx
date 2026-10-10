'use client';

import { useState, useTransition } from 'react';
import { shrinkImage } from '@/lib/shrink-image';
import { setChallengeAction } from './actions';

const input = 'rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px]';

/** Pick the photo, tap where the mistake is, size the circle, and say what it teaches. */
export function ChallengeForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [radius, setRadius] = useState(0.08);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-5 flex max-w-[640px] flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          if (!file || !spot) return setMsg({ ok: false, text: 'Add the photo and tap where the mistake is.' });
          form.set('photo', await shrinkImage(file));
          form.set('x', String(spot.x));
          form.set('y', String(spot.y));
          form.set('radius', String(radius));
          const r = await setChallengeAction(form);
          setMsg(r.ok ? { ok: true, text: 'Saved. It runs from that Monday.' } : { ok: false, text: r.error ?? 'Could not save.' });
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13.5px]">
        Monday it runs
        <input name="weekOf" type="date" required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-[13.5px]">
        Site photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setSpot(null);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>
      {preview ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] text-[var(--color-ink-2)]">Tap the mistake.</span>
          <button
            type="button"
            className="relative block w-full cursor-crosshair border-0 bg-transparent p-0"
            onClick={(e) => {
              const b = e.currentTarget.getBoundingClientRect();
              setSpot({ x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="The photo" className="block w-full rounded-[10px]" />
            {spot ? (
              <span
                className="pointer-events-none absolute rounded-full border-[3px] border-[#e07a4e]"
                style={{
                  left: `${spot.x * 100}%`,
                  top: `${spot.y * 100}%`,
                  width: `${radius * 200}%`,
                  aspectRatio: '1',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ) : null}
          </button>
          <label className="flex items-center gap-3 text-[13.5px]">
            Circle size
            <input type="range" min={0.03} max={0.2} step={0.01} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </label>
        </div>
      ) : null}
      <label className="flex flex-col gap-1 text-[13.5px]">
        What the mistake is
        <input name="answer" required maxLength={120} className={input} placeholder="The edge band is lifting at the corner" />
      </label>
      <label className="flex flex-col gap-1 text-[13.5px]">
        What to check at home
        <textarea
          name="explain"
          required
          rows={4}
          maxLength={600}
          className={input}
          placeholder="Moisture gets in under a lifted edge band and the board swells. Run your finger along every corner of your wardrobes…"
        />
      </label>
      <button type="submit" disabled={pending} className="s-btn self-start">
        {pending ? 'Saving…' : 'Save this week'}
      </button>
      {msg ? <p className={`m-0 text-[13.5px] ${msg.ok ? '' : 'text-[var(--color-terracotta)]'}`}>{msg.text}</p> : null}
    </form>
  );
}
