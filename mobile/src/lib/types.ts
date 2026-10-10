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
