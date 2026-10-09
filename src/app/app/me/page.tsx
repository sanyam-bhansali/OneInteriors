'use client';

/**
 * Me (v79 design): who is signed in, their home, the Locker, notifications,
 * help, privacy and signing out. The Locker lives here now, not in the tab
 * bar.
 *
 * Only what is real is listed. The design's Home Coins, Family, Dream board
 * and Refer rows arrive with those features; the language picker arrives
 * with the Hindi and Marathi copy; a call and WhatsApp line arrive once
 * there is a support number to put behind them.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BellIcon, Frame, Tabs, useBrief } from '@/components/app/ui';
import { useMyProject } from '@/components/app/useMyProject';
import { ARCHITECT } from '@/modules/consultation/architect';
import { localityLabel } from '@/modules/brief/types';
import { TIER } from '@/modules/quotation/tiers';
import { walletAction } from '../engage/actions';

const HOMES: Record<string, string> = { BHK_1: '1 BHK', BHK_2: '2 BHK', BHK_3: '3 BHK', BHK_4_PLUS: '4+ BHK', VILLA: 'Villa' };
const expert = ARCHITECT.name.split(' ')[0];

type Me = { name: string | null; phone: string | null } | null;

export default function AppMe() {
  const router = useRouter();
  const [brief] = useBrief();
  const mine = useMyProject();
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [unread, setUnread] = useState(0);
  const [coins, setCoins] = useState<{ balance: number; streak: number } | null>(null);

  useEffect(() => {
    let live = true;
    void fetch('/api/app/v1/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { user?: Me } | null) => live && setMe(b?.user ?? null))
      .catch(() => live && setMe(null));
    void fetch('/api/app/v1/notifications', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { unread?: number } | null) => live && setUnread(b?.unread ?? 0))
      .catch(() => {});
    void walletAction().then((r) => live && r.ok && setCoins({ balance: r.wallet.balance, streak: r.wallet.streak }));
    return () => {
      live = false;
    };
  }, []);

  const name = me?.name ?? brief?.contactName ?? null;
  const home = [
    brief?.propertyType ? HOMES[brief.propertyType] : null,
    brief?.carpetAreaSqft ? `${brief.carpetAreaSqft.toLocaleString('en-IN')} sq ft` : null,
    brief?.tier ? TIER[brief.tier].label : null,
    mine.state === 'real' ? mine.project.studio : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const signOut = async () => {
    await fetch('/api/app/v1/auth/sign-out', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    router.push('/app');
  };

  return (
    <Frame>
      <header className="oa-page-head">
        <h1>Me</h1>
      </header>
      <main className="oa-body">
        <section className="oa-me">
          <span className="oa-avatar" aria-hidden>
            {(name ?? '?').charAt(0).toUpperCase()}
          </span>
          <div>
            <b>{name ?? (me === null ? 'Not signed in' : ' ')}</b>
            {me?.phone ? <span className="mono">{me.phone}</span> : null}
          </div>
        </section>

        {brief?.locality || home ? (
          <div className="oa-card">
            <b style={{ fontSize: 16 }}>{localityLabel(brief?.locality) ?? 'Your home'}</b>
            {home ? <p className="oa-note" style={{ marginTop: 4 }}>{home}</p> : null}
          </div>
        ) : null}

        <nav className="oa-list" aria-label="Your account">
          <Row href="/app/locker" title="Home locker" sub="Agreement, drawings, receipts, warranties" />
          <Row
            href="/app/notifications"
            title="Notifications"
            sub={unread ? `${unread} unread` : 'Site updates, decisions and payments'}
            icon={<BellIcon />}
          />
          <Row
            href="/app/coins"
            title="Home Coins"
            sub={coins ? `${coins.balance.toLocaleString('en-IN')} coins${coins.streak ? ` · ${coins.streak}-day streak` : ''}` : 'Earn as your home comes together'}
          />
          <Row href="/app/family" title="Family" sub="They see every update and vote on decisions" />
          <Row href="/app/dream" title="Dream board" sub="Photos you love, shared with your studio" />
          <Row href="/app/refer" title="Refer and earn" sub="Give 5,000, get 5,000" />
          <Row href="/app/geio?ask=expert" title={`Ask ${expert}`} sub="Your One Interiors expert. She earns nothing from any studio." />
          <Row href="/app/geio" title="Ask GEIO" sub="Anything about your home, in plain words" />
          <Row href="/privacy" title="Privacy and your data" sub="What we keep, and how to have it removed" />
        </nav>

        {me ? (
          <button type="button" className="oa-cta outline" onClick={() => void signOut()}>
            Log out
          </button>
        ) : me === null ? (
          <Link href="/sign-in?next=/app/me" className="oa-cta">
            Sign in
          </Link>
        ) : null}
        <p className="oa-note" style={{ textAlign: 'center' }}>
          One Interiors
        </p>
      </main>
      <Tabs />
    </Frame>
  );
}

function Row({ href, title, sub, icon }: { href: string; title: string; sub: string; icon?: React.ReactNode }) {
  return (
    <Link href={href} className="oa-row" style={{ textDecoration: 'none' }}>
      <span>
        <span className="oa-row-title">{title}</span>
        <span className="oa-row-sub">{sub}</span>
      </span>
      <span className="oa-row-end" aria-hidden>
        {icon}→
      </span>
    </Link>
  );
}
