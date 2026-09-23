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

import { prisma } from '@/lib/prisma';
import { hasAnthropic, anthropicModel, supabaseConfig } from '@/lib/env';
import { checkExtraction, type ExtractCheck } from './extract-schema';
import { ROOMS } from './catalogue';

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
 * PDFs and images only. A workbook is not something the API reads, and the
 * Python adapter remains the better tool for those — this is the path for
 * everything that adapter cannot open, not a replacement for it.
 */
const SENDABLE = new Map<string, 'pdf' | 'image'>([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['image/webp', 'image'],
]);

export type ExtractResult =
  | { ok: true; check: ExtractCheck; filesRead: number; filesSkipped: string[] }
  | { ok: false; error: string };

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
    '6. If a document is not a quotation — a floor plan, an invoice, a contract, a brochure — return it with an empty lines array. Do not extract from it.',
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
 * Read one archive's files.
 *
 * Batched, and the batches are independent: a request that fails loses four
 * documents rather than twenty, and what the others produced is kept. An
 * archive half-read is still worth approving — `fromQuotations` on every rate
 * says how much it rests on, which is exactly the judgement ops is there to
 * make.
 */
export async function extractArchive(archiveId: string): Promise<ExtractResult> {
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
    orderBy: { uploadedAt: 'asc' },
    take: MAX_FILES_PER_ARCHIVE,
  });
  if (files.length === 0) return { ok: false, error: 'This archive has no files.' };

  const sendable = files.filter((f) => SENDABLE.has(f.contentType));
  const skipped = files
    .filter((f) => !SENDABLE.has(f.contentType))
    .map((f) => `${f.filename} — not a PDF or an image, so it goes to ops by hand.`);

  if (sendable.length === 0) {
    return { ok: false, error: 'Nothing here is a PDF or an image. Ops reads these by hand.' };
  }

  const all: unknown[] = [];
  let filesRead = 0;

  /**
   * Batched by BYTES as well as by count, and each batch released before the
   * next is fetched.
   *
   * The count alone said nothing about memory — four 25 MB PDFs is 133 MB of
   * base64 in one invocation. So a batch closes when it reaches either four
   * documents or `MAX_BATCH_BASE64`, and `blocks` goes out of scope at the
   * end of each iteration so the collector can take it before the next
   * download starts.
   *
   * A single file bigger than the budget still goes on its own rather than
   * being skipped: one oversized document is exactly the case where a studio
   * would otherwise never find out why their archive read short.
   */
  let index = 0;
  while (index < sendable.length) {
    const blocks: unknown[] = [];
    const inBatch: string[] = [];
    let batchBytes = 0;

    while (index < sendable.length && inBatch.length < FILES_PER_REQUEST) {
      const file = sendable[index]!;

      const bytes = await download(config.url, key, file.path);
      if (!bytes) {
        skipped.push(`${file.filename} — we could not fetch it back from storage.`);
        index += 1;
        continue;
      }

      /* Over budget and this batch already has something in it: leave the
         file for the next round rather than pushing the batch over. `index`
         is deliberately not advanced. */
      if (inBatch.length > 0 && batchBytes + bytes.length > MAX_BATCH_BASE64) break;

      const kind = SENDABLE.get(file.contentType)!;
      blocks.push({
        type: kind === 'pdf' ? 'document' : 'image',
        source: { type: 'base64', media_type: file.contentType, data: bytes },
      });
      /* The filename travels as the reference, so every extracted quotation
         can be pointed back at the document it came from. Ops approving a
         rate needs to be able to open the thing it was read out of. */
      blocks.push({ type: 'text', text: `Document reference: ${file.filename}` });

      batchBytes += bytes.length;
      inBatch.push(file.filename);
      index += 1;
    }

    if (blocks.length === 0) continue;

    const batchResult = await callOnce(blocks);
    /* Emptied before the next batch is fetched. Without this the previous
       batch's bytes are still reachable while the next one downloads, which
       doubles the peak for no reason. */
    blocks.length = 0;

    if (!batchResult.ok) {
      skipped.push(`${inBatch.length} document(s) could not be read: ${batchResult.error}`);
      continue;
    }
    if (Array.isArray(batchResult.parsed)) all.push(...batchResult.parsed);
    filesRead += inBatch.length;
  }

  if (all.length === 0) {
    return { ok: false, error: 'Nothing readable came back. Ops reads these by hand.' };
  }

  return { ok: true, check: checkExtraction(all), filesRead, filesSkipped: skipped };
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
