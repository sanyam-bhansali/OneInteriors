/**
 * The client's digital sign-off of a quotation (owner, team meeting 15 Oct
 * 2026): "wherever you need, we can always ask for a digital signature and
 * approval ... padhiye, last mein 'I agree' tick kijiye, aur bhejiye."
 *
 * Pure, and tested (tests/quote-signoff.test.ts). The writes are in
 * signoffs.ts.
 *
 * - What can be signed: the sales final (the BOQ the booking was made on)
 *   and the design final, each as one frozen revision (`StudioQuoteRevision`,
 *   never edited).
 * - The studio decides when to ask (`signoff.request`); nothing forces it,
 *   and a request can be withdrawn while unsigned.
 * - The client (the owner of the brief) reads the revision in the
 *   quotation's own format, ticks "I have read and agree", types their full
 *   name as their signature and submits. Recorded: who, when, IP and user
 *   agent where the request carries them, and a SHA-256 of exactly the
 *   revision's stored content (`contentHash`), checked again at signing.
 * - A newer revision sent after signing needs a new sign-off; the old
 *   signature stays on the old revision.
 * - The agreement (design walkthrough, 27 Oct 2026): the studio's terms with
 *   the sales final. Hidden from the client until the studio asks them to
 *   sign it; they read it in a small box, tick "I agree" and type their
 *   name, or sign it on paper at the office with Aadhaar and PAN copies.
 */

export const SIGNOFF_KINDS = [
  "SALES_FINAL",
  "AGREEMENT",
  "DESIGN_FINAL",
] as const;
export type SignoffKind = (typeof SIGNOFF_KINDS)[number];

export const isSignoffKind = (v: unknown): v is SignoffKind =>
  typeof v === "string" && (SIGNOFF_KINDS as readonly string[]).includes(v);

export const SIGNOFF_KIND_LABEL: Record<SignoffKind, string> = {
  SALES_FINAL: "Sales final quotation (BOQ)",
  AGREEMENT: "Agreement",
  DESIGN_FINAL: "Design final quotation",
};

/** The sentence the client ticks. Stored with the signature, word for word. */
export const AGREE_TEXT =
  "I have read this quotation in full, including its terms, and I agree to it.";
export const AGREEMENT_AGREE_TEXT =
  "I have read the agreement in full and I agree to everything in it.";
export const agreeTextOf = (kind: SignoffKind) =>
  kind === "AGREEMENT" ? AGREEMENT_AGREE_TEXT : AGREE_TEXT;

export const NAME_MIN = 3;
export const NAME_MAX = 80;

/** JSON with every object's keys sorted, so the same content always hashes the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

/* The hash itself (node:crypto) is in signoff-hash.ts, so this file stays safe for the browser. */

/** The typed name: letters (any script), spaces, dots, hyphens and apostrophes; a first and a last name. */
export function checkSignerName(
  v: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const t =
    typeof v === "string" ? v.normalize("NFC").replace(/\s+/g, " ").trim() : "";
  if (t.length < NAME_MIN)
    return { ok: false, error: "Type your full name as your signature." };
  if (t.length > NAME_MAX)
    return { ok: false, error: "That name is too long." };
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(t))
    return { ok: false, error: "Type your name in letters only." };
  return { ok: true, name: t };
}

export type SignoffState = "waiting" | "signed" | "withdrawn" | "superseded";

/**
 * Where a request stands. `superseded`: the studio sent a newer revision of
 * the quotation before the client signed, so this one can no longer be
 * signed (a new request is needed). A signed one stays signed whatever
 * comes after: the signature belongs to its revision.
 */
export function signoffState(
  s: { signedAt: unknown; withdrawnAt: unknown; revisionN: number },
  latestN: number,
): SignoffState {
  if (s.signedAt) return "signed";
  if (s.withdrawnAt) return "withdrawn";
  if (latestN > s.revisionN) return "superseded";
  return "waiting";
}

/** Why the client may not sign this now, or null. */
export function signRefusal(input: {
  state: SignoffState;
  owner: boolean;
  agreed: unknown;
  storedHash: string;
  currentHash: string;
  shownHash?: unknown;
}): string | null {
  if (!input.owner) return "Only the person who owns this project can sign it.";
  if (input.state === "signed") return "You have signed this already.";
  if (input.state === "withdrawn") return "The studio withdrew this request.";
  if (input.state === "superseded")
    return "The studio has sent a newer version of this quotation. They will ask you to sign that one.";
  if (input.agreed !== true) return 'Tick "I have read and agree" first.';
  if (input.currentHash !== input.storedHash)
    return "This quotation changed after the studio asked. Ask them to send it again.";
  if (
    typeof input.shownHash === "string" &&
    input.shownHash &&
    input.shownHash !== input.currentHash
  )
    return "The quotation changed while you were reading it. Open it again.";
  return null;
}

/** Why the studio may not ask now, or null. */
export function requestRefusal(input: {
  hasRevision: boolean;
  kind: SignoffKind;
  pendingSameRevision: boolean;
  signedSameRevision: boolean;
  hasTerms?: boolean;
}): string | null {
  if (!input.hasRevision) {
    if (input.kind === "DESIGN_FINAL")
      return "Send the design final to the client first: a sign-off is asked on a version they received.";
    return input.kind === "AGREEMENT"
      ? "There is no sales final on this project: the agreement goes with it."
      : "There is no sales final on this project to sign.";
  }
  if (input.kind === "AGREEMENT" && input.hasTerms === false)
    return "Write the studio's terms first (Settings, letterhead): they are the agreement.";
  if (input.signedSameRevision)
    return "The client has already signed this version.";
  if (input.pendingSameRevision)
    return "The client already has this version to sign.";
  return null;
}

/** A request's IP and user agent, trimmed to sizes worth keeping. */
export function requestFacts(headers: {
  forwardedFor?: string | null;
  realIp?: string | null;
  userAgent?: string | null;
}): { ip: string | null; userAgent: string | null } {
  const first =
    (headers.forwardedFor ?? "").split(",")[0]?.trim() ||
    headers.realIp?.trim() ||
    "";
  const ip = /^[0-9a-fA-F:.]{3,45}$/.test(first) ? first : null;
  const ua =
    (headers.userAgent ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 300) || null;
  return { ip, userAgent: ua };
}

/** "Signed by Asha Rao on 15 Oct 2026" (IST). */
export function signedLine(name: string, signedAt: Date): string {
  const day = signedAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  return `Signed by ${name} on ${day}`;
}

/** The locker key of a signed copy: a record pointing at the page that shows the revision and the signature. */
export const SIGNOFF_PREFIX = "signoff:";
export const signoffDocKey = (signoffId: string) =>
  `${SIGNOFF_PREFIX}${signoffId}`;

/** What the client sees of a request. */
export interface CustomerSignoff {
  id: string;
  kind: SignoffKind;
  quoteNumber: string;
  revision: number;
  totalPaise: number;
  state: SignoffState;
  requestedOn: string;
  signedOn: string | null;
  signerName: string | null;
  /** The owner of the brief may sign it now. */
  canSign: boolean;
}

export function toCustomerSignoff(
  r: {
    id: string;
    kind: string;
    quoteNumber: string;
    revisionN: number;
    totalPaise: number;
    requestedOn: string;
    signedOn: string | null;
    signerName: string | null;
    signedAt: unknown;
    withdrawnAt: unknown;
  },
  latestN: number,
  owner: boolean,
): CustomerSignoff | null {
  if (!isSignoffKind(r.kind)) return null;
  const state = signoffState(
    {
      signedAt: r.signedAt,
      withdrawnAt: r.withdrawnAt,
      revisionN: r.revisionN,
    },
    latestN,
  );
  if (state === "withdrawn") return null;
  return {
    id: r.id,
    kind: r.kind,
    quoteNumber: r.quoteNumber,
    revision: r.revisionN,
    totalPaise: r.totalPaise,
    state,
    requestedOn: r.requestedOn,
    signedOn: state === "signed" ? r.signedOn : null,
    signerName: state === "signed" ? r.signerName : null,
    canSign: owner && state === "waiting",
  };
}
