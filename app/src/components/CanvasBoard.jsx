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
import { diffMove } from '../canvas/flyAnim';
import nort100Url from '../assets/nortechico-100.otf?url';
import { getValidMoves } from '../game/logic';
import { collectTargets } from '../game/moveResolution';

export default function CanvasBoard({
  gameState,
  direction = 0,
  interactive = false,
  onMove,
  onReady,
  onRoll,
  canRoll = false,
  animateRemoteMoves = false,
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
  const canRollRef = useRef(canRoll);
  const onMoveRef = useRef(onMove);
  const onRollRef = useRef(onRoll);

  // Keep the callback refs fresh without changing the stable handlers' identity
  // (which would otherwise re-run the mount effect and recreate the p5 instance).
  useEffect(() => { onMoveRef.current = onMove; });
  useEffect(() => { onRollRef.current = onRoll; });

  const buildView = useCallback((gs, dir, inter, roll) => ({
    snapshot: toSnapshot(gs, dir),
    gs,
    direction: dir,
    canRoll: roll,
    sources: inter
      ? [...new Set(getValidMoves(gs, gs.turn).map((m) => engineToRenderPt(m.f, dir)))]
      : [],
    targets: [],
  }), []);

  const handleRoll = useCallback(() => { if (onRollRef.current) onRollRef.current(); }, []);

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
        onRoll: handleRoll,
      }), el);
      instRef.current = inst;

      ro = new ResizeObserver((entries) => {
        if (cancelled || !inst || !inst.resize) return;
        const { width, height } = entries[0].contentRect;
        inst.resize(Math.round(width), Math.round(height));
      });
      ro.observe(el);

      inst.update(buildView(gsRef.current, dirRef.current, interactiveRef.current, canRollRef.current));
      if (onReady) onReady(inst);
    })();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (inst) inst.remove();
      instRef.current = null;
    };
  }, [showFrame, showMark, showDice, embedded, buildView, handlePickup, handleMove, handleRoll, onReady]);

  // State sync: push the new view on every gameState/direction/interactive/canRoll
  // change. Online: if the change is the OPPONENT's single move (mover wasn't me),
  // slide it instead of teleporting (the new state is held back until it lands).
  useEffect(() => {
    const prevGs = gsRef.current;
    gsRef.current = gameState;
    dirRef.current = direction;
    interactiveRef.current = interactive;
    canRollRef.current = canRoll;
    const inst = instRef.current;
    if (!inst) return;
    const newView = buildView(gameState, direction, interactive, canRoll);
    if (animateRemoteMoves && prevGs && !inst.isFlying?.()) {
      const me = direction === 1 ? 2 : 1; // online: P2 sees direction 1
      const mv = diffMove(prevGs, gameState);
      if (mv && mv.mover !== me) {
        inst.animateRemoteMove({ f: mv.f, t: mv.t }, mv.mover === 1, newView);
        return;
      }
    }
    if (inst.isFlying?.()) inst.cancelFly?.(); // a newer state superseded a fly
    inst.update(newView);
  }, [gameState, direction, interactive, canRoll, buildView, animateRemoteMoves]);

  return <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }} />;
}
