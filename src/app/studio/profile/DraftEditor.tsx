'use client';

import { useActionState } from 'react';
import { generateDraftAction, approveDraftAction, type DraftState } from './actions';

const INITIAL: DraftState = { status: 'idle' };

export interface EditorDraft {
  headline: string;
  introduction: string;
  notFor: string;
  stories: { title: string; story: string }[];
  issues: { field: string; problem: string }[];
  generatedAt: string;
  approvedAt: string | null;
}

export function GenerateButton({ hasDraft }: { hasDraft: boolean }) {
  const [state, action, pending] = useActionState(generateDraftAction, INITIAL);

  return (
    <form action={action}>
      {state.status === 'error' ? (
        <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-atrisk)]">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-6 py-3 text-[15px] text-[var(--color-ink)] hover:border-[var(--color-ink-3)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? 'Writing…' : hasDraft ? 'Draft it again' : 'Draft it for me'}
      </button>
      {pending ? (
        <p className="m-0 mt-2 text-[13.5px] text-[var(--color-ink-3)]">
          Reading your projects. Takes about twenty seconds.
        </p>
      ) : null}
    </form>
  );
}

/**
 * The draft, editable.
 *
 * Every field is a textarea rather than read-only text with an "edit" button,
 * because the studio approving copy they have not touched is the outcome to
 * avoid. Making it obviously editable is what turns approval into a decision
 * instead of a click.
 */
export function DraftEditor({ draft }: { draft: EditorDraft }) {
  const [state, action, pending] = useActionState(approveDraftAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-8">
      {draft.issues.length > 0 ? (
        <div className="rounded-[12px] border border-[var(--color-atrisk)] bg-[var(--color-atrisk-soft)] p-5">
          <p className="label m-0 mb-2 text-[var(--color-atrisk)]">
            The honesty check found {draft.issues.length} problem
            {draft.issues.length === 1 ? '' : 's'}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {draft.issues.map((issue, i) => (
              <li key={i} className="text-[14px] leading-snug text-[var(--color-ink-2)]">
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                  {issue.field}
                </span>{' '}
                — {issue.problem}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-3 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
            These are numbers or claims that do not appear in what you told us. Edit them out
            before approving — anything published here is your claim, not ours.
          </p>
        </div>
      ) : null}

      <Box
        label="Headline"
        name="headline"
        rows={2}
        defaultValue={draft.headline}
        hint="One line, under 90 characters. Sits under your studio name."
      />

      <Box
        label="Introduction"
        name="introduction"
        rows={8}
        defaultValue={draft.introduction}
        hint="This replaces your description. Two or three paragraphs."
      />

      <div>
        <p className="label m-0 mb-2">Project stories</p>
        <div className="flex flex-col gap-5">
          {draft.stories.map((s, i) => (
            <div key={i} className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-5">
              <input type="hidden" name={`story-title-${i}`} value={s.title} />
              <p className="m-0 mb-2 text-[15px] font-bold text-[var(--color-ink)]">{s.title}</p>
              <textarea
                name={`story-${i}`}
                rows={4}
                defaultValue={s.story}
                className="w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-[15px] leading-relaxed"
              />
            </div>
          ))}
        </div>
      </div>

      <Box
        label="Who you are not for"
        name="notFor"
        rows={4}
        defaultValue={draft.notFor}
        hint="Keep this candid. Customers trust the rest of your page more because of it, and it saves you meetings you did not want."
      />

      <div className="border-t border-[var(--color-rule)] pt-6">
        {state.status === 'error' ? (
          <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-atrisk)]">
            {state.message}
          </p>
        ) : null}
        {state.status === 'done' ? (
          <p className="m-0 mb-3 rounded-[10px] bg-[var(--color-ontrack-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-ontrack)]">
            {state.message}
          </p>
        ) : null}

        <p className="m-0 mb-4 max-w-[60ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
          Approving makes this your profile copy. Nothing on your page will say it was drafted —
          because once you have approved it, it is yours, and you are the one standing behind it.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Saving…' : draft.approvedAt ? 'Save changes' : 'Approve this copy'}
        </button>
      </div>
    </form>
  );
}

function Box({
  label,
  name,
  rows,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  rows: number;
  defaultValue: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label m-0 mb-2 block">
        {label}
      </label>
      {hint ? (
        <p className="m-0 mb-2 max-w-[56ch] text-[13.5px] leading-snug text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="w-full rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4 text-[15.5px] leading-relaxed"
      />
    </div>
  );
}
