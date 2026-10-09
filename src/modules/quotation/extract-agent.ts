import 'server-only';

/**
 * Reading a studio's own quotations, automatically.
 *
 * ## What this replaces
 *
 * `scripts/read-quotations.py` extracts line items from the one workbook
 * layout we have seen most of. Everything else — a PDF export, a scan, a
 * studio whose template nobody has met — needed a person. This reads the
 * documents as documents, so the format stops being the constraint.
 *
 * `ingest.ts` is unchanged and still does the actual work: mapping the
 * studio's wording onto our catalogue, summing split lines, taking medians.
 * This module only turns files into the rows that function already accepts.
 * The arithmetic that decides a price stays in the pure, tested module, which
 * is the whole reason that split exists.
 *
 * ## What keeps it honest
 *
 * 1. **Nothing it produces reaches a customer.** Rates land as PENDING and a
 *    person approves them against the documents. A number read out of a PDF
 *    is evidence, not a price.
 * 2. **Every line is machine-checked** — see `extract-schema.ts`. Amounts
 *    outside a believable band, dimensions in the wrong unit and rows that
 *    are really subtotals are discarded and *reported*, never repaired. A
 *    guessed correction is a number nobody can trace to a document.
 * 3. **It degrades to nothing.** With no API key the archive goes to ops by
 *    hand exactly as before. This is a convenience, not a dependency.
 * 4. **It never writes a rate itself.** It returns rows. `filed-rates.ts`
 *    (the store) decides what becomes of them.
 *
 * ## What leaves our infrastructure, which is the part to be deliberate about
 *
 * The documents go to Anthropic whole. That is a considered choice and not an
 * accident of implementation: a studio's quotation carries their client's
 * name and the address of the flat, and sending only stripped line items
 * would have been the more conservative build. Whole documents extract far
 * more reliably from the layouts studios actually use, and the decision was
 * taken knowingly.
 *
 * Two things follow and neither is optional. The studio is told, in the
 * consent copy on the upload control, that their files are read by an
 * external service. And no request from here is ever logged with its content
 * — see `redactedError`.
 *
 * Called directly over HTTPS rather than through the SDK: one request, one
 * shape, one less package to keep patched. Same as `portfolio-agent.ts`.
 */

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hasAnthropic, anthropicModel, supabaseConfig } from '@/lib/env';
import { checkExtraction, type ExtractCheck } from './extract-schema';
import { ROOMS } from './catalogue';
import { MAX_WORKBOOK_CHARS, readWorkbook, spreadsheetKind, workbookText } from './workbook';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * Per batch, not per archive. Twenty documents in one request is a large
 * prompt and a long wait; a failure at the end loses all of it.
 */
const FILES_PER_REQUEST = 4;

/**
 * How much base64 one request may carry.
 *
 * Four files was the only limit, and four files is not a size: the cap on an
 * upload is 25 MB each, so a batch could reach 100 MB of bytes — about 133 MB
 * once base64 has added its third — held in one serverless invocation, on top
 * of whatever the request body builder copies. That is a memory ceiling
 * somebody discovers in production, on the largest archive, which is the one
 * most worth reading.
 *
 * 18 MB of encoded data per request keeps a batch comfortably inside a normal
 * function's memory and inside the model's own request limits. A single file
 * larger than this still goes on its own — see the loop.
 */
const MAX_BATCH_BASE64 = 18 * 1024 * 1024;

/** An archive accumulates across uploads, so the read needs a ceiling too. */
const MAX_FILES_PER_ARCHIVE = 120;

/** Long, because these are multi-page documents and the reply is long. */
const TIMEOUT_MS = 180_000;
const MAX_TOKENS = 8000;

/** What the private bucket calls itself. Mirrors quotation-archive.ts. */
const BUCKET = 'quotation-archives';

/**
 * What we can send as a document.
 *
 * PDFs and images as themselves. Workbooks (.xlsx, .xlsm) and CSVs are not
 * something the API reads, so they go as their rows in text — see
 * `workbook.ts` and `canRead` below. Old binary .xls still goes to ops.
 */
const SENDABLE = new Map<string, 'pdf' | 'image'>([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['image/webp', 'image'],
]);

/**
 * The system prompt.
 *
 * Written as constraints rather than encouragement, the same way the
 * portfolio agent's is. "Be accurate" is not something a model can check
 * itself against; "copy the product text exactly as printed" is.
 *
 * The most important instruction is the one about totals. Every quotation has
 * subtotals, a grand total, tax lines and discounts, and every one of them
 * looks exactly like a line item to something reading row by row. A grand
 * total admitted as a line does not merely add noise — it moves the median it
 * lands in further than fifty small errors would.
 */
function systemPrompt(): string {
  return [
    'You read interior-design quotations from studios in Pune, India, and return their line items as structured data. Your output is checked by a person before it is used.',
    '',
    'ABSOLUTE RULES:',
    '1. Report ONLY what is printed. Never infer, complete, average or tidy a number. If a cell is unreadable, omit that line rather than guessing it.',
    '2. NEVER report a subtotal, section total, grand total, tax line, discount, or "say" rounding as a line item. These are the most common thing to get wrong and the most damaging. A row whose amount is close to the sum of the rows above it is a total.',
    '3. Copy the product text EXACTLY as printed, including the studio\'s own spelling and punctuation. Do not normalise "Storage- Shoe Rack" into "Shoe rack". The exact wording is used to recognise the item.',
    '4. Amounts are the LINE amount in rupees, not per-unit rates and not including tax. If a row shows a rate and a quantity and an amount, report the amount.',
    '5. Dimensions in millimetres. If the document gives feet or inches, convert; if it gives no dimensions, use null. Never invent a size.',
    '6. Some documents are spreadsheets sent as text rows, cells separated by " | ". Read the header row to find which column is the amount, which the rate, which the quantity; the same rules apply.',
    '7. If a document is not a quotation — a floor plan, an invoice, a contract, a brochure — return it with an empty lines array. Do not extract from it.',
    '',
    `Rooms must be one of: ${ROOMS.join(', ')}, or null when the document does not group by room. The room a line sits under changes what the item means, so preserve the grouping exactly; do not assign a room from the product name.`,
    '',
    'Reply with JSON only, no markdown fence, no commentary. An array, one entry per document, in the order given:',
    '[{"reference": string, "bhk": number|null, "dated": "YYYY-MM-DD"|null, "lines": [{"room": string|null, "product": string, "workCode": string|null, "details": string|null, "widthMm": number|null, "heightMm": number|null, "amountRupees": number}]}]',
    '',
    '"details" is the studio\'s own description of the material, verbatim — "18mm BWP ply with laminate". It is the column that makes two quotes comparable on something other than price, so copy it whenever the document has one.',
  ].join('\n');
}

/**
 * Where a read has got to, kept on the archive between presses.
 *
 * ## Why a read is now many small requests instead of one long one
 *
 * The whole archive used to be read inside one `after()` on the upload
 * request. Eighty files is twenty sequential calls of up to three minutes
 * each, and a serverless function is stopped long before that — so the
 * archive sat at READING for ever, nothing was filed, and every byte sent up
 * to that point was paid for and thrown away.
 *
 * Now each call reads ONE batch (at most `FILES_PER_REQUEST` files, one API
 * request) and stores what came back here. Ops drives it from the archive
 * screen, batch after batch, and can stop at any point without losing what
 * was read. A function that dies mid-batch loses one batch, not the archive.
 *
 * `docs` holds the raw per-document replies; `checkExtraction` runs once over
 * all of them at the end, exactly as it did over a single read before.
 */
export interface ReadProgress {
  /** Index into the archive's files, in upload order. */
  cursor: number;
  docs: unknown[];
  skipped: string[];
  /** SHA-256 of every file already read, so a re-sent copy is not paid for twice. */
  hashes: string[];
  filesRead: number;
}

export const EMPTY_PROGRESS: ReadProgress = { cursor: 0, docs: [], skipped: [], hashes: [], filesRead: 0 };

export type ChunkResult =
  | { ok: true; done: false; progress: ReadProgress; total: number }
  | {
      ok: true;
      done: true;
      progress: ReadProgress;
      total: number;
      check: ExtractCheck;
    }
  | { ok: false; error: string };

/**
 * Read the next batch of an archive.
 *
 * Takes the progress so far and returns the progress after one more batch.
 * It never reads more than one batch per call — that is the entire point —
 * and it never writes anything itself; the store decides what to keep.
 */
export async function readNextBatch(archiveId: string, before: ReadProgress): Promise<ChunkResult> {
  if (!hasAnthropic()) {
    return { ok: false, error: 'No API key on this deployment. The archive goes to ops by hand.' };
  }
  const config = supabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !key) {
    return { ok: false, error: 'Storage is not configured, so the files cannot be read.' };
  }

  const files = await prisma.quotationFile.findMany({
    where: { archiveId },
    orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
    take: MAX_FILES_PER_ARCHIVE,
  });
  if (files.length === 0) return { ok: false, error: 'This archive has no files.' };

  const progress: ReadProgress = {
    cursor: before.cursor,
    docs: [...before.docs],
    skipped: [...before.skipped],
    hashes: [...before.hashes],
    filesRead: before.filesRead,
  };
  const seen = new Set(progress.hashes);

  const canRead = (f: { contentType: string; filename: string }) =>
    SENDABLE.has(f.contentType) || spreadsheetKind(f.contentType, f.filename) !== null;

  const blocks: unknown[] = [];
  const inBatch: string[] = [];
  let batchBytes = 0;

  while (progress.cursor < files.length && inBatch.length < FILES_PER_REQUEST) {
    const file = files[progress.cursor]!;

    if (!canRead(file)) {
      progress.skipped.push(`${file.filename} — not a PDF, an image or an .xlsx/.csv, so it goes to ops by hand.`);
      progress.cursor += 1;
      continue;
    }

    const bytes = await download(config.url, key, file.path);
    if (!bytes) {
      progress.skipped.push(`${file.filename} — we could not fetch it back from storage.`);
      progress.cursor += 1;
      continue;
    }

    /* The same document sent twice is read once. Studios re-upload — a
       batch that looked like it failed, a folder picked twice — and every
       copy used to go to the reader and into the medians. */
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (seen.has(hash)) {
      progress.skipped.push(`${file.filename} — the same file was already read, so it was not read again.`);
      progress.cursor += 1;
      continue;
    }

    /* Not the first file and it would push this batch over: leave it for
       the next press. The cursor is deliberately not advanced. */
    if (inBatch.length > 0 && batchBytes + bytes.length > MAX_BATCH_BASE64) break;

    const sheet = SENDABLE.has(file.contentType) ? null : spreadsheetKind(file.contentType, file.filename);
    if (sheet) {
      const raw = Buffer.from(bytes, 'base64');
      const rows = sheet === 'csv' ? raw.toString('utf8').slice(0, MAX_WORKBOOK_CHARS) : null;
      const sheets = sheet === 'xlsx' ? readWorkbook(raw) : null;
      const text = rows ?? (sheets && sheets.length > 0 ? workbookText(sheets) : null);
      if (!text) {
        progress.skipped.push(`${file.filename} — we could not open this workbook. Ops will read it by hand.`);
        progress.cursor += 1;
        continue;
      }
      blocks.push({
        type: 'text',
        text: `A spreadsheet quotation follows, one row per line, cells separated by " | ".\n\n${text}`,
      });
    } else {
      const kind = SENDABLE.get(file.contentType)!;
      blocks.push({
        type: kind === 'pdf' ? 'document' : 'image',
        source: { type: 'base64', media_type: file.contentType, data: bytes },
      });
    }
    /* Named, so a line can be traced back to the document it came from. */
    blocks.push({ type: 'text', text: `Document reference: ${file.filename}` });

    seen.add(hash);
    progress.hashes.push(hash);
    batchBytes += bytes.length;
    inBatch.push(file.filename);
    progress.cursor += 1;
  }

  if (blocks.length > 0) {
    const batchResult = await callOnce(blocks);
    if (!batchResult.ok) {
      progress.skipped.push(`${inBatch.length} document(s) could not be read: ${batchResult.error}`);
    } else {
      if (Array.isArray(batchResult.parsed)) progress.docs.push(...batchResult.parsed);
      progress.filesRead += inBatch.length;
    }
  }

  const total = files.length;
  if (progress.cursor < total) return { ok: true, done: false, progress, total };

  return { ok: true, done: true, progress, total, check: checkExtraction(progress.docs) };
}

async function callOnce(
  blocks: unknown[],
): Promise<{ ok: true; parsed: unknown } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!.trim(),
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: anthropicModel(),
        max_tokens: MAX_TOKENS,
        system: systemPrompt(),
        messages: [{ role: 'user', content: blocks }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      /* The status and nothing else. A body from this endpoint can echo the
         request, and the request is somebody's client list. */
      return { ok: false, error: `the reader returned ${response.status}` };
    }

    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
    return { ok: true, parsed: parseJson(text) };
  } catch (error) {
    return { ok: false, error: redactedError(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function download(url: string, key: string, path: string): Promise<string | null> {
  try {
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch {
    return null;
  }
}

/**
 * Tolerate a fence, refuse anything else.
 *
 * The prompt asks for bare JSON and models mostly comply; a ```json wrapper
 * is the one deviation common enough to be worth handling. Anything beyond
 * that is a reply we did not ask for, and salvaging it by hunting for the
 * first `[` is how a truncated response becomes half an archive nobody
 * noticed was half.
 */
function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * An error safe to store.
 *
 * `analysisError` is read by ops and could be read by anybody with database
 * access, and a fetch failure can carry a URL with a signed storage path in
 * it. Names only.
 */
function redactedError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'the reader timed out';
    return error.name;
  }
  return 'an unknown failure';
}
