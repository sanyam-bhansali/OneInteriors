'use server';

import { revalidatePath } from 'next/cache';
import { RATE_CATEGORIES, CATEGORY } from '@/modules/quotation/categories';
import { saveRateCard, type RateInput } from '@/modules/quotation/rate-card';
import {
  saveProfile,
  saveProfileDraft,
  saveRegistration,
  saveGstin,
  declareNoGstin,
  declarePortfolioShortfall,
  addProject,
  removeProject,
  submitForReview,
} from '@/modules/studio/onboarding';
import { uploadQuotations } from '@/modules/studio/quotation-archive-store';
import { uploadBusinessProof, withdrawDocument } from '@/modules/studio/documents';

export interface StepState {
  status: 'idle' | 'saved' | 'error';
  errors?: Record<string, string>;
}

/**
 * A positive count. Whole numbers only.
 *
 * `Number.isInteger` and not just `isFinite`, because these land in Prisma
 * `Int` columns: a fractional value from a direct server-action POST — which
 * bypasses the input's `step` — would throw deep in the ORM rather than coming
 * back as a field error.
 *
 * **Not for money.** See `lakhs` below.
 */
function count(v: FormDataEntryValue | null): number | undefined {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * A project size in lakhs, where fractions are the normal case.
 *
 * ₹7.5 lakh is an ordinary floor for a Pune studio, and this briefly required
 * a whole number — so a studio typing `7.5` got back "The smallest project you
 * will take", a message that reads as *you left it blank*. They would have
 * retyped it, failed again, and concluded the form was broken.
 *
 * Safe to accept a fraction here because `lakhsToPaise` rounds to integer paise
 * at the boundary, so nothing fractional reaches the database. Capped because
 * this is a free-text number that ends up in a BigInt column.
 */
function lakhs(v: FormDataEntryValue | null): number | undefined {
  const n = Number(String(v ?? '').trim());
  if (!Number.isFinite(n) || n <= 0 || n > 10_000) return undefined;
  // Two decimal places is finer than anyone quotes a project range in, and it
  // keeps the paise conversion exact.
  return Math.round(n * 100) / 100;
}

/**
 * Zero is a real answer for years active.
 *
 * `count` rejects it, which would have made a studio in its first year
 * unrepresentable — they would type 0, it would arrive as `undefined`, and the
 * step would tell them years active was still missing.
 */
function numFromZero(v: FormDataEntryValue | null): number | undefined {
  const raw = String(v ?? '').trim();
  if (raw === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function refresh() {
  revalidatePath('/studio');
  revalidatePath('/studio/onboarding', 'layout');
}

export async function saveProfileAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const result = await saveProfile({
    about: String(formData.get('about') ?? ''),
    localities: formData.getAll('localities').map(String),
    website: String(formData.get('website') ?? ''),
    instagram: String(formData.get('instagram') ?? ''),
    yearsActive: numFromZero(formData.get('yearsActive')),
    teamSize: count(formData.get('teamSize')),
    minLakhs: lakhs(formData.get('minLakhs')),
    maxLakhs: lakhs(formData.get('maxLakhs')),
  });

  if (!result.ok) return { status: 'error', errors: result.errors };
  refresh();
  return { status: 'saved' };
}

/**
 * The autosave counterpart to `saveProfileAction`.
 *
 * Same FormData, same parsers, different promise: this one stores what is
 * there and reports nothing. See `saveProfileDraft` for why the two paths are
 * separate rather than one function with a `validate` flag.
 *
 * ## It deliberately does not `refresh()`
 *
 * Every other action here revalidates the layout, which is right when a
 * person has pressed a button and is waiting to see the rail tick over. This
 * one runs on a timer while they are still typing, and re-rendering the
 * server tree underneath a form somebody is in the middle of filling is a
 * class of bug worth not having at all — a re-rendered `defaultValue` racing
 * a keystroke is the kind of thing that loses one character a minute and is
 * never reproducible.
 *
 * The consequence is that the rail, the header badge and the footer list stay
 * as they were until the studio presses Save. That is the honest reading
 * anyway: what autosave has done is keep their work, not finish the step.
 */
export async function saveProfileDraftAction(formData: FormData): Promise<void> {
  await saveProfileDraft({
    about: String(formData.get('about') ?? ''),
    localities: formData.getAll('localities').map(String),
    website: String(formData.get('website') ?? ''),
    instagram: String(formData.get('instagram') ?? ''),
    yearsActive: numFromZero(formData.get('yearsActive')),
    teamSize: count(formData.get('teamSize')),
    minLakhs: lakhs(formData.get('minLakhs')),
    maxLakhs: lakhs(formData.get('maxLakhs')),
  });
}

export async function saveRegistrationAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  /* Anything that is not the literal 'none' is 'has'. The radio only ever
     sends one of the two, so this is about a hand-made POST: defaulting an
     unrecognised value to "I have a GSTIN" means the number is validated,
     while defaulting the other way would record "not registered" for a studio
     that never said so. */
  const answer = String(formData.get('answer') ?? 'has') === 'none' ? 'none' : 'has';

  const result = await saveRegistration({
    addressLine: String(formData.get('addressLine') ?? ''),
    pincode: String(formData.get('pincode') ?? ''),
    answer,
    gstin: String(formData.get('gstin') ?? ''),
    gstinNote: String(formData.get('gstinNote') ?? ''),
  });
  if (!result.ok) return { status: 'error', errors: result.errors };
  refresh();
  return { status: 'saved' };
}

/**
 * Take one business-proof document.
 *
 * `formData.get` and not `getAll`: this control takes one file at a time, on
 * purpose. A multiple input here would let somebody select four scans and
 * have them all filed as a GST certificate, because the kind is chosen once
 * for the whole batch — and a document filed as the wrong thing is worse than
 * a document not sent, since nobody goes looking for it.
 */
export async function uploadProofAction(
  _prev: ProofState,
  formData: FormData,
): Promise<ProofState> {
  const file = formData.get('proof');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Choose a file first.' };
  }

  const result = await uploadBusinessProof(String(formData.get('kind') ?? ''), file);
  if (!result.ok) return { status: 'error', message: result.error };

  refresh();
  return { status: 'saved' };
}

export interface ProofState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

export async function withdrawProofAction(
  _prev: ProofState,
  formData: FormData,
): Promise<ProofState> {
  const result = await withdrawDocument(String(formData.get('id') ?? ''));
  if (!result.ok) return { status: 'error', message: result.error };
  refresh();
  return { status: 'saved' };
}

export async function saveGstinAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const result = await saveGstin(String(formData.get('gstin') ?? ''));
  if (!result.ok) return { status: 'error', errors: result.errors };
  refresh();
  return { status: 'saved' };
}

/**
 * The other answer to the registration step.
 *
 * Without this, a studio with no GST registration could finish every other step
 * and never submit — the rule said "a GSTIN, or a note that you do not have
 * one" and only the GSTIN was ever recordable.
 */
export async function declareNoGstinAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const result = await declareNoGstin(String(formData.get('gstinNote') ?? ''));
  if (!result.ok) return { status: 'error', errors: result.errors };
  refresh();
  return { status: 'saved' };
}

/**
 * The other answer to the portfolio step.
 *
 * Exactly parallel to `declareNoGstinAction`, and for the same reason: until
 * this existed, a practice with two finished projects could complete every
 * other step and never submit — and it found that out only after we had
 * approved it, which is the worst possible moment.
 */
export async function declarePortfolioShortfallAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const result = await declarePortfolioShortfall(
    String(formData.get('portfolioShortfallNote') ?? ''),
  );
  if (!result.ok) return { status: 'error', errors: result.errors };
  refresh();
  return { status: 'saved' };
}

export interface UploadState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
  /** Files that did not store, each named and with a reason. */
  skipped?: string[];
}

/**
 * Take a batch of past quotations from the signed-in studio.
 *
 * `formData.getAll` rather than `get`, because this is a multiple file input
 * and `get` would silently take only the first — a studio selecting thirty
 * files and having one stored, with no error, is the kind of bug that is found
 * by a confused email three weeks later.
 */
export async function uploadQuotationsAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const files = formData.getAll('quotations').filter((v): v is File => v instanceof File);

  const result = await uploadQuotations(files);
  if (!result.ok) return { status: 'error', message: result.error };

  refresh();
  return {
    status: 'saved',
    message: `${result.stored} file${result.stored === 1 ? '' : 's'} sent. Somebody here will read them — you do not need to wait.`,
    skipped: result.skipped,
  };
}

export async function addProjectAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const result = await addProject({
    title: String(formData.get('title') ?? ''),
    locality: String(formData.get('locality') ?? ''),
    propertyType: String(formData.get('propertyType') ?? ''),
    scope: String(formData.get('scope') ?? ''),
    styleTags: formData.getAll('styleTags').map(String),
    // A completed project's value takes fractions for the same reason the
    // declared range does — ₹7.5 lakh is an ordinary figure, and rejecting it
    // here would quietly drop the number rather than complain, leaving the
    // project recorded with no value at all.
    valueLakhs: lakhs(formData.get('valueLakhs')),
    durationDays: count(formData.get('durationDays')),
    completedOn: String(formData.get('completedOn') ?? ''),
    clientConsented: formData.get('clientConsented') === 'on',
    isRender: formData.get('isRender') === 'on',
  });

  if (!result.ok) return { status: 'error', errors: result.errors };
  refresh();
  return { status: 'saved' };
}

export async function removeProjectAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const result = await removeProject(String(formData.get('id') ?? ''));
  if (!result.ok) return { status: 'error', errors: result.errors };
  refresh();
  return { status: 'saved' };
}

export async function submitForReviewAction(
  _prev: StepState,
  _formData: FormData,
): Promise<StepState> {
  const result = await submitForReview();
  if (!result.ok) return { status: 'error', errors: result.errors };
  refresh();
  return { status: 'saved' };
}

export async function saveRatesAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const inputs: RateInput[] = [];

  for (const category of RATE_CATEGORIES) {
    const raw = String(formData.get(category) ?? '').trim();
    // An empty field is a deliberate "I do not do this work" for the optional
    // categories, and clearing a rate for the core ones. Either way it is a
    // value of zero, which the store turns into a deletion.
    const value = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return {
        status: 'error',
        errors: { [category]: `${CATEGORY[category].label} must be a number.` },
      };
    }
    inputs.push({ category, value });
  }

  const result = await saveRateCard(inputs);
  if (!result.ok) return { status: 'error', errors: result.errors };

  refresh();
  return { status: 'saved' };
}
