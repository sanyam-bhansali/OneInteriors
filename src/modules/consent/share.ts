/**
 * May a studio see this customer's name and number?
 *
 * Only once the customer has agreed to it, at the moment they picked the
 * studios (plan §3.3, DPDP) — and not after they withdraw. The expert call
 * records the consent (`SHARE_WITH_STUDIO`); every path that releases contact
 * to a studio checks it first. Without it an introduction can still be made,
 * with the contact held back, so the studio learns a brief is coming and
 * nothing about who.
 *
 * Pure, and tested.
 */

export interface ConsentRow {
  purpose: string;
  granted: boolean;
  grantedAt: Date;
  withdrawnAt: Date | null;
}

/** The latest decision about sharing with studios decides — a later "no" or a withdrawal wins. */
export function mayShareWithStudios(rows: ConsentRow[]): boolean {
  const latest = rows
    .filter((r) => r.purpose === 'SHARE_WITH_STUDIO')
    .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())[0];
  return Boolean(latest && latest.granted && !latest.withdrawnAt);
}

export const HELD_FOR_CONSENT =
  'Introduced, with their contact held back: they have not agreed to share it with studios (or withdrew). Ask them to agree from "Your home" or when they book, then release it.';
