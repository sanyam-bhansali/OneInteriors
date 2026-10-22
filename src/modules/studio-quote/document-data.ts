import 'server-only';

/**
 * What the quotation PDF needs besides the lines and the totals: who it is
 * from (the studio's details, its logo and brand pages as short signed
 * links), the payment stages with their end deliverables, the material
 * specification and the terms. One loader for the print page, the builder's
 * PDF preview and the Final PDF, so they cannot drift apart.
 *
 * Scoped like `getQuote`: the quotation must belong to the studio the member
 * quotes for (`quotingStudioId`), so a salesperson printing their own
 * client's quotation gets their studio's pages and nobody else's.
 */

import { prisma } from '@/lib/prisma';
import { quotingStudioId } from '@/modules/studio/lead-scope';
import { signedBrandPageUrls, signedQuoteLogoUrl } from '@/modules/storage/studio-logo';
import { readStages, templateOrDefault, type PaymentStage } from '@/modules/studio-sales/payment-template';
import { myBranding, myStudioProfile, myTier, type BrandingRow } from './store';
import { showsOurMark, MARK_TEXT } from './mark';
import { coverFacts, type DocSpecRow, type DocStudio } from './document';
import type { QuoteRow } from './quotes';

export interface DocContext {
  studio: DocStudio | null;
  brandPages: string[];
  schedule: PaymentStage[] | null;
  spec: DocSpecRow[];
  terms: string | null;
  validDays: number;
  showMark: boolean;
  markText: string;
  branding: BrandingRow | null;
}

export async function quoteDocContext(quote: Pick<QuoteRow, 'id' | 'phases' | 'terms' | 'status'>): Promise<DocContext> {
  const [branding, tier, profile, studioId] = await Promise.all([myBranding(), myTier(), myStudioProfile(), quotingStudioId()]);

  const [row, logoUrl, brandPages] = await Promise.all([
    studioId
      ? prisma.studioQuote
          .findFirst({ where: { id: quote.id, studioId }, select: { salesFinalSchedule: true, studio: { select: { paymentTemplate: true } } } })
          .catch(() => null)
      : Promise.resolve(null),
    signedQuoteLogoUrl(branding?.logoPath ?? null, studioId),
    signedBrandPageUrls(branding?.brandPages ?? [], studioId),
  ]);

  /* The sales final's own copy of the stages when it has one; else the
     studio's (Settings → Payment stages), unless the quotation carries the
     studio's older percentage schedule, which `computeTotals` already uses. */
  const schedule = readStages(row?.salesFinalSchedule) ?? ((quote.phases?.length ?? 0) > 0 ? null : row ? templateOrDefault(row.studio.paymentTemplate) : null);

  const studio: DocStudio | null = branding
    ? {
        name: branding.legalName,
        tradeName: branding.documentName?.trim() || profile?.tradeName || null,
        addressLine: branding.addressLine,
        city: branding.city,
        pincode: branding.pincode,
        phone: branding.phone,
        email: branding.email,
        website: branding.website,
        gstin: branding.gstin,
        logoUrl,
        accentHex: branding.accentHex,
        facts: coverFacts(profile),
      }
    : null;

  return {
    studio,
    brandPages,
    schedule,
    spec: branding?.materialSpec ?? [],
    /* A quotation keeps the terms it was made with. One saved without any
       (made before the studio wrote its terms) prints the studio's current
       terms, so every PDF ends with a Terms & Conditions page (owner, 13 Oct 2026). */
    terms: quote.terms?.trim() ? quote.terms : (branding?.terms ?? null),
    validDays: branding?.validityDays ?? 30,
    showMark: showsOurMark({ tier, hideRequested: branding?.hideOurMark ?? false }),
    markText: MARK_TEXT,
    branding,
  };
}
