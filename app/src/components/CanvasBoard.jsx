// Controlled, perspective-aware p5 canvas board (Phase 8.5a).
//
// A pure renderer + drag-input surface: it renders the live engine GameState it
// is given and, on a legal drop, emits onMove({ f, t }) in ENGINE coords. It
// commits NOTHING — the parent (GameScreen, or the CanvasGame dev harness) owns
// the state and applies the move. Perspective (direction 0|1) is a 180° render
// rotation handled in canvas/adapter.js.
//
// Sizing: the host div fills its parent (width/height 100%); the parent gives it
// a definite size. StrictMode-safe: the p5 instance is mounted once and torn
// down via inst.remove(); live state flows in via inst.update() (refs read in
// stable handlers), so the instance is never recreated on a state change.

import { useRef, useEffect, useCallback } from 'react';
import p5 from 'p5';
import { makeSketch } from '../canvas/sketch';
import {
  toSnapshot, renderToEngineFrom, renderToEngineTo, engineToRenderPt,
} from '../canvas/adapter';
import nort100Url from '../assets/nortechico-100.otf?url';
import { getValidMoves } from '../game/logic';
import { collectTargets } from '../game/moveResolution';

export default function CanvasBoard({
  gameState,
  direction = 0,
  interactive = false,
  onMove,
  onReady,
  showFrame = false,
  showMark = false,
  showDice = true,
  embedded = true,
}) {
  const ref = useRef(null);
  const instRef = useRef(null);
  const gsRef = useRef(gameState);
  const dirRef = useRef(direction);
  const interactiveRef = useRef(interactive);
  const onMoveRef = useRef(onMove);

  // Keep the onMove ref fresh without changing handleMove's identity (which
  // would otherwise re-run the mount effect and recreate the p5 instance).
  useEffect(() => { onMoveRef.current = onMove; });

  const buildView = useCallback((gs, dir, inter) => ({
    snapshot: toSnapshot(gs, dir),
    gs,
    direction: dir,
    sources: inter
      ? [...new Set(getValidMoves(gs, gs.turn).map((m) => engineToRenderPt(m.f, dir)))]
      : [],
    targets: [],
  }), []);

  // Canvas grabbed a checker → compute its legal targets and push them down.
  const handlePickup = useCallback((fromPt) => {
    if (!interactiveRef.current) return;
    const gs = gsRef.current;
    const dir = dirRef.current;
    const fromIdx = renderToEngineFrom(fromPt, dir);
    const targets = collectTargets(gs, gs.turn, fromIdx, gs.moves.length)
      .map((idx) => engineToRenderPt(idx, dir));
    instRef.current?.update({ targets });
  }, []);

  // Canvas dropped on a legal target → emit ENGINE coords; parent commits.
  const handleMove = useCallback((fromPt, toPt) => {
    if (!interactiveRef.current || !onMoveRef.current) return;
    const dir = dirRef.current;
    onMoveRef.current({ f: renderToEngineFrom(fromPt, dir), t: renderToEngineTo(toPt, dir) });
  }, []);

  // Mount the p5 instance once (NOT on gameState/direction/interactive change).
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let inst = null;
    let ro = null;
    let cancelled = false;

    (async () => {
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
      inst = new p5(makeSketch({
        width: w,
        height: h,
        showFrame,
        showMark,
        showDice,
        embedded,
        live: true,
        onPickup: handlePickup,
        onMove: handleMove,
      }), el);
      instRef.current = inst;

      ro = new ResizeObserver((entries) => {
        if (cancelled || !inst || !inst.resize) return;
        const { width, height } = entries[0].contentRect;
        inst.resize(Math.round(width), Math.round(height));
      });
      ro.observe(el);

      inst.update(buildView(gsRef.current, dirRef.current, interactiveRef.current));
      if (onReady) onReady(inst);
    })();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (inst) inst.remove();
      instRef.current = null;
    };
  }, [showFrame, showMark, showDice, embedded, buildView, handlePickup, handleMove, onReady]);

  // State sync: push the new view on every gameState/direction/interactive change.
  useEffect(() => {
    gsRef.current = gameState;
    dirRef.current = direction;
    interactiveRef.current = interactive;
    instRef.current?.update(buildView(gameState, direction, interactive));
  }, [gameState, direction, interactive, buildView]);

  return <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }} />;
}
