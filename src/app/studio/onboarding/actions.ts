'use server';

import { revalidatePath } from 'next/cache';
import { RATE_CATEGORIES, CATEGORY } from '@/modules/quotation/categories';
import { saveRateCard, type RateInput } from '@/modules/quotation/rate-card';
import {
  saveProfile,
  saveGstin,
  declareNoGstin,
  addProject,
  removeProject,
  submitForReview,
} from '@/modules/studio/onboarding';

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
