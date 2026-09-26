'use client';

import { useActionState, useRef, useState } from 'react';
import { saveRegistrationAction, type StepState } from './actions';
import { SaveBar } from './fields';
import { Section } from './Section';
import { ProofUpload } from './ProofUpload';
import type { StudioDocumentView } from '@/modules/studio/documents';
import { Check, ShieldCheck } from 'lucide-react';
import { DISC_ICON, INLINE_ICON } from './icon-sizes';

const INITIAL: StepState = { status: 'idle' };
const FORM_ID = 'registration';

export interface RegistrationDefaults {
  /** Read-only. Set when the application was approved. */
  tradeName: string;
  legalName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;

  addressLine: string | null;
  pincode: string | null;
  city: string;

  gstin: string | null;
  notApplicable: boolean;
  note: string | null;
}

/**
 * The registration step — verification, not a form.
 *
 * ## What is read-only here, and why
 *
 * The studio's name, the owner's name, the phone and the email are shown and
 * cannot be edited. They were recorded when the application was approved, and
 * two of them are load-bearing in ways an edit box does not suggest: the
 * trade name determines the slug, and the whole point of this step is that a
 * person checks the name against a public register. A studio that can rename
 * itself after verification makes the name we checked different from the name
 * a customer reads — quietly, and with nothing in the record saying so.
 *
 * So the control is a way to tell us it is wrong, rather than a way to change
 * it. That is slower for the one studio whose name really is mistyped, and it
 * is the right trade against the alternative.
 *
 * ## The GST question is unchanged
 *
 * The rule has always been "a GSTIN, or a note that you do not have one", and
 * for a long time only half of it was implementable: the page carried a
 * heading reading *"If you do not have a GSTIN"* over a paragraph and no
 * control at all. A proprietorship below the threshold could finish every
 * other step and sit forever on a greyed-out submit, with no way for ops to
 * unblock them either.
 *
 * The mockup for this screen has no GSTIN field. Adopting it literally would
 * put that back, so both answers stay.
 *
 * ## One form, two forms
 *
 * Everything except the upload posts together, because the step has one
 * button and therefore has to be one transaction — `saveRegistration` says
 * why. The upload is a second `<form>` alongside, since a file needs its own
 * submit and HTML has no nested forms. The save button reaches its form by
 * `form={FORM_ID}` rather than by containment, which is what keeps the
 * document section in the middle of the page where it reads best.
 */
export function RegistrationForm({
  defaults,
  documents,
  uploadEnabled,
}: {
  defaults: RegistrationDefaults;
  documents: StudioDocumentView[];
  uploadEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveRegistrationAction, INITIAL);
  const err = state.errors ?? {};

  /* Opens on whichever answer is already recorded, so a studio coming back to
     change something sees their own answer rather than a default. */
  const [answer, setAnswer] = useState<'has' | 'none'>(
    defaults.notApplicable ? 'none' : 'has',
  );
  const [addressLine, setAddressLine] = useState(defaults.addressLine ?? '');
  const [pincode, setPincode] = useState(defaults.pincode ?? '');
  const [gstin, setGstin] = useState(defaults.gstin ?? '');
  const [note, setNote] = useState(defaults.note ?? '');

  const addressOk = addressLine.trim().length >= 8 && /^[1-9][0-9]{5}$/.test(pincode.trim());
  const gstOk = answer === 'has' ? gstin.trim().length === 15 : note.trim().length >= 10;

  const missing = [
    !addressOk ? 'your address and pincode' : null,
    !gstOk
      ? answer === 'has'
        ? 'your GSTIN'
        : 'a sentence about why you are not registered'
      : null,
  ].filter((m): m is string => m !== null);

  const form = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <Reassurance />

      <form id={FORM_ID} ref={form} action={action} className="flex flex-col gap-4">
        <Section
          n={1}
          title="Business identity"
          hint="What we have on file from your application. If any of it is wrong, tell us rather than working around it — the name we verify has to be the name customers see."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnly label="Studio name" value={defaults.tradeName} />
            <ReadOnly label="Registered name" value={defaults.legalName} />
            <ReadOnly label="Contact person" value={defaults.contactName} />
          </div>
          <p className="m-0 mt-3 text-[13px] text-[var(--color-ink-3)]">
            Not right?{' '}
            <a
              href="mailto:studios@oneinteriors.in?subject=Correction%20to%20our%20details"
              className="text-[var(--color-petrol)] underline underline-offset-4"
            >
              Tell us what it should say
            </a>{' '}
            and we will change it before verification.
          </p>
        </Section>

        <Section
          n={2}
          title="Contact details"
          hint="How we reach you about briefs and about verification."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnly label="Mobile" value={defaults.phone} mono />
            <ReadOnly label="Email" value={defaults.email} />
          </div>
          {/* A claim that has to be true. Neither is on the public profile: a
              customer reaches a studio through us until an introduction is
              released, which is the whole mechanism. */}
          <p className="m-0 mt-3 flex items-start gap-2 text-[13.5px] leading-relaxed text-[var(--color-ontrack)]">
            <TickCircle />
            Used to reach you, never published. Customers only get these once you have both
            agreed to an introduction.
          </p>
        </Section>

        <Section
          n={3}
          title="Where you work from"
          hint="Somebody from here visits. An area name on its own is not enough to find you by."
          done={addressOk}
        >
          <div className="flex flex-col gap-4">
            <Text
              label="Address"
              name="addressLine"
              value={addressLine}
              onChange={setAddressLine}
              placeholder="301 Skyview Apartments, Baner Road"
              error={err.addressLine}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* City is fixed, not a dropdown with one entry in it. This is a
                  Pune marketplace and pretending otherwise is a control that
                  cannot be used. */}
              <ReadOnly label="City" value={titleCase(defaults.city)} />
              <Text
                label="Pincode"
                name="pincode"
                value={pincode}
                onChange={setPincode}
                placeholder="411045"
                inputMode="numeric"
                maxLength={6}
                mono
                error={err.pincode}
              />
            </div>
          </div>
        </Section>

        <Section
          n={4}
          title="GST registration"
          hint="Checked against the public GST record. The number is never shown on your profile — what appears is the badge it earns."
          done={gstOk}
        >
          {/* The radios are the real value. The pill buttons below set them,
              because a native radio cannot be styled into this shape — but the
              input is what posts, so a form submitted without JavaScript still
              carries an answer. */}
          <fieldset className="m-0 border-0 p-0">
            <legend className="label m-0 mb-2.5 p-0">Do you have a GST registration?</legend>
            <div className="flex flex-wrap gap-2">
              <Choice
                name="answer"
                value="has"
                active={answer === 'has'}
                onSelect={() => setAnswer('has')}
              >
                Yes — here it is
              </Choice>
              <Choice
                name="answer"
                value="none"
                active={answer === 'none'}
                onSelect={() => setAnswer('none')}
              >
                No, we are not registered
              </Choice>
            </div>
          </fieldset>

          <div className="mt-4">
            {answer === 'has' ? (
              <>
                <Text
                  label="GSTIN"
                  name="gstin"
                  value={gstin}
                  onChange={(v) => setGstin(v.toUpperCase())}
                  placeholder="27AAPFU0939F1ZV"
                  maxLength={15}
                  mono
                  error={err.gstin}
                  hint="Fifteen characters, as on the certificate. We check the format immediately so a typo does not cost you a week."
                />
                {defaults.gstin ? (
                  <p className="m-0 mt-2 text-[13.5px] text-[var(--color-ontrack)]">
                    Recorded. It still has to be confirmed against the GST portal by us before it
                    counts toward your badge.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="m-0 mb-3 max-w-[62ch] text-[14px] leading-relaxed text-[var(--color-ink-2)]">
                  Plenty of good studios are proprietorships that have not registered, and it is
                  not a disqualification. It does mean we verify you a different way — PAN, bank
                  records and an extra reference call. Tell us which it is, so whoever picks up
                  your file knows what to check instead of guessing.
                </p>
                <label htmlFor="gstinNote" className="label m-0 mb-1.5 block">
                  Why not, in a sentence
                </label>
                <textarea
                  id="gstinNote"
                  name="gstinNote"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Proprietorship, turnover below the registration threshold. Registration applied for last month."
                  className="oi-input w-full rounded-[12px] border border-[var(--color-rule)] px-4 py-3 text-[15px] leading-relaxed"
                />
                {err.gstinNote ? (
                  <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
                    {err.gstinNote}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </Section>
      </form>

      {/* Outside the form above — a file upload needs its own submit, and
          HTML has no nested forms. */}
      <ProofUpload documents={documents} enabled={uploadEnabled} />

      <SaveBar
        formId={FORM_ID}
        pending={pending}
        saved={state.status === 'saved'}
        formError={err.form}
        label="Save and continue"
        missing={missing}
      />
    </div>
  );
}

/**
 * The promise at the top of the page.
 *
 * It is here because this step asks for more than any other — an address, a
 * registration number, a photograph of a certificate — and the question
 * somebody is actually asking while they type it is what happens to all of
 * it. Answering that once, at the top, is worth more than a padlock icon on
 * five separate fields.
 */
function Reassurance() {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-[var(--color-ontrack)]/25 bg-[var(--color-ontrack-soft)] px-5 py-4">
      <span className="mt-0.5 flex-none text-[var(--color-ontrack)]">
        <ShieldCheck {...INLINE_ICON} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[14.5px] font-semibold text-[var(--color-ink)]">
          What you send here stays here
        </p>
        <p className="m-0 mt-0.5 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          Your registration number, your address and anything you upload are read by the person
          verifying you and by nobody else. None of it appears on your profile — what a customer
          sees is the badge it earns.
        </p>
      </div>
    </div>
  );
}

function ReadOnly({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="label m-0 mb-1.5">{label}</p>
      {/* A div, not a disabled input. A greyed-out box invites clicking and
          then refuses, and a `readonly` input is still focusable and still
          looks like somewhere to type. This is text, and reads as text. */}
      <div
        className={`rounded-[11px] border border-dashed border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2.5 text-[14.5px] ${
          value ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-3)]'
        } ${mono ? 'font-[family-name:var(--font-mono)] tabular-nums' : ''}`}
      >
        {value || 'Not on file'}
      </div>
    </div>
  );
}

function Text({
  label,
  name,
  value,
  onChange,
  placeholder,
  hint,
  error,
  mono,
  maxLength,
  inputMode,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  mono?: boolean;
  maxLength?: number;
  inputMode?: 'numeric';
}) {
  return (
    <div>
      <label htmlFor={name} className="label m-0 mb-1.5 block">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        className={`oi-input w-full rounded-[11px] border border-[var(--color-rule)] px-4 py-2.5 text-[14.5px] ${
          mono ? 'font-[family-name:var(--font-mono)] tracking-[0.04em]' : ''
        }`}
      />
      {hint && !error ? (
        <p className="m-0 mt-1.5 max-w-[56ch] text-[13px] leading-relaxed text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A pill that is really a radio.
 *
 * The input is visually hidden rather than absent, so the answer posts with
 * the form and arrives at the server whether or not this component's state
 * ever ran. `peer-focus-visible` puts the keyboard ring back on the pill,
 * because hiding an input usually takes its focus ring with it and leaves a
 * control nobody can see themselves operating.
 */
function Choice({
  name,
  value,
  active,
  onSelect,
  children,
}: {
  name: string;
  value: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`oi-chip inline-flex cursor-pointer items-center rounded-full border px-5 py-2.5 text-[14.5px] ${
        active
          ? 'oi-chip-on'
          : 'border-[var(--color-rule)] text-[var(--color-ink-2)]'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={active}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span className="peer-focus-visible:underline peer-focus-visible:underline-offset-4">
        {children}
      </span>
    </label>
  );
}

function TickCircle() {
  return (
    <span className="mt-[3px] grid h-[15px] w-[15px] flex-none place-items-center rounded-full bg-[var(--color-ontrack)] text-white">
      <Check {...DISC_ICON} />
    </span>
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
