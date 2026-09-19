'use client';

/**
 * The studio's work, sliding out from behind the card.
 *
 * ## What this is
 *
 * Two panels parked directly behind the card, one either side. Hover (or tab
 * into) the card and they slide outward and fade up, so the studio's actual
 * projects appear without the reader leaving the list or opening anything.
 *
 * ## Real projects, not samples
 *
 * These are the studio's own portfolio rows — title, locality, what it cost
 * and how long it took. `images` is empty on every fixture today, so the
 * photograph slot renders as a tinted plate carrying the locality and a note
 * saying the photograph is still to come. When real images land, the one
 * change is swapping that plate for an `<Image>`; nothing else here moves.
 *
 * Saying "photo to come" rather than shipping a grey box is the same rule the
 * rest of the product follows: an unmeasured value renders as unmeasured.
 *
 * ## Why they are only on wide screens
 *
 * They live in the margin beside a 40rem list. Below about 1280px that margin
 * does not exist, and an absolutely positioned panel with nowhere to go either
 * overlaps the card or pushes the page into a horizontal scroll. So the CSS
 * gates them at 1280px and they are simply not rendered as a visual layer
 * below it — the same work is one press away under "Their work" at any width.
 *
 * ## Keyboard and screen readers
 *
 * `:focus-within` reveals them too, so tabbing through a card shows its work
 * the same way hovering does. They stay in the DOM and are not `aria-hidden`:
 * the content is real and a screen reader user should get it rather than a
 * hover-gated secret.
 */

import { formatINRCompact } from '@/lib/money';
import type { PortfolioProject } from '@/modules/studio/types';

function Plate({ project }: { project: PortfolioProject }) {
  return (
    <article className="q-plate">
      {/* The photograph goes here. Empty on every studio today, and labelled
          rather than dressed up as a picture. */}
      <div className="q-plate-photo" aria-hidden>
        <span className="oi-label">Photo to come</span>
      </div>
      <p className="oi-num m-0 mt-2.5 text-[13px] font-semibold leading-tight text-[var(--ink)]">
        {project.title}
      </p>
      <p className="oi-label m-0 mt-1.5">
        {[
          project.valuePaise ? formatINRCompact(project.valuePaise) : null,
          project.durationDays ? `${project.durationDays} days` : null,
        ]
          .filter(Boolean)
          .join('  ·  ')}
      </p>
    </article>
  );
}

export function ProjectWings({
  projects,
  studioName,
}: {
  projects: PortfolioProject[];
  studioName: string;
}) {
  if (projects.length === 0) return null;

  const left = projects.slice(0, 2);
  const right = projects.slice(2, 4);

  return (
    <>
      <aside className="q-wing q-wing-l" aria-label={`Work by ${studioName}`}>
        {left.map((p) => (
          <Plate key={p.id} project={p} />
        ))}
      </aside>

      {right.length > 0 ? (
        <aside className="q-wing q-wing-r" aria-label={`More work by ${studioName}`}>
          {right.map((p) => (
            <Plate key={p.id} project={p} />
          ))}
        </aside>
      ) : null}
    </>
  );
}
