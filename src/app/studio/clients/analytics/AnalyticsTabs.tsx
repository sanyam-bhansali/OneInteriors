import Link from 'next/link';

/**
 * Leads | Calling, above lead analytics (improvement 7, owner 22 Oct 2026).
 * Calling is its own page under this one rather than a section of it: it
 * has its own range in the URL (Today, 7 days, 30 days, dates), and the
 * leads page's numbers are all-time. Being under /studio/clients/analytics,
 * it is closed to sales exactly as the leads page is (studio/surfaces.ts).
 */
export function AnalyticsTabs({ active }: { active: 'leads' | 'calling' }) {
  return (
    <nav className="atabs" aria-label="Which numbers" style={{ alignSelf: 'flex-start' }}>
      <Link href="/studio/clients/analytics" aria-current={active === 'leads' ? 'page' : undefined}>
        Leads
      </Link>
      <Link href="/studio/clients/analytics/calling" aria-current={active === 'calling' ? 'page' : undefined}>
        Calling
      </Link>
    </nav>
  );
}
