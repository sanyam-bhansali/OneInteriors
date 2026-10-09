'use server';

import { requestConsultation } from '@/modules/consultation/request';
import { getLang } from '@/modules/i18n/server';
import { localiseExpertError } from '@/modules/i18n/site/expert';

export interface ExpertState {
  status: 'idle' | 'sent' | 'error';
  errors?: Record<string, string>;
  /** Set when the call was booked into a slot rather than requested. */
  scheduledFor?: string;
}

/**
 * What an architect can usefully read before a half-hour call.
 *
 * The field is a text column with no length of its own, and it arrives from a
 * form anybody signed in can post to. A cap belongs on this side of the wire
 * rather than in the browser, where it is a suggestion.
 */
const MAX_ASKED = 2_000;
const MAX_TIMES = 200;

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
    askedAbout: String(formData.get('askedAbout') ?? '').slice(0, MAX_ASKED),
    preferredTimes: String(formData.get('preferredTimes') ?? '').slice(0, MAX_TIMES),
    startsAt: String(formData.get('startsAt') ?? '').slice(0, 40) || undefined,
    shareConsent: formData.get('shareConsent') === 'on',
  });

  if (!result.ok) {
    const lang = await getLang();
    const errors = Object.fromEntries(
      Object.entries(result.errors).map(([field, message]) => [field, localiseExpertError(lang, message)]),
    );
    return { status: 'error', errors };
  }
  return { status: 'sent', scheduledFor: result.scheduledFor };
}
