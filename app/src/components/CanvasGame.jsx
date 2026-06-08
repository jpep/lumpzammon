// Dev-only canvas spike host (Phase 8.3 static + Phase 8.4 live local game).
// Now a thin wrapper over the controlled <CanvasBoard>: CanvasBoard owns the p5
// mount/teardown; this component owns the dev game state.
//
//   ?canvas       -> static board + the hollow GMMN frame composite (showFrame)
//   ?canvas=board -> static bright board
//   ?canvas=live  -> a self-contained LOCAL two-player game (drag-to-move)
//   &mark         -> draw the U+F8FF NORTECHICO glyph on checkers
//
// The production game board is GameScreen's <CanvasBoard> (Phase 8.5a); this
// remains a dev sandbox gated behind import.meta.env.DEV in App.jsx.

import { useRef, useEffect, useState, useCallback } from 'react';
import CanvasBoard from './CanvasBoard';
import { newGameState, getValidMoves, checkWin, rollDice, P1, P2 } from '../game/logic';
import { applyCombinedMove } from '../game/moveResolution';

// ── Minimal LOCAL game loop for ?canvas=live (human vs human) ────────────────

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

function advance(gs) {
  const w = checkWin(gs);
  if (w) return { ...gs, winner: w, phase: 'done' };
  if (gs.moves.length > 0 && getValidMoves(gs, gs.turn).length > 0) return gs;
  return rollFor(gs, gs.turn === P1 ? P2 : P1);
}

function freshLocalGame() {
  return rollFor(newGameState(), P1);
}

export default function CanvasGame({ showFrame = true, showMark = false, live = false }) {
  const instRef = useRef(null);
  const gsRef = useRef(null);
  const [gs, setGs] = useState(() => (live ? freshLocalGame() : newGameState()));

  useEffect(() => { gsRef.current = gs; }, [gs]);

  const handleMove = useCallback(({ f, t }) => {
    if (!live) return;
    const g = gsRef.current;
    const moved = applyCombinedMove(g, g.turn, f, t);
    if (moved) setGs(advance(moved));
  }, [live]);

  const onReady = useCallback((inst) => { instRef.current = inst; }, []);

  // DEV-only hook for the Playwright verifier.
  useEffect(() => {
    if (!live || !import.meta.env.DEV) return undefined;
    window.__cg = {
      getState: () => gsRef.current,
      validMoves: () => { const g = gsRef.current; return g ? getValidMoves(g, g.turn) : []; },
      geom: () => instRef.current?.getGeom?.() || null,
    };
    return () => { window.__cg = undefined; };
  }, [live]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }}>
      <CanvasBoard
        gameState={gs}
        direction={0}
        interactive={live && gs.phase === 'move'}
        onMove={handleMove}
        onReady={onReady}
        showFrame={live ? false : showFrame}
        showMark={showMark}
        showDice
        embedded={false}
      />
    </div>
  );
}
