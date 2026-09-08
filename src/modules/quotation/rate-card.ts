import 'server-only';

/**
 * A studio's rate card.
 *
 * **Private, and never seeded.** No studio's card is ever pre-filled — not
 * from Hauspire's catalogue, not from a market average, not from another
 * studio. An empty card produces no quote rather than a borrowed one. This is
 * the operational half of the promise in `price.ts`; that file refuses to
 * invent a rate, and this one refuses to supply a default it could invent from.
 *
 * Rates are private to the studio. Aggregate benchmarking across studios is
 * legitimate and valuable, but only anonymised and only once enough cards
 * exist that no single one is identifiable — that is deliberately not built
 * yet, because with two studios on the roster "the median of two" is just
 * telling each of them the other's price.
 */

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { currentStudio } from '@/modules/studio/onboarding';
import { rupeesToPaise, fromDb, type Paise } from '@/lib/money';
import { CATEGORY, RATE_CATEGORIES, type RateCategory } from './categories';
import type { RateCard } from './price';

export type SaveResult = { ok: true } | { ok: false; errors: Record<string, string> };

/** Read one studio's card. Used by the quote engine, so it takes an id. */
export async function rateCardFor(studioId: string): Promise<RateCard> {
  const items = await prisma.rateCardItem.findMany({ where: { studioId } });

  const card: RateCard = {};
  for (const item of items) {
    if ((RATE_CATEGORIES as readonly string[]).includes(item.category)) {
      card[item.category as RateCategory] = fromDb(item.ratePaise);
    }
  }
  return card;
}

/** The signed-in studio's own card, for the editor. */
export async function myRateCard(): Promise<RateCard> {
  const context = await currentStudio();
  if (!context) return {};
  return rateCardFor(context.studio.id);
}

export interface RateInput {
  category: RateCategory;
  /**
   * Rupees for money categories; basis points are NOT accepted here — the
   * design fee arrives as a percentage and is converted once, below, so a
   * studio typing "5" always means 5%.
   */
  value: number;
}

export async function saveRateCard(inputs: RateInput[]): Promise<SaveResult> {
  const user = await requireRole('STUDIO');
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  const errors: Record<string, string> = {};

  for (const input of inputs) {
    if (!(RATE_CATEGORIES as readonly string[]).includes(input.category)) continue;
    if (input.value < 0) errors[input.category] = 'A rate cannot be negative.';
    if (CATEGORY[input.category].unit === 'percent' && input.value > 30) {
      errors[input.category] = 'A design fee over 30% is almost certainly a typo.';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  await prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      if (!(RATE_CATEGORIES as readonly string[]).includes(input.category)) continue;

      const definition = CATEGORY[input.category];
      // Percent is stored as basis points so it stays an integer — the same
      // reason money is paise. 5% becomes 500, and 5.25% becomes 525.
      const stored: Paise =
        definition.unit === 'percent'
          ? Math.round(input.value * 100)
          : rupeesToPaise(input.value);

      if (stored <= 0) {
        // Clearing a rate removes it, so "no rate" and "zero rate" cannot
        // drift apart — the quote engine treats both as unquotable anyway.
        await tx.rateCardItem.deleteMany({
          where: { studioId: context.studio.id, category: input.category },
        });
        continue;
      }

      const existing = await tx.rateCardItem.findFirst({
        where: { studioId: context.studio.id, category: input.category },
      });

      if (existing) {
        await tx.rateCardItem.update({
          where: { id: existing.id },
          data: { ratePaise: BigInt(stored), label: definition.label, unit: definition.unit },
        });
      } else {
        await tx.rateCardItem.create({
          data: {
            studioId: context.studio.id,
            category: input.category,
            label: definition.label,
            unit: definition.unit,
            ratePaise: BigInt(stored),
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'ratecard.update',
        entityType: 'Studio',
        entityId: context.studio.id,
        // The categories touched, never the rates — an audit log readable by
        // ops must not become a back door onto private pricing.
        after: { categories: inputs.map((i) => i.category) },
      },
    });
  });

  return { ok: true };
}
