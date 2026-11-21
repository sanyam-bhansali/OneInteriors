import { loadDesign } from '@/modules/design-dna/store';
import { loadPrepPack, elementsForRoom } from '@/modules/prepare/prep';
import { isAboveBand } from '@/modules/prepare/catalogue';
import { gate, json, signedIn } from '@/modules/app-api/http';

/**
 * GET /api/app/v1/design — Design your home (owner, 4 Nov 2026), for the app:
 * the Design DNA, the room ideas with short-lived picture links, and the mood
 * boards with what can go on each. The same data as /account/design.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;

  const view = await loadDesign();
  if (!view.open) return json({ ok: true, design: view });

  const prep = await loadPrepPack();
  const tier = prep?.brief.tier ?? null;
  const boards = (prep?.boards ?? []).map((b) => ({
    room: b.proposal.room,
    label: prep?.plan.rooms.find((r) => r.key === b.proposal.room)?.label ?? b.proposal.room,
    items: b.state.items,
    choices: elementsForRoom(b.proposal.room).map((e) => ({
      slug: e.slug,
      label: e.label,
      category: e.category,
      colours: e.colours,
      aboveBudget: isAboveBand(e, tier),
    })),
  }));
  return json({ ok: true, design: view, boards });
}
