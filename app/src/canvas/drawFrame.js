// The signature GMMN overlay: a dark veil, the hollow board frame, and the
// hollow GMMN title — all via Canvas-2D destination-out "knockout" that carves
// the dark veil to reveal what's painted beneath (the fond + board). Ported
// from devanture/sketch.js drawMessageVeil / drawIntroFrame / drawGommanHollow
// (+ gomman metrics). No CSS/SVG equivalent — this is why the canvas is reused.
//
// Parameterized over (p, g). The title LETTERS (G / MM / N) are drawn with the
// Canvas-2D text path in the 'nortechico' CSS @font-face (registered by
// CanvasGame via the FontFace API). The catana glyph between the letters is
// EMPTY in the current devanture source (wK = 0), so the letters sit adjacent;
// we omit it rather than depend on a PUA glyph here (the U+F8FF path is
// exercised by drawNortechicoMark on the checkers instead).
//
// Portrait-first: the landscape 90° rotation of the title is intentionally
// skipped for the spike (documented). Use a portrait viewport to see the title.

const NAME_FONT_CSS = "'nortechico','Noto Sans',sans-serif";

// Full-canvas dark veil. The frame/logo are a PRE-GAME overlay — they only read
// correctly over this veil (the knockout reveals the board faintly through it).
export function drawMessageVeil(p, alpha = 0.86) {
  const ctx = p.drawingContext;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, p.width, p.height);
  ctx.restore();
}

// Two pens start at top-centre, run down the LEFT/RIGHT sides and along the
// BOTTOM to meet at bottom-centre — tracing the board's left/right/bottom edges
// (NO top edge). progress in [0,1]; 1 = full frame.
export function drawIntroFrame(p, g, progress = 1) {
  const ctx = p.drawingContext;
  const cxC = g.bx + 13 * g.a / 2;
  const lenPath = 13 * g.a / 2 + 13 * g.a + 13 * g.a / 2; // 26a per pen
  const drawn = lenPath * progress;

  function buildPenPath(direction) {
    let rem = drawn;
    let x = cxC, y = g.by;
    ctx.beginPath();
    ctx.moveTo(x, y);
    {
      const step = Math.min(13 * g.a / 2, rem);
      x += direction * step;
      ctx.lineTo(x, y);
      rem -= step;
    }
    if (rem > 0) {
      const step = Math.min(13 * g.a, rem);
      y += step;
      ctx.lineTo(x, y);
      rem -= step;
    }
    if (rem > 0) {
      const step = Math.min(13 * g.a / 2, rem);
      x -= direction * step;
      ctx.lineTo(x, y);
    }
  }

  ctx.save();
  ctx.lineWidth = 2.0;
  ctx.lineCap = 'butt';
  // Pass 1: knockout (reveals the fond/board through the veil)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = 'rgba(0,0,0,1)';
  buildPenPath(-1); ctx.stroke();
  buildPenPath(+1); ctx.stroke();
  // Pass 2: translucent white veil for contrast on a dark fond
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  buildPenPath(-1); ctx.stroke();
  buildPenPath(+1); ctx.stroke();
  ctx.restore();
}

function gommanSegmentWidths(p, sz) {
  const ctx = p.drawingContext;
  ctx.font = `${sz}px ${NAME_FONT_CSS}`;
  const wG = ctx.measureText('G').width;
  const wMM = ctx.measureText('MM').width;
  const wN = ctx.measureText('N').width;
  const wK = 0; // catana glyph is empty in the current source
  return { wG, wMM, wN, wK, total: wG + wK + wMM + wK + wN };
}

function gommanTitleMetrics(p, g) {
  let sz = g.a * 4.5;
  let segs = gommanSegmentWidths(p, sz);
  const maxW = 13 * g.a; // title spans the board width (G at bx, N at bx+13a)
  if (segs.total > maxW) {
    sz *= maxW / segs.total;
    segs = gommanSegmentWidths(p, sz);
  }
  return { size: sz, width: segs.total, segs };
}

// Hollow GMMN title above the board, carved into the veil. titleAlpha in [0,1].
export function drawGommanHollow(p, g, titleAlpha = 1) {
  const ctx = p.drawingContext;
  const m = gommanTitleMetrics(p, g);
  const sz = m.size;
  const segs = m.segs;
  const gap = g.r / 2;
  const cyC = g.by - gap - sz / 6; // title sits above the board's top edge
  const x0 = g.bx;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  // Clip the lower third of the title (keep only y < clipBottom).
  const clipBottom = cyC + sz / 6;
  const HUGE = (p.width + p.height) * 2;
  ctx.beginPath();
  ctx.rect(-HUGE, -HUGE, 3 * HUGE, clipBottom + HUGE);
  ctx.clip();

  function drawSegments() {
    let x = x0;
    ctx.fillText('G', x, cyC); x += segs.wG + segs.wK;
    ctx.fillText('MM', x, cyC); x += segs.wMM + segs.wK;
    ctx.fillText('N', x, cyC);
  }

  ctx.font = `${sz}px ${NAME_FONT_CSS}`;
  // Step 1: knockout
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${titleAlpha})`;
  drawSegments();
  // Step 2: translucent white veil for contrast
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(255,255,255,${0.35 * titleAlpha})`;
  drawSegments();
  ctx.restore();
}
