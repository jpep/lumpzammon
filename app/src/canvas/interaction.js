// Pure inverse-geometry hit-test + drag-ghost helpers (no p5 instance, no React
// beyond the passed args). The sketch calls these from p5 mouse handlers and
// emits onMove on release; the React parent computes legal targets (via the
// engine's collectTargets) and passes them in as render-point arrays.
//
// Render coords: points 1..24, 'bar', 0 == off. Portrait-first, mirrorMode=false
// (online P2 perspective deferred to 8.5). All geometry in the g frame.

import {
  ptCenterX, stackCY, barPieceCY, barCenterX, ptNextY, MAX_STACK,
} from './geometry';

const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Which checker did the active player grab? Bar first, then the topmost visible
// checker of a point. Returns { fromPt:'bar'|1..24 } or null.
export function hitTestPickup(g, snapshot, turnColor, mx, my) {
  const isWhite = turnColor === 'white';

  // Bar takes priority (you must enter from the bar first).
  const barCount = isWhite ? snapshot.bar.white : snapshot.bar.black;
  if (barCount > 0) {
    const bcx = barCenterX(g);
    for (let bi = 0; bi < barCount; bi++) {
      if (dist(mx, my, bcx, barPieceCY(g, isWhite, bi)) < g.r) return { fromPt: 'bar' };
    }
  }

  for (let pt = 1; pt <= 24; pt++) {
    const val = snapshot.points[pt];
    if (!val) continue;
    if (isWhite ? val < 0 : val > 0) continue; // only the turn player's checkers
    const cx = ptCenterX(g, pt);
    const visible = Math.min(Math.abs(val), MAX_STACK);
    let clickedIdx = -1;
    for (let i = 0; i < visible; i++) {
      if (dist(mx, my, cx, stackCY(g, pt, i)) < g.r) clickedIdx = i; // last match = topmost
    }
    if (clickedIdx >= 0) return { fromPt: pt };
  }
  return null;
}

// Which legal target (render point, 0 == off) does the cursor snap to? Board
// points snap within a horizontal band of width `a` (Y ignored, forgiving);
// off snaps in the wide bear-off zone. Returns the render point or null.
export function resolveSnap(g, targets, turnColor, mx, my) {
  const isWhite = turnColor === 'white';
  const boardTop = g.by;
  const boardBot = g.by + 13 * g.a;
  const boardL = g.bx;
  const boardR = g.bx + 13 * g.a;
  const inBoard = mx >= boardL && mx <= boardR && my >= boardTop && my <= boardBot;

  for (const tpt of targets) {
    if (tpt === 0) {
      // Bear-off zone.
      let inOff = false;
      if (g.diceOnSide) {
        if (mx > boardR) inOff = true;
      } else if (isWhite ? my > boardBot : my < boardTop) {
        inOff = true;
      } else if (!inBoard) {
        if (isWhite ? my > g.cssH / 2 : my < g.cssH / 2) inOff = true;
      }
      if (inOff) return 0;
    } else if (Math.abs(mx - ptCenterX(g, tpt)) <= g.a / 2) {
      return tpt;
    }
  }
  return null;
}

// Ease the dragged ghost toward the snap slot (or the cursor when unsnapped).
export function updateDragDisplay(g, drag, snapCount) {
  const tx = drag.snapPt != null ? ptCenterX(g, drag.snapPt) : drag.mouseX;
  const ty = drag.snapPt != null && drag.snapPt !== 0
    ? ptNextY(g, drag.snapPt, snapCount)
    : drag.mouseY;
  drag.dispX = lerp(drag.dispX, tx, 0.13);
  drag.dispY = lerp(drag.dispY, ty, 0.13);
}

// The dragged checker: a rounded disc that morphs toward a bear-off bar when
// snapped to the off tray (snapPt === 0).
export function drawDraggedChecker(p, g, C, drag) {
  const isWhite = drag.turnColor === 'white';
  const targetT = drag.snapPt === 0 ? 1 : 0;
  drag.snapT = lerp(drag.snapT == null ? 0 : drag.snapT, targetT, 0.13);
  const width = lerp(2 * g.r, (2.5 / 6) * g.r, drag.snapT);
  const height = 2 * g.r;
  const cornerR = lerp(g.r, 0, drag.snapT);
  const x = drag.dispX - width / 2;
  const y = drag.dispY - height / 2;

  // soft shadow
  p.noStroke();
  p.fill(0, 0, 0, 25);
  p.rect(x - 1, y + 3, width + 2, height + 2, cornerR + 4);
  // body
  p.fill(isWhite ? C.offwhite : C.ruby);
  p.rect(x, y, width, height, cornerR);
}
