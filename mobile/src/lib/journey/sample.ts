import { MATCHES_SAMPLES } from './matches.sample';
import { QUOTE_SAMPLES } from './quote.sample';
import { CHOOSE_SAMPLES } from './choose.sample';

/**
 * The sample customer's first visit, answered per area so each part of the
 * journey keeps its own fixture (docs/app-handover/SAMPLE-DATA.md). Only a
 * test build (EXPO_PUBLIC_SAMPLE=1) reads these.
 */
export interface SampleHandler {
  /** True for a route like "POST /journey/matches" this file answers. */
  match: (route: string) => boolean;
  answer: (route: string, body: unknown) => unknown;
}

export const SAMPLE_JOURNEY: SampleHandler[] = [...MATCHES_SAMPLES, ...QUOTE_SAMPLES, ...CHOOSE_SAMPLES];
