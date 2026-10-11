'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@/modules/i18n/site';
import type { SiteCard } from '@/modules/project/site-log';
import { NOBODY_REASONS, countsAgainstStudio, type NobodyReasonName } from '@/modules/project/site-log-rules';
import { CameraIcon, PauseIcon, WrenchIcon } from './icons';
import { enqueue, newClientRef, retry, type QueuedPost } from './lib/queue';
import { useOnline, useOutbox } from './lib/useOutbox';
import { errorWords, siteWords, type SiteT } from './words';

const istDayOf = (iso: string) => new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 10);

/** The cards on My sites today, with this phone's outbox folded in. */
export function SiteCards({ cards, lang, today }: { cards: SiteCard[]; lang: Lang; today: string }) {
  const t = siteWords(lang);
  const posts = useOutbox();
  const online = useOnline();
  const router = useRouter();
  const seen = useRef(new Set<string>());

  // When something this phone sent lands, show the server's truth.
  useEffect(() => {
    let fresh = false;
    for (const p of posts) {
      if (p.status === 'sent' && !seen.current.has(p.clientRef)) {
        seen.current.add(p.clientRef);
        fresh = true;
      }
    }
    if (fresh) router.refresh();
  }, [posts, router]);

  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {cards.map((c) => (
        <Card key={c.id} card={c} t={t} lang={lang} online={online} queued={posts.filter((p) => p.projectId === c.id && istDayOf(p.postedAt) === today)} />
      ))}
    </ul>
  );
}

function clock(iso: string, lang: Lang) {
  return new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function Card({ card: c, t, lang, online, queued }: { card: SiteCard; t: SiteT; lang: Lang; online: boolean; queued: QueuedPost[] }) {
  const [nobody, setNobody] = useState(false);
  const [reason, setReason] = useState<NobodyReasonName | null>(null);
  const pending = queued.find((p) => p.status !== 'sent') ?? null;
  const posted = c.today !== null || queued.length > 0;

  let status: { text: string; tone: string; dot: string };
  if (pending) {
    status =
      pending.status === 'failed'
        ? { text: t('queue.failed', { error: errorWords(t, pending.error ?? undefined) }), tone: 'var(--s-bad)', dot: 'var(--s-bad)' }
        : pending.status === 'sending'
          ? { text: t('queue.sending'), tone: 'var(--s-ink-2)', dot: 'var(--s-warn)' }
          : { text: `${t('queue.waiting')}${pending.error ? ` · ${errorWords(t, pending.error)}` : ''}`, tone: 'var(--s-warn)', dot: 'var(--s-warn)' };
  } else if (c.today?.kind === 'NOBODY' && c.today.reason) {
    status = { text: t('card.nobody', { reason: t(`reason.${c.today.reason}`) }), tone: 'var(--s-ink-2)', dot: 'var(--s-ink-3)' };
  } else if (c.today) {
    const time = clock(c.today.postedAt, lang);
    const line = c.today.photos === 0 ? t('card.postedNoPhoto', { time }) : c.today.photos === 1 ? t('card.posted1', { time }) : t('card.posted', { time, n: c.today.photos });
    status = { text: c.today.corrections ? `${line} · ${t('card.added', { n: c.today.corrections })}` : line, tone: 'var(--s-good)', dot: 'var(--s-good)' };
  } else if (queued.some((p) => p.status === 'sent')) {
    status = { text: t('queue.sent'), tone: 'var(--s-good)', dot: 'var(--s-good)' };
  } else if (!c.expected) {
    status = { text: t('card.notNeeded'), tone: 'var(--s-ink-3)', dot: 'var(--s-ink-3)' };
  } else {
    status = { text: t('card.notPosted'), tone: 'var(--s-warn)', dot: 'var(--s-warn)' };
  }

  const saveNobody = async () => {
    if (!reason) return;
    await enqueue({
      clientRef: newClientRef(),
      projectId: c.id,
      home: c.home,
      kind: 'NOBODY',
      reason,
      postedAt: new Date().toISOString(),
      photos: [],
      voice: null,
      crew: [],
      ticks: [],
    });
    setNobody(false);
  };

  return (
    <li className="s-card flex flex-col gap-3.5 p-4">
      <div>
        <p className="m-0 text-[18px] font-semibold leading-snug">{c.home}</p>
        <p className="m-0 mt-0.5 text-[14px] text-[var(--s-ink-2)]">
          {c.stage ? t('card.line', { customer: c.customerFirst, stage: c.stage, day: c.day, of: c.of }) : t('card.lineNoStage', { customer: c.customerFirst, day: c.day, of: c.of })}
        </p>
      </div>

      <p role="status" className="m-0 flex items-center gap-2 text-[15px] font-medium" style={{ color: status.tone }}>
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ background: status.dot }} />
        {status.text}
      </p>
      {pending && !online ? <p className="m-0 -mt-2 text-[13.5px] text-[var(--s-ink-3)]">{t('queue.offline')}</p> : null}
      {pending?.status === 'failed' || (pending?.status === 'waiting' && pending.error === 'sign_in') ? (
        <button
          type="button"
          onClick={() => void retry(pending.clientRef)}
          className="min-h-[48px] rounded-[12px] border border-[var(--s-rule)] bg-[var(--s-surface)] text-[15px] font-medium"
        >
          {t('queue.retry')}
        </button>
      ) : null}

      <Link
        href={`/studio/site/post/${c.id}`}
        className="flex min-h-[64px] items-center justify-center gap-2.5 rounded-[14px] bg-[var(--s-accent)] px-4 text-[17px] font-semibold text-white no-underline active:scale-[0.99]"
      >
        <CameraIcon />
        {posted ? t('card.addMore') : t('card.post')}
      </Link>

      <div className="grid grid-cols-2 gap-2.5">
        {!posted ? (
          <button
            type="button"
            aria-expanded={nobody}
            onClick={() => setNobody((v) => !v)}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-[14px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[15px] font-medium text-[var(--s-ink)]"
          >
            <PauseIcon />
            {t('card.nobodyBtn')}
          </button>
        ) : (
          <span />
        )}
        <Link
          href="/studio/site/snag"
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-[14px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[15px] font-medium text-[var(--s-ink)] no-underline"
        >
          <WrenchIcon />
          {c.openSnags === 0 ? t('card.noSnags') : c.openSnags === 1 ? t('card.snags1') : t('card.snags', { n: c.openSnags })}
        </Link>
      </div>

      {nobody && !posted ? (
        <div className="flex flex-col gap-3 rounded-[14px] bg-[var(--s-surface-2)] p-3.5">
          <p className="m-0 text-[16px] font-semibold">{t('nobody.q')}</p>
          <div role="radiogroup" aria-label={t('nobody.q')} className="flex flex-col gap-2">
            {NOBODY_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={`min-h-[52px] rounded-[12px] px-4 text-left text-[16px] ${
                  reason === r ? 'bg-[var(--s-accent)] font-semibold text-white' : 'border border-[var(--s-rule)] bg-[var(--s-surface)] text-[var(--s-ink)]'
                }`}
              >
                {t(`reason.${r}`)}
              </button>
            ))}
          </div>
          {reason ? (
            <p className="m-0 text-[14px] leading-relaxed text-[var(--s-ink-2)]">
              {countsAgainstStudio(reason) ? t('nobody.counts', { customer: c.customerFirst }) : t('nobody.free', { customer: c.customerFirst })}
            </p>
          ) : null}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              disabled={!reason}
              onClick={() => void saveNobody()}
              className="min-h-[56px] rounded-[14px] bg-[var(--s-accent)] px-4 text-[16px] font-semibold text-white disabled:opacity-40"
            >
              {t('nobody.save')}
            </button>
            <button type="button" onClick={() => setNobody(false)} className="min-h-[56px] rounded-[14px] px-4 text-[15px] text-[var(--s-ink-2)]">
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
