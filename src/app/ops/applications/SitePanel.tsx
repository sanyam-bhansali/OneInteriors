'use client';

import { useActionState } from 'react';
import { formatINRCompact } from '@/lib/money';
import { PUNE_LOCALITIES } from '@/modules/brief/types';
import { scrapeSiteAction, type ScrapeState } from './actions';

const INITIAL: ScrapeState = { status: 'idle' };

/**
 * Reads what the studio says about itself on its own website.
 *
 * Everything in this panel is labelled as a claim, deliberately and
 * repeatedly. The temptation with a scraper is to let its output sit beside
 * things we actually checked until nobody remembers which is which — so the
 * panel is visually separate, and the promises it finds are framed as *work we
 * now have to do*, not as evidence.
 */
export function SitePanel({
  website,
  tradeName,
}: {
  /** May be empty — Google is searched by name either way. */
  website: string;
  tradeName: string;
}) {
  const [state, action, pending] = useActionState(scrapeSiteAction, INITIAL);

  return (
    <div className="mb-5">
      <form action={action}>
        <input type="hidden" name="website" value={website} />
        {/* Google is searched by name, so a studio with no website still
            gets a listing looked up. */}
        <input type="hidden" name="tradeName" value={tradeName} />
        <button
          type="submit"
          disabled={pending}
          className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-petrol)] underline underline-offset-4 disabled:opacity-40"
        >
          {pending ? 'Looking them up…' : 'Look them up'}
        </button>
      </form>

      {state.status === 'error' ? (
        <p role="alert" className="m-0 mt-2 text-[13.5px] text-[var(--color-atrisk)]">
          {state.message}
        </p>
      ) : null}

      {state.status === 'done' && state.listing ? (
        <div className="mt-3 rounded-[10px] border border-dashed border-[var(--color-rule)] bg-[var(--color-paper)] p-5">
          <p className="label m-0 mb-3 text-[var(--color-ink-3)]">
            Their Google listing — published by them, unaudited
          </p>
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row label="Listed as" value={state.listing.name} />
            <Row label="Address" value={state.listing.address} />
            <Row label="Phone" value={state.listing.phone} />
            <Row label="Website" value={state.listing.website} />
            {/* A rating is a number a business can buy. It sits here so ops
                knows where to look, and it is never a check. */}
            <Row
              label="Rating"
              value={
                state.listing.rating !== null
                  ? `${state.listing.rating.toFixed(1)} from ${state.listing.reviewCount ?? 0} reviews`
                  : null
              }
            />
          </dl>
          {state.listing.mapsUrl ? (
            <a
              href={state.listing.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-block text-[13.5px] font-medium text-[var(--color-petrol)]"
            >
              Open on Google Maps ↗
            </a>
          ) : null}
        </div>
      ) : null}

      {state.status === 'done' && state.instagram ? (
        <p className="m-0 mt-3 text-[13.5px] text-[var(--color-ink-2)]">
          Instagram{' '}
          <a
            href={`https://instagram.com/${state.instagram}`}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-[var(--color-petrol)]"
          >
            @{state.instagram}
          </a>{' '}
          — found on their own site or listing. We do not read their posts.
        </p>
      ) : null}

      {state.status === 'done' && state.notes && state.notes.length > 0 ? (
        <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
          {state.notes.map((n) => (
            <li key={n} className="text-[13px] text-[var(--color-ink-3)]">
              {n}
            </li>
          ))}
        </ul>
      ) : null}

      {state.status === 'done' && state.site ? (
        <div className="mt-3 rounded-[10px] border border-dashed border-[var(--color-rule)] bg-[var(--color-paper)] p-5">
          <p className="label m-0 mb-3 text-[var(--color-ink-3)]">
            From their website — their claims, not our checks
          </p>

          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row label="Contact on site" value={[...state.site.emails, ...state.site.phones].join(' · ') || null} />
            <Row label="Instagram" value={state.site.instagram} />
            <Row
              label="Areas named"
              value={
                state.site.localities
                  .map((s) => PUNE_LOCALITIES.find((p) => p.slug === s)?.label ?? s)
                  .join(', ') || null
              }
            />
            <Row
              label="Advertised from"
              value={
                state.site.startingFromPaise !== null
                  ? formatINRCompact(state.site.startingFromPaise)
                  : null
              }
            />
            <Row
              label="In business"
              value={state.site.yearsActive ? `${state.site.yearsActive} years, by their own site` : null}
            />
          </dl>

          {state.site.claims.length > 0 ? (
            <div className="mt-4 border-t border-[var(--color-rule-soft)] pt-3">
              <p className="label m-0 mb-2 text-[var(--color-ink-3)]">
                Promises they publish — each one is a check we now owe
              </p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {state.site.claims.map((c) => (
                  <li
                    key={c}
                    className="border-l-2 border-[var(--color-brass)] pl-3 text-[13.5px] leading-snug text-[var(--color-ink-2)]"
                  >
                    “{c}”
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="m-0 mt-4 text-[12.5px] leading-snug text-[var(--color-ink-3)]">
            None of this is verified. It is here so you do not have to retype it, and so the
            promises they make publicly become the list you check them against.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="label m-0">{label}</dt>
      <dd className="m-0 text-[13.5px] leading-snug text-[var(--color-ink)]">
        {value ?? <span className="text-[var(--color-ink-3)]">Not on their site</span>}
      </dd>
    </div>
  );
}
