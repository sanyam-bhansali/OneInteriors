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

export interface Project {
  id: string;
  studio: string;
  startOn: string;
  stages: Stage[];
  phases: { label: string; pct: number }[] | null;
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
