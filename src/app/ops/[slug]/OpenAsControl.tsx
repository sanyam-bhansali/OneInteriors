'use client';

import { useActionState, useEffect } from 'react';
import { startViewAsAction, type ViewAsActionState } from './actions';

export interface OpenAsPerson {
  id: string;
  name: string;
  role: string;
  salesRole: string | null;
  status: string;
}

const ROLE_WORDS: Record<string, string> = {
  OWNER: 'Owner',
  PM: 'Project manager',
  SUPERVISOR: 'Site supervisor',
  ACCOUNTS: 'Accounts',
  SALES: 'Sales',
  DESIGNER: 'Designer',
};

/**
 * Developer access, "Open as…" (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md).
 *
 * Pick one of the studio's people and the studio software opens as them —
 * their home, their apps, the leads their sales role reaches, their projects —
 * read only, for two hours, with a banner and a Stop on every page. Every
 * start is in the audit log. Nothing here decides anything: the server checks
 * the role and that the person is on this studio.
 */
export function OpenAsControl({ studioId, people }: { studioId: string; people: OpenAsPerson[] }) {
  const [state, action, pending] = useActionState<ViewAsActionState, FormData>(startViewAsAction, null);

  /* A full page load: the studio is another host when the hosts are split. */
  useEffect(() => {
    if (state && 'url' in state) window.location.assign(state.url);
  }, [state]);

  return (
    <div className="border-t border-[var(--color-rule)] pt-4" data-testid="open-as">
      <p className="label m-0 mb-1">Open as… (developer access)</p>
      <p className="m-0 mb-3 text-[13px] leading-snug text-[var(--color-ink-2)]">
        See this studio’s software exactly as one of its people does, to check a bug. Read only, for two hours; nothing can be
        changed while you look. Recorded in the audit log.
      </p>
      {people.length === 0 ? (
        <p className="m-0 text-[13px] italic text-[var(--color-ink-3)]">Nobody is on this studio’s team yet.</p>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="studioId" value={studioId} />
          <label className="sr-only" htmlFor="open-as-member">
            Person
          </label>
          <select
            id="open-as-member"
            name="memberId"
            required
            className="min-w-[16rem] rounded-full border border-[var(--color-rule)] bg-transparent px-3 py-1.5 text-[13px]"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {ROLE_WORDS[p.role] ?? p.role}
                {p.salesRole ? ` · ${p.salesRole}` : ''}
                {p.status !== 'ACTIVE' ? ` (${p.status.toLowerCase()})` : ''}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || (state !== null && 'url' in state)}
            data-testid="open-as-go"
            className="rounded-full border border-[var(--color-petrol)] px-4 py-1.5 text-[13px] text-[var(--color-petrol)] hover:bg-[var(--color-petrol)] hover:text-[var(--color-paper)] disabled:opacity-60"
          >
            {pending || (state !== null && 'url' in state) ? 'Opening…' : 'Open, read only'}
          </button>
        </form>
      )}
      {state && 'error' in state ? (
        <p role="alert" className="m-0 mt-2 text-[13px] leading-snug text-[var(--color-atrisk)]">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
