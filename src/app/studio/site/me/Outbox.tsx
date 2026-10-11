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
    <section className="flex flex-col gap-3" aria-labelledby="h-outbox">
      <h2 id="h-outbox" className="m-0 text-[16px] font-semibold">
        {t('me.queue')}
      </h2>
      {posts.length === 0 ? <p className="m-0 text-[15px] text-[var(--s-ink-2)]">{t('me.queueNone')}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {posts.map((p) => (
          <li key={p.clientRef} className="s-card flex flex-col gap-1 p-4">
            <span className="text-[15.5px] font-medium">{p.home}</span>
            <span className="text-[14px] text-[var(--s-ink-2)]">
              {time(p.postedAt)} · {p.kind === 'NOBODY' ? t('me.nobody') : t('me.update', { n: p.photos.length })}
            </span>
            <span
              className="text-[14px] font-medium"
              style={{ color: p.status === 'sent' ? 'var(--s-good)' : p.status === 'failed' ? 'var(--s-bad)' : 'var(--s-warn)' }}
            >
              {p.status === 'sent'
                ? t('queue.sent')
                : p.status === 'failed'
                  ? t('queue.failed', { error: errorWords(t, p.error ?? undefined) })
                  : p.status === 'sending'
                    ? t('queue.sending')
                    : `${t('queue.waiting')}${p.error ? ` · ${errorWords(t, p.error)}` : ''}`}
            </span>
            {p.status === 'failed' ? (
              <button type="button" onClick={() => void retry(p.clientRef)} className="mt-1 min-h-[48px] rounded-[12px] border border-[var(--s-rule)] text-[15px]">
                {t('queue.retry')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {waiting.length ? (
        <>
          {!online ? <p className="m-0 text-[14px] text-[var(--s-ink-3)]">{t('queue.offline')}</p> : null}
          <button type="button" onClick={() => void flush()} className="min-h-[60px] rounded-[14px] bg-[var(--s-accent)] text-[17px] font-semibold text-white">
            {t('me.sendNow')}
          </button>
        </>
      ) : null}
    </section>
  );
}
