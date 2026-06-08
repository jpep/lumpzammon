// Hardcoded board snapshots fed to the static canvas spike (Phase 8.3).
//
// Shape = devanture mockState (NOT the React engine's {n,p} 0-indexed shape):
//   points: 1-based array, index 1..24; value > 0 => N white checkers,
//           value < 0 => N black checkers, 0 => empty. points[0] is an unused
//           sentinel so the array is 1-indexed.
//   bar / off: { white, black } counts.
// The slice consumes this shape directly — no conversion. (Wiring the live
// engine GameState into the canvas is Phase 8.4.)

// Standard opening position (copied from devanture/mockState.js SCENARIOS.initial).
export const STATIC_SNAPSHOT = {
  points: [
    0,   // 0: unused sentinel
    -2,  // 1  : 2 black
    0, 0, 0, 0,
    5,   // 6  : 5 white
    0,
    3,   // 8  : 3 white
    0, 0, 0,
    -5,  // 12 : 5 black
    5,   // 13 : 5 white
    0, 0, 0,
    -3,  // 17 : 3 black
    0,
    -5,  // 19 : 5 black
    0, 0, 0, 0,
    2,   // 24 : 2 white
  ],
  bar: { white: 0, black: 0 },
  off: { white: 0, black: 0 },
  dice: [3, 5],
  turn: 'white',
  phase: 'playing',
  players: { white: 'USER 2', black: 'USER 1' },
};

// Exercises bar pieces + the +N overflow label (a stack of 8 > MAX_STACK=6 on pt 1).
export const STACK_TEST_SNAPSHOT = {
  points: [0, 8, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2],
  bar: { white: 1, black: 2 },
  off: { white: 0, black: 0 },
  dice: [2, 2],
  turn: 'black',
  phase: 'playing',
  players: { white: 'USER 2', black: 'USER 1' },
};
