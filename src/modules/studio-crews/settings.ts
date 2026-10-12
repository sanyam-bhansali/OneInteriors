/**
 * A studio's crew settings (`Studio.crewSettings`, Settings → Crews and
 * trades, owner): its trades, its own routing rows, rate templates per trade,
 * the due days on a new work order, the labour-margin target, how far an
 * advance may run ahead of a bill, the installation rate, and which execution
 * steps wait for which client payment. Pure, tested in
 * tests/studio-crews-settings.test.ts.
 *
 * Read with `readCrewSettings`, which repairs anything bad to Hauspire's
 * defaults field by field (a broken trade list never empties the routing),
 * and saved through `checkCrewSettings`, which says what is wrong in words.
 */

import { DEFAULT_TEMPLATES, DEFAULT_TRADES, INSTALL_RATE_PAISE, isCrewUnit, tradeKeyFor, type RouteRule, type TemplateItem, type Trade } from './trades';
import { DEFAULT_EXEC_GATES, type ExecGateRule } from './exec-gates';

export interface CrewSettings {
  trades: Trade[];
  routes: RouteRule[];
  useHauspire: boolean;
  templates: Record<string, TemplateItem[]>;
  /** Days from raising a work order to paying it (Hauspire: 45). */
  dueDays: number;
  /** Warn the owner when a project's labour margin falls below this percent of the contract. */
  labourTargetPct: number;
  /** How far an advance may run ahead of a work order's bill, paise. */
  advanceLimitPaise: number;
  /** Installation-only carpentry, per sq ft, when a crew's card has no rate (Hauspire: ₹150). */
  installRatePaise: number;
  execGates: ExecGateRule[];
}

export const DEFAULTS: CrewSettings = {
  trades: DEFAULT_TRADES.map((t) => ({ ...t })),
  routes: [],
  useHauspire: true,
  templates: Object.fromEntries(Object.entries(DEFAULT_TEMPLATES).map(([k, v]) => [k, v.map((i) => ({ ...i }))])),
  dueDays: 45,
  labourTargetPct: 25,
  advanceLimitPaise: 2_500_000,
  installRatePaise: INSTALL_RATE_PAISE,
  execGates: DEFAULT_EXEC_GATES.map((g) => ({ ...g })),
};

export const LIMITS = { trades: 30, routes: 300, templateItems: 40, label: 40, text: 80, item: 80, dueDaysMax: 365, gates: 12 } as const;

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

function readTrades(v: unknown): Trade[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: Trade[] = [];
  for (const raw of v.slice(0, LIMITS.trades)) {
    const o = obj(raw);
    const key = str(o?.key, 40);
    const label = str(o?.label, LIMITS.label);
    if (!key || !/^[a-z0-9_]+$/.test(key) || !label || out.some((t) => t.key === key)) continue;
    out.push({ key, label, active: o?.active !== false, ...(o?.invoice === true ? { invoice: true } : {}) });
  }
  return out.length ? out : null;
}

function readRoutes(v: unknown, keys: readonly string[]): RouteRule[] {
  if (!Array.isArray(v)) return [];
  const out: RouteRule[] = [];
  for (const raw of v.slice(0, LIMITS.routes)) {
    const o = obj(raw);
    const text = str(o?.text, LIMITS.text);
    const trade = str(o?.trade, 40);
    const match = o?.match === 'keyword' ? 'keyword' : 'exact';
    if (text && keys.includes(trade)) out.push({ match, text, trade });
  }
  return out;
}

function readTemplates(v: unknown, keys: readonly string[]): Record<string, TemplateItem[]> | null {
  const o = obj(v);
  if (!o) return null;
  const out: Record<string, TemplateItem[]> = {};
  for (const k of keys) {
    const list = o[k];
    if (!Array.isArray(list)) continue;
    out[k] = list
      .slice(0, LIMITS.templateItems)
      .map((raw) => {
        const r = obj(raw);
        const item = str(r?.item, LIMITS.item);
        const unit = isCrewUnit(r?.unit) ? r!.unit : 'SQFT';
        const rate = int(r?.ratePaise, 1, 1_000_000_000);
        return item ? { item, unit, ratePaise: rate } : null;
      })
      .filter((x): x is TemplateItem => x !== null);
  }
  return out;
}

function readGates(v: unknown): ExecGateRule[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .slice(0, LIMITS.gates)
    .map((raw) => {
      const o = obj(raw);
      const step = str(o?.step, LIMITS.text);
      const payment = str(o?.payment, LIMITS.text);
      return step && payment ? { step, payment } : null;
    })
    .filter((x): x is ExecGateRule => x !== null);
}

/** The settings as stored, repaired field by field to Hauspire's defaults. Never throws. */
export function readCrewSettings(raw: unknown): CrewSettings {
  const o = obj(raw);
  if (!o) return structuredClone(DEFAULTS);
  const trades = readTrades(o.trades) ?? structuredClone(DEFAULTS.trades);
  const keys = trades.map((t) => t.key);
  return {
    trades,
    routes: readRoutes(o.routes, keys),
    useHauspire: o.useHauspire !== false,
    templates: readTemplates(o.templates, keys) ?? structuredClone(DEFAULTS.templates),
    dueDays: int(o.dueDays, 0, LIMITS.dueDaysMax) ?? DEFAULTS.dueDays,
    labourTargetPct: int(o.labourTargetPct, 0, 90) ?? DEFAULTS.labourTargetPct,
    advanceLimitPaise: int(o.advanceLimitPaise, 0, 100_000_000) ?? DEFAULTS.advanceLimitPaise,
    installRatePaise: int(o.installRatePaise, 1, 10_000_000) ?? DEFAULTS.installRatePaise,
    execGates: readGates(o.execGates) ?? structuredClone(DEFAULTS.execGates),
  };
}

/** Labels typed in Settings to trades with keys: existing keys kept, new ones made from the label. */
export function tradesFromForm(rows: readonly { key?: string; label: string; active: boolean }[], current: readonly Trade[]): Trade[] {
  const out: Trade[] = [];
  for (const r of rows) {
    const label = r.label.replace(/\s+/g, ' ').trim().slice(0, LIMITS.label);
    if (!label) continue;
    const existing = r.key ? current.find((t) => t.key === r.key) : undefined;
    const key = existing?.key ?? tradeKeyFor(label, [...current.map((t) => t.key), ...out.map((t) => t.key)]);
    if (out.some((t) => t.key === key)) continue;
    out.push({ key, label, active: r.active, ...(existing?.invoice ? { invoice: true } : {}) });
  }
  return out;
}

/** What is wrong with settings about to be saved, or null. A trade still in use may be switched off, never removed. */
export function checkCrewSettings(s: CrewSettings, inUse: readonly string[]): string | null {
  if (s.trades.length === 0) return 'Keep at least one trade.';
  if (s.trades.length > LIMITS.trades) return `At most ${LIMITS.trades} trades.`;
  const labels = s.trades.map((t) => t.label.toLowerCase());
  if (new Set(labels).size !== labels.length) return 'Two trades have the same name.';
  const keys = s.trades.map((t) => t.key);
  const gone = inUse.find((k) => !keys.includes(k));
  if (gone) return 'A trade that crews or work orders use cannot be removed. Switch it off instead.';
  if (s.routes.some((r) => !keys.includes(r.trade))) return 'A routing row points at a trade that is not on the list.';
  if (!Number.isInteger(s.dueDays) || s.dueDays < 0 || s.dueDays > LIMITS.dueDaysMax) return `Due days are 0 to ${LIMITS.dueDaysMax}.`;
  if (!Number.isInteger(s.labourTargetPct) || s.labourTargetPct < 0 || s.labourTargetPct > 90) return 'The labour target is 0 to 90 percent.';
  if (s.installRatePaise <= 0) return 'The installation rate has to be more than nothing.';
  if (s.advanceLimitPaise < 0) return 'The advance limit cannot be below nothing.';
  return null;
}
