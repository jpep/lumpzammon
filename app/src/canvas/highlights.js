// Move hints: a halo on each movable source point, and a ring on each legal
// target while dragging. Driven entirely by render-point arrays the React
// parent derives from the engine (getValidMoves sources, collectTargets per
// pickup). Static rings for 8.4 — the millis-based pulse + perimeter glow +
// fibre-optic top-checker polish are deferred to 8.5.

import { ptCenterX, ptTopY, ptNextY, barPieceCY, barCenterX } from './geometry';
import { countAt } from './adapter';

// Soft ivory halo around the topmost checker of each movable source.
export function drawSourceHalo(p, g, C, sourceRenderPts, snapshot, dragFromPt) {
  p.noFill();
  p.stroke(p.red(C.ivory), p.green(C.ivory), p.blue(C.ivory), 140);
  p.strokeWeight(Math.max(2, g.r * 0.18));
  for (const pt of sourceRenderPts) {
    if (pt === dragFromPt) continue; // don't halo the piece in hand
    let cx;
    let cy;
    if (pt === 'bar') {
      cx = barCenterX(g);
      cy = barPieceCY(g, snapshot.turn === 'white', 0);
    } else {
      cx = ptCenterX(g, pt);
      cy = ptTopY(g, pt, countAt(snapshot, pt));
    }
    p.ellipse(cx, cy, 2 * g.r * 1.2, 2 * g.r * 1.2);
  }
}

// Ring on the landing slot of each legal target; brighter on the snapped one.
export function drawTargetRing(p, g, C, targetRenderPts, snapPt, snapshot) {
  p.noFill();
  p.strokeWeight(2);
  for (const tpt of targetRenderPts) {
    if (tpt === 0) continue; // off-tray ring deferred (drop zone still works)
    const cx = ptCenterX(g, tpt);
    const cy = ptNextY(g, tpt, countAt(snapshot, tpt));
    const a = snapPt === tpt ? 220 : 90;
    p.stroke(p.red(C.ivory), p.green(C.ivory), p.blue(C.ivory), a);
    p.ellipse(cx, cy, 2 * g.r, 2 * g.r);
  }
}
