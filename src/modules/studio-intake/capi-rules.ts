/**
 * Telling Meta which lead-ad leads turned into customers (owner, 22 Oct 2026;
 * docs/studio-os/LEAD-INTAKE.md, "Meta conversion feedback"): which column
 * sends which event, and whether a studio is set up at all.
 *
 * Pure, no `server-only` and no crypto (the settings screen imports the
 * event list), tested in tests/studio-capi.test.ts. The payload and the
 * hashing are `capi-payload.ts`; the outbox is `studio-sales/conversions.ts`.
 *
 * ## Meta's "conversion leads" integration
 *
 * A CRM tells Meta, per lead, how far it got, with the leadgen id Meta gave
 * it. Meta then optimises the lead ads for people who become customers, not
 * people who fill forms. The event names are the CRM's own stages; AxLeads
 * sent Lead, Contacted, Interested, DemoCompleted, Purchase and LeadLost off
 * stage semantics (lib/meta/capi.ts). We send fewer, and only the ones that
 * mean something for an interiors studio:
 *
 *  - **Contacted** — off by default. Every lead gets called; telling Meta so
 *    teaches it nothing.
 *  - **QualifiedLead** — the column the owner marks as "qualified"
 *    (Hauspire's Effective Lead, or an office meeting booked). Off until the
 *    owner picks a column for it: "easy, not automatic".
 *  - **ConvertedLead** — a WON column (booked) and a DONE one (handed over):
 *    on by default when the switch is on, because that is the whole point.
 *    Not Meta's standard `Purchase`, which demands a value and currency we
 *    would have to invent from a budget.
 *
 * Each event at most once per lead (the outbox is unique on lead and event),
 * so a card dragged back and forth tells Meta once.
 *
 * ## The dataset and the token are never stored here
 *
 * `STUDIO_META_CAPI` (env, pasted by the owner into Vercel):
 * `{ "<studio slug>": { "datasetId": "<digits>", "token": "<system user token>",
 * "testEventCode": "TEST123" } }`. `testEventCode` is optional, for Events
 * Manager → Test events; remove it once events show there. Unreadable or
 * missing means "not set up": the switch says so and nothing is sent.
 */

export type CapiEventName = 'Contacted' | 'QualifiedLead' | 'ConvertedLead';

export const CAPI_EVENTS: readonly { name: CapiEventName; label: string }[] = [
  { name: 'Contacted', label: 'Contacted' },
  { name: 'QualifiedLead', label: 'Qualified lead' },
  { name: 'ConvertedLead', label: 'Customer (converted)' },
];

const isEvent = (v: unknown): v is CapiEventName => typeof v === 'string' && CAPI_EVENTS.some((e) => e.name === v);

export type StageKindName = 'OPEN' | 'WON' | 'DONE' | 'LOST';

/** Per column: the event, or null for none. A column not listed reads its default. */
export type CapiStageMap = Record<string, CapiEventName | null>;

/** The default for a column nobody has chosen for: booked or handed over is a customer; nothing else sends. */
export function defaultEventFor(kind: StageKindName): CapiEventName | null {
  return kind === 'WON' || kind === 'DONE' ? 'ConvertedLead' : null;
}

/** `Studio.metaCapiStages`, `{ v: 1, stages: { [stageId]: event | null } }`, repaired: anything else is empty. */
export function readCapiStages(json: unknown): CapiStageMap {
  const out: CapiStageMap = {};
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out;
  const stages = (json as { stages?: unknown }).stages;
  if (!stages || typeof stages !== 'object' || Array.isArray(stages)) return out;
  for (const [id, v] of Object.entries(stages as Record<string, unknown>)) {
    if (!id || id.length > 64) continue;
    if (v === null) out[id] = null;
    else if (isEvent(v)) out[id] = v;
  }
  return out;
}

/** The event a move INTO this column sends, or null. */
export function eventForStage(stage: { id: string; kind: StageKindName }, map: CapiStageMap): CapiEventName | null {
  if (Object.prototype.hasOwnProperty.call(map, stage.id)) return map[stage.id] ?? null;
  return defaultEventFor(stage.kind);
}

/**
 * What the owner picked, for the studio's columns only, as it is stored.
 * A choice equal to the default is still stored (it is what the owner said).
 */
export function cleanCapiStages(input: unknown, stages: readonly { id: string; kind: StageKindName }[]): { v: 1; stages: CapiStageMap } {
  const picked = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const out: CapiStageMap = {};
  for (const s of stages) {
    if (!Object.prototype.hasOwnProperty.call(picked, s.id)) continue;
    const v = picked[s.id];
    if (v === null || v === '' || v === 'NONE') out[s.id] = null;
    else if (isEvent(v)) out[s.id] = v;
  }
  return { v: 1, stages: out };
}

export interface CapiConfig {
  datasetId: string;
  token: string;
  testEventCode: string | null;
}

/** Meta's dataset (pixel) ids are digits. */
const isDatasetId = (v: unknown): v is string => typeof v === 'string' && /^\d{5,32}$/.test(v);

/** This studio's dataset and token from `STUDIO_META_CAPI`, or null. Never throws (CONTRIBUTING §8). */
export function parseCapiConfig(raw: string | null | undefined, slug: string): CapiConfig | null {
  const v = raw?.trim();
  if (!v || !slug) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const entry = (parsed as Record<string, unknown>)[slug];
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as { datasetId?: unknown; token?: unknown; testEventCode?: unknown };
  const datasetId = typeof e.datasetId === 'number' ? String(e.datasetId) : e.datasetId;
  if (!isDatasetId(datasetId)) return null;
  if (typeof e.token !== 'string' || e.token.trim().length < 10) return null;
  const test = typeof e.testEventCode === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(e.testEventCode.trim()) ? e.testEventCode.trim() : null;
  return { datasetId, token: e.token.trim(), testEventCode: test };
}

/** Five tries in all: the first in `after()`, then one a day. */
export const MAX_ATTEMPTS = 5;

export type ConversionStatusName = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';

/** Whether a row is still to be sent (now, or by the daily retry). */
export function stillToSend(row: { status: ConversionStatusName; attempts: number }): boolean {
  return (row.status === 'QUEUED' || row.status === 'FAILED') && row.attempts < MAX_ATTEMPTS;
}

/**
 * The events a set of moves should queue: only for a lead that came from a
 * Meta lead ad (it has a leadgen id), only into a column that sends one.
 * The outbox's unique index drops a repeat.
 */
export function eventsForMoves(
  moves: readonly { clientId: string; toStageId: string }[],
  leads: ReadonlyMap<string, { leadgenId: string | null }>,
  stages: ReadonlyMap<string, StageKindName>,
  map: CapiStageMap,
): { clientId: string; stageId: string; eventName: CapiEventName }[] {
  const out: { clientId: string; stageId: string; eventName: CapiEventName }[] = [];
  const seen = new Set<string>();
  for (const m of moves) {
    const lead = leads.get(m.clientId);
    if (!lead?.leadgenId) continue;
    const kind = stages.get(m.toStageId);
    if (!kind) continue;
    const eventName = eventForStage({ id: m.toStageId, kind }, map);
    if (!eventName) continue;
    const key = `${m.clientId}:${eventName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ clientId: m.clientId, stageId: m.toStageId, eventName });
  }
  return out;
}
