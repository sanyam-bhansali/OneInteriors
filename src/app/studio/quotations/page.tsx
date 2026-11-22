import Link from 'next/link';
import type { Metadata } from 'next';
import { GuidePanel } from '../GuidePanel';
import { guideContext } from '@/modules/studio/guide-store';
import { formatINR } from '@/lib/money';
import { mayQuote, myQuotes, STAGE_LABELS, STATUS_LABELS, type QuoteStatusName, type QuoteSummary } from '@/modules/studio-quote/quotes';
import { myProducts } from '@/modules/studio-quote/store';
import { previousQuoteToCopy } from '@/modules/studio-quote/from-previous';
import { StartQuote } from './NewQuote';
import { OlderQuotes } from './OlderQuotes';
import { RatesGateCard } from '../RatesGateCard';
import { myRatesGate, RATES_GATE_COPY } from '@/modules/studio-quote/rates-gate';
import { LineIcon } from '../ui/icons';
import { KpiRow } from '../ui/KpiRow';
import { quoteKpis } from '@/modules/studio/app-kpis';
import './quotes.css';

export const metadata: Metadata = {
  title: 'Quotations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** The status chip's tone (StudioQuotes: warn for waiting, good for won, bad for lost). */
const TONE: Record<QuoteStatusName, string> = {
  DRAFT: '',
  ISSUED: 'warn',
  ACCEPTED: 'good',
  DECLINED: 'bad',
};

const TABS: { key: 'ALL' | QuoteStatusName; name: string }[] = [
  { key: 'ALL', name: 'All' },
  { key: 'DRAFT', name: 'Drafts' },
  { key: 'ISSUED', name: 'Sent' },
  { key: 'ACCEPTED', name: 'Won' },
  { key: 'DECLINED', name: 'Lost' },
];


/**
 * Every quotation a studio has written (StudioQuotes in the owner's UI
 * handoff; the Sales, Designer and PM versions are the same page, scoped by
 * `myQuotes` to what this person may see).
 *
 * Sorted by what they touched last, not by value — the one they were working on
 * this morning is the one they came back for. A client's quotations stay
 * together, newest first. The status tabs and the search are links (GET), so a
 * filtered list is a link a studio can keep.
 */
export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; new?: string; from?: string }> }) {
  const sp = await searchParams;
  /* "Use as template" (owner, 22 Nov 2026): the quotation to copy, read as the picker would (only one this person may copy). */
  const fromId = String(sp.from ?? '').trim().slice(0, 64);
  const template = fromId ? await previousQuoteToCopy(fromId) : null;
  const search = String(sp.q ?? '').trim().slice(0, 80);
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as 'ALL' | QuoteStatusName) : 'ALL';
  const [quotes, products, gate, quoting] = await Promise.all([myQuotes(search), myProducts(), myRatesGate(), mayQuote()]);
  // A salesperson's quotation is always for a lead (Studio OS Phase 1).
  const leadRequired = quoting?.seesAll === false;
  /* A sales rep reads quotations and makes none (owner, 22 Nov 2026): the floor plan on the lead builds it. */
  const viewOnly = quoting?.readOnly === true;

  /* Shut until the studio has confirmed the rates filled from its own
     quotations — rates-gate.ts. createQuote refuses as well; this is the
     page saying why, instead of a builder that fails on submit. */
  if (gate !== 'OPEN') {
    return (
      <main className="content qpage">
        <div className="phead">
          <div>
            <h1>Quotations</h1>
            <p className="muted qsub">Opens once your rates are confirmed.</p>
          </div>
        </div>
        <RatesGateCard gate={gate} {...RATES_GATE_COPY[gate]} where="elsewhere" />
      </main>
    );
  }

  const priced = products.filter((p) => p.ratePaise > 0).length;
  const standard = products.filter((p) => p.inStandardBuild).length;

  /* Branding is not read here, and the button is not gated on it: quoting
     before registering is refused by `createQuote` server-side, with a
     sentence naming the step to finish. */

  /* Every step is derived from the studio's own rows — there is no way to
     mark one done without having done it. See modules/studio/guide.ts. */
  const { state, facts } = await guideContext();
  const dismissed = state.dismissed.includes('quotations');

  const count = (key: 'ALL' | QuoteStatusName) => (key === 'ALL' ? quotes.length : quotes.filter((q) => q.status === key).length);
  const shown = status === 'ALL' ? quotes : quotes.filter((q) => q.status === status);
  const folders = byClient(shown);
  const drafts = count('DRAFT');
  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (search) p.set('q', search);
    if (key !== 'ALL') p.set('status', key);
    const s = p.toString();
    return s ? `/studio/quotations?${s}` : '/studio/quotations';
  };
  const empty = quotes.length === 0 && !search;

  const building = !viewOnly && (sp.new === '1' || empty || template !== null);
  const templateRow = template?.ok ? quotes.find((q) => q.id === template.id) : undefined;

  return (
    <main className="content qpage hhome">
      {/* Hauspire's home: Welcome, the two ways in, the recent quotations. */}
      <div>
        <h1>Welcome</h1>
        <p className="muted qsub">Build a quotation from the floor plan: it opens in the builder, ready to edit.</p>
      </div>

      {/* The app's numbers first (owner, 1 Nov 2026; studio/app-kpis.ts): the quotations this person sees, after any search. */}
      <KpiRow label="Quotations at a glance" items={quoteKpis(quotes, new Date(), status)} />

      {viewOnly ? (
        <p className="qnote" style={{ margin: 0 }} data-testid="sales-view-only">
          Your quotations are built for you: attach the client&rsquo;s floor plan on the lead and the quotation is made from it. You can open and read them here.
        </p>
      ) : (
        <div className="hcards">
          <Link href="/studio/quotations/first" className="hcard">
            <b>Quotation builder</b>
            <span className="muted">Floor plan, flat and options, then Build: the full draft opens in the builder on your product master rates, to add rooms and fine-tune every line.</span>
          </Link>
        </div>
      )}

      {building ? (
        <div id="new" style={{ scrollMarginTop: 80 }}>
          {template && !template.ok ? (
            <p role="alert" className="qerr" style={{ marginBottom: 8 }}>
              {template.error}
            </p>
          ) : null}
          <StartQuote
            key={template?.ok ? template.id : 'new'}
            priced={priced}
            standard={standard}
            total={products.length}
            leadRequired={leadRequired}
            initialFrom={
              template?.ok
                ? { quote: template, label: templateRow ? [templateRow.clientName, templateRow.society, templateRow.config].filter(Boolean).join(' · ') : '' }
                : undefined
            }
          />
        </div>
      ) : null}

      {/* The walkthrough: steps one and two are the prerequisites. createQuote() still enforces branding server-side. */}
      <div className="qguide">
        <GuidePanel guide="quotations" facts={facts} dismissed={dismissed} />
      </div>

      <h2 className="hsec">Your recent quotations</h2>
      {empty ? (
        <p className="muted sm" style={{ margin: 0, maxWidth: '68ch', lineHeight: 1.55 }}>
          None yet — build one to get started. Yours, on your letterhead, for your own clients as much as the ones we introduce. We never see what you
          charge on one and we take nothing from a project that did not come through us.
        </p>
      ) : (
        <>
          <div className="hstack" style={{ justifyContent: 'space-between' }}>
            <nav className="tabs" aria-label="Quotation status">
              {TABS.map((t) => (
                <Link key={t.key} href={tabHref(t.key)} aria-current={status === t.key ? 'page' : undefined}>
                  {t.name} <span className="n">{count(t.key)}</span>
                </Link>
              ))}
            </nav>
            {/* GET, so a search is a link a studio can keep. */}
            <form className="qsearch" role="search">
              {status !== 'ALL' ? <input type="hidden" name="status" value={status} /> : null}
              <input name="q" defaultValue={search} placeholder="Client, quotation number, phone or society" aria-label="Search quotations" className="fld" />
              <button type="submit" className="btn sec sm" aria-label="Search">
                <LineIcon name="search" size={16} />
              </button>
              {search ? (
                <Link href={tabHref(status)} className="sm muted">
                  Clear
                </Link>
              ) : null}
            </form>
          </div>

          {drafts > 0 && status === 'ALL' ? (
            <span className="muted sm" style={{ marginTop: -8 }}>
              <b className="warn-t">
                {drafts} {drafts === 1 ? 'quotation is' : 'quotations are'} still in draft.
              </b>{' '}
              A client sees nothing until you send it.
            </span>
          ) : null}

          {folders.length === 0 ? (
            <div className="empty">
              <b>{search ? `No quotation matches “${search}”.` : 'Nothing here.'}</b>
              <span className="muted sm">{search ? 'Try a client’s name, a phone number or a quotation number.' : 'No quotation has this status yet.'}</span>
            </div>
          ) : (
            <div className="tscroll">
              <table className="htable hrecent">
                <thead>
                  <tr className="hhead">
                    <th scope="col">Client</th>
                    <th scope="col">Config</th>
                    <th scope="col" className="r">
                      TPV
                    </th>
                    <th scope="col">Date</th>
                    <th scope="col">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                {/* One group per client: their newest quotation, the older ones folded away (owner, 22 Nov 2026). */}
                {folders.map((folder) => {
                  const rows = folder.quotes.map((q, i) => {
                      const href = `/studio/quotations/${q.id}`;
                      return (
                        <tr key={q.id}>
                          <td>
                            <Link href={href} style={{ fontWeight: 600 }}>
                              {i === 0 ? q.clientName : `↳ ${q.clientName}`}
                            </Link>
                            <div className="hstack muted sm" style={{ gap: 6, marginTop: 2 }}>
                              <span className="mono">{q.number}</span>
                              <span className={`chip hchip ${TONE[q.status]}`}>{STATUS_LABELS[q.status]}</span>
                              <span className="chip hchip">{STAGE_LABELS[q.stage]}</span>
                              {q.category ? <span className="chip hchip">{q.category === 'LUXURY' ? 'Luxe' : q.category === 'PREMIUM' ? 'Premium' : 'Essential'}</span> : null}
                              {q.fromMarketplace ? <span className="chip hchip oi">One Interiors</span> : null}
                              {q.lineCount === 0 ? <span className="warn-t">No lines yet</span> : null}
                            </div>
                          </td>
                          <td>{q.config ?? '—'}</td>
                          <td className="r mono">{q.totalPaise > 0 ? formatINR(q.totalPaise) : '—'}</td>
                          <td className="mono">{isoDate(q.updatedAt)}</td>
                          <td className="r">
                            <span className="hstack" style={{ gap: 10, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              {/* Owner, 22 Nov 2026: copy this one for a new client — type the name, pick the lead. */}
                              {viewOnly ? null : (
                                <Link href={templateHref(q.id)} className="hmini" title="A new quotation with this one's rooms, items, rates and terms, for another client">
                                  Use as template
                                </Link>
                              )}
                              <Link href={href} className="hmini">
                                {viewOnly ? 'Open →' : q.status === 'DRAFT' ? 'Continue →' : 'Revise →'}
                              </Link>
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  return (
                    <tbody key={folder.key}>
                      {rows[0]}
                      {rows.length > 1 ? (
                        <OlderQuotes count={rows.length - 1} name={folder.name}>
                          {rows.slice(1)}
                        </OlderQuotes>
                      ) : null}
                    </tbody>
                  );
                })}
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

/** "Use as template": the New quotation form, opened with this quotation already picked to copy. */
const templateHref = (quoteId: string) => `/studio/quotations?new=1&from=${encodeURIComponent(quoteId)}#new`;

const isoDate = (d: Date) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * Quotations grouped by client: the client record when there is one, else the
 * name and phone as typed. Groups keep the order of their newest quotation.
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
