import 'server-only';

/**
 * Everything the customer told us, for a lead that came from us.
 *
 * ## Why this is the whole argument for the marketplace
 *
 * A studio can buy a CRM anywhere. What nothing else can give them is a lead
 * that arrives having already answered nine questions about their home, their
 * household, their budget, their taste and how involved they want to be —
 * before the studio has spent a rupee or a phone call finding out.
 *
 * The card carries the four facts that fit on a card. This carries the rest,
 * and it is deliberately the largest thing on the lead's page when it exists:
 * a studio reading it before the first call is the entire pitch working.
 *
 * ## Contact is checked again, here, at read time
 *
 * The card only exists because contact was released — `bridge.ts` refuses to
 * create one otherwise. But release is not permanent: a customer can withdraw
 * afterwards, and `withdrawIntroduction` redacts the card's name and phone.
 *
 * If this module read the brief without re-checking, a withdrawn customer's
 * household composition, budget and style preferences would stay on screen
 * beside a card reading "Withdrawn enquiry" — a redaction that redacts the
 * label and leaves the person. So `canSeeContact` is consulted on every read,
 * not assumed from the card's existence.
 *
 * `redactContact` is not used here because there is no name, phone or email
 * in what this returns — the identity is on the client row, which the caller
 * already has. This is only the brief.
 */

import { prisma } from '@/lib/prisma';
import { myStudioId } from '@/modules/studio-quote/store';
import { canSeeContact } from '@/modules/studio/introduction-access';
import {
  INVOLVEMENT_LABELS,
  PRIORITY_LABELS,
  STYLE_LABELS,
  propertyLabel,
  scopeLabel,
  localityLabel,
  type Involvement,
  type PriorityFactor,
  type StyleTag,
} from '@/modules/brief/types';
import { budgetPhrase, monthYear } from './bridge-facts';
import { paiseToLakhs, fromDb } from '@/lib/money';

export interface MarketplaceContext {
  introducedAt: Date;
  /** True once the customer has asked us to withdraw. Everything else is null. */
  withdrawn: boolean;
  withdrawnReason: string | null;

  property: string | null;
  where: string | null;
  carpetSqft: number | null;
  scope: string | null;
  tier: string | null;
  budget: string | null;
  moveInBy: string | null;
  possessionOn: string | null;

  /** Styles they picked, in the order the quiz stores them. */
  likes: string[];
  /**
   * Styles they ruled OUT. A hard filter in matching, and the single most
   * useful line on this panel — it is the one thing a studio would never
   * think to ask and would waste a first presentation discovering.
   */
  dislikes: string[];

  /** "2 adults, 1 child, a dog" — null when they skipped the question. */
  household: string | null;
  worksFromHome: boolean;
  involvement: string | null;
  /** Ranked, most important first. */
  priorities: string[];

  /** Meetings arranged through us, so the studio sees the same calendar. */
  appointments: { startsAt: Date; kind: string; status: string }[];
}

export async function marketplaceContextFor(
  clientId: string,
): Promise<MarketplaceContext | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;

  try {
    /* Scoped by studioId, like every read in this folder. A client id from a
       URL is not proof of ownership, and this returns null rather than
       throwing so the page simply renders without the panel. */
    const client = await prisma.studioClient.findFirst({
      where: { id: clientId, studioId, deletedAt: null },
      select: { introductionId: true },
    });
    if (!client?.introductionId) return null;

    const intro = await prisma.introduction.findUnique({
      where: { id: client.introductionId },
      select: {
        introducedAt: true,
        withdrawnAt: true,
        withdrawnReason: true,
        contactReleasedAt: true,
        appointments: {
          orderBy: { startsAt: 'asc' },
          select: { startsAt: true, kind: true, status: true },
        },
        brief: {
          select: {
            propertyType: true,
            carpetAreaSqft: true,
            locality: true,
            scope: true,
            tier: true,
            budgetMinPaise: true,
            budgetMaxPaise: true,
            moveInBy: true,
            possessionOn: true,
            styleLikes: true,
            styleDislikes: true,
            adults: true,
            children: true,
            elderly: true,
            pets: true,
            worksFromHome: true,
            involvement: true,
            priorityRanking: true,
          },
        },
      },
    });
    if (!intro) return null;

    /* The same two columns `canSeeContact` reads, in the same order, and for
       the same reason: a withdrawn introduction that was previously released
       must come back false. Returning the shell rather than null so the page
       can say the relationship ended instead of silently losing a panel that
       was there yesterday. */
    if (!canSeeContact(intro)) {
      return {
        introducedAt: intro.introducedAt,
        withdrawn: true,
        withdrawnReason: intro.withdrawnReason,
        property: null,
        where: null,
        carpetSqft: null,
        scope: null,
        tier: null,
        budget: null,
        moveInBy: null,
        possessionOn: null,
        likes: [],
        dislikes: [],
        household: null,
        worksFromHome: false,
        involvement: null,
        priorities: [],
        appointments: [],
      };
    }

    const b = intro.brief;

    return {
      introducedAt: intro.introducedAt,
      withdrawn: false,
      withdrawnReason: null,

      property: propertyLabel(b?.propertyType ?? null),
      where: localityLabel(b?.locality ?? null),
      carpetSqft: b?.carpetAreaSqft ?? null,
      scope: scopeLabel(b?.scope ?? null),
      tier: b?.tier ? tierWord(b.tier) : null,
      budget: budgetPhrase(lakhs(b?.budgetMinPaise), lakhs(b?.budgetMaxPaise)),
      moveInBy: monthYear(b?.moveInBy ?? null),
      possessionOn: monthYear(b?.possessionOn ?? null),

      /* Indexed through the label maps with a fallback, not directly. The
         style list is data the quiz writes and a tag retired later would
         otherwise render as `undefined` in a panel about somebody's taste. */
      likes: (b?.styleLikes ?? []).map((s) => STYLE_LABELS[s as StyleTag] ?? s),
      dislikes: (b?.styleDislikes ?? []).map((s) => STYLE_LABELS[s as StyleTag] ?? s),

      household: householdPhrase(b),
      worksFromHome: b?.worksFromHome ?? false,
      involvement: b?.involvement
        ? (INVOLVEMENT_LABELS[b.involvement as Involvement] ?? null)
        : null,
      priorities: (b?.priorityRanking ?? []).map(
        (p) => PRIORITY_LABELS[p as PriorityFactor] ?? p,
      ),

      appointments: intro.appointments.map((a) => ({
        startsAt: a.startsAt,
        kind: a.kind as string,
        status: a.status as string,
      })),
    };
  } catch (error) {
    console.error('[marketplace-context] read failed', error);
    return null;
  }
}

const TIER_WORD: Record<string, string> = {
  ESSENTIAL: 'Essential',
  PREMIUM: 'Premium',
  LUXURY: 'Luxury',
};

function tierWord(v: string): string | null {
  return TIER_WORD[v] ?? null;
}

function lakhs(paise: bigint | null | undefined): number | null {
  return paise === null || paise === undefined ? null : paiseToLakhs(fromDb(paise));
}

/**
 * "2 adults, 1 child and a dog."
 *
 * Written as a sentence rather than four counters, because who lives there is
 * a fact a designer holds in their head, not a field they look up. Zero
 * counts are omitted entirely — "0 elderly" is not information, and a panel
 * that lists absences teaches people to stop reading it.
 *
 * Null when they skipped the question, so the caller can leave the row out
 * rather than print "not specified".
 */
function householdPhrase(
  b: {
    adults: number | null;
    children: number | null;
    elderly: number | null;
    pets: boolean;
  } | null,
): string | null {
  if (!b) return null;

  const parts: string[] = [];
  if (b.adults) parts.push(`${b.adults} ${b.adults === 1 ? 'adult' : 'adults'}`);
  if (b.children) parts.push(`${b.children} ${b.children === 1 ? 'child' : 'children'}`);
  if (b.elderly) {
    parts.push(`${b.elderly} elderly ${b.elderly === 1 ? 'parent' : 'parents'}`);
  }

  if (parts.length === 0) return b.pets ? 'A pet at home' : null;

  /* Oxford-free: "2 adults, 1 child and a dog" reads as somebody speaking.
     The last separator is "and" rather than a comma. */
  const people =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]!}`;

  return b.pets ? `${people}, plus a pet` : people;
}
