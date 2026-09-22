'use client';

import { useActionState, useRef } from 'react';
import {
  uploadLogoAction,
  clearLogoAction,
  setMarkAction,
  type BrandAssetState,
} from './actions';
// Values AND types from the pure module, never from the `server-only` store —
// see tests/server-only-boundary.test.ts for what that costs.
import { markToggleState, MARK_TEXT } from '@/modules/studio-quote/mark';
import { ACCEPTED_LOGO, MAX_LOGO_MB } from '@/modules/storage/logo-limits';

const IDLE: BrandAssetState = { status: 'idle' };

/**
 * The two things about a quotation that are not typed: the logo, and whose
 * name is at the bottom.
 *
 * ## Why these sit outside the branding form
 *
 * A file input cannot live inside it — HTML has no nested forms, and putting
 * the logo on the main form would mean every save of a phone number
 * re-uploaded the image. Each of these is its own form and its own action,
 * which is also how they should behave: a logo is replaced, not saved
 * alongside an address.
 */
export function LogoAndMark({
  logoUrl,
  hasBranding,
  uploadEnabled,
  tier,
  hideRequested,
}: {
  /** Signed, five minutes. Null when there is no logo or storage is off. */
  logoUrl: string | null;
  /** The branding row must exist before a logo has anywhere to hang. */
  hasBranding: boolean;
  uploadEnabled: boolean;
  tier: string | null;
  hideRequested: boolean;
}) {
  const mark = markToggleState({ tier, hideRequested });

  return (
    <div className="flex max-w-[52rem] flex-col gap-5">
      <Logo
        logoUrl={logoUrl}
        hasBranding={hasBranding}
        uploadEnabled={uploadEnabled}
      />
      <Mark entitled={mark.entitled} on={mark.on} note={mark.note} />
    </div>
  );
}

function Logo({
  logoUrl,
  hasBranding,
  uploadEnabled,
}: {
  logoUrl: string | null;
  hasBranding: boolean;
  uploadEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(uploadLogoAction, IDLE);
  const [clearState, clear, clearing] = useActionState(clearLogoAction, IDLE);
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-[14px] border border-[var(--s-line,#dbd5cb)] bg-[var(--s-surface,#fff)] p-6">
      <h2 className="m-0 mb-1 text-[16px] font-semibold text-[var(--s-ink,#1c1b19)]">
        Your logo
      </h2>
      <p className="m-0 mb-4 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
        Printed at the top of every quotation, above your registered name. {ACCEPTED_LOGO}, up to{' '}
        {MAX_LOGO_MB} MB.
      </p>

      {!hasBranding ? (
        /* The logo hangs off the branding row, so there has to be one. Said
           plainly rather than letting somebody pick a file and be refused. */
        <p className="m-0 rounded-[10px] bg-[var(--s-surface-2,#f0ede7)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
          Fill in your studio details above and save them first — the logo goes with them.
        </p>
      ) : !uploadEnabled ? (
        <p className="m-0 rounded-[10px] bg-[var(--s-surface-2,#f0ede7)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
          Uploading is not switched on here yet. Email it to us and we will put it on for you.
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <div className="grid h-[76px] w-[160px] flex-none place-items-center overflow-hidden rounded-[10px] border border-dashed border-[var(--s-line,#dbd5cb)] bg-[var(--s-surface-2,#f0ede7)]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Your logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[12px] text-[var(--s-ink-3,#6a655c)]">No logo yet</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <form action={action}>
              <input
                ref={input}
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp"
                /* Submits on choose. There is nothing to decide between
                   picking the file and sending it, and a second "Upload"
                   press is one more place to stop. */
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="sr-only"
                id="logo-input"
                disabled={pending}
              />
              <label
                htmlFor="logo-input"
                className="inline-flex cursor-pointer items-center rounded-full border border-[var(--s-line,#dbd5cb)] px-4 py-2 text-[13.5px] font-medium text-[var(--s-ink,#1c1b19)] hover:border-[var(--s-ink-3,#6a655c)]"
              >
                {pending ? 'Uploading…' : logoUrl ? 'Replace' : 'Choose a file'}
              </label>
            </form>

            {logoUrl ? (
              <form action={clear} className="mt-2">
                <button
                  type="submit"
                  disabled={clearing}
                  className="text-[13px] text-[var(--s-ink-3,#6a655c)] underline underline-offset-4 hover:text-[var(--s-ink,#1c1b19)] disabled:opacity-50"
                >
                  {clearing ? 'Removing…' : 'Remove it'}
                </button>
              </form>
            ) : null}

            {/* Amber, not red. Nothing has gone wrong with their business —
                they picked a file we cannot use, and the message says which
                kind to send instead. */}
            {state.status === 'error' || clearState.status === 'error' ? (
              <p
                role="alert"
                className="m-0 mt-2.5 max-w-[46ch] rounded-[10px] bg-[var(--s-warn-wash,#f5e9cf)] px-3.5 py-2 text-[13px] leading-relaxed text-[var(--s-ink,#1c1b19)]"
              >
                {state.error ?? clearState.error}
              </p>
            ) : null}

            <p className="m-0 mt-2.5 max-w-[46ch] text-[12px] leading-relaxed text-[var(--s-ink-3,#6a655c)]">
              A flat image on a light background prints best. SVG is not accepted — it can carry
              scripts, and this renders on a page showing your pricing.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Mark({ entitled, on, note }: { entitled: boolean; on: boolean; note: string }) {
  const [state, action, pending] = useActionState(setMarkAction, IDLE);

  return (
    <section className="rounded-[14px] border border-[var(--s-line,#dbd5cb)] bg-[var(--s-surface,#fff)] p-6">
      <h2 className="m-0 mb-1 text-[16px] font-semibold text-[var(--s-ink,#1c1b19)]">
        Our line at the bottom
      </h2>
      <p className="m-0 mb-4 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
        Every quotation carries one line below your GSTIN reading{' '}
        <span className="italic">&ldquo;{MARK_TEXT}&rdquo;</span>. It is never in your terms and
        never near your name — nothing on the document commits you to anything of ours.
      </p>

      <form action={action}>
        {/* The switch is shown to everybody, including studios who cannot use
            it yet. A feature somebody cannot see is one they cannot decide
            they want, and the note beside it says what it costs. Their choice
            is stored either way, so an upgrade takes effect without anybody
            coming back here. */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="hide"
            defaultChecked={on}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            disabled={pending}
            className="mt-0.5 h-[17px] w-[17px] flex-none accent-[var(--s-accent,#a44f2e)]"
          />
          <span className="min-w-0">
            <span className="block text-[14.5px] text-[var(--s-ink,#1c1b19)]">
              Take it off my quotations
              {!entitled ? (
                <span className="ml-2 rounded-full bg-[var(--s-warn-wash,#f5e9cf)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--s-warn,#8d6412)]">
                  Premium
                </span>
              ) : null}
            </span>
            <span className="block text-[12.5px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
              {note}
            </span>
          </span>
        </label>
      </form>

      {state.status === 'error' ? (
        <p role="alert" className="m-0 mt-2 text-[13px] text-[var(--s-bad,#98371f)]">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
