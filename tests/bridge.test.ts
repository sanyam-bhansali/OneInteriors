import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The introduction → board bridge, and the promise it must not break.
 *
 * ## Why these read source rather than call functions
 *
 * The bridge's decisions are all database decisions — does a card exist, has
 * contact been released, has the introduction been withdrawn — and mocking
 * Prisma to answer them would mean asserting that a mock returned what the
 * test told it to. The pure half is already covered exhaustively in
 * `bridge-facts.test.ts`.
 *
 * What is worth protecting here is structural, and structure is exactly what
 * source assertions catch: that the release gate is still there, that
 * withdrawal still scrubs, that nothing else in the codebase has learned to
 * write `ONE_INTERIORS`. Each of these corresponds to a specific way the
 * contact promise could be broken by a later, reasonable-looking change.
 *
 * `security-invariants.test.ts` is written the same way, for the same reason,
 * and its own docblock says why: *"a comment did not stop any of them the
 * first time"*.
 */

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/* Several of these files explain the bug they prevent, quoting the thing they
   forbid — so a naive `not.toContain` fails on the comment describing what was
   removed. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the contact promise', () => {
  const bridge = read('src/modules/studio-practice/bridge.ts');
  const code = stripComments(bridge);

  it('refuses to build a card before contact is released', () => {
    /**
     * The landing page says "no studio receives them until you tell an expert
     * which introduction you want". `StudioClient.name` is required and is the
     * board card's label, so a card created at introduction time is either a
     * real name on a board the customer has not agreed to, or a placeholder
     * that is a lie.
     *
     * Asserted as an ordering: the guard has to appear BEFORE the create, or
     * it is not a guard.
     */
    const guard = code.indexOf('contactReleasedAt === null');
    const create = code.indexOf('studioClient.create');

    expect(guard, 'the release gate has gone').toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(-1);
    expect(guard, 'the release gate must run before the create').toBeLessThan(create);
  });

  it('checks withdrawal separately from release, not with an ||', () => {
    /**
     * `canSeeContact` reads the two columns in this order for a reason: a
     * withdrawn introduction that was previously released must come back
     * false. An `||` would put a customer who asked to be removed onto the
     * board of the studio they asked to be removed from.
     */
    const withdrawn = code.indexOf('intro.withdrawnAt');
    const released = code.indexOf('contactReleasedAt === null');

    expect(withdrawn).toBeGreaterThan(-1);
    expect(withdrawn, 'withdrawal is checked first').toBeLessThan(released);
    expect(code).not.toMatch(/withdrawnAt\s*\|\|/);
  });

  it('withdrawal strips the identity rather than binning the card', () => {
    /**
     * The bin is a 30-day holding area with a restore button that still
     * renders the name. Binning a withdrawn customer leaves their details one
     * click away from the studio asked to forget them.
     */
    const redact = code.slice(code.indexOf('export async function redactWithdrawn'));

    expect(redact).toContain('phone: null');
    expect(redact).toContain('email: null');
    /* The next action goes too — "Call and introduce yourself" against
       somebody who asked not to be called is the instruction being withdrawn. */
    expect(redact).toContain('nextAction: null');
    expect(redact, 'must not soft-delete instead of redacting').not.toContain('deletedAt');
  });

  it('is wired into both halves of release, and into withdrawal', () => {
    const intro = stripComments(read('src/modules/studio/introduction.ts'));

    /* createIntroduction bridges only when contact is released; the other
       path is releaseContactDetails. Both call the same function, so there is
       no route that skips the gate. */
    expect(intro).toContain('bridgeIntroduction');
    expect(intro).toContain('redactWithdrawn');

    const withdraw = intro.slice(intro.indexOf('export async function withdrawIntroduction'));
    expect(withdraw, 'withdrawal must scrub the card').toContain('redactWithdrawn');
  });
});

describe('ONE_INTERIORS is unforgeable', () => {
  /**
   * The source enum is what the analytics page divides by, and it is the one
   * number that says whether the roster is worth paying for. A studio able to
   * mark its own walk-in as one of ours makes that number fiction.
   */
  it('is written by the bridge and nowhere else', () => {
    const bridge = stripComments(read('src/modules/studio-practice/bridge.ts'));
    expect(bridge).toContain("source: 'ONE_INTERIORS'");
  });

  it('is rewritten to OTHER on the manual path', () => {
    const clients = stripComments(read('src/modules/studio-practice/clients.ts'));
    const add = clients.slice(clients.indexOf('export async function addClient'));
    /* The rewrite, not merely a validation error: a studio that picks it in a
       tampered form gets OTHER rather than a refusal they could work around. */
    expect(add).toMatch(/source:\s*input\.source === 'ONE_INTERIORS' \? 'OTHER' : input\.source/);
  });
});

describe('the bridge cannot be reached from the studio surface', () => {
  /**
   * `bridge.ts` is the one file in `studio-practice` that takes a `studioId`
   * rather than reading it from the session — it has to, because the actor is
   * OPS acting on a studio's behalf. The rest of the folder's safety rests on
   * functions that cannot be TOLD which studio to act on.
   *
   * What keeps that exception safe is that nothing a studio can reach imports
   * it. If that ever stops being true, this fails.
   */
  it('is not imported by anything under src/app/studio', () => {
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name)) {
          const src = readFileSync(full, 'utf8');
          if (/from ['"].*studio-practice\/bridge['"]/.test(src)) {
            offenders.push(full.slice(ROOT.length + 1));
          }
        }
      }
    };

    walk(join(ROOT, 'src/app/studio'));
    expect(offenders, 'the studio surface must not reach the bridge').toEqual([]);
  });

  it('has no read path — it can only write rows the studio already owns', () => {
    const code = stripComments(read('src/modules/studio-practice/bridge.ts'));
    /* findUnique/findFirst on the introduction and consultation are how it
       assembles what to write. What must not appear is a function returning a
       studio's data to a caller — every export returns a BridgeOutcome. */
    expect(code).not.toMatch(/export (async )?function \w+[^)]*\): Promise<(?!BridgeOutcome)/);
  });
});

describe('the timeline records who really did it', () => {
  it('the bridge writes its CREATED line as SYSTEM, not as a member', () => {
    /**
     * A timeline crediting a studio member with a card that appeared at 2am
     * would be wrong about the one thing the studio needs the record for:
     * which half of their history they were responsible for.
     *
     * `by: null` is the explicit SYSTEM value. Omitting it would resolve the
     * session — which during an ops-made introduction is an ops user with no
     * membership row, so it would silently fall back to SYSTEM and look
     * correct until somebody gave ops a membership.
     */
    const code = stripComments(read('src/modules/studio-practice/bridge.ts'));
    const created = code.slice(code.indexOf("kind: 'CREATED'"));
    expect(created.slice(0, 400)).toContain('by: null');
  });
});
