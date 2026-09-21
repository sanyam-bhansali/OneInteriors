import { describe, it, expect } from 'vitest';
import { FixtureStudioRepository } from '@/modules/studio/repository';
import { STUDIOS } from '@/data/studios';
import type { Studio } from '@/modules/studio/types';

/**
 * Hiding a test record.
 *
 * The whole feature is one filter with a default, and the default is the
 * feature: a hidden row has to disappear from the roster, from matching, from
 * `/expert` and from every ops count, and those are call sites nobody will
 * remember to update. So the exclusion lives in the repository and is ON
 * unless a caller asks for it off.
 *
 * These tests are therefore about the DEFAULT far more than about the flag.
 * If `list()` with no arguments ever starts returning hidden studios, a test
 * studio appears on the public roster and nothing else in the suite notices.
 */

function withHidden(hiddenSlugs: string[]): Studio[] {
  return STUDIOS.map((s) =>
    hiddenSlugs.includes(s.slug) ? { ...s, hiddenAsTestAt: '2026-09-22T09:00:00.000Z' } : s,
  );
}

const HIDDEN = 'northlight-studio';

describe('hidden test records', () => {
  it('are excluded from list() by default', async () => {
    const repo = new FixtureStudioRepository(withHidden([HIDDEN]));
    const slugs = (await repo.list()).map((s) => s.slug);

    expect(slugs).not.toContain(HIDDEN);
    expect(slugs).toHaveLength(STUDIOS.length - 1);
  });

  it('are excluded from every filtered list too, not just the bare one', async () => {
    const repo = new FixtureStudioRepository(withHidden([HIDDEN]));

    for (const query of [{ activeOnly: true }, { city: 'pune' }, { minTier: 'LISTED' as const }]) {
      const slugs = (await repo.list(query)).map((s) => s.slug);
      expect(slugs, JSON.stringify(query)).not.toContain(HIDDEN);
    }
  });

  it('come back only when a caller asks out loud', async () => {
    const repo = new FixtureStudioRepository(withHidden([HIDDEN]));
    const slugs = (await repo.list({ includeHidden: true })).map((s) => s.slug);

    expect(slugs).toContain(HIDDEN);
    expect(slugs).toHaveLength(STUDIOS.length);
  });

  it('get no prerendered page', async () => {
    const repo = new FixtureStudioRepository(withHidden([HIDDEN]));
    expect(await repo.allSlugs()).not.toContain(HIDDEN);
  });

  it('are still reachable by slug, because that is the only way back', async () => {
    // `/ops/[slug]` is where you unhide. A row you cannot open is a hiding
    // mechanism with no undo, which is deletion wearing a softer word. The
    // public profile refuses separately — see the notFound gate in
    // app/studios/[slug]/page.tsx.
    const repo = new FixtureStudioRepository(withHidden([HIDDEN]));
    const studio = await repo.bySlug(HIDDEN);

    expect(studio).not.toBeNull();
    expect(studio?.hiddenAsTestAt).not.toBeNull();
  });

  it('changes nothing when nothing is hidden', async () => {
    const repo = new FixtureStudioRepository();
    const plain = await repo.list();
    const asked = await repo.list({ includeHidden: true });

    expect(plain).toHaveLength(STUDIOS.length);
    expect(asked).toHaveLength(STUDIOS.length);
  });
});
