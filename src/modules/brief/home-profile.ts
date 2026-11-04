/**
 * "My Home Profile" (owner, 4 Nov 2026): everything a customer told us about
 * their home, in words, grouped the way they think about it, with their style
 * DNA on top. The same shape feeds the website page (/account/profile) and the
 * phone app (GET /api/app/v1/profile), so the two always say the same thing.
 *
 * Every answer comes from `briefAnswers`, the expert's pack, so a customer
 * sees exactly what our architect and their matched studios see. An answer not
 * given is left out, never shown as a dash.
 *
 * Pure, and tested.
 */

import { briefAnswers, type Answer } from '@/modules/consultation/answers';
import { styleDna, type StyleDna } from './style-dna';
import { localityLabel, propertyLabel, type Brief } from './types';
import { TIER } from '@/modules/quotation/tiers';
import { scopePhrase, selectionOf } from '@/modules/quotation/scope';

export interface HomeProfileGroup {
  id: 'home' | 'work' | 'budget' | 'style' | 'family' | 'ways';
  title: string;
  answers: Answer[];
}

export interface HomeProfile {
  /** "Priya's Home Profile", or "Your Home Profile" with no name. */
  title: string;
  /** "3 BHK · 1,050 sq ft · Baner". Null until the home is answered. */
  homeLine: string | null;
  /** "Full home · Premium". */
  planLine: string | null;
  dna: StyleDna | null;
  groups: HomeProfileGroup[];
  /** Answered every question (the brief's own `completedAt`). */
  complete: boolean;
}

const GROUPS: { id: HomeProfileGroup['id']; title: string; labels: string[] }[] = [
  { id: 'home', title: 'Your home', labels: ['Home', 'Where', 'Possession', 'Floor plan'] },
  { id: 'work', title: 'What you want done', labels: ['Scope', 'Left out'] },
  { id: 'budget', title: 'Budget', labels: ['Level'] },
  { id: 'style', title: 'Your style', labels: ['Likes', 'Rules out'] },
  { id: 'family', title: 'Who lives here', labels: ['Household', 'Needs'] },
  { id: 'ways', title: 'How you like to work', labels: ['Priorities', 'Involvement', 'Language'] },
];

export function homeProfile(brief: Brief, accountName?: string | null): HomeProfile {
  const answers = briefAnswers(brief);
  const name = (accountName || brief.contactName || '').trim().split(/\s+/)[0] ?? '';

  const groups = GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    answers: answers.filter((a) => g.labels.includes(a.label)),
  })).filter((g) => g.answers.length > 0);

  const homeLine =
    [
      propertyLabel(brief.propertyType),
      brief.carpetAreaSqft ? `${brief.carpetAreaSqft.toLocaleString('en-IN')} sq ft` : null,
      localityLabel(brief.locality),
    ]
      .filter(Boolean)
      .join(' · ') || null;

  const planLine =
    [brief.scope ? scopePhrase(selectionOf(brief)) : null, brief.tier ? TIER[brief.tier].label : null].filter(Boolean).join(' · ') ||
    null;

  return {
    title: name ? `${name}'s Home Profile` : 'Your Home Profile',
    homeLine,
    planLine,
    dna: styleDna(brief.styleLikes),
    groups,
    complete: Boolean(brief.completedAt),
  };
}
