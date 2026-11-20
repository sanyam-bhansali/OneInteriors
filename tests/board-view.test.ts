import { describe, expect, it } from 'vitest';
import { applyBoardView, boardViewQuery, keepCard, readBoardView } from '@/modules/studio/board-view';
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
    ...o,
  }) as BoardCard;

const A = card({ client: 'Asha', priority: 5, lateDays: 1, category: 'Luxe', designEndsOn: '2026-12-20', startedOn: '2026-10-01', blocker: { side: 'studio', text: '' } });
const B = card({ client: 'bhushan', priority: 3, lateDays: 9, category: 'Essential', designEndsOn: '2026-11-30', startedOn: '2026-11-10', blocker: { side: 'client', text: '' }, onHold: true });
const C = card({ client: 'Chetan', priority: null, lateDays: 0, category: null, designEndsOn: null, startedOn: '2026-09-01', onSiteCarcass: true });
const board = { design: [A, B, C], preExecution: [], execution: [], snags: [], closed: [], closures: [] };
const names = (l: BoardCard[]) => l.map((c) => c.client);

describe('Design board sort and filter (owner, 20 Nov 2026)', () => {
  it('reads the view from the address bar, dropping anything unknown', () => {
    expect(readBoardView({ sort: 'late', cat: 'Luxe', show: 'hold' })).toEqual({ sort: 'late', cat: 'Luxe', show: 'hold' });
    expect(readBoardView({ sort: 'nope', cat: 'toString', show: '' })).toEqual({ sort: 'stars', cat: null, show: null });
    expect(boardViewQuery({ sort: 'stars', cat: null, show: null })).toBe('');
    expect(boardViewQuery({ sort: 'ends', cat: 'none', show: 'late' })).toBe('&sort=ends&cat=none&show=late');
  });

  it('leaves the board as built on the default view', () => {
    expect(applyBoardView(board, readBoardView({}))).toBe(board);
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
});
