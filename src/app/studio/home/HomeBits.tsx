'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LANGS, type Lang } from '@/modules/i18n/site';
import { STUDIO_LANG_LABEL } from '@/modules/i18n/studio';
import { setLang } from '@/components/app/i18n';
import { OPEN_SEARCH_EVENT } from '../ui/StudioFrame';
import { LineIcon } from '../ui/icons';
import { Oim } from '../ui/brand';

/** The home's big search: opens the same Ctrl K palette as every app's header. */
export function HomeSearch({ label }: { label: string }) {
  return (
    <button type="button" className="bigsearch" onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}>
      <LineIcon name="search" size={20} />
      <span style={{ flex: 1 }}>{label}</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}

/** EN / हिं / मरा in the design's segmented control (the same `oa.lang` cookie as site mode). */
export function LangSeg({ value }: { value: Lang }) {
  const router = useRouter();
  return (
    <div className="seg" role="group" aria-label="Language">
      {LANGS.map(({ id }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          aria-label={STUDIO_LANG_LABEL[id].full}
          onClick={() => {
            setLang(id);
            router.refresh();
          }}
        >
          {STUDIO_LANG_LABEL[id].short}
        </button>
      ))}
    </div>
  );
}

/**
 * The colourful opening, once per browser session (the brief). Rendered on the
 * server so it covers the first paint; the inline script hides it straight
 * away when this session has already seen it. Gone by 2.5 s (motion CSS) and
 * never drawn under reduced motion.
 */
const SPLASH_KEY = 'oi-studio-splash';
const SPLASH_SCRIPT = `try{if(sessionStorage.getItem('${SPLASH_KEY}')){document.documentElement.setAttribute('data-splash','seen')}else{sessionStorage.setItem('${SPLASH_KEY}','1')}}catch(e){}`;

export function Splash({ greeting, sub = 'Your studio is ready' }: { greeting: string; sub?: string }) {
  /* Inline scripts do not run on a client-side visit, so once this one has
     played, the page is marked and the CSS keeps it hidden for the rest of
     the session's in-app moves too. */
  useEffect(() => {
    const seen = () => document.documentElement.setAttribute('data-splash', 'seen');
    const t = window.setTimeout(seen, 3400);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      <div className="splash" aria-hidden="true" suppressHydrationWarning>
        <div className="sp-b sp-b1" />
        <div className="sp-b sp-b2" />
        <div className="sp-b sp-b3" />
        <div className="sp-b sp-b4" />
        <div className="sp-b sp-b5" />
        <div className="sp-in">
          <Oim width={115} />
          <b>{greeting}</b>
          <span className="t">{sub}</span>
        </div>
      </div>
    </>
  );
}
