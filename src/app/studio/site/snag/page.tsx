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
        ? { text: t('reopened', { name: s.customerFirst }), tone: 'var(--bad)' }
        : s.overdue && s.fixBy
          ? { text: t('late', { date: day(s.fixBy) }), tone: 'var(--bad)' }
          : s.fixBy
            ? { text: t('fixBy', { date: day(s.fixBy) }), tone: 'var(--warn)' }
            : { text: t('noDate'), tone: 'var(--muted)' };
    return (
      <li key={s.id}>
        <Link href={`/studio/site/snag/${s.id}`} className="st-snag">
          {s.before[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.before[0]} alt="" />
          ) : (
            <span aria-hidden="true" className="ph" />
          )}
          <span style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{s.title}</span>
            <span className="st-line">{[s.room, s.home].filter(Boolean).join(' · ')}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: line.tone }}>{line.text}</span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--muted)', flexShrink: 0 }}>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      </li>
    );
  };

  const head = (label: string, n: number) => (
    <h2 className="st-label" style={{ margin: '4px 4px 0', fontSize: 13, fontWeight: 600 }}>
      {label} · {n}
    </h2>
  );

  return (
    <>
      <div className="st-head">
        <div style={{ minWidth: 0 }}>
          <span className="who">{t('list.sub')}</span>
          <h1>{t('list.h1')}</h1>
        </div>
      </div>
      <div className="st-page">
        {snags.length === 0 ? (
          <div className="st-card">
            <p className="st-line" style={{ margin: 0, fontSize: 16 }}>
              {t('list.none')}
            </p>
          </div>
        ) : null}
        {mine.length ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label={t('list.mine')}>
            {head(t('list.mine'), mine.length)}
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>{mine.map(card)}</ul>
          </section>
        ) : null}
        {others.length ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label={t('list.others')}>
            {head(t('list.others'), others.length)}
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>{others.map(card)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
