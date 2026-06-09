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

// Infer a single checker move from a pre/post ENGINE state pair (for animating a
// remote/online opponent move, which arrives as a whole new synced state). The
// mover is whoever was on turn in `prev`. Returns { f, t, mover } in ENGINE
// coords (f/t are an index 0-23, or 'bar'/'off'), or null when the diff isn't a
// clean single move (cube change, roll, multi-step combined hop, etc.) — the
// caller then just snaps to the new state instead of animating.
export function diffMove(prev, next) {
  if (!prev || !next || !prev.pts || !next.pts) return null;
  const mover = prev.turn;
  if (mover !== 1 && mover !== 2) return null;
  const cnt = (cell) => (cell && cell.p === mover ? cell.n : 0);
  let from = null;
  let to = null;
  for (let i = 0; i < 24; i++) {
    const d = cnt(next.pts[i]) - cnt(prev.pts[i]);
    if (d === 0) continue;
    if (d === -1 && from === null) from = i;
    else if (d === 1 && to === null) to = i;
    else return null; // ambiguous / not a single move
  }
  const barD = ((next.bar && next.bar[mover]) || 0) - ((prev.bar && prev.bar[mover]) || 0);
  if (barD === -1) { if (from !== null) return null; from = 'bar'; }
  else if (barD !== 0) return null;
  const offD = ((next.off && next.off[mover]) || 0) - ((prev.off && prev.off[mover]) || 0);
  if (offD === 1) { if (to !== null) return null; to = 'off'; }
  else if (offD !== 0) return null;
  if (from === null || to === null) return null;
  return { f: from, t: to, mover };
}

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
  let hideKeys = [];  // render pts (numbers) or 'bar:white'/'bar:black' to hide
  let bump = null;    // { fromX, fromY, toX, toY, isWhite } — a hit checker → bar

  function start(g, snapshot, move, white, direction, done) {
    from = sourceXY(g, snapshot, move.f, white, direction);
    to = destXY(g, snapshot, move.t, white, direction);
    isWhite = white;
    frame = 0;
    active = true;
    onDone = done || null;
    hideKeys = [move.f === 'bar' ? (white ? 'bar:white' : 'bar:black') : engineToRenderPt(move.f, direction)];
    bump = null;
    // Hit? If the destination holds a single opposing blot, slide it to the bar.
    if (move.t !== 'off') {
      const pt = engineToRenderPt(move.t, direction);
      const signed = snapshot.points[pt] || 0;
      const isBlot = signed !== 0 && (signed > 0) !== white && Math.abs(signed) === 1;
      if (isBlot) {
        const bumpedWhite = !white;
        const barN = bumpedWhite ? snapshot.bar.white : snapshot.bar.black;
        bump = {
          fromX: ptCenterX(g, pt), fromY: stackCY(g, pt, 0),
          toX: barCenterX(g), toY: barPieceCY(g, bumpedWhite, barN),
          isWhite: bumpedWhite,
        };
        hideKeys.push(pt); // hide the static blot while it flies
      }
    }
  }

  const isActive = () => active;
  const hideFrom = () => (active ? hideKeys : null);
  // Abort without firing onDone (a newer state superseded this fly).
  const cancel = () => { active = false; onDone = null; };

  // Advance one frame and draw the flying checker(s). On the last frame it draws
  // them at their destinations (anti-flicker) then fires onDone (the commit).
  function step(p, g, C) {
    if (!active) return;
    frame++;
    const finished = frame >= FLY_FRAMES;
    const t = finished ? 1 : frame / FLY_FRAMES;
    const ts = t * t * (3 - 2 * t); // smoothstep
    p.noStroke();
    p.fill(isWhite ? C.offwhite : C.ruby);
    p.ellipse(from.x + (to.x - from.x) * ts, from.y + (to.y - from.y) * ts, 2 * g.r, 2 * g.r);
    if (bump) {
      p.fill(bump.isWhite ? C.offwhite : C.ruby);
      p.ellipse(bump.fromX + (bump.toX - bump.fromX) * ts, bump.fromY + (bump.toY - bump.fromY) * ts, 2 * g.r, 2 * g.r);
    }
    if (finished) {
      active = false;
      const cb = onDone;
      onDone = null;
      if (cb) cb();
    }
  }

  return { start, isActive, hideFrom, cancel, step };
}
