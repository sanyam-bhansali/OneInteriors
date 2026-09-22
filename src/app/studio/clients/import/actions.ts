'use server';

import { revalidatePath } from 'next/cache';
import { importClients } from '@/modules/studio-practice/clients';
import { parseCsv, planImport, type ColumnKey } from '@/modules/studio-practice/csv';
import { setFormActive } from '@/modules/studio-practice/capture';

/**
 * Writing an import.
 *
 * ## Why this takes the file text, not the rows
 *
 * The obvious design is for the browser to run `planImport`, show the plan,
 * and post the agreed rows. It would work and it would be wrong: a server
 * action is a public endpoint, so "the rows the browser sent" means anybody
 * can write whatever they like into this studio's client list — names, notes,
 * five thousand of them — without ever seeing the mapping screen.
 *
 * So the browser sends what the person actually chose: the file, and which
 * column is which. The server parses and plans it again, with the same pure
 * functions, and writes only what those produce. The preview the person
 * agreed to and the rows that get written come from one piece of code, which
 * also means the preview cannot drift from the result.
 *
 * The cost is parsing twice. On a few thousand rows that is a few
 * milliseconds, and it buys the guarantee that nothing reaches the database
 * that the normalising did not produce.
 */

export type ImportState =
  | { idle: true }
  | { ok: true; written: number; alreadyHere: number; skippedNoName: number; duplicatesInFile: number }
  | { ok: false; error: string };

/**
 * Only the action itself is exported as a value from here.
 *
 * A `'use server'` file is meant to export async functions and nothing else —
 * every other export becomes a remote endpoint. The idle state is an object,
 * so it lives with the component that needs it. (The older `actions.ts` files
 * in this folder still export an `IDLE` constant; worth tidying, but not in
 * this change.)
 */

/** Above this the server action body limit rejects the request anyway. */
const MAX_CHARS = 900_000;

const KEYS: ColumnKey[] = [
  'name', 'phone', 'email', 'society', 'locality', 'config', 'notes', 'skip',
];

export async function importCsvAction(text: string, mapping: string[]): Promise<ImportState> {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'No file.' };
  }
  if (text.length > MAX_CHARS) {
    return { ok: false, error: 'That file is too large to send in one go. Split it in half.' };
  }
  if (!Array.isArray(mapping)) {
    return { ok: false, error: 'Something went wrong reading the columns. Start again.' };
  }

  // Anything unrecognised becomes `skip` rather than an error: a column key
  // this build does not know is a column that should not be written.
  const clean: ColumnKey[] = mapping.map((m) => (KEYS.includes(m as ColumnKey) ? (m as ColumnKey) : 'skip'));

  if (!clean.includes('name')) {
    return { ok: false, error: 'Nothing is mapped to Name, so there is nobody to import.' };
  }

  const plan = planImport(parseCsv(text), clean);
  if (plan.rows.length === 0) {
    return { ok: false, error: 'No rows have a usable name.' };
  }

  const result = await importClients(plan.rows);
  if (!result.ok) return result;

  revalidatePath('/studio/clients');
  revalidatePath('/studio');

  return {
    ok: true,
    written: result.written,
    alreadyHere: result.alreadyHere,
    skippedNoName: plan.skippedNoName,
    duplicatesInFile: plan.duplicatesInFile,
  };
}

/**
 * Turn the public enquiry form on or off.
 *
 * Lives beside the import action because the control lives on the import
 * page — both are "how a lead gets in" — and a studio that pauses the form
 * has done so deliberately, so there is nothing to confirm.
 */
export async function setFormActiveAction(active: boolean): Promise<{ ok: boolean }> {
  const result = await setFormActive(active);
  if (result.ok) revalidatePath('/studio/clients/import');
  return result;
}
