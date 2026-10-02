'use client';

/**
 * "Or show us a room you love" — a photo becomes up to three of our styles,
 * each with the reason, and the customer decides whether to use them.
 *
 * Nothing is added until they press "Use these". The picks go in first, the
 * brief keeps at most three likes, and a style they ruled out is never added
 * back by a photo.
 */

import { useState } from 'react';
import type { StyleTag } from '@/modules/brief/types';
import type { StylePick } from '@/modules/inspiration/reading';
import { readInspirationAction } from './actions';

export function InspirationReader({
  likes,
  dislikes,
  onUse,
}: {
  likes: StyleTag[];
  dislikes: StyleTag[];
  onUse: (styleLikes: StyleTag[]) => void;
}) {
  const [state, setState] = useState<
    { kind: 'idle'; error: string | null } | { kind: 'reading' } | { kind: 'read'; picks: StylePick[] } | { kind: 'used' }
  >({ kind: 'idle', error: null });

  async function read(form: FormData) {
    setState({ kind: 'reading' });
    const r = await readInspirationAction(form).catch(() => null);
    if (!r || !r.ok) setState({ kind: 'idle', error: r?.error ?? 'We could not read that photo just now.' });
    else setState({ kind: 'read', picks: r.picks });
  }

  if (state.kind === 'used') {
    return <p className="m-0 mt-6 text-[14px] text-[var(--ink2)]">Added from your photo. Change any of them above.</p>;
  }

  if (state.kind === 'read') {
    const usable = state.picks.filter((p) => !dislikes.includes(p.style));
    return (
      <div className="mt-6 rounded-[14px] border border-[var(--acc)] bg-[var(--card)] p-5">
        <p className="oi-label m-0 mb-3">In your photo we see</p>
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {state.picks.map((p) => (
            <li key={p.style} className="text-[15px] leading-snug">
              <strong className="font-semibold">{p.label}</strong>
              {p.why ? <span className="text-[var(--ink2)]"> — {p.why}</span> : null}
              {dislikes.includes(p.style) ? <span className="text-[var(--acc-ink)]"> (you ruled this out, so we will leave it)</span> : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          {usable.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                const merged = [...usable.map((p) => p.style), ...likes.filter((l) => !usable.some((p) => p.style === l))].slice(0, 3);
                onUse(merged);
                setState({ kind: 'used' });
              }}
              className="cursor-pointer px-5 py-2.5 text-[14.5px] font-medium text-white"
              style={{ background: 'var(--acc-btn)' }}
            >
              Use these
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setState({ kind: 'idle', error: null })}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline"
          >
            Try another photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={read} className="mt-8 border-t border-[var(--line)] pt-6">
      <p className="m-0 mb-1 text-[15px] font-medium text-[var(--ink)]">Or show us a room you love</p>
      <p className="m-0 mb-3 text-[13.5px] text-[var(--ink2)]">
        A screenshot from Pinterest or Instagram, a friend&rsquo;s flat — we tell you which styles it is,
        and you decide. The photo is read once and not kept.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="max-w-full border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[14px]"
        />
        <button
          type="submit"
          disabled={state.kind === 'reading'}
          className="cursor-pointer border border-[var(--line)] bg-transparent px-5 py-2.5 text-[14px] font-medium text-[var(--ink)] disabled:opacity-60"
        >
          {state.kind === 'reading' ? 'Looking…' : 'Read my photo'}
        </button>
      </div>
      {state.kind === 'idle' && state.error ? (
        <p role="alert" className="m-0 mt-3 text-[13.5px] text-[var(--acc-ink)]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
