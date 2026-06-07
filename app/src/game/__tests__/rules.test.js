import { describe, it, expect } from 'vitest';
import { newGameState, applyMove, P1, P2 } from '../logic.js';
import { classifyWin, winPoints, isInitialPosition, resignOutcome } from '../rules.js';

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

describe('classifyWin', () => {
  it('simple when the loser has borne off at least one checker', () => {
    const s = st({ off: { 1: 15, 2: 1 } });
    s.pts[10] = { n: 14, p: 2 };
    expect(classifyWin(s, 1)).toBe('simple');
  });

  it('gammon when the loser bore off none (no bar, not in winner home)', () => {
    const s = st({ off: { 1: 15, 2: 0 } });
    s.pts[10] = { n: 15, p: 2 }; // outside P1's home (0..5), not on bar
    expect(classifyWin(s, 1)).toBe('gammon');
  });

  it('backgammon when the loser still has a checker on the bar', () => {
    const s = st({ off: { 1: 15, 2: 0 }, bar: { 1: 0, 2: 1 } });
    s.pts[10] = { n: 14, p: 2 };
    expect(classifyWin(s, 1)).toBe('backgammon');
  });

  it("backgammon when the loser still sits in the winner's home quadrant", () => {
    const s = st({ off: { 1: 15, 2: 0 } });
    s.pts[3] = { n: 1, p: 2 };   // inside P1 home (0..5)
    s.pts[10] = { n: 14, p: 2 };
    expect(classifyWin(s, 1)).toBe('backgammon');
  });
});

describe('winPoints', () => {
  it('maps win type to base value', () => {
    expect(winPoints('simple')).toBe(1);
    expect(winPoints('gammon')).toBe(2);
    expect(winPoints('backgammon')).toBe(3);
  });
});

describe('isInitialPosition', () => {
  it('true for a fresh game, false after any move', () => {
    const g = newGameState();
    expect(isInitialPosition(g)).toBe(true);
    g.moves = [3];
    const moved = applyMove(g, P1, { f: 5, t: 2, d: 3 });
    expect(isInitialPosition(moved)).toBe(false);
  });
});

describe('resignOutcome', () => {
  it('a resign from the opening position is a plain simple win', () => {
    const g = newGameState();
    expect(resignOutcome(g, P2)).toEqual({ classified: 'simple', winType: 'resign', points: 1 });
  });

  it('a mid-game simple resign still badges as resign (1 point)', () => {
    const s = st({ off: { 1: 1, 2: 2 } }); // both have borne off -> simple
    s.pts[10] = { n: 14, p: 1 };
    s.pts[12] = { n: 13, p: 2 };
    expect(resignOutcome(s, 1)).toEqual({ classified: 'simple', winType: 'resign', points: 1 });
  });

  it('a gammon-strength resign keeps the gammon type and value', () => {
    const s = st({ off: { 1: 5, 2: 0 } });
    s.pts[10] = { n: 15, p: 2 }; // loser bore off none, not on bar / winner home
    expect(resignOutcome(s, 1)).toEqual({ classified: 'gammon', winType: 'gammon', points: 2 });
  });
});
