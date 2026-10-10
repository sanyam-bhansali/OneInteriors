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
import { useLang, useSiteT } from '@/components/app/i18n';
import { QUIZ_DICT, quizServerText } from '@/modules/i18n/site/quiz';
import type { StyleTag } from '@/modules/brief/types';
import type { StylePick } from '@/modules/inspiration/reading';
import { readInspirationAction } from './actions';
import { PillButton } from '@/components/home/parts';

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
  const t = useSiteT(QUIZ_DICT);
  const lang = useLang();

  async function read(form: FormData) {
    setState({ kind: 'reading' });
    const r = await readInspirationAction(form).catch(() => null);
    if (!r || !r.ok) setState({ kind: 'idle', error: quizServerText(lang, r?.error) ?? t('insp.err') });
    else setState({ kind: 'read', picks: r.picks });
  }

  if (state.kind === 'used') {
    return <p className="m-0 mt-6 text-[15px] text-[var(--ink-2)]">{t('insp.used')}</p>;
  }

  if (state.kind === 'read') {
    const usable = state.picks.filter((p) => !dislikes.includes(p.style));
    return (
      <div className="flow-card mt-6">
        <p className="eyebrow !mb-3">{t('insp.see')}</p>
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {state.picks.map((p) => (
            <li key={p.style} className="text-[15px] leading-snug">
              <strong className="font-medium">{p.label}</strong>
              {p.why ? <span className="text-[var(--ink-2)]"> — {p.why}</span> : null}
              {dislikes.includes(p.style) ? <span className="text-[var(--accent-ink)]">{t('insp.ruledOut')}</span> : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          {usable.length > 0 ? (
            <PillButton
              size="sm"
              onClick={() => {
                const merged = [...usable.map((p) => p.style), ...likes.filter((l) => !usable.some((p) => p.style === l))].slice(0, 3);
                onUse(merged);
                setState({ kind: 'used' });
              }}
            >
              {t('use')}
            </PillButton>
          ) : null}
          <button
            type="button"
            onClick={() => setState({ kind: 'idle', error: null })}
            className="min-h-10 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink)]"
          >
            {t('insp.another')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={read} className="flow-card mt-8">
      <p className="m-0 mb-1 text-[18px] font-medium tracking-[-0.015em] text-[var(--ink)]">{t('insp.title')}</p>
      <p className="m-0 mb-4 text-[14.5px] leading-relaxed text-[var(--ink-2)]">
        {t('insp.body')}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="w-full max-w-full cursor-pointer rounded-[var(--r-m)] bg-[var(--paper)] p-2 text-[14px] text-[var(--ink-2)] file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--ink)] file:px-4 file:text-[14px] file:font-medium file:text-white"
        />
        <PillButton type="submit" tone="line" size="sm" disabled={state.kind === 'reading'}>
          {state.kind === 'reading' ? t('insp.looking') : t('insp.read')}
        </PillButton>
      </div>
      {state.kind === 'idle' && state.error ? (
        <p role="alert" className="m-0 mt-3 text-[14px] text-[var(--accent-ink)]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
