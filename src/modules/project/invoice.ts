import 'server-only';

/**
 * Invoices per payment stage, and the studio's side of the statement (owner,
 * 21 Nov 2026: one TAX INVOICE per payment stage, from the approved sample).
 * The figures are the payment ledger's (payments-flow.ts `ledgerOf`), the
 * same as the Payments tab; only the invoice number is stored
 * (`StudioInvoice`). Rules in invoice-rules.ts.
 *
 * Who opens one: whoever may read the project's payments (`payment.read`,
 * the same as the statement): the owner, accounts, the designer and PM on it.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { signedQuoteLogoUrl, signedSignUrls } from '@/modules/storage/studio-logo';
import { readStages, templateOrDefault } from '@/modules/studio-sales/payment-template';
import { siteLabel } from '@/modules/studio/team-rules';
import { recordEvent, type ProjectActor } from './events';
import { staffOn } from './flow-access';
import { MODE_LABEL, type PaymentModeName } from './payment-ledger';
import { ledgerOf } from './payments-flow';
import { gstSplit } from './project-gst';
import { DEFAULT_SAC, deliverableFor, indianFyStart, invoiceFigures, invoiceNumber, prefixFromLegalName, receivedOn, stateOf, type InvoiceFigures } from './invoice-rules';

// ── The studio on its documents ───────────────────────────────

export interface DocIssuer {
  legalName: string;
  /** "Office 4, Baner Road, Pune 411045"; null when not filled. */
  address: string | null;
  gstin: string | null;
  /** "Maharashtra (27)". */
  state: string;
  /** "accounts@studio.in · +91 98…"; null when neither is filled. */
  contact: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
  signatoryName: string | null;
  signatoryDesignation: string | null;
  /** Printed only when the account number is filled. */
  bank: { accountName: string | null; accountNumber: string; ifsc: string | null; bankName: string | null } | null;
  sac: string;
  prefix: string;
}

const BRANDING_SELECT = {
  legalName: true,
  addressLine: true,
  city: true,
  pincode: true,
  gstin: true,
  phone: true,
  email: true,
  logoPath: true,
  agreementSignatory: true,
  agreementSignatoryRole: true,
  signatoryName: true,
  signatoryDesignation: true,
  signaturePath: true,
  stampPath: true,
  invoicePrefix: true,
  sacCode: true,
  bankAccountName: true,
  bankAccountNumber: true,
  bankIfsc: true,
  bankName: true,
} as const;

/**
 * The studio's details for its invoices and statement: Settings → Your
 * details (legal name, address, GSTIN, logo) and Settings → Invoices (who
 * signs, the signature and stamp, prefix, SAC, bank). The images are signed
 * for five minutes, for this studio's own folder only.
 */
export async function issuerFor(studioId: string): Promise<DocIssuer> {
  const studio = await prisma.studio.findUnique({ where: { id: studioId }, select: { legalName: true, tradeName: true, branding: { select: BRANDING_SELECT } } });
  const b = studio?.branding ?? null;
  const legalName = b?.legalName?.trim() || studio?.legalName?.trim() || studio?.tradeName || 'Studio';
  const [logoUrl, [signatureUrl, stampUrl]] = await Promise.all([signedQuoteLogoUrl(b?.logoPath ?? null, studioId), signedSignUrls([b?.signaturePath ?? null, b?.stampPath ?? null], studioId)]);
  const place = [b?.city, b?.pincode].filter(Boolean).join(' ');
  const address = [b?.addressLine?.trim(), place].filter(Boolean).join(', ') || null;
  const contact = [b?.email?.trim(), b?.phone?.trim()].filter(Boolean).join(' · ') || null;
  /* The agreement's signatory (Settings → Client agreement) when the invoice one is not filled. */
  const signatoryName = b?.signatoryName?.trim() || b?.agreementSignatory?.trim() || null;
  const signatoryDesignation = b?.signatoryDesignation?.trim() || (b?.signatoryName ? null : b?.agreementSignatoryRole?.trim()) || null;
  return {
    legalName,
    address,
    gstin: b?.gstin?.trim() || null,
    state: stateOf(b?.gstin),
    contact,
    logoUrl,
    signatureUrl: signatureUrl ?? null,
    stampUrl: stampUrl ?? null,
    signatoryName,
    signatoryDesignation,
    bank: b?.bankAccountNumber ? { accountName: b.bankAccountName, accountNumber: b.bankAccountNumber, ifsc: b.bankIfsc, bankName: b.bankName } : null,
    sac: b?.sacCode?.trim() || DEFAULT_SAC,
    prefix: b?.invoicePrefix?.trim() || prefixFromLegalName(legalName),
  };
}

// ── The invoice number ────────────────────────────────────────

const isUniqueClash = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/**
 * The stage's invoice number, given the first time it is opened: the next in
 * the studio's financial year. Two people opening invoices at once cannot
 * share a number (unique studio, year, number) and one stage cannot get two
 * (unique project, stage): a clash reads again and tries the next number.
 */
async function numberFor(input: { studioId: string; projectId: string; stageIndex: number; prefix: string; actor: ProjectActor; now: Date }): Promise<{ number: string; issuedAt: Date }> {
  const where = { projectId_stageIndex: { projectId: input.projectId, stageIndex: input.stageIndex } };
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await prisma.studioInvoice.findUnique({ where, select: { number: true, issuedAt: true } });
    if (found) return found;
    const fyStart = indianFyStart(input.now);
    try {
      return await prisma.$transaction(async (tx) => {
        const last = await tx.studioInvoice.aggregate({ where: { studioId: input.studioId, fyStart }, _max: { seq: true } });
        const seq = (last._max.seq ?? 0) + 1;
        const row = await tx.studioInvoice.create({
          data: { studioId: input.studioId, projectId: input.projectId, stageIndex: input.stageIndex, fyStart, seq, number: invoiceNumber(input.prefix, fyStart, seq), issuedAt: input.now },
          select: { id: true, number: true, issuedAt: true },
        });
        await recordEvent(tx, { projectId: input.projectId, type: 'invoice.issued', actor: input.actor, refId: row.id, payload: { stageIndex: input.stageIndex, fyStart, seq }, at: input.now });
        return { number: row.number, issuedAt: row.issuedAt };
      });
    } catch (e) {
      if (!isUniqueClash(e)) throw e;
    }
  }
  throw new Error('Could not give the invoice a number');
}

// ── One stage's invoice ───────────────────────────────────────

export interface StageInvoice {
  projectId: string;
  issuer: DocIssuer;
  number: string;
  /** IST day it was first issued, "YYYY-MM-DD". */
  issuedOn: string;
  /** "2432-D2 (Design Final)", or the signed quotation's number; null when neither has one. */
  quotation: string | null;
  client: { name: string; site: string; phone: string | null };
  stage: { position: number; of: number; deliverable: string | null };
  /** The project before its GST, and the % it is on; null pct = no GST on the project. */
  project: { valuePaise: number; totalPaise: number; paidPaise: number; remainingPaise: number; gstPct: number | null; gstPaise: number; designFinal: boolean };
  figures: InvoiceFigures;
  received: { day: string | null; mode: string | null };
}

const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

const ROW_SELECT = {
  id: true,
  stageIndex: true,
  amountPaise: true,
  receivedOn: true,
  mode: true,
  receiptDocumentId: true,
  correctsId: true,
  recordedById: true,
  beforeJoining: true,
  recordedAt: true,
  customerConfirmedAt: true,
  disputedAt: true,
} as const;

/** One stage's invoice; null when the member may not read the project's money, nothing was signed in the app, or there is no such stage. */
export async function stageInvoice(projectId: string, stageIndex: number, now = new Date()): Promise<StageInvoice | null> {
  if (!Number.isInteger(stageIndex) || stageIndex < 0) return null;
  const staff = await staffOn(projectId, 'payment.read');
  if (!staff.ok) return null;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      paymentPhases: true,
      paidPhases: true,
      gstPctOfValue: true,
      gstPaise: true,
      signedQuoteId: true,
      designFinalQuoteId: true,
      payments: { select: ROW_SELECT },
      quoteChanges: { select: { deltaPaise: true, stageIndex: true } },
      introduction: {
        select: {
          studioId: true,
          studio: { select: { paymentTemplate: true } },
          brief: { select: { society: true, locality: true, propertyType: true, contactName: true, contactPhone: true, user: { select: { name: true, phone: true } } } },
        },
      },
    },
  });
  if (!p || p.introduction.studioId !== staff.studioId) return null;
  const l = ledgerOf(p);
  const stage = l?.stages[stageIndex];
  if (!l || !stage) return null;

  const issuer = await issuerFor(staff.studioId);
  const quoteIds = [p.designFinalQuoteId, p.signedQuoteId].filter((x): x is string => Boolean(x));
  const [quotes, issued] = await Promise.all([
    quoteIds.length ? prisma.studioQuote.findMany({ where: { id: { in: quoteIds }, studioId: staff.studioId }, select: { id: true, number: true, salesFinalSchedule: true } }) : Promise.resolve([]),
    numberFor({ studioId: staff.studioId, projectId, stageIndex, prefix: issuer.prefix, actor: staff.actor, now }),
  ]);
  const byId = new Map(quotes.map((q) => [q.id, q]));
  const df = p.designFinalQuoteId ? byId.get(p.designFinalQuoteId) : undefined;
  const signed = p.signedQuoteId ? byId.get(p.signedQuoteId) : undefined;

  const gstPaise = fromDb(p.gstPaise);
  const shares = gstSplit(l.stages, gstPaise);
  const figures = invoiceFigures(stage, shares[stageIndex] ?? 0);
  const counted = l.rows.filter((r) => r.stageIndex === stageIndex && r.counts && r.amountPaise > 0);
  const got = receivedOn(counted.map((r) => ({ receivedOn: r.receivedOn, mode: r.mode })));
  const b = p.introduction.brief;

  return {
    projectId,
    issuer,
    number: issued.number,
    issuedOn: istDay(issued.issuedAt),
    quotation: df?.number ? `${df.number} (Design Final)` : (signed?.number ?? null),
    client: { name: b.contactName?.trim() || b.user?.name?.trim() || 'Client', site: siteLabel(b), phone: b.contactPhone?.trim() || b.user?.phone || null },
    stage: {
      position: stageIndex + 1,
      of: l.stages.length,
      deliverable: deliverableFor(stage.label, [readStages(signed?.salesFinalSchedule), readStages(df?.salesFinalSchedule), templateOrDefault(p.introduction.studio.paymentTemplate)]),
    },
    project: {
      valuePaise: l.signedPaise - gstPaise,
      totalPaise: l.totalPaise,
      paidPaise: l.paidPaise,
      remainingPaise: l.balancePaise,
      gstPct: p.gstPctOfValue ?? null,
      gstPaise,
      designFinal: Boolean(df),
    },
    figures,
    received: { day: got.day, mode: got.mode ? (MODE_LABEL[got.mode as PaymentModeName] ?? got.mode) : null },
  };
}
