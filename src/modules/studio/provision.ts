import 'server-only';

/**
 * Everything a new studio's workspace needs, written once, when the studio is
 * created.
 *
 * ## The problem this solves
 *
 * Three surfaces used to provision themselves on READ. `myProducts()` counted
 * the catalogue and seeded it if empty; `myStages()` fetched the pipeline,
 * seeded it if empty, then fetched again; the leads board called
 * `seedDemoLead()` before every query. All three are idempotent and none is
 * expensive on its own — but they turn every page render into a
 * write-capable transaction through the connection pooler, and
 * `/studio/quotations` triggers two of them concurrently.
 *
 * At one studio that is invisible. At a hundred it is a write transaction
 * opened on every page view of the whole roster, to discover that nothing
 * needs writing.
 *
 * So provisioning happens once, at approval, where it belongs: the same
 * transaction-adjacent moment that already creates the `Studio`, the `User`
 * and the `StudioMember`.
 *
 * ## The lazy paths stay
 *
 * Not as a fallback for this function failing — as the migration path for
 * every studio created before it existed. They are already written to be
 * no-ops once the rows are there, so a provisioned studio pays one indexed
 * count and nothing else. They can be deleted once no studio predates this
 * file; until then, removing them would leave existing studios with an empty
 * catalogue and no way to get one.
 *
 * ## It never throws
 *
 * A studio with no starter catalogue can still be approved, sign in and add
 * their own products. A studio that could not be approved because a demo lead
 * failed to insert is a worse outcome than either, so every step here logs
 * and continues.
 */

import { prisma } from '@/lib/prisma';
import { starterRowsFor } from '@/modules/studio-quote/starter-catalogue';
// The pure vocabulary, not the `server-only` service that also reads it.
import { DEFAULT_STAGES } from '@/modules/studio-practice/vocabulary';

export interface ProvisionResult {
  products: number;
  stages: number;
}

export async function provisionWorkspace(studioId: string): Promise<ProvisionResult> {
  const result: ProvisionResult = { products: 0, stages: 0 };

  try {
    /* `skipDuplicates` against the (studioId, name) unique index, so running
       this twice — a re-approval, a retry — adds nothing. */
    const products = await prisma.studioProduct.createMany({
      data: starterRowsFor(studioId),
      skipDuplicates: true,
    });
    result.products = products.count;
  } catch (error) {
    console.error('[provision] catalogue failed', studioId, error);
  }

  try {
    const stages = await prisma.studioStage.createMany({
      data: DEFAULT_STAGES.map((s, i) => ({
        studioId,
        name: s.name,
        kind: s.kind,
        colour: s.colour,
        isIntake: s.isIntake,
        sortOrder: (i + 1) * 10,
      })),
      skipDuplicates: true,
    });
    result.stages = stages.count;
  } catch (error) {
    console.error('[provision] pipeline failed', studioId, error);
  }

  return result;
}
