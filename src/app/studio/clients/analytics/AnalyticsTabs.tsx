import Link from 'next/link';

/**
 * The sections inside the Leads app's one Analytics tab (owner, 11 Nov
 * 2026): Overview is the dashboard that used to be its own "Numbers" tab;
 * Sources & pipeline and Calling are the older lead analytics pages.
 *
 * Calling is its own page rather than a section of another: it has its own
 * range in the URL (Today, 7 days, 30 days, dates). The two pages under
 * /studio/clients/analytics stay closed to anyone without `lead.analytics`
 * (studio/surfaces.ts), so `full` is false for them and only Overview shows.
 */
export function AnalyticsTabs({ active, full = true }: { active: 'overview' | 'leads' | 'calling'; full?: boolean }) {
  if (!full) return null;
  return (
    <nav className="atabs" aria-label="Which numbers" style={{ alignSelf: 'flex-start' }}>
      <Link href="/studio/dashboard" aria-current={active === 'overview' ? 'page' : undefined}>
        Overview
      </Link>
      <Link href="/studio/clients/analytics" aria-current={active === 'leads' ? 'page' : undefined}>
        Sources &amp; pipeline
      </Link>
      <Link href="/studio/clients/analytics/calling" aria-current={active === 'calling' ? 'page' : undefined}>
        Calling
      </Link>
    </nav>
  );
}
