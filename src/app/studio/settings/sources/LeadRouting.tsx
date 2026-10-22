'use client';

import { useState } from 'react';
import type { LeadRoutingScreen, RoutingPerson } from '@/modules/studio-sales/settings';
import type { LeadRouteModeName } from '@/modules/studio-sales/lead-routing';
import { saveLeadRoutingAction } from './routing-actions';
import { Said, useAct } from '../../SalesUi';

/**
 * Settings → Lead sources, "New leads go to" (owner, 22 Oct 2026;
 * studio-sales/lead-routing.ts): the pool, one person, or take turns. Only
 * for leads that arrive by themselves (lead ads, Google forms, the website,
 * portals, the enquiry form); a lead somebody adds by hand or imports keeps
 * whoever they chose.
 */

const MODE_LABELS: Record<LeadRouteModeName, string> = {
  POOL: 'The pool',
  PERSON: 'A person',
  TURNS: 'Take turns',
};

const ROLE_WORDS: Record<string, string> = { OWNER: 'owner', PM: 'project manager', SALES: 'sales' };

function personLabel(p: RoutingPerson): string {
  return `${p.name}${ROLE_WORDS[p.role] ? ` (${ROLE_WORDS[p.role]})` : ''}${p.canTake ? '' : ' — cannot take leads now'}`;
}

export function LeadRouting({ screen }: { screen: LeadRoutingScreen }) {
  const [mode, setMode] = useState<LeadRouteModeName>(screen.routing.mode);
  const [personId, setPersonId] = useState(screen.routing.personId ?? '');
  const [turnIds, setTurnIds] = useState<string[]>(screen.routing.turnIds);
  const { pending, result, run } = useAct();

  if (!screen.canManage) return null;

  const takers = screen.people.filter((p) => p.canTake);
  const toggle = (id: string) => setTurnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div>
        <h2 className="m-0 text-[16px] font-semibold">New leads go to</h2>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed muted">
          For leads that come in by themselves: your lead ads, Google forms, website, portals and enquiry form. A lead you add by hand or import is not affected. Someone who enquires again stays with whoever already has them.
        </p>
        <p className="m-0 mt-2 text-[13.5px]">{screen.summary}</p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveLeadRoutingAction(mode, personId, turnIds));
        }}
      >
        <div role="radiogroup" aria-label="New leads go to" className="flex flex-wrap gap-3 text-[13.5px]">
          {(['POOL', 'PERSON', 'TURNS'] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5">
              <input type="radio" name="lead-route-mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              {MODE_LABELS[m]}
            </label>
          ))}
        </div>

        {mode === 'POOL' ? <p className="m-0 text-[12.5px] muted">Nobody is given them. The owner and project managers are told, and anyone who works leads can take one from the pool.</p> : null}

        {mode === 'PERSON' ? (
          <div className="flex flex-col gap-1">
            <select aria-label="The person new leads go to" value={personId} onChange={(e) => setPersonId(e.target.value)} className="fld w-auto max-w-[24rem]">
              <option value="">Pick someone</option>
              {screen.people.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.canTake}>
                  {personLabel(p)}
                </option>
              ))}
            </select>
            <p className="m-0 text-[12.5px] muted">They are told in their inbox. If they are suspended or leave, new leads go back to the pool.</p>
          </div>
        ) : null}

        {mode === 'TURNS' ? (
          <div className="flex flex-col gap-1">
            {takers.length < 2 ? <p className="m-0 text-[12.5px] muted">Taking turns needs at least two people who work leads. Add salespeople in Settings → Team.</p> : null}
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px]">
              {screen.people.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={turnIds.includes(p.id)} disabled={!p.canTake && !turnIds.includes(p.id)} onChange={() => toggle(p.id)} />
                    {personLabel(p)}
                    {turnIds.includes(p.id) ? <span className="text-[12px] muted">#{turnIds.indexOf(p.id) + 1}</span> : null}
                  </label>
                </li>
              ))}
            </ul>
            <p className="m-0 text-[12.5px] muted">Each new lead goes to the next person in this order. Anyone suspended or gone is skipped until they are back.</p>
          </div>
        ) : null}

        <div>
          <button type="submit" disabled={pending || (mode === 'PERSON' && !personId) || (mode === 'TURNS' && turnIds.length < 2)} className="btn pri sm">
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
        <Said result={result} />
      </form>
    </section>
  );
}
