import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { GuidePanel } from '../GuidePanel';
import { guideContext } from '@/modules/studio/guide-store';
import { formatINR } from '@/lib/money';
import { myQuotes, STAGE_LABELS, STATUS_LABELS, type QuoteStatusName, type QuoteSummary } from '@/modules/studio-quote/quotes';
import { myProducts } from '@/modules/studio-quote/store';
import { StartQuote } from './NewQuote';
import { RatesGateCard } from '../RatesGateCard';
import { myRatesGate, RATES_GATE_COPY } from '@/modules/studio-quote/rates-gate';

export const metadata: Metadata = {
  title: 'Quotations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const TONE: Record<QuoteStatusName, string> = {
  DRAFT: '!bg-[var(--s-surface-2)] !text-[var(--s-ink-3)]',
  ISSUED: '!bg-[var(--s-warn-wash)] !text-[var(--s-warn)]',
  ACCEPTED: '!bg-[var(--s-good-wash)] !text-[var(--s-good)]',
  DECLINED: '!bg-[var(--s-bad-wash)] !text-[var(--s-bad)]',
};

/**
 * Every quotation a studio has written.
 *
 * Sorted by what they touched last, not by value — the one they were working on
 * this morning is the one they came back for. Value ordering is for a report,
 * and this is a work surface.
 */
export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const search = String((await searchParams).q ?? '').trim().slice(0, 80);
  const [quotes, products, gate] = await Promise.all([myQuotes(search), myProducts(), myRatesGate()]);
  const folders = byClient(quotes);

  /* Shut until the studio has confirmed the rates filled from its own
     quotations — rates-gate.ts. createQuote refuses as well; this is the
     page saying why, instead of a builder that fails on submit. */
  if (gate !== 'OPEN') {
    return (
      <>
        <PageHead title="Quotations" sub="Opens once your rates are confirmed." />
        <PageBody>
          <RatesGateCard gate={gate} {...RATES_GATE_COPY[gate]} where="elsewhere" />
        </PageBody>
      </>
    );
  }

  const priced = products.filter((p) => p.ratePaise > 0).length;
  const standard = products.filter((p) => p.inStandardBuild).length;

  /* Branding is no longer read here, and the button is no longer gated on it.
     `myBranding()` seeds the row from the registration step, so a studio who
     has onboarded has one; the genuine remaining case — quoting before
     registering — is refused by `createQuote` server-side, with a sentence
     naming the step to finish. A page that hides its only control because a
     prerequisite MIGHT be missing is a page with nothing on it. */

  /* Every step is derived from the studio's own rows — there is no way to
     mark one done without having done it. See modules/studio/guide.ts. */
  const { state, facts } = await guideContext();
  const dismissed = state.dismissed.includes('quotations');

  return (
    <>
      <PageHead
        title="Quotations"
        sub={
          quotes.length === 0 && !search
            ? 'Tell it about the flat and it writes the first draft.'
            : `${quotes.length} · ${quotes.filter((q) => q.status === 'DRAFT').length} still in draft`
        }
        action={
          quotes.length > 0 ? (
            <StartQuote priced={priced} standard={standard} total={products.length} compact />
          ) : null
        }
      />

      <PageBody>
        {/* The two prerequisites used to be a blocker card: a wall telling
            somebody to go to two other screens and come back. They are now
            steps one and two of the walkthrough, which is the same
            information arranged as a way forward rather than a refusal.
            `blocked` still governs whether the New button renders, and
            createQuote() still enforces branding server-side. */}
        <GuidePanel guide="quotations" facts={facts} dismissed={dismissed} />

        {/* The empty state IS the builder.
            It used to be a paragraph explaining that quotations live here,
            with the only way to make one hidden behind a button that removed
            itself whenever the catalogue was unpriced — so the first screen
            of the feature was a description of a filing cabinet with no
            drawer. Now the first screen writes a quotation. */}
        {quotes.length === 0 && !search ? (
          <div className="flex flex-col gap-4">
            <StartQuote priced={priced} standard={standard} total={products.length} />

            <p className="m-0 max-w-[68ch] px-1 text-[13.5px] leading-relaxed text-[var(--s-ink-3)]">
              Yours, on your letterhead, for your own clients as much as the ones we introduce. We
              never see what you charge on one and we take nothing from a project that did not come
              through us.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* GET, so a search is a link a studio can keep. */}
            <form className="flex flex-wrap items-center gap-2" role="search">
              <input
                name="q"
                defaultValue={search}
                placeholder="Search client, quotation number, phone or society"
                aria-label="Search quotations"
                className="min-w-0 flex-1 rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px]"
              />
              <button type="submit" className="s-btn-ghost">
                Search
              </button>
              {search ? (
                <Link href="/studio/quotations" className="text-[13px] text-[var(--s-ink-3)]">
                  Clear
                </Link>
              ) : null}
            </form>

            {folders.length === 0 ? (
              <p className="m-0 text-[14px] text-[var(--s-ink-3)]">No quotation matches “{search}”.</p>
            ) : null}

            {/* One folder per client, newest first; their versions inside. */}
            {folders.map((folder) => (
              <section key={folder.key} className="s-card overflow-hidden">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-[var(--s-surface-2)] px-4 py-2.5">
                  <span className="text-[15px] font-semibold">{folder.name}</span>
                  {folder.quotes[0]!.clientPhone ? (
                    <span className="s-num text-[12.5px] text-[var(--s-ink-3)]">{folder.quotes[0]!.clientPhone}</span>
                  ) : null}
                  {folder.quotes.some((q) => q.fromMarketplace) ? (
                    <span className="s-tag !bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]">One Interiors</span>
                  ) : null}
                  <span className="ml-auto text-[12.5px] text-[var(--s-ink-3)]">
                    {folder.quotes.length} {folder.quotes.length === 1 ? 'quotation' : 'quotations'}
                  </span>
                </div>
                <ul className="m-0 flex list-none flex-col p-0">
                  {folder.quotes.map((q) => (
                    <li key={q.id} className="border-t border-[var(--s-rule-soft)] first:border-t-0">
                      <Link
                        href={`/studio/quotations/${q.id}`}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 no-underline hover:bg-[var(--s-rail-active)]"
                      >
                        <span className="s-num text-[13.5px] font-medium">{q.number}</span>
                        <span className="s-tag">{STAGE_LABELS[q.stage]}</span>
                        <span className={`s-tag ${TONE[q.status]}`}>{STATUS_LABELS[q.status]}</span>
                        {q.config ? <span className="text-[13px] text-[var(--s-ink-3)]">{q.config}</span> : null}
                        {q.society ? <span className="text-[13px] text-[var(--s-ink-3)]">· {q.society}</span> : null}
                        <span className="ml-auto text-[12.5px] text-[var(--s-ink-3)]">
                          {q.lineCount === 0 ? 'No lines yet' : `${q.lineCount} lines`}
                        </span>
                        <span className="s-num w-[7.5rem] text-right text-[15px] font-semibold">
                          {q.totalPaise > 0 ? formatINR(q.totalPaise) : '—'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

/**
 * Quotations grouped by client: the client record when there is one, else the
 * name and phone as typed. Folders keep the order of their newest quotation.
 */
function byClient(quotes: QuoteSummary[]): { key: string; name: string; quotes: QuoteSummary[] }[] {
  const folders = new Map<string, { key: string; name: string; quotes: QuoteSummary[] }>();
  for (const q of quotes) {
    const key = q.clientId ?? `${q.clientName.trim().toLowerCase()}|${q.clientPhone ?? ''}`;
    const folder = folders.get(key) ?? { key, name: q.clientName, quotes: [] };
    folder.quotes.push(q);
    folders.set(key, folder);
  }
  return [...folders.values()];
}
