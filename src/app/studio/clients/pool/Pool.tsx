'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { ClientRow } from '@/modules/studio-practice/clients';
import { assignAction } from '../actions';

/**
 * The pool, as a list you can act on in bulk.
 *
 * ## Why a list and not the board's cards
 *
 * A card is for a lead you are working; a row is for a lead you are
 * triaging. The decision here is only ever "mine, theirs, or not yet", and
 * making that decision forty times needs forty checkboxes and one button —
 * not forty cards to read.
 *
 * ## Selection is ids, deliberately
 *
 * AxLeads' pool selects by *filter plus count* rather than by id, because at
 * 3,048 unassigned leads shipping the id list is the wrong shape. We hold
 * the ids because `myClients()` takes 400 and a studio with 400 untaken leads
 * has a problem this screen cannot fix. When that stops being true this has
 * to change, and the comment is here so the next person knows it is a
 * deliberate ceiling rather than an oversight.
 */
export function PoolList({
  rows,
  members,
  myMemberId,
}: {
  rows: ClientRow[];
  members: { id: string; name: string }[];
  /** Null when the signed-in person has no membership row — ops, impersonating. */
  myMemberId: string | null;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allPicked = rows.length > 0 && picked.size === rows.length;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function assign(memberId: string | null) {
    const ids = [...picked];
    if (ids.length === 0) return;
    setError(null);
    start(async () => {
      /* `State` is a three-way union — idle, ok, or error — so neither `ok`
         nor `error` can be read without narrowing first. Testing 'error' in
         result rather than result.ok, because the idle branch has neither. */
      const result = await assignAction(ids, memberId);
      if ('error' in result) setError(result.error);
      else setPicked(new Set());
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-[var(--s-rule)] px-6 py-12 text-center">
        <p className="m-0 text-[15px] font-medium">Nothing waiting.</p>
        <p className="m-0 mt-1.5 text-[13.5px] text-[var(--s-ink-3)]">
          Every open lead has somebody working on it. New ones land here when they arrive
          unassigned — an import, or an introduction from us.
        </p>
        <Link
          href="/studio/clients"
          className="mt-5 inline-block rounded-[8px] border border-[var(--s-rule)] px-3.5 py-2 text-[13.5px] font-medium no-underline hover:border-[var(--s-ink-3)]"
        >
          Back to the board
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The action bar holds its height whether or not anything is selected.
          A bar that appears on first tick shifts every row down by 48px at
          the exact moment somebody is aiming at the second checkbox. */}
      <div className="flex min-h-[38px] flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-2 text-[13.5px] text-[var(--s-ink-2)]">
          <input
            type="checkbox"
            checked={allPicked}
            onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)))}
            className="h-4 w-4 accent-[var(--s-accent)]"
          />
          {picked.size > 0 ? `${picked.size} selected` : 'Select all'}
        </label>

        {picked.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Taking it yourself is the overwhelmingly common case, so it is
                a button and everything else is behind a menu. */}
            {myMemberId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => assign(myMemberId)}
                className="rounded-[8px] bg-[var(--s-accent)] px-3.5 py-1.5 text-[13.5px] font-medium text-white disabled:opacity-50"
              >
                {pending ? 'Taking…' : `Take ${picked.size === 1 ? 'it' : 'these'}`}
              </button>
            ) : null}

            <select
              disabled={pending}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) assign(e.target.value);
                e.target.value = '';
              }}
              className="rounded-[8px] border border-[var(--s-rule)] bg-transparent px-2.5 py-1.5 text-[13.5px] disabled:opacity-50"
            >
              <option value="" disabled>
                Give to…
              </option>
              {members
                .filter((m) => m.id !== myMemberId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="m-0 text-[13.5px] text-[var(--s-danger,#98371f)]">
          {error}
        </p>
      ) : null}

      <ul className="m-0 flex list-none flex-col gap-px overflow-hidden rounded-[12px] border border-[var(--s-rule)] bg-[var(--s-rule)] p-0">
        {rows.map((row) => (
          <li key={row.id} className="bg-[var(--s-card,var(--s-rail))]">
            <div className="flex items-center gap-3 px-3.5 py-3">
              <input
                type="checkbox"
                checked={picked.has(row.id)}
                onChange={() => toggle(row.id)}
                aria-label={`Select ${row.name}`}
                className="h-4 w-4 flex-none accent-[var(--s-accent)]"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/studio/clients/${row.id}`}
                    className="truncate text-[14.5px] font-medium no-underline hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.fromMarketplace ? (
                    <span className="s-label rounded-full bg-[var(--s-accent)]/12 px-1.5 py-px normal-case tracking-normal text-[var(--s-accent)]">
                      From us
                    </span>
                  ) : null}
                </div>
                {/* One line of context, chosen so the triage decision can be
                    made without opening anything: where, what, how big. */}
                <p className="m-0 mt-0.5 truncate text-[13px] text-[var(--s-ink-3)]">
                  {[row.config, row.locality ?? row.society, sqft(row.carpetSqft)]
                    .filter(Boolean)
                    .join(' · ') || 'No details yet'}
                </p>
              </div>

              <span className="s-num hidden flex-none text-[12.5px] text-[var(--s-ink-3)] sm:block">
                {waitingFor(row.updatedAt)}
              </span>
              <span className="s-label hidden flex-none normal-case tracking-normal text-[var(--s-ink-3)] md:block">
                {row.stageName}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sqft(n: number | null): string | null {
  return n ? `${n.toLocaleString('en-IN')} sqft` : null;
}

/**
 * How long it has been sitting there.
 *
 * Days, not a timestamp. Nobody triaging a queue cares that something arrived
 * at 14:32 on Tuesday; they care that it has been four days and nobody has
 * rung. "Today" rather than "0 days" because zero days is not a duration.
 */
function waitingFor(since: Date): string {
  const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}
