/**
 * The lines shown while a page is doing real work.
 *
 * ## Why humour, and why only here
 *
 * A wait is dead time, and dead time just before someone sees a nine-lakh-rupee
 * number gets filled by their own second thoughts. A line that makes them smile
 * costs nothing, and — more usefully — the wait is the one place on the site
 * where we can name what the alternative feels like without it reading as an
 * attack.
 *
 * These are funny because they are *true and specific*. "We are better than the
 * competition" is an advertisement. "Nobody is calling you right now" is a
 * shared experience, and the reader supplies the punchline themselves out of
 * their own memory of the last time they enquired about interiors.
 *
 * ## Why the lines are keyed by moment
 *
 * This is the part worth getting right. One shuffled list across every wait
 * would be easier and noticeably worse, because a different objection is live
 * at each stop, and a line that answers the wrong one is just noise:
 *
 *  - **quotes** — the first time they see money. The live question is *is this
 *    a lead-capture trick?* So: nobody is calling, nothing was forwarded, no
 *    salesperson exists.
 *  - **compare** — they have four numbers and are about to weigh them. The live
 *    question is *should I just take the cheapest?* This is the most
 *    commercially dangerous moment in the whole funnel: picking on price alone
 *    is precisely how people end up with the studio that stops answering. So
 *    the lines make delivery risk salient instead.
 *  - **expert** — about to ask for a call. The live question is *is this going
 *    to be a sales call?* So: nothing to buy, no commission, you may end it
 *    having chosen none of them.
 *
 * The mechanism claimed here is deliberately modest. Not that a joke plants a
 * belief — the flashier social-priming literature has had a rough decade of
 * replication — but the narrow, well-supported version: whatever is salient at
 * the moment of judgement gets weighted more heavily in it. Raising "will they
 * finish the job" a beat before a price table is a nudge toward the criterion
 * we actually think is right, not a trick.
 *
 * ## The four rules
 *
 * 1. **Never name a competitor.** Punch at behaviour everyone recognises, not
 *    at a company. There is a test enforcing this, because the temptation to
 *    add a sharper one grows with confidence.
 * 2. **Never joke about their money, and never on a failure.** These appear on
 *    waits only — never on the brief-rescue screen, never on "no studio can
 *    quote this yet". Someone whose brief just failed to load does not want us
 *    being charming at them.
 * 3. **Dry, not zany.** Humour raises liking, but slapstick immediately before
 *    a serious decision costs perceived competence, and competence is the
 *    entire thing we are selling.
 * 4. **Every line has to be literally true.** A joke that overclaims is still a
 *    claim. If one of these stops being true, it comes out.
 *
 * Pure and tested.
 */

export const WAIT_MOMENTS = ['quotes', 'compare', 'expert'] as const;
export type WaitMoment = (typeof WAIT_MOMENTS)[number];

export const WAIT_LINES: Record<WaitMoment, readonly string[]> = {
  /** Live objection: is this a trick to get my phone number? */
  quotes: [
    'Nobody is calling you right now. That took a surprising amount of engineering.',
    'Your phone number has not been forwarded to six companies. That is more or less the whole product.',
    'No one is going to ask you to come and see an experience centre.',
    'No salesperson has been assigned to you. There are no salespeople.',
    'This is being priced from a rate card, not from how expensive your flat sounds.',
    'We are working out what the work costs, not what you look like you can afford.',
    'Nobody has been told you are a hot lead. We do not have a word for that here.',
    'You will not be asked your budget by someone who has already been told your budget.',
    'No one is deciding which studio to push you towards. Nothing here can be bought.',
    'This is the part where a call centre would have already rung you twice.',
  ],

  /** Live objection: should I just take the cheapest one? */
  compare: [
    'The cheapest quote and the cheapest project are rarely the same thing.',
    'Two quotes ten percent apart are usually the same quote wearing different clothes.',
    'Lining these up so the difference is the work, and not the formatting.',
    'Nobody paid to be in the first column. There is no first column to buy.',
    'The row that decides this is probably not the last one.',
    'We are not hiding the one that came out dearer. It may well be the right one.',
    'Sorting by price is allowed. We would just rather you did not stop there.',
    'A quote is worth roughly what the company behind it is worth.',
    'Every number here is a range, because nobody has seen your flat. Anyone quoting an exact figure has not either.',
  ],

  /** Live objection: is this going to be a sales call? */
  expert: [
    'There is nothing to buy on this call. There is nothing to buy anywhere on this site.',
    'Whoever rings you is not paid more if you pick the expensive one.',
    'You are allowed to finish the call having decided none of them is right.',
    'Nobody is going to say they need to check with their manager.',
    'No one will ring back this evening to ask whether you have thought about it.',
    'We have already read your brief. You will not be explaining your flat again.',
    'This is not a discovery call. We did the discovering in the nine questions.',
    'Half an hour, and then we get out of the way.',
  ],
};

/**
 * One line for a given moment, chosen at random.
 *
 * Random per render rather than cycling in the browser: the wait is usually
 * short, so a rotating carousel would mostly show a line nobody finishes
 * reading, and it would still be animating after the page was ready. A single
 * line that changes between visits is calmer, and it rewards the second visit.
 *
 * Takes an optional picker so tests are deterministic without stubbing globals.
 */
export function waitLine(moment: WaitMoment, random: () => number = Math.random): string {
  const lines = WAIT_LINES[moment];
  const index = Math.floor(random() * lines.length);
  // Guard the boundary: Math.random() is [0, 1) so this cannot overflow, but a
  // caller-supplied picker can, and reaching past the end would put
  // `undefined` on the screen.
  return lines[Math.min(Math.max(index, 0), lines.length - 1)];
}
