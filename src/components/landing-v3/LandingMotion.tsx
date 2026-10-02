'use client';

/**
 * Everything on the home page that moves (the owner's v3 layout, 30 Sep 2026):
 * smooth scrolling, masked word reveals, the page ground following the
 * section in view, the room that lights up as "How it works" is scrolled,
 * the logo folding into its mark, hero parallax, count-ups, the style
 * gallery's filters, and — on a mouse or trackpad only — the custom cursor
 * and magnetic buttons.
 *
 * The page is complete without it: every section is server-rendered, and
 * this only adds motion. `prefers-reduced-motion` turns the motion off
 * (smooth scroll, parallax, count-ups, the cursor's lag, magnetism); the
 * reveals then show at once (landing-v3.css).
 */

import { useEffect } from 'react';

const FRAMES = 33;
const frameUrl = (i: number) => `/landing/seq/f${String(i).padStart(2, '0')}.webp`;

export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.lv3');
    if (!root) return;
    root.classList.add('js');
    const cleanups: (() => void)[] = [];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const vh = () => window.innerHeight;

    // ── Reveal on scroll ──
    const revealEls = [...root.querySelectorAll<HTMLElement>('[data-split],[data-reveal]')];
    const autoEls = revealEls.filter((el) => el.hasAttribute('data-auto'));
    const autoTimer = window.setTimeout(() => autoEls.forEach((el) => el.classList.add('is-in')), 120);
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
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );
    revealEls.filter((el) => !el.hasAttribute('data-auto')).forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    function countUp(scope: HTMLElement) {
      if (reduce) return;
      const nums = scope.matches('[data-count]') ? [scope] : [...scope.querySelectorAll<HTMLElement>('[data-count]')];
      for (const n of nums) {
        if (n.dataset.counted) continue;
        n.dataset.counted = '1';
        const end = Number(n.dataset.count);
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / 1400);
          n.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 4))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }

    // ── The page ground follows the section in the middle of the screen ──
    const toneIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) root.dataset.tone = (e.target as HTMLElement).dataset.tone;
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    root.querySelectorAll('section[data-tone]').forEach((s) => toneIO.observe(s));
    cleanups.push(() => toneIO.disconnect());

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
      if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -70 });
      else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    };
    root.addEventListener('click', onAnchor);
    cleanups.push(() => root.removeEventListener('click', onAnchor));

    // ── The room, scrubbed by scroll through "How it works" ──
    const how = root.querySelector<HTMLElement>('#how');
    const stepsList = root.querySelector<HTMLElement>('.steps');
    const steps = [...root.querySelectorAll<HTMLElement>('.step')];
    const canvas = root.querySelector<HTMLCanvasElement>('.room-canvas');
    const ctx = canvas?.getContext('2d') ?? null;
    const poster = root.querySelector<HTMLElement>('.room-poster');
    const bar = root.querySelector<HTMLElement>('.progress i');
    const stepLbl = root.querySelector<HTMLElement>('.room-step');
    const stateLbl = root.querySelector<HTMLElement>('.room-state');
    const imgs: HTMLImageElement[] = [];
    let loaded = false;
    let current = -1;
    let wantFrame = 0;
    let activeStep = 0;
    function draw(i: number, force = false) {
      const im = imgs[i];
      if (!canvas || !ctx || !im || !im.complete || !im.naturalWidth) return;
      if (i === current && !force) return;
      current = i;
      const cw = canvas.width;
      const ch = canvas.height;
      const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
      const w = im.naturalWidth * s;
      const h = im.naturalHeight * s;
      ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
      if (poster) poster.style.visibility = 'hidden';
    }
    function loadFrames() {
      if (loaded) return;
      loaded = true;
      for (let i = 0; i < FRAMES; i++) {
        const im = new Image();
        im.decoding = 'async';
        im.src = frameUrl(i);
        im.onload = () => {
          if (i === wantFrame) draw(i, true);
        };
        imgs[i] = im;
      }
    }
    function sizeCanvas() {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * d);
      canvas.height = Math.round(r.height * d);
      current = -1;
      draw(wantFrame, true);
    }
    if (how) {
      const lazy = new IntersectionObserver((es) => es[0]?.isIntersecting && loadFrames(), { rootMargin: '150% 0px' });
      lazy.observe(how);
      cleanups.push(() => lazy.disconnect());
    }
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    cleanups.push(() => window.removeEventListener('resize', sizeCanvas));
    function updateHow() {
      if (!stepsList || steps.length === 0) return;
      const r = stepsList.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh() * 0.55 - r.top) / (r.height - vh() * 0.1)));
      wantFrame = Math.round(p * (FRAMES - 1));
      draw(wantFrame);
      if (bar) bar.style.transform = `scaleX(${p})`;
      const mid = vh() * 0.55;
      let best = 0;
      let bestD = Infinity;
      steps.forEach((s, i) => {
        const b = s.getBoundingClientRect();
        const d = Math.abs(b.top + b.height / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best !== activeStep) {
        steps[activeStep]?.classList.remove('active');
        steps[best]?.classList.add('active');
        activeStep = best;
      }
      if (stepLbl) stepLbl.textContent = `Step ${activeStep + 1} of ${steps.length}`;
      if (stateLbl) stateLbl.textContent = p < 0.04 ? 'Unlit' : (steps[activeStep]?.dataset.state ?? '');
    }

    // ── The logo folds into its mark between "How it works" and "Start here" ──
    const logoEl = root.querySelector<HTMLElement>('.logo');
    const startSec = root.querySelector<HTMLElement>('#start');
    let compact = false;
    let backed = false;
    const lv3: HTMLElement = root; // narrowed, for the function below
    function updateLogo() {
      // Past the hero the nav gets a frosted bar; without it its links sit
      // straight on top of the headings they scroll over.
      const b = window.scrollY > vh() * 0.6;
      if (b !== backed) {
        backed = b;
        if (b) lv3.dataset.scrolled = '1';
        else delete lv3.dataset.scrolled;
      }
      if (!how || !startSec || !logoEl) return;
      const c = how.getBoundingClientRect().top <= 90 && startSec.getBoundingClientRect().top > vh() * 0.55;
      if (c !== compact) {
        compact = c;
        logoEl.classList.toggle('compact', c);
      }
    }

    // ── Hero parallax ──
    const para = root.querySelector<HTMLElement>('[data-parallax]');
    function updateParallax() {
      if (reduce || !para) return;
      const y = window.scrollY;
      if (y > vh() * 1.2) return;
      para.style.transform = `translate3d(0, ${y * Number(para.dataset.parallax)}px, 0)`;
    }

    // ── One frame loop for everything scroll-linked ──
    let lastY = -1;
    let raf = 0;
    const frame = (t: number) => {
      lenis?.raf(t);
      const y = window.scrollY;
      if (y !== lastY) {
        lastY = y;
        updateParallax();
        updateHow();
        updateLogo();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => {
      lastY = -1;
    };
    window.addEventListener('resize', onResize);
    cleanups.push(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    });

    // ── Style gallery filters ──
    const pfBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
    const pfCards = [...root.querySelectorAll<HTMLElement>('.pf-card')];
    const onFilter = (b: HTMLButtonElement) => () => {
      const f = b.dataset.filter;
      pfBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      for (const c of pfCards) {
        const show = f === 'all' || c.dataset.cat === f;
        c.hidden = !show;
        if (show) {
          c.classList.add('is-in');
          c.classList.remove('pop');
          void c.offsetWidth;
          if (!reduce) c.classList.add('pop');
        }
      }
    };
    for (const b of pfBtns) {
      const h = onFilter(b);
      b.addEventListener('click', h);
      cleanups.push(() => b.removeEventListener('click', h));
    }

    // ── Custom cursor + magnetic buttons (mouse and trackpad only) ──
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
      const onDown = () => cur.classList.add('down');
      const onUp = () => cur.classList.remove('down');
      window.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerleave', onLeave);
      window.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      let craf = 0;
      const loop = () => {
        const k = reduce ? 1 : 0.2;
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
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
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
      root.querySelectorAll('[data-hover], a:not([data-cursor-label]), button, summary').forEach((el) => hover(el, 'grow'));

      if (!reduce) {
        root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
          const inner = el.querySelector<HTMLElement>('.mag-inner');
          const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            const x = e.clientX - (r.left + r.width / 2);
            const y = e.clientY - (r.top + r.height / 2);
            el.style.transform = `translate3d(${x * 0.28}px, ${y * 0.36}px, 0) scale(1.03)`;
            if (inner) inner.style.transform = `translate3d(${x * 0.12}px, ${y * 0.14}px, 0)`;
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
