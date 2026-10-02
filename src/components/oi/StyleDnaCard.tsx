import { styleDna, whatsappShare } from '@/modules/brief/style-dna';
import type { StyleTag } from '@/modules/brief/types';

/** "Your style DNA" — shares, palette, materials, and a WhatsApp share (queue item 13). */
export function StyleDnaCard({ likes, className = '' }: { likes: StyleTag[]; className?: string }) {
  const dna = styleDna(likes);
  if (!dna) return null;
  return (
    <section className={`rounded-[14px] border border-[var(--line)] bg-[var(--card)] p-5 ${className}`} aria-label="Your style DNA">
      <p className="oi-eyebrow m-0 mb-3">Your style DNA</p>
      <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full" aria-hidden>
        {dna.shares.map((s, i) => (
          <span key={s.tag} style={{ width: `${s.pct}%`, background: dna.palette[[4, 2, 1][i] ?? 0] }} />
        ))}
      </div>
      <p className="m-0 mb-4 text-[15px] text-[var(--ink)]">
        {dna.shares.map((s, i) => (
          <span key={s.tag}>
            {i > 0 ? ' · ' : ''}
            <strong>{s.pct}%</strong> {s.label}
          </span>
        ))}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {dna.palette.map((c) => (
          <span key={c} className="h-7 w-7 rounded-full border border-[var(--line)]" style={{ background: c }} title={c} />
        ))}
        <span className="ml-2 text-[13px] text-[var(--ink2)]">{dna.materials.join(' · ')}</span>
      </div>
      <a
        href={whatsappShare(dna.shareText)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-10 items-center rounded-full border border-[var(--line)] px-4 text-[13.5px] font-semibold text-[var(--ink)] no-underline hover:border-[var(--ink2)]"
      >
        Share on WhatsApp
      </a>
    </section>
  );
}
