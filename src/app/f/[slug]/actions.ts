'use server';

import { headers } from 'next/headers';
import { submitEnquiry } from '@/modules/studio-practice/capture';
import { addressOf } from '@/modules/rate-limit/store';

/**
 * The one server action in this product reachable without a session.
 *
 * It re-reads everything from the FormData and trusts none of it. In
 * particular the `slug` arrives in a hidden input, which anybody can change —
 * which is fine, because `submitEnquiry` resolves it to a studio itself and
 * an unknown slug simply produces `closed`. There is no id from the browser
 * that could reach a studio the slug does not name.
 */

export interface CaptureState {
  status: 'idle' | 'ok' | 'invalid' | 'closed' | 'limited' | 'error';
  message?: string;
  /** Which input to focus. */
  field?: string;
}

export async function submitEnquiryAction(
  _prev: CaptureState,
  form: FormData,
): Promise<CaptureState> {
  const str = (k: string) => String(form.get(k) ?? '');

  /* The address is a rate-limit key and nothing else. It is never written to
     the lead: an IP is personal data under the DPDP Act and tells a studio
     nothing they can act on. */
  const h = await headers();
  const address = addressOf(h.get('x-forwarded-for'));

  const result = await submitEnquiry(
    str('slug'),
    {
      name: str('name'),
      phone: str('phone'),
      email: str('email'),
      locality: str('locality'),
      config: str('config'),
      message: str('message'),
      company: str('company'),
    },
    address,
  );

  if (result.status === 'ok') return { status: 'ok' };
  if (result.status === 'closed') return { status: 'closed' };
  if (result.status === 'invalid') {
    return { status: 'invalid', field: result.field, message: result.message };
  }
  return { status: result.status, message: result.message };
}
