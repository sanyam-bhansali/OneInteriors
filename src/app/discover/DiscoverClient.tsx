'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container, Eyebrow } from '@/components/ui';
import { useSiteT } from '@/components/app/i18n';
import { DISCOVER_DICT } from '@/modules/i18n/site/discover';
import { DISCOVER_ROOMS, type DiscoverRoom, type Pin } from '@/modules/discover/pins';
import { REVEAL_AT, boards, nextPins, revealStyle, type FeedState } from '@/modules/discover/feed';
import { STYLE_PALETTES } from '@/modules/brief/palettes';
import { TIER, tierRangeFor, type Tier } from '@/modules/quotation/tiers';
import { formatINRCompact } from '@/lib/money';
import { loadBrief as loadLocalBrief, saveBrief as saveLocalBrief } from '@/modules/brief/store';
import { applyDiscoverStyleAction, syncDiscoverSavesAction } from './actions';

/** Saves and skips live on this device until a style is used. */
const STORE_KEY = 'oi.discover.v1';
const FIRST_BATCH = 18;
const BATCH = 12;

function readState(): FeedState {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { saved: [], skipped: [] };
    const v = JSON.parse(raw) as Partial<FeedState>;
    return {
      saved: Array.isArray(v.saved) ? v.saved.filter((x) => typeof x === 'string') : [],
      skipped: Array.isArray(v.skipped) ? v.skipped.filter((x) => typeof x === 'string') : [],
    };
  } catch {
    return { saved: [], skipped: [] };
  }
}

function writeState(s: FeedState) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode: the feed still works for this visit */
  }
}

export function DiscoverClient({
  pins,
  sqft,
  sqftAssumed,
  hasProfile,
  serverSaves,
}: {
  pins: Pin[];
  sqft: number;
  sqftAssumed: boolean;
  hasProfile: boolean;
  /** Saves kept on their Home Profile, from another device or the app. */
  serverSaves: string[];
}) {
  const t = useSiteT(DISCOVER_DICT);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<FeedState>({ saved: [], skipped: [] });
  const [shown, setShown] = useState<string[]>([]);
  const [room, setRoom] = useState<DiscoverRoom | null>(null);
  const [view, setView] = useState<'feed' | 'boards'>('feed');
  const [revealOpen, setRevealOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [pending, startTransition] = useTransition();
  const revealSeen = useRef(false);

  const byId = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);

  const fill = useCallback(
    (current: string[], s: FeedState, r: DiscoverRoom | null, count: number) => {
      const seen = new Set([...current, ...s.saved, ...s.skipped]);
      return [...current, ...nextPins(pins, s, seen, count, r).map((p) => p.id)];
    },
    [pins],
  );

  // Read this device's saves after mount, so the server and first paint agree.
  useEffect(() => {
    const local = readState();
    // Saves from the phone app or another browser join this device's.
    const s = { saved: [...new Set([...serverSaves, ...local.saved])], skipped: local.skipped.filter((x) => !serverSaves.includes(x)) };
    setState(s);
    writeState(s);
    setShown(fill([], s, null, FIRST_BATCH));
    revealSeen.current = s.saved.length >= REVEAL_AT;
    setReady(true);
  }, [fill, serverSaves]);

  // Keep the saves on their Home Profile, a moment after they stop tapping.
  useEffect(() => {
    if (!ready || !hasProfile) return;
    const timer = setTimeout(() => void syncDiscoverSavesAction(state.saved), 1200);
    return () => clearTimeout(timer);
  }, [ready, hasProfile, state.saved]);

  const update = (next: FeedState) => {
    setState(next);
    writeState(next);
  };

  const exhausted = useMemo(() => {
    if (!ready) return false;
    const seen = new Set([...shown, ...state.saved, ...state.skipped]);
    return nextPins(pins, state, seen, 1, room).length === 0;
  }, [ready, shown, state, pins, room]);

  const reveal = useMemo(() => revealStyle(pins, state.saved, exhausted), [pins, state.saved, exhausted]);

  // Open the reveal once, the moment it becomes ready.
  useEffect(() => {
    if (ready && reveal.ready && !revealSeen.current) {
      revealSeen.current = true;
      setRevealOpen(true);
    }
  }, [ready, reveal.ready]);

  const toggleSave = (id: string) => {
    const saved = state.saved.includes(id) ? state.saved.filter((x) => x !== id) : [...state.saved, id];
    update({ saved, skipped: state.skipped.filter((x) => x !== id) });
  };

  const skip = (id: string) => {
    const next = { saved: state.saved.filter((x) => x !== id), skipped: [...state.skipped, id] };
    update(next);
    setShown((cur) => {
      const rest = cur.filter((x) => x !== id);
      return fill(rest, next, room, Math.max(0, cur.length - rest.length));
    });
  };

  const more = () => setShown((cur) => fill(cur, state, room, BATCH));

  const pickRoom = (r: DiscoverRoom | null) => {
    setRoom(r);
    setShown(fill([], state, r, FIRST_BATCH));
  };

  const reset = () => {
    const empty = { saved: [], skipped: [] };
    update(empty);
    revealSeen.current = false;
    setUsed(false);
    setRoom(null);
    setShown(fill([], empty, null, FIRST_BATCH));
  };

  // Load more as the end of the feed comes into view.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !ready || view !== 'feed' || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((cur) => fill(cur, state, room, BATCH));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ready, view, state, room, fill]);

  const rangeText = (tier: Tier): string => {
    const { lowPaise, highPaise } = tierRangeFor(tier, sqft);
    return highPaise === null
      ? t('pin.andUp', { from: formatINRCompact(lowPaise) })
      : `${formatINRCompact(lowPaise)}–${formatINRCompact(highPaise)}`;
  };

  const applyStyle = () => {
    const styles = reveal.shares.map((s) => s.tag);
    if (hasProfile) {
      startTransition(async () => {
        const r = await applyDiscoverStyleAction(styles, reveal.studioIds);
        if (r.saved) setUsed(true);
      });
      return;
    }
    // A new visitor: carry the style into the quiz on this device.
    const local = loadLocalBrief();
    saveLocalBrief({
      ...local,
      styleLikes: styles.filter((s) => !local.styleDislikes.includes(s)).slice(0, 3),
      styleStudioPicks: [...new Set([...reveal.studioIds, ...(local.styleStudioPicks ?? [])])].slice(0, 6),
    });
    router.push('/quiz');
  };

  const myBoards = useMemo(() => boards(pins, state.saved), [pins, state.saved]);
  const lead = reveal.shares[0] ? STYLE_PALETTES[reveal.shares[0].tag] : null;
  const pct = Math.min(100, Math.round((reveal.saves / REVEAL_AT) * 100));

  return (
    <Container size="wide">
      <header className="mb-6 max-w-2xl">
        <Eyebrow>{t('hero.eyebrow')}</Eyebrow>
        <h1 className="m-0 text-[clamp(28px,5vw,44px)] leading-[1.08] tracking-[-0.02em]">{t('hero.title')}</h1>
        <p className="m-0 mt-3 text-[16px] leading-relaxed text-[var(--color-ink-2)]">{t('hero.lede', { n: REVEAL_AT })}</p>
      </header>

      {/* Progress and the two views. Sticky so the count is always in reach. */}
      <div className="sticky top-0 z-20 -mx-5 mb-5 border-b border-[var(--color-rule)] bg-[var(--color-paper)]/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[160px] flex-1">
            <p className="m-0 text-[13px] font-medium" aria-live="polite">
              {reveal.ready ? t('progress.ready') : t('progress.count', { n: reveal.saves, total: REVEAL_AT })}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-rule)]">
              <div className="h-full rounded-full bg-[var(--color-petrol)] transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {reveal.ready ? (
            <button
              type="button"
              onClick={() => setRevealOpen(true)}
              className="rounded-full bg-[var(--color-petrol)] px-4 py-2 text-[14px] font-medium text-[var(--color-paper)]"
            >
              {t('progress.see')}
            </button>
          ) : null}
          <div role="tablist" className="flex rounded-full border border-[var(--color-rule)] p-0.5 text-[13px]">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'feed'}
              onClick={() => setView('feed')}
              className={`rounded-full px-3 py-1.5 ${view === 'feed' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : ''}`}
            >
              {t('hero.eyebrow')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'boards'}
              onClick={() => setView('boards')}
              className={`rounded-full px-3 py-1.5 ${view === 'boards' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : ''}`}
            >
              {t('boards.title')} ({state.saved.length})
            </button>
          </div>
        </div>
      </div>

      {revealOpen && reveal.shares.length > 0 ? (
        <section
          aria-labelledby="reveal-title"
          className="mb-8 rounded-[var(--r-m,16px)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-5 sm:p-7"
        >
          <Eyebrow>{t('reveal.eyebrow')}</Eyebrow>
          <h2 id="reveal-title" className="m-0 text-[clamp(24px,4vw,34px)] leading-tight">
            {reveal.shares.map((s) => s.label).join(' + ')}
          </h2>
          <p className="m-0 mt-2 text-[14px] text-[var(--color-ink-2)]">{t('reveal.lede', { n: reveal.saves })}</p>

          <ul className="m-0 mt-5 grid list-none gap-2 p-0 sm:max-w-md">
            {reveal.shares.map((s) => (
              <li key={s.tag} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[14px]">
                <span>{s.label}</span>
                <span className="tabular-nums text-[var(--color-ink-2)]">{s.pct}%</span>
                <span className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-rule)]">
                  <span className="block h-full rounded-full bg-[var(--color-petrol)]" style={{ width: `${s.pct}%` }} />
                </span>
              </li>
            ))}
          </ul>

          {lead ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="label m-0 mb-2">{t('reveal.colours')}</p>
                <div className="flex gap-1.5">
                  {[lead.wall, lead.floor, lead.furniture, lead.trim, lead.accent].map((c, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className="h-9 w-9 rounded-full border border-[var(--color-rule)]"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="label m-0 mb-2">{t('reveal.materials')}</p>
                <p className="m-0 text-[14px]">{lead.materials.join(', ')}</p>
              </div>
            </div>
          ) : null}

          {reveal.tier ? <p className="m-0 mt-5 text-[14px]">{t('reveal.price', { tier: TIER[reveal.tier].label, range: rangeText(reveal.tier) })}</p> : null}

          <p className="m-0 mt-5 text-[13px] text-[var(--color-ink-2)]">{t('reveal.next')}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {used ? (
              <>
                <p className="m-0 text-[14px] font-medium" role="status">
                  {t('reveal.used')}
                </p>
                <Link
                  href="/match"
                  className="rounded-full bg-[var(--color-petrol)] px-5 py-2.5 text-[14px] font-medium text-[var(--color-paper)] no-underline"
                >
                  {t('reveal.seeMatches')}
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={applyStyle}
                disabled={pending}
                className="rounded-full bg-[var(--color-petrol)] px-5 py-2.5 text-[14px] font-medium text-[var(--color-paper)] disabled:opacity-50"
              >
                {hasProfile ? t('reveal.use') : t('reveal.start')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setRevealOpen(false)}
              className="rounded-full border border-[var(--color-rule)] px-5 py-2.5 text-[14px]"
            >
              {t('reveal.keep')}
            </button>
          </div>
        </section>
      ) : null}

      {view === 'feed' ? (
        <>
          {pins.some((p) => p.tier !== null) ? (
            <p className="m-0 mb-3 text-[12px] text-[var(--color-ink-3)]">
              {t(sqftAssumed ? 'feed.priceNoteTypical' : 'feed.priceNote', { sqft })}
            </p>
          ) : null}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('room.all')}>
            {[null, ...DISCOVER_ROOMS.filter((r) => r !== 'other')].map((r) => (
              <button
                key={r ?? 'all'}
                type="button"
                aria-pressed={room === r}
                onClick={() => pickRoom(r)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] ${
                  room === r
                    ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]'
                    : 'border-[var(--color-rule)]'
                }`}
              >
                {r ? t(`room.${r}`) : t('room.all')}
              </button>
            ))}
          </div>

          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {shown.map((id) => {
              const pin = byId.get(id);
              if (!pin) return null;
              const isSaved = state.saved.includes(id);
              return (
                <article key={id} className="mb-3 break-inside-avoid overflow-hidden rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pin.src} alt={pin.alt} loading="lazy" className="block w-full" />
                    <span
                      className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        pin.kind === 'built' ? 'bg-[var(--color-petrol)] text-[var(--color-paper)]' : 'bg-black/55 text-white'
                      }`}
                    >
                      {pin.kind === 'built' ? t('pin.built') : t('pin.example')}
                    </span>
                    <button
                      type="button"
                      aria-pressed={isSaved}
                      aria-label={isSaved ? t('pin.saved') : t('pin.save')}
                      onClick={() => toggleSave(id)}
                      className={`absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full shadow ${
                        isSaved ? 'bg-[#c1582e] text-white' : 'bg-white/90 text-[#1a1a1a]'
                      }`}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0 text-[12px] leading-snug text-[var(--color-ink-2)]">
                      {pin.tier ? (
                        <>
                          <p className="m-0 text-[13px] font-medium tabular-nums text-[var(--color-ink)]">{rangeText(pin.tier)}</p>
                          <p className="m-0">{TIER[pin.tier].label}</p>
                        </>
                      ) : null}
                      {pin.credit ? (
                        <p className="m-0">
                          <a href={pin.creditUrl ?? undefined} target="_blank" rel="noreferrer" className="text-inherit">
                            {t('pin.credit', { name: pin.credit })}
                          </a>
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => skip(id)}
                      className="shrink-0 whitespace-nowrap text-[12px] text-[var(--color-ink-3)] underline-offset-2 hover:underline"
                    >
                      {t('pin.skip')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div ref={sentinel} className="h-px" aria-hidden />
          {ready && exhausted ? (
            <p className="m-0 mt-6 text-center text-[14px] text-[var(--color-ink-2)]">{t('feed.end')}</p>
          ) : ready ? (
            <div className="mt-6 text-center">
              <button type="button" onClick={more} className="rounded-full border border-[var(--color-rule)] px-5 py-2.5 text-[14px]">
                {t('feed.more')}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid gap-8">
          {state.saved.length === 0 ? <p className="m-0 text-[15px] text-[var(--color-ink-2)]">{t('boards.empty')}</p> : null}
          {DISCOVER_ROOMS.map((r) =>
            myBoards[r].length ? (
              <section key={r}>
                <h2 className="m-0 mb-3 text-[18px]">
                  {t(`room.${r}`)} <span className="text-[var(--color-ink-3)]">({myBoards[r].length})</span>
                </h2>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {myBoards[r].map((p) => (
                    <div key={p.id} className="relative overflow-hidden rounded-[10px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt={p.alt} loading="lazy" className="block aspect-square w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => toggleSave(p.id)}
                        className="absolute bottom-1 right-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-[#1a1a1a]"
                      >
                        {t('boards.remove')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-rule)] pt-5">
        <p className="m-0 max-w-2xl text-[12px] leading-relaxed text-[var(--color-ink-3)]">{t('feed.honest')}</p>
        {state.saved.length + state.skipped.length > 0 ? (
          <button type="button" onClick={reset} className="text-[12px] text-[var(--color-ink-3)] underline">
            {t('feed.reset')}
          </button>
        ) : null}
      </div>
    </Container>
  );
}
