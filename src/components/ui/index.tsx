/**
 * Design-system primitives. These read tokens from globals.css — never a
 * literal colour. If you need a colour that isn't a token, add the token.
 */

import Link from 'next/link';
import type { VerificationTier } from '@/modules/studio/types';
import { TIER_LABELS } from '@/modules/studio/types';

// ── Layout ─────────────────────────────────────────────────────

export function Container({
  children,
  size = 'default',
  className = '',
}: {
  children: React.ReactNode;
  size?: 'default' | 'narrow' | 'wide';
  className?: string;
}) {
  const max = size === 'narrow' ? 'max-w-2xl' : size === 'wide' ? 'max-w-6xl' : 'max-w-4xl';
  return <div className={`mx-auto w-full ${max} px-5 sm:px-6 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
      {children}
    </p>
  );
}

// ── Buttons ────────────────────────────────────────────────────

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
};

export function Button({
  children,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  className = '',
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 text-center';
  const sizes = size === 'lg' ? 'px-7 py-3.5 text-[15px]' : 'px-5 py-2.5 text-sm';
  const variants = {
    primary:
      'bg-[var(--color-petrol)] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)]',
    secondary:
      'border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink)] hover:border-[var(--color-ink-3)]',
    ghost: 'bg-transparent text-[var(--color-petrol)] hover:underline underline-offset-4 px-0',
  }[variant];

  const cls = `${base} ${sizes} ${variants} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

// ── Badges ─────────────────────────────────────────────────────

/**
 * Tier badge. Brass is reserved for PROVEN — the only tier a competitor cannot
 * buy from a KYC vendor — so it must be visually dominant over the others.
 * Every badge carries a shape cue as well as colour.
 */
export function TierBadge({ tier, className = '' }: { tier: VerificationTier; className?: string }) {
  const styles: Record<VerificationTier, string> = {
    PROVEN: 'bg-[var(--color-brass-soft)] text-[var(--color-brass)] border-[var(--color-brass)]',
    VERIFIED: 'bg-[var(--color-petrol-soft)] text-[var(--color-petrol)] border-[var(--color-petrol)]',
    LISTED: 'bg-[var(--color-paper-3)] text-[var(--color-ink-3)] border-[var(--color-rule)]',
    UNVERIFIED: 'bg-[var(--color-paper-3)] text-[var(--color-ink-3)] border-[var(--color-rule)]',
  };
  const glyph: Record<VerificationTier, string> = {
    PROVEN: '★',
    VERIFIED: '✓',
    LISTED: '·',
    UNVERIFIED: '·',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.1em] ${styles[tier]} ${className}`}
    >
      <span aria-hidden="true">{glyph[tier]}</span>
      {TIER_LABELS[tier]}
    </span>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'ontrack' | 'atrisk' | 'petrol';
}) {
  const tones = {
    neutral: 'bg-[var(--color-paper-3)] text-[var(--color-ink-2)]',
    ontrack: 'bg-[var(--color-ontrack-soft)] text-[var(--color-ontrack)]',
    atrisk: 'bg-[var(--color-atrisk-soft)] text-[var(--color-atrisk)]',
    petrol: 'bg-[var(--color-petrol-soft)] text-[var(--color-petrol)]',
  }[tone];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] ${tones}`}
    >
      {children}
    </span>
  );
}

// ── Data display ───────────────────────────────────────────────

/**
 * A single measured fact. `value` of null renders the honest empty state —
 * this component is the reason "not enough data yet" is impossible to forget.
 */
export function Stat({
  label,
  value,
  empty = 'Not enough data yet',
  tone = 'default',
}: {
  label: string;
  value: string | null;
  empty?: string;
  tone?: 'default' | 'ontrack' | 'atrisk';
}) {
  const colour =
    value === null
      ? 'text-[var(--color-ink-3)] italic'
      : tone === 'ontrack'
        ? 'text-[var(--color-ontrack)]'
        : tone === 'atrisk'
          ? 'text-[var(--color-atrisk)]'
          : 'text-[var(--color-ink)]';
  return (
    <div className="flex flex-col gap-1">
      <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.11em] text-[var(--color-ink-3)]">
        {label}
      </span>
      <span className={`tabular text-[15px] leading-snug ${colour}`}>{value ?? empty}</span>
    </div>
  );
}

/** Score ring. Always rendered next to "n of 6 factors" — never alone. */
export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${score} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-rule)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-petrol)"
        strokeWidth="3"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-ink)"
        fontSize={size * 0.3}
        fontFamily="var(--font-mono)"
        fontWeight="500"
      >
        {score}
      </text>
    </svg>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`m-0 border-0 border-t border-[var(--color-rule-soft)] ${className}`} />;
}
