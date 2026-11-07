/**
 * The v3.1 page's behaviour (owner, 4 Nov 2026), ported from the design file's
 * inline script: word reveals, the page tone following the section in view,
 * smooth scroll, the room built by scrolling "How it works", the logo fold,
 * the showroom, the estimator on the real price bands, the benefits tabs, the
 * FAQ circle, the hero slides and the custom cursor.
 *
 * Differences from the design file, on purpose:
 *  - everything is scoped to the page's root element, never document.body,
 *    so leaving the page leaves nothing behind;
 *  - every loop, timer, observer and listener stops in the returned cleanup;
 *  - words come from the page's language, the price bands from the product.
 */

import Lenis from 'lenis';

export interface LandingTier {
  name: string;
  from: number;
  to: number | null;
  promise: string;
  mats: string[];
}

export interface LandingData {
  words: Record<
    | 'stepOf' | 'unlit' | 'from' | 'sqft' | 'copied' | 'copyEmail' | 'selectEmail'
    | 'faqFound' | 'faqNone' | 'faqCopied' | 'faqSend' | 'sampleUntilLaunch',
    string
  >;
  showroom: { cat: string; meta: string; name: string; desc: string; loc: string; area: string; finish: string; cost: string; studio: string }[];
  homes: Record<number, string>;
  tiers: { E: LandingTier; P: LandingTier; L: LandingTier };
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));

export function startLanding(root: HTMLElement, data: LandingData): () => void {
  const W = data.words;
  let alive = true;
  const ac = new AbortController();
  const on = <K extends keyof WindowEventMap>(t: Window | Document | Element, ev: K | string, fn: (e: never) => void, opts: AddEventListenerOptions = {}) =>
    t.addEventListener(ev, fn as EventListener, { ...opts, signal: ac.signal });
  const observers: { disconnect(): void }[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const every = (fn: () => void, ms: number) => {
    const id = setInterval(() => alive && fn(), ms);
    intervals.add(id);
    return id;
  };
  const stopEvery = (id: ReturnType<typeof setInterval> | null | 0) => {
    if (id) {
      clearInterval(id);
      intervals.delete(id);
    }
  };
  const io = (cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) => {
    const o = new IntersectionObserver(cb, opts);
    observers.push(o);
    return o;
  };
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];
  const byId = <T extends Element = HTMLElement>(id: string) => root.querySelector<T>('#' + id);

  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const vh = () => window.innerHeight;

  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

  /* ---- Split headings into masked words ---- */
  $$('[data-split]').forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    el.setAttribute('aria-label', text);
    el.innerHTML = text
      .split(/\s+/)
      .map((w, i) => `<span class="w" aria-hidden="true"><span class="wi" style="--i:${i}">${esc(w)}</span></span>`)
      .join(' ');
  });

  /* ---- Reveal on scroll, and count-ups ---- */
  function countUp(scope: Element) {
    if (reduce) return;
    const nums = scope.matches('[data-count]') ? [scope as HTMLElement] : [...scope.querySelectorAll<HTMLElement>('[data-count]')];
    nums.forEach((n) => {
      if (n.dataset.counted) return;
      n.dataset.counted = '1';
      const end = +(n.dataset.count ?? 0), comma = n.dataset.format === 'comma', t0 = performance.now(), dur = 1400;
      const step = (t: number) => {
        if (!alive) return;
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4), v = Math.round(end * e);
        n.textContent = comma ? v.toLocaleString('en-IN') : String(v);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  const revealEls = $$('[data-split],[data-reveal]');
  const autoEls = revealEls.filter((el) => el.hasAttribute('data-auto'));
  requestAnimationFrame(() => later(() => autoEls.forEach((el) => el.classList.add('is-in')), 120));
  const revealIO = io(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          countUp(e.target);
          revealIO.unobserve(e.target);
        }
      }),
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  );
  revealEls.filter((el) => !el.hasAttribute('data-auto')).forEach((el) => revealIO.observe(el));

  /* ---- Page tone follows the section in the middle of the screen ---- */
  const toneIO = io(
    (entries) => entries.forEach((e) => e.isIntersecting && (root.dataset.tone = (e.target as HTMLElement).dataset.tone)),
    { rootMargin: '-50% 0px -50% 0px' },
  );
  $$('section[data-tone]').forEach((s) => toneIO.observe(s));

  /* ---- Smooth scrolling ---- */
  const lenis = reduce ? null : new Lenis({ duration: 1.1, easing: (t: number) => 1 - Math.pow(1 - t, 3.2), smoothWheel: true });
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    on(a, 'click', (ev: MouseEvent) => {
      const id = a.getAttribute('href')!;
      const target = id === '#top' ? 0 : root.querySelector<HTMLElement>(id);
      if (target === null) return;
      ev.preventDefault();
      if (lenis) lenis.scrollTo(target === 0 ? 0 : target, { offset: id === '#top' ? 0 : -70 });
      else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }),
  );

  /* ---- Room sequence, scrubbed by scroll through "How it works" ---- */
  const FRAMES = 33;
  const how = byId('how');
  const stepsList = $('.steps');
  const steps = $$('.step');
  const scenes = $$('.sc');
  const canvas = $<HTMLCanvasElement>('.room-canvas');
  const ctx = canvas?.getContext('2d') ?? null;
  const poster = $('.room-poster');
  const bar = $('.progress i'), stepLbl = $('.room-step'), stateLbl = $('.room-state');
  const imgs: HTMLImageElement[] = new Array(FRAMES);
  let loaded = false, current = -1, wantFrame = 0;
  function loadFrames() {
    if (loaded) return;
    loaded = true;
    for (let i = 0; i < FRAMES; i++) {
      const im = new Image();
      im.decoding = 'async';
      im.src = `/landing/seq/f${String(i).padStart(2, '0')}.webp`;
      im.onload = () => alive && i === wantFrame && draw(i, true);
      imgs[i] = im;
    }
  }
  if (how) io((es) => es[0]?.isIntersecting && loadFrames(), { rootMargin: '150% 0px' }).observe(how);
  function sizeCanvas() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * d);
    canvas.height = Math.round(r.height * d);
    current = -1;
  }
  function draw(i: number, force = false) {
    const im = imgs[i];
    if (!canvas || !ctx || !im || !im.complete || !im.naturalWidth) return;
    if (i === current && !force) return;
    current = i;
    const cw = canvas.width, ch = canvas.height, s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    if (poster) poster.style.visibility = 'hidden';
  }
  sizeCanvas();
  on(window, 'resize', sizeCanvas);
  let activeStep = 0;
  function updateHow() {
    if (!stepsList || steps.length === 0) return;
    const r = stepsList.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (vh() * 0.55 - r.top) / (r.height - vh() * 0.1)));
    wantFrame = Math.round(p * (FRAMES - 1));
    draw(wantFrame);
    if (bar) bar.style.transform = `scaleX(${p})`;
    // In one column the room pins over the top half of the screen, so a step
    // takes over lower down, while its heading is still in view under the room.
    const mid = vh() * (window.innerWidth <= 960 ? 0.8 : 0.55);
    let best = 0, bestD = Infinity;
    steps.forEach((s, i) => {
      const b = s.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (stepLbl && (best !== activeStep || stepLbl.textContent === '')) {
      steps[activeStep]!.classList.remove('active');
      steps[best]!.classList.add('active');
      scenes[activeStep]?.classList.remove('on');
      scenes[best]?.classList.add('on');
      activeStep = best;
      stepLbl.textContent = fill(W.stepOf, { n: best + 1 });
    }
    if (stateLbl) stateLbl.textContent = p < 0.04 ? W.unlit : steps[activeStep]!.dataset.state ?? '';
  }

  /* ---- Logo folds into its O ---- */
  const logoEl = $('.logo');
  let compact = false;
  function updateLogo() {
    if (!logoEl) return;
    const f = Math.min(1, Math.max(0, (window.scrollY || 0) / 280));
    logoEl.style.setProperty('--f', f.toFixed(3));
    const c = f >= 1;
    if (c !== compact) {
      compact = c;
      logoEl.classList.toggle('compact', c);
      root.classList.toggle('logo-in', c);
    }
    const heroEl = $('.hero');
    if (heroEl) root.classList.toggle('past-hero', heroEl.getBoundingClientRect().bottom < 120);
  }

  /* ---- Hero parallax ---- */
  const para = $('[data-parallax]');
  function updateParallax() {
    if (reduce || !para) return;
    const y = window.scrollY;
    if (y > vh() * 1.2) return;
    para.style.transform = `translate3d(0, ${y * +(para.dataset.parallax ?? 0)}px, 0)`;
  }

  /* ---- One frame loop for everything scroll-linked ---- */
  let lastY = -1;
  function frame(t: number) {
    if (!alive) return;
    lenis?.raf(t);
    const y = window.scrollY;
    if (y !== lastY) {
      lastY = y;
      updateParallax();
      updateHow();
      updateLogo();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  on(window, 'resize', () => (lastY = -1));

  /* ---- Portfolio filters ---- */
  const pfBtns = $$('[data-filter]'), pfCards = $$('.pf-card');
  pfBtns.forEach((b) =>
    on(b, 'click', () => {
      const f = b.dataset.filter;
      pfBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      pfCards.forEach((c) => {
        const show = f === 'all' || c.dataset.cat === f;
        c.hidden = !show;
        if (show) {
          c.classList.add('is-in');
          c.classList.remove('pop');
          void c.offsetWidth;
          if (!reduce) c.classList.add('pop');
        }
      });
    }),
  );

  /* ---- Closing call to action: fit the scene, play it once ---- */
  const ctaStage = byId('cta-stage');
  if (ctaStage) {
    const svgs = ctaStage.querySelectorAll('.cta-svg');
    const fit = () => {
      const Wd = ctaStage.clientWidth, H = ctaStage.clientHeight;
      const vb = Wd < 720 ? [430, 0, 540, 664] : [200, 0, 1000, 664];
      svgs.forEach((v) => v.setAttribute('viewBox', vb.join(' ')));
      const k = Math.min(Wd / vb[2]!, H / vb[3]!);
      ctaStage.style.setProperty('--k', String(k));
      ctaStage.style.setProperty('--ox', String(vb[0]! - (Wd / k - vb[2]!) / 2));
      ctaStage.style.setProperty('--oy', String(vb[1]! - (H / k - vb[3]!)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(ctaStage);
    observers.push(ro);
    const finish = () => ctaStage.classList.add('done');
    if (reduce) finish();
    else {
      const ctaIO = io(
        (es) => {
          if (es[0]?.isIntersecting) {
            ctaIO.disconnect();
            ctaStage.classList.add('play');
            later(finish, 6400);
          }
        },
        { threshold: 0.5 },
      );
      ctaIO.observe(ctaStage);
    }
  }

  /* ---- Home showroom ---- */
  const sh = byId('showroom');
  if (sh) {
    const SH = data.showroom;
    const shImgs = [...sh.querySelectorAll<HTMLElement>('.sh-photo img')], thumbs = [...sh.querySelectorAll<HTMLElement>('.sh-thumb')], info = sh.querySelector('.sh-info');
    const set = (id: string, v: string) => { const el = byId(id); if (el) el.textContent = v; };
    let cur = 0, timer: ReturnType<typeof setTimeout> | null = null, auto = !reduce;
    const show = (i: number) => {
      if (i === cur) return;
      cur = i;
      const h = SH[i]!;
      shImgs.forEach((im, k) => im.classList.toggle('on', k === i));
      thumbs.forEach((t, k) => { t.setAttribute('aria-pressed', String(k === i)); t.classList.remove('play'); });
      info?.classList.add('swap');
      later(() => {
        set('sh-style', h.cat); set('sh-cost', h.cost); set('sh-meta', h.meta + ' · ' + h.loc); set('sh-name', h.name);
        set('sh-desc', h.desc); set('sh-area', h.area); set('sh-finish', h.finish); set('sh-studio', h.studio);
        info?.classList.remove('swap');
      }, reduce ? 0 : 220);
      if (auto) { void thumbs[i]!.offsetWidth; thumbs[i]!.classList.add('play'); }
    };
    const tick = () => { timer = later(() => { show((cur + 1) % SH.length); tick(); }, 5000); };
    const halt = () => { if (timer) clearTimeout(timer); };
    const stop = () => { auto = false; halt(); thumbs.forEach((t) => t.classList.remove('play')); };
    thumbs.forEach((t, k) => on(t, 'click', () => { stop(); show(k); }));
    if (auto) {
      let started = false;
      io(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting && auto && !started) { started = true; thumbs[0]?.classList.add('play'); tick(); }
            else if (!e.isIntersecting && started && auto) { halt(); thumbs.forEach((t) => t.classList.remove('play')); started = false; }
          }),
        { threshold: 0.35 },
      ).observe(sh);
    }
    on(sh, 'pointerenter', () => { if (auto) { halt(); thumbs.forEach((t) => t.classList.remove('play')); } });
    on(sh, 'pointerleave', () => { if (auto) { thumbs[cur]?.classList.add('play'); tick(); } });
  }

  /* ---- Expert map ---- */
  const amMap = byId('am-map');
  if (amMap) {
    if (reduce) amMap.classList.add('run');
    else { const amIO = io((es) => { if (es[0]?.isIntersecting) { amMap.classList.add('run'); amIO.disconnect(); } }, { threshold: 0.3 }); amIO.observe(amMap); }
    const pins = [...amMap.querySelectorAll('.am-pin')];
    amMap.querySelectorAll<HTMLElement>('.am-stop').forEach((c) => {
      on(c, 'pointerenter', () => pins[+(c.dataset.i ?? -1)]?.classList.add('hl'));
      on(c, 'pointerleave', () => pins[+(c.dataset.i ?? -1)]?.classList.remove('hl'));
    });
  }

  /* ---- The fifteen checks tick in ---- */
  const ckList = byId('ck-list');
  if (ckList) {
    if (reduce) ckList.classList.add('run');
    else { const ckIO = io((es) => { if (es[0]?.isIntersecting) { ckList.classList.add('run'); ckIO.disconnect(); } }, { threshold: 0.2 }); ckIO.observe(ckList); }
  }

  /* ---- Two studios, one tap ---- */
  const qBtns = $$('.qtog button');
  qBtns.forEach((b) =>
    on(b, 'click', () => {
      const k = b.dataset.q ?? 'a';
      qBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $$('.quote [data-a]').forEach((el) => (el.textContent = el.dataset[k] ?? el.textContent));
      const sum = byId('q-sum');
      if (sum) sum.innerHTML = k === 'a' ? '₹18.4<small>L</small>' : '₹17.15<small>L</small>';
    }),
  );

  /* ---- Price estimator on the real bands (before GST) ---- */
  const TIERS = data.tiers;
  const est = { home: 850, sqft: 850, tier: 'P' as keyof typeof TIERS };
  let shown = [TIERS.P.from * 850, (TIERS.P.to ?? TIERS.P.from) * 850];
  let estRaf: number | null = null;
  const sq = byId<HTMLInputElement>('sqft'), sqOut = byId('sqft-out');
  const lakh = (r: number) => { const l = r / 100000; return '₹' + (l >= 100 ? (l / 100).toFixed(2) + ' Cr' : (l >= 10 ? l.toFixed(1) : l.toFixed(2)) + ' L'); };
  const sqftText = (n: number) => fill(W.sqft, { n: n.toLocaleString('en-IN') });
  function renderEst() {
    const t = TIERS[est.tier], lo = t.from * est.sqft, hi = t.to ? t.to * est.sqft : null;
    const lbl = byId('res-lbl'), prom = byId('res-promise'), list = byId('res-list'), big = byId('res-big');
    if (lbl) lbl.textContent = (data.homes[est.home] ?? '') + ' · ' + sqftText(est.sqft) + ' · ' + t.name;
    if (prom) prom.textContent = t.promise;
    if (list) list.innerHTML = t.mats.map((m) => '<li>' + esc(m) + '</li>').join('');
    if (!big) return;
    const a = shown.slice(), b = [lo, hi ?? lo];
    const paint = (x: number, y: number) => { big.textContent = hi ? lakh(x) + ' – ' + lakh(y) : fill(W.from, { x: lakh(x) }); };
    if (estRaf) cancelAnimationFrame(estRaf);
    if (reduce) { shown = b; paint(lo, hi ?? lo); return; }
    let t0: number | null = null;
    const f = (ts: number) => {
      if (!alive) return;
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / 550), e = 1 - Math.pow(1 - p, 3);
      shown = [a[0]! + (b[0]! - a[0]!) * e, a[1]! + (b[1]! - a[1]!) * e];
      paint(shown[0]!, shown[1]!);
      if (p < 1) estRaf = requestAnimationFrame(f);
    };
    estRaf = requestAnimationFrame(f);
  }
  const seg = (id: string, fn: (b: HTMLElement) => void) => {
    const bs = $$(`#${id} button`);
    bs.forEach((b) => on(b, 'click', () => { bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); fn(b); }));
  };
  seg('home-seg', (b) => {
    est.home = +(b.dataset.home ?? 850);
    est.sqft = est.home;
    if (sq) sq.value = String(est.sqft);
    if (sqOut) sqOut.textContent = sqftText(est.sqft);
    renderEst();
  });
  seg('tier-seg', (b) => { est.tier = (b.dataset.tier as keyof typeof TIERS) ?? 'P'; renderEst(); });
  if (sq) on(sq, 'input', () => { est.sqft = +sq.value; if (sqOut) sqOut.textContent = sqftText(est.sqft); renderEst(); });
  renderEst();

  /* ---- Nothing stays hidden if a reveal never fires ---- */
  later(() => $$('[data-split],[data-reveal]').forEach((el) => el.classList.add('is-in')), 2500);

  /* ---- Custom cursor + magnetic buttons (mouse and trackpad only) ---- */
  if (fine) {
    root.classList.add('has-cursor');
    const cur = $('.cursor');
    let mx = -100, my = -100, cx = -100, cy = -100;
    if (cur) {
      on(window, 'pointermove', (e: PointerEvent) => { mx = e.clientX; my = e.clientY; cur.classList.add('on'); }, { passive: true });
      on(document, 'pointerleave', () => cur.classList.remove('on'));
      on(window, 'pointerdown', () => cur.classList.add('down'));
      on(window, 'pointerup', () => cur.classList.remove('down'));
      const loop = () => {
        if (!alive) return;
        const k = reduce ? 1 : 0.2;
        cx += (mx - cx) * k;
        cy += (my - cy) * k;
        cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        requestAnimationFrame(loop);
      };
      loop();
      $$('[data-cursor-label]').forEach((el) => { on(el, 'pointerenter', () => cur.classList.add('view')); on(el, 'pointerleave', () => cur.classList.remove('view')); });
      $$('[data-hover], a:not([data-cursor-label]), button').forEach((el) => { on(el, 'pointerenter', () => cur.classList.add('grow')); on(el, 'pointerleave', () => cur.classList.remove('grow')); });
    }
    if (!reduce)
      $$('[data-magnetic]').forEach((el) => {
        const inner = el.querySelector<HTMLElement>('.mag-inner');
        on(el, 'pointermove', (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
          el.style.transform = `translate3d(${x * 0.28}px, ${y * 0.36}px, 0) scale(1.03)`;
          if (inner) inner.style.transform = `translate3d(${x * 0.12}px, ${y * 0.14}px, 0)`;
        });
        on(el, 'pointerleave', () => { el.style.transform = ''; if (inner) inner.style.transform = ''; });
      });
  }

  /* ---- Benefits extras: animate each card in; count the cashback up ---- */
  const cards = $$('[data-bx]');
  if (cards.length) {
    const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
    const count = (el: HTMLElement) => {
      const to = +(el.dataset.cash ?? 0), t0 = performance.now(), dur = 1400;
      const step = (t: number) => {
        if (!alive) return;
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(Math.round((to * e) / 500) * 500);
        if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
      };
      requestAnimationFrame(step);
    };
    if (reduce) cards.forEach((c) => c.classList.add('live'));
    else {
      const bxIO = io((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('live');
        const n = e.target.querySelector<HTMLElement>('[data-cash]');
        if (n) count(n);
        bxIO.unobserve(e.target);
      }), { threshold: 0.4 });
      cards.forEach((c) => bxIO.observe(c));
    }
  }

  /* ---- Benefits: one part at a time, chosen on the journey bar ---- */
  const bj = $('.bj');
  if (bj) {
    const tabs = [...bj.querySelectorAll<HTMLElement>('.bj-seg')];
    const panels: Record<string, HTMLElement | null> = { 1: byId('bn-p1'), 2: byId('bn-p2') };
    const show = (n: string, scroll = false) => {
      bj.dataset.on = n;
      tabs.forEach((t) => t.setAttribute('aria-selected', t.dataset.p === n ? 'true' : 'false'));
      for (const k in panels) {
        const p = panels[k];
        if (!p) continue;
        const onP = k === n;
        p.hidden = !onP;
        p.classList.toggle('show', onP);
        if (onP) p.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in'));
      }
      if (scroll) bj.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };
    tabs.forEach((t) => on(t, 'click', () => show(t.dataset.p ?? '1')));
    tabs.forEach((t, i) => on(t, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const o = tabs[(i + 1) % 2]!; o.focus(); show(o.dataset.p ?? '1'); }
    }));
    $$('.bn-next').forEach((b) => on(b, 'click', () => show(b.dataset.go ?? '2', true)));
    show('1');
    const bjIO = io((es) => { if (es[0]?.isIntersecting) { bj.classList.add('run'); bjIO.disconnect(); } }, { threshold: 0.5 });
    bjIO.observe(bj);
  }

  /* ---- Footer: copy the email address ---- */
  $$('.f-copy').forEach((b) => on(b, 'click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy ?? ''); b.textContent = W.copied; } catch { b.textContent = W.selectEmail; }
    later(() => (b.textContent = W.copyEmail), 2200);
  }));

  /* ---- FAQ circle ---- */
  const qo = $('.qo');
  if (qo) {
    const qs = [...qo.querySelectorAll<HTMLElement>('.qo-q')], core = qo.querySelector('.qo-core');
    const num = byId('qo-num'), qt = byId('qo-qt'), at = byId('qo-at');
    const ptr = qo.querySelector<HTMLElement>('.qo-ptr');
    let cur = 0;
    let auto: ReturnType<typeof setInterval> | null | 0 = null;
    const pick = (i: number, user = false) => {
      cur = (i + qs.length) % qs.length;
      qs.forEach((b, k) => b.setAttribute('aria-pressed', k === cur ? 'true' : 'false'));
      if (num) num.textContent = String(cur + 1).padStart(2, '0');
      if (qt) qt.textContent = qs[cur]!.childNodes[1]?.textContent ?? '';
      if (at) at.textContent = qs[cur]!.dataset.a ?? '';
      core?.classList.remove('swap');
      void (core as HTMLElement | null)?.offsetWidth;
      core?.classList.add('swap');
      if (ptr) ptr.style.background = `conic-gradient(from ${cur * 45 - 22}deg, rgba(193,88,46,0), rgba(193,88,46,.9) 22deg, rgba(193,88,46,0) 44deg)`;
      if (user && auto) { stopEvery(auto); auto = null; }
    };
    qs.forEach((b, i) => on(b, 'click', () => pick(i, true)));
    qo.querySelectorAll<HTMLElement>('.qo-step').forEach((b) => on(b, 'click', () => pick(cur + +(b.dataset.d ?? 1), true)));
    pick(0);
    if (!reduce) {
      io((es) => {
        if (es[0]?.isIntersecting && auto === null) auto = every(() => pick(cur + 1), 6000);
        else if (!es[0]?.isIntersecting && auto) { stopEvery(auto); auto = 0; }
      }, { threshold: 0.4 }).observe(qo);
    }
    const inp = byId<HTMLInputElement>('qo-in'), hint = byId('qo-hint'), send = byId('qo-send');
    if (inp && hint && send) {
      const base = hint.innerHTML;
      // Any script's words count, so Hindi and Marathi questions match too.
      const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length > 3);
      on(inp, 'input', () => {
        const w = words(inp.value);
        let first = -1;
        if (auto) { stopEvery(auto); auto = 0; }
        qs.forEach((b, i) => {
          const txt = (b.textContent + ' ' + (b.dataset.a ?? '')).toLowerCase();
          const hit = w.length > 0 && w.some((x) => txt.includes(x));
          b.classList.toggle('hit', hit);
          if (hit && first < 0) first = i;
        });
        qo.classList.toggle('dim', w.length > 0);
        if (!w.length) { hint.innerHTML = base; return; }
        if (first >= 0) { pick(first, true); hint.innerHTML = W.faqFound; }
        else hint.innerHTML = W.faqNone;
      });
      on(send, 'click', async () => {
        const q = inp.value.trim();
        if (!q) { inp.focus(); return; }
        try { await navigator.clipboard.writeText(q); hint.innerHTML = W.faqCopied; } catch { hint.innerHTML = W.faqSend; }
      });
    }
  }

  /* ---- Hero: rotate the background photos ---- */
  const box = $('.hs-slides');
  if (box) {
    const dots = $('.hs-dots'), cap = $('.hs-cap'), nm = byId('hs-name'), mt = byId('hs-meta');
    let i = 0, vis = true;
    let t: ReturnType<typeof setInterval> | null = null;
    const list = () => [...box.querySelectorAll<HTMLImageElement>('img')].filter((im) => !(im.complete && im.naturalWidth === 0));
    const drawDots = () => { if (dots) dots.innerHTML = list().map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join(''); };
    const show = (k: number) => {
      const L = list();
      if (!L.length) return;
      i = (k + L.length) % L.length;
      L.forEach((im, n) => im.classList.toggle('on', n === i));
      if (nm) nm.innerHTML = L[i]!.dataset.name ?? '';
      if (mt) mt.textContent = L[i]!.dataset.meta || W.sampleUntilLaunch;
      cap?.classList.remove('swap');
      void (cap as HTMLElement | null)?.offsetWidth;
      cap?.classList.add('swap');
      drawDots();
    };
    const run = () => { stopEvery(t); t = null; if (!reduce && vis) t = every(() => show(i + 1), 5000); };
    if (box.parentElement) io((es) => { vis = !!es[0]?.isIntersecting; run(); }, { threshold: 0.2 }).observe(box.parentElement);
    show(0);
    run();
  }

  return () => {
    alive = false;
    ac.abort();
    observers.forEach((o) => o.disconnect());
    timers.forEach((id) => clearTimeout(id));
    intervals.forEach((id) => clearInterval(id));
    if (estRaf) cancelAnimationFrame(estRaf);
    lenis?.destroy();
    root.classList.remove('js', 'has-cursor', 'logo-in', 'past-hero');
  };
}
