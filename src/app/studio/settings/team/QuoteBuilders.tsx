'use client';

/**
 * Settings → Team → Quotations: "Who builds quotations" (owner, 22 Oct
 * 2026; docs/studio-os/QUOTE-REQUESTS.md). Quotation requests (a floor plan
 * added to a lead, "Request quotation") go to these people in turn. Left
 * on "everyone whose role builds quotations", the turns follow the sales
 * roles; picking people sets the order, and is how an owner who quotes
 * joins the turns.
 */

import { useState } from 'react';
import type { BuildersSettings } from '@/modules/studio-quote/quote-requests';
import { Said, useAct } from '../../SalesUi';
import { saveBuildersAction } from '../../quotations/requests/actions';

export function QuoteBuilders({ settings }: { settings: BuildersSettings }) {
  const [custom, setCustom] = useState(settings.listed.length > 0);
  const [order, setOrder] = useState<string[]>(settings.listed.length > 0 ? settings.listed : settings.candidates.filter((c) => c.byRole && c.active).map((c) => c.id));
  const act = useAct();
  const byId = new Map(settings.candidates.map((c) => [c.id, c]));
  const off = settings.candidates.filter((c) => !order.includes(c.id));

  const move = (id: string, by: -1 | 1) =>
    setOrder((list) => {
      const i = list.indexOf(id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <section className="card" aria-labelledby="h-builders" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
      <div>
        <h2 id="h-builders" className="h" style={{ margin: 0 }}>
          Who builds quotations
        </h2>
        <p className="muted sm" style={{ margin: '4px 0 0', lineHeight: 1.5 }}>
          When a floor plan is added to a lead, or someone presses “Request quotation”, the quotation goes to the next person here in turn, so nobody builds
          the same one twice. They see it in Quotations, To build, and are told.
        </p>
      </div>
      <p style={{ margin: 0 }}>
        <b>Now:</b> {settings.rule}
        {settings.nextUp ? <span className="muted"> Next in turn: {settings.nextUp}.</span> : null}
      </p>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <legend className="sr-only">Who takes turns</legend>
        <label className="hstack" style={{ gap: 8 }}>
          <input type="radio" name="builders-mode" checked={!custom} onChange={() => setCustom(false)} />
          Everyone whose sales role has “Builds quotations”, in the order they joined
        </label>
        <label className="hstack" style={{ gap: 8 }}>
          <input type="radio" name="builders-mode" checked={custom} onChange={() => setCustom(true)} />
          These people, in this order
        </label>
      </fieldset>

      {custom ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.length === 0 ? <span className="muted sm">Nobody picked yet.</span> : null}
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {order.map((id, i) => {
              const c = byId.get(id);
              if (!c) return null;
              return (
                <li key={id}>
                  <span className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <b>{c.name}</b>
                    <span className="muted sm">
                      {c.role === 'OWNER' ? 'Owner' : 'Sales'}
                      {c.active ? '' : ' · not active, skipped'}
                    </span>
                    <button type="button" className="btn sec sm" disabled={i === 0} onClick={() => move(id, -1)} aria-label={`Move ${c.name} up`}>
                      ↑
                    </button>
                    <button type="button" className="btn sec sm" disabled={i === order.length - 1} onClick={() => move(id, 1)} aria-label={`Move ${c.name} down`}>
                      ↓
                    </button>
                    <button type="button" className="btn sec sm" onClick={() => setOrder((list) => list.filter((x) => x !== id))}>
                      Remove
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
          {off.length > 0 ? (
            <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
              <span className="muted sm">Add:</span>
              {off.map((c) => (
                <button key={c.id} type="button" className="btn sec sm" disabled={!c.active} onClick={() => setOrder((list) => [...list, c.id])} title={c.active ? undefined : 'Not active'}>
                  + {c.name}
                  {c.role === 'OWNER' ? ' (owner)' : ''}
                </button>
              ))}
            </div>
          ) : null}
          <span className="muted sm">Only salespeople whose role has “Builds quotations” can be picked, and the owner. Give a role the permission on the Roles tab.</span>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="btn pri sm"
          disabled={act.pending || (custom && order.length === 0)}
          onClick={() => act.run(() => saveBuildersAction(custom ? order : []))}
        >
          {act.pending ? 'Saving…' : 'Save'}
        </button>
        <Said result={act.result} />
      </div>
    </section>
  );
}
