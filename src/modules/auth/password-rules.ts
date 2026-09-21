/**
 * What makes a password acceptable. Pure, and free of `node:` imports.
 *
 * ## Why this is a separate file from `password.ts`
 *
 * Not tidiness — a build error. `password.ts` imports `node:crypto` and
 * `node:util` for scrypt, and the moment a client component imports
 * anything from it webpack follows the whole module into the browser
 * bundle and fails:
 *
 *   UnhandledSchemeError: Reading from "node:crypto" is not handled
 *
 * Webpack resolves imports per MODULE, not per binding, so there is no
 * amount of tree-shaking that rescues it. The rules the screen needs had
 * to physically leave the file the hashing lives in.
 *
 * Which is the same principle CONTRIBUTING §9.5 is already built on:
 * pure decisions in a sibling file with no `server-only`, so they can be
 * tested without a runtime and imported from either side. This file is
 * the client-importable half; `password.ts` re-exports everything here
 * so existing server callers and the test suite are unaffected.
 *
 * ## Length, and mostly only length
 *
 * Composition rules — "one capital, one number, one symbol" — push
 * people toward `Password1!` and a sticky note. Length is what costs a
 * guesser time, and twelve characters behind a five-attempt lock that
 * needs a mailbox to lift is not the weak link in this system.
 *
 * The rejected list is short and specific: the things somebody would
 * plausibly type for THIS product, which are exactly the things an
 * attacker tries first.
 */

export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 200;

/** Things somebody would plausibly type for THIS product. */
const OBVIOUS = ['oneinteriors', 'password', 'qwerty', 'admin', 'letmein', '123456'];

export interface PasswordCheck {
  id: 'length' | 'distinct' | 'notObvious' | 'trimmed';
  /** Shown on screen. Present tense, so an unmet rule reads as a goal. */
  label: string;
  ok: boolean;
}

/**
 * The rules, itemised — the same predicates `passwordProblem` decides on.
 *
 * A strength meter that disagrees with the server is worse than none: it
 * either blocks somebody for a rule nobody enforces, or says they are
 * fine and then the submit fails. Both read as the product being broken.
 *
 * So the screen and the server read these four predicates. Add a rule
 * here and the on-screen checklist grows by itself.
 */
export function passwordChecks(plain: string): PasswordCheck[] {
  const p = plain.normalize('NFKC');
  const flat = p.toLowerCase().replace(/[^a-z0-9]/g, '');

  return [
    {
      id: 'length',
      label: `At least ${MIN_PASSWORD} characters`,
      ok: p.length >= MIN_PASSWORD && p.length <= MAX_PASSWORD,
    },
    {
      id: 'distinct',
      label: 'A few different characters',
      ok: new Set(p).size >= 5,
    },
    {
      id: 'notObvious',
      label: 'Nothing guessable — not the product name',
      ok: p.length > 0 && !OBVIOUS.some((bad) => flat.includes(bad)),
    },
    {
      id: 'trimmed',
      label: 'No space at the start or end',
      ok: p.length > 0 && p.trim().length === p.length,
    },
  ];
}

/**
 * 0–4, for the bar. Just the count of rules met.
 *
 * Not an entropy estimate, and it does not pretend to be one. A meter
 * that says "strong" about something the server will accept is honest;
 * one that scores a rejected password 3/4 is a lie with a gradient on it.
 */
export function passwordScore(plain: string): number {
  return passwordChecks(plain).filter((c) => c.ok).length;
}

/**
 * Is this password acceptable to set? `null` means yes.
 *
 * Decides on the same predicates as `passwordChecks`, so the screen and
 * the server cannot drift apart. The messages stay bespoke because
 * "rule 2 failed" helps nobody.
 */
export function passwordProblem(plain: string): string | null {
  const p = plain.normalize('NFKC');
  if (p.length > MAX_PASSWORD) return `That is longer than ${MAX_PASSWORD} characters.`;

  const failed = passwordChecks(plain).filter((c) => !c.ok);
  if (failed.length === 0) return null;

  const first = failed[0]!.id;
  if (first === 'length') return `Use at least ${MIN_PASSWORD} characters.`;
  if (first === 'trimmed') return 'Remove the space at the start or end.';
  if (first === 'notObvious') {
    return 'That contains something guessable. Avoid the product name and common words.';
  }
  return 'Use a few more different characters.';
}
