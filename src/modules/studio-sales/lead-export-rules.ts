/**
 * The leads list as a CSV file (improvement 8, owner 22 Oct 2026). Pure,
 * no `server-only`: the columns, one row's cells, and the escaping. Tested
 * in tests/studio-lead-export.test.ts. The download itself is
 * app/api/studio/leads/export/route.ts, which pages through the list and
 * writes the audit line.
 *
 * ## CSV only
 *
 * No spreadsheet library is a dependency (package.json), and adding one for
 * a download Excel opens perfectly well as CSV is not worth the weight. The
 * file starts with a UTF-8 byte order mark, without which Excel reads
 * "Kothrud – 2 BHK" as mojibake.
 *
 * ## Safe to open in Excel
 *
 * A lead's name or note is typed by whoever filled in a Facebook form. A
 * cell that starts with `=`, `+`, `-` or `@` (or a tab or carriage return)
 * is a formula to Excel, so it is written with a leading apostrophe:
 * `=HYPERLINK(...)` arrives as text, not as a link. Phone numbers stored as
 * "+91 98…" get the apostrophe too, and read correctly.
 */

import { istInputs } from './call-schedule';
import { LOST_LABELS, SOURCE_LABELS, type ClientSourceName, type LostReasonName } from '@/modules/studio-practice/vocabulary';

export const CSV_BOM = '﻿';

export const EXPORT_COLUMNS = [
  'Name',
  'Phone',
  'Email',
  'Stage',
  'Assigned to',
  'Source',
  'Society',
  'Locality',
  'Configuration',
  'Budget (₹)',
  'Created',
  'Last contacted',
  'Next action',
  'Next action on',
  'Tags',
  'Lost reason',
] as const;

/** One lead as the export reads it (route.ts selects exactly this). */
export interface ExportLead {
  name: string;
  phone: string | null;
  email: string | null;
  stageName: string;
  assigneeName: string | null;
  source: string;
  /** The studio's own source name, when the lead has one. */
  leadSourceName: string | null;
  society: string | null;
  locality: string | null;
  config: string | null;
  budgetPaise: number | bigint | null;
  createdAt: Date;
  lastContactedAt: Date | null;
  nextAction: string | null;
  nextActionOn: Date | null;
  tags: string[];
  lostReason: string | null;
}

const FORMULA = /^[=+\-@\t\r]/;

/** One cell: formula characters defused, quoted when it holds a comma, quote or line break. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value;
  /* Numbers we write ourselves (the budget) are never formulas; text from people may be. */
  if (typeof value === 'string' && FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One line, CRLF-terminated (what Excel writes and expects). */
export function csvLine(cells: readonly (string | number | null | undefined)[]): string {
  return `${cells.map(csvCell).join(',')}\r\n`;
}

/** "2026-10-22 15:30", India time; empty for none. */
export function istStamp(at: Date | null): string {
  if (!at) return '';
  const { day, time } = istInputs(at);
  return `${day} ${time}`;
}

/** The cells for one lead, in EXPORT_COLUMNS order. */
export function exportCells(l: ExportLead): (string | number | null)[] {
  const budget = l.budgetPaise === null ? null : Math.round(Number(l.budgetPaise) / 100);
  return [
    l.name,
    l.phone,
    l.email,
    l.stageName,
    l.assigneeName ?? 'Nobody (pool)',
    l.leadSourceName ?? SOURCE_LABELS[l.source as ClientSourceName] ?? l.source,
    l.society,
    l.locality,
    l.config,
    budget,
    istStamp(l.createdAt),
    istStamp(l.lastContactedAt),
    l.nextAction,
    istStamp(l.nextActionOn),
    l.tags.join('; '),
    l.lostReason ? (LOST_LABELS[l.lostReason as LostReasonName] ?? l.lostReason) : null,
  ];
}

/** The header line, with the byte order mark in front. */
export function csvHead(): string {
  return CSV_BOM + csvLine(EXPORT_COLUMNS);
}

/** "leads-2026-10-22.csv" (India day). */
export function exportFileName(now: Date): string {
  return `leads-${istInputs(now).day}.csv`;
}
