import { describe, it, expect } from 'vitest';
import { newGameState, clone, applyMove, getValidMoves, P1, P2 } from '../logic.js';
import { evaluate, greedyPlay, lookaheadPlay, aiPlay } from '../ai.js';

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

// Replay a proposed sequence, checking each step is a legal (rules-filtered) move.
function legalSequence(s, pl, seq) {
  let cur = clone(s);
  for (const m of seq) {
    const legal = getValidMoves(cur, pl);
    if (!legal.some((x) => x.f === m.f && x.t === m.t && x.d === m.d)) return false;
    cur = applyMove(cur, pl, m);
  }
  return true;
}

function opening(turn, dice) {
  const g = newGameState();
  g.phase = 'move';
  g.turn = turn;
  g.dice = dice.slice();
  g.moves = dice.slice();
  return g;
}

describe('evaluate', () => {
  it('rewards borne-off checkers and punishes own checkers on the bar', () => {
    const base = st();
    base.pts[10] = { n: 1, p: 1 };
    const withOff = clone(base); withOff.off[1] = 3;
    expect(evaluate(withOff, P1)).toBeGreaterThan(evaluate(base, P1));
    const withBar = clone(base); withBar.bar[1] = 1;
    expect(evaluate(withBar, P1)).toBeLessThan(evaluate(base, P1));
  });
});

describe('greedyPlay', () => {
  it('returns a legal sequence and consumes both dice from the opening position', () => {
    const g = opening(P2, [3, 1]);
    const { seq, state } = greedyPlay(g, P2);
    expect(seq).toHaveLength(2);
    expect(legalSequence(g, P2, seq)).toBe(true);
    expect(state.moves).toHaveLength(0);
  });
});

describe('aiPlay', () => {
  it('default (1-ply lookahead) returns a legal, non-empty sequence', () => {
    const g = opening(P1, [6, 5]);
    const { seq } = aiPlay(g, P1);
    expect(seq.length).toBeGreaterThan(0);
    expect(legalSequence(g, P1, seq)).toBe(true);
  });

  it("'easy' difficulty equals greedyPlay", () => {
    const g = opening(P2, [4, 2]);
    expect(aiPlay(g, P2, 'easy').seq).toEqual(greedyPlay(g, P2).seq);
  });

  it('is deterministic on a branching position (many candidate sequences)', () => {
    const g = opening(P1, [6, 5]); // opening with 2 distinct dice = many sequences
    const a = aiPlay(g, P1);
    const b = aiPlay(g, P1);
    expect(a.seq).toEqual(b.seq);
    expect(a.seq.length).toBeGreaterThan(1); // ensure the argmax path, not the 1-seq short-circuit
  });

  it('obeys the mandatory-move (larger-die) rule', () => {
    // Only one die is ever playable; AI must choose the larger (5).
    const s = st({ moves: [3, 5] });
    s.pts[8] = { n: 1, p: 1 };
    s.pts[23] = { n: 1, p: 1 };
    s.pts[0] = { n: 2, p: 2 };
    s.pts[18] = { n: 2, p: 2 };
    s.pts[20] = { n: 2, p: 2 };
    const { seq } = aiPlay(s, P1);
    expect(seq).toEqual([{ f: 8, t: 3, d: 5 }]);
  });

  it('lookahead completes quickly even on doubles (perf sanity)', () => {
    const g = opening(P1, [6, 6, 6, 6]); // doubles = the heaviest branching
    const start = performance.now();
    const { seq } = lookaheadPlay(g, P1);
    const ms = performance.now() - start;
    expect(seq.length).toBeGreaterThan(0);
    expect(legalSequence(g, P1, seq)).toBe(true);
    expect(ms).toBeLessThan(4000); // generous ceiling; flags pathological blowups
  });
});
