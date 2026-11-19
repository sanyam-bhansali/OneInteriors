import { redirect } from 'next/navigation';

/**
 * The old Full builder start. One builder tab since 19 Nov 2026 (owner:
 * "first quote and full builder shouldn't be different tabs"): Build on the
 * quotation builder opens the full builder, so a saved link lands there.
 */
export default function FullBuilderPage(): never {
  redirect('/studio/quotations/first');
}
