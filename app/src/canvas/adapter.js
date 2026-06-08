// The single bridge between the engine GameState and the canvas render shape.
// ALL coordinate conversion lives here (engine 0..23/'bar'/'off'  <->  render
// 1..24/'bar'/0) — never inline a +1/-1 elsewhere (off-by-one is the most
// likely bug across the three coordinate systems: engine / render / pixel).

import { allHome } from '../game/logic';

// Perspective is a PURE 180° rotation in render-point space: a +12 (mod 24)
// shift when direction === 1 (online P2 sees their home at the bottom), matching
// the DOM board's TOP_IDX_FLIP/BOT_IDX_FLIP. NOT a reflection and NOT an X
// mirror. A 180° rotation is its own inverse, so both maps use the same offset.
// Verified: dir1 engine 0->render 13, 18->7, 23->12 (P2 home -> bottom half).

// engine coord -> render point. 'bar' stays 'bar', 'off' -> 0.
export const engineToRenderPt = (idx, direction = 0) =>
  (idx === 'bar' ? 'bar' : (idx === 'off' ? 0 : (direction === 1 ? ((idx + 12) % 24) + 1 : idx + 1)));

// render point (1..24) -> engine index (0..23).
export const renderPtToEngine = (pt, direction = 0) =>
  (direction === 1 ? ((pt - 1 + 12) % 24) : (pt - 1));

// render source point -> engine source coord. Render 'bar' stays 'bar'.
export const renderToEngineFrom = (fromPt, direction = 0) =>
  (fromPt === 'bar' ? 'bar' : renderPtToEngine(fromPt, direction));

// render target point -> engine target coord. Render 0 == engine 'off'.
export const renderToEngineTo = (toPt, direction = 0) =>
  (toPt === 0 ? 'off' : renderPtToEngine(toPt, direction));

// GameState -> render snapshot (devanture mockState shape the draw fns consume).
// Port of devanture/adapter.js syncMockState, made perspective-aware: engine
// index i -> render point engineToRenderPt(i, direction); P1 = white = +n;
// P2 = black = -n; bar/off keyed 1/2 -> white/black. SIGN/COLOUR ARE
// PERSPECTIVE-INVARIANT — only POSITION rotates.
//
// NOTE: snapshot.dice is the DEDUPED REMAINING moves (for highlights only). The
// dice RENDERER reads gs.dice (the full original roll) + gs.moves separately —
// it must NOT read snapshot.dice.
export function toSnapshot(gs, direction = 0) {
  const points = new Array(25).fill(0);
  for (let i = 0; i < 24; i++) {
    const { n, p } = gs.pts[i];
    points[engineToRenderPt(i, direction)] = n === 0 ? 0 : (p === 1 ? n : -n);
  }
  return {
    points,
    bar: { white: gs.bar[1], black: gs.bar[2] },
    off: { white: gs.off[1], black: gs.off[2] },
    dice: [...new Set(gs.moves)],
    turn: gs.turn === 1 ? 'white' : 'black',
    phase: (gs.turn > 0 && allHome(gs, gs.turn)) ? 'bearingOff' : 'normal',
  };
}

export const colorForTurn = (turn) => (turn === 1 ? 'white' : 'black');

// Checker count at a render point (abs of the signed count; bar via colour).
export function countAt(snapshot, pt) {
  if (pt === 'bar') return 0; // bar landing not a drop target in 8.4
  if (pt === 0) return 0;     // off tray not stacked on the board
  return Math.abs(snapshot.points[pt] || 0);
}
