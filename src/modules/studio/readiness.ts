import 'server-only';

/**
 * Which optional features are actually switched on, and what is missing.
 *
 * ## Why this exists
 *
 * Every integration in this codebase degrades rather than failing: no API key
 * means the archive goes to ops by hand, no storage key means the upload
 * control offers an email address instead. That is the right behaviour and it
 * has one cost — a misconfigured deployment looks exactly like a correctly
 * configured one where nobody has used the feature yet.
 *
 * It cost an evening. The quotation upload showed its fallback on production
 * while the key was set locally, then while it was set in Vercel but the
 * build predated it, and each round of guessing needed a screenshot and a
 * reply. A page that answers "which variable is missing" turns that into one
 * look.
 *
 * ## It reports presence, never values
 *
 * Only whether a variable is non-empty. A secret must not be readable from a
 * screen, even an ops-only one — screens get photographed, shared in a bug
 * report, and shoulder-read. Knowing a key is *set* is the whole of what
 * anybody needs to debug this.
 */

import { requireRole } from '@/modules/auth/session';

export interface FeatureReadiness {
  feature: string;
  ready: boolean;
  /** What it does when it is off. Never a blank. */
  fallback: string;
  /** Environment variables it needs, and whether each is present. */
  needs: { name: string; present: boolean }[];
}

function present(name: string): { name: string; present: boolean } {
  return { name, present: Boolean(process.env[name]?.trim()) };
}

/**
 * Read at request time, never at module load.
 *
 * A value captured at import would be the value from whenever the lambda
 * started, which is exactly the staleness this page exists to diagnose.
 */
export async function featureReadiness(): Promise<FeatureReadiness[]> {
  await requireRole('OPS');

  const supabase = [
    present('NEXT_PUBLIC_SUPABASE_URL'),
    present('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    present('SUPABASE_SECRET_KEY'),
  ];

  /* All four storage features share one gate — `Boolean(secretKey()) &&
     supabaseConfig() !== null` — so they are listed separately only because
     their fallbacks differ, and a reader needs to know what each one costs
     when it is off. */
  const storageReady = supabase.every((v) => v.present);

  return [
    {
      feature: 'Quotation archive upload',
      ready: storageReady,
      fallback: 'The panel offers an email address and ops files the rates by hand.',
      needs: supabase,
    },
    {
      feature: 'Business proof upload (step 2)',
      ready: storageReady,
      fallback: 'The section asks the studio to email their certificate.',
      needs: supabase,
    },
    {
      feature: 'Portfolio photographs (step 3)',
      ready: storageReady,
      fallback: 'Projects can be added without pictures; cards show "no photographs yet".',
      needs: supabase,
    },
    {
      feature: 'Reading quotations automatically',
      ready: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      fallback: 'Archives sit at "Being read by hand" and somebody here reads them.',
      needs: [present('ANTHROPIC_API_KEY')],
    },
    {
      feature: 'Email (sign-in links, acknowledgements)',
      ready: Boolean(process.env.RESEND_API_KEY?.trim()) && Boolean(process.env.EMAIL_FROM?.trim()),
      fallback: 'Nothing is sent. Approvals and applications succeed silently.',
      needs: [present('RESEND_API_KEY'), present('EMAIL_FROM')],
    },
    {
      feature: 'Customer marketplace open',
      ready: process.env.CUSTOMER_LIVE?.trim() === '1',
      fallback: 'The quiz, matches and compare redirect to the landing page.',
      needs: [present('CUSTOMER_LIVE')],
    },
  ];
}
