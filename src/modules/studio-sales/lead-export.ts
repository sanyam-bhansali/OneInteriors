import 'server-only';

/**
 * Download the leads list (improvement 8, owner 22 Oct 2026): the owner's
 * alone (`can(member, 'lead.export')`, roles.ts), with the list's current
 * filters and sort, as CSV. The cells and escaping are lead-export-rules.ts
 * (pure, tested); the route is app/api/studio/leads/export/route.ts.
 *
 * ## 26,000 rows without holding them
 *
 * The file is streamed: 500 leads at a time after a keyset cursor (the
 * list's own `keysetWhere` / `orderByFor`), each page written out before the
 * next is read. Memory stays at one page whatever the studio's size.
 *
 * ## Audited before the first byte
 *
 * One AuditLog line per download — who, the filters and sort, how many rows
 * — written before streaming starts. If the line cannot be written, nothing
 * is sent: a download nobody can trace afterwards is the thing this rule is
 * here to prevent. The count is the matching total at that moment.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import { myLeadScope } from '@/modules/studio/lead-scope';
import { can } from '@/modules/studio/roles';
import { cursorOf, leadFiltersToQuery, parseCursor, parseLeadFilters, parseSort, type Cursor } from './lead-filters';
import { keysetWhere, orderByFor, scopedLeadWhere } from './lead-where';
import { csvHead, csvLine, exportCells, exportFileName } from './lead-export-rules';

/** Leads read per page while streaming. */
export const EXPORT_PAGE = 500;

const SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  society: true,
  locality: true,
  config: true,
  budgetPaise: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  lastContactedAt: true,
  nextAction: true,
  nextActionOn: true,
  tags: true,
  lostReason: true,
  stage: { select: { name: true } },
  leadSource: { select: { name: true } },
  assignedTo: { select: { user: { select: { name: true, email: true, phone: true } } } },
} as const;

export type ExportStart = { ok: true; body: ReadableStream<Uint8Array>; filename: string; rows: number } | { ok: false; status: number; error: string };

/** Check, count, audit, and hand back the stream. `params` is the leads list's query string. */
export async function startLeadExport(params: URLSearchParams, now = new Date()): Promise<ExportStart> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, status: 401, error: 'Sign in to your studio first.' };
  if (!can(scope.member, 'lead.export')) return { ok: false, status: 403, error: 'Your role does not include downloading the leads list. Ask your studio owner.' };

  const filters = parseLeadFilters(params);
  const sort = parseSort(params.get('sort'));
  /* Sales roles (owner, 22 Oct 2026): only leads they may see in full. A
     pool they may only claim from shows no phone numbers on screen, so it is
     not in the download either (`scope.leads` fences the pool view too). */
  const where: Prisma.StudioClientWhereInput = { AND: [scopedLeadWhere(scope, filters, now, LIVE), scope.leads] };
  const orderBy = orderByFor(sort);

  let rows: number;
  try {
    rows = await prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [where] } });
    await prisma.auditLog.create({
      data: {
        actorId: scope.member.userId,
        action: 'studio.leads.export',
        entityType: 'Studio',
        entityId: scope.studioId,
        after: { memberId: scope.member.id, filters: leadFiltersToQuery(filters), sort, rows, format: 'csv' },
      },
    });
  } catch (error) {
    console.error('[lead-export] start failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, status: 503, error: 'We could not start the download just now. Nothing was sent; try again in a moment.' };
  }

  const encoder = new TextEncoder();
  let after: Cursor | null = null;
  let headed = false;
  let done = false;

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headed) {
        headed = true;
        controller.enqueue(encoder.encode(csvHead()));
        return;
      }
      if (done) {
        controller.close();
        return;
      }
      try {
        const page = await prisma.studioClient.findMany({
          where: after ? { AND: [where, keysetWhere(sort, after)] } : where,
          orderBy,
          take: EXPORT_PAGE,
          select: SELECT,
        });
        if (page.length < EXPORT_PAGE) done = true;
        const last = page[page.length - 1];
        after = last ? parseCursor(cursorOf(sort, last)) : null;
        if (!after) done = true;
        let chunk = '';
        for (const l of page) {
          chunk += csvLine(
            exportCells({
              name: l.name,
              phone: l.phone,
              email: l.email,
              stageName: l.stage.name,
              assigneeName: l.assignedTo ? l.assignedTo.user.name?.trim() || l.assignedTo.user.email?.split('@')[0] || l.assignedTo.user.phone || 'Someone' : null,
              source: l.source,
              leadSourceName: l.leadSource?.name ?? null,
              society: l.society,
              locality: l.locality,
              config: l.config,
              budgetPaise: l.budgetPaise,
              createdAt: l.createdAt,
              lastContactedAt: l.lastContactedAt,
              nextAction: l.nextAction,
              nextActionOn: l.nextActionOn,
              tags: l.tags,
              lostReason: l.lostReason,
            }),
          );
        }
        if (chunk) controller.enqueue(encoder.encode(chunk));
        if (done) controller.close();
      } catch (error) {
        console.error('[lead-export] page failed', error instanceof Error ? error.message : 'unknown');
        controller.error(new Error('export_failed'));
      }
    },
  });

  return { ok: true, body, filename: exportFileName(now), rows };
}
