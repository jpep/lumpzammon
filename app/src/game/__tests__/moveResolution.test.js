import { describe, it, expect } from 'vitest';
import { P1 } from '../logic.js';
import {
  findMoveSequence, collectTargets, applyCombinedMove, applyMultiPickup,
} from '../moveResolution.js';

const emptyPts = () => Array.from({ length: 24 }, () => ({ n: 0, p: 0 }));
function st(overrides = {}) {
  return {
    pts: emptyPts(),
    bar: { 1: 0, 2: 0 },
    off: { 1: 0, 2: 0 },
    dice: [], moves: [],
    openingRolls: { 1: 0, 2: 0 },
    turn: 0, phase: 'move', winner: 0,
    ...overrides,
  };
}

describe('findMoveSequence', () => {
  it('combines two dice to reach a destination', () => {
    const s = st({ moves: [2, 3] });
    s.pts[10] = { n: 1, p: 1 }; // 10 -> 8 (d2) -> 5 (d3)
    const found = findMoveSequence(s, P1, 10, 5, 2);
    expect(found).not.toBeNull();
    expect(found.seq).toHaveLength(2);
    expect(found.state.pts[5]).toEqual({ n: 1, p: 1 });
    expect(found.state.pts[10]).toEqual({ n: 0, p: 0 });
    expect(found.state.moves).toEqual([]);
  });

  it('returns null when the destination is unreachable', () => {
    const s = st({ moves: [2, 3] });
    s.pts[10] = { n: 1, p: 1 };
    expect(findMoveSequence(s, P1, 10, 1, 2)).toBeNull(); // 10-2-3 = 5, not 1
  });
});

describe('collectTargets', () => {
  it('lists single and combined destinations from a source', () => {
    const s = st({ moves: [2, 3] });
    s.pts[10] = { n: 1, p: 1 };
    const targets = collectTargets(s, P1, 10, 2);
    expect(targets).toContain(8); // die 2
    expect(targets).toContain(7); // die 3
    expect(targets).toContain(5); // combined 2+3
  });
});

describe('applyCombinedMove', () => {
  it('applies the full combined move and consumes the dice', () => {
    const s = st({ moves: [2, 3] });
    s.pts[10] = { n: 1, p: 1 };
    const ns = applyCombinedMove(s, P1, 10, 5);
    expect(ns.pts[5]).toEqual({ n: 1, p: 1 });
    expect(ns.moves).toEqual([]);
  });
});

describe('applyMultiPickup', () => {
  it('moves N checkers from a stack on doubles, k dice each', () => {
    const s = st({ moves: [2, 2, 2, 2] }); // doubles -> 4 dice
    s.pts[8] = { n: 2, p: 1 };             // stack of 2; each travels 8 -> 6 -> 4 (k=2)
    const { state, applied } = applyMultiPickup(s, P1, 8, 4, 2);
    expect(applied).toBe(2);
    expect(state.pts[4]).toEqual({ n: 2, p: 1 });
    expect(state.pts[8]).toEqual({ n: 0, p: 0 });
    expect(state.moves).toEqual([]);
  });

  it('bears off multiple checkers on doubles (to off)', () => {
    const s = st({ moves: [6, 6, 6, 6] });
    s.pts[5] = { n: 4, p: 1 }; // all home; each bears off with a 6 (k=1)
    const { state, applied } = applyMultiPickup(s, P1, 5, 'off', 4);
    expect(applied).toBe(4);
    expect(state.off[1]).toBe(4);
    expect(state.moves).toEqual([]);
  });
});

describe('hitting during a combined move', () => {
  it('hits a blot on an intermediate point and continues', () => {
    const s = st({ moves: [2, 3] });
    s.pts[10] = { n: 1, p: 1 };
    s.pts[8] = { n: 1, p: 2 }; // opponent blot at intermediate (10-2)
    const ns = applyCombinedMove(s, P1, 10, 5);
    expect(ns.bar[2]).toBe(1);
    expect(ns.pts[8]).toEqual({ n: 0, p: 0 }); // hit then vacated
    expect(ns.pts[5]).toEqual({ n: 1, p: 1 });
  });

  it('hits a blot on the final point of a combined move', () => {
    const s = st({ moves: [2, 3] });
    s.pts[10] = { n: 1, p: 1 };
    s.pts[5] = { n: 1, p: 2 }; // opponent blot at the destination (10-5)
    const ns = applyCombinedMove(s, P1, 10, 5);
    expect(ns.bar[2]).toBe(1);
    expect(ns.pts[5]).toEqual({ n: 1, p: 1 });
  });
});

describe('combined-dice bear-off', () => {
  it('bears a checker off by combining two dice (4 -> 2 -> off)', () => {
    const s = st({ moves: [2, 3] });
    s.pts[4] = { n: 1, p: 1 }; // all home; pipDist 5, needs both dice to bear off
    const ns = applyCombinedMove(s, P1, 4, 'off');
    expect(ns.off[1]).toBe(1);
    expect(ns.moves).toEqual([]);
  });
});
