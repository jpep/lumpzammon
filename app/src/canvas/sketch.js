// p5 INSTANCE-mode factory for the Phase 8.3 static spike. Returns a sketch
// closure (p) => {...} that loads the bundled fond + font, computes geometry +
// palette once, and renders the static board/checkers/(frame) composite over a
// hardcoded snapshot. All former module-globals (bgImage, fontLarge, C, geom,
// mockState) live as closure locals — no globals, so two instances can never
// bleed into each other (StrictMode-safe). noLoop() => one-shot render,
// redraw() on resize.

import fond2Url from '../assets/fond2.jpg?url';
import nort100Url from '../assets/nortechico-100.otf?url';
import { computeGeometry } from './geometry';
import { extractDominantHue, buildPalette } from './palette';
import { drawBoard } from './drawBoard';
import { drawCheckers } from './drawCheckers';
import { drawMessageVeil, drawIntroFrame, drawGommanHollow } from './drawFrame';
import { STATIC_SNAPSHOT } from './snapshot';

// Cover-fit the fond into the canvas so the destination-out knockout reveals
// the fond pixels in-canvas (rather than mutating document.body — a DOM
// side-effect that would leak the image behind the whole React app).
function drawCover(p, img, w, h) {
  if (!img || !img.width) return;
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  p.image(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export function makeSketch(opts = {}) {
  const {
    width,
    height,
    showFrame = true,
    showMark = false,
    snapshot = STATIC_SNAPSHOT,
  } = opts;

  return (p) => {
    let bgImage = null;
    let fontLarge = null;
    let C = null;
    let g = null;
    const state = snapshot;

    p.preload = () => {
      bgImage = p.loadImage(fond2Url);
      fontLarge = p.loadFont(nort100Url);
    };

    p.setup = () => {
      p.createCanvas(width, height); // container size, NOT p.windowWidth
      g = computeGeometry(width, height);
      const hue = extractDominantHue(bgImage);
      C = buildPalette(p, hue);
      p.noLoop(); // static render — no orphaned animation loop
    };

    p.draw = () => {
      if (!g || !C) return;
      p.clear();
      drawCover(p, bgImage, p.width, p.height);
      drawBoard(p, g, C);
      drawCheckers(p, g, C, state, fontLarge, showMark);
      if (showFrame) {
        drawMessageVeil(p, 0.86);
        drawIntroFrame(p, g, 1);
        drawGommanHollow(p, g, 1);
      }
    };

    // Custom resize hook driven by the host's ResizeObserver (we do NOT bind
    // p.windowResized, which would survive teardown on the global window).
    p.resize = (w, h) => {
      if (!w || !h) return;
      p.resizeCanvas(w, h);
      g = computeGeometry(w, h);
      p.redraw();
    };
  };
}
