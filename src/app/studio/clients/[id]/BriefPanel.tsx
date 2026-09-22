import type { MarketplaceContext } from '@/modules/studio-practice/marketplace-context';

/**
 * The brief, for a lead that came from us.
 *
 * ## Why this is the biggest thing on the page
 *
 * A studio can buy a CRM anywhere. What nothing else gives them is a lead who
 * has already answered nine questions — household, budget, taste, timing, how
 * involved they want to be — before the studio has spent a rupee finding out.
 *
 * So it sits above the history rather than in the sidebar. A studio reading
 * this before the first call is the entire marketplace working; a studio that
 * never notices it is paying us for a board.
 *
 * ## Dislikes get their own row, emphasised
 *
 * Styles the customer ruled OUT are a hard filter in matching and the single
 * most useful line here. It is the one thing a studio would never think to
 * ask and would otherwise discover by presenting the wrong thing.
 */
export function BriefPanel({ ctx }: { ctx: MarketplaceContext }) {
  if (ctx.withdrawn) {
    return (
      <section className="rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5">
        <p className="m-0 text-[13.5px] leading-relaxed text-[var(--s-ink-2)]">
          This customer asked One Interiors to withdraw the introduction, so their brief is no
          longer available.
          {ctx.withdrawnReason ? ' Speak to us rather than to them.' : ''}
        </p>
      </section>
    );
  }

  /* Built then filtered, so a half-finished brief shows three rows instead of
     nine with "—" in six. A panel of dashes teaches people to stop reading. */
  const facts: { label: string; value: string | null }[] = [
    { label: 'Home', value: joinFacts(ctx.property, ctx.where, sqft(ctx.carpetSqft)) },
    { label: 'Wants', value: joinDots(ctx.scope, ctx.tier ? `${ctx.tier} finish` : null) },
    { label: 'Budget', value: ctx.budget },
    {
      label: 'Timing',
      value: ctx.moveInBy
        ? `Move in by ${ctx.moveInBy}`
        : ctx.possessionOn
          ? `Possession ${ctx.possessionOn}`
          : null,
    },
    { label: 'Household', value: householdLine(ctx) },
    { label: 'Involvement', value: ctx.involvement },
  ];

  const known = facts.filter((f) => f.value);

  return (
    <section className="rounded-[12px] border border-[var(--s-accent)]/30 bg-[var(--s-accent)]/[0.04] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 text-[15px] font-semibold">Their brief</h2>
        <span className="text-[12px] text-[var(--s-ink-3)]">
          Answered before we introduced you ·{' '}
          {ctx.introducedAt.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>

      <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {known.map((f) => (
          <div key={f.label} className="flex flex-col">
            <dt className="s-label text-[var(--s-ink-3)]">{f.label}</dt>
            <dd className="m-0 text-[13.5px] leading-snug">{f.value}</dd>
          </div>
        ))}
      </dl>

      {ctx.priorities.length > 0 ? (
        <div className="mt-3.5">
          <p className="s-label m-0 mb-1 text-[var(--s-ink-3)]">
            What matters most, in their order
          </p>
          <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {ctx.priorities.map((p, i) => (
              <li
                key={p}
                className="rounded-full border border-[var(--s-rule)] bg-[var(--s-rail)] px-2.5 py-1 text-[12.5px]"
              >
                <span className="s-num mr-1.5 text-[var(--s-ink-3)]">{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {ctx.likes.length > 0 ? (
        <Tags label="Styles they liked" items={ctx.likes} />
      ) : null}

      {ctx.dislikes.length > 0 ? (
        <div className="mt-3.5">
          <p className="s-label m-0 mb-1 text-[var(--s-ink-3)]">
            Ruled out — do not present these
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {ctx.dislikes.map((d) => (
              <li
                key={d}
                className="rounded-full border border-[var(--s-bad)]/30 px-2.5 py-1 text-[12.5px] text-[var(--s-bad)]"
              >
                {d}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ctx.appointments.length > 0 ? (
        <div className="mt-4 border-t border-[var(--s-rule)] pt-3">
          <p className="s-label m-0 mb-1.5 text-[var(--s-ink-3)]">Meetings arranged through us</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {ctx.appointments.map((a, i) => (
              <li key={i} className="text-[13px]">
                {a.startsAt.toLocaleString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                <span className="ml-2 text-[var(--s-ink-3)]">{a.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Tags({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3.5">
      <p className="s-label m-0 mb-1 text-[var(--s-ink-3)]">{label}</p>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {items.map((t) => (
          <li
            key={t}
            className="rounded-full border border-[var(--s-rule)] px-2.5 py-1 text-[12.5px]"
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function householdLine(ctx: MarketplaceContext): string | null {
  if (!ctx.household) return ctx.worksFromHome ? 'Somebody works from home' : null;
  return ctx.worksFromHome ? `${ctx.household} · somebody works from home` : ctx.household;
}

function sqft(n: number | null): string | null {
  return n ? `${n.toLocaleString('en-IN')} sqft` : null;
}

/* "3 BHK in Baner, 1,150 sqft" — the place joins with a space, the size with
   a comma. The same rule as `bridge-facts`: a comma before a preposition is
   the tell that a sentence was assembled by a machine. */
function joinFacts(property: string | null, where: string | null, size: string | null) {
  const place = [property, where ? `in ${where}` : null].filter(Boolean).join(' ');
  return [place || null, size].filter(Boolean).join(', ') || null;
}

function joinDots(...parts: (string | null)[]) {
  return parts.filter(Boolean).join(' · ') || null;
}
