/**
 * What a studio logo may be, in terms a screen can state.
 *
 * Pure — no `server-only` — because the settings control has to tell somebody
 * the rules BEFORE they pick a file, and it is a client component. Importing
 * these from `studio-logo.ts` would be a value import from a server-only
 * module, which drags the storage client into the browser bundle and stops
 * the route building. CONTRIBUTING §9.5, and
 * `tests/server-only-boundary.test.ts` is what catches it.
 *
 * `studio-logo.ts` imports these rather than restating them, so the number in
 * the sentence and the number in the check cannot drift.
 */

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_LOGO_MB = MAX_LOGO_BYTES / 1024 / 1024;

/**
 * SVG is deliberately absent.
 *
 * It is the best format for a logo and it is also a script-bearing document:
 * an SVG can carry JavaScript, and this one renders inside a page showing a
 * studio's pricing. Sanitising SVG properly is its own project, and a PNG at
 * 2x prints indistinguishably on paper.
 */
export const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const ACCEPTED_LOGO = 'PNG, JPG or WebP';
