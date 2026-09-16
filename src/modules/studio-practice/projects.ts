import 'server-only';

/**
 * Sites a studio has running.
 *
 * A project is what a client becomes once the work is won: it holds the
 * contract value, the dates, and every work order raised against it. Same
 * scoping rule as the rest of this folder — the studio id comes from the
 * session and never from an argument.
 */

import { prisma } from '@/lib/prisma';
import { fromDb, toDb, type Paise } from '@/lib/money';
import { myStudioId } from '@/modules/studio-quote/store';
import { workOrderMoney } from './ledger';
import { myStages } from './stages';
import type { QuoteUnitName } from '@/modules/studio-quote/pricing';

export { PROJECT_STAGES, PROJECT_STAGE_LABELS, LIVE_PROJECT_STAGES } from './vocabulary';
export type { ProjectStageName } from './vocabulary';

import { LIVE_PROJECT_STAGES } from './vocabulary';
import type { ProjectStageName } from './vocabulary';

export interface ProjectRow {
  id: string;
  name: string;
  stage: ProjectStageName;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  contractPaise: Paise | null;
  startedOn: Date | null;
  targetDate: Date | null;
  handedOverOn: Date | null;
  /** What every trade on this site has been billed and paid, in total. */
  committedPaise: Paise;
  paidPaise: Paise;
  owedPaise: Paise;
  workOrderCount: number;
  updatedAt: Date;
}

export async function myProjects(): Promise<ProjectRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const rows = await prisma.studioProject.findMany({
      where: { studioId },
      orderBy: [{ stage: 'asc' }, { updatedAt: 'desc' }],
      include: {
        client: { select: { id: true, name: true, phone: true } },
        workOrders: {
          include: { lines: true, payments: { select: { amountPaise: true } } },
        },
      },
      take: 200,
    });

    return rows.map((row) => {
      // Summed from the orders, never stored. See the note in ledger.ts.
      let committedPaise = 0;
      let paidPaise = 0;

      for (const order of row.workOrders) {
        const money = workOrderMoney(
          order.lines.map((l) => ({
            unit: l.unit as QuoteUnitName,
            qtyMilli: l.qtyMilli,
            ratePaise: fromDb(l.ratePaise),
            amountPaise: fromDb(l.amountPaise),
          })),
          order.payments.map((p) => ({ amountPaise: fromDb(p.amountPaise) })),
        );
        committedPaise += money.billPaise;
        paidPaise += money.paidPaise;
      }

      return {
        id: row.id,
        name: row.name,
        stage: row.stage as ProjectStageName,
        clientId: row.client.id,
        clientName: row.client.name,
        clientPhone: row.client.phone,
        contractPaise: row.contractPaise === null ? null : fromDb(row.contractPaise),
        startedOn: row.startedOn,
        targetDate: row.targetDate,
        handedOverOn: row.handedOverOn,
        committedPaise,
        paidPaise,
        owedPaise: committedPaise - paidPaise,
        workOrderCount: row.workOrders.length,
        updatedAt: row.updatedAt,
      };
    });
  } catch (error) {
    console.error('[studio-practice] myProjects failed', error);
    return [];
  }
}

export type Result = { ok: true } | { ok: false; error: string };

export async function addProject(input: {
  clientId: string;
  name: string;
  contractRupees?: number;
  targetDate?: string;
}): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const client = await prisma.studioClient.findFirst({
    where: { id: input.clientId, studioId },
    select: { id: true, name: true, stage: { select: { kind: true } } },
  });
  if (!client) return { ok: false, error: 'That client is not yours.' };

  // A project can only start from a column the studio has marked as won. The
  // KIND and not the name, so this keeps working after somebody renames
  // "Booked" to "Advance received".
  if (client.stage.kind !== 'WON') {
    return {
      ok: false,
      error: 'Move them to a column that means the job is won before you start a project.',
    };
  }

  // The last won column, which for a default pipeline is "On site". A client
  // with work running should not still read as "Booked" on the board.
  const onSite = [...(await myStages())].reverse().find((s) => s.kind === 'WON');

  const name = input.name.trim() || `${client.name} — interiors`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.studioProject.create({
        data: {
          studioId,
          clientId: client.id,
          name,
          // Frozen here. Every later figure is measured against it, so editing
          // the quotation afterwards must not move it.
          contractPaise:
            input.contractRupees && input.contractRupees > 0
              ? toDb(Math.round(input.contractRupees * 100))
              : null,
          targetDate: input.targetDate ? new Date(input.targetDate) : null,
          startedOn: new Date(),
        },
      });

      // A client with work on site is on site. Leaving them where they were
      // means the board and the project list disagree about the same job.
      if (onSite) {
        await tx.studioClient.update({
          where: { id: client.id },
          data: { stageId: onSite.id },
        });
      }
    });

    return { ok: true };
  } catch (error) {
    console.error('[studio-practice] addProject failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export async function setProjectStage(id: string, stage: ProjectStageName): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  try {
    const { count } = await prisma.studioProject.updateMany({
      where: { id, studioId },
      data: {
        stage,
        ...(stage === 'CLOSED' ? { handedOverOn: new Date() } : {}),
      },
    });
    if (count === 0) return { ok: false, error: 'That project is not yours.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

/** Sites currently running. For the dashboard. */
export async function liveProjectCount(): Promise<number> {
  const studioId = await myStudioId();
  if (!studioId) return 0;

  try {
    return await prisma.studioProject.count({
      where: { studioId, stage: { in: LIVE_PROJECT_STAGES } },
    });
  } catch {
    return 0;
  }
}
