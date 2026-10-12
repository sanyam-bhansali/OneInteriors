'use server';

/**
 * The server actions behind Studio OS Phase 1's screens: Today, the lead
 * page, revisions and the sales final, the booking, and the sales settings.
 * Every one hands untrusted input to a module that checks who is asking
 * (studio/lead-scope.ts, roles.ts `can`) before anything is read or written.
 * Only async functions are exported from here.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assignClients } from '@/modules/studio-practice/clients';
import {
  addLeadNote,
  attachLeadFile,
  editLeadDetails,
  newQuoteForLead,
  removeLeadFile,
  setLeadMeeting,
  type EditResult,
} from '@/modules/studio-sales/leads';
import { markSalesFinal, sendAgain } from '@/modules/studio-sales/revisions';
import { recordBooking, refundBooking, type RefundResult } from '@/modules/studio-sales/booking';
import { addLeadSource, removeLeadSource, savePaymentTemplate } from '@/modules/studio-sales/settings';
import { createQuote } from '@/modules/studio-quote/quotes';
import { addClient } from '@/modules/studio-practice/clients';
import type { PaymentStage } from '@/modules/studio-sales/payment-template';

import type { Done } from './sales-types';

function refreshLead(clientId?: string | null) {
  revalidatePath('/studio/today');
  revalidatePath('/studio/clients');
  revalidatePath('/studio');
  if (clientId) revalidatePath(`/studio/clients/${clientId}`);
}

// ── Assigning ──────────────────────────────────────────────────

/** Give leads to somebody (or the pool, with null). Owner and PM; the module checks. */
export async function assignLeadsAction(ids: string[], memberId: string | null): Promise<Done> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'Pick at least one lead.' };
  const clean = ids.filter((i) => typeof i === 'string').slice(0, 500);
  const r = await assignClients(clean, typeof memberId === 'string' && memberId ? memberId : null);
  if (!r.ok) return r;
  refreshLead(clean.length === 1 ? clean[0] : null);
  revalidatePath('/studio/clients/pool');
  return { ok: true, message: memberId ? (clean.length === 1 ? 'Assigned. They have been told.' : `${clean.length} leads assigned. They have been told.`) : 'Back in the pool.' };
}

// ── The lead ───────────────────────────────────────────────────

export async function editLeadAction(input: {
  clientId: string;
  name: string;
  phone: string;
  email: string;
  society: string;
  config: string;
  budget: string;
  source: string;
  force?: boolean;
}): Promise<EditResult> {
  const r = await editLeadDetails({ ...input, force: input.force === true });
  if (r.ok) refreshLead(input.clientId);
  return r;
}

export async function addNoteAction(clientId: string, note: string): Promise<Done> {
  const r = await addLeadNote(String(clientId), note);
  if (!r.ok) return r;
  refreshLead(clientId);
  return { ok: true, message: 'Note added.' };
}

export async function setMeetingAction(clientId: string, day: string, time: string, note: string): Promise<Done> {
  const r = await setLeadMeeting(String(clientId), day, time, note);
  if (!r.ok) return r;
  refreshLead(clientId);
  return { ok: true, message: day ? 'Meeting saved. It shows on Today that day.' : 'Meeting cleared.' };
}

export async function attachFileAction(input: { clientId: string; path: string; name: string; contentType: string; bytes: number; kind: string }): Promise<Done> {
  const r = await attachLeadFile(input);
  if (!r.ok) return r;
  refreshLead(input.clientId);
  return { ok: true, message: input.kind === 'FLOOR_PLAN' ? 'Floor plan attached.' : 'File attached.' };
}

export async function removeFileAction(clientId: string, fileId: string): Promise<Done> {
  const r = await removeLeadFile(String(fileId));
  if (!r.ok) return r;
  refreshLead(clientId);
  return { ok: true, message: 'File removed.' };
}

/** "New quotation" on the lead: made, filled from the lead, and opened. */
export async function newQuoteForLeadAction(clientId: string): Promise<Done> {
  const r = await newQuoteForLead(String(clientId));
  if (!r.ok) return r;
  refreshLead(clientId);
  revalidatePath('/studio/quotations');
  redirect(`/studio/quotations/${r.id}`);
}

/**
 * The new-quotation screen's "a new lead": add the lead (in the pool for
 * owner and PM, theirs for a salesperson), then a quotation for them.
 */
export async function newLeadAndQuoteAction(input: { name: string; phone: string; society: string; config: string }): Promise<Done> {
  const added = await addClient({ name: String(input.name ?? ''), phone: String(input.phone ?? ''), society: String(input.society ?? ''), config: String(input.config ?? ''), source: 'OTHER' });
  if (!added.ok) {
    if ('duplicate' in added) return { ok: false, error: `${added.duplicate.name} already has that number. Search for them by name or phone above.` };
    return added;
  }
  const r = await createQuote({ clientName: String(input.name), clientPhone: input.phone || undefined, society: input.society || undefined, config: input.config || undefined, clientId: added.id });
  if (!r.ok) return r;
  refreshLead(added.id);
  redirect(`/studio/quotations/${r.id}`);
}

// ── Revisions and the sales final ──────────────────────────────

export async function sendAgainAction(quoteId: string): Promise<Done> {
  const r = await sendAgain(String(quoteId));
  if (!r.ok) return r;
  revalidatePath(`/studio/quotations/${quoteId}`);
  revalidatePath('/studio/today');
  return { ok: true, message: r.created ? `Saved as R${r.n}: the copy the client has now.` : `Nothing changed since R${r.n}, so it stays R${r.n}.` };
}

export async function markSalesFinalAction(quoteId: string, n: number, stages: PaymentStage[], clientId: string | null): Promise<Done> {
  const r = await markSalesFinal(String(quoteId), Number(n), Array.isArray(stages) ? stages : []);
  if (!r.ok) return r;
  revalidatePath(`/studio/quotations/${quoteId}`);
  refreshLead(clientId);
  revalidatePath('/studio/payments');
  return { ok: true, message: `R${n} is the sales final. Accounts can record the booking against it.` };
}

// ── The booking ────────────────────────────────────────────────

export async function recordBookingAction(input: {
  quoteId: string;
  amount: string;
  receivedOn: string;
  mode: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}): Promise<Done> {
  const r = await recordBooking(input);
  if (!r.ok) return r;
  refreshLead(r.clientId);
  revalidatePath(`/studio/quotations/${input.quoteId}`);
  revalidatePath('/studio/payments');
  revalidatePath('/studio/projects');
  const how = r.invitedBy.length ? `invited to the app by ${r.invitedBy.join(' and ')}` : 'ready to be invited: share the link from the project';
  return { ok: true, message: `Booked. The project is open and the client is ${how}.` };
}

export async function refundBookingAction(clientId: string, reason: string, lateConfirmed: boolean): Promise<RefundResult> {
  const r = await refundBooking({ clientId: String(clientId), reason, lateConfirmed: lateConfirmed === true });
  if (r.ok) {
    refreshLead(clientId);
    revalidatePath('/studio/payments');
    revalidatePath('/studio/projects');
  }
  return r;
}

// ── Settings ───────────────────────────────────────────────────

export async function savePaymentStagesAction(stages: PaymentStage[]): Promise<Done> {
  const r = await savePaymentTemplate(stages);
  if (!r.ok) return r;
  revalidatePath('/studio/settings/payments');
  return { ok: true, message: 'Saved. New sales finals start from these stages.' };
}

export async function addLeadSourceAction(name: string): Promise<Done> {
  const r = await addLeadSource(name);
  if (!r.ok) return r;
  revalidatePath('/studio/settings/sources');
  return { ok: true, message: 'Added. It is in every source list now.' };
}

export async function removeLeadSourceAction(id: string): Promise<Done> {
  const r = await removeLeadSource(id);
  if (!r.ok) return r;
  revalidatePath('/studio/settings/sources');
  return { ok: true, message: 'Removed. Its leads now show as Other.' };
}
