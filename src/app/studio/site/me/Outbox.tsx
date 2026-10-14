'use client';

import type { Lang } from '@/modules/i18n/site';
import { flush, retry } from '../lib/queue';
import { useOnline, useOutbox } from '../lib/useOutbox';
import { errorWords, siteWords } from '../words';

/** What this phone has saved: each post's state, and "Send now". */
export function Outbox({ lang }: { lang: Lang }) {
  const t = siteWords(lang);
  const posts = useOutbox();
  const online = useOnline();
  const waiting = posts.filter((p) => p.status !== 'sent');
  const time = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

  return (
    <section className="st-sec" aria-labelledby="h-outbox">
      <h2 id="h-outbox">{t('me.queue')}</h2>
      {posts.length === 0 ? (
        <p className="st-line" style={{ margin: 0, fontSize: 15 }}>
          {t('me.queueNone')}
        </p>
      ) : null}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {posts.map((p) => {
          const tone = p.status === 'sent' ? 'good' : p.status === 'failed' ? 'bad' : 'warn';
          return (
            <li key={p.clientRef} className="st-said-box" style={{ gap: 6 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600 }}>{p.home}</span>
              <span className="st-line">
                {time(p.postedAt)} · {p.kind === 'NOBODY' ? t('me.nobody') : t('me.update', { n: p.photos.length })}
              </span>
              <span className={`st-status ${tone}`}>
                <i aria-hidden="true" />
                {p.status === 'sent'
                  ? t('queue.sent')
                  : p.status === 'failed'
                    ? t('queue.failed', { error: errorWords(t, p.error ?? undefined) })
                    : p.status === 'sending'
                      ? t('queue.sending')
                      : `${t('queue.waiting')}${p.error ? ` · ${errorWords(t, p.error)}` : ''}`}
              </span>
              {p.status === 'failed' ? (
                <button type="button" onClick={() => void retry(p.clientRef)} className="st-fill">
                  {t('queue.retry')}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {waiting.length ? (
        <>
          {!online ? (
            <p className="st-hint" style={{ margin: 0 }}>
              {t('queue.offline')}
            </p>
          ) : null}
          <button type="button" onClick={() => void flush()} className="st-big">
            {t('me.sendNow')}
          </button>
        </>
      ) : null}
    </section>
  );
}
