'use client';

/**
 * The main call to action, aware of whether you have been here before.
 *
 * ## Why this is not just a link to /quiz
 *
 * Every entry point on the site pointed at `/quiz`, which is right exactly
 * once — the first time. Come back after finishing the nine questions and the
 * button labelled "Get my quotes" walks you into question one, which reads as
 * the product having forgotten you rather than as a fresh start.
 *
 * So the button resumes. Where it goes is decided by how far the brief in this
 * browser actually got:
 *
 *  - nothing answered      → `/quiz`
 *  - answered, not finished → `/quiz` ("Finish your brief")
 *  - finished, no band      → `/tier`
 *  - band chosen           → `/quotes`
 *
 * ## Why the browser's copy and not the server's
 *
 * Reading a cookie on the landing page would make it dynamic — the hero image
 * and the first paint would then wait on a round trip to Mumbai on every visit,
 * for a personalisation almost no visitor needs. sessionStorage costs nothing,
 * and it is the copy that is always right anyway: it is written before the next
 * question renders, while the server copy is synced in the background.
 *
 * It renders the plain first-timer version on the server and during hydration,
 * so there is no flash of the wrong thing for the visitor who matters most.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { loadBrief } from '@/modules/brief/store';
import { isBriefComplete } from '@/modules/brief/types';

interface Resume {
  href: string;
  label: string;
  /** Shown beside the button, explaining why the label changed. */
  note: string | null;
}

const FRESH: Resume = {
  href: '/quiz',
  label: 'Get my quotes',
  note: null,
};

function resumeFrom(): Resume {
  const brief = loadBrief();

  if (isBriefComplete(brief) && brief.completedAt) {
    if (brief.tier) {
      return {
        href: '/quotes',
        label: 'See my quotes',
        note: 'You finished your brief — picking up where you left off.',
      };
    }
    return {
      href: '/tier',
      label: 'See what it costs',
      note: 'Your brief is done. One question left before your quotes.',
    };
  }

  if ((brief.lastStep ?? 0) > 1) {
    return {
      href: '/quiz',
      label: 'Finish my brief',
      note: `You were on question ${brief.lastStep}. Nothing was lost.`,
    };
  }

  return FRESH;
}

export function StartCta({
  size = 'lg',
  /** Shown next to the button for a first-time visitor. */
  fallbackNote,
}: {
  size?: 'md' | 'lg';
  fallbackNote?: string;
}) {
  const [resume, setResume] = useState<Resume>(FRESH);

  useEffect(() => {
    setResume(resumeFrom());
  }, []);

  const note = resume.note ?? fallbackNote ?? null;

  return (
    <>
      <Button href={resume.href} size={size}>
        {resume.label}
      </Button>
      {note ? <span className="text-[14.5px] text-[var(--color-ink-3)]">{note}</span> : null}
    </>
  );
}

/**
 * The compact version for the site header.
 *
 * One word, because the header is not where anyone reads an explanation — but
 * it must not say "Start" to someone who is four steps in, and it must not
 * throw them back to question one when they click it.
 */
export function StartLink() {
  const [resume, setResume] = useState<Resume>(FRESH);

  useEffect(() => {
    setResume(resumeFrom());
  }, []);

  const fresh = resume === FRESH;

  return (
    <Link
      href={resume.href}
      className="rounded-full bg-[var(--color-petrol)] px-4 py-2 text-[14px] font-medium text-[var(--color-paper)] no-underline transition-colors hover:bg-[var(--color-petrol-deep)]"
    >
      {fresh ? 'Start' : 'Continue'}
    </Link>
  );
}
