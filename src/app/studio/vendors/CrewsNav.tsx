import Link from 'next/link';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';

/**
 * The crews section's own tabs (Studio OS Phase 3): the crews, what to pay,
 * what to price, every payment, and — for the owner — labour against the
 * contract. One question each.
 */
export async function CrewsNav({ at }: { at: 'crews' | 'pay' | 'price' | 'payments' | 'labour' }) {
  const m = await currentMember();
  const owner = m !== null && can(m, 'vendor.rates');
  const tabs = [
    { key: 'crews', href: '/studio/vendors', label: 'Crews' },
    { key: 'pay', href: '/studio/vendors/pay', label: 'Pay these' },
    { key: 'price', href: '/studio/vendors/price', label: 'Price these' },
    { key: 'payments', href: '/studio/vendors/payments', label: 'Payments' },
    ...(owner ? [{ key: 'labour', href: '/studio/vendors/labour', label: 'Labour vs contract' }] : []),
  ];
  return (
    <nav aria-label="Crews" className="flex gap-1 overflow-x-auto border-b border-[var(--s-rule)] bg-[var(--s-rail)]/50 px-5 sm:px-7">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === at ? 'page' : undefined}
          className={`-mb-px flex-none border-b-2 px-3 py-2.5 text-[14px] no-underline ${t.key === at ? 'border-[var(--s-accent)] font-medium text-[var(--s-ink)]' : 'border-transparent text-[var(--s-ink-2)] hover:text-[var(--s-ink)]'}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
