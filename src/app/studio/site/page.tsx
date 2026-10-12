import type { Metadata } from 'next';
import { getLang } from '@/modules/i18n/server';
import { getCurrentUser } from '@/modules/auth/session';
import { mySitesToday } from '@/modules/project/site-log';
import { istDay } from '@/modules/project/working-days';
import { SiteCards } from './SiteCards';
import { siteWords } from './words';
import { EyeIcon } from './icons';
import { crewsOnMySites } from '@/modules/studio-crews/store';

export const metadata: Metadata = { title: 'My sites today', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Site mode · My sites today (studio workspace Phase 2, design
 * studio/SiteToday.dc.html, in the studio's deep-green palette). One card
 * per site this member may post to — `mySitesToday` reads through
 * `projectsVisibleTo`, so an unassigned site never appears — with today's
 * state (not posted / posted at a time / nobody on site, and anything still
 * waiting to send from this phone), the big **Post today's update** button,
 * **Nobody on site**, and the snag count. In the language picked at sign-in.
 */
export default async function SiteTodayPage() {
  const now = new Date();
  const [lang, user, data, crews] = await Promise.all([getLang(), getCurrentUser(), mySitesToday(now), crewsOnMySites()]);
  const t = siteWords(lang);
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  const date = now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const first = user?.name?.trim().split(/\s+/)[0];
  const cards = data?.cards ?? [];

  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-5">
      <div>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">{first ? t('hello', { name: first }) : t('helloNoName')}</p>
        <h1 className="m-0 mt-1 text-[28px] font-semibold tracking-[-0.02em]">{t('today.h1')}</h1>
        <p className="m-0 mt-1 font-[family-name:var(--font-mono)] text-[13px] text-[var(--s-ink-3)]">
          {cards.length === 1 ? t('today.count1', { date }) : t('today.count', { date, n: cards.length })}
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="s-card m-0 p-5 text-[16px] leading-relaxed text-[var(--s-ink-2)]">{t('today.none')}</p>
      ) : (
        <SiteCards cards={cards} lang={lang} today={istDay(now)} />
      )}

      {/* Studio OS Phase 3: which crew is on which of these jobs. Names only, never money. */}
      {crews.length ? (
        <section className="s-card flex flex-col gap-2 p-4" aria-label="Crews on your sites">
          {crews.map((c) => (
            <div key={c.projectId}>
              <p className="m-0 text-[14px] font-semibold">{c.projectName}</p>
              <p className="m-0 text-[14px] text-[var(--s-ink-2)]">{c.crews.map((x) => `${x.name} (${x.trades})`).join(' · ')}</p>
            </div>
          ))}
        </section>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-[14px] bg-[var(--s-surface-2)] p-4">
        <span className="mt-0.5 text-[var(--s-ink-2)]">
          <EyeIcon />
        </span>
        <p className="m-0 text-[14px] leading-relaxed text-[var(--s-ink-2)]">{t('today.note')}</p>
      </div>
    </div>
  );
}
