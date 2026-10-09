'use server';

import { requestConsultation } from '@/modules/consultation/request';
import { getLang } from '@/modules/i18n/server';
import { EXPERT_DICT, localiseExpertError } from '@/modules/i18n/site/expert';
import { tx } from '@/modules/i18n/site';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { normalisePhone } from '@/modules/studio/phone';

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
  /* The booking is confirmed with a WhatsApp code (owner, 10 Oct 2026): the
     form verifies it first, which signs them in on that number. Refuse a
     booking whose number is not that verified one, so the code cannot be
     skipped by posting here directly. */
  if (hasDatabase()) {
    const user = await getCurrentUser();
    const asked = normalisePhone(String(formData.get('contactPhone') ?? ''));
    if (!user || !user.phone || !asked || normalisePhone(user.phone) !== asked) {
      const lang = await getLang();
      return { status: 'error', errors: { form: tx(lang, EXPERT_DICT['flow.verifyFirst']) } };
    }
  }

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
