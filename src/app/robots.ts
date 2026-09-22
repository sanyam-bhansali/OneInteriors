import type { MetadataRoute } from 'next';

/**
 * Who may index this deployment.
 *
 * ## The problem this exists for
 *
 * The app answers on whatever hostname Vercel gives it — a `*.vercel.app`
 * production URL, and a fresh one for every preview. Those are publicly
 * reachable by default, and the landing page is the one page in the product
 * that does NOT carry `robots: { index: false }` in its own metadata, because
 * on the real domain it is supposed to be found.
 *
 * So without this, Google can index `one-interiors-xyz.vercel.app`. Two things
 * follow, both bad and both slow to undo: the deployment competes with the
 * real site for its own brand terms, and a searcher lands on a URL that will
 * change the next time the project is renamed or redeployed to a new alias.
 *
 * ## Why it keys on PUBLIC_HOST rather than NODE_ENV
 *
 * Production and "the public site" are not the same thing here. This
 * deployment is production — real database, real sessions — while
 * `oneinteriors.in` serves a separate waitlist project. `NODE_ENV` is
 * `production` on both, so it cannot tell them apart.
 *
 * `PUBLIC_HOST` can: it is only set once this deployment is the one answering
 * for the public domain. Until then, nothing here is indexable.
 *
 * Deliberately fails CLOSED. An unset variable means disallow, so forgetting
 * to configure something costs visibility rather than leaking a staging copy
 * into search results.
 */
export default function robots(): MetadataRoute.Robots {
  const publicHost = process.env.PUBLIC_HOST?.trim();

  if (!publicHost) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      /* The software, as opposed to the marketing pages. Every page under
         these already sets `robots: { index: false }` in its own metadata —
         this is the belt to that pair of braces, and it also keeps crawlers
         from spending the budget on pages that will only redirect them to a
         sign-in. */
      disallow: ['/studio', '/ops', '/api', '/f', '/account', '/quotes', '/shared', '/prepare'],
    },
    host: publicHost,
  };
}
