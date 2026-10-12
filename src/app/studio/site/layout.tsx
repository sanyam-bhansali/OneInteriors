import { getLang } from '@/modules/i18n/server';
import { SiteBar } from './SiteBar';
import './site.css';

/**
 * Site mode's frame: the screens, and the Today · Snags · Me bar under
 * them (hidden on the full-screen tasks — posting an update, fixing one
 * snag — whose own big button sits at the bottom). The studio layout above
 * already decides who may be here and draws the header.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <>
      {children}
      <SiteBar lang={lang} />
    </>
  );
}
