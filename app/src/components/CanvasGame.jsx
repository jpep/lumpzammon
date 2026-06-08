// Canvas board host (Phase 8.3 static spike + Phase 8.4 live local game).
//
// Static mode (?canvas / ?canvas=board): renders a fixed snapshot once (8.3).
// Live mode (?canvas=live): a self-contained LOCAL two-player game — React owns
// the GameState, the p5 canvas is a pure renderer + input surface that emits
// onPickup/onMove intents. React resolves moves via the engine + moveResolution
// and pushes new state into the canvas with inst.update() (NOT by recreating
// the instance). Online perspective, AI, animations, opening-roll, cube/timers
// are deferred to Phase 8.5.

import { useRef, useEffect, useState, useCallback } from 'react';
import p5 from 'p5';
import { makeSketch } from '../canvas/sketch';
import { STATIC_SNAPSHOT, STACK_TEST_SNAPSHOT } from '../canvas/snapshot';
import { toSnapshot, renderToEngineFrom, renderToEngineTo, engineToRenderPt } from '../canvas/adapter';
import nort100Url from '../assets/nortechico-100.otf?url';
import { newGameState, getValidMoves, checkWin, rollDice, P1, P2 } from '../game/logic';
import { applyCombinedMove, collectTargets } from '../game/moveResolution';

// ── Minimal LOCAL game loop (human vs human, single orientation) ─────────────

// Roll for `player`; if they have no legal move, pass to the other player with a
// fresh roll (single-level auto-pass — the both-stuck edge is left as-is).
function rollFor(gs, player) {
  let dice = rollDice();
  let next = { ...gs, turn: player, dice, moves: [...dice], phase: 'move' };
  if (getValidMoves(next, player).length === 0) {
    const other = player === P1 ? P2 : P1;
    dice = rollDice();
    next = { ...gs, turn: other, dice, moves: [...dice], phase: 'move' };
  }
  return next;
}

// After a committed move: win, continue the same turn, or end turn + auto-roll.
function advance(gs) {
  const w = checkWin(gs);
  if (w) return { ...gs, winner: w, phase: 'done' };
  if (gs.moves.length > 0 && getValidMoves(gs, gs.turn).length > 0) return gs;
  return rollFor(gs, gs.turn === P1 ? P2 : P1);
}

function freshLocalGame() {
  return rollFor(newGameState(), P1); // start P1, skip the opening-roll UI (deferred)
}

export default function CanvasGame({ showFrame = true, showMark = false, snap = 'initial', live = false }) {
  const ref = useRef(null);
  const instRef = useRef(null);
  const gsRef = useRef(null);
  const [gs, setGs] = useState(() => (live ? freshLocalGame() : null));
  const snapshot = snap === 'stack' ? STACK_TEST_SNAPSHOT : STATIC_SNAPSHOT;

  // Build the canvas view (render snapshot + movable-source halos) from a state.
  const buildView = useCallback((state) => {
    const vm = state.phase === 'move' ? getValidMoves(state, state.turn) : [];
    const sources = [...new Set(vm.map((m) => engineToRenderPt(m.f)))];
    return { snapshot: toSnapshot(state), gs: state, sources, targets: [] };
  }, []);

  // Canvas grabbed a checker → push that checker's legal targets back down.
  const handlePickup = useCallback((fromPt) => {
    const state = gsRef.current;
    if (!state || state.phase !== 'move') return;
    const fromIdx = renderToEngineFrom(fromPt);
    const targets = collectTargets(state, state.turn, fromIdx, state.moves.length).map(engineToRenderPt);
    instRef.current?.update({ targets });
  }, []);

  // Canvas dropped on a legal target → commit via the engine, then advance.
  const handleMove = useCallback((fromPt, toPt) => {
    const state = gsRef.current;
    if (!state || state.phase !== 'move') return;
    const fromIdx = renderToEngineFrom(fromPt);
    const toIdx = renderToEngineTo(toPt);
    const moved = applyCombinedMove(state, state.turn, fromIdx, toIdx);
    if (!moved) return; // illegal — the ghost already snapped back
    setGs(advance(moved));
  }, []);

  // Mount the p5 instance once (stable per showFrame/showMark/snap/live). gs is
  // intentionally NOT a dep — state flows in via instRef.update(), never by
  // recreating the instance.
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
        showFrame: live ? false : showFrame, // live = bright interactive board, no veil
        showMark,
        snapshot,
        live,
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

      if (live && gsRef.current) inst.update(buildView(gsRef.current)); // initial push
    })();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (inst) inst.remove();
      instRef.current = null;
    };
  }, [showFrame, showMark, snap, live, buildView, handlePickup, handleMove]);

  // Keep the ref current and push the live view on every state change.
  useEffect(() => {
    gsRef.current = gs;
    if (live && gs && instRef.current) instRef.current.update(buildView(gs));
  }, [gs, live, buildView]);

  // DEV-only hook for the Playwright verifier (read state + geometry + moves).
  useEffect(() => {
    if (!live || !import.meta.env.DEV) return undefined;
    window.__cg = {
      getState: () => gsRef.current,
      validMoves: () => { const g = gsRef.current; return g ? getValidMoves(g, g.turn) : []; },
      geom: () => instRef.current?.getGeom?.() || null,
    };
    return () => { window.__cg = undefined; };
  }, [live]);

  return <div ref={ref} style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }} />;
}
