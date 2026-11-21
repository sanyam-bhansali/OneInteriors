import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildAgreementPdf } from '@/modules/agreement/pdf';
import {
  PLACEHOLDERS,
  agreementDate,
  agreementState,
  checkAgreementFields,
  fillAgreement,
  pdfSafe,
  readyToSend,
  unknownPlaceholders,
} from '@/modules/agreement/rules';
import { routeFor } from '../mobile/src/lib/route-for';

/**
 * The client agreement (owner, 21 Nov 2026; docs/studio-os/CLIENT-AGREEMENT.md):
 * the studio's template filled per client, printed to a PDF, e-signed by the
 * client at design closure.
 */

const fields = { clientName: 'Ankita Shah', relation: '', address: 'Flat 12, Sunrise, Baner, Pune', pan: '', siteAddress: 'Flat 802, Kumar Pebble Park, Hadapsar, Pune', date: '21 November 2026' };
const extra = { designQuotation: 'HP-2026-101', signatory: 'Sanyam Bhansali', signatoryRole: 'Director' };

describe('filling the template', () => {
  const template =
    '## AGREEMENT\nMade on {{agreement_date}}.\n**{{client_name}}**, {{client_relation}}residing at {{client_address}}{{client_pan}}, for the site at {{site_address}}.\nDesign Quotation {{design_quotation}}. Signed for the studio by {{studio_signatory}}, {{studio_signatory_role}}.';

  it('fills every placeholder', () => {
    const t = fillAgreement(template, fields, extra);
    expect(t).toContain('Made on 21 November 2026.');
    expect(t).toContain('**Ankita Shah**, residing at Flat 12, Sunrise, Baner, Pune, for the site at Flat 802');
    expect(t).toContain('Design Quotation HP-2026-101. Signed for the studio by Sanyam Bhansali, Director.');
    expect(t).not.toMatch(/\{\{/);
  });

  it('optional relation and PAN carry their own punctuation, and vanish when blank', () => {
    const t = fillAgreement(template, { ...fields, relation: 'daughter of Ramesh Shah,', pan: 'ABCDE1234F' }, extra);
    expect(t).toContain('**Ankita Shah**, daughter of Ramesh Shah, residing at Flat 12, Sunrise, Baner, Pune, PAN ABCDE1234F, for the site');
  });

  it('leaves an unknown placeholder as written, and names it', () => {
    expect(fillAgreement('Hi {{client_nmae}}', fields, extra)).toBe('Hi {{client_nmae}}');
    expect(unknownPlaceholders('{{client_name}} {{client_nmae}} {{ foo }}')).toEqual(['client_nmae', 'foo']);
  });

  it('documents every placeholder it fills', () => {
    const all = Object.keys(PLACEHOLDERS).map((k) => `{{${k}}}`).join(' ');
    expect(fillAgreement(all, fields, extra)).not.toMatch(/\{\{/);
  });
});

describe('the details the studio confirms', () => {
  it('needs the name, both addresses and the date; PAN is checked when given', () => {
    expect(checkAgreementFields(fields)).toEqual({ ok: true, value: fields });
    expect(checkAgreementFields({ ...fields, clientName: 'A' }).ok).toBe(false);
    expect(checkAgreementFields({ ...fields, siteAddress: '' }).ok).toBe(false);
    expect(checkAgreementFields({ ...fields, pan: 'abcde1234f' })).toMatchObject({ ok: true, value: { pan: 'ABCDE1234F' } });
    expect(checkAgreementFields({ ...fields, pan: '1234' }).ok).toBe(false);
  });

  it('dates it in IST, in words', () => {
    expect(agreementDate(new Date('2026-11-20T20:00:00Z'))).toBe('21 November 2026');
  });
});

describe('ready to send', () => {
  it('needs the template, the signatory, and no unknown placeholder', () => {
    expect(readyToSend({ template: null, signatory: 'X' }).ok).toBe(false);
    expect(readyToSend({ template: 'text', signatory: '' }).ok).toBe(false);
    expect(readyToSend({ template: '{{oops}}', signatory: 'X' })).toMatchObject({ ok: false, error: expect.stringContaining('{{oops}}') });
    expect(readyToSend({ template: '{{client_name}}', signatory: 'X' })).toEqual({ ok: true });
  });

  it('the latest live agreement decides the state', () => {
    expect(agreementState([])).toBe('none');
    expect(agreementState([{ status: 'CANCELLED' }, { status: 'SENT' }])).toBe('sent');
    expect(agreementState([{ status: 'SIGNED' }])).toBe('signed');
  });
});

describe('the PDF', () => {
  it('prints what Helvetica can: the rupee sign as Rs., curly quotes straight', () => {
    expect(pdfSafe('₹25,000 and “quoted” client’s')).toBe('Rs. 25,000 and "quoted" client\'s');
  });

  it('builds a multi-page A4 PDF from the markup', async () => {
    const body = Array.from({ length: 60 }, (_, i) => `### ${i + 1}. CLAUSE\n${'The Service Provider shall do the work with care and skill. '.repeat(6)}\n* A point with **bold** words.\n  * A sub-point.`).join('\n\n');
    const bytes = await buildAgreementPdf({ text: `## INTERIOR DESIGN SERVICES AGREEMENT\n\n${body}\nBooking advance ₹25,000.`, studioName: 'Studio Pvt Ltd', signatory: 'A Person', signatoryRole: 'Director', clientName: 'Ankita Shah', date: '21 November 2026' });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(3);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });
});

describe('the phone opens the right screen from a notice', () => {
  it('agreement and aftercare notices', () => {
    expect(routeFor('/app/agreement')).toBe('/agreement');
    expect(routeFor('/app/aftercare')).toBe('/aftercare');
  });
});
