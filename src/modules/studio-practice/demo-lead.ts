/**
 * The sample lead — what it is, and the one rule that keeps it honest.
 *
 * ## Why a real row
 *
 * A new studio opens the board and finds nothing on it. The empty state is
 * well written and it still asks somebody to learn a kanban by imagining one.
 * So we put one lead there: a plausible enquiry, in their first column, with a
 * follow-up date and a note.
 *
 * It is a genuine `StudioClient`. It can be dragged between columns, edited,
 * given a date, assigned, quoted from and binned, because that is the lesson —
 * a painted-on example that falls over the moment somebody touches it teaches
 * the shape of the screen and nothing about the work.
 *
 * ## The rule: it is listed, never counted
 *
 * This is the whole risk of making it real, and it has exactly one mitigation:
 * **every aggregate excludes it, and they all import `LIVE` from here.**
 *
 * The leads walkthrough ticks its first step off `clientCount > 0`. Left in
 * the count, the sample would tick that step before the studio had done
 * anything, which is the precise failure `guide.ts` was written to avoid —
 * "a checklist somebody can complete without touching the product teaches
 * nothing and then lies about it afterwards". The morning screen would report
 * somebody waiting on a call who does not exist, and the studio's first
 * impression of our numbers would be a number that is wrong.
 *
 * So: one exported filter, spread into every `count`. A new count that forgets
 * it is a bug, and `tests/demo-lead.test.ts` fails on any `studioClient.count`
 * in the tree that does not carry it.
 *
 * ## Why it is not deleted automatically
 *
 * The obvious move is to remove it when the studio adds their first real
 * client. It is wrong: somebody halfway through learning the board, who adds a
 * real enquiry because the phone rang, would watch their example vanish
 * mid-lesson with no explanation. It stays until they remove it, and removing
 * it is one press.
 *
 * Pure, per CONTRIBUTING §9.5 — no `server-only`, so the screens, the server
 * actions and the tests read the same definitions.
 */

/**
 * The filter every count must carry.
 *
 * ```ts
 * prisma.studioClient.count({ where: { studioId, ...LIVE } })
 * ```
 *
 * `deletedAt: null` is already mandatory on every read of this table — see the
 * schema. Bundling the two means a count cannot pick up one rule and miss the
 * other.
 */
export const LIVE = { deletedAt: null, isDemo: false } as const;

/** The board and the bin list the sample; only aggregates drop it. */
export const LISTED = { deletedAt: null } as const;

/**
 * What the sample says.
 *
 * Deliberately a lead a Pune studio would recognise, and deliberately not a
 * flattering one: a 2 BHK at a budget that needs a conversation, not a villa
 * with an open chequebook. The note is the point of the screen — it is the
 * next thing owed to somebody, which is what makes the board worth opening
 * twice.
 *
 * The name is invented and reads as invented. It carries no phone number and
 * no email: a sample with a plausible mobile in it is a sample somebody
 * eventually rings.
 */
export const DEMO_LEAD = {
  name: 'Sample — Anita Kulkarni',
  society: 'Kumar Prospera',
  locality: 'Baner',
  city: 'Pune',
  config: '2 BHK',
  carpetSqft: 890,
  nextAction: 'Send the kitchen estimate she asked for',
  notes:
    'This is a sample so the board has something on it. Drag it to another ' +
    'column, change the date, open it — it behaves exactly like a real lead. ' +
    'Remove it whenever you like; it is not counted in any of your figures.',
  /** Days ahead of creation, so the sample is always usefully near. */
  followUpInDays: 2,
} as const;
