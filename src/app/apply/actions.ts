'use server';

import { headers } from 'next/headers';
import { submitApplication } from '@/modules/studio/application';

export interface ApplyState {
  status: 'idle' | 'sent' | 'error';
  errors?: Record<string, string>;
}

function num(v: FormDataEntryValue | null): number | undefined {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function submitApplicationAction(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const h = await headers();

  const result = await submitApplication({
    tradeName: String(formData.get('tradeName') ?? ''),
    legalName: String(formData.get('legalName') ?? ''),
    contactName: String(formData.get('contactName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    website: String(formData.get('website') ?? ''),
    instagram: String(formData.get('instagram') ?? ''),
    localities: formData.getAll('localities').map(String),
    gstin: String(formData.get('gstin') ?? ''),
    yearsActive: num(formData.get('yearsActive')),
    teamSize: num(formData.get('teamSize')),
    minLakhs: num(formData.get('minLakhs')),
    maxLakhs: num(formData.get('maxLakhs')),
    about: String(formData.get('about') ?? ''),
    howHeard: String(formData.get('howHeard') ?? ''),
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  if (!result.ok) return { status: 'error', errors: result.errors };
  return { status: 'sent' };
}
