// The single bridge between the engine GameState and the canvas render shape.
// ALL coordinate conversion lives here (engine 0..23/'bar'/'off'  <->  render
// 1..24/'bar'/0) — never inline a +1/-1 elsewhere (off-by-one is the most
// likely bug across the three coordinate systems: engine / render / pixel).

import { allHome } from '../game/logic';

// GameState -> render snapshot (devanture mockState shape the draw fns consume).
// Verbatim port of devanture/adapter.js syncMockState: engine index i -> render
// point i+1; P1 = white = +n; P2 = black = -n; bar/off keyed 1/2 -> white/black.
//
// NOTE: snapshot.dice is the DEDUPED REMAINING moves (for highlights only). The
// dice RENDERER reads gs.dice (the full original roll) + gs.moves separately —
// it must NOT read snapshot.dice.
export function toSnapshot(gs) {
  const points = new Array(25).fill(0);
  for (let i = 0; i < 24; i++) {
    const { n, p } = gs.pts[i];
    points[i + 1] = n === 0 ? 0 : (p === 1 ? n : -n);
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

// render source point -> engine source coord. Render 'bar' stays 'bar'.
export const renderToEngineFrom = (fromPt) => (fromPt === 'bar' ? 'bar' : fromPt - 1);

// render target point -> engine target coord. Render 0 == engine 'off'.
export const renderToEngineTo = (toPt) => (toPt === 0 ? 'off' : toPt - 1);

// engine coord -> render point. 'bar' stays 'bar', 'off' -> 0, else idx+1.
export const engineToRenderPt = (idx) => (idx === 'bar' ? 'bar' : (idx === 'off' ? 0 : idx + 1));

export const colorForTurn = (turn) => (turn === 1 ? 'white' : 'black');

// Checker count at a render point (abs of the signed count; bar via colour).
export function countAt(snapshot, pt) {
  if (pt === 'bar') return 0; // bar landing not a drop target in 8.4
  if (pt === 0) return 0;     // off tray not stacked on the board
  return Math.abs(snapshot.points[pt] || 0);
}
