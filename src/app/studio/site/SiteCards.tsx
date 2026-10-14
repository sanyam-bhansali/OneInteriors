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
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
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

  let status: { text: string; tone: '' | 'warn' | 'good' | 'bad' };
  if (pending) {
    status =
      pending.status === 'failed'
        ? { text: t('queue.failed', { error: errorWords(t, pending.error ?? undefined) }), tone: 'bad' }
        : pending.status === 'sending'
          ? { text: t('queue.sending'), tone: '' }
          : { text: `${t('queue.waiting')}${pending.error ? ` · ${errorWords(t, pending.error)}` : ''}`, tone: 'warn' };
  } else if (c.today?.kind === 'NOBODY' && c.today.reason) {
    status = { text: t('card.nobody', { reason: t(`reason.${c.today.reason}`) }), tone: '' };
  } else if (c.today) {
    const time = clock(c.today.postedAt, lang);
    const line = c.today.photos === 0 ? t('card.postedNoPhoto', { time }) : c.today.photos === 1 ? t('card.posted1', { time }) : t('card.posted', { time, n: c.today.photos });
    status = { text: c.today.corrections ? `${line} · ${t('card.added', { n: c.today.corrections })}` : line, tone: 'good' };
  } else if (queued.some((p) => p.status === 'sent')) {
    status = { text: t('queue.sent'), tone: 'good' };
  } else if (!c.expected) {
    status = { text: t('card.notNeeded'), tone: '' };
  } else {
    status = { text: t('card.notPosted'), tone: 'warn' };
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
    <li className="st-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className="st-title">{c.home}</span>
        <span className="st-line">
          {c.stage ? t('card.line', { customer: c.customerFirst, stage: c.stage, day: c.day, of: c.of }) : t('card.lineNoStage', { customer: c.customerFirst, day: c.day, of: c.of })}
        </span>
      </div>

      <p role="status" className={`st-status ${status.tone}`} style={{ margin: 0 }}>
        <i aria-hidden="true" />
        {status.text}
      </p>
      {pending && !online ? (
        <p className="st-hint" style={{ margin: '-6px 0 0' }}>
          {t('queue.offline')}
        </p>
      ) : null}
      {pending?.status === 'failed' || (pending?.status === 'waiting' && pending.error === 'sign_in') ? (
        <button type="button" onClick={() => void retry(pending.clientRef)} className="st-fill">
          {t('queue.retry')}
        </button>
      ) : null}

      {posted ? (
        <Link href={`/studio/site/post/${c.id}`} className="st-fill">
          <CameraIcon size={20} />
          {t('card.addMore')}
        </Link>
      ) : (
        <Link href={`/studio/site/post/${c.id}`} className="st-big">
          <CameraIcon size={22} />
          {t('card.post')}
        </Link>
      )}

      <div className="st-two">
        {!posted ? (
          <button type="button" aria-expanded={nobody} onClick={() => setNobody((v) => !v)} className="st-fill">
            <PauseIcon size={20} />
            {t('card.nobodyBtn')}
          </button>
        ) : null}
        <Link href="/studio/site/snag" className="st-fill" style={posted ? { gridColumn: '1 / -1' } : undefined}>
          <WrenchIcon size={20} />
          {c.openSnags === 0 ? t('card.noSnags') : c.openSnags === 1 ? t('card.snags1') : t('card.snags', { n: c.openSnags })}
        </Link>
      </div>

      {nobody && !posted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          <span className="st-label" style={{ fontSize: 14 }}>
            {t('nobody.q')}
          </span>
          <div role="radiogroup" aria-label={t('nobody.q')} className="st-chips">
            {NOBODY_REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className="st-chip sm">
                {t(`reason.${r}`)}
              </button>
            ))}
          </div>
          {reason ? (
            <span className="st-hint">
              {countsAgainstStudio(reason) ? t('nobody.counts', { customer: c.customerFirst }) : t('nobody.free', { customer: c.customerFirst })}
            </span>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <button type="button" disabled={!reason} onClick={() => void saveNobody()} className="st-big" style={{ minHeight: 52, fontSize: 15 }}>
              {t('nobody.save')}
            </button>
            <button type="button" onClick={() => setNobody(false)} className="st-link">
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
