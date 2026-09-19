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
 * ## The ticks are their own column, further out
 *
 * Four rounded glass pills a side, beyond the plates rather than beneath
 * them, top-aligned with the work. So the card opens into two layers: the
 * studio's work immediately either side, and what we checked about them
 * outside that. Reading outward, it is "here is what they built" then "here
 * is why you can believe it" — which is the argument the page is making, laid
 * out left to right.
 *
 * Stacked under the plates they read as a footnote to the photographs, which
 * is the wrong relationship: the checks are about the studio, not about the
 * projects.
 *
 * They are the short form on purpose. The long version — what each check
 * means, who performed it and when — is the profile's job; here there is a
 * narrow column and about two seconds, and fifteen rows of it would be
 * wallpaper rather than evidence. `studioProof` decides which few appear and
 * says how many are left.
 *
 * Only PASS produces a tick. A pending or expired check is not shown at all
 * and is not counted in the "more" figure either.
 *
 * ## A drawer, not a reveal
 *
 * Scrolling the card into the middle of the viewport opens both columns;
 * scrolling away shuts them again. Hovering or tabbing into a card opens them
 * wherever it sits. Nothing latches.
 *
 * Out and back run in the same order — plates first, ticks after — so closing
 * reads as the drawer shutting rather than as the animation played in
 * reverse. The delays live in both the open and closed CSS states to do it.
 *
 * ## Why they are only on wide screens
 *
 * They live in the margin beside a 40rem list. Below about 1280px that margin
 * does not exist, and an absolutely positioned panel with nowhere to go either
 * overlaps the card or pushes the page into a horizontal scroll. So the CSS
 * gates the plates at 1280px, and the ticks — which sit outside the plates and
 * so need roughly 170px more a side — at 1400px. Below each threshold they are
 * simply not rendered as a visual layer; the same work and the same checks are
 * one press away under "Their work" at any width.
 *
 * ## Keyboard and screen readers
 *
 * `:focus-within` reveals them too, so tabbing through a card shows its work
 * the same way hovering does. They stay in the DOM and are not `aria-hidden`:
 * the content is real and a screen reader user should get it rather than a
 * hover-gated secret.
 */

import { formatINRCompact } from '@/lib/money';
import { Drawer, Pill, PillNote } from '@/components/oi/Surfaces';
import { studioProof, type ProofChip } from '@/modules/studio/proof';
import type { PortfolioProject, VerificationCheck } from '@/modules/studio/types';

/**
 * One check, one pill.
 *
 * The source rides along in the title rather than on the face of the pill.
 * It is the thing that makes the claim checkable, so it must be reachable —
 * but it is a second sentence, and the pill has room for one.
 */
function Check({ chip, i }: { chip: ProofChip; i: number }) {
  return (
    <Pill
      i={i}
      text={chip.text}
      title={chip.source ? `${chip.label} — ${chip.source}` : chip.label}
    />
  );
}

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
  checks,
  studioName,
}: {
  projects: PortfolioProject[];
  checks: VerificationCheck[];
  studioName: string;
}) {
  const proof = studioProof(checks, 4);

  // Nothing to fan out on either count means no wings at all, rather than
  // empty frames beside the card.
  if (projects.length === 0 && proof.passed === 0) return null;

  const left = projects.slice(0, 2);
  const right = projects.slice(2, 4);

  return (
    <>
      {/* ── Inner layer: their work ── */}
      {left.length > 0 ? (
        <Drawer side="left" label={`Work by ${studioName}`}>
          {left.map((p) => (
            <Plate key={p.id} project={p} />
          ))}
        </Drawer>
      ) : null}

      {right.length > 0 ? (
        <Drawer side="right" label={`More work by ${studioName}`}>
          {right.map((p) => (
            <Plate key={p.id} project={p} />
          ))}
        </Drawer>
      ) : null}

      {/* ── Outer layer: what we checked ── */}
      {proof.left.length > 0 ? (
        <Drawer as="ul" side="left" layer="far" label={`Checks ${studioName} has passed`}>
          {proof.left.map((chip, i) => (
            <Check key={chip.type} chip={chip} i={i} />
          ))}
        </Drawer>
      ) : null}

      {proof.right.length > 0 ? (
        <Drawer as="ul" side="right" layer="far">
          {proof.right.map((chip, i) => (
            <Check key={chip.type} chip={chip} i={i} />
          ))}

          {/* Said rather than implied. Eight ticks beside a card could read as
              "eight checks exist"; this is the only thing on screen that stops
              it doing so. */}
          {proof.more > 0 ? (
            <PillNote i={proof.right.length}>+{proof.more} more on their profile</PillNote>
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}
