import { SealIcon } from './icons';

/** The One Interiors logo as a mask, so it takes the text colour (true aspect 1074×561). */
export function Oim({ width, color = 'var(--ink)' }: { width: number; color?: string }) {
  return (
    <span className="oim" style={{ width, height: Math.round(width / 1.914), color }} role="img" aria-label="One Interiors" />
  );
}

export function PoweredBy({ width = 65, className = 'made', style }: { width?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={style}>
      <span>Powered by</span>
      <Oim width={width} />
    </div>
  );
}

/** Green, with the seal and a slow sheen. Only for a studio that passed our checks. */
export function Verified() {
  return (
    <span className="ver" title="Checked by One Interiors">
      <SealIcon />
      One Verified
    </span>
  );
}

/** The studio's letter mark: the first letter of its name on the gradient tile. */
export function Mark({ name }: { name: string }) {
  const letter = (name.trim()[0] ?? 'S').toUpperCase();
  return <span className="mark">{letter}</span>;
}

/** Initials for an avatar: two letters from a name, or one. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}
