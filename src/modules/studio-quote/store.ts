import 'server-only';

/**
 * Reading and writing a studio's own quotations, products and branding.
 *
 * ## The one rule in this file
 *
 * **Every query is scoped by `studioId`, and the id comes from the session —
 * never from an argument a page passed in.** These tables hold a studio's
 * entire price list and its clients' names and phone numbers, sitting in the
 * same tables as every other studio's. This is the first place in the product
 * where forgetting a `where` clause leaks one business's operating detail to a
 * competitor, so `myStudioId()` is the only way in and nothing here takes a
 * studio id as a parameter.
 *
 * The pure half — all of the money — is in `pricing.ts`, which has no
 * `server-only` so the tests can reach it. CONTRIBUTING §9.5.
 */

import { prisma } from '@/lib/prisma';
import { storeLogo, removeLogo } from '@/modules/storage/studio-logo';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { fromDb, toDb, type Paise } from '@/lib/money';
import { starterRowsFor } from './starter-catalogue';
import type { QuoteUnitName, WorkCodeName } from './pricing';

/**
 * The signed-in user's studio id, or null.
 *
 * `getCurrentUser` and not `requireRole`, for the reason written out three
 * times elsewhere: `requireRole` throws, these are render-path reads, and Next
 * renders a layout and its page in parallel — so the throw beats the layout's
 * redirect and produces a 500 where a redirect belongs.
 */
export async function myStudioId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, 'STUDIO') || !hasDatabase()) return null;

  try {
    const member = await prisma.studioMember.findUnique({
      where: { userId: user.id },
      select: { studioId: true },
    });
    return member?.studioId ?? null;
  } catch {
    return null;
  }
}

// ── Product master ─────────────────────────────────────────────

export interface ProductRow {
  id: string;
  name: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  ratePaise: Paise;
  rooms: string[];
  defaultWidthMm: number | null;
  defaultHeightMm: number | null;
  defaultQty: number | null;
  sortOrder: number;
  isActive: boolean;
  /** Does this go on the quotation when a configuration is applied? */
  inStandardBuild: boolean;
}

/**
 * The studio's catalogue, seeding it on first read.
 *
 * Seeding here rather than at approval time because approval happens on the
 * ops side and a studio approved last month would otherwise have no catalogue
 * at all. Idempotent: `createMany` with `skipDuplicates` against the
 * `(studioId, name)` unique index, so a studio that deleted a line does not get
 * it handed back on the next page load.
 */
export async function myProducts(): Promise<ProductRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const count = await prisma.studioProduct.count({ where: { studioId } });
    if (count === 0) {
      await prisma.studioProduct.createMany({
        data: starterRowsFor(studioId),
        skipDuplicates: true,
      });
    }

    const rows = await prisma.studioProduct.findMany({
      where: { studioId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map(toProductRow);
  } catch (error) {
    console.error('[studio-quote] myProducts failed', error);
    return [];
  }
}

function toProductRow(row: {
  id: string;
  name: string;
  code: string;
  unit: string;
  details: string | null;
  ratePaise: bigint;
  rooms: string[];
  defaultWidthMm: number | null;
  defaultHeightMm: number | null;
  defaultQty: number | null;
  sortOrder: number;
  isActive: boolean;
  inStandardBuild: boolean;
}): ProductRow {
  return {
    id: row.id,
    name: row.name,
    code: row.code as WorkCodeName,
    unit: row.unit as QuoteUnitName,
    details: row.details,
    // BigInt cannot cross the server/client boundary. Converted here, at the
    // Prisma edge, exactly as `money.ts` requires.
    ratePaise: fromDb(row.ratePaise),
    rooms: row.rooms,
    defaultWidthMm: row.defaultWidthMm,
    defaultHeightMm: row.defaultHeightMm,
    defaultQty: row.defaultQty,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    inStandardBuild: row.inStandardBuild,
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Set one product's rate. The only field a studio changes often. */
export async function setProductRate(productId: string, ratePaise: Paise): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  if (!Number.isInteger(ratePaise) || ratePaise < 0) {
    return { ok: false, error: 'That rate does not look right.' };
  }

  try {
    // Scoped by studioId as well as id: a product id from a form is not proof
    // of ownership, and `updateMany` simply matches nothing when it is not
    // theirs rather than updating a competitor's price list.
    const { count } = await prisma.studioProduct.updateMany({
      where: { id: productId, studioId },
      data: { ratePaise: toDb(ratePaise) },
    });
    if (count === 0) return { ok: false, error: 'That product is not yours.' };
    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] setProductRate failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * Is this part of what the studio fits as standard?
 *
 * Separate from `isActive`, and the difference is load-bearing. Active means
 * "I sell this"; standard means "I put it on nearly every job". A walk-in
 * wardrobe is firmly the first and firmly not the second, and collapsing them
 * would either drop it from the catalogue or put one in every bedroom of every
 * flat.
 */
export async function setProductStandard(
  productId: string,
  inStandardBuild: boolean,
): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  try {
    const { count } = await prisma.studioProduct.updateMany({
      where: { id: productId, studioId },
      data: { inStandardBuild },
    });
    if (count === 0) return { ok: false, error: 'That product is not yours.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

export async function setProductActive(productId: string, isActive: boolean): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  try {
    const { count } = await prisma.studioProduct.updateMany({
      where: { id: productId, studioId },
      data: { isActive },
    });
    if (count === 0) return { ok: false, error: 'That product is not yours.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

export interface NewProductInput {
  name: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  ratePaise: Paise;
  rooms: string[];
  details?: string;
}

export async function addProduct(input: NewProductInput): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'Give it a name.' };
  if (!Number.isInteger(input.ratePaise) || input.ratePaise < 0) {
    return { ok: false, error: 'That rate does not look right.' };
  }

  try {
    await prisma.studioProduct.create({
      data: {
        studioId,
        name,
        code: input.code,
        unit: input.unit,
        ratePaise: toDb(input.ratePaise),
        rooms: input.rooms,
        details: input.details?.trim() || null,
        // Below the shipped catalogue, which stops at 630, so anything a studio
        // adds lands at the end rather than in the middle of somebody else's
        // ordering.
        sortOrder: 900,
      },
    });
    return { ok: true };
  } catch (error) {
    // The unique index on (studioId, name) is the likely failure, and it is a
    // sentence rather than a stack trace.
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { ok: false, error: 'You already have a product with that name.' };
    }
    console.error('[studio-quote] addProduct failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

// ── Branding ───────────────────────────────────────────────────

export interface BrandingRow {
  legalName: string;
  addressLine: string | null;
  city: string;
  pincode: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoPath: string | null;
  accentHex: string;
  /** Their wish about our mark. Whether it is honoured is `showsOurMark()`. */
  hideOurMark: boolean;
  welcomeNote: string | null;
  terms: string | null;
  feeBps: number;
  discountBps: number;
  bookingAdvancePaise: Paise;
}

/**
 * The studio's identity on its own documents.
 *
 * Returns null when they have not set it up, rather than inventing defaults —
 * a quotation cannot go out under a name nobody has confirmed, and the
 * quotation screens use this null to send them to Settings first.
 */
export async function myBranding(): Promise<BrandingRow | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;

  try {
    const row = await prisma.studioBranding.findUnique({ where: { studioId } });
    if (!row) return null;

    return {
      legalName: row.legalName,
      addressLine: row.addressLine,
      city: row.city,
      pincode: row.pincode,
      gstin: row.gstin,
      phone: row.phone,
      email: row.email,
      website: row.website,
      logoPath: row.logoPath,
      hideOurMark: row.hideOurMark,
      accentHex: row.accentHex,
      welcomeNote: row.welcomeNote,
      terms: row.terms,
      feeBps: row.feeBps,
      discountBps: row.discountBps,
      bookingAdvancePaise: fromDb(row.bookingAdvancePaise),
    };
  } catch (error) {
    console.error('[studio-quote] myBranding failed', error);
    return null;
  }
}

export interface BrandingInput {
  legalName: string;
  addressLine?: string;
  city?: string;
  pincode?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  website?: string;
  welcomeNote?: string;
  terms?: string;
  feeBps: number;
  discountBps: number;
  bookingAdvancePaise: Paise;
}

export async function saveBranding(input: BrandingInput): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const legalName = input.legalName.trim();
  if (legalName.length < 2) {
    return { ok: false, error: 'Your registered name goes at the top of every quotation.' };
  }

  // Basis points, so a percentage is always an integer. 10000 bps is 100%, and
  // a fee above that is a typo rather than a pricing strategy.
  if (!Number.isInteger(input.feeBps) || input.feeBps < 0 || input.feeBps > 5000) {
    return { ok: false, error: 'A professional fee between 0% and 50%, please.' };
  }
  if (!Number.isInteger(input.discountBps) || input.discountBps < 0 || input.discountBps > 5000) {
    return { ok: false, error: 'A discount between 0% and 50%, please.' };
  }

  const data = {
    legalName,
    addressLine: input.addressLine?.trim() || null,
    city: input.city?.trim() || 'Pune',
    pincode: input.pincode?.trim() || null,
    gstin: input.gstin?.trim().toUpperCase() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    website: input.website?.trim() || null,
    welcomeNote: input.welcomeNote?.trim() || null,
    terms: input.terms?.trim() || null,
    feeBps: input.feeBps,
    discountBps: input.discountBps,
    bookingAdvancePaise: toDb(Math.max(0, input.bookingAdvancePaise)),
  };

  try {
    await prisma.studioBranding.upsert({
      where: { studioId },
      create: { studioId, ...data },
      update: data,
    });
    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] saveBranding failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}


// ── Logo and the attribution mark ──────────────────────────────

/**
 * Replace the studio's logo.
 *
 * Store first, update the row, remove the old object last. That order is the
 * whole of the care here: removing first means a failed upload leaves a
 * branding row pointing at a file that is gone, and every document they print
 * until somebody notices has a broken image where their name should be.
 */
export async function replaceLogo(file: File): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const existing = await prisma.studioBranding.findUnique({
    where: { studioId },
    select: { logoPath: true },
  });
  if (!existing) {
    return { ok: false, error: 'Fill in your studio details first — the logo goes with them.' };
  }

  const stored = await storeLogo(studioId, file);
  if (!stored.ok) return { ok: false, error: stored.error };

  await prisma.studioBranding.update({
    where: { studioId },
    data: { logoPath: stored.path },
  });

  await removeLogo(existing.logoPath);
  return { ok: true };
}

export async function clearLogo(): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const existing = await prisma.studioBranding.findUnique({
    where: { studioId },
    select: { logoPath: true },
  });
  if (!existing?.logoPath) return { ok: true };

  await prisma.studioBranding.update({ where: { studioId }, data: { logoPath: null } });
  await removeLogo(existing.logoPath);
  return { ok: true };
}

/**
 * Record what the studio wants about our mark.
 *
 * Stored whatever their tier is, and deliberately so — see the column comment
 * and `showsOurMark()`. Saving the wish for a studio who cannot yet act on it
 * is what makes an upgrade take effect without anybody revisiting this screen.
 */
export async function setHideOurMark(hide: boolean): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  await prisma.studioBranding.update({
    where: { studioId },
    data: { hideOurMark: hide },
  });
  return { ok: true };
}

/**
 * The tier this studio is on, for the mark and for anything else that gates.
 *
 * Null when they have no subscription row at all, which `tierMayRemoveMark`
 * treats as unentitled — the safe direction.
 */
export async function myTier(): Promise<string | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;
  const sub = await prisma.subscription.findUnique({
    where: { studioId },
    select: { tier: true, status: true },
  });
  if (!sub) return null;
  /* A cancelled subscription is not a tier. Reading `tier` alone would leave
     a studio white-labelled for as long as the row survived their leaving. */
  return sub.status === 'CANCELLED' ? null : sub.tier;
}
