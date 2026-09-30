'use client';

/**
 * "Your home, built before anyone builds it" — the landing page's 3D flat
 * (option 2). Scrolling through the section builds it: floors, walls,
 * furniture. The style chips repaint it in that style's palette; drag to turn
 * it. A 3 BHK of 1,150 sq ft, the typical Pune one, labelled as an example.
 */

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { STYLE_LABELS, type StyleTag } from '@/modules/brief/types';

const Flat3D = dynamic(() => import('@/components/oi/Flat3D').then((m) => m.Flat3D), {
  ssr: false,
  loading: () => <div className="stage-loading mono muted">Drawing the flat…</div>,
});

const STYLES: StyleTag[] = ['warm-modern', 'japandi', 'indian-contemporary', 'luxe-glam', 'scandinavian'];

export function FlatStage() {
  const section = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [style, setStyle] = useState<StyleTag>('warm-modern');
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    // Only load three.js when the section is close.
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && setNear(true), { rootMargin: '100% 0px' });
    io.observe(el);
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 2 && r.bottom > -window.innerHeight) setNear(true);
      const span = r.height - window.innerHeight;
      setProgress(span > 0 ? Math.min(1, Math.max(0, -r.top / (span * 0.8))) : 1);
    };
    // Scroll events as well as frames: smooth scrolling drives frames, and a
    // plain scroll (or a background tab, whose frames are paused) still lands.
    let raf = 0;
    const tick = () => {
      measure();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', measure);
    };
  }, []);

  return (
    <div ref={section} className="flat-stage">
      <div className="flat-sticky">
        <div className="flat-copy">
          <p className="eyebrow mono">Your home, in 3D</p>
          <h2 className="h-m">See it before anyone builds it.</h2>
          <p className="muted">
            Your brief draws your flat in the style you lean to — every room, in its palette. Scroll to
            build it; drag to turn it.
          </p>
          <div className="flat-styles" role="group" aria-label="Style">
            {STYLES.map((s) => (
              <button key={s} type="button" aria-pressed={style === s} data-hover="" onClick={() => setStyle(s)}>
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>
          <p className="mono muted flat-note">An example: a typical 3 BHK of 1,150 sq ft — a sketch, not a floor plan.</p>
        </div>
        <div className="flat-canvas">
          {near ? (
            <Flat3D
              bedrooms={3}
              carpetAreaSqft={1150}
              style={style}
              progress={progress}
              className="flat-3d"
              label={`A 3D sketch of a 3 BHK in ${STYLE_LABELS[style]}`}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
