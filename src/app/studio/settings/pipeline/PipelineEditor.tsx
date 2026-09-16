'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
// Pure module. `stages.ts` carries `server-only` and these are values, not
// types — importing them from there pulls Prisma into the browser bundle and
// the build stops. CONTRIBUTING §9.5.
import {
  COLOUR_TOKENS,
  STAGE_COLOURS,
  STAGE_KIND_LABELS,
  STAGE_KIND_NOTES,
  colourOf,
  type ColourToken,
  type StageKindName,
} from '@/modules/studio-practice/vocabulary';
import type { StageRow } from '@/modules/studio-practice/stages';
import {
  addStageAction,
  renameStageAction,
  recolourStageAction,
  setKindAction,
  moveStageAction,
  setIntakeAction,
  removeStageAction,
  IDLE,
  type State,
} from './actions';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const KINDS = Object.keys(STAGE_KIND_LABELS) as StageKindName[];

/** The eight swatches. A token each, never a free picker — see `vocabulary.ts`. */
function Swatches({
  value,
  onPick,
  disabled,
}: {
  value: ColourToken;
  onPick: (c: ColourToken) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-none items-center gap-1">
      {COLOUR_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          disabled={disabled}
          aria-label={token}
          aria-pressed={value === token}
          onClick={() => onPick(token)}
          className={`h-[18px] w-[18px] rounded-full transition-transform disabled:opacity-40 ${
            value === token
              ? 'ring-2 ring-[var(--s-ink)] ring-offset-2 ring-offset-[var(--s-surface)]'
              : 'hover:scale-110'
          }`}
          style={{ background: STAGE_COLOURS[token].dot }}
        />
      ))}
    </div>
  );
}

/**
 * One row of the pipeline.
 *
 * Everything on it saves immediately except the name, which saves on blur —
 * a rename is the one edit somebody makes mid-thought, and a Save button per
 * row for eleven rows is eleven buttons nobody presses.
 */
function StageLine({ stage, canMoveUp, canMoveDown }: {
  stage: StageRow;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(stage.name);

  // The row is re-rendered from the server after every edit. Without this, a
  // rename that the server refused would leave the rejected text in the box.
  useEffect(() => setName(stage.name), [stage.name]);

  const run = (fn: () => Promise<State>) =>
    start(async () => {
      const result = await fn();
      setError('ok' in result && !result.ok ? result.error : null);
    });

  const c = colourOf(stage.colour);

  return (
    <li className="flex flex-col gap-2 border-b border-[var(--s-rule-soft)] py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-none flex-col">
          <button
            type="button"
            aria-label="Move up"
            disabled={!canMoveUp || pending}
            onClick={() => run(() => moveStageAction(stage.id, 'up'))}
            className="px-1 text-[11px] leading-tight text-[var(--s-ink-3)] hover:text-[var(--s-ink)] disabled:opacity-25"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={!canMoveDown || pending}
            onClick={() => run(() => moveStageAction(stage.id, 'down'))}
            className="px-1 text-[11px] leading-tight text-[var(--s-ink-3)] hover:text-[var(--s-ink)] disabled:opacity-25"
          >
            ▼
          </button>
        </div>

        <span
          aria-hidden
          className="h-2.5 w-2.5 flex-none rounded-full"
          style={{ background: c.dot }}
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() !== stage.name) run(() => renameStageAction(stage.id, name));
          }}
          disabled={pending}
          className={`${input} min-w-[10rem] flex-1`}
        />

        <select
          value={stage.kind}
          disabled={pending}
          onChange={(e) => run(() => setKindAction(stage.id, e.target.value as StageKindName))}
          className={`${input} flex-none py-1.5`}
          title={STAGE_KIND_NOTES[stage.kind]}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>{STAGE_KIND_LABELS[k]}</option>
          ))}
        </select>

        <Swatches
          value={stage.colour}
          disabled={pending}
          onPick={(colour) => run(() => recolourStageAction(stage.id, colour))}
        />

        {stage.isIntake ? (
          <span className="s-tag flex-none !bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]">
            Intake
          </span>
        ) : (
          <button
            type="button"
            disabled={pending || stage.kind !== 'OPEN'}
            onClick={() => run(() => setIntakeAction(stage.id))}
            title={
              stage.kind === 'OPEN'
                ? 'New clients land here'
                : 'New clients have to land in a column that is still in play'
            }
            className="flex-none text-[12.5px] text-[var(--s-ink-3)] underline-offset-2 hover:text-[var(--s-ink)] hover:underline disabled:no-underline disabled:opacity-40"
          >
            Make intake
          </button>
        )}

        <span className="s-num s-label flex-none">{stage.clientCount}</span>

        <button
          type="button"
          aria-label={`Delete ${stage.name}`}
          disabled={pending || stage.isIntake}
          onClick={() => run(() => removeStageAction(stage.id))}
          className="flex-none px-1 text-[15px] leading-none text-[var(--s-ink-3)] hover:text-[var(--s-bad)] disabled:opacity-25"
        >
          ×
        </button>
      </div>

      {error ? (
        <p role="alert" className="m-0 pl-9 text-[12.5px] text-[var(--s-bad)]">{error}</p>
      ) : null}
    </li>
  );
}

function NewStage() {
  const [state, action, pending] = useActionState(addStageAction, IDLE);
  const [colour, setColour] = useState<ColourToken>('slate');
  const [key, setKey] = useState(0);

  // Reset the form after a column is added, so the next one starts empty.
  useEffect(() => {
    if ('ok' in state && state.ok) setKey((k) => k + 1);
  }, [state]);

  return (
    <form key={key} action={action} className="flex flex-wrap items-end gap-3 pt-4">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
        <span className="s-label">Another column</span>
        <input name="name" required placeholder="Site measurement done" className={input} />
      </label>

      <label className="flex flex-none flex-col gap-1.5">
        <span className="s-label">Means</span>
        <select name="kind" defaultValue="OPEN" className={input}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{STAGE_KIND_LABELS[k]}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-none flex-col gap-1.5">
        <span className="s-label">Colour</span>
        <input type="hidden" name="colour" value={colour} />
        <div className="py-1.5">
          <Swatches value={colour} onPick={setColour} />
        </div>
      </div>

      <button type="submit" disabled={pending} className={primary}>
        {pending ? 'Adding…' : 'Add'}
      </button>

      {'ok' in state && !state.ok ? (
        <p role="alert" className="m-0 w-full text-[12.5px] text-[var(--s-bad)]">{state.error}</p>
      ) : null}
    </form>
  );
}

export function PipelineEditor({ stages }: { stages: StageRow[] }) {
  return (
    <div className="s-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[15.5px] font-semibold">Your columns</h2>
        <p className="m-0 text-[13px] text-[var(--s-ink-3)]">
          In the order work moves. Drag is coming; the arrows work now.
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col p-0">
        {stages.map((stage, i) => (
          <StageLine
            key={stage.id}
            stage={stage}
            canMoveUp={i > 0}
            canMoveDown={i < stages.length - 1}
          />
        ))}
      </ul>

      <NewStage />
    </div>
  );
}
