/**
 * The lead page's small rules (Studio OS Phase 1, docs/studio-os/
 * PHASE-1-SALES.md §2). Pure, and tested (tests/studio-sales-lead.test.ts).
 *
 * The next-step button only SUGGESTS: it is the one obvious thing to do
 * next, and the salesperson can do anything else on the page. Nothing here
 * changes a lead by itself.
 */

import { formatINR } from '@/lib/money';
import { IST_OFFSET_MS } from '@/modules/project/working-days';

// ── The next step ──────────────────────────────────────────────

export type NextStepId = 'call' | 'floor-plan' | 'quote' | 'open-quote' | 'sales-final' | 'booking' | 'booked';

export interface NextStepFacts {
  /** Somebody has logged a call or contact. */
  contacted: boolean;
  hasFloorPlan: boolean;
  /** Quotations written for this lead. */
  quoteCount: number;
  /** Revisions sent, across its quotations. */
  sentRevisions: number;
  hasSalesFinal: boolean;
  booked: boolean;
}

export interface NextStep {
  id: NextStepId;
  label: string;
}

/** Call · Attach floor plan · New quotation · Mark sales final · Record booking — whichever is next. */
export function nextStep(f: NextStepFacts): NextStep {
  if (f.booked) return { id: 'booked', label: 'Open the project' };
  if (!f.contacted) return { id: 'call', label: 'Call' };
  if (f.quoteCount === 0 && !f.hasFloorPlan) return { id: 'floor-plan', label: 'Attach floor plan' };
  if (f.quoteCount === 0) return { id: 'quote', label: 'New quotation' };
  if (f.sentRevisions === 0) return { id: 'open-quote', label: 'Send the quotation' };
  if (!f.hasSalesFinal) return { id: 'sales-final', label: 'Mark sales final' };
  return { id: 'booking', label: 'Record booking' };
}

// ── Files ──────────────────────────────────────────────────────

/** Large enough for a scanned floor plan PDF; the upload goes straight to storage. */
export const LEAD_FILE_MAX_BYTES = 15 * 1024 * 1024;

export const LEAD_FILE_TYPES: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export const LEAD_FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic';

export type FileCheck = { ok: true; ext: string } | { ok: false; error: string };

export function checkLeadFile(contentType: unknown, bytes: unknown): FileCheck {
  const type = typeof contentType === 'string' ? contentType.split(';')[0]!.trim().toLowerCase() : '';
  const ext = LEAD_FILE_TYPES[type];
  if (!ext) return { ok: false, error: 'Attach a PDF or a photo (JPG, PNG, WebP or HEIC).' };
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0) return { ok: false, error: 'That file is empty.' };
  if (bytes > LEAD_FILE_MAX_BYTES) return { ok: false, error: 'Files can be up to 15 MB. A photo of the printed plan is fine.' };
  return { ok: true, ext };
}

/** Where a lead's file is stored. The prefix is how a finished upload is checked against its lead. */
export const leadFilePrefix = (studioId: string, clientId: string) => `studio_${studioId}/lead_${clientId}/`;

export function leadFilePath(studioId: string, clientId: string, uuid: string, ext: string): string {
  return `${leadFilePrefix(studioId, clientId)}${uuid}.${ext}`;
}

/** A finished upload's path belongs to this lead (or is a local-development stand-in for it). */
export function pathBelongsTo(path: unknown, studioId: string, clientId: string): path is string {
  if (typeof path !== 'string' || path.length > 300 || path.includes('..')) return false;
  const re = /^[A-Za-z0-9_-]+\/lead_[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.[a-z]{3,4}$/;
  const prefix = leadFilePrefix(studioId, clientId);
  return (path.startsWith(prefix) && re.test(path)) || path.startsWith(`dev-unstored/${prefix}`);
}

/** "plan.pdf" kept short and plain for the list. */
export function cleanFileName(name: unknown): string {
  const n = typeof name === 'string' ? name.replace(/[\\/\u0000-\u001f]/g, ' ').trim() : '';
  return (n || 'File').slice(0, 120);
}

export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// ── Budget ─────────────────────────────────────────────────────

/**
 * What the client said they would spend, as typed: "12 lakh", "12L",
 * "1.2 cr", "12,00,000", "1200000". Empty means no budget. Null result with
 * an error when it cannot be read — never a guess.
 */
export function parseBudget(raw: unknown): { ok: true; paise: number | null } | { ok: false; error: string } {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[₹,\s]/g, '') : '';
  if (!s) return { ok: true, paise: null };
  const m = /^(\d+(?:\.\d+)?)(l|lac|lacs|lakh|lakhs|cr|crore|crores|k)?$/.exec(s.replace(/^rs\.?/, ''));
  if (!m) return { ok: false, error: 'Write the budget as 12 lakh, 12L, 1.2 cr or 1200000.' };
  const n = Number(m[1]);
  const unit = m[2] ?? '';
  const rupees = unit.startsWith('l') ? n * 100_000 : unit.startsWith('c') ? n * 10_000_000 : unit === 'k' ? n * 1000 : n;
  const paise = Math.round(rupees * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise >= 1e12) return { ok: false, error: 'That budget does not look right.' };
  return { ok: true, paise };
}

/** "₹12 L" style, for the header; the exact figure for the edit box. */
export function budgetText(paise: number | null): string {
  if (paise === null) return '';
  const lakhs = paise / 10_000_000;
  if (lakhs >= 100) return `₹${trim(lakhs / 100)} Cr`;
  if (lakhs >= 1) return `₹${trim(lakhs)} L`;
  return formatINR(paise);
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));

/** The budget as the edit box shows it: "12 lakh". */
export function budgetInput(paise: number | null): string {
  if (paise === null) return '';
  const lakhs = paise / 10_000_000;
  return lakhs >= 1 ? `${trim(lakhs)} lakh` : String(Math.round(paise / 100));
}

// ── The meeting ────────────────────────────────────────────────

/** "2026-10-17" + "11:00" in India → the instant. Null when either is not a real day or time. */
export function parseMeeting(day: unknown, time: unknown): Date | null {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const at = new Date(Date.parse(`${day}T${time}:00Z`) - IST_OFFSET_MS);
  if (Number.isNaN(at.getTime())) return null;
  if (new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10) !== day) return null;
  return at;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 17 Oct, 11 am" in India. */
export function meetingLabel(at: Date): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  // Written out rather than toLocaleDateString, whose commas differ between runtimes.
  const day = `${WEEKDAYS[ist.getUTCDay()]} ${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${day}, ${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

/** The meeting as the edit form shows it: ["2026-10-17", "11:00"] in India. */
export function meetingInputs(at: Date | null): [string, string] {
  if (!at) return ['', ''];
  const iso = new Date(at.getTime() + IST_OFFSET_MS).toISOString();
  return [iso.slice(0, 10), iso.slice(11, 16)];
}

// ── Talking to them ────────────────────────────────────────────

/** Ten digits for a lead's phone as stored, or null. */
function tenDigits(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D/g, '');
  const ten = d.length > 10 ? d.slice(-10) : d;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export function telLink(phone: string | null | undefined): string | null {
  const ten = tenDigits(phone);
  return ten ? `tel:+91${ten}` : null;
}

/**
 * Opens the salesperson's OWN WhatsApp with a chat to the client. We send
 * nothing (owner, 12 Oct): this is a link, and the message, if any, is
 * typed and sent by them.
 */
export function whatsappLink(phone: string | null | undefined): string | null {
  const ten = tenDigits(phone);
  return ten ? `https://wa.me/91${ten}` : null;
}

// ── The timeline line for an edit ──────────────────────────────

const FIELD_WORDS: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  society: 'society',
  config: 'BHK',
  budget: 'budget',
  source: 'source',
  locality: 'area',
};

/** "Changed phone and budget". Null when nothing changed. */
export function editSummary(changed: readonly string[]): string | null {
  const words = changed.map((c) => FIELD_WORDS[c] ?? c);
  if (words.length === 0) return null;
  if (words.length === 1) return `Changed ${words[0]}`;
  return `Changed ${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
