import type { Metadata } from 'next';
import { getLang } from '@/modules/i18n/server';
import { tx } from '@/modules/i18n/site';
import { STUDIO_WORDS } from '@/modules/i18n/studio';
import { getCurrentUser } from '@/modules/auth/session';
import { signOutAction } from '@/app/sign-in/actions';
import { LangSeg } from '../../home/HomeBits';
import { ThemeToggle } from '../../ui/theme';
import { Outbox } from './Outbox';
import { siteWords } from '../words';

export const metadata: Metadata = { title: 'Me', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Site mode · Me: the language and theme, what this phone still has to send, and sign out. */
export default async function SiteMePage() {
  const [lang, user] = await Promise.all([getLang(), getCurrentUser()]);
  const t = siteWords(lang);
  return (
    <>
      <div className="st-head">
        <div style={{ minWidth: 0 }}>
          {user?.name ? <span className="who">{user.name}</span> : null}
          <h1>{t('me.h1')}</h1>
        </div>
        <div className="st-ctl">
          <ThemeToggle className="thbtn st-thb" />
        </div>
      </div>
      <div className="st-page">
        <section className="st-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('me.lang')}</h2>
          <LangSeg value={lang} />
        </section>
        <Outbox lang={lang} />
        <form action={signOutAction}>
          <button type="submit" className="st-fill" style={{ width: '100%' }}>
            {tx(lang, STUDIO_WORDS['site.signOut'])}
          </button>
        </form>
      </div>
    </>
  );
}
