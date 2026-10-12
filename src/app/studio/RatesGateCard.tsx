'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { confirmRatesAction } from './products/actions';
import type { State } from './form-state';
import './office-ui.css';

/**
 * Where a studio's rates are, and the one thing to do about it.
 *
 * Shown on Quotations (the builder is shut until confirm), on Product master
 * (where the checking happens, so the confirm button lives here) and on the
 * dashboard. The wording comes from `RATES_GATE_COPY` so the three never say
 * different things.
 */
export function RatesGateCard({
  gate,
  title,
  body,
  where,
}: {
  gate: 'WITH_US' | 'TO_CHECK';
  title: string;
  body: string;
  /** 'products' shows the confirm button; anywhere else links to Product master. */
  where: 'products' | 'elsewhere';
}) {
  const [state, confirm, pending] = useActionState<State | null>(confirmRatesAction, null);

  return (
    <div className="card" style={{ boxShadow: `inset 3px 0 0 ${gate === 'TO_CHECK' ? 'var(--good-s)' : 'var(--warn-s)'}`, marginBottom: 4 }}>
      <div className="chead">
        <h2>{title}</h2>
        <span className={gate === 'TO_CHECK' ? 'chip good' : 'chip warn'}>
          <span className="dot" />
          {gate === 'TO_CHECK' ? 'Ready to check' : 'With One Interiors'}
        </span>
      </div>
      <p className="muted" style={{ margin: 0, maxWidth: '68ch', fontSize: 14, lineHeight: 1.5 }}>
        {body}
      </p>

      {gate === 'TO_CHECK' ? (
        where === 'products' ? (
          <form action={confirm} className="hstack">
            <button type="submit" disabled={pending} className="btn pri">
              {pending ? 'Confirming…' : 'These rates are right — open the builder'}
            </button>
            <span className="muted sm">You can still change any figure afterwards.</span>
          </form>
        ) : (
          <div>
            <Link href="/studio/products" className="btn pri">
              Check your rates
            </Link>
          </div>
        )
      ) : null}

      {state && 'error' in state ? (
        <p role="alert" className="ox-err">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
