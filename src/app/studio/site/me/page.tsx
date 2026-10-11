import type { Metadata } from 'next';
import { getLang } from '@/modules/i18n/server';
import { getCurrentUser } from '@/modules/auth/session';
import { LangSwitch } from '../../LangSwitch';
import { Outbox } from './Outbox';
import { siteWords } from '../words';

export const metadata: Metadata = { title: 'Me', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Site mode · Me: the language, and what this phone still has to send. Sign out is in the header. */
export default async function SiteMePage() {
  const [lang, user] = await Promise.all([getLang(), getCurrentUser()]);
  const t = siteWords(lang);
  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="m-0 text-[28px] font-semibold tracking-[-0.02em]">{t('me.h1')}</h1>
        {user?.name ? <p className="m-0 mt-1 text-[16px] text-[var(--s-ink-2)]">{user.name}</p> : null}
      </div>
      <section className="s-card flex items-center justify-between gap-4 p-4">
        <h2 className="m-0 text-[16px] font-semibold">{t('me.lang')}</h2>
        <LangSwitch value={lang} />
      </section>
      <Outbox lang={lang} />
    </div>
  );
}
