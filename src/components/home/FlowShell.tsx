/**
 * The landing page's canvas for the customer flow — quiz, matches, quote,
 * compare, expert call (owner, 10 Oct 2026).
 *
 * `.cb` brings the landing's tokens, type, pills, tiles and motion; `.oi-app`
 * keeps the flow's own token names resolving to the same palette, so the
 * screens built on `--ink2`, `--card`, `--acc` keep working while they move
 * onto the landing's classes. The cursor dot and the scroll reveals come
 * from the same `CbMotion` the home page runs.
 */

import { CbMotion } from './CbMotion';

export function FlowShell({
  children,
  className = '',
  cursor = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** The landing's cursor dot. Off for screens that are mostly typing. */
  cursor?: boolean;
}) {
  return (
    <div className={`cb oi-app flow ${className}`}>
      {cursor ? (
        <div className="cursor" aria-hidden="true">
          <span className="cursor-label" />
        </div>
      ) : null}
      {children}
      <CbMotion />
    </div>
  );
}
