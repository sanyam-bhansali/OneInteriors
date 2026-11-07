'use client';

import { useEffect, useRef } from 'react';
import { SiteLangPicker } from '@/components/app/i18n';
import { startLanding, type LandingData } from './script';
import './landing.css';
import './landing-extra.css';

/**
 * The v3.1 home page in the browser: the server-filled markup, the page's
 * script started against it (and stopped when the visitor leaves), and the
 * site's language picker in the top bar.
 */
export function LandingClient({ html, data, lang }: { html: string; data: LandingData; lang: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    return startLanding(root, data);
  }, [html, data]);

  return (
    <>
      <div ref={ref} id="top" lang={lang === 'en' ? 'en-IN' : lang} className="lv31" data-tone="dark" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="lv31-langbar">
        <SiteLangPicker />
      </div>
    </>
  );
}
