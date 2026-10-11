import type { Metadata } from 'next';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { STUDIO_WORDS } from '@/modules/i18n/studio';
import { getCurrentUser } from '@/modules/auth/session';
import { projectsForStudio } from '@/modules/portal/tracker-store';

export const metadata: Metadata = { title: 'My sites today', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Site mode, the placeholder (PHASE-1-PLAN §2): where a site supervisor
 * lands. Their assigned sites and nothing else — `projectsForStudio` reads
 * through `projectsVisibleTo`, so an unassigned project never appears.
 * Phase 2 fills it: today's update with photos and voice, snags, the bottom
 * bar. In the language they picked on the sign-in.
 */
export default async function SiteTodayPage() {
  const [lang, user, sites] = await Promise.all([getLang(), getCurrentUser(), projectsForStudio()]);
  const t = translator(lang, STUDIO_WORDS);
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  const day = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const first = user?.name?.split(' ')[0];

  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <div>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">{first ? t('site.hello', { name: first }) : t('site.helloNoName')}</p>
        <h1 className="m-0 mt-1 text-[28px] font-medium tracking-[-0.02em]">{t('site.h1')}</h1>
      </div>

      {sites.length === 0 ? (
        <p className="s-card m-0 p-5 text-[15px] leading-relaxed text-[var(--s-ink-2)]">{t('site.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {sites.map((s) => {
            const done = s.stages.filter((x) => x.state === 'done').length;
            const last = s.updates[0];
            return (
              <li key={s.id} className="s-card flex flex-col gap-1.5 p-5">
                <p className="m-0 text-[17px] font-semibold">{s.label || 'A home'}</p>
                <p className="m-0 text-[14px] text-[var(--s-ink-2)]">
                  {t('site.stages', { done, total: s.stages.length })} · {t('site.started', { date: day(s.startOn) })}
                </p>
                <p className="m-0 text-[14px] text-[var(--s-ink-3)]">
                  {last ? t('site.lastUpdate', { date: day(last.at) }) : t('site.noUpdate')}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="m-0 text-[13.5px] leading-relaxed text-[var(--s-ink-3)]">{t('site.soon')}</p>
    </div>
  );
}
