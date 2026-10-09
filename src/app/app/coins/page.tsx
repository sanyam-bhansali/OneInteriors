'use client';

/**
 * Home Coins (v79 design, owner's rules 9 Oct 2026): the balance, the
 * streak, what earned what, and the ways to earn. 1 coin = ₹1 with partner
 * brands; never on the studio's bill, never cashed out, and they lapse 12
 * months after handover. Spending opens once partner brands are signed —
 * until then this says so rather than listing offers that do not exist.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Frame, Head, Tabs } from '@/components/app/ui';
import { COINS, STREAK_DAYS, WAYS_TO_EARN } from '@/modules/engagement/coin-rules';
import { shortDate } from '@/modules/app/project-view';
import { walletAction } from '../engage/actions';

type State = Awaited<ReturnType<typeof walletAction>> | null;

export default function AppCoins() {
  const [s, setS] = useState<State>(null);
  useEffect(() => {
    void walletAction().then(setS);
  }, []);

  return (
    <Frame>
      <Head back="/app/me" />
      <main className="oa-body">
        <h1 className="oa-title">Your Home Coins</h1>
        {s && !s.ok ? (
          <>
            <p className="oa-sub">{s.error}</p>
            {s.signIn ? (
              <Link href="/sign-in?next=/app/coins" className="oa-cta">
                Sign in
              </Link>
            ) : null}
          </>
        ) : null}
        {s?.ok ? <Wallet w={s.wallet} /> : null}
      </main>
      <Tabs />
    </Frame>
  );
}

function Wallet({ w }: { w: Extract<NonNullable<State>, { ok: true }>['wallet'] }) {
  return (
    <>
      <section className="oa-coins">
        <span className="coin" aria-hidden />
        <b>{w.balance.toLocaleString('en-IN')}</b>
        <span>
          1 coin = ₹1 with our partners
          {w.expiresOn ? ` · lapses ${shortDate(w.expiresOn)}, 12 months after handover` : ''}
        </span>
      </section>

      <div className="oa-card">
        <b style={{ fontSize: 16 }}>
          {w.streak ? `${w.streak}-day streak` : 'No streak yet'}
        </b>
        <p className="oa-note" style={{ marginTop: 4 }}>
          Open the day&rsquo;s site update for {COINS.DAILY_UPDATE.coins} coins.{' '}
          {w.streak % STREAK_DAYS ? `${STREAK_DAYS - (w.streak % STREAK_DAYS)} more day${STREAK_DAYS - (w.streak % STREAK_DAYS) === 1 ? '' : 's'} for +${COINS.STREAK_7.coins}.` : `Every ${STREAK_DAYS} days in a row earns +${COINS.STREAK_7.coins}.`}
        </p>
      </div>

      <Link href="/app/refer" className="oa-card-dark oa-refer-card">
        <span className="oa-label" style={{ margin: 0, color: '#f2c98a' }}>
          Earn {COINS.REFERRAL_SIGNED.coins.toLocaleString('en-IN')} coins
        </span>
        <b>For every friend who signs. They get {COINS.REFERRAL_SIGNED.coins.toLocaleString('en-IN')} too.</b>
      </Link>

      <section>
        <p className="oa-label">Spend your coins</p>
        <div className="oa-card">
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            Spending opens when our partner brands for furniture, decor, appliances and a deep clean after handover are confirmed. Your coins keep adding up until then.
          </p>
          <p className="oa-note" style={{ marginTop: 8 }}>
            Coins can&rsquo;t be used on your studio&rsquo;s bill or cashed out.
          </p>
        </div>
      </section>

      {w.entries.length ? (
        <section>
          <p className="oa-label">Recent</p>
          <div className="oa-list">
            {w.entries.map((e, i) => (
              <div key={`${e.at}-${i}`} className="oa-row" style={{ cursor: 'default' }}>
                <span>
                  <span className="oa-row-title" style={{ fontSize: 16 }}>
                    {COINS[e.kind as keyof typeof COINS]?.label ?? e.note}
                  </span>
                  <span className="oa-row-sub">
                    {e.note !== COINS[e.kind as keyof typeof COINS]?.label ? `${e.note} · ` : ''}
                    {shortDate(e.at)}
                  </span>
                </span>
                <span className="oa-row-price">+{e.coins.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <p className="oa-label">Ways to earn</p>
        <div className="oa-list">
          {WAYS_TO_EARN.map((k) => (
            <div key={k} className="oa-row" style={{ cursor: 'default' }}>
              <span className="oa-row-title" style={{ fontSize: 16 }}>
                {COINS[k].label}
              </span>
              <span className="oa-row-price">
                {COINS[k].coins.toLocaleString('en-IN')}
                {k === 'DAILY_UPDATE' ? ' a day' : ''}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
