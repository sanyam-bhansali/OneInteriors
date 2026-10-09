import 'server-only';

/**
 * The final quote for a client One Interiors introduced (v79 "Choose & sign").
 *
 * After measuring the flat, the studio prices it in its own builder like any
 * other quotation. The difference is the link: the quotation carries the
 * introduction, so once it is issued the customer sees it in the app, with
 * what changed against their first quote, and can sign it there.
 *
 * One final quote per introduction. Asking again opens the one that exists,
 * so a studio cannot end up with two versions the customer might confuse.
 */

import { prisma } from '@/lib/prisma';
import { myStudioId } from '@/modules/studio/tenancy';
import { isConfigName } from './configure';
import { applyConfiguration, createQuote, type QuoteResult } from './quotes';

export async function finalQuoteForClient(clientId: string): Promise<QuoteResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const client = await prisma.studioClient.findFirst({
    where: { id: clientId, studioId },
    select: { id: true, name: true, phone: true, society: true, config: true, carpetSqft: true, introductionId: true, briefId: true },
  });
  if (!client) return { ok: false, error: 'That client is not yours.' };
  if (!client.introductionId) {
    return { ok: false, error: 'A final quote in the app is only for clients One Interiors introduced.' };
  }

  const existing = await prisma.studioQuote.findFirst({
    where: { studioId, introductionId: client.introductionId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (existing) return { ok: true, id: existing.id };

  const created = await createQuote({
    clientName: client.name,
    clientPhone: client.phone ?? undefined,
    society: client.society ?? undefined,
    config: client.config ?? undefined,
    carpetSqft: client.carpetSqft ?? undefined,
    link: { clientId: client.id, introductionId: client.introductionId, briefId: client.briefId },
  });
  if (!created.ok) return created;

  // Start from their standard build for this size of flat, as any new quotation does.
  if (isConfigName(client.config)) {
    await applyConfiguration({
      quoteId: created.id,
      home: { config: client.config, kitchenRunMm: null, bathrooms: client.config === '1 BHK' ? 1 : 2, study: false },
    });
  }
  return created;
}
