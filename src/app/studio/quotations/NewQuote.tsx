'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { CONFIGS, standardRunFor, type ConfigName } from '@/modules/studio-quote/configure';
import { createQuoteAction } from './actions';
import { IDLE } from '../form-state';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14.5px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-5 py-2.5 text-[14.5px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-4 py-2.5 text-[14px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

/**
 * Starting a quotation — which means building one.
 *
 * ## What this replaced, and why
 *
 * A "+ New quotation" button that opened a four-field popover and dropped the
 * studio on an empty page. That is a filing cabinet with a form on the front:
 * the software stored quotations and helped write none of them.
 *
 * The facts a build needs are the same facts anybody types when starting a
 * quotation — who it is for, how big the flat is, how long the kitchen is. So
 * they are asked once, here, and the press that creates the quotation also
 * builds it. A 3 BHK arrives as about forty priced lines from the studio's own
 * catalogue, ready to be corrected rather than typed.
 *
 * ## Blank is still one press away
 *
 * A single-room renovation has no standard build worth applying, and forcing
 * one would mean deleting thirty-eight lines to quote a wardrobe. It is the
 * quiet button rather than the loud one because it is the rarer job, not
 * because it is discouraged.
 *
 * ## It never hides itself
 *
 * The old button disappeared entirely when no product had a rate — so the one
 * screen that could have explained what to do next showed an empty page and
 * no way forward. Readiness is now stated, with a link, and the form still
 * works: an unpriced build produces lines at zero, which is visibly unfinished
 * rather than silently absent.
 */
export function StartQuote({
  priced,
  standard,
  total,
  compact,
}: {
  /** Products with a rate. */
  priced: number;
  /** Products ticked into the standard build. */
  standard: number;
  total: number;
  /** Folded away by default, for the page that already has quotations on it. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [state, action, pending] = useActionState(createQuoteAction, IDLE);
  const [config, setConfig] = useState<ConfigName>('3 BHK');
  const [build, setBuild] = useState(true);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primary}>
        + Write a quotation
      </button>
    );
  }

  return (
    <form action={action} className="s-card flex flex-col gap-4 p-6">
      {/* The hidden pair that turns "create" into "create and build". A
          checkbox would post nothing when unticked, which is exactly the
          value we need to send. */}
      <input type="hidden" name="build" value={build ? 'yes' : 'no'} />

      <div>
        <h2 className="m-0 mb-1 text-[16px] font-semibold">Write a quotation</h2>
        <p className="m-0 max-w-[64ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          Tell us the flat and we build it — a wardrobe in each bedroom, a vanity in each
          bathroom, the kitchen sized to its run, everything at your own rates. You correct it
          rather than type it.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
          <span className="s-label">Who is it for</span>
          <input name="clientName" required autoFocus placeholder="Mrs Kothari" className={input} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Phone — optional</span>
          <input name="clientPhone" inputMode="tel" className={`${input} w-[10rem]`} />
        </label>

        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
          <span className="s-label">Society or address — optional</span>
          <input name="society" placeholder="Kalyani Nagar" className={input} />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-[var(--s-rule-soft)] pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Configuration</span>
          <select
            name="config"
            value={config}
            onChange={(e) => setConfig(e.target.value as ConfigName)}
            className={`${input} w-[7.5rem]`}
          >
            {CONFIGS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Kitchen run mm</span>
          <input
            name="kitchenRunMm"
            inputMode="numeric"
            placeholder={String(standardRunFor(config))}
            className={`${input} s-num w-[8rem] text-right`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Bathrooms</span>
          <input
            name="bathrooms"
            inputMode="numeric"
            defaultValue="2"
            className={`${input} s-num w-[5.5rem] text-right`}
          />
        </label>

        <label className="flex items-center gap-2 py-2.5 text-[14px]">
          <input
            type="checkbox"
            name="study"
            value="yes"
            className="h-[16px] w-[16px] accent-[var(--s-accent)]"
          />
          Study or office
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Carpet sq ft — optional</span>
          <input
            name="carpetSqft"
            inputMode="numeric"
            placeholder="1150"
            className={`${input} s-num w-[7.5rem] text-right`}
          />
        </label>
      </div>

      <p className="m-0 text-[12.5px] leading-relaxed text-[var(--s-ink-3)]">
        Leave the kitchen run blank and a {config} is assumed at{' '}
        <span className="s-num">{standardRunFor(config)}</span>mm — it is the one measurement that
        moves the total, so it is worth taking. Every size and rate is editable afterwards.
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--s-rule-soft)] pt-4">
        <button
          type="submit"
          disabled={pending}
          onClick={() => setBuild(true)}
          className={primary}
        >
          {pending ? 'Building…' : `Build the ${config}`}
        </button>

        {/* Same form, same submit. The flag decides, so there is no second
            code path to keep in step with the first. */}
        <button
          type="submit"
          disabled={pending}
          onClick={() => setBuild(false)}
          className={quiet}
        >
          Start it blank
        </button>

        {compact ? (
          <button type="button" onClick={() => setOpen(false)} className={quiet}>
            Cancel
          </button>
        ) : null}
      </div>

      <Readiness priced={priced} standard={standard} total={total} />

      {'ok' in state && !state.ok ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * What the build will actually produce, said before it is pressed.
 *
 * Silence here is what made the old screen feel broken: a studio with nothing
 * ticked pressed Build, got an empty quotation, and had no way to know why.
 * Two numbers and a link answer it in advance.
 */
function Readiness({
  priced,
  standard,
  total,
}: {
  priced: number;
  standard: number;
  total: number;
}) {
  if (total === 0) return null;

  if (standard === 0) {
    return (
      <p className="m-0 rounded-[10px] bg-[var(--s-warn-wash,#f5e9cf)] px-4 py-3 text-[13px] leading-relaxed text-[var(--s-ink)]">
        Nothing in your product list is marked <strong>standard</strong> yet, so a build has
        nothing to put on the page.{' '}
        <Link href="/studio/products" className="font-medium text-[var(--s-accent)]">
          Tick what you fit on nearly every job
        </Link>{' '}
        — about twenty-five ticks, once, and every quotation after this one builds itself.
      </p>
    );
  }

  return (
    <p className="m-0 text-[12.5px] leading-relaxed text-[var(--s-ink-3)]">
      <span className="s-num">{standard}</span> of your {total} products are marked standard and{' '}
      <span className="s-num">{priced}</span> are priced.{' '}
      {priced < total ? (
        <>
          Anything without a rate lands at zero and is flagged —{' '}
          <Link href="/studio/products" className="text-[var(--s-accent)]">
            price them
          </Link>
          .
        </>
      ) : null}
    </p>
  );
}
