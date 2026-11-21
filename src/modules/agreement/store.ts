import 'server-only';

/**
 * The client agreement, read and written (owner, 21 Nov 2026; docs/studio-os/
 * CLIENT-AGREEMENT.md). Rules in rules.ts, the PDF in pdf.ts, the eSign
 * provider in provider.ts.
 *
 * - The template is the studio owner's (Settings → Client agreement).
 * - At design closure (once the Design Final exists), the owner, PM or the
 *   project's designer confirms the client's details and sends it: filled,
 *   made into a PDF with the studio's side signed, and handed to the eSign
 *   provider. Only the client signs.
 * - Signed (the provider says so, or the studio uploads a signed copy): the
 *   signed PDF files in the client's Locker as their Agreement.
 */

import { prisma } from '@/lib/prisma';
import { resolveSiteUrl } from '@/lib/site';
import { notify, notifyStudio } from '@/modules/notify/service';
import { recordEvent } from '@/modules/project/events';
import { signedDocUrls, storeProjectDoc } from '@/modules/storage/project-docs';
import { can, currentMember, memberOnProject } from '@/modules/studio/access';
import { buildAgreementPdf } from './pdf';
import { esignProvider, providerById } from './provider';
import { AGREEMENT_MAX, agreementDate, checkAgreementFields, fillAgreement, readyToSend, unknownPlaceholders, type AgreementFields } from './rules';

export type AgreementResult = { ok: true; message: string } | { ok: false; error: string };

// ── The template (Settings) ────────────────────────────────────

export interface AgreementTemplate {
  text: string;
  signatory: string;
  signatoryRole: string;
  canEdit: boolean;
}

export async function myAgreementTemplate(): Promise<AgreementTemplate | null> {
  const member = await currentMember();
  if (!member || !['OWNER', 'PM'].includes(member.role)) return null;
  const b = await prisma.studioBranding.findUnique({ where: { studioId: member.studioId }, select: { clientAgreement: true, agreementSignatory: true, agreementSignatoryRole: true } });
  return { text: b?.clientAgreement ?? '', signatory: b?.agreementSignatory ?? '', signatoryRole: b?.agreementSignatoryRole ?? '', canEdit: can(member, 'payments.template') };
}

/** The owner saves the template and who signs for the studio. */
export async function saveAgreementTemplate(input: { text: unknown; signatory: unknown; signatoryRole: unknown }): Promise<AgreementResult> {
  const member = await currentMember();
  if (!member || !can(member, 'payments.template')) return { ok: false, error: 'Only the studio owner changes the client agreement.' };
  const text = typeof input.text === 'string' ? input.text.replace(/\r\n?/g, '\n') : '';
  if (text.length > AGREEMENT_MAX) return { ok: false, error: `At most ${AGREEMENT_MAX.toLocaleString('en-IN')} characters.` };
  const unknown = unknownPlaceholders(text);
  if (unknown.length) return { ok: false, error: `${unknown.map((u) => `{{${u}}}`).join(', ')} is not a placeholder the app can fill. Use the ones listed.` };
  const signatory = typeof input.signatory === 'string' ? input.signatory.trim().slice(0, 120) : '';
  const signatoryRole = typeof input.signatoryRole === 'string' ? input.signatoryRole.trim().slice(0, 120) : '';
  const exists = await prisma.studioBranding.findUnique({ where: { studioId: member.studioId }, select: { id: true } });
  if (!exists) return { ok: false, error: 'Finish your studio details first (Settings): the agreement goes out under your registered name.' };
  await prisma.studioBranding.update({
    where: { studioId: member.studioId },
    data: { clientAgreement: text.trim() ? text : null, agreementSignatory: signatory || null, agreementSignatoryRole: signatoryRole || null },
  });
  return { ok: true, message: 'Saved. Agreements sent from now on use this; one already sent keeps its words.' };
}

// ── One project's agreement (studio) ───────────────────────────

const PROJECT_FOR_AGREEMENT = {
  id: true,
  designFinalQuoteId: true,
  designClosedAt: true,
  cancelledAt: true,
  introduction: {
    select: {
      studioId: true,
      studio: { select: { tradeName: true, legalName: true, branding: { select: { clientAgreement: true, agreementSignatory: true, agreementSignatoryRole: true, legalName: true } } } },
      brief: { select: { userId: true, user: { select: { name: true, phone: true, email: true } } } },
    },
  },
} as const;

async function projectFor(projectId: string) {
  return prisma.homeProject.findUnique({ where: { id: projectId.slice(0, 64) }, select: PROJECT_FOR_AGREEMENT });
}

type ProjectRow = NonNullable<Awaited<ReturnType<typeof projectFor>>>;

const studioNameOf = (p: ProjectRow) => p.introduction.studio.branding?.legalName || p.introduction.studio.legalName || p.introduction.studio.tradeName;

async function prefillFor(p: ProjectRow, now: Date): Promise<AgreementFields & { designQuotation: string | null }> {
  const q = p.designFinalQuoteId
    ? await prisma.studioQuote.findFirst({ where: { id: p.designFinalQuoteId, studioId: p.introduction.studioId }, select: { number: true, clientName: true, society: true, locality: true } })
    : null;
  const site = [q?.society, q?.locality, 'Pune'].filter(Boolean).join(', ');
  return {
    clientName: q?.clientName || p.introduction.brief.user?.name || '',
    relation: '',
    address: site,
    pan: '',
    siteAddress: site,
    date: agreementDate(now),
    designQuotation: q?.number ?? null,
  };
}

export interface StudioAgreementView {
  canSend: boolean;
  ready: { ok: true } | { ok: false; error: string };
  provider: string | null;
  designFinal: boolean;
  prefill: AgreementFields;
  latest: {
    id: string;
    status: 'SENT' | 'SIGNED';
    sentAt: string;
    signedAt: string | null;
    signerName: string | null;
    signedVia: string | null;
    pdfUrl: string | null;
    signedUrl: string | null;
  } | null;
}

export async function studioAgreementView(projectId: string, now = new Date()): Promise<{ ok: true; view: StudioAgreementView } | { ok: false; error: string }> {
  const check = await memberOnProject(projectId, 'design.close');
  if (!check.ok) return check;
  const p = await projectFor(projectId);
  if (!p || p.cancelledAt || p.introduction.studioId !== check.member.studioId) return { ok: false, error: 'That project is not one of yours.' };
  const b = p.introduction.studio.branding;
  const latest = await prisma.clientAgreement.findFirst({
    where: { projectId: p.id, status: { not: 'CANCELLED' } },
    orderBy: { sentAt: 'desc' },
    select: { id: true, status: true, sentAt: true, signedAt: true, signerName: true, signedVia: true, pdfPath: true, signedPath: true },
  });
  const [pdfUrl, signedUrl] = latest ? await signedDocUrls([latest.pdfPath ?? '', latest.signedPath ?? '']).catch(() => ['', '']) : ['', ''];
  const provider = esignProvider();
  return {
    ok: true,
    view: {
      canSend: true,
      ready: readyToSend({ template: b?.clientAgreement ?? null, signatory: b?.agreementSignatory ?? null }),
      provider: provider?.label ?? null,
      designFinal: Boolean(p.designFinalQuoteId),
      prefill: await prefillFor(p, now),
      latest: latest
        ? {
            id: latest.id,
            status: latest.status === 'SIGNED' ? 'SIGNED' : 'SENT',
            sentAt: latest.sentAt.toISOString(),
            signedAt: latest.signedAt?.toISOString() ?? null,
            signerName: latest.signerName,
            signedVia: latest.signedVia,
            pdfUrl: latest.pdfPath ? pdfUrl || null : null,
            signedUrl: latest.signedPath ? signedUrl || null : null,
          }
        : null,
    },
  };
}

/** Fill and print, without saving: the studio's preview. */
export async function previewAgreementPdf(projectId: string, raw: Record<string, unknown>, now = new Date()): Promise<{ ok: true; pdf: Uint8Array } | { ok: false; error: string }> {
  const built = await build(projectId, raw, now);
  return built.ok ? { ok: true, pdf: built.pdf } : built;
}

async function build(projectId: string, raw: Record<string, unknown>, now: Date) {
  const check = await memberOnProject(projectId, 'design.close');
  if (!check.ok) return check;
  const p = await projectFor(projectId);
  if (!p || p.cancelledAt || p.introduction.studioId !== check.member.studioId) return { ok: false as const, error: 'That project is not one of yours.' };
  if (!p.designFinalQuoteId) return { ok: false as const, error: 'Make the Design Final first: the agreement is signed at design closure.' };
  const b = p.introduction.studio.branding;
  const ready = readyToSend({ template: b?.clientAgreement ?? null, signatory: b?.agreementSignatory ?? null });
  if (!ready.ok) return ready;
  const fields = checkAgreementFields(raw);
  if (!fields.ok) return fields;
  const pre = await prefillFor(p, now);
  const text = fillAgreement(b!.clientAgreement!, fields.value, { designQuotation: pre.designQuotation, signatory: b!.agreementSignatory, signatoryRole: b!.agreementSignatoryRole });
  const pdf = await buildAgreementPdf({ text, studioName: studioNameOf(p), signatory: b!.agreementSignatory!, signatoryRole: b!.agreementSignatoryRole, clientName: fields.value.clientName, date: fields.value.date });
  return { ok: true as const, p, member: check.member, fields: fields.value, text, pdf };
}

const pdfFile = (bytes: Uint8Array, name: string) => new File([Buffer.from(bytes)], name, { type: 'application/pdf' });

/**
 * Send for eSign: filled, printed, stored, and handed to the provider. A
 * newer send replaces one still waiting. Needs a connected provider.
 */
export async function sendAgreement(projectId: string, raw: Record<string, unknown>, now = new Date()): Promise<AgreementResult> {
  const provider = esignProvider();
  if (!provider) return { ok: false, error: 'Aadhaar eSign is not connected yet. Preview the PDF, or upload a signed copy instead.' };
  const built = await build(projectId, raw, now);
  if (!built.ok) return built;
  const { p, member, fields, text, pdf } = built;
  const signed = await prisma.clientAgreement.findFirst({ where: { projectId: p.id, studioId: p.introduction.studioId, status: 'SIGNED' }, select: { id: true } });
  if (signed) return { ok: false, error: 'The client has signed the agreement already.' };
  const stored = await storeProjectDoc(p.id, pdfFile(pdf, 'agreement.pdf'));
  if (!stored.ok) return stored;
  await prisma.clientAgreement.updateMany({ where: { projectId: p.id, studioId: p.introduction.studioId, status: 'SENT' }, data: { status: 'CANCELLED', cancelledAt: now } });
  const row = await prisma.clientAgreement.create({
    data: { projectId: p.id, studioId: p.introduction.studioId, quoteId: p.designFinalQuoteId, fields: { ...fields }, text, pdfPath: stored.path, provider: provider.id, sentById: member.userId },
    select: { id: true },
  });
  const user = p.introduction.brief.user;
  const req = await provider.createRequest({
    pdf,
    fileName: 'agreement.pdf',
    referenceId: row.id,
    signer: { name: fields.clientName, phone: user?.phone ?? null, email: user?.email ?? null },
    returnUrl: `${resolveSiteUrl()}/api/esign/${provider.id}/return`,
  });
  if (!req.ok) {
    await prisma.clientAgreement.update({ where: { id: row.id }, data: { status: 'CANCELLED', cancelledAt: now } });
    return { ok: false, error: req.error };
  }
  await prisma.clientAgreement.update({ where: { id: row.id }, data: { providerRequestId: req.requestId, signUrl: req.signUrl } });
  const clientId = p.introduction.brief.userId;
  if (clientId) void notify(clientId, { kind: 'agreement-ready', studio: p.introduction.studio.tradeName });
  return { ok: true, message: 'Sent. The client signs it in the app with Aadhaar; it files in their Locker once signed.' };
}

/** The studio files a copy the client signed elsewhere (on paper, or through the provider's own dashboard). */
export async function uploadSignedAgreement(projectId: string, file: File | null, now = new Date()): Promise<AgreementResult> {
  const check = await memberOnProject(projectId, 'design.close');
  if (!check.ok) return check;
  const p = await projectFor(projectId);
  if (!p || p.cancelledAt || p.introduction.studioId !== check.member.studioId) return { ok: false, error: 'That project is not one of yours.' };
  if (!file || file.size === 0) return { ok: false, error: 'Choose the signed PDF.' };
  if (file.type !== 'application/pdf') return { ok: false, error: 'Upload the signed agreement as a PDF.' };
  const stored = await storeProjectDoc(p.id, file);
  if (!stored.ok) return stored;
  const pending = await prisma.clientAgreement.findFirst({ where: { projectId: p.id, status: 'SENT' }, orderBy: { sentAt: 'desc' }, select: { id: true } });
  await fileSigned({
    p,
    agreementId: pending?.id ?? null,
    path: stored.path,
    bytes: file.size,
    via: 'upload',
    signerName: null,
    byUserId: check.member.userId,
    now,
  });
  return { ok: true, message: 'Filed in the client’s Locker as their signed agreement.' };
}

/** Signed: the copy in the Locker, the row closed, the studio and the client told. */
async function fileSigned(a: {
  p: ProjectRow;
  agreementId: string | null;
  path: string;
  bytes: number;
  via: string;
  signerName: string | null;
  byUserId: string;
  now: Date;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const doc = await tx.homeDocument.create({
      data: {
        projectId: a.p.id,
        kind: 'AGREEMENT',
        title: 'Agreement (signed)',
        storageKey: a.path,
        originalName: 'agreement-signed.pdf',
        contentType: 'application/pdf',
        bytes: a.bytes,
        uploadedById: a.byUserId,
        byStudio: true,
        sharedAt: a.now,
      },
      select: { id: true },
    });
    const data = { status: 'SIGNED' as const, signedPath: a.path, documentId: doc.id, signedVia: a.via, signerName: a.signerName, signedAt: a.now };
    if (a.agreementId) await tx.clientAgreement.updateMany({ where: { id: a.agreementId, studioId: a.p.introduction.studioId }, data });
    else
      await tx.clientAgreement.create({
        data: { ...data, projectId: a.p.id, studioId: a.p.introduction.studioId, quoteId: a.p.designFinalQuoteId, fields: {}, text: '', sentById: a.byUserId, sentAt: a.now },
      });
    await tx.clientAgreement.updateMany({ where: { projectId: a.p.id, status: 'SENT' }, data: { status: 'CANCELLED', cancelledAt: a.now } });
    await recordEvent(tx, { projectId: a.p.id, type: 'document.filed', actor: { type: 'SYSTEM' }, refId: doc.id, payload: { kind: 'AGREEMENT', signedVia: a.via } });
  });
  const clientId = a.p.introduction.brief.userId;
  void notifyStudio(a.p.introduction.studioId, { kind: 'agreement-signed', projectId: a.p.id, client: a.p.introduction.brief.user?.name?.trim() || 'The client' });
  if (clientId) void notify(clientId, { kind: 'document', studio: a.p.introduction.studio.tradeName, title: 'Agreement (signed)' });
}

/**
 * The provider says something happened (redirect or webhook): ask it, and file
 * the signed PDF if it is signed. Idempotent: a second call finds it signed.
 */
export async function completeFromProvider(providerId: string, requestId: string, now = new Date()): Promise<{ ok: true; state: 'signed' | 'pending' | 'failed'; projectId: string } | { ok: false; error: string }> {
  const provider = providerById(providerId);
  if (!provider) return { ok: false, error: 'Unknown eSign provider.' };
  const row = await prisma.clientAgreement.findUnique({ where: { providerRequestId: requestId.slice(0, 200) }, select: { id: true, projectId: true, studioId: true, status: true, provider: true, sentById: true } });
  if (!row || row.provider !== provider.id) return { ok: false, error: 'That signature request is not one we know.' };
  if (row.status === 'SIGNED') return { ok: true, state: 'signed', projectId: row.projectId };
  if (row.status === 'CANCELLED') return { ok: true, state: 'failed', projectId: row.projectId };
  const r = await provider.fetchResult(requestId);
  if (!r.ok) return r;
  if (r.state !== 'signed') return { ok: true, state: r.state, projectId: row.projectId };
  const p = await projectFor(row.projectId);
  if (!p) return { ok: false, error: 'That project is gone.' };
  const stored = await storeProjectDoc(p.id, pdfFile(r.pdf, 'agreement-signed.pdf'));
  if (!stored.ok) return { ok: false, error: stored.error };
  /* Re-read under the write: a webhook and a redirect may race; only one files it. */
  const claimed = await prisma.clientAgreement.updateMany({ where: { id: row.id, studioId: row.studioId, status: 'SENT', signedPath: null }, data: { signedPath: stored.path } });
  if (claimed.count === 0) return { ok: true, state: 'signed', projectId: row.projectId };
  await fileSigned({ p, agreementId: row.id, path: stored.path, bytes: r.pdf.length, via: `esign:${provider.id}`, signerName: r.signerName, byUserId: row.sentById, now });
  return { ok: true, state: 'signed', projectId: row.projectId };
}

// ── The client ─────────────────────────────────────────────────

export interface ClientAgreementView {
  state: 'none' | 'sent' | 'signed';
  studio: string;
  owner: boolean;
  pdfUrl: string | null;
  signedUrl: string | null;
  signUrl: string | null;
  signedAt: string | null;
}

export async function clientAgreementView(userId: string, projectId: string): Promise<{ ok: true; view: ClientAgreementView } | { ok: false; error: string }> {
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId.slice(0, 64) },
    select: {
      id: true,
      cancelledAt: true,
      family: { select: { userId: true, joinedAt: true, removedAt: true } },
      introduction: { select: { studio: { select: { tradeName: true } }, brief: { select: { userId: true } } } },
    },
  });
  if (!p || p.cancelledAt) return { ok: false, error: 'That project is not yours.' };
  const owner = p.introduction.brief.userId === userId;
  const family = p.family.some((f) => f.userId === userId && f.joinedAt !== null && f.removedAt === null);
  if (!owner && !family) return { ok: false, error: 'That project is not yours.' };
  const a = await prisma.clientAgreement.findFirst({
    where: { projectId: p.id, status: { not: 'CANCELLED' } },
    orderBy: { sentAt: 'desc' },
    select: { status: true, pdfPath: true, signedPath: true, signUrl: true, signedAt: true },
  });
  const [pdfUrl, signedUrl] = a ? await signedDocUrls([a.pdfPath ?? '', a.signedPath ?? '']).catch(() => ['', '']) : ['', ''];
  return {
    ok: true,
    view: {
      state: !a ? 'none' : a.status === 'SIGNED' ? 'signed' : 'sent',
      studio: p.introduction.studio.tradeName,
      owner,
      pdfUrl: a?.pdfPath ? pdfUrl || null : null,
      signedUrl: a?.signedPath ? signedUrl || null : null,
      /* Only the owner of the brief signs. */
      signUrl: a?.status === 'SENT' && owner ? a.signUrl : null,
      signedAt: a?.signedAt?.toISOString() ?? null,
    },
  };
}
