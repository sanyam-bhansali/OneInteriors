/**
 * Bring Hauspire's running design projects in from the owner's sheet (owner,
 * 30 Oct 2026: "update all their existing projects"; "one script, you run
 * it"). The sheet is "Project list for new app.xlsx" saved as CSV with a
 * "Quote no" column; the stage mapping is in
 * src/modules/studio-bring-in/sheet-rules.ts.
 *
 *     npx tsx --conditions=react-server scripts/bring-in-hauspire-projects.ts --studio <slug> --sheet <projects.csv> --dry-run
 *     npx tsx --conditions=react-server scripts/bring-in-hauspire-projects.ts --studio <slug> --sheet <projects.csv> [--only 5,6,14]
 *
 * Each row is brought in through the same `bringIn` as Projects → "Add an
 * existing project" (studio-bring-in/bring-in.ts `bringInAs`), acting as the
 * studio owner: on the quotation named in "Quote no" (already on the
 * software: the Excel import, or the Hauspire-app import), on the lead that
 * quotation is on, in design, with every step before the mapped one done
 * "before joining", and the sheet's designer assigned. No payments (the
 * sheet has none; record them on the Payments tab). The client is NOT
 * invited: nothing is sent to anybody.
 *
 * A row without a quotation number, or whose quotation, lead or designer
 * cannot be found, is skipped and says why. A dry run prints the same plan
 * and writes nothing. Each row is its own transaction, so a failure leaves
 * that row out and the others in; running again skips what is already in.
 *
 * Mobiles print as their last four digits. The database is DATABASE_URL from
 * the environment; this script loads no .env file. The host is printed
 * first, never the credentials. `--conditions=react-server` because the
 * bring-in module is server-only.
 */

import { readFileSync } from 'node:fs';
import { candidates, maskPhone, nameMatch, readSheet, stepFor, type SheetRow } from '../src/modules/studio-bring-in/sheet-rules';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

/** Production took 12–30 s a project on 31 Oct 2026 and three passed the page's 30 s; a script waits two minutes. */
const SLOW_TX = { maxWait: 60_000, timeout: 120_000 };

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

type Plan =
  | { ok: true; row: SheetRow; quoteId: string; quoteNo: string; leadId: string; leadLine: string; designerId: string; designer: string; step: string; lastStep: string | null; lastLabel: string | null; totalPaise: number; nameWarn: string | null }
  | { ok: false; row: SheetRow; why: string };

async function main() {
  const slug = arg('studio')?.trim();
  const file = arg('sheet');
  const dryRun = process.argv.includes('--dry-run');
  const only = arg('only')
    ?.split(',')
    .map((s) => Number(s.trim()))
    .filter(Number.isInteger);
  if (!slug || !file) {
    console.error('Usage: npx tsx --conditions=react-server scripts/bring-in-hauspire-projects.ts --studio <slug> --sheet <projects.csv> [--only 5,6] [--dry-run]');
    process.exit(1);
  }
  const sheet = readSheet(readFileSync(file, 'utf8'));
  if (!sheet.ok) throw new Error(sheet.error);
  if (sheet.problems.length) throw new Error(`Fix the sheet first:\n  ${sheet.problems.join('\n  ')}`);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Point it at the database to write.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}`);

  /* The pooler can be slow to hand over its one connection: wait a minute for it, not Prisma's 10 seconds.
     Set before the modules below open their client. */
  if (!/[?&]pool_timeout=/.test(url)) process.env.DATABASE_URL = `${url}${url.includes('?') ? '&' : '?'}pool_timeout=60`;
  const { prisma } = await import('../src/lib/prisma');
  const { memberById } = await import('../src/modules/studio/access');
  const { can } = await import('../src/modules/studio/roles');
  const { bringInAs, planPreviewAs } = await import('../src/modules/studio-bring-in/bring-in');

  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, softwarePlan: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const studioId = studio.id;
    const ownerRow = await prisma.studioMember.findFirst({ where: { studioId, isOwner: true, status: 'ACTIVE' }, select: { id: true, user: { select: { name: true } } } });
    const owner = ownerRow ? await memberById(ownerRow.id) : null;
    if (!owner || !ownerRow) throw new Error('The studio has no active owner to act as.');
    if (!can(owner, 'project.bringIn')) throw new Error(`The owner may not bring projects in (plan ${studio.softwarePlan}; bringing in is Max only).`);
    const by = { id: ownerRow.id, name: ownerRow.user.name?.trim() || 'Studio owner' };
    console.log(`${studio.tradeName} (${slug}) · plan ${studio.softwarePlan} · acting as ${by.name}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);

    const team = await prisma.studioMember.findMany({
      where: { studioId, role: { in: ['DESIGNER', 'PM', 'OWNER'] } },
      select: { id: true, role: true, status: true, user: { select: { name: true } } },
    });
    console.log(`team: ${team.length} who can design; reading the sheet's rows…`);

    const rows = sheet.rows.filter((r) => !only?.length || only.includes(r.line));
    const plans: Plan[] = [];
    for (const row of rows) {
      process.stdout.write(`  … line ${row.line} ${row.client}\r`);
      const no = (row.quoteNo ?? '').replace(/\s*\(.*\)$/, '').trim();
      if (!no) {
        plans.push({ ok: false, row, why: `no quotation number in the sheet (${row.format === 'EXCEL' ? 'the Excel quotation was not sent' : 'nothing in the Hauspire app under this client'})` });
        continue;
      }
      const step = stepFor(row.stage);
      if (!step) {
        plans.push({ ok: false, row, why: `stage "${row.stage}" is not in the mapping` });
        continue;
      }
      const quote = await prisma.studioQuote.findFirst({
        where: { studioId, number: no, stage: 'SALES' },
        select: { id: true, number: true, client: { select: { id: true, name: true, phone: true, deletedAt: true, introductionId: true, bookedIntroductionId: true } } },
      });
      if (!quote) {
        plans.push({ ok: false, row, why: `quotation ${no} is not on the software${row.format === 'HAUSPIRE_APP' ? ' (sync the Hauspire app first)' : ''}` });
        continue;
      }
      const started = await prisma.homeProject.findFirst({ where: { signedQuoteId: quote.id, cancelledAt: null }, select: { id: true } });
      if (started) {
        plans.push({ ok: false, row, why: `already brought in (quotation ${no} has a project)` });
        continue;
      }
      const lead = quote.client;
      if (!lead) {
        plans.push({ ok: false, row, why: `quotation ${no} is not on a lead` });
        continue;
      }
      if (lead.deletedAt || lead.introductionId || lead.bookedIntroductionId) {
        plans.push({ ok: false, row, why: `the lead ${lead.name} (${maskPhone(lead.phone)}) is in the bin or already booked` });
        continue;
      }
      const d = candidates(row.designer, team, (m) => m.user.name);
      if (d.total !== 1) {
        plans.push({ ok: false, row, why: d.total === 0 ? `no one called "${row.designer}" on the team` : `${d.total} people match "${row.designer}"` });
        continue;
      }
      const designer = d.shown[0]!.item;
      if (designer.status !== 'ACTIVE') {
        plans.push({ ok: false, row, why: `${designer.user.name} has not signed in yet (${designer.status})` });
        continue;
      }
      const preview = await planPreviewAs(owner, { quote: { kind: 'ours', quoteId: quote.id } });
      if (!preview.ok) {
        plans.push({ ok: false, row, why: preview.error });
        continue;
      }
      const choices = preview.preview.choices.DESIGN;
      const at = choices.findIndex((c) => c.label === step);
      if (at < 0) {
        plans.push({ ok: false, row, why: `"${step}" is not among this project's design steps` });
        continue;
      }
      const last = at > 0 ? choices[at - 1]! : null;
      plans.push({
        ok: true,
        row,
        quoteId: quote.id,
        quoteNo: quote.number,
        leadId: lead.id,
        leadLine: `${lead.name} ${maskPhone(lead.phone)}`,
        designerId: designer.id,
        designer: designer.user.name ?? row.designer,
        step,
        lastStep: last?.key ?? null,
        lastLabel: last?.label ?? null,
        totalPaise: preview.preview.totalPaise,
        nameWarn: nameMatch(row.client, lead.name) ? null : `the sheet says "${row.client}", the lead is "${lead.name}"`,
      });
    }

    console.log('');
    for (const p of plans) {
      const head = `  ${String(p.row.line).padStart(2)} ${p.row.client.padEnd(22)}`;
      if (!p.ok) {
        console.log(`${head} ✗ skip: ${p.why}`);
        continue;
      }
      console.log(`${head} ✓ ${p.quoteNo.padEnd(11)} ${rupees(p.totalPaise).padStart(12)} · ${p.leadLine} · ${p.designer} · at "${p.step}"${p.lastLabel ? ` (done up to "${p.lastLabel}")` : ' (nothing done yet)'}`);
      if (p.nameWarn) console.log(`${' '.repeat(28)}⚠ ${p.nameWarn}`);
    }
    const ready = plans.filter((p): p is Extract<Plan, { ok: true }> => p.ok);
    console.log(`\n${ready.length} to bring in, ${plans.length - ready.length} skipped.`);
    if (dryRun) {
      console.log('Dry run: nothing was written. Run again without --dry-run to bring them in.');
      return;
    }

    let done = 0;
    const failed: string[] = [];
    for (const p of ready) {
      const r = await bringInAs(owner, by, {
        lead: { id: p.leadId },
        quote: { kind: 'ours', quoteId: p.quoteId },
        confirmedTotalPaise: p.totalPaise,
        phase: 'DESIGN',
        lastStep: p.lastStep,
        payments: [],
        team: { designerId: p.designerId },
        inviteNow: false,
      }, new Date(), SLOW_TX);
      if (r.ok) {
        done++;
        console.log(`  ✓ line ${p.row.line} ${p.row.client}: project ${r.projectId}`);
      } else {
        failed.push(`line ${p.row.line} ${p.row.client}: ${r.error}`);
        console.log(`  ✗ line ${p.row.line} ${p.row.client}: ${r.error}`);
      }
    }
    await prisma.auditLog.create({
      data: { actorId: owner.userId, action: 'studio.bringIn.sheet', entityType: 'Studio', entityId: studioId, after: { broughtIn: done, failed: failed.length, skipped: plans.length - ready.length } },
    });
    console.log(`\nWritten: ${done} brought in, ${failed.length} failed, ${plans.length - ready.length} skipped. No client was invited. Audit: studio.bringIn.sheet.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
