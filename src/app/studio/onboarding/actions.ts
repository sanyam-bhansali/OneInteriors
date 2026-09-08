'use server';

import { revalidatePath } from 'next/cache';
import {
  saveProfile,
  saveGstin,
  addProject,
  removeProject,
  submitForReview,
} from '@/modules/studio/onboarding';

export interface StepState {
  status: 'idle' | 'saved' | 'error';
  errors?: Record<string, string>;
}

function num(v: FormDataEntryValue | null): number | undefined {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
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
    yearsActive: num(formData.get('yearsActive')),
    teamSize: num(formData.get('teamSize')),
    minLakhs: num(formData.get('minLakhs')),
    maxLakhs: num(formData.get('maxLakhs')),
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
    valueLakhs: num(formData.get('valueLakhs')),
    durationDays: num(formData.get('durationDays')),
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
