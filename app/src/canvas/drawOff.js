// Bear-off trays (Phase 8.5e-2). devanture draws the borne-off checkers as a
// linear bar of flattened slats beside the board; the embedded square canvas has
// no such side column, but it DOES leave a ~bx-wide gutter to the right of the
// 13a board (a is height-limited, so bx > 0). We stack the borne-off checkers as
// flattened bars in that right gutter: the near player's tray at the bottom, the
// far player's at the top (perspective-aware via `direction`), each capped at 15
// with a count label.

const OFF_H_R = 0.5;     // bar height (r units)
const OFF_PITCH_R = 0.62; // vertical pitch between bars
const OFF_MAXW_R = 1.6;  // bar width cap

function isBottomTray(isWhite, direction) {
  // The near player sits at the bottom; direction=1 (online P2) makes black near.
  return isWhite ? direction !== 1 : direction === 1;
}

function offDims(g) {
  const innerX = g.bx + 13 * g.a;          // right edge of the board
  const gutterW = g.cssW - innerX;         // ~bx
  const w = Math.min(OFF_MAXW_R * g.r, Math.max(6, gutterW - 4));
  return { w, h: OFF_H_R * g.r, pitch: OFF_PITCH_R * g.r, cx: innerX + gutterW / 2 };
}

// Pixel centre of the n-th (0-based) borne-off checker for a player — also the
// landing point of a bear-off fly animation.
export function offSlotCenter(g, isWhite, n, direction = 0) {
  const d = offDims(g);
  const y = isBottomTray(isWhite, direction)
    ? (g.by + 13 * g.a) - d.h / 2 - 2 - n * d.pitch   // stack up from the bottom
    : g.by + d.h / 2 + 2 + n * d.pitch;               // stack down from the top
  return { x: d.cx, y };
}

export function drawOffTrays(p, g, C, snapshot, direction = 0) {
  if (!snapshot || !snapshot.off) return;
  tray(true, snapshot.off.white || 0);
  tray(false, snapshot.off.black || 0);

  function tray(isWhite, count) {
    if (!count) return;
    const d = offDims(g);
    const col = isWhite ? C.offwhite : C.ruby;
    const vis = Math.min(count, 15);
    p.noStroke();
    p.fill(col);
    for (let n = 0; n < vis; n++) {
      const c = offSlotCenter(g, isWhite, n, direction);
      p.rect(c.x - d.w / 2, c.y - d.h / 2, d.w, d.h, d.h * 0.35);
    }
    const last = offSlotCenter(g, isWhite, vis - 1, direction);
    const ly = isBottomTray(isWhite, direction) ? last.y - d.pitch : last.y + d.pitch;
    p.fill(C.ivory);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(g.r * 0.7);
    p.text(String(count), last.x, ly);
  }
}
