/**
 * Look up Hauspire's running design projects before bringing them in
 * (owner, 30 Oct 2026; the rules and the stage mapping are in
 * src/modules/studio-bring-in/sheet-rules.ts). READ ONLY: it writes nothing,
 * anywhere, and sends nothing.
 *
 *     npx tsx scripts/lookup-hauspire-projects.ts --studio <slug> --sheet <projects.csv>
 *     npx tsx scripts/lookup-hauspire-projects.ts --studio <slug> --sheet <projects.csv> --source
 *
 * `--sheet` is "Project list for new app.xlsx" saved as CSV. For each row
 * it prints the new design step the project goes to, the designer on the
 * team, the leads on the board the name could be, and the quotations that
 * carry the name. `--source` also searches the Hauspire quotation app (the
 * read-only HAUSPIRE_QUOTES_* connection) for rows quoted there.
 *
 * Mobiles are printed as their last four digits only, so the report can be
 * pasted into a chat. The database is DATABASE_URL from the environment;
 * this script loads no .env file. The target host is printed first, never
 * the credentials.
 */

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { connectionFromEnv, listAllHauspire } from '../src/modules/studio-bring-in/hauspire-fetch';
import { toMatch, type SourceMatch } from '../src/modules/studio-bring-in/hauspire-map';
import { candidates, maskPhone, proposeLead, readSheet, stepFor } from '../src/modules/studio-bring-in/sheet-rules';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

const rupees = (paise: number | bigint) => `₹${Math.round(Number(paise) / 100).toLocaleString('en-IN')}`;
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
  const slug = arg('studio')?.trim();
  const file = arg('sheet');
  const withSource = process.argv.includes('--source');
  if (!slug || !file) {
    console.error('Usage: npx tsx scripts/lookup-hauspire-projects.ts --studio <slug> --sheet <projects.csv> [--source]');
    process.exit(1);
  }
  const sheet = readSheet(readFileSync(file, 'utf8'));
  if (!sheet.ok) {
    console.error(sheet.error);
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Point it at the database to read.');
    process.exit(1);
  }
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]} (read only)`);

  const prisma = new PrismaClient();
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, softwarePlan: true } });
    if (!studio) {
      console.error(`No studio with slug "${slug}".`);
      process.exit(1);
    }
    const studioId = studio.id;

    const [leads, quotes, members] = await Promise.all([
      prisma.studioClient.findMany({
        where: { studioId, isDemo: false },
        select: {
          id: true,
          name: true,
          phone: true,
          society: true,
          locality: true,
          config: true,
          deletedAt: true,
          source: true,
          introductionId: true,
          bookedIntroductionId: true,
          importedFrom: true,
          stage: { select: { name: true, kind: true } },
          assignedTo: { select: { user: { select: { name: true } } } },
        },
      }),
      prisma.studioQuote.findMany({
        where: { studioId },
        select: { number: true, stage: true, status: true, clientName: true, clientId: true, config: true, importedFrom: true, quoteDate: true, createdAt: true, salesFinalRevision: { select: { totalPaise: true } } },
      }),
      prisma.studioMember.findMany({
        where: { studioId },
        select: { id: true, role: true, status: true, isOwner: true, designHead: true, user: { select: { name: true } } },
      }),
    ]);

    let source: SourceMatch[] | null = null;
    if (withSource) {
      const c = connectionFromEnv();
      if (!c) console.log('▶ quotation app: not connected (HAUSPIRE_QUOTES_* not set) — skipped');
      else if (c.slug !== slug) console.log(`▶ quotation app: HAUSPIRE_QUOTES_STUDIO_SLUG is "${c.slug}", not "${slug}" — skipped`);
      else {
        console.log(`▶ quotation app: ${new URL(c.url).host} (read only)`);
        const r = await listAllHauspire(c, fetch, (n) => process.stdout.write(`\r  read ${n} rows…`));
        process.stdout.write('\n');
        if (r.ok) source = r.rows.map(toMatch);
        else console.log(`  could not read it: ${r.error}`);
      }
    }

    console.log(`\n${studio.tradeName} (${slug}) · plan ${studio.softwarePlan} · ${leads.length} leads, ${quotes.length} quotations, ${members.length} people`);
    console.log(`Sheet: ${sheet.rows.length} projects, ${sheet.rows.filter((r) => r.format === 'EXCEL').length} quoted in Excel, ${sheet.rows.filter((r) => r.format === 'HAUSPIRE_APP').length} in the Hauspire app`);
    if (sheet.problems.length) {
      console.log('\nProblems in the sheet (fix these first):');
      for (const p of sheet.problems) console.log(`  ✗ ${p}`);
    }

    const tally = { leadOne: 0, leadMany: 0, leadNone: 0, designerMissing: new Set<string>() };
    const leadById = new Map(leads.map((x) => [x.id, x]));
    const usableLead = (x: (typeof leads)[number]) => !x.deletedAt && !x.bookedIntroductionId && !x.introductionId && x.source !== 'ONE_INTERIORS';
    const leadLine = (x: (typeof leads)[number]) => `${x.name} · ${maskPhone(x.phone)} · ${[x.society, x.locality].filter(Boolean).join(', ') || 'no address'} · "${x.stage.name}"`;
    const verdicts: string[] = [];
    for (const row of sheet.rows) {
      console.log(`\n── line ${row.line} · ${row.client} · ${row.format === 'EXCEL' ? 'Excel quotation' : 'Hauspire app quotation'}`);
      console.log(`   step:     "${row.stage}" → ${stepFor(row.stage) ?? '✗ not in the mapping'}`);

      const d = candidates(row.designer, members, (m) => m.user.name);
      if (d.total === 0) {
        tally.designerMissing.add(row.designer);
        console.log(`   designer: ✗ no one called "${row.designer}" on the team`);
      } else {
        for (const { item: m, how } of d.shown) {
          const warn = m.role !== 'DESIGNER' && !m.isOwner ? ` ⚠ role ${m.role}` : '';
          console.log(`   designer: ${m.user.name} (${m.role}${m.designHead ? ', design head' : ''}, ${m.status})${how === 'contains' ? ' ~' : ''}${warn}`);
        }
        if (d.total > 1) console.log(`             ⚠ ${d.total} people match "${row.designer}": the sheet must say which`);
      }

      const l = candidates(row.client, leads, (x) => x.name, 5, (x) => (x.stage.kind === 'WON' ? 0 : 1));
      if (l.total === 0) {
        tally.leadNone++;
        console.log('   leads:    none on the board — a new lead (mobile needed)');
      } else {
        if (l.total === 1) tally.leadOne++;
        else tally.leadMany++;
        console.log(`   leads:    ${l.total} on the board${l.total > l.shown.length ? `, first ${l.shown.length} shown` : ''} (~ = name contains the sheet's words)`);
        for (const { item: x, how } of l.shown) {
          const why = [
            x.deletedAt ? 'in the bin' : null,
            x.bookedIntroductionId || x.introductionId ? 'already booked / One Interiors' : null,
            x.source === 'ONE_INTERIORS' ? 'One Interiors lead' : null,
          ].filter(Boolean);
          const where = [x.society, x.locality].filter(Boolean).join(', ') || 'no address';
          console.log(
            `     ${how === 'exact' ? '=' : '~'} ${x.name} · ${maskPhone(x.phone)} · ${where} · ${x.config ?? 'BHK ?'} · "${x.stage.name}" · ${x.assignedTo?.user.name ?? 'unassigned'}${x.importedFrom ? ` · from ${x.importedFrom}` : ''}${why.length ? ` · ✗ ${why.join(', ')}` : ''}`,
          );
        }
      }

      const q = candidates(row.client, quotes, (x) => x.clientName, 8);
      if (q.total === 0) console.log(`   ours:     no quotation carries this name${row.format === 'EXCEL' ? ' (expected: it was quoted in Excel)' : ''}`);
      for (const { item: x } of q.shown) {
        const total = x.salesFinalRevision ? `sales final ${rupees(x.salesFinalRevision.totalPaise)}` : 'no sales final';
        const on = x.clientId ? leadById.get(x.clientId) : undefined;
        console.log(`   ours:     ${x.number} · ${x.stage} · ${x.status} · ${x.clientName} · ${x.config ?? 'BHK ?'} · ${day(x.quoteDate ?? x.createdAt)} · ${total}${x.importedFrom ? ' · from the Hauspire app' : ''}`);
        console.log(`             on lead: ${on ? leadLine(on) : '⚠ not on a lead'}`);
      }

      // The proposal: from every candidate, not only the five shown.
      const all = candidates(row.client, leads, (x) => x.name, Number.MAX_SAFE_INTEGER);
      const quotesForRow = candidates(row.client, quotes, (x) => x.clientName, Number.MAX_SAFE_INTEGER).shown.map((c) => c.item);
      const proposal = proposeLead(
        all.shown.map(({ item, how }) => ({ id: item.id, how, won: item.stage.kind === 'WON', usable: usableLead(item) })),
        quotesForRow.map((x) => x.clientId),
      );
      const why = { quotation: 'its quotations are on it', converted: 'the only Converted lead', only: 'the only lead, same name' } as const;
      const picked = proposal.id !== null ? leadById.get(proposal.id) : undefined;
      const short = proposal.id !== null ? null : proposal.why === 'none' ? '✗ new lead: mobile' : `? pick 1 of ${proposal.among}`;
      const text =
        proposal.id !== null && picked
          ? `${leadLine(picked)}  (${why[proposal.why]})`
          : proposal.id === null && proposal.why === 'pick'
            ? `PICK — ${proposal.among} leads could be this client`
            : 'NEW LEAD — mobile needed';
      console.log(`   proposed: ${text}`);
      const quoteNote =
        row.format === 'EXCEL'
          ? 'quotation from the PDF'
          : (() => {
              const sales = quotesForRow.filter((x) => x.stage === 'SALES');
              const mine = picked ? sales.filter((x) => x.clientId === picked.id) : sales;
              const best = mine.find((x) => x.status === 'ACCEPTED') ?? mine[0];
              if (best) return `quotation ${best.number}${best.status === 'ACCEPTED' ? ' (accepted)' : ''}${mine.length > 1 ? `, ${mine.length} to choose from` : ''}`;
              return sales.length ? `⚠ ${sales.length} quotation(s) under the name, none on this lead` : '✗ quotation NOT in the software';
            })();
      verdicts.push(`  ${String(row.line).padStart(2)} ${row.client.padEnd(22)} ${(picked ? `✓ ${picked.name} ${maskPhone(picked.phone)}` : (short ?? '')).padEnd(42)} ${quoteNote}`);

      if (source) {
        const s = candidates(row.client, source, (x) => x.client, 8);
        if (s.total === 0) console.log(`   app:      nothing in the Hauspire app under this name${row.format === 'HAUSPIRE_APP' ? ' ⚠ the sheet says it was quoted there' : ''}`);
        for (const { item: x } of s.shown) console.log(`   app:      ${x.number} · ${x.stage} · ${x.client} · ${x.bhk ?? 'BHK ?'} · ${x.location ?? '—'} · ${x.date ?? '—'} · ${rupees(x.tpvPaise)}`);
      }
    }

    console.log('\nProposed, one line per project (✓ proposed lead · ? the team picks · ✗ missing)');
    for (const v of verdicts) console.log(v);

    console.log('\nSummary');
    console.log(`  one lead matches        ${tally.leadOne}`);
    console.log(`  several leads match     ${tally.leadMany}  (pick one per row)`);
    console.log(`  no lead                 ${tally.leadNone}  (a mobile is needed)`);
    console.log(`  designers not on team   ${tally.designerMissing.size ? [...tally.designerMissing].join(', ') : 'none'}`);
    console.log('\nRead only: nothing was written.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
