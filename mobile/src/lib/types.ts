/**
 * What `/api/app/v1/project` returns (CustomerProject in the website's
 * src/modules/portal/project-store.ts), as it arrives over the wire.
 * Copied, not imported: that module is server-only.
 */

export interface Stage {
  key: string;
  label: string;
  targetOn: string;
  state: 'done' | 'now' | 'next' | 'later';
  late: boolean;
}

export interface DecisionOption {
  name: string;
  note: string;
  extraPaise: number;
  swatch: string | null;
}

export interface Decision {
  id: string;
  title: string;
  why: string;
  dueOn: string;
  daysLeft: number;
  state: 'open' | 'due-soon' | 'overdue' | 'chosen';
  options: DecisionOption[];
  chosenIndex: number | null;
  chosenAt: string | null;
  /** Family votes (read-only in the app for now). Older servers omit it. */
  votes?: { name: string; optionIndex: number; note: string | null; mine: boolean }[];
  /** Phase 5: the options as rows, with a photo and a price change that may be negative. Older servers omit it. */
  choices?: DecisionChoice[];
  /** The option picked, by id. Older servers omit it. */
  pickedOptionId?: string | null;
}

/** One option of a decision as the studio filed it (GST included; never the studio's own cost). */
export interface DecisionChoice {
  id: string;
  label: string;
  detail: string | null;
  /** A signed link to the option's photo, or null. */
  photo: string | null;
  swatch: string | null;
  /** What picking it adds (negative: takes off), in paise. 0 = as quoted. */
  deltaPaise: number;
}

export interface Snag {
  id: string;
  title: string;
  room: string | null;
  note: string | null;
  status: 'OPEN' | 'FIXED';
  line: string | null;
  raisedAt: string;
  raisedByStudio: boolean;
  photos: string[];
  fixedNote: string | null;
  fixedPhotos: string[];
  /** Phase 4: where the snag is, from its events (the server's portal/snag-view.ts). Older servers omit it. */
  progress?: SnagProgress;
}

/**
 * A snag's progress. Only the customer closes a snag: they Confirm the fix
 * (or say Not fixed), or it closes by itself seven days after the fix.
 */
export interface SnagProgress {
  state: 'raised' | 'accepted' | 'disputed' | 'fixed' | 'reopened' | 'closed';
  fixBy: string | null;
  fixedAt: string | null;
  /** The studio's one sentence about the fix. */
  fixSentence: string | null;
  /** Why the studio says it is not a defect, while disputed. */
  studioReason: string | null;
  /** The customer's own words, while reopened. */
  notFixedReason: string | null;
  closedAt: string | null;
  /** `you`: confirmed (or agreed); `auto`: seven days passed after the fix. */
  closedBy: 'you' | 'auto' | null;
  /** While fixed: when it closes by itself if nobody answers. */
  autoClosesOn: string | null;
  daysToFix: number | null;
  /** The owner of the brief, with something to answer. */
  canAnswer: boolean;
}

export interface Update {
  id: string;
  note: string;
  stage: string | null;
  at: string;
  byStudio: boolean;
  photos: string[];
}

export interface Doc {
  id: string;
  kind: 'AGREEMENT' | 'QUOTATION' | 'DRAWINGS' | 'RECEIPT' | 'WARRANTY' | 'OTHER';
  title: string;
  meta: string;
  url: string;
  /** Phase 5: 2 and up for a revised drawing. Older servers omit it. */
  version?: number;
  /** A filed decision outcome opens its decision. */
  decisionId?: string | null;
}

export interface PayStage {
  index: number;
  label: string;
  pct: number | null;
  amountPaise: number;
  dueOn: string | null;
  paidOn: string | null;
  state: 'paid' | 'next' | 'later';
}

export interface Money {
  contractPaise: number;
  paidPaise: number;
  next: PayStage | null;
  laterPaise: number;
  stages: PayStage[];
}

export interface Project {
  id: string;
  /** Basic or Assured; older servers omit it (read as Basic). */
  plan?: 'basic' | 'assured';
  /** The owner chooses and approves; family see everything and vote. Older servers omit it. */
  role?: 'owner' | 'family';
  studio: string;
  startOn: string;
  stages: Stage[];
  phases: { label: string; pct: number }[] | null;
  /** The signed total and its stages in rupees; null on a project started before signing in the app. */
  money: Money | null;
  /** Every option chosen on a decision, and what they add. Optional: older servers do not send it. */
  changes?: { totalPaise: number; items: { decisionId: string; title: string; option: string; extraPaise: number; chosenAt: string | null }[] };
  updates: Update[];
  decisions: Decision[];
  snags: Snag[];
  documents: Doc[];
  /** Phase 5: money from the studio's payment entries, each to confirm. Older servers omit it. */
  payments?: Payments | null;
  /** Phase 5: what the home is made of, with product codes once ordered. Older servers omit it. */
  materials?: Material[];
  /** Stages planned vs actual, the current checklist and moved dates (portal/tracker-view.ts). Older servers omit it; null with no plan. */
  tracker?: Tracker | null;
  /** "Overall · n days late", computed on the server. Older servers omit it. */
  overallLateDays?: number;
  /** "Carpentry · on track": the stage under way; null once handed over. Older servers omit it. */
  stageStatus?: { key: string; label: string; status: 'on-track' | 'late'; lateDays: number } | null;
  /** Phase 2: the daily site log, one entry per day, newest first (portal/site-feed-view.ts). Older servers omit it. */
  siteLogs?: SiteDay[];
  /** Phase 2: working days of the last two weeks with nothing posted by 21:00 IST. Older servers omit it. */
  siteMissedDays?: string[];
}

/** Phase 2: why nobody was on site, as the server names it. */
export type NobodyReason = 'waiting-material' | 'waiting-customer-decision' | 'crew-elsewhere' | 'holiday' | 'customer-asked' | 'other';

/** One post from site: an update, nobody on site, or something added later the same day. */
export interface SiteEntry {
  id: string;
  kind: 'update' | 'nobody' | 'correction';
  postedAt: string;
  reason: NobodyReason | null;
  reasonText: string | null;
  /** Nobody on site only: false when waiting on the customer, or the customer asked. */
  countsAgainstStudio: boolean | null;
  /** The sentence not about any one photo. */
  text: string | null;
  /** Each photo with its own sentence, in the customer's language. `url` is "" when it could not be signed. */
  photos: { url: string; text: string | null; takenAt: string; fromGallery: boolean }[];
  /** First name, work and arrival time only. */
  crew: { name: string; role: string; arrivedAt: string | null }[];
  done: { room: string; label: string }[];
}

export interface SiteDay extends SiteEntry {
  /** The IST day, 'YYYY-MM-DD'. */
  day: string;
  corrections: SiteEntry[];
}

export type DelayReason = 'SUPPLIER' | 'CUSTOMER_CHANGE' | 'SITE_CONDITION' | 'STUDIO' | 'OTHER';

/** One stage, planned vs actual. Days are 'YYYY-MM-DD' (India time). */
export interface TrackerStage {
  key: string;
  kind: string;
  label: string;
  plannedStart: string;
  plannedEnd: string;
  /** The end as first planned. */
  originalEnd: string;
  actualEnd: string | null;
  forecastEnd: string;
  state: 'done' | 'now' | 'next' | 'later';
  status: 'done' | 'on-track' | 'late' | 'upcoming';
  lateDays: number;
  earlyDays: number;
  checklist: { done: number; total: number };
  moved: { from: string; to: string; reason: DelayReason; customer: boolean; words: string } | null;
}

/** A moved date: old, new, and why. */
export interface TrackerMove {
  at: string;
  stage: string | null;
  field: 'start' | 'end' | 'handover';
  from: string;
  to: string;
  reason: DelayReason;
  /** The customer's own (a change they asked for, a late decision): not counted against the studio. */
  customer: boolean;
  byDecision: boolean;
  handoverTo: string | null;
  words: string;
}

export interface Tracker {
  stages: TrackerStage[];
  current: { key: string; label: string; rooms: { room: string; items: { label: string; done: boolean }[] }[] } | null;
  moves: TrackerMove[];
  overall: {
    plannedHandover: string | null;
    forecastHandover: string | null;
    handedOver: boolean;
    lateDays: number;
    earlyDays: number;
    customerDays: number;
    studioDays: number;
  };
}

export interface Notice {
  id: string;
  template: string;
  payload: { title?: string; body?: string; url?: string };
  readAt: string | null;
  createdAt: string;
}

export const DOC_KINDS: Record<Doc['kind'], string> = {
  AGREEMENT: 'Agreement',
  QUOTATION: 'Signed quotation',
  DRAWINGS: 'Design drawings',
  RECEIPT: 'Payment receipt',
  WARRANTY: 'Warranty or manual',
  OTHER: 'Other',
};

export const STAGE_SHORT: Record<string, string> = {
  DESIGN: 'Design',
  PRODUCTION: 'Factory',
  SITE: 'Site work',
  INSTALL: 'Install',
  FINISH: 'Finish',
  HANDOVER: 'Handover',
};

/** The customer's home, from their brief (`/api/app/v1/me`). */
export interface Home {
  /** "Flat 1204, Baner"; null when the brief has no address yet. */
  label: string | null;
  locality: string | null;
  bhk: string | null;
  carpetSqft: number | null;
  tier: 'essential' | 'premium' | 'luxury' | null;
  /** Full-home orders only see the 3D view (FLOWS.md). */
  fullHome: boolean;
}

/** The customer's plan (docs/APP-API-JOURNEY.md): Basic is free; Assured is our oversight, GEIO and 5 expert calls. */
export interface PlanInfo {
  plan: 'basic' | 'assured';
  /** They chose Assured; our team confirms the fee before switching them. */
  assuredRequested: boolean;
  expertCalls: { used: number; total: number } | null;
}

export interface Profile {
  /** Null before they sign with a studio. */
  plan: PlanInfo | null;
  home: Home | null;
  coins: { balance: number; streak: number };
  expert: { name: string };
  unread: number;
  locale: 'en' | 'hi' | 'mr';
}

/** GEIO's answer (GeioReply in the website's src/modules/app/geio.ts). */
export interface GeioReply {
  paragraphs: string[];
  see: { what: string; verdict: string; watch: boolean }[];
  /** Set when GEIO hands the question to the expert: what it passes on. */
  handover: string | null;
  follow: string[];
  sources: { line: number; item: string; amount: string; spec: string }[];
}

export interface GeioTurn {
  role: 'user' | 'assistant';
  text: string;
}

// ── Phase 5: payments from entries, and the home's materials ──

/** A payment the studio recorded. `waiting` asks the owner to confirm; `earlier` was recorded before confirmations started and counts as paid. */
export interface PaymentEntry {
  id: string;
  stageIndex: number;
  stage: string;
  amountPaise: number;
  receivedOn: string;
  mode: 'UPI' | 'BANK' | 'CHEQUE' | 'CASH' | null;
  status: 'waiting' | 'confirmed' | 'earlier' | 'disputed';
  receiptDocumentId: string | null;
  /** The owner may confirm it or say they did not pay it. */
  canAnswer: boolean;
}

export interface Payments {
  signedPaise: number;
  changesPaise: number;
  totalPaise: number;
  paidPaise: number;
  waitingPaise: number;
  balancePaise: number;
  stages: {
    index: number;
    label: string;
    amountPaise: number;
    changesPaise: number;
    paidPaise: number;
    waitingPaise: number;
    state: 'paid' | 'waiting' | 'part' | 'due' | 'later';
    dueOn: string | null;
  }[];
  entries: PaymentEntry[];
}

export interface Material {
  id: string;
  room: string;
  item: string;
  spec: string | null;
  productCode: string | null;
  ordered: boolean;
}
