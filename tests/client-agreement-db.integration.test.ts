import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * The client agreement against a LOCAL throwaway test database only (PGlite;
 * docs/studio-os/CLIENT-AGREEMENT.md). Skipped in the normal suite. Needs the
 * migrations applied and `prisma/seed.ts` run (the st-akara studio). Run on
 * its own:
 *
 *   AGREEMENT_TEST_DB=1 DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54367/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
 *     npx vitest run tests/client-agreement-db.integration.test.ts
 *
 * Real Postgres for the template save, the send (with the local test eSign
 * provider), the provider's return filing the signed copy in the Locker once,
 * and the studio's upload of a copy signed elsewhere. Storage is stubbed.
 */

const RUN = process.env.AGREEMENT_TEST_DB === '1';
if (RUN && !/127\.0\.0\.1:543\d\d/.test(process.env.DATABASE_URL ?? '')) throw new Error('Test database only: DATABASE_URL must point at a local 127.0.0.1:543xx PGlite.');

const staff = vi.hoisted(() => ({ member: null as Record<string, unknown> | null }));
vi.mock('@/modules/studio/access', () => ({
  currentMember: vi.fn(async () => staff.member),
  can: vi.fn(() => true),
  memberOnProject: vi.fn(async () => (staff.member ? { ok: true, member: staff.member } : { ok: false, error: 'Sign in first.' })),
}));
let n = 0;
vi.mock('@/modules/storage/project-docs', () => ({
  storeProjectDoc: vi.fn(async (projectId: string) => ({ ok: true, path: `project_${projectId}/doc${++n}.pdf` })),
  signedDocUrls: vi.fn(async (keys: string[]) => keys.map((k) => (k ? `https://signed.test/${k}` : ''))),
}));

const STUDIO = 'st-akara';
const TAG = `agr${Date.now().toString(36)}`;
const made = { users: [] as string[], members: [] as string[], briefs: [] as string[], intros: [] as string[], projects: [] as string[], quotes: [] as string[] };
let projectId = '';
let clientId = '';
let brandingBefore: { clientAgreement: string | null; agreementSignatory: string | null; agreementSignatoryRole: string | null } | null = null;

afterAll(async () => {
  if (!RUN) return;
  const { prisma } = await import('@/lib/prisma');
  await prisma.homeProject.deleteMany({ where: { id: { in: made.projects } } });
  await prisma.studioQuote.deleteMany({ where: { id: { in: made.quotes } } });
  await prisma.introduction.deleteMany({ where: { id: { in: made.intros } } });
  await prisma.brief.deleteMany({ where: { id: { in: made.briefs } } });
  await prisma.studioMember.deleteMany({ where: { id: { in: made.members } } });
  await prisma.notification.deleteMany({ where: { userId: { in: made.users } } });
  await prisma.user.deleteMany({ where: { id: { in: made.users } } });
  if (brandingBefore) await prisma.studioBranding.update({ where: { studioId: STUDIO }, data: brandingBefore });
});

describe.skipIf(!RUN)('client agreement (test database)', () => {
  it('sets up a project with a Design Final, and the studio owner', async () => {
    const { prisma } = await import('@/lib/prisma');
    const b = await prisma.studioBranding.findUnique({ where: { studioId: STUDIO }, select: { clientAgreement: true, agreementSignatory: true, agreementSignatoryRole: true } });
    if (!b) await prisma.studioBranding.create({ data: { studioId: STUDIO, legalName: 'Akara Design Pvt Ltd', city: 'Pune' } });
    brandingBefore = b ?? { clientAgreement: null, agreementSignatory: null, agreementSignatoryRole: null };
    const ownerUser = await prisma.user.create({ data: { phone: `+9197${String(Date.now()).slice(-8)}`, name: `${TAG} Owner`, role: 'STUDIO' }, select: { id: true } });
    made.users.push(ownerUser.id);
    const owner = await prisma.studioMember.create({ data: { studioId: STUDIO, userId: ownerUser.id, role: 'OWNER', status: 'ACTIVE' }, select: { id: true, userId: true, role: true, status: true, studioId: true } });
    made.members.push(owner.id);
    staff.member = owner;
    const client = await prisma.user.create({ data: { phone: `+9198${String(Date.now()).slice(-8)}`, name: `${TAG} Ankita` }, select: { id: true } });
    made.users.push(client.id);
    clientId = client.id;
    const brief = await prisma.brief.create({ data: { userId: client.id }, select: { id: true } });
    made.briefs.push(brief.id);
    const intro = await prisma.introduction.create({ data: { briefId: brief.id, studioId: STUDIO, introducedById: ownerUser.id }, select: { id: true } });
    made.intros.push(intro.id);
    const quote = await prisma.studioQuote.create({ data: { studioId: STUDIO, number: `${TAG}-DF`, clientName: 'Ankita Shah', society: 'Kumar Pebble Park', locality: 'Hadapsar', feeBps: 0, discountBps: 0, bookingAdvancePaise: 0n }, select: { id: true } });
    made.quotes.push(quote.id);
    const p = await prisma.homeProject.create({ data: { introductionId: intro.id, startOn: new Date('2026-10-01T00:00:00Z'), totalDays: 90, designFinalQuoteId: quote.id }, select: { id: true } });
    made.projects.push(p.id);
    projectId = p.id;
  });

  it('refuses to send before the template is written', async () => {
    const { studioAgreementView } = await import('@/modules/agreement/store');
    const v = await studioAgreementView(projectId);
    expect(v.ok && v.view.ready.ok).toBe(false);
    if (v.ok) expect(v.view.prefill).toMatchObject({ clientName: 'Ankita Shah', siteAddress: 'Kumar Pebble Park, Hadapsar, Pune' });
  });

  it('saves the template, refusing an unknown placeholder', async () => {
    const { saveAgreementTemplate } = await import('@/modules/agreement/store');
    expect(await saveAgreementTemplate({ text: 'Hello {{client_nmae}}', signatory: 'S', signatoryRole: 'D' })).toMatchObject({ ok: false });
    const r = await saveAgreementTemplate({
      text: '## AGREEMENT\n\nMade on {{agreement_date}} with **{{client_name}}**, {{client_relation}}residing at {{client_address}}{{client_pan}}, for {{site_address}}.\n\n### 1. SCOPE\n\n* Per Design Quotation {{design_quotation}}.\n* Booking advance ₹25,000.',
      signatory: 'Sanyam Bhansali',
      signatoryRole: 'Director',
    });
    expect(r.ok).toBe(true);
  });

  it('without a connected provider, send refuses; the preview still prints', async () => {
    const { previewAgreementPdf, sendAgreement } = await import('@/modules/agreement/store');
    delete process.env.ESIGN_PROVIDER;
    const fields = { clientName: 'Ankita Shah', relation: 'daughter of Ramesh Shah', address: 'Flat 12, Sunrise, Baner, Pune', pan: 'ABCDE1234F', siteAddress: 'Flat 802, Kumar Pebble Park, Hadapsar, Pune', date: '21 November 2026' };
    expect(await sendAgreement(projectId, fields)).toMatchObject({ ok: false, error: expect.stringMatching(/not connected/) });
    const pdf = await previewAgreementPdf(projectId, fields);
    expect(pdf.ok && Buffer.from(pdf.pdf.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('sends with the test provider; the client sees it; signing files it in the Locker once', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { clientAgreementView, completeFromProvider, sendAgreement } = await import('@/modules/agreement/store');
    const { testStore } = await import('@/modules/agreement/provider');
    process.env.ESIGN_PROVIDER = 'test';
    const fields = { clientName: 'Ankita Shah', relation: '', address: 'Flat 12, Sunrise, Baner, Pune', pan: '', siteAddress: 'Flat 802, Kumar Pebble Park, Hadapsar, Pune', date: '21 November 2026' };
    const sent = await sendAgreement(projectId, fields);
    expect(sent).toMatchObject({ ok: true });
    const row = await prisma.clientAgreement.findFirst({ where: { projectId, status: 'SENT' }, select: { id: true, text: true, providerRequestId: true, signUrl: true } });
    expect(row!.text).toContain('Made on 21 November 2026 with **Ankita Shah**, residing at Flat 12, Sunrise, Baner, Pune, for Flat 802');
    expect(row!.text).toContain(`Per Design Quotation ${TAG}-DF.`);
    const seen = await clientAgreementView(clientId, projectId);
    expect(seen).toMatchObject({ ok: true, view: { state: 'sent', owner: true, signUrl: row!.signUrl } });
    expect(await completeFromProvider('test', row!.providerRequestId!)).toMatchObject({ ok: true, state: 'pending' });
    testStore.get(row!.providerRequestId!)!.signed = true;
    expect(await completeFromProvider('test', row!.providerRequestId!)).toMatchObject({ ok: true, state: 'signed' });
    expect(await completeFromProvider('test', row!.providerRequestId!)).toMatchObject({ ok: true, state: 'signed' });
    const docs = await prisma.homeDocument.findMany({ where: { projectId, kind: 'AGREEMENT' }, select: { sharedAt: true } });
    expect(docs).toHaveLength(1);
    expect(docs[0]!.sharedAt).not.toBeNull();
    const done = await prisma.clientAgreement.findUnique({ where: { id: row!.id }, select: { status: true, signerName: true, signedVia: true } });
    expect(done).toEqual({ status: 'SIGNED', signerName: 'ANKITA SHAH', signedVia: 'esign:test' });
    expect(await sendAgreement(projectId, fields)).toMatchObject({ ok: false, error: expect.stringMatching(/signed the agreement already/) });
  });

  it('a copy signed elsewhere can be uploaded and files in the Locker', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { uploadSignedAgreement } = await import('@/modules/agreement/store');
    expect(await uploadSignedAgreement(projectId, new File([new Uint8Array([1])], 'x.png', { type: 'image/png' }))).toMatchObject({ ok: false });
    const r = await uploadSignedAgreement(projectId, new File([new Uint8Array([37, 80, 68, 70])], 'signed.pdf', { type: 'application/pdf' }));
    expect(r.ok).toBe(true);
    expect(await prisma.homeDocument.count({ where: { projectId, kind: 'AGREEMENT' } })).toBe(2);
    expect(await prisma.clientAgreement.count({ where: { projectId, status: 'SIGNED', signedVia: 'upload' } })).toBe(1);
  });
});
