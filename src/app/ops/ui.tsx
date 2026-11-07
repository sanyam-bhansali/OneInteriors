/**
 * Ops chrome now lives in the ops layout (OpsShell: the studio app's look,
 * owner 7 Nov 2026). Pages still render <OpsHeader />; it draws nothing, so
 * they need no change.
 */
export function OpsHeader() {
  return null;
}

/** Checks complete, as a bar. Colour follows completeness, shape carries it too. */
export function TierProgress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const tone =
    pct === 100
      ? 'bg-[var(--color-ontrack)]'
      : pct >= 60
        ? 'bg-[var(--color-brass)]'
        : 'bg-[var(--color-atrisk)]';
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-paper-3)]">
        <span className={`block h-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-ink-2)]">
        {done}/{total}
      </span>
    </div>
  );
}
