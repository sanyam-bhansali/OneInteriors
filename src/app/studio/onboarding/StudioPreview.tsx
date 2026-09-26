'use client';

import { PUNE_LOCALITIES } from '@/modules/brief/types';
import { MIN_ABOUT_LENGTH } from '@/modules/studio/onboarding-steps';
import { MapPin } from 'lucide-react';
import { INLINE_ICON } from './icon-sizes';

/**
 * What a customer will see, while the studio is still typing it.
 *
 * ## Why this is worth a column
 *
 * The description is the one field on this step that decides anything — it is
 * the first thing a homeowner reads and the reason they do or do not get in
 * touch. And it is written into a grey box on an admin screen, which is the
 * least like its destination that any field in the product gets.
 *
 * So the box is no longer the only thing on the page. Beside it is the card
 * their words actually land in: their name, the areas they picked, their
 * paragraph set the way a customer meets it. The feedback loop stops being
 * "write, submit, go and look" and becomes immediate.
 *
 * ## It is a preview, not a promise
 *
 * Deliberately labelled as roughly what a customer sees rather than exactly.
 * The real profile carries verification badges, project photographs and a
 * match score, none of which exist yet at this point in onboarding — and a
 * preview that claimed to be the finished article would be its own small lie,
 * the kind this flow has had to unpick twice already.
 */
export function StudioPreview({
  tradeName,
  about,
  localities,
  yearsActive,
  teamSize,
  minLakhs,
  maxLakhs,
}: {
  tradeName: string;
  about: string;
  localities: string[];
  yearsActive: string;
  teamSize: string;
  minLakhs: string;
  maxLakhs: string;
}) {
  const labels = localities
    .map((slug) => PUNE_LOCALITIES.find((l) => l.slug === slug)?.label ?? slug)
    .slice(0, 4);
  const more = localities.length - labels.length;

  const short = about.trim().length > 0 && about.trim().length < MIN_ABOUT_LENGTH;

  return (
    <aside className="oi-preview">
      <p className="label m-0 mb-2.5 flex items-center gap-2 text-[var(--color-ink-3)]">
        Roughly what a customer sees
        {/* A quiet live dot. It is the only thing on this page that moves as
            you type, which is the whole point of it being here. */}
        <span aria-hidden="true" className="oi-live-dot" />
      </p>

      <div className="overflow-hidden rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper)] shadow-[0_1px_2px_rgba(38,32,25,.04),0_10px_28px_-18px_rgba(38,32,25,.3)]">
        <span aria-hidden="true" className="block h-[3px] bg-[var(--color-petrol)]" />

        <div className="px-5 py-5">
          <p className="h3 m-0 text-[19px] leading-tight">{tradeName}</p>

          <p className="m-0 mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-[var(--color-ink-2)]">
            <MapPin {...INLINE_ICON} />
            <span>
              {labels.length > 0 ? (
                <>
                  {labels.join(', ')}
                  {more > 0 ? ` +${more} more` : ''}
                </>
              ) : (
                <span className="text-[var(--color-ink-3)]">No areas picked yet</span>
              )}
            </span>
          </p>

          {/* The facts a customer scans before reading a word of prose. Each
              appears only once it is true — a row reading "— years" is worse
              than no row. */}
          {yearsActive !== '' || teamSize !== '' || (minLakhs !== '' && maxLakhs !== '') ? (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--color-rule-soft)] pt-3.5">
              {yearsActive !== '' ? (
                <Fact
                  label="Working since"
                  value={
                    yearsActive === '0'
                      ? 'This year'
                      : `${new Date().getFullYear() - Number(yearsActive)}`
                  }
                />
              ) : null}
              {teamSize !== '' ? <Fact label="Team" value={`${teamSize}`} /> : null}
              {minLakhs !== '' && maxLakhs !== '' ? (
                <Fact label="Projects" value={`₹${minLakhs}L – ₹${maxLakhs}L`} />
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 border-t border-[var(--color-rule-soft)] pt-3.5">
            {about.trim() ? (
              <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
                {about}
              </p>
            ) : (
              <p className="m-0 text-[13.5px] italic leading-relaxed text-[var(--color-ink-3)]">
                Your description appears here as you write it. This is the part a customer reads
                before anything else.
              </p>
            )}

            {short ? (
              /* Shown on the preview rather than only under the box, because
                 this is where somebody can see for themselves that it reads
                 as thin. */
              <p className="m-0 mt-2 text-[12px] text-[var(--color-brass)]">
                Short enough that it will read as a placeholder.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <p className="m-0 mt-2.5 text-[12px] leading-relaxed text-[var(--color-ink-3)]">
        The real one also carries your projects, your verification badge and how well you match
        that particular home.
      </p>
    </aside>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="label m-0 block text-[9.5px] text-[var(--color-ink-3)]">{label}</span>
      <span className="block text-[13.5px] font-medium text-[var(--color-ink)]">{value}</span>
    </span>
  );
}

