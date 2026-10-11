/**
 * The two markers every studio screen that touches a customer's project
 * uses (STUDIO-WORKSPACE-BUILD.md §7): a small "Customer sees this" (or
 * "Priya sees this") beside anything that reaches the customer's app, and a
 * grey "Only your team" box around what never does.
 */

export function CustomerSees({ name }: { name?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] font-medium text-[var(--s-accent)]"
      title="This reaches the customer's app"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {name ? `${name} sees this` : 'Customer sees this'}
    </span>
  );
}

export function OnlyYourTeam({ children, title = 'Only your team' }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--s-rule)] bg-[var(--s-surface-2)] p-3.5">
      <p className="m-0 mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--s-ink-2)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        {title}
      </p>
      {children}
    </div>
  );
}
