'use client';

/**
 * Side by side.
 *
 * ## The screen the whole product is an argument for
 *
 * The landing page's Problem section holds up three quotes for one flat that
 * line up on nothing — four lines on a letterhead, a photograph of a printout,
 * eleven pages with no total. This is the answer to that, and it only works
 * because of a decision made three files away: **we own the line items.** Every
 * studio is priced on the same catalogue at their own rates, so the labels and
 * the sizes are identical down every column and the eye can travel across a row.
 *
 * ## What the reader is actually meant to notice
 *
 * Not the totals. Two quotes ₹1.25 L apart are usually not both more expensive
 * — one has thicker board in it. So the material sits under every amount, and
 * a row where the studios disagree about it is pulled to the top of the page
 * under "Where the difference is". That short list is what an architect would
 * point at, and it is the difference between a comparison and a price list.
 *
 * ## Why a missing line is a row and not a gap in the maths
 *
 * A studio who did not price the mandir is usually the cheapest studio, and
 * the reason is that they are not building a mandir. Dropping the row would
 * make their total look like better value; showing it as "not quoted" — never
 * as ₹0, which reads as free — makes it a decision.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatINRCompact } from '@/lib/money';
import { compareMany, type ComparedLine } from '@/modules/quotation/first-quote';
import { loadProject, saveProject, MIN_TO_COMPARE, type Project } from '@/modules/quotation/project-store';
import { ratesAreReal } from '@/data/filed-rates';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { Wrap, Chapter, Sheet, Quiet, Flag } from '@/components/oi';

const money = (p: number | null) => (p === null ? null : formatINRCompact(p));

/** One studio's column width. Wide enough for a material, narrow enough for four. */
const COL = 'min-w-[13.5rem]';

export function CompareClient() {
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => setProject(loadProject()), []);

  const entries = useMemo(() => {
    if (!project) return [];
    return project.comparing
      .map((slug) => project.quotes[slug])
      .filter((q): q is NonNullable<typeof q> => q !== undefined)
      .map((q) => ({ slug: q.studioSlug, name: q.studioName, quote: q.quote }));
  }, [project]);

  const comparison = useMemo(
    () => (entries.length >= MIN_TO_COMPARE ? compareMany(entries) : null),
    [entries],
  );

  if (!project) return null;

  const drop = (slug: string) => {
    const next = { ...project, comparing: project.comparing.filter((s) => s !== slug) };
    setProject(next);
    saveProject(next);
  };

  if (!comparison) {
    return (
      <div className="oi-app min-h-dvh bg-[var(--bg)]">
        <AppHeader />
        <Spine at="compare" />
        <Wrap className="py-12">
          <Chapter eyebrow="Side by side" title="Two quotes, and this page starts working.">
            One quote compared with nothing is a quote. Price a second studio and every line lands
            beside its opposite number — same item, same size, their materials and their price.
          </Chapter>
          <Sheet className="p-8">
            <Quiet href="/match">Back to your matches</Quiet>
          </Sheet>
        </Wrap>
        <AppFooter />
      </div>
    );
  }

  const { studios, rooms, tellingRows } = comparison;
  const cheapestTotal = Math.min(...studios.map((s) => s.quote.totalPaise));

  return (
    <div className="oi-app min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Spine
        at="compare"
        facts={[
          { id: 'quote', fact: `${Object.keys(project.quotes).length} priced` },
          { id: 'compare', fact: `${studios.length} side by side` },
        ]}
      />

      <Wrap className="py-12">
        <Chapter
          eyebrow="Side by side"
          title={`${studios.length} quotes, written to the same lines.`}
          aside={
            <p className="oi-num m-0 whitespace-nowrap text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink2)]">
              Same item · same size · their materials
            </p>
          }
        >
          Every studio is priced on our line items at their own rates, so a row means the same
          thing all the way across. Look at the materials before the totals.
        </Chapter>

        {!ratesAreReal() ? (
          <p className="m-0 mb-8">
            <Flag>Pre-launch — priced on archive rates, not each studio&rsquo;s own filed card</Flag>
          </p>
        ) : null}

        {/* ── The totals ── */}
        <div className="mb-10 grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(15rem,1fr))` }}>
          {studios.map((s) => {
            const isLowest = s.quote.totalPaise === cheapestTotal;
            return (
              <Sheet key={s.slug} className="p-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="oi-display m-0 text-[18px]">{s.name}</h2>
                  <button
                    type="button"
                    onClick={() => drop(s.slug)}
                    aria-label={`Remove ${s.name} from the comparison`}
                    className="oi-num cursor-pointer border-0 bg-transparent p-0 text-[9.5px] uppercase tracking-[0.16em] text-[var(--ink2)] hover:text-[var(--ink)]"
                  >
                    Remove
                  </button>
                </div>
                <p className="oi-num m-0 text-[24px] leading-none">
                  {money(s.quote.totalPaise)}
                </p>
                <p className="oi-num m-0 mt-2 text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                  {money(s.quote.lowPaise)}–{money(s.quote.highPaise)}
                </p>
                <p className="oi-num m-0 mt-3 border-t border-[var(--line)] pt-3 text-[10.5px] uppercase tracking-[0.12em] text-[var(--ink2)]">
                  Factory {money(s.quote.modularPaise)} · site {money(s.quote.nonModularPaise)}
                </p>
                {isLowest && studios.length > 1 ? (
                  <p
                    className="oi-num m-0 mt-3 text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: 'var(--sec-ink)' }}
                  >
                    Lowest total — read the materials below
                  </p>
                ) : null}
              </Sheet>
            );
          })}
        </div>

        {/* ── Where the difference is ── */}
        {tellingRows.length > 0 ? (
          <Sheet className="mb-10 p-6">
            <p className="oi-eyebrow m-0 mb-4">Where the difference is</p>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {tellingRows.map((row) => (
                <li key={row.code} className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0">
                  <p className="m-0 mb-1.5 flex flex-wrap items-baseline justify-between gap-3">
                    <span className="text-[14.5px] font-medium">{row.label}</span>
                    {row.spreadPaise > 0 ? (
                      <span className="oi-num text-[13px]" style={{ color: 'var(--acc-ink)' }}>
                        {money(row.spreadPaise)} apart
                      </span>
                    ) : null}
                  </p>
                  {row.materialsDiffer ? (
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {row.cells.map((cell) => {
                        const studio = studios.find((s) => s.slug === cell.slug)!;
                        return (
                          <li key={cell.slug} className="text-[13px] leading-snug text-[var(--ink2)]">
                            <span className="text-[var(--ink)]">{studio.name}</span>
                            {' — '}
                            {cell.spec ?? 'not quoted'}
                          </li>
                        );
                      })}
                    </ul>
                  ) : row.cells.some((c) => c.amountPaise === null) ? (
                    <p className="m-0 text-[13px] leading-snug text-[var(--ink2)]">
                      {row.cells
                        .filter((c) => c.amountPaise === null)
                        .map((c) => studios.find((s) => s.slug === c.slug)?.name)
                        .join(', ')}{' '}
                      did not quote this at all — which is usually why a total is lower.
                    </p>
                  ) : (
                    <p className="m-0 text-[13px] leading-snug text-[var(--ink2)]">
                      Same material both sides. This one is a straight price difference.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Sheet>
        ) : null}

        {/* ── Every line ──
            Scrolls sideways with the item pinned, which is what lets the
            comparison take any number of studios rather than three. */}
        <div className="oi-rail overflow-x-auto border border-[var(--line)] bg-[var(--card)]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="oi-label sticky left-0 z-10 border-b border-[var(--ink)] bg-[var(--card)] p-4 align-bottom"
                >
                  Line item
                </th>
                {studios.map((s) => (
                  <th
                    key={s.slug}
                    scope="col"
                    className={`border-b border-[var(--ink)] p-4 align-bottom ${COL}`}
                  >
                    <span className="oi-display block text-[15px]">{s.name}</span>
                  </th>
                ))}
              </tr>
            </thead>

            {rooms.map((room) => (
              <tbody key={room.room}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={studios.length + 1}
                    className="oi-label sticky left-0 bg-[var(--bg)] px-4 py-2.5 text-left"
                  >
                    {room.label}
                  </th>
                </tr>
                {room.lines.map((line: ComparedLine) => (
                  <tr key={line.code}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-[var(--line)] bg-[var(--card)] p-4 align-top font-normal"
                    >
                      <span className="block text-[14.5px] font-medium">{line.label}</span>
                      <span className="oi-num mt-1 block text-[12px] leading-snug text-[var(--ink2)]">
                        {line.size}
                      </span>
                    </th>

                    {line.cells.map((cell) => {
                      const best = line.cheapest.includes(cell.slug);
                      return (
                        <td
                          key={cell.slug}
                          className={`border-b border-[var(--line)] p-4 align-top ${COL}`}
                        >
                          {cell.amountPaise === null ? (
                            // Never ₹0 — a zero reads as free.
                            <Flag>Not quoted</Flag>
                          ) : (
                            <>
                              <span
                                className="oi-num block text-[14px]"
                                style={best ? { color: 'var(--sec-ink)' } : undefined}
                              >
                                {money(cell.amountPaise)}
                              </span>
                              {/* The material, at 13px in full ink. It is the
                                  reason this screen exists; setting it as fine
                                  print would be the same mistake every quote
                                  in the Problem section makes. */}
                              <span className="mt-1.5 block text-[13px] leading-[1.45] text-[var(--ink)]">
                                {cell.spec}
                              </span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}

            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="oi-label sticky left-0 z-10 border-t border-[var(--ink)] bg-[var(--card)] p-4 text-left"
                >
                  Total · GST incl.
                </th>
                {studios.map((s) => (
                  <td
                    key={s.slug}
                    className={`border-t border-[var(--ink)] p-4 ${COL}`}
                  >
                    <span className="oi-num text-[17px]">{money(s.quote.totalPaise)}</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Quiet href="/match">Price another studio</Quiet>
          <Link
            href="/expert"
            className="px-5 py-3 text-[14px] font-medium text-white no-underline"
            style={{ background: 'var(--acc-btn)' }}
          >
            Have an architect read these with you
          </Link>
        </div>

        <p className="m-0 mt-6 max-w-[62ch] text-[13px] leading-[1.6] text-[var(--ink2)]">
          Every quote here is the standard scope, priced before anybody has stood in your flat.
          The bands say how far each could move. Your architect is paid by us and never by a
          studio, which is the only arrangement under which their reading of this is worth having.
        </p>
      </Wrap>

      <AppFooter />
    </div>
  );
}
