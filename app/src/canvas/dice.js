// Shared dice data: the pip layouts + the engine-state → displayed-faces derive.
// The live ball-physics roll animation (and the on-board placement) lives in
// canvas/diceAnim.js (Phase 8.5e); it imports the two helpers below. (The static
// settled-face renderer that 8.4 added here was superseded by the animator.)

// value(1..6) -> normalized pip centres in the die square. Copied from devanture.
export const PIP_LAYOUTS = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.3], [0.7, 0.7]],
  3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.50], [0.72, 0.50], [0.28, 0.75], [0.72, 0.75]],
};

// Derive the displayed faces + per-die "used" flags from the engine state. A die
// is used when its value is no longer in gs.moves (doubles use a played count).
// Reads gs.dice (the full roll) + gs.moves.
export function diceFromGameState(gs) {
  const owner = gs.turn === 1 ? 'white' : 'black';
  const dice = gs.dice || [];
  const isDouble = dice.length === 4;
  const values = isDouble ? [dice[0], dice[0]] : [dice[0], dice[1]];
  const remaining = gs.moves || [];
  const used = [false, false];
  if (dice.length) {
    if (isDouble) {
      const played = 4 - remaining.length;
      used[0] = played >= 2;
      used[1] = played >= 4;
    } else {
      used[0] = !remaining.includes(values[0]);
      used[1] = !remaining.includes(values[1]);
    }
  }
  return { owner, values, used };
}
