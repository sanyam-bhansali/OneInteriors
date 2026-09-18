import type { Metadata } from 'next';
import { CompareClient } from './CompareClient';

export const metadata: Metadata = {
  title: 'Side by side',
  description:
    'Every quote written to the same lines, with the material under each price.',
  robots: { index: false, follow: false },
};

/**
 * Side by side.
 *
 * A thin server shell: the comparison is built entirely from quotes the
 * customer generated in this session, which live in the browser. Nothing here
 * reads the database, and there is deliberately no server-side re-pricing —
 * a quote that changed between the studio's page and this one would be a quote
 * nobody could rely on.
 *
 * The previous version of this page ranked the roster itself and quoted the
 * top few on the fly, so the customer's own choices had no bearing on what
 * they saw. See CompareClient.
 */
export default function ComparePage() {
  return <CompareClient />;
}
