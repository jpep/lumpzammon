// Board substrate: board rect, central bar, the 24 "staircase" triangles, and
// the ivory contour. Ported verbatim from devanture/sketch.js drawBoard +
// drawTri (the static path only — no halo/clip/animation branches).
//
// Each point is a STAIRCASE of 7 stacked rectangular layers (not a smooth
// triangle); the thin inset on layer 1 (19/20) leaves a visible hollow seam at
// the base. Parameterized over (p, g, C).

// Exact layer widths/heights in a-units — do not paraphrase (sketch.js 3353-3361).
export const TRI_LAYERS = [
  { wA: 1, hA: 0.5 },
  { wA: 19 / 20, hA: 0.5 },
  { wA: 5 / 6, hA: 1 },
  { wA: 2 / 3, hA: 1 },
  { wA: 1 / 2, hA: 1 },
  { wA: 1 / 3, hA: 1 },
  { wA: 1 / 6, hA: 1 },
];

export function drawTri(p, g, C, x, baseY, pointUp, isDark) {
  p.noStroke();
  p.fill(isDark ? C.triA : C.triB);
  const cx = x + g.a / 2;
  const layerTopY = (i) => {
    let off = 0;
    for (let k = 0; k <= i; k++) off += TRI_LAYERS[k].hA * g.a;
    return pointUp ? baseY - off : baseY + off - TRI_LAYERS[i].hA * g.a;
  };
  for (let i = 0; i < TRI_LAYERS.length; i++) {
    const w = TRI_LAYERS[i].wA * g.a;
    const h = TRI_LAYERS[i].hA * g.a;
    p.rect(cx - w / 2, layerTopY(i), w, h);
  }
}

export function drawBoard(p, g, C) {
  const SW = 2;
  const barLX = g.bx + 6 * g.a;
  const barRX = g.bx + 7 * g.a;

  p.noStroke();
  p.fill(C.board);
  p.rect(g.bx, g.by, 13 * g.a, 13 * g.a);

  p.fill(C.bar);
  p.noStroke();
  p.rect(barLX, g.by, barRX - barLX, 13 * g.a);

  // 24 triangles: 6 per quadrant, alternating dark/light, bottom row points up.
  for (let i = 0; i < 6; i++) {
    const dark = (i % 2 === 0);
    drawTri(p, g, C, g.bx + (12 - i) * g.a, g.by + 13 * g.a, true, dark);   // pts 1-6 (bottom-right)
    drawTri(p, g, C, g.bx + (5 - i) * g.a, g.by + 13 * g.a, true, !dark);   // pts 7-12 (bottom-left)
    drawTri(p, g, C, g.bx + i * g.a, g.by, false, dark);                    // pts 13-18 (top-left)
    drawTri(p, g, C, g.bx + (7 + i) * g.a, g.by, false, !dark);             // pts 19-24 (top-right)
  }

  // Ivory outer contour just OUTSIDE the fill, plus the two bar lines.
  p.stroke(C.ivory);
  p.strokeWeight(SW);
  p.noFill();
  p.rect(g.bx - SW / 2, g.by - SW / 2, 13 * g.a + SW, 13 * g.a + SW);
  p.line(barLX, g.by, barLX, g.by + 13 * g.a);
  p.line(barRX, g.by, barRX, g.by + 13 * g.a);
}
