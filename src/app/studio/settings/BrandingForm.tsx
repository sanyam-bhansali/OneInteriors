'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { paiseToRupees } from '@/lib/money';
import type { BrandingRow } from '@/modules/studio-quote/store';
import { saveBrandingAction } from './actions';
import { IDLE } from '../form-state';

const input = 'fld';
const primary = 'btn pri';

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
  const w: React.CSSProperties = width === 'xs' ? { width: '8rem' } : width === 'sm' ? { maxWidth: '16rem' } : width === 'md' ? { maxWidth: '26rem' } : {};

  return (
    <label className="flex flex-col gap-1.5">
      <span className="lbl">
        {label}
        {required ? '' : ' — optional'}
      </span>
      <span className="flex items-center gap-2">
        <input
          name={name}
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          required={required}
          className={`${input}${mono ? ' mono' : ''}`}
          style={w}
        />
        {suffix ? <span className="text-[13.5px] muted">{suffix}</span> : null}
      </span>
      {hint ? <span className="text-[12.5px] leading-snug muted">{hint}</span> : null}
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
    <section className="card p-5">
      <h2 className="m-0 text-[15.5px] font-semibold">{title}</h2>
      {note ? (
        <p className="m-0 mb-4 mt-1 max-w-[64ch] text-[13.5px] leading-relaxed muted">
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
      <dt className="lbl m-0">{label}</dt>
      <dd className={`m-0 text-[14px] ${mono ? 'mono' : ''}`}>
        {value && value.length > 0 ? (
          value
        ) : (
          <span className="muted">Not given</span>
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
      <section className="card">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="m-0 text-[16px] font-semibold">
            Who the quotation comes from
          </h2>
          <Link
            href="/studio/onboarding/registration"
            className="text-[13px] font-medium acc-t underline underline-offset-4"
          >
            Change in your registration
          </Link>
        </div>
        <p className="m-0 mb-4 max-w-[62ch] text-[13.5px] leading-relaxed muted">
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
          <p className="m-0 text-[13.5px] leading-relaxed muted">
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
          <span className="lbl">Name on quotations — optional</span>
          <input
            name="documentName"
            defaultValue={branding?.documentName ?? ''}
            maxLength={60}
            placeholder="Printed at the top of your quotations, e.g. your brand name. Blank uses your trading name."
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Opening note — optional</span>
          <textarea
            name="welcomeNote"
            rows={4}
            defaultValue={branding?.welcomeNote ?? ''}
            placeholder="A short paragraph at the top of every quotation. How you would open a conversation with a client who has just decided to work with you."
            className={input}
          />
        </label>
        <p className="m-0 text-[13.5px] leading-relaxed">
          <span className="lbl">Terms and conditions</span>
          <br />
          <span className="muted">
            {branding?.terms ? 'Written. ' : 'Not written yet. '}
            They are edited in one place, on{' '}
            <Link href="/studio/quotations/terms" className="acc-t" style={{ fontWeight: 600 }}>
              Quotations → Terms
            </Link>
            , and every new quotation copies them.
          </span>
        </p>
      </Block>

      <Block
        title="Quotation PDF colour"
        note="The room bands, the table headings and the totals on your quotation PDF are drawn in this colour. Pick your brand's main colour; a dark one prints best."
      >
        <label className="flex items-center gap-3">
          <input
            type="color"
            name="accentHex"
            defaultValue={/^#[0-9a-fA-F]{6}$/.test(branding?.accentHex ?? '') ? branding!.accentHex : '#1F5C4D'}
            className="h-[36px] w-[56px] cursor-pointer rounded-[8px] border-0 bg-transparent p-0"
            aria-label="Quotation PDF colour"
          />
          <span className="mono text-[13px] muted">{branding?.accentHex ?? '#1F5C4D'}</span>
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
            defaultValue={branding && branding.feeBps === 0 ? '0' : '7'}
            width="xs"
            suffix="% of the work value — 7% for every studio, switched on or off per quotation (0 starts new ones with it off)"
          />
          <Field
            label="Your modular discount"
            name="discountPct"
            required
            defaultValue={branding ? String(branding.discountBps / 100) : '0'}
            width="xs"
            suffix="% on modular only — customers see it on their first quote for you"
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
        <label className="flex items-center gap-2 text-[14px]">
          <input
            type="checkbox"
            name="gstOn"
            value="yes"
            defaultChecked={(branding?.gstBps ?? 0) > 0}
            className="h-[16px] w-[16px]"
          />
          Add GST at 18% to new quotations
        </label>
        <Field
          label="A quotation holds its prices for"
          name="validityDays"
          defaultValue={String(branding?.validityDays ?? 30)}
          width="xs"
          suffix="days — printed as “valid until”"
        />
        <p className="m-0 max-w-[64ch] text-[13px] leading-relaxed muted">
          The discount applies to modular work only — factory units carry the margin that can be
          given away, site labour does not. Discounting the whole quotation is how a studio wins a
          job and loses money on it.
        </p>
      </Block>

      <Block
        title="Material specification"
        note="Printed on every quotation, so a client can see the brands behind the price. One per line: the material, a colon, the brand, a | and the specification. Without a | the whole line after the colon is the specification."
      >
        <textarea
          name="materialSpec"
          rows={7}
          defaultValue={(branding?.materialSpec ?? []).map((r) => (r.brand ? `${r.item}: ${r.brand} | ${r.spec}` : `${r.item}: ${r.spec}`)).join('\n')}
          placeholder={'Plywood: Century | BWP 710, 18 mm\nLaminate: Merino | 1 mm, matt\nHardware: Hettich | Soft close\nPaint: Asian Paints | Putty, primer and paint'}
          className={input}
        />
      </Block>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {'ok' in state && state.ok ? (
          <span className="text-[13.5px] good-t">Saved.</span>
        ) : null}
        {'ok' in state && !state.ok ? (
          <span role="alert" className="text-[13.5px] bad-t">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
