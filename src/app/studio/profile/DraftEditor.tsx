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
        <p role="alert" className="ox-err" style={{ marginBottom: 12 }}>
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn acc"
      >
        {pending ? 'Writing…' : hasDraft ? 'Draft it again' : 'Draft it for me'}
      </button>
      {pending ? (
        <p className="muted sm" style={{ margin: '8px 0 0' }}>
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
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {draft.issues.length > 0 ? (
        <div className="ls-warn">
          <b style={{ fontSize: 14 }}>
            The honesty check found {draft.issues.length} problem
            {draft.issues.length === 1 ? '' : 's'}
          </b>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {draft.issues.map((issue, i) => (
              <li key={i} className="sm" style={{ color: 'var(--text2)' }}>
                <span className="mono muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {issue.field}
                </span>{' '}
                — {issue.problem}
              </li>
            ))}
          </ul>
          <p className="sm" style={{ margin: 0, color: 'var(--text2)' }}>
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
        <span className="lbl">Project stories</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {draft.stories.map((s, i) => (
            <div key={i} className="ls-story">
              <input type="hidden" name={`story-title-${i}`} value={s.title} />
              <b style={{ fontSize: 15 }}>{s.title}</b>
              <textarea
                name={`story-${i}`}
                rows={4}
                defaultValue={s.story}
                className="fld"
                style={{ background: 'var(--paper)' }}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, borderTop: '1px solid var(--fill2)' }}>
        {state.status === 'error' ? (
          <p role="alert" className="ox-err">
            {state.message}
          </p>
        ) : null}
        {state.status === 'done' ? (
          <p className="ox-ok">
            {state.message}
          </p>
        ) : null}

        <p className="muted sm" style={{ margin: 0, maxWidth: '60ch' }}>
          Approving makes this your profile copy. Nothing on your page will say it was drafted —
          because once you have approved it, it is yours, and you are the one standing behind it.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="btn pri lg"
          style={{ alignSelf: 'flex-start' }}
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
      <label htmlFor={name} className="lbl" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {hint ? (
        <p className="muted sm" style={{ margin: '0 0 8px', maxWidth: '56ch' }}>
          {hint}
        </p>
      ) : null}
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="fld"
      />
    </div>
  );
}
