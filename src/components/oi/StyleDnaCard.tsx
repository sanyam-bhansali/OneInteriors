'use client';

import { styleDna, whatsappShare } from '@/modules/brief/style-dna';
import { useSiteT } from '@/components/app/i18n';
import { OI_DICT } from '@/modules/i18n/site/oi';
import type { StyleTag } from '@/modules/brief/types';

/**
 * "Your style DNA" — shares, palette, materials, and a WhatsApp share (queue item 13).
 *
 * A lilac tile in the landing's manner (owner, 10 Oct 2026): the shares as
 * big medium-weight figures, the palette as swatches, the share as a line pill.
 */
export function StyleDnaCard({ likes, className = '' }: { likes: StyleTag[]; className?: string }) {
  const t = useSiteT(OI_DICT);
  const dna = styleDna(likes);
  if (!dna) return null;
  const share = t('dna.share');
  return (
    <section
      className={`rounded-[var(--r-l,24px)] bg-[var(--lilac,#ebe9fb)] p-[clamp(22px,3vw,36px)] ${className}`}
      aria-label={t('dna.title')}
    >
      <p className="eyebrow" style={{ marginBottom: 16 }}>
        {t('dna.title')}
      </p>
      <ul className="m-0 mb-5 flex list-none flex-wrap gap-x-7 gap-y-3 p-0">
        {dna.shares.map((s) => (
          <li key={s.tag} className="min-w-0">
            <span className="block text-[clamp(2rem,1.5rem+1.6vw,2.8rem)] font-medium leading-none tracking-[-0.045em] tabular-nums text-[var(--ink)]">
              {s.pct}%
            </span>
            <span className="mt-1.5 block text-[14px] text-[var(--ink-2)]">{s.label}</span>
          </li>
        ))}
      </ul>
      <div className="mb-5 flex h-2.5 w-full overflow-hidden rounded-full bg-white/60" aria-hidden>
        {dna.shares.map((s, i) => (
          <span key={s.tag} style={{ width: `${s.pct}%`, background: dna.palette[[4, 2, 1][i] ?? 0] }} />
        ))}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {dna.palette.map((c) => (
          <span key={c} className="h-8 w-8 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,.75)]" style={{ background: c }} title={c} />
        ))}
        <span className="ml-2 text-[14px] text-[var(--ink-2)]">{dna.materials.join(' · ')}</span>
      </div>
      {/* An outside link opening a new tab, so the landing's pill markup by hand. */}
      <a
        href={whatsappShare(dna.shareText)}
        target="_blank"
        rel="noopener noreferrer"
        className="pill pill-line"
        data-magnetic=""
      >
        <span className="mag-inner">
          <span className="roll">
            <span data-t={share}>{share}</span>
          </span>
        </span>
      </a>
    </section>
  );
}
