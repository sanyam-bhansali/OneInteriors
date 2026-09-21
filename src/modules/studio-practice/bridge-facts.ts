/**
 * Turning a brief into a board card.
 *
 * Pure, no database, no `server-only` — CONTRIBUTING §9.5. The half worth
 * testing exhaustively, because it is the half that decides what a studio
 * reads at 9am and none of it fails visibly: a wrong label is just a wrong
 * label until somebody quotes the wrong flat.
 *
 * ## Why a card arrives already filled in
 *
 * `docs/STUDIO-CRM.md` ends on the test this file exists to pass:
 *
 * > does this row arrive already filled in? If not, it probably should not
 * > ship.
 *
 * A lead that lands as a name and a phone number is a lead the studio has to
 * research before they can act, and a studio that has to research before
 * acting does neither. Everything the customer already told us — what they
 * own, how big it is, what they want done, roughly what they will spend, when
 * they need to be living in it — is on the card before the first call.
 *
 * That is also the only thing a marketplace lead can offer that a Meta lead
 * ad cannot. It is the product.
 *
 * ## What is deliberately NOT here
 *
 * The customer's name, phone and email. They come from the consultation or
 * the account, they are gated on `contactReleasedAt`, and keeping them out of
 * this file means no amount of carelessness here can leak one. The caller
 * assembles identity separately, after `canSeeContact` has said yes.
 *
 * Style likes, priority ranking and household composition are also left out.
 * They are real and they matter, but they matter at the design stage, not on
 * a card somebody is scanning to decide who to ring first — and the card has
 * to stay scannable or it becomes another thing to research.
 */

/* `propertyLabel` / `scopeLabel` rather than the Records they wrap. The
   Prisma enums are WIDER than the TS unions — PropertyType carries an `OTHER`
   the quiz never writes — so indexing a Record with a database value renders
   `undefined` into the card, silently, on exactly the rows unusual enough to
   matter. That warning is written on those helpers; this file is a caller
   that could easily have ignored it. */
import { localityLabel, propertyLabel, scopeLabel } from '@/modules/brief/types';

/**
 * What the bridge reads off a brief. Deliberately the whole input.
 *
 * The enum fields are `string`, not the narrow TS unions, because that is
 * what Prisma hands back and narrowing here would only move the cast
 * somewhere with less context.
 */
export interface BriefFacts {
  propertyType: string | null;
  carpetAreaSqft: number | null;
  locality: string | null;
  scope: string | null;
  tier: string | null;
  /** Lakh, already converted. Paise and BigInt stay on the server side. */
  budgetMinLakhs: number | null;
  budgetMaxLakhs: number | null;
  moveInBy: Date | null;
  possessionOn: Date | null;
}

export interface CardFacts {
  /** The `config` column — "3 BHK". Null when they did not say. */
  config: string | null;
  locality: string | null;
  carpetSqft: number | null;
  /** The brief, as prose, for the notes column. Never empty. */
  summary: string;
}

/* Indexed by a database string, so a tier we have not met yet falls through
   to null rather than printing `undefined finish` on the card. */
const TIER_WORD: Record<string, string> = {
  ESSENTIAL: 'Essential',
  PREMIUM: 'Premium',
  LUXURY: 'Luxury',
};

/**
 * Money, the way somebody says it out loud.
 *
 * `₹12L–₹18L`, not `₹1,200,000 – ₹1,800,000`. One decimal only when it earns
 * its place, so 12 stays 12 and 12.5 stays 12.5 — a column of `12.0` reads as
 * machine output, and the whole card is trying not to.
 */
export function budgetPhrase(minLakhs: number | null, maxLakhs: number | null): string | null {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  if (minLakhs !== null && maxLakhs !== null) {
    /* An equal pair is one number, not a range of one. */
    if (minLakhs === maxLakhs) return `about ₹${n(minLakhs)}L`;
    return `₹${n(minLakhs)}L–₹${n(maxLakhs)}L`;
  }
  if (maxLakhs !== null) return `up to ₹${n(maxLakhs)}L`;
  if (minLakhs !== null) return `from ₹${n(minLakhs)}L`;
  return null;
}

/** "September 2026". Month precision, because that is the precision they gave. */
export function monthYear(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/**
 * The brief as a paragraph the studio can read in four seconds.
 *
 * Sentences rather than a field dump, because the notes column is read as
 * prose and a list of `key: value` lines in it looks like something went
 * wrong. Missing answers are simply absent — a brief full of "not specified"
 * teaches the studio to stop reading the box.
 */
export function briefSummary(facts: BriefFacts): string {
  const bits: string[] = [];

  /* Sentence one: the property. Built by hand rather than from a template,
     so "a 3 BHK in Baner, 1,150 sqft" degrades to "a 3 BHK" or "1,150 sqft"
     without leaving a comma stranded. */
  const property = propertyLabel(facts.propertyType);
  const where = localityLabel(facts.locality);
  const size = facts.carpetAreaSqft ? `${facts.carpetAreaSqft.toLocaleString('en-IN')} sqft` : null;

  /* "3 BHK in Baner, 1,150 sqft" — the place joins with a space, the size
     with a comma. Joining all three on ", " gives "3 BHK, in Baner", and a
     comma before a preposition is the tell that a sentence was assembled by
     a machine. Each half degrades on its own, so a brief with only a size
     still reads as a sentence. */
  const place = [property, where ? `in ${where}` : null].filter(Boolean).join(' ');
  const one = [place || null, size].filter(Boolean).join(', ');
  if (one) bits.push(`${capitalise(one)}.`);

  /* Sentence two: what they want and what they will spend. */
  const scope = scopeLabel(facts.scope);
  const tierWord = facts.tier ? TIER_WORD[facts.tier] : null;
  const tier = tierWord ? `${tierWord} finish` : null;
  const money = budgetPhrase(facts.budgetMinLakhs, facts.budgetMaxLakhs);
  const two = [scope, tier, money].filter(Boolean).join(' · ');
  if (two) bits.push(`${two}.`);

  /* Sentence three: time. Possession only when it is the more useful of the
     two — somebody waiting on handover has a date they cannot move, and a
     move-in target they can. */
  const moveIn = monthYear(facts.moveInBy);
  const possession = monthYear(facts.possessionOn);
  if (moveIn) bits.push(`Wants to move in by ${moveIn}.`);
  else if (possession) bits.push(`Possession ${possession}.`);

  return bits.length > 0
    ? `From their One Interiors brief — ${bits.join(' ')}`
    : 'Introduced through One Interiors. They have not filled in much of the brief yet.';
}

/** Everything the bridge writes that is not identity. */
export function cardFacts(facts: BriefFacts): CardFacts {
  return {
    config: propertyLabel(facts.propertyType),
    locality: localityLabel(facts.locality),
    carpetSqft: facts.carpetAreaSqft,
    summary: briefSummary(facts),
  };
}

/**
 * The first thing to do about this lead, and by when.
 *
 * Every bridged card arrives with work attached rather than as something to
 * notice. A lead with no next action never appears on "waiting on you" —
 * `nextActionOn` is what that list is ordered by — so a card created without
 * one is a card that sinks the moment a second one arrives.
 *
 * Tomorrow, not today: an introduction is usually made while the expert is
 * still on the phone, and a task due in the next four minutes is a task
 * somebody dismisses. Both fields or neither, which is the rule `addClient`
 * already enforces by hand.
 */
export const FIRST_ACTION = 'Call and introduce yourself';

export function firstActionOn(introducedAt: Date): Date {
  const d = new Date(introducedAt);
  d.setDate(d.getDate() + 1);
  /* 10am local. A due date with a midnight timestamp sorts before everything
     a studio did yesterday evening and reads as already overdue. */
  d.setHours(10, 0, 0, 0);
  return d;
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
