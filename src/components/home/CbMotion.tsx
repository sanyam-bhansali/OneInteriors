'use client';

/**
 * Everything on the home page that moves: smooth scrolling, words rising into
 * place, count-ups, the frosted nav once the hero has gone, the collage's
 * drift, the style gallery's filters, and — on a mouse or trackpad only — the
 * cursor dot and the magnetic pills.
 *
 * The page is complete without it: every section is server-rendered and this
 * only adds motion. `prefers-reduced-motion` turns the motion off and the
 * reveals show at once (home-cb.css).
 *
 * The stacking "How it works" cards are pure CSS (`position: sticky`), so
 * they stack with or without this file.
 */

import { useEffect } from 'react';

export function CbMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.cb');
    if (!root) return;
    root.classList.add('js');
    const cleanups: (() => void)[] = [];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

    // ── Reveal on scroll ──
    const revealEls = [...root.querySelectorAll<HTMLElement>('[data-split],[data-reveal]')];
    const autoEls = revealEls.filter((el) => el.hasAttribute('data-auto'));
    const autoTimer = window.setTimeout(() => autoEls.forEach((el) => el.classList.add('is-in')), 80);
    cleanups.push(() => window.clearTimeout(autoTimer));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          countUp(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    );
    revealEls.filter((el) => !el.hasAttribute('data-auto')).forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    function countUp(scope: HTMLElement) {
      if (reduce) return;
      const nums = [...(scope.matches('[data-count]') ? [scope] : []), ...scope.querySelectorAll<HTMLElement>('[data-count]')];
      for (const n of nums) {
        if (n.dataset.counted) continue;
        n.dataset.counted = '1';
        const end = Number(n.dataset.count);
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / 1300);
          n.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 4))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }

    // ── Smooth scrolling ──
    let lenis: { raf: (t: number) => void; scrollTo: (t: HTMLElement | number, o?: object) => void; destroy: () => void } | null = null;
    let alive = true;
    if (!reduce) {
      import('lenis').then(({ default: Lenis }) => {
        if (!alive) return;
        lenis = new Lenis({ duration: 1.1, easing: (t: number) => 1 - Math.pow(1 - t, 3.2), smoothWheel: true });
      });
    }
    cleanups.push(() => {
      alive = false;
      lenis?.destroy();
    });
    const onAnchor = (ev: Event) => {
      const a = (ev.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a || !root.contains(a)) return;
      const id = a.getAttribute('href')!;
      const target = id === '#top' ? 0 : document.querySelector<HTMLElement>(id);
      if (target === null) return;
      ev.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -80 });
      else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    };
    root.addEventListener('click', onAnchor);
    cleanups.push(() => root.removeEventListener('click', onAnchor));

    // ── Scroll-linked: the nav's bar and the collage's drift ──
    const para = root.querySelector<HTMLElement>('[data-parallax]');
    let scrolled = false;
    let lastY = -1;
    let raf = 0;
    const frame = (t: number) => {
      lenis?.raf(t);
      const y = window.scrollY;
      if (y !== lastY) {
        lastY = y;
        const s = y > 40;
        if (s !== scrolled) {
          scrolled = s;
          root.toggleAttribute('data-scrolled', s);
        }
        if (para && !reduce && y < window.innerHeight * 1.6) {
          para.style.transform = `translate3d(0, ${y * Number(para.dataset.parallax)}px, 0)`;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    cleanups.push(() => cancelAnimationFrame(raf));

    // ── Style gallery filters ──
    const btns = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
    const cards = [...root.querySelectorAll<HTMLElement>('.g-card')];
    for (const b of btns) {
      const h = () => {
        const f = b.dataset.filter;
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        for (const c of cards) {
          const show = f === 'all' || c.dataset.cat === f;
          c.hidden = !show;
          if (show) c.classList.add('is-in');
        }
      };
      b.addEventListener('click', h);
      cleanups.push(() => b.removeEventListener('click', h));
    }

    // ── Cursor dot + magnetic pills (mouse and trackpad only) ──
    const cur = root.querySelector<HTMLElement>('.cursor');
    if (fine && cur) {
      root.classList.add('has-cursor');
      let mx = -100;
      let my = -100;
      let cx = -100;
      let cy = -100;
      const onMove = (e: PointerEvent) => {
        mx = e.clientX;
        my = e.clientY;
        cur.classList.add('on');
      };
      const onLeave = () => cur.classList.remove('on');
      window.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerleave', onLeave);
      let craf = 0;
      const loop = () => {
        const k = reduce ? 1 : 0.18;
        cx += (mx - cx) * k;
        cy += (my - cy) * k;
        cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        craf = requestAnimationFrame(loop);
      };
      craf = requestAnimationFrame(loop);
      cleanups.push(() => {
        cancelAnimationFrame(craf);
        window.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerleave', onLeave);
        root.classList.remove('has-cursor');
      });

      const hover = (el: Element, cls: string) => {
        const on = () => cur.classList.add(cls);
        const off = () => cur.classList.remove(cls);
        el.addEventListener('pointerenter', on);
        el.addEventListener('pointerleave', off);
        cleanups.push(() => {
          el.removeEventListener('pointerenter', on);
          el.removeEventListener('pointerleave', off);
        });
      };
      root.querySelectorAll('[data-cursor-label]').forEach((el) => hover(el, 'view'));
      root.querySelectorAll('a:not([data-cursor-label]), button, summary').forEach((el) => hover(el, 'grow'));
      root.querySelectorAll('.panel').forEach((el) => hover(el, 'invert'));

      if (!reduce) {
        root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
          const inner = el.querySelector<HTMLElement>('.mag-inner');
          const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            const x = e.clientX - (r.left + r.width / 2);
            const y = e.clientY - (r.top + r.height / 2);
            el.style.transform = `translate3d(${x * 0.22}px, ${y * 0.32}px, 0)`;
            if (inner) inner.style.transform = `translate3d(${x * 0.1}px, ${y * 0.12}px, 0)`;
          };
          const leave = () => {
            el.style.transform = '';
            if (inner) inner.style.transform = '';
          };
          el.addEventListener('pointermove', move);
          el.addEventListener('pointerleave', leave);
          cleanups.push(() => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerleave', leave);
          });
        });
      }
    }

    return () => {
      for (const c of cleanups) c();
      root.classList.remove('js');
    };
  }, []);

  return null;
}
