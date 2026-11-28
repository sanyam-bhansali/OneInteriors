/**
 * Why did a Design Final not move its project's payment stages? (owner, 27 Nov
 * 2026: "the payment stages are not changing according to design final").
 * READ ONLY: it writes nothing. It walks the same checks as marking it final
 * (studio-quote/quotes.ts `restageProjectOnDesignFinal`) and says which one
 * stops it, with the numbers.
 *
 *     npx tsx --conditions=react-server scripts/why-no-restage.ts --studio <slug> --quote 2396-D
 *
 * The database is DATABASE_URL from the environment; the host is printed, never the credentials.
 */

export {};

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

const rupees = (paise: number | null) => (paise === null ? '—' : `₹${Math.round(paise / 100).toLocaleString('en-IN')}`);

async function main() {
  const slug = arg('studio')?.trim();
  const number = arg('quote')?.trim();
  if (!slug || !number) {
    console.error('Usage: npx tsx --conditions=react-server scripts/why-no-restage.ts --studio <slug> --quote <number, e.g. 2396-D>');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}   (READ ONLY)\n`);
  const { prisma } = await import('../src/lib/prisma');
  const { readSignedStages } = await import('../src/modules/portal/payments');
  const { restageOnTotal } = await import('../src/modules/studio-design/restage');
  const { restageKeepingGst } = await import('../src/modules/project/project-gst');
  const { quoteTotalInStudio, salesFinalTotalInStudio } = await import('../src/modules/studio-quote/quotes');
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const q = await prisma.studioQuote.findFirst({
      where: { studioId: studio.id, number },
      select: { id: true, number: true, stage: true, status: true, basedOnId: true, scopeForProjectId: true, issuedOn: true, updatedAt: true, category: true },
    });
    if (!q) return console.log(`✗ No quotation numbered ${number} in this studio.`);
    console.log(`Quotation ${q.number}: stage ${q.stage}, status ${q.status}, first sent ${q.issuedOn?.toISOString() ?? 'never'}, category ${q.category ?? 'none'}`);
    if (q.status === 'DRAFT') console.log('✗ STOP: still a DRAFT. Generate PDF has not gone through on it (a category or a line photo missing shows a red message).');
    if (q.stage !== 'DESIGN') console.log('✗ STOP: not a Design Final (stage is not DESIGN).');
    if (q.scopeForProjectId) console.log('✗ STOP: this is additional scope, which never moves the stages.');
    if (!q.basedOnId) return console.log('✗ STOP: not made from a sales final (no basedOnId).');
    const sales = await prisma.studioQuote.findUnique({ where: { id: q.basedOnId }, select: { number: true } });
    console.log(`Made from sales final ${sales?.number ?? q.basedOnId}`);
    const projects = await prisma.homeProject.findMany({
      where: { introduction: { studioId: studio.id }, OR: [{ signedQuoteId: q.basedOnId }, { designFinalQuoteId: q.id }] },
      select: { id: true, cancelledAt: true, signedQuoteId: true, designFinalQuoteId: true, paymentPhases: true, gstPctOfValue: true, gstPaise: true, contractPaise: true },
    });
    if (projects.length === 0) {
      const any = await prisma.homeProject.findMany({ where: { introduction: { studioId: studio.id }, signedQuoteId: { not: null } }, select: { id: true }, take: 1 });
      return console.log(`✗ STOP: no project has sales final ${sales?.number} as its signed quotation, so there is nothing to move. (${any.length ? 'Other projects exist; this one was booked on a different quotation.' : ''})`);
    }
    for (const p of projects) {
      console.log(`\nProject ${p.id}: ${p.cancelledAt ? 'CANCELLED' : 'running'}, signed on ${p.signedQuoteId === q.basedOnId ? 'this sales final ✓' : `another quotation (${p.signedQuoteId}) ✗`}, contract ${rupees(p.contractPaise === null ? null : Number(p.contractPaise))}, GST part ${p.gstPctOfValue ?? 'none'}`);
      const stages = readSignedStages(p.paymentPhases);
      if (!stages) {
        console.log('✗ STOP: its payment stages cannot be read:', JSON.stringify(p.paymentPhases)?.slice(0, 400));
        continue;
      }
      for (const s of stages) console.log(`   ${s.label.padEnd(28)} ${s.pct === null ? 'fixed' : `${s.pct}%`.padStart(5)}  ${rupees(s.amountPaise)}`);
      console.log(`   ${'Stages add up to'.padEnd(28)}        ${rupees(stages.reduce((a, s) => a + s.amountPaise, 0))}`);
      const total = await quoteTotalInStudio(q.id, studio.id);
      const salesTotal = await salesFinalTotalInStudio(q.basedOnId, studio.id);
      console.log(`Design Final total ${rupees(total)}; sales final total as booked ${rupees(salesTotal)}`);
      if (total === null) {
        console.log('✗ STOP: the Design Final total could not be worked out.');
        continue;
      }
      const r = restageKeepingGst(stages, Number(p.gstPaise), p.gstPctOfValue, (base) => restageOnTotal(base, total, salesTotal));
      if (!r.ok) {
        console.log(`✗ STOP: the re-split refused: ${r.error}`);
        continue;
      }
      if (!r.changed) console.log('= The stages are already on this Design Final: nothing to move.');
      else {
        console.log('→ Marking it final would set:');
        for (const s of r.stages) console.log(`   ${s.label.padEnd(28)} ${rupees(s.amountPaise)}`);
        console.log(`   total ${rupees(r.totalPaise)}`);
        if (q.status !== 'DRAFT') console.log('✗ It is marked, yet the stages did not move: the move failed when it was marked (see Vercel logs for "restageProjectOnDesignFinal failed"), or this was marked before the project existed.');
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
