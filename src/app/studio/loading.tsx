/**
 * What a studio page shows while it loads (speed, owner 14 Nov 2026: "the
 * loading speed is very slow").
 *
 * Without this, tapping a link in the studio did nothing visible until the
 * whole next page had been read from the database: the old page sat there and
 * the tap felt ignored. With it, the frame stays and this appears at once, and
 * Next.js can prefetch it for every link on screen.
 *
 * Plain blocks in the studio's own tokens, so it suits light and dark.
 */
const BLOCK: React.CSSProperties = {
  background: 'var(--fill2)',
  borderRadius: 10,
  animation: 's-pulse 1.6s ease-in-out infinite',
};

export default function StudioLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" data-testid="studio-loading" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 0', width: '100%' }}>
      <div style={{ ...BLOCK, height: 26, width: 'min(320px, 70%)' }} />
      <div style={{ ...BLOCK, height: 14, width: 'min(480px, 90%)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginTop: 8 }}>
        <div style={{ ...BLOCK, height: 110 }} />
        <div style={{ ...BLOCK, height: 110 }} />
        <div style={{ ...BLOCK, height: 110 }} />
      </div>
      <div style={{ ...BLOCK, height: 220 }} />
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Loading…</span>
    </div>
  );
}
