'use server';

import { requestConsultation } from '@/modules/consultation/request';

export interface ExpertState {
  status: 'idle' | 'sent' | 'error';
  errors?: Record<string, string>;
}

export async function requestExpertAction(
  _prev: ExpertState,
  formData: FormData,
): Promise<ExpertState> {
  const result = await requestConsultation({
    briefId: String(formData.get('briefId') ?? ''),
    studioIds: formData.getAll('studioIds').map(String),
    contactName: String(formData.get('contactName') ?? ''),
    contactPhone: String(formData.get('contactPhone') ?? ''),
    contactEmail: String(formData.get('contactEmail') ?? ''),
    askedAbout: String(formData.get('askedAbout') ?? ''),
    preferredTimes: String(formData.get('preferredTimes') ?? ''),
  });

  if (!result.ok) return { status: 'error', errors: result.errors };
  return { status: 'sent' };
}
