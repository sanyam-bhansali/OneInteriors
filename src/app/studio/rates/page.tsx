import { redirect } from 'next/navigation';

/**
 * The six-category rate card lived here. Customer quotes now price from the
 * studio's product master (one price list, owner's decision of 10 Oct 2026),
 * so the card is no longer what a customer is quoted on and editing it here
 * would change nothing they see. The product master is the place.
 *
 * The onboarding rates step keeps its own form for studios still signing up.
 */
export default function RatesPage() {
  redirect('/studio/products');
}
