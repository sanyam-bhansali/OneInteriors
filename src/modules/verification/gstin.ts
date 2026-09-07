/**
 * GSTIN validation — entirely offline.
 *
 * A GSTIN carries its own check digit, so a typo or an invented number can be
 * caught before we ever call an API. That matters for two reasons: it saves a
 * paid lookup on garbage input, and it means ops gets an instant answer while
 * the studio is still on the phone.
 *
 * It does NOT prove the registration is active or that the trade name matches.
 * Only the GST portal can say that (OI-6b). A valid checksum means "this is a
 * well-formed GSTIN", never "this business is real" — and the profile must
 * never present it as more than that.
 *
 * Format, 15 characters:
 *
 *   27  AAKCA1234F  1   Z   P
 *   │   │           │   │   └── check digit
 *   │   │           │   └────── always 'Z' (reserved)
 *   │   │           └────────── entity number for this PAN in this state (1-9, A-Z)
 *   │   └────────────────────── the holder's 10-character PAN
 *   └────────────────────────── state code (27 = Maharashtra)
 */

/** Base-36 alphabet used by the check-digit algorithm. */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Shape only. The state portion is left as any two digits deliberately — the
 * STATE_CODES lookup below produces a far more useful message ("99 is not a
 * valid state code") than a generic shape failure would. Order the checks from
 * general to specific so the reason ops sees is the most specific true one.
 */
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** PAN: 5 letters, 4 digits, 1 letter. The 4th letter is the holder type. */
const PAN_SHAPE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export type PanHolderType =
  | 'Company'
  | 'Individual'
  | 'HUF'
  | 'Firm / LLP'
  | 'Association of persons'
  | 'Trust'
  | 'Body of individuals'
  | 'Local authority'
  | 'Artificial juridical person'
  | 'Government'
  | 'Unknown';

const PAN_HOLDER: Record<string, PanHolderType> = {
  C: 'Company',
  P: 'Individual',
  H: 'HUF',
  F: 'Firm / LLP',
  A: 'Association of persons',
  T: 'Trust',
  B: 'Body of individuals',
  L: 'Local authority',
  J: 'Artificial juridical person',
  G: 'Government',
};

export interface GstinParts {
  stateCode: string;
  stateName: string;
  pan: string;
  holderType: PanHolderType;
  entityNumber: string;
  checkDigit: string;
}

export type GstinResult =
  | { valid: true; gstin: string; parts: GstinParts }
  | { valid: false; reason: string };

/**
 * Compute the 15th character.
 *
 * Each of the first 14 characters is taken as a base-36 value, multiplied by an
 * alternating factor of 1 and 2, and the product's quotient and remainder over
 * 36 are both added to a running sum. The check digit completes that sum to a
 * multiple of 36.
 */
export function gstinCheckDigit(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = ALPHABET.indexOf(first14[i]);
    if (value < 0) throw new Error(`Invalid character in GSTIN at position ${i + 1}`);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return ALPHABET[(36 - (sum % 36)) % 36];
}

export function validateGstin(input: string): GstinResult {
  const gstin = input.trim().toUpperCase().replace(/\s+/g, '');

  if (!gstin) return { valid: false, reason: 'Enter a GSTIN.' };
  if (gstin.length !== 15) {
    return { valid: false, reason: `A GSTIN is 15 characters — this one is ${gstin.length}.` };
  }
  if (!GSTIN_SHAPE.test(gstin)) {
    return { valid: false, reason: 'That is not the shape of a GSTIN — check for a typo.' };
  }

  const stateCode = gstin.slice(0, 2);
  const stateName = STATE_CODES[stateCode];
  if (!stateName) {
    return { valid: false, reason: `${stateCode} is not a valid state code.` };
  }

  const expected = gstinCheckDigit(gstin.slice(0, 14));
  if (gstin[14] !== expected) {
    return {
      valid: false,
      reason: 'The check digit does not match — this GSTIN has a typo or was made up.',
    };
  }

  const pan = gstin.slice(2, 12);
  return {
    valid: true,
    gstin,
    parts: {
      stateCode,
      stateName,
      pan,
      holderType: PAN_HOLDER[pan[3]] ?? 'Unknown',
      entityNumber: gstin[12],
      checkDigit: gstin[14],
    },
  };
}

/** The PAN embedded in a GSTIN — lets one field satisfy two checks. */
export function panFromGstin(gstin: string): string | null {
  const result = validateGstin(gstin);
  return result.valid ? result.parts.pan : null;
}

export function isValidPan(input: string): boolean {
  return PAN_SHAPE.test(input.trim().toUpperCase());
}

/** Pune is Maharashtra. A studio registered elsewhere is worth a second look. */
export const MAHARASHTRA = '27';

export function isMaharashtra(gstin: string): boolean {
  return gstin.trim().slice(0, 2) === MAHARASHTRA;
}

export const STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other territory',
};
