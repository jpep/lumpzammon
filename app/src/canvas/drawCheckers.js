// Checkers: per-point stacks, bar pieces, the +N overflow label, and the
// optional NORTECHICO mark (the U+F8FF PUA glyph drawn via the p5.Font — the
// genuine test that p5.loadFont reaches the private-use glyph). Ported from
// devanture/sketch.js drawCheckers / drawStackOnPoint / drawChecker /
// drawCheckerLabel / drawNortechicoMark / triColorForPoint, static path only.

import { ptCenterX, stackCY, barPieceCY, barCenterX, MAX_STACK } from './geometry';

const NORTECHICO_GLYPH = '';
const NORTECHICO_Y_NUDGE = -0.27;

// Triangle colour under a given point — used to tint the NORTECHICO mark.
export function triColorForPoint(C, pt) {
  let dark;
  if (pt <= 6) dark = (pt % 2 === 1);
  else if (pt <= 12) dark = (pt % 2 === 0);
  else if (pt <= 18) dark = (pt % 2 === 1);
  else dark = (pt % 2 === 0);
  return dark ? C.triA : C.triB;
}

export function drawChecker(p, g, C, cx, cy, isWhite) {
  p.fill(isWhite ? C.offwhite : C.ruby);
  p.noStroke();
  p.ellipse(cx, cy, 2 * g.r, 2 * g.r);
}

export function drawCheckerLabel(p, g, C, cx, cy, isWhite, label, font) {
  p.fill(isWhite ? C.offwhite : C.ruby);
  p.noStroke();
  p.ellipse(cx, cy, 2 * g.r, 2 * g.r);
  p.fill(isWhite ? C.numColor : C.ivory);
  p.textAlign(p.CENTER, p.CENTER);
  if (font) p.textFont(font);
  p.textSize(g.r * 0.78);
  p.text(label, cx, cy);
}

// The U+F8FF mark, tinted to the host point's triangle colour at 20% opacity.
export function drawNortechicoMark(p, g, font, cx, cy, bgCol) {
  if (!font) return;
  p.noStroke();
  p.fill(p.red(bgCol), p.green(bgCol), p.blue(bgCol), Math.round(255 * 0.20));
  p.textFont(font);
  p.textSize(g.r * 1.6);
  p.textAlign(p.CENTER, p.CENTER);
  p.text(NORTECHICO_GLYPH, cx, cy + g.r * NORTECHICO_Y_NUDGE);
}

export function drawStackOnPoint(p, g, C, pt, count, isWhite, font, showMark) {
  const cx = ptCenterX(g, pt);
  const visible = Math.min(count, MAX_STACK);
  const overflow = Math.max(count - MAX_STACK, 0);
  const bgCol = triColorForPoint(C, pt);
  for (let i = 0; i < visible; i++) {
    const cy = stackCY(g, pt, i);
    const isTop = (i === visible - 1);
    if (isTop && overflow > 0) {
      drawCheckerLabel(p, g, C, cx, cy, isWhite, `+${overflow}`, font);
    } else {
      drawChecker(p, g, C, cx, cy, isWhite);
      if (showMark) drawNortechicoMark(p, g, font, cx, cy, bgCol);
    }
  }
}

// hideFrom (optional): hide ONE checker at this source while it's mid-flight — a
// render point number (hides that point's top checker) or 'bar:white'/'bar:black'.
export function drawCheckers(p, g, C, state, font, showMark, hideFrom = null) {
  for (let pt = 1; pt <= 24; pt++) {
    let v = state.points[pt];
    if (!v) continue;
    let count = Math.abs(v);
    if (hideFrom === pt) count -= 1; // the top checker is flying
    if (count > 0) drawStackOnPoint(p, g, C, pt, count, v > 0, font, showMark);
  }
  const bcx = barCenterX(g);
  const barW = state.bar.white - (hideFrom === 'bar:white' ? 1 : 0);
  const barB = state.bar.black - (hideFrom === 'bar:black' ? 1 : 0);
  for (let i = 0; i < barW; i++) drawChecker(p, g, C, bcx, barPieceCY(g, true, i), true);
  for (let i = 0; i < barB; i++) drawChecker(p, g, C, bcx, barPieceCY(g, false, i), false);
}
