import type { Metadata } from 'next';
import { getLang } from '@/modules/i18n/server';
import { getCurrentUser } from '@/modules/auth/session';
import { mySitesToday } from '@/modules/project/site-log';
import { istDay } from '@/modules/project/working-days';
import { SiteCards } from './SiteCards';
import { siteWords } from './words';
import { EyeIcon } from './icons';
import { crewsOnMySites } from '@/modules/studio-crews/store';
import { LangSeg } from '../home/HomeBits';
import { ThemeToggle } from '../ui/theme';
import { MyWork } from '../home/MyWork';
import { currentMember } from '@/modules/studio/access';
import { workFor } from '@/modules/studio/my-work';

export const metadata: Metadata = { title: 'My sites today', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Site mode · My sites today (the owner's UI handoff, SiteToday). One card
 * per site this member may post to — `mySitesToday` reads through
 * `projectsVisibleTo`, so an unassigned site never appears — with today's
 * state (not posted / posted at a time / nobody on site, and anything still
 * waiting to send from this phone), the big **Post today's update** button,
 * **Nobody on site**, and the snag count. In the language picked at sign-in;
 * the header carries the theme and the language.
 */
export default async function SiteTodayPage() {
  const now = new Date();
  const [lang, user, data, crews, member] = await Promise.all([getLang(), getCurrentUser(), mySitesToday(now), crewsOnMySites(), currentMember()]);
  /* My work (owner, 15 Oct 2026): the supervisor's Today, Next 3 days and Missed, first. */
  const work = member?.role === 'SUPERVISOR' ? await workFor(member, now).then((r) => r?.work ?? null).catch(() => null) : null;
  const t = siteWords(lang);
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  const date = now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const first = user?.name?.trim().split(/\s+/)[0];
  const cards = data?.cards ?? [];

  return (
    <>
      <div className="st-head">
        <div style={{ minWidth: 0 }}>
          <span className="who">{t('today.who', { studio: data?.studio ?? 'Your studio' })}</span>
          <h1>{first ? t('hello', { name: first }) : t('helloNoName')}</h1>
        </div>
        <div className="st-ctl">
          <ThemeToggle className="thbtn st-thb" />
        </div>
      </div>
      <div className="st-page">
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <span className="st-date">{cards.length === 1 ? t('today.count1', { date }) : t('today.count', { date, n: cards.length })}</span>
          <span className="st-ctl">
            <LangSeg value={lang} />
          </span>
        </div>

        {work ? (
          <MyWork
            work={work}
            className="st-work"
            labels={{
              title: t('work.title'),
              today: t('work.today'),
              soon: t('work.soon'),
              month: t('work.month'),
              missed: t('work.missed'),
              empty: { today: t('work.emptyToday'), soon: t('work.emptySoon'), month: t('work.emptyMonth'), missed: t('work.emptyMissed') },
              showMore: (n) => t('work.more', { n }),
              notShown: (n) => t('work.notShown', { n }),
            }}
          />
        ) : null}

        {cards.length === 0 ? (
          <div className="st-card">
            <p className="st-line" style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
              {t('today.none')}
            </p>
          </div>
        ) : (
          <SiteCards cards={cards} lang={lang} today={istDay(now)} />
        )}

        {/* Studio OS Phase 3: which crew is on which of these jobs. Names only, never money. */}
        {crews.length ? (
          <section className="st-card" aria-label={t('crews.h')} style={{ gap: 10 }}>
            <span className="st-label">{t('crews.h')}</span>
            {crews.map((c) => (
              <div key={c.projectId}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{c.projectName}</p>
                <p className="st-line" style={{ margin: 0 }}>
                  {c.crews.map((x) => `${x.name} (${x.trades})`).join(' · ')}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        <div className="st-note">
          <EyeIcon />
          <p style={{ margin: 0 }}>{t('today.note')}</p>
        </div>
      </div>
    </>
  );
}
