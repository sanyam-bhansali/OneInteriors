/**
 * What one GEIO answer cost, in paise, from the token counts the model's API
 * returns. Pure, so the arithmetic is tested.
 *
 * Prices are US dollars per million tokens. An unknown model is priced at the
 * dearest rate we use, so a misconfigured model trips the monthly cap early
 * rather than late.
 */

export const GEIO_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/** Rupees per dollar, rounded up so the cap errs on the side of spending less. */
export const USD_INR = 90;

interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const HAIKU_45: Price = { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 };
const DEAREST: Price = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 };

export function priceFor(model: string): Price {
  return model.startsWith('claude-haiku-4-5') ? HAIKU_45 : DEAREST;
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function costPaise(model: string, usage: Usage): number {
  const p = priceFor(model);
  const usd =
    ((usage.input_tokens ?? 0) * p.input +
      (usage.output_tokens ?? 0) * p.output +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead) /
    1_000_000;
  return Math.ceil(usd * USD_INR * 100);
}
