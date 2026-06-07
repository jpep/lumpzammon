import { describe, it, expect } from 'vitest';
import {
  P1, P2,
  initialBoard, newGameState,
  resolveOpening, canLand, allHome, pipDist, calcPipCount, farthestHome,
  getValidMoves, getValidMovesRaw, maxDiceSequence, applyMove, checkWin,
} from '../logic.js';

// Raw-move assertions test getValidMovesRaw (the original generator). The
// mandatory-move rule (must use max dice; force the larger die) is tested
// separately against getValidMoves.

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

describe('board setup', () => {
  it('initialBoard places 15 checkers per side with the standard layout', () => {
    const b = initialBoard();
    const count = (pl) => b.reduce((s, pt) => s + (pt.p === pl ? pt.n : 0), 0);
    expect(count(1)).toBe(15);
    expect(count(2)).toBe(15);
    expect(b[23]).toEqual({ n: 2, p: 1 });
    expect(b[12]).toEqual({ n: 5, p: 1 });
    expect(b[0]).toEqual({ n: 2, p: 2 });
    expect(b[18]).toEqual({ n: 5, p: 2 });
  });

  it('newGameState starts in the opening phase with no dice', () => {
    const g = newGameState();
    expect(g.phase).toBe('opening');
    expect(g.turn).toBe(0);
    expect(g.dice).toEqual([]);
    expect(g.bar).toEqual({ 1: 0, 2: 0 });
  });

  it('initial pip count is 167 for both players', () => {
    const g = newGameState();
    expect(calcPipCount(g, P1)).toBe(167);
    expect(calcPipCount(g, P2)).toBe(167);
  });
});

describe('opening roll', () => {
  it('returns null on a tie', () => {
    expect(resolveOpening({ 1: 3, 2: 3 })).toBeNull();
  });

  it('higher roller starts; dice are [p1die, p2die] in fixed order', () => {
    const r = resolveOpening({ 1: 5, 2: 2 });
    expect(r.turn).toBe(P1);
    expect(r.dice).toEqual([5, 2]);
    expect(r.moves).toEqual([5, 2]);
    expect(r.phase).toBe('move');

    const r2 = resolveOpening({ 1: 2, 2: 6 });
    expect(r2.turn).toBe(P2);
    expect(r2.dice).toEqual([2, 6]);
  });
});

describe('landing & home helpers', () => {
  it('canLand: empty / own / single-blot are landable, 2+ opponents are not', () => {
    const pts = emptyPts();
    pts[0] = { n: 2, p: 2 };
    pts[1] = { n: 1, p: 2 };
    pts[2] = { n: 1, p: 1 };
    expect(canLand(pts, 5, P1)).toBe(true);  // empty
    expect(canLand(pts, 2, P1)).toBe(true);  // own
    expect(canLand(pts, 1, P1)).toBe(true);  // opponent blot
    expect(canLand(pts, 0, P1)).toBe(false); // 2 opponents
  });

  it('pipDist: P1 = i+1, P2 = 24-i', () => {
    expect(pipDist(0, P1)).toBe(1);
    expect(pipDist(23, P1)).toBe(24);
    expect(pipDist(23, P2)).toBe(1);
    expect(pipDist(0, P2)).toBe(24);
  });

  it('allHome: false with a checker outside home or on the bar', () => {
    const s = st();
    s.pts[5] = { n: 2, p: 1 };
    expect(allHome(s, P1)).toBe(true);
    s.pts[10] = { n: 1, p: 1 };
    expect(allHome(s, P1)).toBe(false);
    s.pts[10] = { n: 0, p: 0 };
    s.bar[1] = 1;
    expect(allHome(s, P1)).toBe(false);
  });

  it('farthestHome: rearmost home checker (or -1)', () => {
    const s = st();
    s.pts[3] = { n: 1, p: 1 };
    s.pts[1] = { n: 1, p: 1 };
    expect(farthestHome(s, P1)).toBe(3);
    expect(farthestHome(st(), P1)).toBe(-1);
  });
});

describe('getValidMovesRaw (raw legal moves, no mandatory-move rule)', () => {
  it('bar-first: only bar re-entry while a checker is on the bar; blocked entries excluded', () => {
    const s = st({ moves: [2, 4], bar: { 1: 1, 2: 0 } });
    s.pts[20] = { n: 2, p: 2 }; // blocks P1 entry for die 4 (24-4=20)
    const mv = getValidMovesRaw(s, P1);
    // die 2 -> 24-2=22 (open); die 4 -> 20 (blocked)
    expect(mv).toEqual([{ f: 'bar', t: 22, d: 2 }]);
  });

  it('returns BOTH single-die options even when only one die can ultimately be used', () => {
    // Larger-die scenario: from idx 8, both die 3 (->5) and die 5 (->3) are
    // individually playable, but neither sequence uses both (idx 0 blocked).
    // RAW returns both; the mandatory rule (tested below) keeps only the larger.
    const s = largerDiePosition();
    const mv = getValidMovesRaw(s, P1);
    expect(mv).toHaveLength(2);
    expect(mv).toContainEqual({ f: 8, t: 5, d: 3 });
    expect(mv).toContainEqual({ f: 8, t: 3, d: 5 });
  });

  it('bear-off: exact die bears off', () => {
    const s = st({ moves: [6] });
    s.pts[5] = { n: 1, p: 1 };
    const mv = getValidMovesRaw(s, P1);
    expect(mv).toEqual([{ f: 5, t: 'off', d: 6 }]);
  });

  it('bear-off over-roll: only the farthest-back home checker may overshoot', () => {
    const s = st({ moves: [6] });
    s.pts[3] = { n: 1, p: 1 };  // pipDist 4, is farthest -> may bear off with a 6
    s.pts[1] = { n: 1, p: 1 };  // pipDist 2, NOT farthest -> cannot overshoot
    const mv = getValidMovesRaw(s, P1);
    expect(mv).toEqual([{ f: 3, t: 'off', d: 6 }]);
  });

  it('P2 bar re-entry enters at t = d-1', () => {
    const s = st({ moves: [3], bar: { 1: 0, 2: 1 }, turn: P2 });
    expect(getValidMovesRaw(s, P2)).toEqual([{ f: 'bar', t: 2, d: 3 }]);
  });
});

describe('bar re-entry edge cases', () => {
  it('entering on an opponent blot sends it to the bar', () => {
    const s = st({ moves: [3], bar: { 1: 1, 2: 0 } });
    s.pts[21] = { n: 1, p: 2 }; // P1 enters at 24-3=21, opponent blot there
    const ns = applyMove(s, P1, { f: 'bar', t: 21, d: 3 });
    expect(ns.bar[1]).toBe(0);
    expect(ns.bar[2]).toBe(1);
    expect(ns.pts[21]).toEqual({ n: 1, p: 1 });
  });

  it('fully-blocked bar yields no legal moves (turn forfeit) under both generators', () => {
    const s = st({ moves: [3, 5], bar: { 1: 1, 2: 0 } });
    s.pts[21] = { n: 2, p: 2 }; // blocks entry for die 3 (24-3)
    s.pts[19] = { n: 2, p: 2 }; // blocks entry for die 5 (24-5)
    expect(getValidMovesRaw(s, P1)).toEqual([]);
    expect(getValidMoves(s, P1)).toEqual([]);
  });
});

// ── Shared fixtures for the mandatory-move rule ──────────────────────────────

// Only ONE die is ever playable; the two dice differ. The larger (5) must win.
function largerDiePosition() {
  const s = st({ moves: [3, 5] });
  s.pts[8] = { n: 1, p: 1 };   // die3 -> 5 (open), die5 -> 3 (open); both single-only
  s.pts[23] = { n: 1, p: 1 };  // stuck (keeps allHome false); its dice are blocked
  s.pts[0] = { n: 2, p: 2 };   // blocks the 2nd die after either first move
  s.pts[18] = { n: 2, p: 2 };  // blocks stuck checker (23 -> 18)
  s.pts[20] = { n: 2, p: 2 };  // blocks stuck checker (23 -> 20)
  return s;
}

// Both dice CAN be used together, but one specific move (C: 4->1 with die3)
// strands die2 and must be filtered out.
function mustUseBothPosition() {
  const s = st({ moves: [3, 2] });
  s.pts[8] = { n: 1, p: 1 };  // A: die3 -> 5 (open); die2 -> 6 (blocked)
  s.pts[4] = { n: 1, p: 1 };  // C: die3 -> 1 (open); die2 -> 2 (open)
  s.pts[6] = { n: 2, p: 2 };  // blocks A's die2 and keeps continuations asymmetric
  return s;
}

describe('getValidMoves (mandatory-move rule)', () => {
  it('larger-die rule: when only one die is playable, it must be the larger', () => {
    const s = largerDiePosition();
    expect(maxDiceSequence(s, P1)).toBe(1);          // only one die ever usable
    const mv = getValidMoves(s, P1);
    expect(mv).toEqual([{ f: 8, t: 3, d: 5 }]);       // forced to the larger (5)
  });

  it('must use the maximum number of dice: drops a move that strands a die', () => {
    const s = mustUseBothPosition();
    expect(maxDiceSequence(s, P1)).toBe(2);           // both dice can be used
    const raw = getValidMovesRaw(s, P1);
    const mv = getValidMoves(s, P1);
    expect(raw).toHaveLength(3);
    expect(mv).toHaveLength(2);
    expect(mv).toContainEqual({ f: 8, t: 5, d: 3 });  // A die3 -> 5 (lets die2 play)
    expect(mv).toContainEqual({ f: 4, t: 2, d: 2 });  // C die2 -> 2 (lets die3 play)
    expect(mv).not.toContainEqual({ f: 4, t: 1, d: 3 }); // strands die2 -> filtered
  });

  it('no over-filtering when both dice are independently playable', () => {
    const s = st({ moves: [2, 3] });
    s.pts[10] = { n: 1, p: 1 };
    s.pts[20] = { n: 1, p: 1 };
    const raw = getValidMovesRaw(s, P1);
    const mv = getValidMoves(s, P1);
    expect(mv).toHaveLength(raw.length); // filter is a no-op here
  });

  it('filtered moves are always a subset of raw moves', () => {
    for (const s of [largerDiePosition(), mustUseBothPosition()]) {
      const raw = getValidMovesRaw(s, P1);
      for (const m of getValidMoves(s, P1)) {
        expect(raw).toContainEqual(m);
      }
    }
  });
});

describe('applyMove', () => {
  it('hits an opponent blot to the bar and consumes the die', () => {
    const s = st({ moves: [6] });
    s.pts[6] = { n: 1, p: 1 };
    s.pts[0] = { n: 1, p: 2 }; // opponent blot
    const ns = applyMove(s, P1, { f: 6, t: 0, d: 6 });
    expect(ns.pts[6]).toEqual({ n: 0, p: 0 });
    expect(ns.pts[0]).toEqual({ n: 1, p: 1 });
    expect(ns.bar[2]).toBe(1);
    expect(ns.moves).toEqual([]);
  });

  it('bears a checker off and increments off', () => {
    const s = st({ moves: [6, 3] });
    s.pts[5] = { n: 1, p: 1 };
    const ns = applyMove(s, P1, { f: 5, t: 'off', d: 6 });
    expect(ns.off[1]).toBe(1);
    expect(ns.pts[5]).toEqual({ n: 0, p: 0 });
    expect(ns.moves).toEqual([3]); // only the used die removed
  });

  it('does not mutate the source state', () => {
    const s = st({ moves: [6] });
    s.pts[6] = { n: 1, p: 1 };
    applyMove(s, P1, { f: 6, t: 0, d: 6 });
    expect(s.pts[6]).toEqual({ n: 1, p: 1 });
    expect(s.moves).toEqual([6]);
  });
});

describe('checkWin', () => {
  it('detects 15 borne off', () => {
    expect(checkWin(st({ off: { 1: 15, 2: 0 } }))).toBe(1);
    expect(checkWin(st({ off: { 1: 0, 2: 15 } }))).toBe(2);
    expect(checkWin(st({ off: { 1: 14, 2: 3 } }))).toBe(0);
  });
});
