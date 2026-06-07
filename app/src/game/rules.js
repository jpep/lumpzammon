// Pure backgammon scoring rules, extracted from devanture/adapter.js.
// These read GameState only (no UI, no p5 globals). The stateful actions that
// USE them (recording the win, accumulating score) live in the game-flow layer.

import { initialBoard } from './logic';

// Win type from the final position: 'simple' | 'gammon' | 'backgammon'.
//   simple     = loser bore off >= 1 checker.
//   gammon     = loser bore off 0 checkers.
//   backgammon = loser bore off 0 AND still has a checker on the bar OR in the
//                winner's home quadrant.
export function classifyWin(state, winner) {
  const loser = winner === 1 ? 2 : 1;
  if (state.off[loser] > 0) return 'simple';
  if (state.bar[loser] > 0) return 'backgammon';
  const [lo, hi] = winner === 1 ? [0, 5] : [18, 23];
  for (let i = lo; i <= hi; i++) {
    if (state.pts[i].p === loser && state.pts[i].n > 0) return 'backgammon';
  }
  return 'gammon';
}

// Base game value for a win type (before the doubling-cube multiplier).
export function winPoints(type) {
  return type === 'backgammon' ? 3 : type === 'gammon' ? 2 : 1;
}

// True when `state` is the untouched starting position. Used so a resign made
// before any move isn't mis-classified as a backgammon — P1's starting checkers
// on point 24 sit inside P2's home quadrant and would otherwise trip the
// backgammon test.
export function isInitialPosition(state) {
  if (!state || !state.pts) return false;
  if (state.off[1] !== 0 || state.off[2] !== 0) return false;
  if (state.bar[1] !== 0 || state.bar[2] !== 0) return false;
  const init = initialBoard();
  for (let i = 0; i < 24; i++) {
    if (state.pts[i].n !== init[i].n || state.pts[i].p !== init[i].p) return false;
  }
  return true;
}

// Classify a resignation by `winner` (1|2). A resign before any move is a plain
// simple win; otherwise it follows the normal win classification.
// Returns { classified, winType, points }:
//   classified : 'simple' | 'gammon' | 'backgammon' (drives the point value)
//   winType    : 'resign' for a simple resign (so the UI can badge it),
//                otherwise 'gammon' | 'backgammon'
//   points     : base value before the cube multiplier
export function resignOutcome(state, winner) {
  const classified = isInitialPosition(state) ? 'simple' : classifyWin(state, winner);
  return {
    classified,
    winType: classified === 'simple' ? 'resign' : classified,
    points: winPoints(classified),
  };
}
