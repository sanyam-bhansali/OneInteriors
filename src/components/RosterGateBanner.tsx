import { showUnverifiedStudios } from '@/lib/env';

/**
 * The strip that says the verification gate is off.
 *
 * ## Why it is a server component, and must stay one
 *
 * `showUnverifiedStudios()` reads `DEV_SHOW_UNVERIFIED_STUDIOS`, which is
 * deliberately not a `NEXT_PUBLIC_` variable — the gate decides which studios
 * reach a customer, so it belongs on the server that queries the database and
 * nowhere a visitor could edit it.
 *
 * The consequence is that this component only works on the server. It lived
 * inside `SiteHeader` and disappeared on `/match`, because `SiteHeader` is
 * rendered from inside `MatchClient`, which is `'use client'` — so it was
 * compiled into the browser bundle, where the variable reads `undefined`. The
 * banner was showing on every page except the ones actually displaying
 * unverified studios.
 *
 * So it is mounted once in the root layout, which is a server component. Do not
 * move it into a shared header again, and do not import it from anything
 * marked `'use client'`.
 *
 * ## Why it is loud
 *
 * The cost of forgetting this flag is presenting businesses we have not checked
 * as though we had, which is the one failure this product cannot survive. A
 * discreet notice would get tuned out by the second day.
 */
export function RosterGateBanner() {
  if (!showUnverifiedStudios()) return null;

  return (
    <div className="bg-[var(--color-terracotta)] py-1.5 text-center">
      <p className="m-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-paper)]">
        Dev · verification gate off · unverified studios are visible
      </p>
    </div>
  );
}
