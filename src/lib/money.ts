/**
 * Money. Integer PAISE, everywhere, with no exceptions.
 *
 * Why `number` and not `bigint`:
 *   BigInt cannot be serialised across the React server/client boundary or
 *   through JSON, which this app does constantly. Integer paise in a `number`
 *   is exact up to 9,007,199,254,740,991 paise (about ₹90 trillion), so the
 *   magnitude risk is zero for our domain. The real danger with money is
 *   FRACTIONS, not size — so every function here returns an integer, and
 *   division rounds exactly once, explicitly.
 *
 * The Prisma layer stores BigInt. Convert at that boundary only (`fromDb`/`toDb`).
 *
 * Rules:
 *   - Never write `price * 1.18`. Use `addGst`.
 *   - Never write `total / 5`. Use `splitAcross`.
 *   - Never store rupees. Never store a float. Never round twice.
 */

/** Integer paise. 100 paise = ₹1. */
export type Paise = number;

const PAISE_PER_RUPEE = 100;

// ── Construction ───────────────────────────────────────────────

export function rupeesToPaise(rupees: number | string): Paise {
  const s = typeof rupees === 'number' ? rupees.toFixed(2) : rupees.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error(`Not a valid rupee amount: ${rupees}`);
  }
  const negative = s.startsWith('-');
  const [whole, frac = ''] = s.replace('-', '').split('.');
  const paise = Number(whole) * PAISE_PER_RUPEE + Number(frac.padEnd(2, '0'));
  return negative ? -paise : paise;
}

/** ₹8.5 L -> 85000000 paise. The unit Indian customers actually think in. */
export function lakhsToPaise(lakhs: number): Paise {
  return Math.round(lakhs * 100_000 * PAISE_PER_RUPEE);
}

export function paiseToLakhs(paise: Paise): number {
  return paise / PAISE_PER_RUPEE / 100_000;
}

/** Prisma stores BigInt. Convert only at that boundary. */
export function fromDb(value: bigint): Paise {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error(`Paise value out of safe range: ${value}`);
  return n;
}

export function toDb(value: Paise): bigint {
  assertInteger(value);
  return BigInt(value);
}

// ── Formatting ─────────────────────────────────────────────────

/**
 * Indian numbering system: last three digits, then pairs.
 *   85000000 -> "₹8,50,000"
 *
 * Getting this wrong makes the product read as foreign, which is the last
 * thing a trust-led brand can afford. Never hand-roll toLocaleString for this.
 */
export function formatINR(
  paise: Paise,
  opts: { paise?: boolean; symbol?: boolean } = {},
): string {
  const { paise: showPaise = false, symbol = true } = opts;
  assertInteger(paise);

  const negative = paise < 0;
  const abs = Math.abs(paise);

  const whole = Math.trunc(abs / PAISE_PER_RUPEE);
  const frac = abs % PAISE_PER_RUPEE;

  const grouped = groupIndian(String(whole));
  const body = showPaise ? `${grouped}.${String(frac).padStart(2, '0')}` : grouped;

  return `${negative ? '-' : ''}${symbol ? '₹' : ''}${body}`;
}

/** For cards and charts, where the exact rupee is noise. 850000000 -> "₹85 L" */
export function formatINRCompact(paise: Paise): string {
  assertInteger(paise);
  const negative = paise < 0;
  const rupees = Math.abs(paise) / PAISE_PER_RUPEE;
  const sign = negative ? '-' : '';

  if (rupees >= 10_000_000) return `${sign}₹${trim(rupees / 10_000_000)} Cr`;
  if (rupees >= 100_000) return `${sign}₹${trim(rupees / 100_000)} L`;
  if (rupees >= 1_000) return `${sign}₹${trim(rupees / 1_000)} K`;
  return `${sign}₹${Math.round(rupees)}`;
}

/** "₹6 L – ₹9 L" — the band format used on studio cards and package tiers. */
export function formatRange(lo: Paise, hi: Paise): string {
  return `${formatINRCompact(lo)} – ${formatINRCompact(hi)}`;
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

function trim(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

// ── Arithmetic ─────────────────────────────────────────────────

/**
 * Basis points, so a rate is always an integer and never a float.
 * 400 bps = 4.00%. Rounds half-up, exactly once.
 */
export function applyBps(amount: Paise, bps: number): Paise {
  assertInteger(amount);
  if (!Number.isInteger(bps)) throw new Error(`bps must be an integer, got ${bps}`);
  return roundHalfUp((amount * bps) / 10_000);
}

export const RATES = {
  /** Pilot commission charged to the studio, per §04 of the build plan. */
  PILOT_COMMISSION_BPS: 400, // 4.00%
  /** Customer-side escrow fee. */
  ESCROW_FEE_BPS: 175, // 1.75%
  /** GST on interior design services and modular furniture. */
  GST_BPS: 1800, // 18%
} as const;

export function addGst(amount: Paise, bps: number = RATES.GST_BPS) {
  const gst = applyBps(amount, bps);
  return { net: amount, gst, gross: amount + gst };
}

function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

function assertInteger(paise: number): void {
  if (!Number.isInteger(paise)) {
    throw new Error(`Money must be integer paise, got ${paise}. Never divide without splitAcross().`);
  }
}

/**
 * Split an amount across milestones so the parts ALWAYS sum to the whole.
 * The remainder lands on the last part — never distributed, never dropped.
 *
 * A one-paise leak here is a reconciliation failure the moment volume arrives,
 * and reconciliation failures in escrow are the fastest way to lose a studio.
 */
export function splitAcross(total: Paise, weights: readonly number[]): Paise[] {
  assertInteger(total);
  if (weights.length === 0) throw new Error('splitAcross needs at least one weight');

  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error('weights must sum to a positive number');

  const parts: Paise[] = [];
  let allocated = 0;

  for (let i = 0; i < weights.length - 1; i++) {
    const part = roundHalfUp((total * weights[i]) / sum);
    parts.push(part);
    allocated += part;
  }
  parts.push(total - allocated);

  return parts;
}

/**
 * Standard milestone schedule for a full-home project.
 * Weights sum to 100 and splitAcross guarantees the parts sum to the contract.
 */
export const DEFAULT_MILESTONES = [
  { title: 'Design sign-off & material selection', weight: 15 },
  { title: 'Civil work & false ceiling', weight: 20 },
  { title: 'Modular delivery & installation', weight: 30 },
  { title: 'Painting, electrical & plumbing', weight: 20 },
  { title: 'Finishing, snagging & handover', weight: 15 },
] as const;
