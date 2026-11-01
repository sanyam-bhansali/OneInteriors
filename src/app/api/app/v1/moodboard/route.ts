import { gate, json, signedIn } from '@/modules/app-api/http';
import { elementBySlug } from '@/modules/prepare/catalogue';
import { pickerFor } from '@/modules/prepare/board';
import { loadPrepPack } from '@/modules/prepare/prep';
import { hasLiveProject } from '@/modules/portal/project-store';

/**
 * GET /api/app/v1/moodboard — the client's mood board for the phone app's own
 * screen (owner, 1 Nov 2026; customer app Phase 2): each room's style and
 * materials, its one question and the pick, the pieces on the board and what
 * can be added (above-budget pieces flagged, disliked styles never offered),
 * and the note. The same boards the website shows and the designer adds to.
 * `open: false` until the brief is done or a project has started.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const prep = await loadPrepPack();
  const open = Boolean(prep && (prep.brief.completedAt || (await hasLiveProject(me.user.id))));
  if (!prep || !open) return json({ ok: true, open: false, rooms: [] });
  const rooms = prep.plan.rooms.map((room) => {
    const board = prep.boards.find((b) => b.proposal.room === room.key)!;
    const onBoard = new Set(board.state.items);
    return {
      key: room.key,
      label: room.label,
      style: board.proposal.styleLabel,
      materials: board.proposal.materials,
      optionCount: board.proposal.optionCount,
      shuffle: board.state.shuffle,
      question: board.proposal.decision.question,
      options: board.proposal.decision.options.map((o) => ({ label: o.label, note: o.note })),
      chosenOption: board.state.chosenOption,
      note: board.state.note,
      items: board.state.items.map((slug) => ({ slug, label: elementBySlug(slug)?.label ?? slug })),
      picker: pickerFor(room.key, prep.brief.styleLikes, prep.brief.styleDislikes, prep.brief.tier)
        .filter((p) => !onBoard.has(p.element.slug))
        .slice(0, 24)
        .map((p) => ({ slug: p.element.slug, label: p.element.label, aboveBand: p.aboveBand })),
    };
  });
  return json({ ok: true, open: true, rooms });
}
