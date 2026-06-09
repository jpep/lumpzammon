// Pure doubling-cube state machine, extracted from devanture/adapter.js.
//
// NON-STANDARD variant (the current devanture behaviour): each player may
// double at most once, and the cube caps at 4. The tournament-standard cube
// (1→2→…→64 with cube ownership, Crawford, Jacoby) is tracked separately in
// PLAN.md ("Tournament-Standard Rules"); this models what ships today.
//
// This module owns only cube STATE transitions. The offer/accept MODAL flow
// (turn-start prompt, AI auto-decision scheduling) is wired in the game-flow
// layer (Phase 8.5). Colors are 'white' (player 1) and 'black' (player 2).

export const CUBE_CAP = 4;
export const AI_ACCEPT_THRESHOLD = -25;

// Engine players are numbers (1 = white, 2 = black); the cube reducer speaks in
// colors. These two helpers bridge the boundary in the game-flow layer.
export const colorOf = (player) => (player === 1 ? 'white' : 'black');
export const playerOf = (color) => (color === 'white' ? 1 : 2);

// The cube value after a successful double (capped). Shown on the offer/accept
// modals so the responder sees what they're agreeing to.
export const nextCubeValue = (cube) => Math.min(cube.value * 2, CUBE_CAP);

export function newCube() {
  return { value: 1, owner: null, promised: null, used: { white: false, black: false } };
}

// May `player` offer a double right now?
//   - cube not at the cap,
//   - player hasn't already used their once-per-game double,
//   - the opponent hasn't already promised a double.
export function canDouble(cube, player) {
  if (cube.value >= CUBE_CAP) return false;
  if (cube.used[player]) return false;
  if (cube.promised && cube.promised !== player) return false;
  return true;
}

// Record that `player` intends to double on their next turn (no-op if they
// can't). Returns a new cube.
export function promiseDouble(cube, player) {
  if (!canDouble(cube, player)) return cube;
  return { ...cube, promised: player };
}

// The opponent ACCEPTS the offerer's double: the cube doubles (capped), its
// owner becomes the accepter, and the offerer's once-per-game double is spent.
export function acceptDouble(cube, offerer) {
  const opponent = offerer === 'white' ? 'black' : 'white';
  return {
    ...cube,
    value: Math.min(cube.value * 2, CUBE_CAP),
    owner: opponent,
    used: { ...cube.used, [offerer]: true },
    promised: null,
  };
}

// The opponent DECLINES the offerer's double: the offerer wins the PRE-double
// value as a simple game. Returns { cube, outcome } where outcome is
// { winner: 'white'|'black', winType: 'simple', points } (points = pre-double value).
export function declineDouble(cube, offerer) {
  return {
    cube: { ...cube, promised: null },
    outcome: { winner: offerer, winType: 'simple', points: cube.value },
  };
}

// AI accept heuristic: accept unless in marked evaluated disadvantage.
// `advantage` is evaluate(me) - evaluate(opponent) (see ai.evaluate).
export function shouldAcceptDouble(advantage) {
  return advantage > AI_ACCEPT_THRESHOLD;
}
