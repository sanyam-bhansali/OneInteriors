import { redirect } from 'next/navigation';

/**
 * `/quotes` is gone.
 *
 * A quote is a studio's pricing and now lives inside that studio's profile,
 * under the work and the checks that say whether the number is worth
 * anything. This page collected every studio's total in one list, which
 * invites the single comparison that should never be made casually — totals
 * without the materials underneath them. That belongs on `/compare`, where
 * every line sits beside its spec.
 *
 * A redirect rather than a deletion: the old path is in browser histories, in
 * at least one email, and in the footer of anything already sent. `/match` is
 * where somebody who wanted their quotes will find them, each behind the
 * studio that produced it.
 */
export default function QuotesPage() {
  redirect('/match');
}
