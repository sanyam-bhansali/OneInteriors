import { VIEW_AS_STOP_PATH } from '@/modules/studio/view-as-rules';

const ROLE_WORDS: Record<string, string> = {
  OWNER: 'Owner',
  PM: 'Project manager',
  SUPERVISOR: 'Site supervisor',
  ACCOUNTS: 'Accounts',
  SALES: 'Sales',
  DESIGNER: 'Designer',
};

/**
 * Developer access (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md): the banner
 * on every studio page while One Interiors staff look at the studio as one of
 * its people. A bar across the top and a Stop pill that stays in the corner
 * however far the page scrolls, so it cannot be missed or mistaken for the
 * person's own session.
 *
 * Stop is a plain form to its own route (no script needed), the one write the
 * middleware lets a viewing session make. The dimmed buttons below are a
 * courtesy only: the server refuses every write whatever the page shows.
 */
export function ViewAsBanner({ name, role, salesRole, studio, until }: { name: string; role: string; salesRole: string | null; studio: string; until: Date }) {
  const who = `${name} (${[ROLE_WORDS[role] ?? role, salesRole].filter(Boolean).join(', ')})`;
  const ends = until.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const stop = (label: string, testId: string) => (
    <form action={VIEW_AS_STOP_PATH} method="post" style={{ margin: 0, display: 'inline' }}>
      <button type="submit" data-view-as-stop="" data-testid={testId} style={STOP}>
        {label}
      </button>
    </form>
  );
  return (
    <>
      <style>{VIEW_ONLY_CSS}</style>
      <div role="status" aria-live="polite" data-testid="view-as-banner" style={BAR}>
        <span>
          <b>Viewing as {who}</b> · {studio} · read only · ends {ends}
        </span>
        {stop('Stop', 'view-as-stop')}
      </div>
      <div style={CORNER}>
        <span style={{ marginRight: 8 }}>Read only · {name}</span>
        {stop('Stop', 'view-as-stop-corner')}
      </div>
    </>
  );
}

const BAR: React.CSSProperties = {
  position: 'relative',
  zIndex: 1000,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '8px 16px',
  background: '#7a1f1f',
  color: '#fff',
  font: '500 13.5px/1.35 system-ui, sans-serif',
  textAlign: 'center',
};

const CORNER: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  padding: '6px 6px 6px 14px',
  borderRadius: 999,
  background: '#7a1f1f',
  color: '#fff',
  font: '500 12.5px/1.2 system-ui, sans-serif',
  boxShadow: '0 6px 20px rgba(0,0,0,.25)',
};

const STOP: React.CSSProperties = {
  border: '1px solid #fff',
  borderRadius: 999,
  padding: '4px 14px',
  background: '#fff',
  color: '#7a1f1f',
  font: '600 12.5px/1.2 system-ui, sans-serif',
  cursor: 'pointer',
};

/* Write buttons look unavailable while viewing (forms that post: server actions render as method="POST"). A courtesy, never the lock. */
const VIEW_ONLY_CSS = `[data-view-only] form[method="POST" i] button[type="submit"]:not([data-view-as-stop]),[data-view-only] form[method="POST" i] input[type="submit"]{opacity:.45;cursor:not-allowed}`;
