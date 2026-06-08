// Phase 8.3 canvas spike — React mount for the p5 instance-mode board.
//
// Mounts the sketch in a fixed full-screen div, registers the 'nortechico'
// @font-face (so the Canvas-2D GMMN title letters resolve before the one-shot
// draw, not the Noto fallback), and drives resize via a ResizeObserver.
//
// StrictMode-safe teardown: the p5 instance is held in a local const captured
// by the cleanup closure; cleanup disconnects the observer and calls
// inst.remove() (which removes the <canvas>, cancels p5's RAF, and unbinds its
// listeners). A `cancelled` flag guards the async font-load race so a torn-down
// mount never creates a stray instance. Result: exactly one <canvas>.

import { useRef, useEffect } from 'react';
import p5 from 'p5';
import { makeSketch } from '../canvas/sketch';
import { STATIC_SNAPSHOT, STACK_TEST_SNAPSHOT } from '../canvas/snapshot';
import nort100Url from '../assets/nortechico-100.otf?url';

export default function CanvasGame({ showFrame = true, showMark = false, snap = 'initial' }) {
  const ref = useRef(null);
  const snapshot = snap === 'stack' ? STACK_TEST_SNAPSHOT : STATIC_SNAPSHOT;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let inst = null;
    let ro = null;
    let cancelled = false;

    (async () => {
      // Register the CSS @font-face for the title letters (Canvas-2D fillText
      // resolves fonts via document.fonts, not via the p5.Font handle).
      if (![...document.fonts].some((f) => f.family === 'nortechico')) {
        try {
          const ff = new FontFace('nortechico', `url(${nort100Url})`);
          document.fonts.add(ff);
          await ff.load();
        } catch (e) { /* fall back to Noto Sans */ }
      }
      try { await document.fonts.load("60px 'nortechico'"); } catch (e) { /* noop */ }
      if (cancelled) return;

      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      inst = new p5(makeSketch({ width: w, height: h, showFrame, showMark, snapshot }), el);

      ro = new ResizeObserver((entries) => {
        if (cancelled || !inst || !inst.resize) return;
        const { width, height } = entries[0].contentRect;
        inst.resize(Math.round(width), Math.round(height));
      });
      ro.observe(el);
    })();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (inst) inst.remove();
    };
  }, [showFrame, showMark, snapshot]);

  return <div ref={ref} style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }} />;
}
