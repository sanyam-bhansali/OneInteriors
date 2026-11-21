import 'server-only';

/**
 * Settings → Invoices (owner, 21 Nov 2026): who signs the invoices and the
 * statement, the signature and stamp images, the invoice prefix, the SAC
 * code and the bank details (printed only when filled). The owner's alone.
 * The legal name, address, GSTIN and logo stay in Settings → Your details.
 */

import { prisma } from '@/lib/prisma';
import { currentMember } from '@/modules/studio/access';
import { removeLogo, signedSignUrls, storeSignImage } from '@/modules/storage/studio-logo';
import { DEFAULT_SAC, checkAccountNumber, checkIfsc, checkPrefix, checkSac, prefixFromLegalName } from './invoice-rules';

export type InvoiceSettingsResult = { ok: true; message: string } | { ok: false; error: string };

export interface InvoiceSettings {
  hasBranding: boolean;
  legalName: string;
  defaultPrefix: string;
  defaultSac: string;
  signatoryName: string;
  signatoryDesignation: string;
  invoicePrefix: string;
  sacCode: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  signatureUrl: string | null;
  stampUrl: string | null;
}

async function owner() {
  const m = await currentMember();
  return m && m.role === 'OWNER' && m.status === 'ACTIVE' ? m : null;
}

/** For the owner; null for anyone else. */
export async function myInvoiceSettings(): Promise<InvoiceSettings | null> {
  const m = await owner();
  if (!m) return null;
  const b = await prisma.studioBranding.findUnique({ where: { studioId: m.studioId } });
  const [signatureUrl, stampUrl] = await signedSignUrls([b?.signaturePath ?? null, b?.stampPath ?? null], m.studioId);
  return {
    hasBranding: b !== null,
    legalName: b?.legalName ?? '',
    defaultPrefix: prefixFromLegalName(b?.legalName),
    defaultSac: DEFAULT_SAC,
    signatoryName: b?.signatoryName ?? '',
    signatoryDesignation: b?.signatoryDesignation ?? '',
    invoicePrefix: b?.invoicePrefix ?? '',
    sacCode: b?.sacCode ?? '',
    bankAccountName: b?.bankAccountName ?? '',
    bankAccountNumber: b?.bankAccountNumber ?? '',
    bankIfsc: b?.bankIfsc ?? '',
    bankName: b?.bankName ?? '',
    signatureUrl: signatureUrl ?? null,
    stampUrl: stampUrl ?? null,
  };
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '') || null;

/** The owner saves the text fields. An empty prefix or SAC means the default. */
export async function saveInvoiceSettings(form: Record<string, unknown>): Promise<InvoiceSettingsResult> {
  const m = await owner();
  if (!m || m.viewOnly === true) return { ok: false, error: 'Only the studio owner changes invoice settings.' };
  const prefix = checkPrefix(form.invoicePrefix);
  if (!prefix.ok) return prefix;
  const sac = checkSac(form.sacCode);
  if (!sac.ok) return sac;
  const ifsc = checkIfsc(form.bankIfsc);
  if (!ifsc.ok) return ifsc;
  const account = checkAccountNumber(form.bankAccountNumber);
  if (!account.ok) return account;
  const exists = await prisma.studioBranding.findUnique({ where: { studioId: m.studioId }, select: { id: true } });
  if (!exists) return { ok: false, error: 'Fill in Your details first: invoices go out under your registered name and GSTIN.' };
  await prisma.studioBranding.update({
    where: { studioId: m.studioId },
    data: {
      signatoryName: text(form.signatoryName, 80),
      signatoryDesignation: text(form.signatoryDesignation, 80),
      invoicePrefix: prefix.prefix,
      sacCode: sac.sac,
      bankAccountName: text(form.bankAccountName, 120),
      bankAccountNumber: account.number,
      bankIfsc: ifsc.ifsc,
      bankName: text(form.bankName, 120),
    },
  });
  return { ok: true, message: 'Saved. Invoice numbers already given keep their prefix.' };
}

export type SignKind = 'signature' | 'stamp';
const column = (k: SignKind) => (k === 'signature' ? 'signaturePath' : 'stampPath');

/** Upload the signature or the stamp: stored first, then the row, then the old image removed. */
export async function replaceSignImage(kind: SignKind, file: File): Promise<InvoiceSettingsResult> {
  const m = await owner();
  if (!m || m.viewOnly === true) return { ok: false, error: 'Only the studio owner changes invoice settings.' };
  const existing = await prisma.studioBranding.findUnique({ where: { studioId: m.studioId }, select: { signaturePath: true, stampPath: true } });
  if (!existing) return { ok: false, error: 'Fill in Your details first.' };
  const stored = await storeSignImage(m.studioId, file);
  if (!stored.ok) return stored;
  await prisma.studioBranding.update({ where: { studioId: m.studioId }, data: { [column(kind)]: stored.path } });
  await removeLogo(existing[column(kind)]);
  return { ok: true, message: kind === 'signature' ? 'Signature saved.' : 'Stamp saved.' };
}

export async function clearSignImage(kind: SignKind): Promise<InvoiceSettingsResult> {
  const m = await owner();
  if (!m || m.viewOnly === true) return { ok: false, error: 'Only the studio owner changes invoice settings.' };
  const existing = await prisma.studioBranding.findUnique({ where: { studioId: m.studioId }, select: { signaturePath: true, stampPath: true } });
  const path = existing?.[column(kind)] ?? null;
  if (!path) return { ok: true, message: 'Removed.' };
  await prisma.studioBranding.update({ where: { studioId: m.studioId }, data: { [column(kind)]: null } });
  await removeLogo(path);
  return { ok: true, message: 'Removed.' };
}
