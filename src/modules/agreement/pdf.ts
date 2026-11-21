/**
 * The filled agreement as a PDF (owner, 21 Nov 2026; docs/studio-os/
 * CLIENT-AGREEMENT.md): A4, the terms' markup (title, heading, bullet,
 * **bold**), page numbers, and a last block with the studio's side printed as
 * signed and room for the client's eSign. Standard Helvetica, so the text is
 * made PDF-safe first (rules.ts `pdfSafe`: "₹" prints as "Rs.").
 *
 * Pure apart from pdf-lib: the bytes come back; storing them is the store's.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { boldSegments, parseTerms } from '@/modules/studio-quote/document';
import { pdfSafe } from './rules';

const A4 = { w: 595.28, h: 841.89 };
const M = { top: 64, bottom: 64, side: 62 };
const SIZE = { title: 15, heading: 11, body: 10 };
const LEAD = 1.45;
const INK = rgb(0.1, 0.1, 0.1);
const SOFT = rgb(0.4, 0.4, 0.4);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** A run of words, each with its font; `glued`: no space before it ("**Limited**," keeps its comma). */
type Word = { text: string; bold: boolean; glued: boolean };

function wordsOf(line: string, allBold = false): Word[] {
  const out: Word[] = [];
  let spaceBefore = true;
  boldSegments(line).forEach((seg, i) => {
    for (const part of seg.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        spaceBefore = true;
        continue;
      }
      out.push({ text: part, bold: allBold || i % 2 === 1, glued: out.length > 0 && !spaceBefore });
      spaceBefore = false;
    }
  });
  return out;
}

/** Words wrapped to `width`, as lines of words. */
function wrap(words: Word[], fonts: Fonts, size: number, width: number): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let used = 0;
  const space = fonts.regular.widthOfTextAtSize(' ', size);
  for (const w of words) {
    const wl = (w.bold ? fonts.bold : fonts.regular).widthOfTextAtSize(w.text, size);
    if (line.length > 0 && used + space + wl > width) {
      lines.push(line);
      line = [];
      used = 0;
    }
    used += (line.length && !w.glued ? space : 0) + wl;
    line.push(w);
  }
  if (line.length) lines.push(line);
  return lines;
}

export interface AgreementPdfInput {
  text: string;
  studioName: string;
  signatory: string;
  signatoryRole: string | null;
  clientName: string;
  date: string;
}

export async function buildAgreementPdf(input: AgreementPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`Agreement — ${input.clientName}`));
  doc.setAuthor(pdfSafe(input.studioName));
  const fonts: Fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const width = A4.w - M.side * 2;
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M.top;

  const ensure = (h: number) => {
    if (y - h < M.bottom) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M.top;
    }
  };

  const drawLines = (lines: Word[][], size: number, x: number, opts: { center?: boolean } = {}) => {
    const space = fonts.regular.widthOfTextAtSize(' ', size);
    for (const line of lines) {
      ensure(size * LEAD);
      const total = line.reduce((n, w, i) => n + (w.bold ? fonts.bold : fonts.regular).widthOfTextAtSize(w.text, size) + (i && !w.glued ? space : 0), 0);
      let cx = opts.center ? (A4.w - total) / 2 : x;
      y -= size * LEAD;
      line.forEach((w, i) => {
        const f = w.bold ? fonts.bold : fonts.regular;
        if (i > 0 && !w.glued) cx += space;
        page.drawText(w.text, { x: cx, y, size, font: f, color: INK });
        cx += f.widthOfTextAtSize(w.text, size);
      });
    }
  };

  for (const b of parseTerms(pdfSafe(input.text))) {
    if (b.kind === 'gap') {
      y -= SIZE.body * 0.6;
      continue;
    }
    if (b.kind === 'title') {
      y -= 6;
      drawLines(wrap(wordsOf(b.text, true), fonts, SIZE.title, width), SIZE.title, M.side, { center: true });
      y -= 8;
      continue;
    }
    if (b.kind === 'heading') {
      ensure(SIZE.heading * LEAD * 3);
      y -= 8;
      drawLines(wrap(wordsOf(b.text, true), fonts, SIZE.heading, width), SIZE.heading, M.side);
      page.drawLine({ start: { x: M.side, y: y - 3 }, end: { x: A4.w - M.side, y: y - 3 }, thickness: 0.5, color: SOFT });
      y -= 6;
      continue;
    }
    if (b.kind === 'bullet') {
      /* A lettered point ("(a) …", "A. …") hangs on its own letter, not a bullet. */
      const label = /^(\([a-zA-Z0-9]{1,4}\)|[A-Z0-9]{1,3}\.)\s+(.+)$/.exec(b.text);
      const indent = b.sub ? 34 : 16;
      const hang = label ? 22 : 10;
      const lines = wrap(wordsOf(label ? label[2]! : b.text), fonts, SIZE.body, width - indent - hang);
      ensure(SIZE.body * LEAD);
      page.drawText(label ? label[1]! : b.sub ? '-' : '•', { x: M.side + indent - (label ? 10 : 10), y: y - SIZE.body * LEAD, size: SIZE.body, font: fonts.regular, color: INK });
      drawLines(lines, SIZE.body, M.side + indent + (label ? hang - 10 : 0));
      y -= 3;
      continue;
    }
    drawLines(wrap(wordsOf(b.text), fonts, SIZE.body, width), SIZE.body, M.side);
    y -= 4;
  }

  /* The signatures: the studio's printed as signed, the client's left for the eSign. */
  ensure(150);
  y -= 24;
  const colW = width / 2 - 10;
  const top = y;
  const block = (x: number, lines: [string, boolean][]) => {
    let by = top;
    for (const [t, bold] of lines) {
      by -= SIZE.body * LEAD;
      page.drawText(pdfSafe(t), { x, y: by, size: SIZE.body, font: bold ? fonts.bold : fonts.regular, color: INK, maxWidth: colW });
    }
    return by;
  };
  const a = block(M.side, [
    [`For ${input.studioName}`, true],
    [`Signed: ${input.signatory}`, false],
    [input.signatoryRole ? `Designation: ${input.signatoryRole}` : '', false],
    [`Date: ${input.date}`, false],
  ]);
  const b = block(M.side + width / 2 + 10, [
    ['Client', true],
    [input.clientName, false],
    ['Signed electronically with Aadhaar eSign', false],
  ]);
  y = Math.min(a, b) - 60;

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: A4.w - M.side - fonts.regular.widthOfTextAtSize(label, 8), y: 30, size: 8, font: fonts.regular, color: SOFT });
    p.drawText(pdfSafe(input.studioName), { x: M.side, y: 30, size: 8, font: fonts.regular, color: SOFT });
  });
  return doc.save();
}
