import "server-only";

/**
 * The client's digital sign-off of a quotation (owner, 15 Oct 2026). The rules
 * are in signoff-rules.ts; this file reads and writes.
 *
 * - The studio (owner; PM and designer on the project, `signoff.request`)
 *   asks for the sales final (BOQ) or the design final to be signed: one
 *   frozen revision, hashed when asked. Optional, never forced; a request can
 *   be withdrawn while unsigned.
 * - The client reads it at /app/signoff/<id> (the website, and the phone app
 *   opens the same page inside the app), in the quotation's own format,
 *   ticks "I have read and agree", types their full name and submits
 *   (POST /api/app/v1/signoffs/:id). Recorded: who, when, IP and user agent,
 *   and the hash of exactly the revision they read, checked again.
 * - The signed copy is filed in the locker by itself (a record pointing at
 *   the signed page, `signoff:<id>`), visible to the studio and the client.
 * - A newer revision needs a new sign-off; the old signature stays on its
 *   revision.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromDb } from "@/lib/money";
import { getCurrentUser, hasRole } from "@/modules/auth/session";
import { notify, notifyStudio } from "@/modules/notify/service";
import { FILED_CONTENT_TYPE } from "@/modules/portal/documents";
import {
  signedBrandPageUrls,
  signedQuoteLogoUrl,
} from "@/modules/storage/studio-logo";
import { memberOnProject } from "@/modules/studio/access";
import {
  computeTotals,
  type QuoteTotals,
} from "@/modules/studio-quote/pricing";
import {
  docHead,
  type DocHead,
  type DocLineInput,
  type DocSpecRow,
  type DocStudio,
} from "@/modules/studio-quote/document";
import { readMaterialSpec } from "@/modules/studio-quote/store";
import { roomsOfLines } from "@/modules/studio-quote/rooms";
import {
  readRevisionLines,
  readRevisionTerms,
} from "@/modules/studio-sales/revision-rules";
import {
  readStages,
  type PaymentStage,
} from "@/modules/studio-sales/payment-template";
import { recordEvent, type ProjectActor } from "./events";
import { staffOn } from "./flow-access";
import {
  agreeTextOf,
  checkSignerName,
  isSignoffKind,
  requestRefusal,
  signedLine,
  signoffDocKey,
  signoffState,
  signRefusal,
  SIGNOFF_KIND_LABEL,
  SIGNOFF_KINDS,
  type SignoffKind,
  type SignoffState,
} from "./signoff-rules";
import { contentHash } from "./signoff-hash";
import { istDay } from "./working-days";
import { tickApprovalStep } from "@/modules/studio-design/step-settle";

export type SignoffResult =
  { ok: true; id?: string; message?: string } | { ok: false; error: string };

type Db = Prisma.TransactionClient | typeof prisma;

const REVISION_SELECT = {
  id: true,
  n: true,
  lines: true,
  terms: true,
  totalPaise: true,
  quoteId: true,
} as const;

/** The quotation a kind of sign-off is for on this project, and its revision to sign. */
async function targetOf(
  db: Db,
  studioId: string,
  kind: SignoffKind,
  p: { signedQuoteId: string | null; designFinalQuoteId: string | null },
) {
  if (!p.signedQuoteId) return null;
  const quote =
    kind !== "DESIGN_FINAL"
      ? await db.studioQuote.findFirst({
          where: { id: p.signedQuoteId, studioId },
          select: { id: true, number: true, salesFinalRevisionId: true },
        })
      : await db.studioQuote.findFirst({
          where: p.designFinalQuoteId
            ? { id: p.designFinalQuoteId, studioId }
            : { studioId, basedOnId: p.signedQuoteId, stage: "DESIGN" },
          orderBy: { createdAt: "desc" },
          select: { id: true, number: true, salesFinalRevisionId: true },
        });
  if (!quote) return null;
  const latest = await db.studioQuoteRevision.findFirst({
    where: { quoteId: quote.id, studioId },
    orderBy: { n: "desc" },
    select: REVISION_SELECT,
  });
  // The sales final (and its agreement) is the revision marked as such (the booking's); the design final is the newest one sent.
  const marked =
    kind !== "DESIGN_FINAL" && quote.salesFinalRevisionId
      ? await db.studioQuoteRevision.findFirst({
          where: { id: quote.salesFinalRevisionId, studioId },
          select: REVISION_SELECT,
        })
      : null;
  const revision = marked ?? latest;
  return { quote, revision, latestN: latest?.n ?? 0 };
}

/** The terms and conditions printed with the quotation: its own, else the studio's (as the PDF does). */
async function termsTextOf(
  db: Db,
  quoteId: string,
  studioId: string,
): Promise<string | null> {
  const [q, b] = await Promise.all([
    db.studioQuote.findFirst({
      where: { id: quoteId, studioId },
      select: { terms: true },
    }),
    db.studioBranding.findUnique({
      where: { studioId },
      select: { terms: true },
    }),
  ]);
  return q?.terms?.trim() ? q.terms : (b?.terms ?? null);
}

const hashOf = (
  quoteNumber: string,
  r: { n: number; lines: unknown; terms: unknown; totalPaise: bigint },
  termsText: string | null,
) =>
  contentHash({
    quoteNumber,
    n: r.n,
    lines: r.lines,
    terms: r.terms,
    totalPaise: fromDb(r.totalPaise),
    termsText,
  });

// ── The studio asks ───────────────────────────────────────────

export async function requestSignoff(
  projectId: string,
  rawKind: unknown,
  now = new Date(),
): Promise<SignoffResult> {
  if (!isSignoffKind(rawKind))
    return {
      ok: false,
      error:
        "Pick what the client signs: the sales final, the agreement or the design final.",
    };
  const kind = rawKind;
  const staff = await staffOn(projectId, "signoff.request");
  if (!staff.ok) return staff;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      signedQuoteId: true,
      designFinalQuoteId: true,
      cancelledAt: true,
    },
  });
  if (!p || p.cancelledAt)
    return { ok: false, error: "That project is not live." };
  const t = await targetOf(prisma, staff.studioId, kind, p);
  const revision = t?.revision ?? null;
  const existing = revision
    ? await prisma.homeQuoteSignoff.findMany({
        where: { projectId, kind, revisionId: revision.id },
        select: { signedAt: true, withdrawnAt: true },
      })
    : [];
  const termsText = t
    ? await termsTextOf(prisma, t.quote.id, staff.studioId)
    : null;
  const refusal = requestRefusal({
    hasRevision: Boolean(t && revision),
    kind,
    pendingSameRevision: existing.some((e) => !e.signedAt && !e.withdrawnAt),
    signedSameRevision: existing.some((e) => e.signedAt),
    hasTerms: Boolean(termsText?.trim()),
  });
  if (refusal || !t || !revision)
    return { ok: false, error: refusal ?? "Nothing to sign." };
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.homeQuoteSignoff.create({
      data: {
        projectId,
        kind,
        quoteId: t.quote.id,
        revisionId: revision.id,
        quoteNumber: t.quote.number,
        revisionN: revision.n,
        totalPaise: revision.totalPaise,
        contentHash: hashOf(
          t.quote.number,
          revision,
          await termsTextOf(tx, t.quote.id, staff.studioId),
        ),
        requestedById: staff.userId,
        requestedAt: now,
      },
      select: { id: true },
    });
    // The agreement filed at the start stays hidden until the studio asks for it to be signed (27 Oct 2026).
    if (kind === "AGREEMENT")
      await tx.homeDocument.updateMany({
        where: {
          projectId,
          kind: "AGREEMENT",
          sharedAt: null,
          deletedAt: null,
        },
        data: { sharedAt: now },
      });
    await recordEvent(tx, {
      projectId,
      type: "signoff.requested",
      actor: staff.actor,
      refId: r.id,
      at: now,
      payload: { kind, revision: revision.n },
    });
    return r;
  });
  if (staff.customerId)
    void notify(staff.customerId, {
      kind: "signoff-requested",
      studio: staff.studioName,
      what: `${SIGNOFF_KIND_LABEL[kind]} ${t.quote.number} R${revision.n}`,
    });
  return {
    ok: true,
    id: row.id,
    message:
      kind === "AGREEMENT"
        ? 'Sent. The client reads the agreement in the app and signs, or signs it on paper at the office (upload that as "Signed agreement (paper)").'
        : "Sent for signature. The client reads it in the app, ticks I agree and signs.",
  };
}

export async function withdrawSignoff(
  id: string,
  now = new Date(),
): Promise<SignoffResult> {
  const s = await prisma.homeQuoteSignoff.findUnique({
    where: { id: id.slice(0, 64) },
    select: { id: true, projectId: true },
  });
  if (!s) return { ok: false, error: "That request is gone." };
  const staff = await staffOn(s.projectId, "signoff.request");
  if (!staff.ok) return staff;
  const done = await prisma.$transaction(async (tx) => {
    const { count } = await tx.homeQuoteSignoff.updateMany({
      where: { id: s.id, signedAt: null, withdrawnAt: null },
      data: { withdrawnAt: now },
    });
    if (count === 0) return false;
    await recordEvent(tx, {
      projectId: s.projectId,
      type: "signoff.withdrawn",
      actor: staff.actor,
      refId: s.id,
      at: now,
    });
    return true;
  });
  return done
    ? { ok: true, id: s.id, message: "Withdrawn." }
    : { ok: false, error: "It is signed or withdrawn already." };
}

// ── The client signs ──────────────────────────────────────────

export async function signQuote(
  userId: string,
  id: string,
  input: { agreed: unknown; name: unknown; hash?: unknown },
  facts: { ip: string | null; userAgent: string | null },
  now = new Date(),
): Promise<SignoffResult & { signedLine?: string }> {
  const s = await prisma.homeQuoteSignoff.findUnique({
    where: { id: id.slice(0, 64) },
    select: {
      id: true,
      projectId: true,
      kind: true,
      quoteNumber: true,
      revisionN: true,
      contentHash: true,
      signedAt: true,
      withdrawnAt: true,
      requestedById: true,
      quoteId: true,
      revision: {
        select: {
          n: true,
          lines: true,
          terms: true,
          totalPaise: true,
          quote: {
            select: {
              revisions: {
                orderBy: { n: "desc" },
                take: 1,
                select: { n: true },
              },
            },
          },
        },
      },
      project: {
        select: {
          introduction: {
            select: { studioId: true, brief: { select: { userId: true } } },
          },
        },
      },
    },
  });
  if (!s) return { ok: false, error: "That is not on your project." };
  const owner = s.project.introduction.brief.userId === userId;
  if (!owner)
    return {
      ok: false,
      error: "Only the person who owns this project can sign it.",
    };
  const name = checkSignerName(input.name);
  const state = signoffState(
    s,
    s.revision.quote.revisions[0]?.n ?? s.revisionN,
  );
  const currentHash = hashOf(
    s.quoteNumber,
    s.revision,
    await termsTextOf(prisma, s.quoteId, s.project.introduction.studioId),
  );
  const refusal = signRefusal({
    state,
    owner,
    agreed: input.agreed,
    storedHash: s.contentHash,
    currentHash,
    shownHash: input.hash,
  });
  if (refusal) return { ok: false, error: refusal };
  if (!name.ok) return name;
  const actor: ProjectActor = { type: "CUSTOMER", id: userId };
  const kind = isSignoffKind(s.kind) ? s.kind : "DESIGN_FINAL";
  const done = await prisma.$transaction(async (tx) => {
    const { count } = await tx.homeQuoteSignoff.updateMany({
      where: { id: s.id, signedAt: null, withdrawnAt: null },
      data: {
        signedAt: now,
        signedById: userId,
        signerName: name.name,
        agreedText: agreeTextOf(kind),
        signedHash: s.contentHash,
        ip: facts.ip,
        userAgent: facts.userAgent,
      },
    });
    if (count === 0) return false;
    const title =
      `Signed: ${SIGNOFF_KIND_LABEL[kind]} ${s.quoteNumber} R${s.revisionN}`.slice(
        0,
        100,
      );
    const doc = await tx.homeDocument.create({
      data: {
        projectId: s.projectId,
        kind: kind === "AGREEMENT" ? "AGREEMENT" : "QUOTATION",
        title,
        storageKey: signoffDocKey(s.id),
        originalName: title,
        contentType: FILED_CONTENT_TYPE,
        bytes: 0,
        uploadedById: userId,
        byStudio: false,
        sharedAt: now,
      },
      select: { id: true },
    });
    await tx.homeQuoteSignoff.updateMany({
      where: { id: s.id },
      data: { lockerDocumentId: doc.id },
    });
    await recordEvent(tx, {
      projectId: s.projectId,
      type: "document.filed",
      actor,
      refId: doc.id,
      at: now,
      payload: { kind: "SIGNOFF", signoffId: s.id },
    });
    await recordEvent(tx, {
      projectId: s.projectId,
      type: "signoff.signed",
      actor,
      refId: s.id,
      at: now,
      payload: { kind, revision: s.revisionN },
    });
    // Signing the Design final is the client's final design approval (DESIGN-PROCESS-PLAN.md Decision 4).
    if (kind === "DESIGN_FINAL")
      await tickApprovalStep(tx, s.projectId, "DESIGN_FINAL", userId, now);
    return true;
  });
  if (!done) return { ok: false, error: "You have signed this already." };
  const event = {
    kind: "signoff-signed",
    projectId: s.projectId,
    what: `${SIGNOFF_KIND_LABEL[kind].toLowerCase()} ${s.quoteNumber} R${s.revisionN}`,
    name: name.name,
  } as const;
  void notifyStudio(s.project.introduction.studioId, event);
  void notify(s.requestedById, event, { email: false });
  return {
    ok: true,
    id: s.id,
    message: "Signed. A signed copy is in your Home locker.",
    signedLine: signedLine(name.name, now),
  };
}

// ── The document, for the signing page and the signed copy ────

export interface SignoffDocument {
  id: string;
  projectId: string;
  kind: SignoffKind;
  kindLabel: string;
  quoteNumber: string;
  revision: number;
  state: SignoffState;
  hash: string;
  /** What is shown no longer hashes to what was asked (the terms or the revision changed). */
  changedSince: boolean;
  /** The page is read by the owner of the brief, who may sign it now. */
  canSign: boolean;
  /** Who is reading: the customer (owner or family) or the studio. */
  viewer: "owner" | "family" | "studio";
  signed: {
    name: string;
    on: string;
    line: string;
    ip: string | null;
    userAgent: string | null;
  } | null;
  agreeText: string;
  doc: {
    studio: DocStudio | null;
    brandPages: string[];
    head: DocHead;
    lines: DocLineInput[];
    roomOrder: string[];
    totals: QuoteTotals;
    feeBps: number;
    discountBps: number;
    gstBps: number;
    onSpotLabel: string | null;
    schedule: PaymentStage[] | null;
    spec: DocSpecRow[];
    terms: string | null;
    welcomeNote: string | null;
  };
}

/**
 * The revision to read and sign, in the quotation's format, with the
 * signature when signed. For the owner of the brief and their family, a
 * studio member on the project who sees its money, and ops. Null otherwise.
 */
export async function signoffDocument(
  id: string,
): Promise<SignoffDocument | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const s = await prisma.homeQuoteSignoff.findUnique({
    where: { id: id.slice(0, 64) },
    select: {
      id: true,
      projectId: true,
      kind: true,
      quoteNumber: true,
      revisionN: true,
      contentHash: true,
      signedAt: true,
      withdrawnAt: true,
      signerName: true,
      ip: true,
      userAgent: true,
      quoteId: true,
      revision: {
        select: {
          n: true,
          lines: true,
          terms: true,
          totalPaise: true,
          quote: {
            select: {
              revisions: {
                orderBy: { n: "desc" },
                take: 1,
                select: { n: true },
              },
            },
          },
        },
      },
      project: {
        select: {
          introduction: {
            select: { studioId: true, brief: { select: { userId: true } } },
          },
          family: {
            where: { joinedAt: { not: null }, removedAt: null },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!s || !isSignoffKind(s.kind)) return null;
  const studioId = s.project.introduction.studioId;
  let viewer: SignoffDocument["viewer"];
  if (s.project.introduction.brief.userId === user.id) viewer = "owner";
  else if (s.project.family.some((f) => f.userId === user.id))
    viewer = "family";
  else if (hasRole(user, "OPS")) viewer = "studio";
  else {
    const check = await memberOnProject(s.projectId, "payment.read");
    if (!check.ok) return null;
    viewer = "studio";
  }
  const [quote, branding] = await Promise.all([
    prisma.studioQuote.findFirst({
      where: { id: s.quoteId, studioId },
      select: {
        clientName: true,
        clientPhone: true,
        society: true,
        locality: true,
        config: true,
        number: true,
        quoteDate: true,
        createdAt: true,
        welcomeNote: true,
        terms: true,
        salesFinalSchedule: true,
        studio: { select: { tradeName: true } },
      },
    }),
    prisma.studioBranding.findUnique({ where: { studioId } }),
  ]);
  if (!quote) return null;
  const [logoUrl, brandPages] = await Promise.all([
    signedQuoteLogoUrl(branding?.logoPath ?? null, studioId),
    signedBrandPageUrls(branding?.brandPages ?? [], studioId),
  ]);
  const lines = readRevisionLines(s.revision.lines);
  const terms = readRevisionTerms(s.revision.terms);
  const totals = computeTotals(
    lines.map((l) => ({
      unit: l.unit,
      code: l.code,
      ratePaise: l.ratePaise,
      widthMm: l.widthMm,
      heightMm: l.heightMm,
      qtyMilli: l.qtyMilli,
      amountPaise: l.amountPaise,
    })),
    {
      feeBps: terms.feeBps,
      discountBps: terms.discountBps,
      onSpotPaise: terms.onSpotPaise,
      bookingAdvancePaise: terms.bookingAdvancePaise,
      gstBps: terms.gstBps,
      phases: terms.phases,
    },
  );
  const state = signoffState(
    s,
    s.revision.quote.revisions[0]?.n ?? s.revisionN,
  );
  const termsText = quote.terms?.trim()
    ? quote.terms
    : (branding?.terms ?? null);
  /* What is on screen now, hashed: it must be what was asked (and, once signed, what was signed). */
  const hash = hashOf(s.quoteNumber, s.revision, termsText);
  const studio: DocStudio | null = branding
    ? {
        name: branding.legalName,
        tradeName: quote.studio.tradeName,
        addressLine: branding.addressLine,
        city: branding.city,
        pincode: branding.pincode,
        phone: branding.phone,
        email: branding.email,
        website: branding.website,
        gstin: branding.gstin,
        logoUrl,
        accentHex: branding.accentHex,
      }
    : null;
  return {
    id: s.id,
    projectId: s.projectId,
    kind: s.kind,
    kindLabel: SIGNOFF_KIND_LABEL[s.kind],
    quoteNumber: s.quoteNumber,
    revision: s.revisionN,
    state,
    hash,
    changedSince: hash !== s.contentHash,
    canSign:
      viewer === "owner" && state === "waiting" && hash === s.contentHash,
    viewer,
    signed:
      s.signedAt && s.signerName
        ? {
            name: s.signerName,
            on: istDay(s.signedAt),
            line: signedLine(s.signerName, s.signedAt),
            ip: viewer === "studio" ? s.ip : null,
            userAgent: viewer === "studio" ? s.userAgent : null,
          }
        : null,
    agreeText: agreeTextOf(s.kind),
    doc: {
      studio,
      brandPages,
      head: docHead(
        { ...quote, quoteDate: quote.quoteDate ?? quote.createdAt },
        branding?.city ?? null,
      ),
      lines: lines.map((l) => ({
        room: l.room,
        product: l.product,
        code: l.code,
        unit: l.unit,
        details: l.details,
        widthMm: l.widthMm,
        heightMm: l.heightMm,
        qtyMilli: l.qtyMilli,
        amountPaise: l.amountPaise,
      })),
      roomOrder: roomsOfLines(lines),
      totals,
      feeBps: terms.feeBps,
      discountBps: terms.discountBps,
      gstBps: terms.gstBps,
      onSpotLabel: terms.onSpotLabel,
      schedule:
        s.kind === "SALES_FINAL" ? readStages(quote.salesFinalSchedule) : null,
      spec: readMaterialSpec(branding?.materialSpec ?? null),
      terms: termsText,
      welcomeNote: quote.welcomeNote,
    },
  };
}

// ── What the studio reads ─────────────────────────────────────

export interface StudioSignoffTarget {
  kind: SignoffKind;
  label: string;
  quote: { id: string; number: string } | null;
  /** The revision a new request would ask for; 0 when nothing was sent. */
  revision: number;
  totalPaise: number | null;
  requests: {
    id: string;
    revision: number;
    state: SignoffState;
    requestedOn: string;
    signedOn: string | null;
    signerName: string | null;
    line: string | null;
    lockerDocumentId: string | null;
  }[];
  /** "Ask the client to sign" would be accepted now. */
  canAsk: boolean;
  /** Why not (shown under the button), or null. */
  why: string | null;
}

export interface StudioSignoffs {
  projectId: string;
  targets: StudioSignoffTarget[];
  canRequest: boolean;
}

/** The sign-offs card on the project: for those who see its money (`payment.read`). Null otherwise. */
export async function signoffsForStudio(
  projectId: string,
): Promise<StudioSignoffs | null> {
  const staff = await staffOn(projectId, "payment.read");
  if (!staff.ok) return null;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { signedQuoteId: true, designFinalQuoteId: true },
  });
  if (!p) return null;
  const rows = await prisma.homeQuoteSignoff.findMany({
    where: { projectId },
    orderBy: { requestedAt: "desc" },
    take: 40,
    select: {
      id: true,
      kind: true,
      quoteId: true,
      revisionN: true,
      requestedAt: true,
      signedAt: true,
      withdrawnAt: true,
      signerName: true,
      lockerDocumentId: true,
    },
  });
  const canRequest = staff.may("signoff.request");
  const targets: StudioSignoffTarget[] = [];
  for (const kind of SIGNOFF_KINDS) {
    const t = await targetOf(prisma, staff.studioId, kind, p);
    const hasTerms =
      kind === "AGREEMENT" && t
        ? Boolean(
            (await termsTextOf(prisma, t.quote.id, staff.studioId))?.trim(),
          )
        : true;
    const mine = rows.filter(
      (r) => r.kind === kind && (!t || r.quoteId === t.quote.id),
    );
    const latestN = t?.latestN ?? 0;
    const requests = mine
      .map((r) => ({
        id: r.id,
        revision: r.revisionN,
        state: signoffState(r, latestN),
        requestedOn: istDay(r.requestedAt),
        signedOn: r.signedAt ? istDay(r.signedAt) : null,
        signerName: r.signerName,
        line:
          r.signedAt && r.signerName
            ? signedLine(r.signerName, r.signedAt)
            : null,
        lockerDocumentId: r.lockerDocumentId,
      }))
      .filter((r) => r.state !== "withdrawn");
    const rev = t?.revision ?? null;
    const why = requestRefusal({
      hasRevision: Boolean(t && rev),
      kind,
      pendingSameRevision: rev
        ? mine.some(
            (r) => r.revisionN === rev.n && !r.signedAt && !r.withdrawnAt,
          )
        : false,
      signedSameRevision: rev
        ? mine.some((r) => r.revisionN === rev.n && r.signedAt)
        : false,
      hasTerms,
    });
    targets.push({
      kind,
      label: SIGNOFF_KIND_LABEL[kind],
      quote: t ? { id: t.quote.id, number: t.quote.number } : null,
      revision: rev?.n ?? 0,
      totalPaise: rev ? fromDb(rev.totalPaise) : null,
      requests,
      canAsk: canRequest && why === null,
      why,
    });
  }
  return { projectId, targets, canRequest };
}

/** "Signed by … on …" for a quotation's revisions, for the quotation's own screens. Scoped to the member's studio by the caller's quote id check. */
export async function signaturesOfQuote(
  quoteId: string,
  studioId: string,
): Promise<Map<number, string>> {
  const rows = await prisma.homeQuoteSignoff.findMany({
    where: { quoteId, signedAt: { not: null }, revision: { studioId } },
    select: { revisionN: true, signerName: true, signedAt: true },
  });
  return new Map(
    rows
      .filter((r) => r.signerName && r.signedAt)
      .map((r) => [r.revisionN, signedLine(r.signerName!, r.signedAt!)]),
  );
}
