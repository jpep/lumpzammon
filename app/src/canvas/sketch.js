// p5 INSTANCE-mode factory. Two modes:
//   - static (8.3): renders a fixed snapshot once (noLoop one-shot).
//   - live  (8.4): renders the live engine GameState pushed via inst.update();
//     wires mouse handlers → the interaction layer → onPickup/onMove callbacks
//     so React (authoritative) resolves and commits the move. loop() while
//     dragging (for the ghost/snap easing), noLoop()+redraw() otherwise.
//
// All former module-globals (bgImage, fontLarge, C, geom, the view, the drag
// object) are closure locals — two instances can't bleed (StrictMode-safe).

import fond2Url from '../assets/fond2.jpg?url';
import nort100Url from '../assets/nortechico-100.otf?url';
import { computeGeometry } from './geometry';
import { extractDominantHue, buildPalette } from './palette';
import { drawBoard } from './drawBoard';
import { drawCheckers } from './drawCheckers';
import { drawMessageVeil, drawIntroFrame, drawGommanHollow } from './drawFrame';
import { drawDice } from './dice';
import { hitTestPickup, resolveSnap, updateDragDisplay, drawDraggedChecker } from './interaction';
import { drawSourceHalo, drawTargetRing } from './highlights';
import { countAt } from './adapter';
import { STATIC_SNAPSHOT } from './snapshot';

// Cover-fit the fond into the canvas so destination-out reveals it in-canvas
// (rather than mutating document.body — which would leak it behind the app).
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
    live = false,
    onPickup,
    onMove,
  } = opts;

  return (p) => {
    let bgImage = null;
    let fontLarge = null;
    let C = null;
    let g = null;
    // Live view, replaced/merged via p.update(). gs is null in static mode.
    let view = { snapshot, gs: null, sources: [], targets: [] };
    const drag = {
      active: false, fromPt: null, turnColor: 'white',
      mouseX: 0, mouseY: 0, dispX: 0, dispY: 0, snapPt: null, snapT: 0,
    };

    p.preload = () => {
      bgImage = p.loadImage(fond2Url);
      fontLarge = p.loadFont(nort100Url);
    };

    p.setup = () => {
      p.createCanvas(width, height); // container size, NOT p.windowWidth
      g = computeGeometry(width, height);
      const hue = extractDominantHue(bgImage);
      C = buildPalette(p, hue);
      p.noLoop(); // redraw-on-change; loop() only while dragging
    };

    p.draw = () => {
      if (!g || !C) return;
      p.clear();
      drawCover(p, bgImage, p.width, p.height);
      drawBoard(p, g, C);
      if (view.sources && view.sources.length) {
        drawSourceHalo(p, g, C, view.sources, view.snapshot, drag.active ? drag.fromPt : null);
      }
      drawCheckers(p, g, C, view.snapshot, fontLarge, showMark);
      if (view.gs) drawDice(p, g, C, view.gs);
      if (drag.active) {
        drawTargetRing(p, g, C, view.targets, drag.snapPt, view.snapshot);
        const snapCount = drag.snapPt != null ? countAt(view.snapshot, drag.snapPt) : 0;
        updateDragDisplay(g, drag, snapCount);
        drawDraggedChecker(p, g, C, drag);
      }
      if (showFrame) {
        drawMessageVeil(p, 0.86);
        drawIntroFrame(p, g, 1);
        drawGommanHollow(p, g, 1);
      }
    };

    // Push new live state/highlights from React. Redraw unless mid-drag (the
    // drag loop already repaints every frame).
    p.update = (next) => {
      view = { ...view, ...next };
      if (!drag.active) p.redraw();
    };

    // Expose the resolved geometry (for the DEV test hook to compute pixels).
    p.getGeom = () => g;

    p.resize = (w, h) => {
      if (!w || !h) return;
      p.resizeCanvas(w, h);
      g = computeGeometry(w, h);
      p.redraw();
    };

    if (live) {
      p.mousePressed = () => {
        if (!view.gs) return;
        const turnColor = view.snapshot.turn;
        const hit = hitTestPickup(g, view.snapshot, turnColor, p.mouseX, p.mouseY);
        if (!hit) return;
        drag.active = true;
        drag.fromPt = hit.fromPt;
        drag.turnColor = turnColor;
        drag.mouseX = drag.dispX = p.mouseX;
        drag.mouseY = drag.dispY = p.mouseY;
        drag.snapPt = null;
        drag.snapT = 0;
        p.loop();
        if (onPickup) onPickup(hit.fromPt);
      };
      p.mouseDragged = () => {
        if (!drag.active) return;
        drag.mouseX = p.mouseX;
        drag.mouseY = p.mouseY;
        drag.snapPt = resolveSnap(g, view.targets, view.snapshot.turn, p.mouseX, p.mouseY);
      };
      p.mouseReleased = () => {
        if (!drag.active) return;
        const { fromPt, snapPt } = drag;
        drag.active = false;
        drag.snapPt = null;
        drag.snapT = 0;
        p.noLoop();
        p.redraw();
        if (snapPt != null && onMove) onMove(fromPt, snapPt);
      };
    }
  };
}
