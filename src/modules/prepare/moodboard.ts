/**
 * Room proposals the customer reacts to, rather than a canvas they build on.
 *
 * ## The mechanic, and where it came from
 *
 * Planner5D's onboarding is three questions — room shape, dimensions, room type
 * and style — and then it *generates a furnished room for you*. There is a
 * Shuffle button. At no point does it ask a person with no design training to
 * design something. That is why a hundred million people got through it, and it
 * is the one thing from that product worth taking.
 *
 * What we do differently is the input. Planner5D has to ask its three questions
 * because it knows nothing about you. We have already asked nine, so a proposal
 * here starts from this customer's own liked styles, their own budget band and
 * their own household, and the first board they see is about their home rather
 * than a demo flat.
 *
 * ## Two rules that are not negotiable
 *
 * 1. **A disliked style never appears.** Q5 is a hard filter in the matching
 *    engine — `score.ts` removes a studio outright for it — and a prep pack
 *    that cheerfully proposes the one look the customer told us they hated
 *    would say, louder than any amount of copy, that we do not read the answers.
 *
 * 2. **Shuffle is deterministic.** The same room and the same shuffle count
 *    always produce the same board. Randomness would mean a customer cannot get
 *    back to the board they liked two taps ago, and it would mean this file
 *    could not be tested.
 *
 * Pure and tested. No `server-only` — see CONTRIBUTING §9.5.
 */

import { STYLE_TAGS, STYLE_LABELS, type StyleTag } from '@/modules/brief/types';
import { STYLE_PALETTES } from '@/modules/brief/palettes';
import type { RoomKey } from './rooms';

/**
 * The one choice in each room that actually moves the number.
 *
 * Every room has a dozen decisions in it and eleven of them are noise at this
 * stage. Naming one — and naming what it costs — is what turns a mood board
 * into preparation. A customer who arrives at the call already knowing they
 * want acrylic shutters and why has skipped twenty minutes of the conversation
 * that usually ends in a surprise.
 *
 * `direction` is the honest form of a price signal before any studio has
 * entered a rate card. We are saying which way a choice pushes the number, not
 * what the number is.
 */
export interface RoomDecision {
  question: string;
  options: { label: string; direction: 'less' | 'middle' | 'more'; note: string }[];
}

const DECISIONS: Record<RoomKey, RoomDecision> = {
  KITCHEN: {
    question: 'Shutter finish',
    options: [
      {
        label: 'Laminate',
        direction: 'less',
        note: 'Hard-wearing, enormous range, and what most Pune kitchens actually use.',
      },
      {
        label: 'Acrylic',
        direction: 'middle',
        note: 'The high-gloss look. Shows fingerprints; people either love it or regret it within a month.',
      },
      {
        label: 'Lacquered glass',
        direction: 'more',
        note: 'The most expensive shutter in a normal kitchen. Beautiful, and it doubles the shutter line.',
      },
    ],
  },
  LIVING: {
    question: 'How much of this room is carpentry?',
    options: [
      {
        label: 'Paint and loose furniture',
        direction: 'less',
        note: 'Cheapest by a distance, and the easiest to change in three years.',
      },
      {
        label: 'A TV unit and a false ceiling',
        direction: 'middle',
        note: 'The usual answer. Most of the visible change for a contained cost.',
      },
      {
        label: 'Full panelling',
        direction: 'more',
        note: 'Wall-to-wall joinery. Looks like the reference photos, and costs like them too.',
      },
    ],
  },
  BEDROOM_MAIN: {
    question: 'Wardrobe',
    options: [
      {
        label: 'Openable, standard height',
        direction: 'less',
        note: 'More usable shelf for the money. Needs door swing clearance.',
      },
      {
        label: 'Sliding',
        direction: 'middle',
        note: 'No swing space needed, so it suits a tighter room. You lose a third of the opening.',
      },
      {
        label: 'Floor to ceiling, with a loft',
        direction: 'more',
        note: 'The most storage per square foot in the flat, and the line most often cut late.',
      },
    ],
  },
  BEDROOM_2: {
    question: 'How far does this room go?',
    options: [
      { label: 'Wardrobe only', direction: 'less', note: 'Storage solved, nothing else touched.' },
      {
        label: 'Wardrobe and a bed unit',
        direction: 'middle',
        note: 'Built-in storage under the bed. Worth it in a 2 BHK.',
      },
      {
        label: 'Treated like the main bedroom',
        direction: 'more',
        note: 'Sensible if a parent or an adult child lives in it rather than a guest twice a year.',
      },
    ],
  },
  BEDROOM_3: {
    question: 'How far does this room go?',
    options: [
      { label: 'Wardrobe only', direction: 'less', note: 'Storage solved, nothing else touched.' },
      {
        label: 'Wardrobe and a study unit',
        direction: 'middle',
        note: 'The usual answer when a child is in this room.',
      },
      {
        label: 'Full fit-out',
        direction: 'more',
        note: 'Only if it is somebody’s actual bedroom rather than the spare.',
      },
    ],
  },
  BEDROOM_4: {
    question: 'How far does this room go?',
    options: [
      { label: 'Leave it for later', direction: 'less', note: 'A real option. Phasing is not failure.' },
      { label: 'Wardrobe only', direction: 'middle', note: 'Storage solved, nothing else touched.' },
      { label: 'Full fit-out', direction: 'more', note: 'Only if somebody is living in it from day one.' },
    ],
  },
  STUDY: {
    question: 'Desk',
    options: [
      {
        label: 'A bought desk in a corner',
        direction: 'less',
        note: 'Moves with you. Costs almost nothing in the project.',
      },
      {
        label: 'Built-in top with storage under',
        direction: 'middle',
        note: 'Fits the alcove properly, which a bought desk almost never does.',
      },
      {
        label: 'Full wall unit with shelving',
        direction: 'more',
        note: 'Worth it if you are on camera in this room every day.',
      },
    ],
  },
  BATHROOMS: {
    question: 'Are the bathrooms being touched?',
    options: [
      {
        label: 'Left as the builder handed them over',
        direction: 'less',
        note: 'Very common, and the single easiest way to protect the rest of the budget.',
      },
      {
        label: 'Fittings and mirrors changed',
        direction: 'middle',
        note: 'Most of the visible upgrade without breaking a tile.',
      },
      {
        label: 'Stripped and re-tiled',
        direction: 'more',
        note: 'Wet work. It is the line most likely to add weeks to the timeline, not just rupees.',
      },
    ],
  },
  BALCONY: {
    question: 'Balcony',
    options: [
      { label: 'Left open', direction: 'less', note: 'Nothing spent, and nothing lost.' },
      {
        label: 'Decking and planters',
        direction: 'middle',
        note: 'The cheapest square foot of delight in the whole flat.',
      },
      {
        label: 'Enclosed and absorbed into the room',
        direction: 'more',
        note: 'Check the society rules and the RERA plan before you fall in love with this one.',
      },
    ],
  },
};

export interface RoomProposal {
  room: RoomKey;
  style: StyleTag;
  styleLabel: string;
  /** Three named materials from the palette. A colour choice made concrete. */
  materials: [string, string, string];
  decision: RoomDecision;
  /** How many styles this room can be shuffled through before it repeats. */
  optionCount: number;
}

/**
 * Styles this customer may be shown, best first.
 *
 * Their own picks lead, in the order they picked them. Then everything sharing
 * a motif with something they liked — a person who chose Japandi is not
 * offended by Scandinavian. Then the rest. Dislikes are removed at the top and
 * never re-enter.
 *
 * Exported because the ordering is the interesting half and deserves its own
 * tests.
 */
export function candidateStyles(likes: StyleTag[], dislikes: StyleTag[]): StyleTag[] {
  const banned = new Set(dislikes);

  // Deduplicated, and not because the quiz produces duplicates — it does not.
  // `styleLikes` arrives from Postgres through a bare `as StyleTag[]` cast with
  // no runtime validation (see mapping.ts), so this array is whatever is in the
  // column. A repeat there would put the same style at two adjacent shuffle
  // positions, and the symptom is not a crash or a wrong board: it is a Shuffle
  // button that looks broken. `new Set` preserves insertion order, so the
  // customer's own ordering survives.
  const liked = [...new Set(likes)].filter((tag) => !banned.has(tag));

  const likedMotifs = new Set(liked.map((tag) => STYLE_PALETTES[tag].motif));
  const seen = new Set(liked);

  const adjacent: StyleTag[] = [];
  const rest: StyleTag[] = [];

  for (const tag of STYLE_TAGS) {
    if (banned.has(tag) || seen.has(tag)) continue;
    if (likedMotifs.has(STYLE_PALETTES[tag].motif)) adjacent.push(tag);
    else rest.push(tag);
  }

  const ordered = [...liked, ...adjacent, ...rest];

  // Everything banned is a real possibility: a customer can dislike enough
  // styles that nothing is left. Falling back to their own first like — even
  // though they also banned it — would be absurd, so we fall back to the whole
  // vocabulary minus the bans, and if they banned all twelve we show the first
  // tag rather than crashing a page they are mid-way through.
  return ordered.length > 0 ? ordered : [STYLE_TAGS[0]];
}

/**
 * The board for one room at one shuffle position.
 *
 * `shuffle` is a plain counter that the UI increments and stores. It wraps, so
 * a customer who keeps tapping comes back round to the first board rather than
 * hitting a dead end — and a negative or absurd value cannot throw, because it
 * arrives from a database column that a future migration might leave null.
 */
export function proposeRoom(
  room: RoomKey,
  likes: StyleTag[],
  dislikes: StyleTag[],
  shuffle: number,
): RoomProposal {
  const candidates = candidateStyles(likes, dislikes);
  const safeShuffle = Number.isFinite(shuffle) ? Math.trunc(shuffle) : 0;

  // `%` keeps the sign of the dividend in JavaScript, so a negative counter
  // would index off the front of the array. The double modulo is the cheap fix.
  const index = ((safeShuffle % candidates.length) + candidates.length) % candidates.length;
  const style = candidates[index];

  return {
    room,
    style,
    styleLabel: STYLE_LABELS[style],
    materials: STYLE_PALETTES[style].materials,
    decision: DECISIONS[room],
    optionCount: candidates.length,
  };
}

/** The decision for a room, without generating a whole board. */
export function decisionFor(room: RoomKey): RoomDecision {
  return DECISIONS[room];
}
