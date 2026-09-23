'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { paiseToRupees } from '@/lib/money';
import type { BrandingRow } from '@/modules/studio-quote/store';
import { saveBrandingAction } from './actions';
import { IDLE } from '../form-state';

const input =
  'w-full rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14.5px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-5 py-2.5 text-[14.5px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  required = false,
  width = 'full',
  suffix,
  mono = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  width?: 'xs' | 'sm' | 'md' | 'full';
  suffix?: string;
  mono?: boolean;
}) {
  const w =
    width === 'xs' ? 'w-[8rem]' : width === 'sm' ? 'max-w-[16rem]' : width === 'md' ? 'max-w-[26rem]' : '';

  return (
    <label className="flex flex-col gap-1.5">
      <span className="s-label">
        {label}
        {required ? '' : ' — optional'}
      </span>
      <span className="flex items-center gap-2">
        <input
          name={name}
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          required={required}
          className={`${input} ${w} ${mono ? 'font-[family-name:var(--font-mono)]' : ''}`}
        />
        {suffix ? <span className="text-[13.5px] text-[var(--s-ink-3)]">{suffix}</span> : null}
      </span>
      {hint ? <span className="text-[12.5px] leading-snug text-[var(--s-ink-3)]">{hint}</span> : null}
    </label>
  );
}

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="s-card p-5">
      <h2 className="m-0 text-[15.5px] font-semibold">{title}</h2>
      {note ? (
        <p className="m-0 mb-4 mt-1 max-w-[64ch] text-[13.5px] leading-relaxed text-[var(--s-ink-3)]">
          {note}
        </p>
      ) : (
        <div className="mb-4" />
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * The studio's identity on its own documents.
 *
 * Everything here prints on a quotation that goes to their client with their
 * name at the top and ours nowhere. That is the whole point of the module, and
 * it is why the copy fields default to empty rather than to something of ours:
 * a document going out under somebody else's name must not carry words they
 * have never read.
 */
/** One established fact, as it will print. */
function Fact({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="s-label m-0">{label}</dt>
      <dd className={`m-0 text-[14px] text-[var(--s-ink,#1c1b19)] ${mono ? 's-num' : ''}`}>
        {value && value.length > 0 ? (
          value
        ) : (
          <span className="text-[var(--s-ink-3,#6a655c)]">Not given</span>
        )}
      </dd>
    </div>
  );
}

export function BrandingForm({ branding }: { branding: BrandingRow | null }) {
  const [state, action, pending] = useActionState(saveBrandingAction, IDLE);

  return (
    <form action={action} className="flex max-w-[52rem] flex-col gap-5">
      {/**
        * Shown, not asked for.
        *
        * Every field in this block used to be an input, and every one of them
        * had already been typed on the registration step — where we ask for
        * exactly these facts and then check them against the public
        * registries. Two copies of an address drift, and when they do, the
        * address we verified and the address on a client's quotation are
        * different addresses with nothing to say which is which.
        *
        * So this is the registration, read back. Changing it means changing
        * the registration, which is right: the name at the top of a quotation
        * is the name a client pays, and it should not be editable in a
        * settings page without the check that goes with it.
        */}
      <section className="rounded-[14px] border border-[var(--s-line,#dbd5cb)] bg-[var(--s-surface-2,#f0ede7)] p-6">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="m-0 text-[16px] font-semibold text-[var(--s-ink,#1c1b19)]">
            Who the quotation comes from
          </h2>
          <Link
            href="/studio/onboarding/registration"
            className="text-[13px] font-medium text-[var(--s-accent)] underline underline-offset-4"
          >
            Change in your registration
          </Link>
        </div>
        <p className="m-0 mb-4 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
          From what you gave us during onboarding — the same details we check against the GST and
          company records. We do not ask for them twice, because two copies of an address end up
          disagreeing and only one of them is the one we verified.
        </p>

        {branding ? (
          <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Fact label="Registered name" value={branding.legalName} />
            <Fact
              label="Address"
              value={[branding.addressLine, branding.city, branding.pincode]
                .filter(Boolean)
                .join(', ')}
            />
            <Fact label="GSTIN" value={branding.gstin} mono />
          </dl>
        ) : (
          <p className="m-0 text-[13.5px] leading-relaxed text-[var(--s-ink-2,#56524b)]">
            Nothing yet — finish the registration step and it appears here, and on every quotation
            you send.
          </p>
        )}
      </section>

      <Block title="How a client reaches you">
        <div className="flex flex-wrap gap-4">
          <Field label="Phone" name="phone" defaultValue={branding?.phone} width="sm" />
          <Field label="Email" name="email" defaultValue={branding?.email} width="sm" />
        </div>
        <Field label="Website" name="website" defaultValue={branding?.website} width="md" />
      </Block>

      <Block
        title="Your words on the document"
        note="Both of these are blank until you write them, and they stay blank if you would rather. We will not put our sentences on a quotation with your name on it."
      >
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Opening note — optional</span>
          <textarea
            name="welcomeNote"
            rows={4}
            defaultValue={branding?.welcomeNote ?? ''}
            placeholder="A short paragraph at the top of every quotation. How you would open a conversation with a client who has just decided to work with you."
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Terms and conditions — optional</span>
          <textarea
            name="terms"
            rows={8}
            defaultValue={branding?.terms ?? ''}
            placeholder={
              'Payment schedule, what is included and excluded, timelines, what happens on a delay.\n\nThese are your commitments to your client. We do not supply a template, because a template would commit you to terms we wrote.'
            }
            className={input}
          />
        </label>
      </Block>

      <Block
        title="What a new quotation starts from"
        note="Defaults only. Every quotation copies these at the moment it is created, so changing them here never rewrites one you have already sent."
      >
        <div className="flex flex-wrap gap-5">
          <Field
            label="Professional fee"
            name="feePct"
            required
            defaultValue={branding ? String(branding.feeBps / 100) : '7'}
            width="xs"
            suffix="% of the work value"
          />
          <Field
            label="Standard discount"
            name="discountPct"
            required
            defaultValue={branding ? String(branding.discountBps / 100) : '0'}
            width="xs"
            suffix="% on modular only"
          />
        </div>
        <Field
          label="Booking advance"
          name="bookingAdvance"
          required
          defaultValue={
            branding ? String(paiseToRupees(branding.bookingAdvancePaise)) : '25000'
          }
          width="xs"
          suffix="₹, taken before the stages"
        />
        <p className="m-0 max-w-[64ch] text-[13px] leading-relaxed text-[var(--s-ink-3)]">
          The discount applies to modular work only — factory units carry the margin that can be
          given away, site labour does not. Discounting the whole quotation is how a studio wins a
          job and loses money on it.
        </p>
      </Block>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {'ok' in state && state.ok ? (
          <span className="text-[13.5px] text-[var(--s-good)]">Saved.</span>
        ) : null}
        {'ok' in state && !state.ok ? (
          <span role="alert" className="text-[13.5px] text-[var(--s-bad)]">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
