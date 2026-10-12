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
import { fromDb, toDb, type Paise } from '@/lib/money';
import { starterRowsFor } from './starter-catalogue';
import { FEE_BPS, type QuoteUnitName, type WorkCodeName } from './pricing';
import { readRules, type ProductRules } from './configure';
import { Prisma } from '@prisma/client';

/**
 * The tenancy primitive, re-exported.
 *
 * It used to be implemented here, which put the function that decides whose
 * data you are looking at inside a quotation module — and left room for the
 * second, weaker copy that turned up in `studio/dashboard.ts`. One
 * implementation now, in `modules/studio/tenancy.ts`, re-exported here so the
 * twenty-odd files that import it from this path did not all have to change.
 */
import { myStudioId } from '@/modules/studio/tenancy';
import { quotingStudioId } from '@/modules/studio/lead-scope';

export { myStudioId };

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
  /** Build rules — flat size, balcony, per bathroom, default sq ft… (`configure.ts`). */
  rules: ProductRules | null;
}

/**
 * The studio's catalogue, seeding it on first read.
 *
 * ## The seed here is a migration path, not the provisioning
 *
 * New studios get their catalogue from `provisionWorkspace()` when they are
 * approved. This branch exists for every studio created before that function
 * did — without it they would open an empty product master with no way to
 * fill it.
 *
 * It costs one indexed count per read, which is the price of not stranding
 * them. Delete it once no studio predates provisioning. Idempotent:
 * `createMany` with `skipDuplicates` against the `(studioId, name)` unique
 * index, so a studio who deleted a line does not get it handed back.
 */
export async function myProducts(): Promise<ProductRow[]> {
  const studioId = await quotingStudioId();
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
  rules: unknown;
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
    rules: readRules(row.rules),
  };
}

/**
 * Build the branding row from what onboarding already established.
 *
 * Returns null when there is not enough to build one — a studio with no
 * registered name has not finished onboarding, and inventing a document
 * identity for them would put a blank at the top of a quotation.
 *
 * `create` rather than `upsert`, inside a catch: two page loads racing each
 * other both find no row and both try to write one, and the loser of that
 * race should return the winner's row rather than an error.
 */
async function seedBrandingFrom(studioId: string) {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: {
      legalName: true,
      tradeName: true,
      addressLine: true,
      city: true,
      pincode: true,
      gstin: true,
      website: true,
    },
  });

  const legalName = studio?.legalName?.trim() || studio?.tradeName?.trim();
  if (!studio || !legalName) return null;

  const data = {
    studioId,
    legalName,
    addressLine: studio.addressLine,
    /* The studio row stores a slug-ish city ("pune"); a document wants it
       written the way a person would. Only the first letter, because "Navi
       Mumbai" must not become "Navi mumbai". */
    city: studio.city
      ? studio.city.replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Pune',
    pincode: studio.pincode,
    gstin: studio.gstin,
    /* No phone on the studio row — the number a client rings is a contact
       choice, not a registration fact, so it stays a Settings field. */
    website: studio.website ?? null,
  };

  try {
    return await prisma.studioBranding.create({ data });
  } catch {
    /* Lost a race, or the row appeared between the read and the write. Either
       way the row that exists is the right one. */
    return prisma.studioBranding.findUnique({ where: { studioId } });
  }
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

export interface ProductEdit {
  name: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  rooms: string[];
  defaultWidthMm: number | null;
  defaultHeightMm: number | null;
  defaultQty: number | null;
  rules: ProductRules | null;
}

const UNITS: QuoteUnitName[] = ['AREA', 'SQFT', 'RFT', 'UNIT'];
const CODES: WorkCodeName[] = ['MODULAR', 'ONSITE'];

/**
 * Everything about a product but its rate and its standard tick, which have
 * their own quick controls: name, work code, unit, what it includes, rooms,
 * default sizes and build rules.
 *
 * Changing it never touches a quotation already made — lines are copies.
 */
export async function updateProduct(productId: string, input: ProductEdit): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const name = input.name.trim().slice(0, 120);
  if (name.length < 2) return { ok: false, error: 'Give it a name.' };
  if (!UNITS.includes(input.unit) || !CODES.includes(input.code)) return { ok: false, error: 'Pick how it is measured.' };
  const mm = (v: number | null) => (v == null ? null : Number.isInteger(v) && v > 0 && v < 100_000 ? v : NaN);
  const width = mm(input.defaultWidthMm);
  const height = mm(input.defaultHeightMm);
  const qty = input.defaultQty == null ? null : Number.isInteger(input.defaultQty) && input.defaultQty > 0 && input.defaultQty < 1000 ? input.defaultQty : NaN;
  if ([width, height, qty].some((v) => Number.isNaN(v))) return { ok: false, error: 'Sizes are whole millimetres; quantity a whole number.' };
  const rules = readRules(input.rules);

  try {
    const { count } = await prisma.studioProduct.updateMany({
      where: { id: productId, studioId },
      data: {
        name,
        code: input.code,
        unit: input.unit,
        details: input.details?.trim().slice(0, 1000) || null,
        rooms: input.rooms.map((r) => String(r).slice(0, 40)).slice(0, 8),
        defaultWidthMm: width,
        defaultHeightMm: height,
        defaultQty: qty,
        rules: rules ? (rules as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
    if (count === 0) return { ok: false, error: 'That product is not yours.' };
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { ok: false, error: 'You already have a product with that name.' };
    }
    console.error('[studio-quote] updateProduct failed', error);
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
  gstBps: number;
  /** The material specification printed on every quotation. */
  materialSpec: MaterialSpecRow[];
  /** Days a quotation holds its prices. */
  validityDays: number;
}

export interface MaterialSpecRow {
  item: string;
  spec: string;
}

/** A stored spec, keeping only well-formed rows. */
export function readMaterialSpec(raw: unknown): MaterialSpecRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const item = typeof o.item === 'string' ? o.item.trim().slice(0, 60) : '';
    const spec = typeof o.spec === 'string' ? o.spec.trim().slice(0, 200) : '';
    return item && spec ? [{ item, spec }] : [];
  }).slice(0, 40);
}

/**
 * "Plywood: Century BWP 710, 18 mm" per line → rows. How a studio writes its
 * spec sheet; a line without a colon is skipped rather than guessed at.
 */
export function parseMaterialSpec(text: string): MaterialSpecRow[] {
  return readMaterialSpec(
    text
      .split(/\r?\n/)
      .map((line) => {
        const at = line.indexOf(':');
        return at > 0 ? { item: line.slice(0, at), spec: line.slice(at + 1) } : null;
      })
      .filter(Boolean),
  );
}

/**
 * The studio's identity on its own documents.
 *
 * Returns null when they have not set it up, rather than inventing defaults —
 * a quotation cannot go out under a name nobody has confirmed, and the
 * quotation screens use this null to send them to Settings first.
 */
/**
 * The studio's document identity, seeded from onboarding on first read.
 *
 * ## Why this is not a form the studio fills in
 *
 * It used to be. Settings opened with "Who the quotation comes from" and
 * asked for a registered name, an address, a city, a PIN and a GSTIN — every
 * one of which the studio had already typed during onboarding, because the
 * registration step is where we ask for exactly those facts and then go and
 * check them against the public registries.
 *
 * Asking twice is worse than it sounds. The two copies drift, and when they
 * do, the address we verified and the address printed on a client's quotation
 * are different addresses — with no way to tell which is which afterwards. It
 * also meant a studio who had finished onboarding could not raise a
 * quotation: `createQuote` refuses without a branding row, and the branding
 * row only existed once somebody had filled in a form nothing had pointed
 * them at.
 *
 * So the identity comes from the `Studio` row, copied once, here. What
 * Settings keeps is what onboarding genuinely does not ask about: the logo,
 * the accent, the opening note, the terms, the fee, the discount, the advance
 * and our mark.
 *
 * ## Copied rather than joined
 *
 * A quotation is a document, and the name on a document is a fact about the
 * day it was sent. Reading the studio row live would mean a studio correcting
 * their registered name in 2027 silently rewriting what a client received in
 * 2026. The copy is the record.
 */
export async function myBranding(): Promise<BrandingRow | null> {
  const studioId = await quotingStudioId();
  if (!studioId) return null;

  try {
    const row = (await prisma.studioBranding.findUnique({ where: { studioId } })) ??
      (await seedBrandingFrom(studioId));
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
      gstBps: row.gstBps,
      materialSpec: readMaterialSpec(row.materialSpec),
      validityDays: row.validityDays,
    };
  } catch (error) {
    console.error('[studio-quote] myBranding failed', error);
    return null;
  }
}

/**
 * What Settings may change.
 *
 * The registered name, address and GSTIN are absent on purpose — they come
 * from the registration step. See `saveBranding`.
 */
export interface BrandingInput {
  phone?: string;
  email?: string;
  website?: string;
  welcomeNote?: string;
  terms?: string;
  feeBps: number;
  discountBps: number;
  bookingAdvancePaise: Paise;
  /** 0 or 1800. Absent leaves it as it is. */
  gstBps?: number;
  /** Absent leaves them as they are. */
  materialSpec?: MaterialSpecRow[];
  validityDays?: number;
}

/**
 * Save the document settings.
 *
 * ## What this deliberately cannot change
 *
 * The registered name, the address and the GSTIN. Those come from the
 * registration step and are checked against the public registries; editing
 * them here would mean the address we verified and the address on a client's
 * quotation could differ, with nothing to say which is which. `myBranding`
 * seeds them, `seedBrandingFrom` explains it, and the Settings page shows
 * them as facts with a link to where they are actually changed.
 *
 * So this writes only what a studio genuinely decides about their document:
 * how a client reaches them, their words, and their commercial terms.
 */
export async function saveBranding(input: BrandingInput): Promise<SaveResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  // Basis points, so a percentage is always an integer. 10000 bps is 100%, and
  // a fee above that is a typo rather than a pricing strategy.
  if (!Number.isInteger(input.feeBps) || input.feeBps < 0 || input.feeBps > 5000) {
    return { ok: false, error: 'A professional fee between 0% and 50%, please.' };
  }
  if (!Number.isInteger(input.discountBps) || input.discountBps < 0 || input.discountBps > 5000) {
    return { ok: false, error: 'A discount between 0% and 50%, please.' };
  }

  const data = {
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    website: input.website?.trim() || null,
    welcomeNote: input.welcomeNote?.trim() || null,
    terms: input.terms?.trim() || null,
    // 7% for every studio (owner, 12 Oct 2026); the setting no longer moves it.
    feeBps: FEE_BPS,
    discountBps: input.discountBps,
    bookingAdvancePaise: toDb(Math.max(0, input.bookingAdvancePaise)),
    ...(input.gstBps !== undefined ? { gstBps: input.gstBps > 0 ? 1800 : 0 } : {}),
    ...(input.materialSpec !== undefined
      ? { materialSpec: input.materialSpec.length > 0 ? (input.materialSpec as unknown as Prisma.InputJsonValue) : Prisma.DbNull }
      : {}),
    ...(input.validityDays !== undefined
      ? { validityDays: Math.min(365, Math.max(1, Math.round(input.validityDays) || 30)) }
      : {}),
  };

  try {
    /* Seeded first, so there is a row to update. A studio can reach Settings
       before anything has read `myBranding()` — from a bookmark, or straight
       after signing in — and an upsert here would have to invent a legal name
       to satisfy the create branch. */
    const existing =
      (await prisma.studioBranding.findUnique({ where: { studioId }, select: { studioId: true } })) ??
      (await seedBrandingFrom(studioId));

    if (!existing) {
      return {
        ok: false,
        error:
          'Finish your registration first — a quotation has to carry the name we checked you against.',
      };
    }

    await prisma.studioBranding.update({ where: { studioId }, data });
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
  const studioId = await quotingStudioId();
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

// ── The studio, for the cover and About pages of a quotation ─────

export interface StudioProfile {
  tradeName: string;
  about: string | null;
  yearsActive: number | null;
  teamSize: number | null;
  localities: string[];
  /** Up to four photographs of finished work, first image of each project. */
  photos: { url: string; caption: string; isRender: boolean }[];
}

/** What a client reads about the studio before the figures. Null when there is no studio. */
export async function myStudioProfile(): Promise<StudioProfile | null> {
  const studioId = await quotingStudioId();
  if (!studioId) return null;
  try {
    const studio = await prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        tradeName: true,
        about: true,
        yearsActive: true,
        teamSize: true,
        localities: true,
        portfolio: {
          where: { images: { isEmpty: false } },
          orderBy: [{ completedOn: 'desc' }, { createdAt: 'desc' }],
          take: 4,
          select: { title: true, locality: true, images: true, isRender: true },
        },
      },
    });
    if (!studio) return null;
    return {
      tradeName: studio.tradeName,
      about: studio.about?.trim() || null,
      yearsActive: studio.yearsActive,
      teamSize: studio.teamSize,
      localities: studio.localities,
      photos: studio.portfolio
        .filter((p) => /^https:\/\//.test(p.images[0] ?? ''))
        .map((p) => ({ url: p.images[0]!, caption: [p.title, p.locality].filter(Boolean).join(', '), isRender: p.isRender })),
    };
  } catch (error) {
    console.error('[studio-quote] myStudioProfile failed', error);
    return null;
  }
}
