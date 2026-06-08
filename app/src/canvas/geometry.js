// Board geometry, ported verbatim from devanture/sketch.js computeGeometry +
// the point/stack coordinate helpers. The four globals (a, r, bx, by) and the
// diceOnSide flag are bundled into a returned geom object `g`; every helper
// takes `g` instead of reading module globals.
//
// Units: `a` = one point/column width (and one full stack step); `r = a/2` =
// checker radius. The board is always a 13a x 13a square centred in the canvas
// (12 point columns + 1 bar column). Derived once from the CSS pixel size of
// the React container (NOT p.windowWidth).

export const MAX_STACK = 6;
export const NAMES_W_A = 6;           // a-units reserved at the side in landscape
export const BAR_CENTER_GAP_R = 1.5;  // half-gap (in r) left clear at the bar centre

export function computeGeometry(cssW, cssH) {
  const diceOnSide = cssW >= cssH * 1.1; // landscape => dice on the side
  let a;
  if (diceOnSide) {
    const sideA = Math.max(3.5, NAMES_W_A); // = 6
    const totalA = 13 + 2 * sideA;          // = 25
    const totalH = 15;
    a = Math.min(cssW / totalA, cssH / totalH);
    if (cssW >= 1500) a *= 0.85;
  } else {
    const portraitMargin = 8;
    const maxW = cssW - 2 * portraitMargin;
    const VERTICAL_TOTAL_A = 13 + 9; // = 22 (9a top headroom)
    a = Math.min(maxW / 13, cssH / VERTICAL_TOTAL_A);
  }
  const r = a / 2;
  const bx = (cssW - 13 * a) / 2; // board centred horizontally
  const by = (cssH - 13 * a) / 2; // board centred vertically
  return { a, r, bx, by, diceOnSide };
}

// Pixel centre X of point index pt (1..24). (pt==0 bear-off branch dropped for
// the static slice.) mirrorMode is hardcoded false here.
export function ptCenterX(g, pt) {
  let lx;
  if (pt >= 1 && pt <= 6) lx = g.bx + (13 - pt) * g.a;
  else if (pt <= 12) lx = g.bx + (12 - pt) * g.a;
  else if (pt <= 18) lx = g.bx + (pt - 13) * g.a;
  else lx = g.bx + (pt - 12) * g.a;
  return lx + g.a / 2;
}

// Pixel centre Y of the i-th checker (0-based) in a stack on point pt.
// Bottom half (pts 1-12) stacks UPWARD from the floor; top half (13-24) stacks
// DOWNWARD from the ceiling.
export function stackCY(g, pt, i) {
  const isBot = pt <= 12;
  return isBot ? g.by + 13 * g.a - g.r - i * g.a : g.by + g.r + i * g.a;
}

// Pixel centre Y of the idx-th checker on the central bar. White stacks above
// the board centre, black below, with a generous gap left clear at the centre.
export function barPieceCY(g, isWhite, idx) {
  const cy = g.by + 6.5 * g.a;
  const off = g.r + BAR_CENTER_GAP_R * g.r + idx * g.a;
  return isWhite ? cy - off : cy + off;
}

// Bar column centre X.
export function barCenterX(g) {
  return g.bx + 6.5 * g.a;
}
