'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  BRAND_ITEM,
  BRAND_KEYS,
  EMPTY_ANSWERS,
  LEADS_BANDS,
  LEADS_LABEL,
  PRODUCTIONS,
  PRODUCTION_LABEL,
  SIZE_BANDS,
  SIZE_LABEL,
  SOURCE_KEYS,
  SOURCE_LABEL,
  TEAM_LABEL,
  TEAM_ROLES,
  defaultTicks,
  suggestedPipeline,
  type QuizAnswers,
  type SetupPlan,
} from '@/modules/studio/setup-quiz';
import { applySetupAction, previewSetupAction, skipSetupAction } from './actions';

type Step = { id: string; q: string; hint?: string; body: (a: QuizAnswers, set: (p: Partial<QuizAnswers>) => void) => React.ReactNode };

/** One choice among a few, as large tappable rows. */
function Options<T extends string | number | boolean>({ value, options, onPick }: { value: T | null; options: readonly { v: T; label: string; note?: string }[]; onPick: (v: T) => void }) {
  return (
    <div className="sq-opts" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} className="sq-opt" onClick={() => onPick(o.v)}>
          <b>{o.label}</b>
          {o.note ? <span className="muted sm">{o.note}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Count({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="sq-count">
      <span>{label}</span>
      <span className="hstack" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <button type="button" className="btn sec sm" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <b className="mono" aria-live="polite" style={{ minWidth: 24, textAlign: 'center' }}>
          {value}
        </b>
        <button type="button" className="btn sec sm" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(200, value + 1))}>
          +
        </button>
      </span>
    </div>
  );
}

const yesNo = (yes: string, no: string) => [
  { v: true, label: yes },
  { v: false, label: no },
] as const;

const STEPS: Step[] = [
  {
    id: 'team',
    q: 'Who works with you?',
    hint: 'Besides you. A rough count is fine.',
    body: (a, set) => (
      <div className="sq-counts">
        {TEAM_ROLES.map((k) => (
          <Count key={k} label={TEAM_LABEL[k]} value={a.team[k]} onChange={(n) => set({ team: { ...a.team, [k]: n } })} />
        ))}
      </div>
    ),
  },
  {
    id: 'sources',
    q: 'Where do your leads come from?',
    hint: 'Pick every one you use.',
    body: (a, set) => (
      <div className="sq-stack">
        <div className="sq-chips">
          {SOURCE_KEYS.map((k) => {
            const on = a.sources.includes(k);
            return (
              <button key={k} type="button" className="sq-chip" aria-pressed={on} onClick={() => set({ sources: on ? a.sources.filter((x) => x !== k) : [...a.sources, k] })}>
                {SOURCE_LABEL[k]}
              </button>
            );
          })}
        </div>
        {a.sources.includes('OTHER') ? (
          <label className="sq-stack" style={{ gap: 6 }}>
            <span className="lbl">The other one’s name</span>
            <input className="fld" value={a.otherSource} maxLength={40} placeholder="Housing.com, a builder tie-up…" onChange={(e) => set({ otherSource: e.target.value })} />
          </label>
        ) : null}
      </div>
    ),
  },
  {
    id: 'leads',
    q: 'How many new leads a month?',
    body: (a, set) => <Options value={a.leadsPerMonth} options={LEADS_BANDS.map((v) => ({ v, label: LEADS_LABEL[v] }))} onPick={(v) => set({ leadsPerMonth: v, pipeline: a.pipeline ?? suggestedPipeline(v) })} />,
  },
  {
    id: 'pipeline',
    q: 'How detailed should your lead board be?',
    body: (a, set) => (
      <Options
        value={a.pipeline ?? suggestedPipeline(a.leadsPerMonth)}
        options={[
          { v: 'HAUSPIRE', label: 'Detailed, like Hauspire', note: 'New, four calling rounds, effective lead, floor plan and quotation stages, visits, finalisation, converted.' },
          { v: 'SIMPLE', label: 'Simple', note: 'Keep the columns you have now.' },
        ]}
        onPick={(v) => set({ pipeline: v })}
      />
    ),
  },
  {
    id: 'design',
    q: 'Do you design in-house?',
    body: (a, set) => <Options value={a.designInHouse} options={[{ v: true, label: 'Yes, our own designers' }, { v: false, label: 'No, or only light design' }]} onPick={(v) => set({ designInHouse: v })} />,
  },
  {
    id: 'production',
    q: 'Who makes the furniture?',
    body: (a, set) => <Options value={a.production} options={PRODUCTIONS.map((v) => ({ v, label: PRODUCTION_LABEL[v] }))} onPick={(v) => set({ production: v })} />,
  },
  {
    id: 'size',
    q: 'A typical project of yours is…',
    body: (a, set) => <Options value={a.projectSize} options={SIZE_BANDS.map((v) => ({ v, label: SIZE_LABEL[v] }))} onPick={(v) => set({ projectSize: v })} />,
  },
  {
    id: 'bhk',
    q: 'And usually a…',
    body: (a, set) => <Options value={a.bhk} options={([1, 2, 3, 4] as const).map((v) => ({ v, label: v === 4 ? '4 BHK or more' : `${v} BHK` }))} onPick={(v) => set({ bhk: v })} />,
  },
  {
    id: 'civil',
    q: 'Do you take on civil work?',
    hint: 'Breaking walls, tiling, plumbing.',
    body: (a, set) => <Options value={a.civil} options={yesNo('Yes', 'No, interiors only')} onPick={(v) => set({ civil: v })} />,
  },
  {
    id: 'pricing',
    q: 'Your quotation’s starting terms',
    hint: 'Defaults for new quotations; each one can still be changed.',
    body: (a, set) => (
      <div className="sq-stack">
        <label className="sq-stack" style={{ gap: 6 }}>
          <span className="lbl">Your modular discount, %</span>
          <input className="fld" inputMode="decimal" value={a.discountPct ?? ''} placeholder="0" onChange={(e) => set({ discountPct: e.target.value === '' ? null : Math.min(50, Math.max(0, Number(e.target.value) || 0)) })} />
        </label>
        <span className="lbl">Professional fee (7% for every studio)</span>
        <Options value={a.feeOn} options={yesNo('On by default', 'Off by default')} onPick={(v) => set({ feeOn: v })} />
      </div>
    ),
  },
  {
    id: 'gst',
    q: 'GST and how long prices hold',
    body: (a, set) => (
      <div className="sq-stack">
        <span className="lbl">GST at 18%</span>
        <Options value={a.gstOn} options={yesNo('Add it to new quotations', 'Leave it off')} onPick={(v) => set({ gstOn: v })} />
        <label className="sq-stack" style={{ gap: 6 }}>
          <span className="lbl">A quotation holds its prices for (days)</span>
          <input className="fld" inputMode="numeric" value={a.validityDays ?? ''} placeholder="30" onChange={(e) => set({ validityDays: e.target.value === '' ? null : Math.min(365, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} />
        </label>
      </div>
    ),
  },
  {
    id: 'brands',
    q: 'The brands you usually use',
    hint: 'Printed in the material specification of your quotation PDF. Leave any blank.',
    body: (a, set) => (
      <div className="sq-stack">
        {BRAND_KEYS.map((k) => (
          <label key={k} className="sq-stack" style={{ gap: 6 }}>
            <span className="lbl">{BRAND_ITEM[k]}</span>
            <input className="fld" value={a.brands[k]} maxLength={120} placeholder={k === 'plywood' ? 'Century BWP 710, 18 mm' : k === 'hardware' ? 'Hettich soft-close' : ''} onChange={(e) => set({ brands: { ...a.brands, [k]: e.target.value } })} />
          </label>
        ))}
      </div>
    ),
  },
];

export function SetupQuiz({ initial, teamOpen, full, again }: { initial: QuizAnswers | null; teamOpen: boolean; full: boolean; again: boolean }) {
  const router = useRouter();
  const [a, setA] = useState<QuizAnswers>(initial ?? EMPTY_ANSWERS);
  /* -1 the welcome, 0..n-1 the questions, n the review, n+1 done. */
  const [i, setI] = useState(-1);
  const [plan, setPlan] = useState<SetupPlan | null>(null);
  const [ticks, setTicks] = useState<string[]>([]);
  const [done, setDone] = useState<{ applied: { title: string }[]; failed: { title: string; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = STEPS.length;
  const set = (p: Partial<QuizAnswers>) => setA((x) => ({ ...x, ...p }));

  const review = () =>
    start(async () => {
      setError(null);
      const r = await previewSetupAction(a);
      if (!r.ok) return setError(r.error);
      setPlan(r.plan);
      setTicks(defaultTicks(r.plan));
      setI(n);
    });
  const advance = () => (i + 1 >= n ? review() : setI(i + 1));
  /* The pipeline question shows a suggestion picked; Next takes it. Skip leaves it unanswered. */
  const next = () => {
    if (STEPS[i]?.id === 'pipeline' && a.pipeline === null) set({ pipeline: suggestedPipeline(a.leadsPerMonth) });
    advance();
  };
  const apply = () =>
    start(async () => {
      setError(null);
      const r = await applySetupAction(a, ticks);
      if (!r.ok) return setError(r.error);
      setDone({ applied: r.applied, failed: r.failed });
      setI(n + 1);
    });
  const skip = () =>
    start(async () => {
      await skipSetupAction(i >= 0 ? a : null);
      router.push('/studio/home');
    });
  const people = TEAM_ROLES.reduce((s, k) => s + a.team[k], 0);

  return (
    <main className="content sq-page" data-testid="setup-quiz">
      <div className="sq-top">
        <span className="eyebrow">Set up your studio</span>
        {i < n ? (
          <button type="button" className="btn ghost sm" onClick={skip} disabled={pending}>
            {again ? 'Close' : 'Skip for now'}
          </button>
        ) : null}
      </div>

      {i >= 0 && i < n ? (
        <ol className="sq-dots" aria-label={`Question ${i + 1} of ${n}`}>
          {STEPS.map((s, k) => (
            <li key={s.id} className={k < i ? 'past' : k === i ? 'now' : ''} />
          ))}
        </ol>
      ) : null}

      <section className="card sq-card">
        {i === -1 ? (
          <>
            <h1 className="sq-q">{again ? 'Set up your studio again' : 'Let’s set your studio up'}</h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {n} quick questions, two or three minutes. We use your answers to set up your lead sources, your pipeline, your payment stages and your quotation defaults. You see every change before anything is saved, and nothing you have set yourself is replaced unless you tick it.
            </p>
            <div className="hstack">
              <button type="button" className="btn pri lg" onClick={() => setI(0)}>
                Start
              </button>
            </div>
          </>
        ) : null}

        {i >= 0 && i < n ? (
          <>
            <h1 className="sq-q">{STEPS[i]!.q}</h1>
            {STEPS[i]!.hint ? <p className="muted" style={{ margin: 0 }}>{STEPS[i]!.hint}</p> : null}
            {STEPS[i]!.body(a, set)}
            <div className="sq-nav">
              <button type="button" className="btn sec" onClick={() => setI(i - 1)} disabled={pending}>
                Back
              </button>
              <span className="hstack" style={{ gap: 8 }}>
                <button type="button" className="btn ghost" onClick={advance} disabled={pending}>
                  Skip question
                </button>
                <button type="button" className="btn pri" onClick={next} disabled={pending}>
                  {i + 1 >= n ? (pending ? 'Working it out…' : 'See what changes') : 'Next'}
                </button>
              </span>
            </div>
          </>
        ) : null}

        {i === n && plan ? (
          <>
            <h1 className="sq-q">Here is what this will change</h1>
            {plan.changes.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Nothing to change: your settings already match your answers. We will keep your answers.
              </p>
            ) : (
              <ul className="sq-changes">
                {plan.changes.map((c) => {
                  const on = ticks.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label>
                        <input type="checkbox" checked={on} onChange={() => setTicks(on ? ticks.filter((t) => t !== c.id) : [...ticks, c.id])} />
                        <span>
                          <b>{c.title}</b>
                          <span className="muted sm">{c.detail}</span>
                          {c.overwrites ? <span className="chip warn">You set this yourself: tick to replace it</span> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {plan.kept.length > 0 ? (
              <div className="sq-kept">
                <span className="lbl">Saved, nothing changed</span>
                {plan.kept.map((k) => (
                  <p key={k} className="muted sm" style={{ margin: 0 }}>
                    {k}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="sq-nav">
              <button type="button" className="btn sec" onClick={() => setI(n - 1)} disabled={pending}>
                Back
              </button>
              <button type="button" className="btn pri" onClick={apply} disabled={pending} data-testid="setup-apply">
                {pending ? 'Saving…' : ticks.length > 0 ? `Apply ${ticks.length} change${ticks.length === 1 ? '' : 's'}` : 'Save my answers'}
              </button>
            </div>
          </>
        ) : null}

        {i === n + 1 && done ? (
          <>
            <h1 className="sq-q">Your studio is set up</h1>
            {done.applied.length > 0 ? (
              <ul className="sq-done">
                {done.applied.map((x) => (
                  <li key={x.title}>
                    <span className="chip good">Done</span> {x.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Your answers are saved.
              </p>
            )}
            {done.failed.length > 0 ? (
              <ul className="sq-done">
                {done.failed.map((x) => (
                  <li key={x.title}>
                    <span className="chip bad">Not saved</span> {x.title}: {x.error}
                  </li>
                ))}
              </ul>
            ) : null}
            {teamOpen && full && people > 0 ? (
              <div className="banner">
                <span>
                  You told us about {people} {people === 1 ? 'person' : 'people'} on your team. Invite them now, each with their own app.
                </span>
                <Link href="/studio/settings/team" className="btn acc sm">
                  Invite your team
                </Link>
              </div>
            ) : null}
            <p className="muted sm" style={{ margin: 0 }}>
              Change any of it in Settings, or run this again from Settings → Set up your studio again.
            </p>
            <div className="hstack">
              <Link href="/studio/home" className="btn pri">
                Go to your home
              </Link>
            </div>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="bad-t" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
