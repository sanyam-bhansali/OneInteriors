'use client';

import { useActionState, useState } from 'react';
import {
  STYLE_TAGS,
  STYLE_LABELS,
  PUNE_LOCALITIES,
  PROPERTY_LABELS,
  SCOPE_LABELS,
} from '@/modules/brief/types';
import { formatINRCompact } from '@/lib/money';
import { addProjectAction, removeProjectAction, type StepState } from './actions';
import { Field, Select, Chips, Check, SaveBar } from './fields';

const INITIAL: StepState = { status: 'idle' };

export interface ProjectRow {
  id: string;
  title: string;
  locality: string | null;
  styleTags: string[];
  valuePaise: number | null;
  completedOn: string | null;
  isRender: boolean;
}

export function PortfolioForm({
  projects,
  minimum,
}: {
  projects: ProjectRow[];
  minimum: number;
}) {
  const [adding, setAdding] = useState(projects.length === 0);
  const [state, action, pending] = useActionState(addProjectAction, INITIAL);
  const err = state.errors ?? {};

  const short = Math.max(0, minimum - projects.length);

  return (
    <div className="flex flex-col gap-9">
      <div>
        <p className="m-0 max-w-[62ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
          {short > 0 ? (
            <>
              We need <strong>{minimum}</strong> completed projects — {short} more to go. Three is
              the point at which a customer can see a pattern rather than one lucky job, and it is
              also the minimum for us to say anything honest about your delivery.
            </>
          ) : (
            <>
              That is enough to publish. Add more if you want — the ones you would most like to be
              judged on are the ones worth adding.
            </>
          )}
        </p>
      </div>

      {projects.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form action={action} className="flex flex-col gap-7 rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6">
          <p className="h3 m-0">Add a project</p>

          <Field
            label="What do you call it?"
            name="title"
            required
            error={err.title}
            hint="However you refer to it internally is fine — 'The Kharadi 3 BHK', a client surname, a building name."
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Select
              label="Area"
              name="locality"
              options={PUNE_LOCALITIES.map((l) => ({ value: l.slug, label: l.label }))}
            />
            <Select
              label="Property"
              name="propertyType"
              options={Object.entries(PROPERTY_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>

          <Select
            label="Scope"
            name="scope"
            options={Object.entries(SCOPE_LABELS).map(([value, label]) => ({ value, label }))}
          />

          <Chips
            label="Style"
            name="styleTags"
            hint="Pick from this list even if none is a perfect fit. Customers choose from exactly these words, so a style you invent here is a customer you never meet."
            options={STYLE_TAGS.map((t) => ({ value: t, label: STYLE_LABELS[t] }))}
            error={err.styleTags}
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field label="Value (₹ lakh)" name="valueLakhs" type="number" />
            <Field label="Days taken" name="durationDays" type="number" />
            <Field label="Completed on" name="completedOn" type="date" error={err.completedOn} />
          </div>

          {/* The honesty rules, as checkboxes, because a rule that is only in a
              policy document is not a rule. */}
          <div className="flex flex-col gap-4 border-t border-[var(--color-rule)] pt-5">
            <Check
              label="The client is happy for this to be shown"
              name="clientConsented"
              hint="Their home, their call. We do not need their name on the profile — only that you asked."
              error={err.clientConsented}
            />
            <Check
              label="These are renders, not photographs"
              name="isRender"
              hint="A render labelled as a render is completely fine. A render passed off as a finished room is the one thing that gets a studio removed."
            />
          </div>

          <SaveBar pending={pending} saved={state.status === 'saved'} formError={err.form} label="Add project" />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-6 py-3 text-[15px] text-[var(--color-ink)] hover:border-[var(--color-ink-3)]"
        >
          Add another project
        </button>
      )}
    </div>
  );
}

function ProjectItem({ project }: { project: ProjectRow }) {
  const [state, action, pending] = useActionState(removeProjectAction, INITIAL);

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4">
      <span className="min-w-0">
        <span className="block text-[15.5px] text-[var(--color-ink)]">
          {project.title}
          {project.isRender ? (
            <span className="ml-2 rounded-full bg-[var(--color-paper-3)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
              Render
            </span>
          ) : null}
        </span>
        <span className="block text-[13.5px] text-[var(--color-ink-3)]">
          {[
            PUNE_LOCALITIES.find((l) => l.slug === project.locality)?.label,
            project.valuePaise ? formatINRCompact(project.valuePaise) : null,
            project.completedOn
              ? new Date(project.completedOn).toLocaleDateString('en-IN', {
                  month: 'short',
                  year: 'numeric',
                })
              : null,
            project.styleTags
              .map((t) => STYLE_LABELS[t as keyof typeof STYLE_LABELS])
              .filter(Boolean)
              .join(', '),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {state.status === 'error' ? (
          <span role="alert" className="mt-1 block text-[13px] text-[var(--color-atrisk)]">
            {state.errors?.form}
          </span>
        ) : null}
      </span>

      <form action={action}>
        <input type="hidden" name="id" value={project.id} />
        <button
          type="submit"
          disabled={pending}
          className="text-[13.5px] text-[var(--color-ink-3)] underline underline-offset-4 hover:text-[var(--color-atrisk)] disabled:opacity-40"
        >
          {pending ? 'Removing…' : 'Remove'}
        </button>
      </form>
    </li>
  );
}
