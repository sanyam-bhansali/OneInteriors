/**
 * The customer's name, mobile and email, remembered on this device once typed
 * (owner, 10 Oct 2026: "make sure they remember name and no. once filled").
 *
 * Browser-only, in localStorage — the same place the brief already waits
 * before it is sent, and the privacy notice already says the name stays on the
 * device until then. Consent is never remembered: the boxes are ticked fresh
 * each time, because agreeing is an act, not a preference.
 */

export interface RememberedContact {
  name: string;
  phone: string;
  email: string;
}

const KEY = 'oi.contact';

export function readContact(): RememberedContact | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RememberedContact>;
    return {
      name: typeof v.name === 'string' ? v.name.slice(0, 80) : '',
      phone: typeof v.phone === 'string' ? v.phone.slice(0, 20) : '',
      email: typeof v.email === 'string' ? v.email.slice(0, 120) : '',
    };
  } catch {
    return null;
  }
}

/** Merge what was typed into what is remembered; blanks never erase a saved value. */
export function rememberContact(next: Partial<RememberedContact>) {
  try {
    const now = readContact() ?? { name: '', phone: '', email: '' };
    const merged: RememberedContact = {
      name: next.name?.trim() || now.name,
      phone: next.phone?.trim() || now.phone,
      email: next.email?.trim() || now.email,
    };
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* storage blocked: this visit only */
  }
}
