/**
 * Questions for the expert call written from the customer's own brief — their
 * possession date, who lives there and what the home needs (build queue
 * item 9; plan §9).
 *
 * The price-gap questions come from their quotes (ExpertForm). These come
 * from their life: the call should open on what they are actually worried
 * about, and a family with a grandparent and a toddler is worried about
 * different things from a couple who both work from home.
 *
 * Offered to tick, never ticked for them. Pure, and tested.
 */

import type { Brief } from '@/modules/brief/types';
import { monthLabel } from '@/modules/brief/possession';

/** At most this many — the list is a prompt, not a questionnaire. */
export const MAX_BRIEF_QUESTIONS = 4;

export function briefQuestions(
  brief: Pick<Brief, 'possessionStatus' | 'possessionOn' | 'household' | 'needs'>,
): string[] {
  const out: string[] = [];

  // When they can start is the question every timeline hangs on — first.
  if (brief.possessionStatus === 'HAVE_KEYS') {
    out.push('I have the keys now — how soon can each studio actually start, and what should I do before they do?');
  } else if (brief.possessionStatus === 'EXPECTED') {
    const month = monthLabel(brief.possessionOn);
    out.push(
      month
        ? `Possession is expected in ${month} — when should design start so work begins when I get the keys?`
        : 'When should design start so work begins when I get the keys?',
    );
  } else if (brief.possessionStatus === 'NOT_SURE') {
    out.push('My possession date is not fixed — how do I line up a studio without paying for time I cannot use?');
  }

  const h = brief.household;
  if (h?.elderly) {
    out.push(
      `${h.elderly === 1 ? 'Someone elderly lives' : `${h.elderly} elderly people live`} with us — what should change in the bathroom and bedroom for them?`,
    );
  }
  if (h?.children) {
    out.push(
      `We have ${h.children === 1 ? 'a child' : `${h.children} children`} — which edges, finishes and fittings are safe, and what should their room grow into?`,
    );
  }
  if (h?.worksFromHome) out.push('I work from home — where should the study go, and what does it need for power, light and quiet?');
  if (h?.pets) out.push('We have pets — which laminates, fabrics and floors stand up to them?');

  const needs = new Set(brief.needs ?? []);
  if (needs.has('VASTU')) out.push('Which of these studios can plan to vastu without losing usable space?');
  if (needs.has('POOJA_ROOM')) out.push('Where should the mandir go, and what should it be made of?');
  if (needs.has('EXTRA_STORAGE')) out.push('Where can we add storage without making the rooms feel smaller?');
  if (needs.has('SMART_HOME')) out.push('What has to be wired now so smart-home fittings can go in later?');
  if (needs.has('LOW_MAINTENANCE')) out.push('Which of the quoted finishes are easiest to keep clean?');
  if (needs.has('ENTERTAINING')) out.push('How should the living and dining work when we have people over?');

  return out.slice(0, MAX_BRIEF_QUESTIONS);
}
