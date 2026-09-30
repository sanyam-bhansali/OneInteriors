'use client';

/**
 * "What would my home cost?" — a live price on the home page. Pick a home and
 * a finish level and the range counts up in about a second: the same bands,
 * per square foot of carpet, that the brief's level screen prices with
 * (tiers.ts), on the typical area for that home, before GST. Then the real
 * quotes come from real studios — which is what the button is for.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { TIER, TIERS, perSqftLabel, tierRangeFor, type Tier } from '@/modules/quotation/tiers';
import { TYPICAL_CARPET_SQFT } from '@/modules/quotation/estimate';
import { formatINRCompact } from '@/lib/money';
import type { PropertyType } from '@/modules/brief/types';

const HOMES: { key: PropertyType; label: string }[] = [
  { key: 'BHK_1', label: '1 BHK' },
  { key: 'BHK_2', label: '2 BHK' },
  { key: 'BHK_3', label: '3 BHK' },
  { key: 'BHK_4_PLUS', label: '4 BHK+' },
];

/** A number that counts from where it was to where it is going. */
function useCounted(target: number, ms = 900): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const v = a + (target - a) * (1 - Math.pow(1 - p, 4));
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    // A hidden tab pauses animation frames; land on the number regardless.
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      setShown(target);
      from.current = target;
    }, ms + 150);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      from.current = target;
    };
  }, [target, ms]);
  return shown;
}

export function LivePrice() {
  const [home, setHome] = useState<PropertyType>('BHK_2');
  const [tier, setTier] = useState<Tier>('PREMIUM');
  const [sqft, setSqft] = useState(TYPICAL_CARPET_SQFT.BHK_2);
  const { lowPaise, highPaise } = tierRangeFor(tier, sqft);
  const low = useCounted(lowPaise);
  const high = useCounted(highPaise ?? lowPaise);
  const money = (p: number) => formatINRCompact(Math.round(p / 10_000) * 10_000);

  return (
    <div className="live-price" data-reveal="">
      <div className="lp-controls">
        <div role="group" aria-label="Your home" className="lp-row">
          {HOMES.map((h) => (
            <button
              key={h.key}
              type="button"
              aria-pressed={home === h.key}
              data-hover=""
              onClick={() => {
                setHome(h.key);
                setSqft(TYPICAL_CARPET_SQFT[h.key]);
              }}
            >
              {h.label}
            </button>
          ))}
        </div>
        <label className="lp-area">
          <span className="mono muted">Carpet area · {sqft.toLocaleString('en-IN')} sq ft</span>
          <input
            type="range"
            min={350}
            max={3000}
            step={25}
            value={sqft}
            onChange={(e) => setSqft(Number(e.target.value))}
            aria-label="Carpet area in square feet"
          />
        </label>
        <div role="group" aria-label="Finish level" className="lp-row">
          {TIERS.map((t) => (
            <button key={t} type="button" aria-pressed={tier === t} data-hover="" onClick={() => setTier(t)}>
              {TIER[t].label}
            </button>
          ))}
        </div>
      </div>

      <div className="lp-result" aria-live="polite">
        <span className="mono muted">A full home at {TIER[tier].label} · before GST</span>
        <span className="lp-sum">
          {highPaise === null ? `From ${money(low)}` : `${money(low)} – ${money(high)}`}
        </span>
        <span className="mono muted">
          {perSqftLabel(tier).replace(' and up', '+')} per sq ft of carpet · {TIER[tier].promise}
        </span>
        <Link className="btn btn-accent" href="/quiz" data-magnetic="" data-hover="">
          <span className="mag-inner">
            <span className="roll">
              <span data-t="Get it priced by real studios">Get it priced by real studios</span>
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
