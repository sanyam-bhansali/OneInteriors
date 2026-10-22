'use server';

import { revalidatePath } from 'next/cache';
import { newQuoteForLead } from '@/modules/studio-sales/leads';
import {
  bringIn,
  findLeads,
  leadOnMobile,
  ourQuotesFor,
  planPreview,
  previewSource,
  saveLeadForBuilder,
  searchSource,
  type BringInInput,
  type QuoteChoice,
} from '@/modules/studio-bring-in/bring-in';

/**
 * "Add an existing project" (docs/studio-os/BRING-IN-PROJECTS.md). Every
 * check is in the module: `project.bringIn` (owner, PM, designer; Max), the
 * lead and quotation are this studio's, the source is read again on the
 * server (never trusted from the page), the total matches what was confirmed.
 */

export async function findLeadsAction(q: string) {
  return findLeads(String(q ?? '').slice(0, 60));
}

export async function leadOnMobileAction(phone: string) {
  return leadOnMobile(String(phone ?? '').slice(0, 20));
}

export async function searchSourceAction(q: string) {
  return searchSource(String(q ?? '').slice(0, 60));
}

export async function previewSourceAction(sourceId: string) {
  return previewSource(String(sourceId ?? '').slice(0, 64));
}

export async function ourQuotesAction(leadId: string) {
  return ourQuotesFor(String(leadId ?? '').slice(0, 64));
}

export async function planPreviewAction(quote: QuoteChoice, config: string | null) {
  return planPreview({ quote, config });
}

export async function bringInAction(input: BringInInput) {
  const r = await bringIn(input);
  if (r.ok) {
    revalidatePath('/studio/projects');
    revalidatePath('/studio/design');
    revalidatePath('/studio/home');
  }
  return r;
}

/** The builder path: save the new lead, then start its quotation in the builder. */
export async function builderQuoteAction(lead: { id: string } | { name: string; phone: string; email?: string; society?: string; locality?: string; config?: string }) {
  let leadId: string;
  if ('id' in lead) leadId = String(lead.id).slice(0, 64);
  else {
    const saved = await saveLeadForBuilder(lead);
    if (!saved.ok) return saved;
    leadId = saved.leadId;
  }
  const q = await newQuoteForLead(leadId);
  if (!q.ok) return q;
  return { ok: true as const, leadId, quoteId: q.id };
}
