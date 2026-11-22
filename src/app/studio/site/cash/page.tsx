import type { Metadata } from 'next';
import { getCurrentUser } from '@/modules/auth/session';
import { myCash } from '@/modules/petty-cash/store';
import { CashScreen } from './CashUi';

export const metadata: Metadata = { title: 'Cash', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Site mode · Cash (owner, 21 Nov 2026): the petty cash given to me (mark it
 * received), what I spent, what is still with me, and an expense: amount,
 * project (mine first, any other allowed), what for, and the bill photo.
 */
export default async function SiteCashPage() {
  const [user, cash] = await Promise.all([getCurrentUser(), myCash()]);
  return (
    <>
      <div className="st-head">
        <div style={{ minWidth: 0 }}>
          {user?.name ? <span className="who">{user.name}</span> : null}
          <h1>Petty cash</h1>
        </div>
      </div>
      <div className="st-page">{cash ? <CashScreen cash={cash} /> : <p className="muted">Sign in to your studio to see your petty cash.</p>}</div>
    </>
  );
}
