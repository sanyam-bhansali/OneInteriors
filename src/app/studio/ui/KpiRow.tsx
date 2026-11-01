import Link from 'next/link';
import type { Kpi, KpiTone } from '@/modules/studio/app-kpis';

/**
 * The row of numbers at the top of every app (owner, 1 Nov 2026: "while
 * opening any tab like projects, quotations, there should first be a section
 * of KPIs like we have in Clients"). The Clients cards' look (clients.css
 * `cl-stat`), for any app: each card a number, a line under it, and, where
 * there is one, the list behind the number one click away. Money is shown
 * only where the page already shows it to this person.
 */

const TONE: Record<KpiTone, string> = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', acc: 'var(--acc)' };

export function KpiRow({ items, label }: { items: readonly Kpi[]; label: string }) {
  if (!items.length) return null;
  return (
    <section className="kpi-row" aria-label={label} data-testid="kpi-row" style={{ ['--kpi-cols' as string]: String(Math.min(6, items.length)) }}>
      {items.map((k) => {
        const body = (
          <>
            <span className="l">{k.label}</span>
            <span className="v">{typeof k.value === 'number' ? k.value.toLocaleString('en-IN') : k.value}</span>
            {k.note ? (
              <span className="s" style={k.tone ? { color: TONE[k.tone], fontWeight: 500 } : undefined}>
                {k.note}
              </span>
            ) : null}
          </>
        );
        return k.href ? (
          <Link key={k.label} href={k.href} className="kpi" aria-current={k.active ? 'true' : undefined}>
            {body}
          </Link>
        ) : (
          <div key={k.label} className="kpi">
            {body}
          </div>
        );
      })}
    </section>
  );
}
