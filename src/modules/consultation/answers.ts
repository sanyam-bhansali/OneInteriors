/**
 * Every answer in the brief, in words — for the expert's pack, so the
 * customer never has to repeat themselves on the call (plan §9).
 *
 * One line per answer, in the order the brief asked them, and an answer that
 * was not given is left out rather than printed as a dash: the pack is read
 * in the minute before dialling, and blanks bury what is there.
 *
 * Pure, and tested.
 */

import {
  HOME_NEED_LABELS,
  INVOLVEMENT_LABELS,
  LANGUAGE_LABELS,
  PRIORITY_LABELS,
  STYLE_LABELS,
  localityLabel,
  propertyLabel,
  type Brief,
} from '@/modules/brief/types';
import { possessionPhrase } from '@/modules/brief/possession';
import { scopePhrase, selectionOf } from '@/modules/quotation/scope';
import { ITEM } from '@/modules/quotation/catalogue';
import { TIER } from '@/modules/quotation/tiers';
import { formatINRCompact } from '@/lib/money';

export interface Answer {
  label: string;
  value: string;
}

export function briefAnswers(brief: Brief): Answer[] {
  const out: Answer[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) out.push({ label, value });
  };

  add('Name', brief.contactName);
  add(
    'Home',
    [propertyLabel(brief.propertyType), brief.carpetAreaSqft ? `${brief.carpetAreaSqft.toLocaleString('en-IN')} sq ft` : null]
      .filter(Boolean)
      .join(', '),
  );
  add('Where', [brief.society, localityLabel(brief.locality)].filter(Boolean).join(', '));
  if (brief.planReading) {
    const p = brief.planReading;
    add(
      'Floor plan',
      `Read and confirmed: ${p.bathrooms} bathroom${p.bathrooms === 1 ? '' : 's'}${p.kitchenRunMm ? `, kitchen platform ${p.kitchenRunMm.toLocaleString('en-IN')} mm` : ''}${p.hasStudy ? ', a study' : ''}`,
    );
  } else if (brief.floorPlanName) {
    add('Floor plan', `${brief.floorPlanName} (not read)`);
  }
  add('Possession', possessionPhrase(brief));
  add('Scope', scopePhrase(selectionOf(brief)));
  if (brief.excludedItems.length > 0) {
    add('Left out', brief.excludedItems.map((c) => ITEM[c]?.label ?? c).join(', '));
  }
  add(
    'Level',
    brief.tier
      ? `${TIER[brief.tier].label}${
          brief.budgetMinPaise
            ? ` — ${formatINRCompact(brief.budgetMinPaise)}${brief.budgetMaxPaise ? `–${formatINRCompact(brief.budgetMaxPaise)}` : ' and up'} for a full home`
            : ''
        }`
      : null,
  );
  add('Likes', brief.styleLikes.map((s) => STYLE_LABELS[s]).join(', '));
  add('Rules out', brief.styleDislikes.map((s) => STYLE_LABELS[s]).join(', '));
  const h = brief.household;
  if (h) {
    const parts = [`${h.adults} adult${h.adults === 1 ? '' : 's'}`];
    if (h.children) parts.push(`${h.children} child${h.children === 1 ? '' : 'ren'}`);
    if (h.elderly) parts.push(`${h.elderly} elderly parent${h.elderly === 1 ? '' : 's'}`);
    if (h.pets) parts.push('pets');
    if (h.worksFromHome) parts.push('someone works from home');
    add('Household', parts.join(', '));
  }
  add('Needs', brief.needs.map((n) => HOME_NEED_LABELS[n]).join(', '));
  add('Priorities', brief.priorityRanking.map((p, i) => `${i + 1}. ${PRIORITY_LABELS[p]}`).join('  '));
  add('Involvement', brief.involvement ? INVOLVEMENT_LABELS[brief.involvement] : null);
  add('Language', brief.language ? LANGUAGE_LABELS[brief.language] : null);
  return out;
}
