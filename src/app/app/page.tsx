'use client';

/**
 * 0 Opening and 1 Welcome (the owner's v1 screens).
 *
 * The opening is the design file's own: a second of dark, a short film of a
 * bulb lighting an empty room, then the logo coming into focus with a warm
 * glow and a sweep of light. Tap anywhere to go on. Once a session; reduced
 * motion and a second visit go straight to the welcome.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Logotype } from '@/components/brand';
import { Frame, Foot, Cta } from '@/components/app/ui';
import { VERIFIED_STUDIOS } from '@/lib/claims';
import { LangPicker, useT } from '@/components/app/i18n';

const SEEN = 'oa.opened';
const DARK_MS = 1000;
/** If the film never reports its end (blocked autoplay, slow network), move on anyway. */
const CLIP_MAX_MS = 4200;

type Phase = 'dark' | 'clip' | 'logo' | 'done';

export default function AppStart() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>('dark');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === '1';
      sessionStorage.setItem(SEEN, '1');
    } catch {
      /* storage blocked: play it */
    }
    if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('done');
      return;
    }
    const t = timers.current;
    t.push(setTimeout(() => setPhase('clip'), DARK_MS));
    t.push(setTimeout(() => setPhase((p) => (p === 'clip' ? 'logo' : p)), DARK_MS + CLIP_MAX_MS));
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <Frame dark>
      <div className={`oa-opening${phase === 'done' ? ' gone' : ''}`} aria-hidden={phase === 'done'}>
        <div className="stage">
          {phase === 'clip' ? (
            <video
              src="/app/opening.mp4"
              poster="/app/opening-poster.jpg"
              autoPlay
              muted
              playsInline
              onEnded={() => setPhase('logo')}
              aria-label="A bulb lights up in an empty room"
            />
          ) : null}
          {phase === 'logo' ? (
            <>
              <div className="halo" />
              <div className="logo" role="img" aria-label="One Interiors" />
              <span className="hint">Tap anywhere to continue</span>
            </>
          ) : null}
          {phase !== 'done' ? (
            <button type="button" className="tap" aria-label="Continue" onClick={() => setPhase('done')} />
          ) : null}
        </div>
      </div>

      {/* Mounted only once the opening is gone, so its headline rises in view rather than behind the film. */}
      {phase === 'done' ? (
        <section className="oa-welcome" aria-label="Welcome">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app/photos/welcome-hero.webp" alt="A warmly lit living room with a linen sofa, round oak table and a tall window" />
          <Logotype className="logo" />
          <div className="copy">
            <p className="oa-meta" style={{ color: 'rgba(255,255,255,.85)', margin: 0 }}>
              <span className="oa-dot" />
              {t('welcome.kicker', { n: VERIFIED_STUDIOS })}
            </p>
            <h1>{t('welcome.h1')}</h1>
            <p>{t('welcome.sub')}</p>
            <LangPicker dark />
          </div>
          <Foot>
            <Cta href="/app/name">{t('welcome.cta')}</Cta>
            <Link href="/sign-in?next=/app/home" className="oa-link" style={{ color: '#fff' }}>
              {t('welcome.have')}
            </Link>
          </Foot>
        </section>
      ) : null}
    </Frame>
  );
}
