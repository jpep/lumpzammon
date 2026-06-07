// Combined multi-die move resolution, extracted from devanture/adapter.js.
//
// Pure functions over GameState in ENGINE coordinates (fromIdx: 0..23 | 'bar';
// toIdx: 0..23 | 'off'). The UI's 1-24 / 'bar' / 0 coordinate mapping stays in
// the UI layer. All of these layer on the rules-filtered getValidMoves, so the
// mandatory-move rule is respected.

import { getValidMoves, applyMove } from './logic';

// Find a sequence of up to `depth` combined dice taking a checker from fromIdx
// to toIdx. Returns { seq, state } (state after applying the whole sequence) or
// null if no such path exists.
export function findMoveSequence(state, pl, fromIdx, toIdx, depth) {
  if (depth <= 0 || state.moves.length === 0) return null;
  const moves = getValidMoves(state, pl);

  // Direct one-die hit first.
  for (const m of moves) {
    if (m.f === fromIdx && m.t === toIdx) {
      return { seq: [m], state: applyMove(state, pl, m) };
    }
  }
  // Otherwise step to an intermediate point and recurse.
  for (const m of moves) {
    if (m.f !== fromIdx || m.t === 'off') continue;
    const ns = applyMove(state, pl, m);
    const sub = findMoveSequence(ns, pl, m.t, toIdx, depth - 1);
    if (sub) return { seq: [m, ...sub.seq], state: sub.state };
  }
  return null;
}

// All reachable destinations (engine coords; 'off' for bearing off) for a
// checker at fromIdx, combining up to `depth` dice. Returns the targets array.
export function collectTargets(state, pl, fromIdx, depth, targets = []) {
  if (depth <= 0 || state.moves.length === 0) return targets;
  const moves = getValidMoves(state, pl);
  for (const m of moves) {
    if (m.f !== fromIdx) continue;
    if (!targets.includes(m.t)) targets.push(m.t);
    if (m.t !== 'off') {
      collectTargets(applyMove(state, pl, m), pl, m.t, depth - 1, targets);
    }
  }
  return targets;
}

// Apply a combined move fromIdx -> toIdx using as many remaining dice as needed.
// Returns the new state, or null if no such sequence exists.
export function applyCombinedMove(state, pl, fromIdx, toIdx) {
  const found = findMoveSequence(state, pl, fromIdx, toIdx, state.moves.length);
  return found ? found.state : null;
}

// Multi-pickup (doubles): move `count` checkers, each travelling fromIdx -> toIdx
// using k = floor(remainingDice / count) dice per checker. Returns
// { state, applied } where applied is how many checkers were moved.
export function applyMultiPickup(state, pl, fromIdx, toIdx, count) {
  if (count < 1) return { state, applied: 0 };
  const k = Math.max(1, Math.floor(state.moves.length / count));
  let cur = state;
  let applied = 0;
  for (let i = 0; i < count; i++) {
    const found = findMoveSequence(cur, pl, fromIdx, toIdx, k);
    if (!found) break;
    cur = found.state;
    applied++;
  }
  return { state: cur, applied };
}
