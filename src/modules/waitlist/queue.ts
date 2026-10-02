/**
 * The waitlist gate and its queue (the owner, 30 Sep 2026).
 *
 * Pune opens when LAUNCH_AT people have joined; at launch, invites go out in
 * queue order. Your place starts as the order you joined in, and moves up:
 *
 *   - PLACES_PER_REFERRAL for every friend who joins through your link;
 *   - EXTRAS_PLACES, once, for answering the three optional questions.
 *
 * What referrals unlock (the ladder), and what a society unlocks together:
 *
 *   - the ₹5,000 architect call is free for the first FREE_CALLS to join,
 *     and for anyone who brings CALL_AT friends, wherever they are;
 *   - the free cab is guaranteed at CAB_AT friends, or for everyone in a
 *     society that reaches SOCIETY_UNLOCK signups (which also brings
 *     priority invites).
 *
 * The count is shown only from SHOW_COUNT_FROM — "3 people have joined"
 * does more harm than no number.
 *
 * Pure, and tested; the store does the reading.
 */

import { FREE_CALLS } from '@/modules/consultation/offer';

export const LAUNCH_AT = 2000;
export { FREE_CALLS };
export const PLACES_PER_REFERRAL = 25;
export const EXTRAS_PLACES = 20;
export const CALL_AT = 3;
export const CAB_AT = 5;
export const SOCIETY_UNLOCK = 25;
export const SHOW_COUNT_FROM = 100;

/** No 0/O or 1/I — codes get read out and typed from posters. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJ-NP-Z2-9]{7}$/;

export function makeCode(random: Uint8Array): string {
  return Array.from(random.slice(0, 7), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

export interface QueueRow {
  code: string;
  /** 1-based order of joining. */
  joined: number;
  referrals: number;
  answered: boolean;
}

/**
 * Lower is sooner. Someone who has moved up lands just ahead of the person
 * whose original place they reached (the half), so "up 25 places" is exactly
 * 25; otherwise ties keep joining order.
 */
export function queueKey(r: QueueRow): number {
  const boost = r.referrals * PLACES_PER_REFERRAL + (r.answered ? EXTRAS_PLACES : 0);
  return r.joined - boost - (boost > 0 ? 0.5 : 0);
}

/** 1-based place in the queue for `code`, or null if it is not in `rows`. */
export function positionOf(code: string, rows: QueueRow[]): number | null {
  const me = rows.find((r) => r.code === code);
  if (!me) return null;
  const mine = queueKey(me);
  let ahead = 0;
  for (const r of rows) {
    const k = queueKey(r);
    if (k < mine || (k === mine && r.joined < me.joined)) ahead += 1;
  }
  return ahead + 1;
}

export interface Unlocks {
  freeCall: boolean;
  freeCallReason: 'early' | 'referrals' | null;
  cab: boolean;
  cabReason: 'referrals' | 'society' | null;
  priority: boolean;
  /** The next rung, for "bring N more friends to …". */
  next: { friends: number; unlocks: string } | null;
}

export function unlocksFor(joined: number, referrals: number, societyCount: number): Unlocks {
  const early = joined <= FREE_CALLS;
  const byRefCall = referrals >= CALL_AT;
  const byRefCab = referrals >= CAB_AT;
  const society = societyCount >= SOCIETY_UNLOCK;
  let next: Unlocks['next'] = null;
  if (referrals < 1) next = { friends: 1, unlocks: `move up ${PLACES_PER_REFERRAL} places` };
  else if (!early && referrals < CALL_AT) next = { friends: CALL_AT - referrals, unlocks: 'your ₹5,000 architect call, free' };
  else if (!society && referrals < CAB_AT) next = { friends: CAB_AT - referrals, unlocks: 'a free cab to the studio' };
  return {
    freeCall: early || byRefCall,
    freeCallReason: early ? 'early' : byRefCall ? 'referrals' : null,
    cab: byRefCab || society,
    cabReason: byRefCab ? 'referrals' : society ? 'society' : null,
    priority: society,
    next,
  };
}

export interface PublicStats {
  /** Null below SHOW_COUNT_FROM — the page then says "Founding list open". */
  total: number | null;
  launchAt: number;
  freeCallsLeft: number;
}

export function publicStats(total: number): PublicStats {
  return {
    total: total >= SHOW_COUNT_FROM ? total : null,
    launchAt: LAUNCH_AT,
    freeCallsLeft: Math.max(0, FREE_CALLS - total),
  };
}

/** The optional answers, cleaned. */
export const POSSESSION = ['HAVE_KEYS', 'WITHIN_3_MONTHS', 'LATER'] as const;
export const BHKS = ['1', '2', '3', '4+'] as const;

export function cleanExtras(input: {
  possession?: unknown;
  bhk?: unknown;
  society?: unknown;
  style?: unknown;
}): { possession: string | null; bhk: string | null; society: string | null } {
  const pick = <T extends string>(v: unknown, list: readonly T[]) =>
    typeof v === 'string' && (list as readonly string[]).includes(v) ? v : null;
  const society =
    typeof input.society === 'string'
      ? input.society.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || null
      : null;
  return { possession: pick(input.possession, POSSESSION), bhk: pick(input.bhk, BHKS), society };
}
