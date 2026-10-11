import Link from 'next/link';
import type { Metadata } from 'next';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { siteSnagList, type SiteSnag } from '@/modules/project/snag-read';
import { SNAG_WORDS } from './words';

export const metadata: Metadata = { title: 'Snags to fix', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Site mode · Snags (studio workspace Phase 4): the snags on this member's
 * sites waiting for a fix — the ones given to them first. One big card each;
 * tapping opens *Fix a snag*. Fixes waiting for the customer and closed
 * snags are not shown: there is nothing for the site to do on them.
 */
export default async function SiteSnagsPage() {
  const [lang, snags] = await Promise.all([getLang(), siteSnagList()]);
  const t = translator(lang, SNAG_WORDS);
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  const day = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const mine = snags.filter((s) => s.mine);
  const others = snags.filter((s) => !s.mine);

  const card = (s: SiteSnag) => {
    const line =
      s.state === 'reopened'
        ? { text: t('reopened', { name: s.customerFirst }), tone: 'var(--s-bad)' }
        : s.overdue && s.fixBy
          ? { text: t('late', { date: day(s.fixBy) }), tone: 'var(--s-bad)' }
          : s.fixBy
            ? { text: t('fixBy', { date: day(s.fixBy) }), tone: 'var(--s-accent)' }
            : { text: t('noDate'), tone: 'var(--s-ink-3)' };
    return (
      <li key={s.id}>
        <Link
          href={`/studio/site/snag/${s.id}`}
          className="s-card flex min-h-[96px] items-center gap-4 p-4 text-[var(--s-ink)] no-underline active:scale-[0.99]"
        >
          {s.before[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.before[0]} alt="" className="h-[72px] w-[72px] flex-none rounded-[12px] object-cover" />
          ) : (
            <span aria-hidden="true" className="h-[72px] w-[72px] flex-none rounded-[12px] bg-[var(--s-surface-2)]" />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[17px] font-semibold leading-snug">{s.title}</span>
            <span className="text-[14px] text-[var(--s-ink-2)]">{[s.room, s.home].filter(Boolean).join(' · ')}</span>
            <span className="text-[14px] font-medium" style={{ color: line.tone }}>
              {line.text}
            </span>
          </span>
          <span aria-hidden="true" className="text-[24px] text-[var(--s-ink-3)]">
            ›
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <div>
        <h1 className="m-0 text-[28px] font-medium tracking-[-0.02em]">{t('list.h1')}</h1>
        <p className="m-0 mt-1 text-[15px] text-[var(--s-ink-2)]">{t('list.sub')}</p>
      </div>
      {snags.length === 0 ? <p className="s-card m-0 p-5 text-[16px] text-[var(--s-ink-2)]">{t('list.none')}</p> : null}
      {mine.length ? (
        <section className="flex flex-col gap-2.5" aria-label={t('list.mine')}>
          <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--s-ink-3)]">
            {t('list.mine')} · {mine.length}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{mine.map(card)}</ul>
        </section>
      ) : null}
      {others.length ? (
        <section className="flex flex-col gap-2.5" aria-label={t('list.others')}>
          <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--s-ink-3)]">
            {t('list.others')} · {others.length}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{others.map(card)}</ul>
        </section>
      ) : null}
    </div>
  );
}
