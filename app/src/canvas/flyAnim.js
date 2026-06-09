// Flying-checker animation (Phase 8.5e-2). Slides a checker from its source to
// its destination with smoothstep easing so AI (and other non-drag) moves no
// longer teleport. The human drag already provides its own motion, so this is
// driven only for moves the player didn't drag (the AI's, today).
//
// The animator is told an ENGINE move ({ f, t }); it resolves pixel endpoints
// from the CURRENT (pre-move) snapshot + geometry, hides the source checker for
// the duration (via drawCheckers' hideFrom), and on the final frame calls onDone
// — which is where the caller commits the move to the engine. One per p5
// instance (state in the closure).

import { ptCenterX, stackCY, barCenterX, barPieceCY, MAX_STACK } from './geometry';
import { engineToRenderPt } from './adapter';
import { offSlotCenter } from './drawOff';

const FLY_FRAMES = 20; // ~0.33s at 60fps

function sourceXY(g, snapshot, fromEngine, isWhite, direction) {
  if (fromEngine === 'bar') {
    const n = isWhite ? snapshot.bar.white : snapshot.bar.black;
    return { x: barCenterX(g), y: barPieceCY(g, isWhite, Math.max(0, n - 1)) };
  }
  const pt = engineToRenderPt(fromEngine, direction);
  const c = Math.abs(snapshot.points[pt] || 0);
  const top = Math.max(0, Math.min(c, MAX_STACK) - 1);
  return { x: ptCenterX(g, pt), y: stackCY(g, pt, top) };
}

function destXY(g, snapshot, toEngine, isWhite, direction) {
  if (toEngine === 'off') {
    const n = isWhite ? snapshot.off.white : snapshot.off.black;
    return offSlotCenter(g, isWhite, n, direction);
  }
  const pt = engineToRenderPt(toEngine, direction);
  const signed = snapshot.points[pt] || 0;
  const mine = (signed > 0) === isWhite ? Math.abs(signed) : 0; // a hit lands at slot 0
  const slot = Math.min(mine, MAX_STACK);
  return { x: ptCenterX(g, pt), y: stackCY(g, pt, slot) };
}

export function createFlyAnimator() {
  let active = false;
  let frame = 0;
  let from = null;
  let to = null;
  let isWhite = true;
  let onDone = null;
  let hideKey = null; // render pt (number) or 'bar:white' / 'bar:black'

  function start(g, snapshot, move, white, direction, done) {
    from = sourceXY(g, snapshot, move.f, white, direction);
    to = destXY(g, snapshot, move.t, white, direction);
    isWhite = white;
    frame = 0;
    active = true;
    onDone = done || null;
    hideKey = move.f === 'bar' ? (white ? 'bar:white' : 'bar:black') : engineToRenderPt(move.f, direction);
  }

  const isActive = () => active;
  const hideFrom = () => (active ? hideKey : null);

  // Advance one frame and draw the flying checker. On the last frame it draws the
  // checker at its destination (anti-flicker) then fires onDone (the commit).
  function step(p, g, C) {
    if (!active) return;
    frame++;
    const finished = frame >= FLY_FRAMES;
    const t = finished ? 1 : frame / FLY_FRAMES;
    const ts = t * t * (3 - 2 * t); // smoothstep
    const x = from.x + (to.x - from.x) * ts;
    const y = from.y + (to.y - from.y) * ts;
    p.noStroke();
    p.fill(isWhite ? C.offwhite : C.ruby);
    p.ellipse(x, y, 2 * g.r, 2 * g.r);
    if (finished) {
      active = false;
      const cb = onDone;
      onDone = null;
      if (cb) cb();
    }
  }

  return { start, isActive, hideFrom, step };
}
