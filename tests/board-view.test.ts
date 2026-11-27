import { describe, expect, it } from 'vitest';
import { applyBoardView, boardViewQuery, keepCard, newOnTop, readBoardView, stageChoices } from '@/modules/studio/board-view';
import { setupOf } from '@/modules/studio/lifecycle-store';
import type { BoardCard } from '@/modules/studio/lifecycle-store';

const card = (o: Partial<BoardCard>): BoardCard =>
  ({
    id: o.client ?? 'x',
    priority: null,
    category: null,
    client: 'Client',
    flat: '2 BHK',
    designer: null,
    designerId: null,
    phase: 'DESIGN',
    phaseLabel: 'Design',
    current: '',
    next: null,
    blocker: null,
    lateDays: 0,
    warrantyEndsOn: null,
    provisionalOn: null,
    snags: [],
    finalDuePaise: null,
    extras: { withClient: 0, toPay: 0, toRelease: 0 },
    onSiteCarcass: false,
    onHold: false,
    designEndsOn: null,
    startedOn: null,
    pct: 0,
    stage: 'Design',
    stageOrder: 1000,
    ...o,
  }) as BoardCard;

const A = card({ client: 'Asha', pct: 40, stage: 'First draft (3D)', stageOrder: 5, priority: 5, lateDays: 1, category: 'Luxe', designEndsOn: '2026-12-20', startedOn: '2026-10-01', blocker: { side: 'studio', text: '' } });
const B = card({ client: 'bhushan', pct: 10, stage: '2D layout', stageOrder: 2, priority: 3, lateDays: 9, category: 'Essential', designEndsOn: '2026-11-30', startedOn: '2026-11-10', blocker: { side: 'client', text: '' }, onHold: true });
const C = card({ client: 'Chetan', pct: 70, stage: 'First draft (3D)', stageOrder: 5, priority: null, lateDays: 0, category: null, designEndsOn: null, startedOn: '2026-09-01', onSiteCarcass: true });
const board = { design: [A, B, C], preExecution: [], execution: [], snags: [], closed: [], closures: [] };
const names = (l: BoardCard[]) => l.map((c) => c.client);

describe('Design board sort and filter (owner, 20 Nov 2026)', () => {
  it('reads the view from the address bar, dropping anything unknown', () => {
    expect(readBoardView({ sort: 'late', cat: 'Luxe', show: 'hold' })).toEqual({ sort: 'late', cat: 'Luxe', show: 'hold', stage: null });
    expect(readBoardView({ sort: 'nope', cat: 'toString', show: '' })).toEqual({ sort: 'stars', cat: null, show: null, stage: null });
    expect(boardViewQuery({ sort: 'stars', cat: null, show: null, stage: null })).toBe('');
    expect(boardViewQuery({ sort: 'ends', cat: 'none', show: 'late', stage: 'Final 2D' })).toBe('&sort=ends&cat=none&show=late&stage=Final%202D');
  });

  it('leaves the board as built on the default view', () => {
    expect(applyBoardView(board, readBoardView({}))).toEqual(board);
  });

  it('sorts by late, design end (undated last), newest and client name', () => {
    expect(names(applyBoardView(board, readBoardView({ sort: 'late' })).design)).toEqual(['bhushan', 'Asha', 'Chetan']);
    expect(names(applyBoardView(board, readBoardView({ sort: 'ends' })).design)).toEqual(['bhushan', 'Asha', 'Chetan']);
    expect(names(applyBoardView(board, readBoardView({ sort: 'newest' })).design)).toEqual(['bhushan', 'Asha', 'Chetan']);
    expect(names(applyBoardView(board, readBoardView({ sort: 'client' })).design)).toEqual(['Asha', 'bhushan', 'Chetan']);
  });

  it('filters by category and by what is holding it up', () => {
    expect(names(applyBoardView(board, readBoardView({ cat: 'Luxe' })).design)).toEqual(['Asha']);
    expect(names(applyBoardView(board, readBoardView({ cat: 'none' })).design)).toEqual(['Chetan']);
    expect(keepCard(B, readBoardView({ show: 'client' }))).toBe(true);
    expect(keepCard(A, readBoardView({ show: 'us' }))).toBe(true);
    expect(names(applyBoardView(board, readBoardView({ show: 'late' })).design)).toEqual(['Asha', 'bhushan']);
    expect(names(applyBoardView(board, readBoardView({ show: 'hold' })).design)).toEqual(['bhushan']);
    expect(names(applyBoardView(board, readBoardView({ show: 'carcass' })).design)).toEqual(['Chetan']);
  });

  it('sorts by % complete both ways (owner, 20 Nov 2026)', () => {
    expect(names(applyBoardView(board, readBoardView({ sort: 'pct-desc' })).design)).toEqual(['Chetan', 'Asha', 'bhushan']);
    expect(names(applyBoardView(board, readBoardView({ sort: 'pct-asc' })).design)).toEqual(['bhushan', 'Asha', 'Chetan']);
  });

  it('filters by the stage, listing every stage in plan order with its count', () => {
    expect(stageChoices(board.design)).toEqual([{ stage: '2D layout', count: 1 }, { stage: 'First draft (3D)', count: 2 }]);
    expect(names(applyBoardView(board, readBoardView({ stage: 'First draft (3D)' })).design)).toEqual(['Asha', 'Chetan']);
  });
});

describe('new projects on top (owner, 27 Nov 2026)', () => {
  const N1 = card({ client: 'New one', setup: 'designer', createdAt: '2026-11-20T10:00:00.000Z' });
  const N2 = card({ client: 'Newer', setup: 'priority', createdAt: '2026-11-26T10:00:00.000Z' });
  const b2 = { design: [A, N1, B, N2, C], preExecution: [], execution: [], snags: [], closed: [], closures: [] };

  it('stays first, newest converted first, whatever the sort', () => {
    for (const sort of ['stars', 'late', 'client', 'pct-asc'] as const) {
      const out = applyBoardView(b2, { sort, cat: null, show: null, stage: null });
      expect(names(out.design).slice(0, 2)).toEqual(['Newer', 'New one']);
    }
  });

  it('drops into the list once set up', () => {
    expect(names(newOnTop([A, { ...N1, setup: null }, B]))).toEqual(['Asha', 'New one', 'bhushan']);
  });

  it('is a new project while no designer, or no stars by hand and nothing ticked', () => {
    expect(setupOf('DESIGN', null, 4, 30)).toBe('designer');
    expect(setupOf('DESIGN', 'm1', null, 0)).toBe('priority');
    expect(setupOf('DESIGN', 'm1', null, 25)).toBeNull();
    expect(setupOf('DESIGN', 'm1', 3, 0)).toBeNull();
    expect(setupOf('EXECUTION', null, null, 0)).toBeNull();
  });
});
