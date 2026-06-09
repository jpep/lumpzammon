import React, { useState, useEffect, useCallback, useRef } from 'react';
import Board from '../components/Board';
import CanvasBoard from '../components/CanvasBoard';
import StatsScreen from './StatsScreen';
import Checker from '../components/Checker';
import DiceFace from '../components/DiceFace';
import { useTheme } from '../ThemeContext';
import {
  newGameState, rollDice, rollSingleDie, resolveOpening,
  getValidMoves, applyMove, checkWin, clone, calcPipCount, P1, P2, GAME_BANK
} from '../game/logic';
import useGameTimers from '../hooks/useGameTimers';
import { applyCombinedMove } from '../game/moveResolution';
import { gameEndResult } from '../game/gameResult';
import { aiPlay, evaluate } from '../game/ai';
import {
  newCube, canDouble, promiseDouble, acceptDouble, declineDouble,
  shouldAcceptDouble, colorOf, playerOf, nextCubeValue,
} from '../game/cube';
import { appendGame } from '../storage/playerStats';
import { saveLocalGame, loadLocalGame, clearLocalGame } from '../storage/local';

// Phase 8.5a: the p5 CanvasBoard is the default game board. Append ?dom (dev) to
// fall back to the legacy DOM <Board> for A/B comparison.
const USE_CANVAS_BOARD = true;

// Pick a die to pre-select that actually has a legal move under the (rules-
// filtered) getValidMoves — prefer natural dice order. Avoids pre-selecting a
// die the mandatory-move/larger-die rule makes unplayable. Returns null if the
// player has no moves.
function firstPlayableDie(state, player) {
  const vm = getValidMoves(state, player);
  if (vm.length === 0) return null;
  for (const d of state.moves) {
    if (vm.some(m => m.d === d)) return d;
  }
  return vm[0].d;
}

function Stone({ player, size = 16 }) {
  const theme = useTheme();
  const colors = { 1: theme.checkerWhite, 2: theme.checkerBlack };
  const [fill, border] = colors[player];
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, ${fill}, ${border})`,
      border: `1.5px solid ${border}`,
      verticalAlign: 'middle',
      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
    }} />
  );
}

// The doubling cube (Phase 8.5d). A small square showing the current stake
// multiplier; glows and becomes clickable when the player on roll may double.
// Tinted on the edge by the owner's checker colour (null = centred/unowned).
function CubeControl({ value, clickable, onClick, owner }) {
  const theme = useTheme();
  const ownerEdge = owner === 'white' ? theme.checkerWhite[0]
    : owner === 'black' ? theme.checkerBlack[1] : theme.border;
  return (
    <button
      type="button"
      data-testid="cube-control"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={clickable ? 'Double the stakes' : `Stakes ×${value}`}
      style={{
        width: 46, height: 46, borderRadius: 8,
        border: `2px solid ${clickable ? theme.textHighlight : ownerEdge}`,
        background: clickable ? theme.bgPanel : 'transparent',
        color: theme.text, fontWeight: 'bold', fontSize: 18, lineHeight: 1,
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: clickable ? `0 0 12px ${theme.textHighlight}66` : 'none',
        opacity: clickable ? 1 : 0.6,
        transition: 'box-shadow 120ms, opacity 120ms',
      }}
    >
      ×{value}
    </button>
  );
}

// Format a seconds count as M:SS for the game-clock bank.
function fmtClock(secs) {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PlayerTag({ name, player, isYou, isTurn, action, winner, align, pip, onNameClick, bank, moveLeft }) {
  const theme = useTheme();
  const isRight = align === 'right';
  const actionStyle = {
    color: theme.textHighlight,
    fontSize: 12,
    fontWeight: 'bold',
    fontStyle: 'italic',
  };
  const nameStyle = {
    color: isTurn ? theme.textHighlight : theme.text,
    fontWeight: isTurn ? 'bold' : 'normal',
    fontSize: 15,
    cursor: onNameClick ? 'pointer' : 'default',
    textDecoration: onNameClick ? 'underline dotted' : 'none',
    textUnderlineOffset: 3,
  };
  const pipStyle = {
    color: theme.textSecondary,
    fontSize: 11,
  };
  const youTag = isYou && (
    <span style={{ color: theme.textYou, fontSize: 12, fontWeight: 'bold' }}>(you!)</span>
  );
  const sep = action && <span style={actionStyle}>—</span>;
  const act = action && <span style={actionStyle}>{action}</span>;
  const pipTag = pip != null && <span style={pipStyle}>pip {pip}</span>;
  // Clock: the move timer counts (15→0) on the active player; once exhausted the
  // bank (M:SS) drains and turns red. The bank reads as urgent below 30s.
  const lowBank = bank != null && bank <= 30;
  const clockTag = bank != null && (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontVariantNumeric: 'tabular-nums', fontSize: 12,
    }} data-testid={`clock-${player}`}>
      {moveLeft != null && (
        <span style={{
          color: moveLeft <= 5 ? '#e0586a' : theme.textHighlight, fontWeight: 'bold',
        }} data-testid={`move-clock-${player}`}>{moveLeft}s</span>
      )}
      <span style={{ color: lowBank ? '#e0586a' : theme.textSecondary, fontWeight: lowBank ? 'bold' : 'normal' }}>
        ⏱{fmtClock(bank)}
      </span>
    </span>
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      minWidth: 160,
      justifyContent: isRight ? 'flex-end' : 'flex-start',
    }}>
      {isRight && <>{act}{sep}</>}
      {isRight ? (
        <>
          {clockTag}
          {pipTag}
          <span style={nameStyle} onClick={onNameClick || undefined}>{name}</span>
          {youTag}
          <Stone player={player} />
        </>
      ) : (
        <>
          <Stone player={player} />
          <span style={nameStyle} onClick={onNameClick || undefined}>{name}</span>
          {youTag}
          {pipTag}
          {clockTag}
        </>
      )}
      {!isRight && <>{sep}{act}</>}
    </div>
  );
}

const ANIMATION_DURATION = 300;

export default function GameScreen({
  mode,
  nick,
  matchData,
  playerSlot,
  onUpdateMatch,
  onBack,
}) {
  const theme = useTheme();
  const isOnline = mode === 'online';
  const isAI = mode === 'ai';
  const useCanvas = USE_CANVAS_BOARD
    && !(import.meta.env.DEV && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).has('dom'));

  const [localState, setLocalState] = useState(() => {
    if (!isOnline) {
      const saved = loadLocalGame();
      if (saved && saved.mode === mode && saved.state) return saved.state;
    }
    return newGameState();
  });
  const [localDirection, setLocalDirection] = useState(() => {
    if (!isOnline) {
      const saved = loadLocalGame();
      if (saved && saved.mode === mode) return saved.direction || 0;
    }
    return 0;
  });
  const direction = isOnline ? (playerSlot === P2 ? 1 : 0) : localDirection;
  const rawGs = isOnline ? (matchData?.state || localState) : localState;
  const gs = {
    ...rawGs,
    dice: rawGs.dice || [],
    moves: rawGs.moves || [],
    bar: rawGs.bar || { 1: 0, 2: 0 },
    off: rawGs.off || { 1: 0, 2: 0 },
    openingRolls: rawGs.openingRolls || { 1: 0, 2: 0 },
    // Doubling cube (Phase 8.5d): default for pre-cube matches / reconnects.
    cube: rawGs.cube || newCube(),
    cubeModal: rawGs.cubeModal || null,
    // Chess-clock banks (Phase 8.5d-2): default for pre-clock matches / reconnects.
    clock: rawGs.clock || { game: { 1: GAME_BANK, 2: GAME_BANK } },
  };

  const [selectedFrom, setSelectedFrom] = useState(null);
  const [selectedDie, setSelectedDie] = useState(null);
  const [profileNick, setProfileNick] = useState(null);
  const [message, setMessage] = useState('');
  const [passOverlay, setPassOverlay] = useState(null);
  const BOARD_WIDTH = 620;
  const calcScale = () => {
    const vw = (window.visualViewport?.width || window.innerWidth) - 32;
    return vw < BOARD_WIDTH ? vw / BOARD_WIDTH : 1;
  };
  const [boardScale, setBoardScale] = useState(calcScale);

  // Persist local/AI game state across page reloads
  useEffect(() => {
    if (!isOnline && localState.phase !== 'pass') saveLocalGame(mode, localState, localDirection);
  }, [isOnline, mode, localState, localDirection]);

  // Animation state
  const [flyingChecker, setFlyingChecker] = useState(null);
  const [animatingFrom, setAnimatingFrom] = useState(null);
  const [animatingPlayer, setAnimatingPlayer] = useState(null);
  const isAnimatingRef = useRef(false);
  const canvasInstRef = useRef(null);
  const gsRef = useRef(gs);
  const handleCanvasReady = useCallback((inst) => { canvasInstRef.current = inst; }, []);
  // Seeded with the current winner so reconnecting to a finished game does not
  // re-record it; reset to 0 on a new game so the next win records.
  const recordedWinnerRef = useRef(gs.winner);

  useEffect(() => {
    const update = () => setBoardScale(calcScale());
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    // Recalculate after first paint in case viewport wasn't ready
    requestAnimationFrame(update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  const currentPlayer = gs.turn || P1;
  const myTurn = isOnline ? (playerSlot === currentPlayer) : true;
  const allValidMoves = gs.phase === 'move' ? getValidMoves(gs, currentPlayer) : [];
  // Filter to the selected die, but fall back to all valid moves if that die has
  // none (e.g. the mandatory larger-die rule makes a pre-selected smaller die
  // unplayable) so the board never renders as frozen.
  const selMoves = selectedDie != null
    ? allValidMoves.filter(m => m.d === selectedDie)
    : allValidMoves;
  const validMoves = selMoves.length > 0 ? selMoves : allValidMoves;
  const movableSources = new Set(validMoves.map(m => m.f));
  const pip1 = calcPipCount(gs, P1);
  const pip2 = calcPipCount(gs, P2);

  const updateState = useCallback((newState) => {
    if (isOnline) {
      onUpdateMatch(newState);
    } else {
      setLocalState(newState);
    }
  }, [isOnline, onUpdateMatch]);

  // Chess-clock timers (Phase 8.5d-2). The clock runs only in roll+move; the cube
  // handshake, animations, opening, pass and done are paused. Only the on-turn
  // device runs the live countdown / forfeit (single authoritative writer).
  const isActivePhase = gs.phase === 'roll' || gs.phase === 'move';
  const clockPaused = !!gs.cubeModal || isAnimatingRef.current || !isActivePhase;
  const timers = useGameTimers({
    bank: gs.clock?.game,
    currentPlayer,
    myTurn,
    isActivePhase,
    paused: clockPaused,
    winner: gs.winner,
  });
  const { foldClock, resetTimers } = { foldClock: timers.foldClock, resetTimers: timers.reset };

  const getElementCenter = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const animateAndExecute = useCallback((move, player, callback) => {
    // Calculate source position
    let fromPos;
    if (move.f === 'bar') {
      fromPos = getElementCenter(`[data-bar-player="${player}"]`);
    } else {
      fromPos = getElementCenter(`[data-point-id="${move.f}"]`);
    }

    // Calculate destination position
    let toPos;
    if (move.t === 'off') {
      toPos = getElementCenter(`[data-point-id="off-${player}"]`);
    } else {
      toPos = getElementCenter(`[data-point-id="${move.t}"]`);
    }

    if (!fromPos || !toPos) {
      callback();
      return;
    }

    // Hide source checker and show flying checker
    setAnimatingFrom(move.f);
    setAnimatingPlayer(player);
    setFlyingChecker({ from: fromPos, to: toPos, player, arrived: false });

    // Trigger transition in next frames
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlyingChecker(prev => prev ? { ...prev, arrived: true } : null);
      });
    });

    // After animation completes, apply state
    setTimeout(() => {
      setFlyingChecker(null);
      setAnimatingFrom(null);
      setAnimatingPlayer(null);
      callback();
    }, ANIMATION_DURATION + 50);
  }, []);

  const handleOpeningRoll = useCallback(() => {
    if (gs.phase !== 'opening') return;
    const newGs = clone(gs);

    if (isOnline) {
      // Online: each player rolls their own die
      const slot = playerSlot;
      if (gs.openingRolls[slot] > 0) return; // already rolled this round
      // If both were set (tied state), clear before rolling
      if (gs.openingRolls[P1] > 0 && gs.openingRolls[P2] > 0) {
        newGs.openingRolls = { 1: 0, 2: 0 };
      }
      newGs.openingRolls[slot] = rollSingleDie();
      updateState(newGs);
      return;
    }

    // Local and AI: roll one player at a time
    if (gs.openingRolls[P1] === 0) {
      newGs.openingRolls = { ...gs.openingRolls, [P1]: rollSingleDie() };
    } else if (gs.openingRolls[P2] === 0 && !isAI) {
      // Local mode: second click rolls P2's die
      newGs.openingRolls = { ...gs.openingRolls, [P2]: rollSingleDie() };
    }
    updateState(newGs);
  }, [gs, isOnline, isAI, playerSlot, updateState]);

  // AI opening roll: AI (P2) rolls its die after human has rolled
  useEffect(() => {
    if (!isAI || gs.phase !== 'opening' || gs.openingRolls[P1] === 0) return;
    if (gs.openingRolls[P2] > 0) return; // already rolled
    const timer = setTimeout(() => {
      const newGs = clone(gs);
      newGs.openingRolls = { ...gs.openingRolls, [P2]: rollSingleDie() };
      updateState(newGs);
    }, 800);
    return () => clearTimeout(timer);
  }, [isAI, gs, updateState]);

  // Opening resolution: both dice visible → hold briefly → resolve or handle tie
  useEffect(() => {
    if (gs.phase !== 'opening') return;
    if (gs.openingRolls[P1] === 0 || gs.openingRolls[P2] === 0) return;
    const tied = gs.openingRolls[P1] === gs.openingRolls[P2];
    const timer = setTimeout(() => {
      const newGs = clone(gs);
      if (tied) {
        // Clear both rolls so players can try again
        newGs.openingRolls = { 1: 0, 2: 0 };
      } else {
        // Resolve into move phase
        Object.assign(newGs, resolveOpening(gs.openingRolls));
        setSelectedDie(firstPlayableDie(newGs, newGs.turn));
      }
      updateState(newGs);
    }, tied ? 1500 : 1200);
    return () => clearTimeout(timer);
  }, [gs, updateState]);

  const handleRoll = useCallback(() => {
    if (gs.phase !== 'roll') return;
    if (!myTurn && isOnline) return;

    const dice = rollDice();
    const newGs = clone(gs);
    newGs.dice = dice;
    newGs.moves = [...dice];
    newGs.phase = 'move';
    newGs.turn = currentPlayer || P1;

    const vm = getValidMoves(newGs, newGs.turn);
    if (vm.length === 0) {
      // Show the dice and pass overlay before transitioning.
      // Use phase='pass' so neither AI turn nor AI auto-roll effects fire.
      newGs.phase = 'pass';
      setSelectedDie(null);
      setPassOverlay(currentPlayer);
      updateState(newGs);
      setTimeout(() => {
        const passGs = clone(newGs);
        passGs.phase = 'roll';
        passGs.turn = passGs.turn === P1 ? P2 : P1;
        passGs.dice = [];
        passGs.moves = [];
        passGs.clock = foldClock(passGs, currentPlayer); // bank the passing turn
        updateState(passGs);
      }, 1500);
      setTimeout(() => setPassOverlay(null), 2000);
    } else {
      setSelectedDie(firstPlayableDie(newGs, newGs.turn));
      updateState(newGs);
    }
  }, [gs, currentPlayer, myTurn, isOnline, updateState, foldClock]);

  // AI turn — apply one move at a time with animation
  useEffect(() => {
    if (!isAI || currentPlayer !== P2 || gs.phase !== 'move') return;
    if (isAnimatingRef.current) return;

    const timer = setTimeout(() => {
      const { seq } = aiPlay(gs, P2);
      if (seq.length === 0) {
        // Show dice for a moment before passing
        setPassOverlay(P2);
        setTimeout(() => {
          const newGs = clone(gs);
          newGs.phase = 'roll';
          newGs.turn = P1;
          newGs.dice = [];
          newGs.moves = [];
          newGs.clock = foldClock(newGs, P2);
          updateState(newGs);
        }, 1500);
        setTimeout(() => setPassOverlay(null), 2000);
        return;
      }

      isAnimatingRef.current = true;
      const commit = () => {
        const newGs = applyMove(gs, P2, seq[0]);

        const remaining = getValidMoves(newGs, P2);
        if (remaining.length === 0 || newGs.moves.length === 0) {
          const w = checkWin(newGs);
          if (w) {
            newGs.winner = w;
            newGs.phase = 'done';
          } else {
            newGs.phase = 'roll';
            newGs.turn = P1;
            newGs.dice = [];
            newGs.moves = [];
            newGs.clock = foldClock(newGs, P2); // bank the AI's turn
          }
        }

        updateState(newGs);
        isAnimatingRef.current = false;
      };
      // Canvas: slide the checker (no DOM [data-point-id] to tween). DOM board:
      // the legacy flying-checker overlay.
      const inst = canvasInstRef.current;
      if (useCanvas && inst && inst.animateMove) inst.animateMove(seq[0], false, commit);
      else animateAndExecute(seq[0], P2, commit);
    }, 750);
    return () => clearTimeout(timer);
  }, [isAI, currentPlayer, gs, updateState, animateAndExecute, foldClock, useCanvas]);

  // AI auto-roll
  useEffect(() => {
    if (!isAI || currentPlayer !== P2 || gs.phase !== 'roll' || gs.winner) return;
    const timer = setTimeout(handleRoll, 800);
    return () => clearTimeout(timer);
  }, [isAI, currentPlayer, gs.phase, gs.winner, handleRoll]);

  const handleClickChecker = (from) => {
    if (isAnimatingRef.current) return;
    if (!myTurn || gs.phase !== 'move') return;
    if (isAI && currentPlayer === P2) return;

    if (gs.bar[currentPlayer] > 0 && from !== 'bar') return;

    const movesFromHere = validMoves.filter(m => m.f === from);
    if (movesFromHere.length === 0) return;

    if (movesFromHere.length === 1) {
      executeMove(movesFromHere[0]);
    } else {
      setSelectedFrom(from);
    }
  };

  const handleClickBar = (player) => {
    if (player !== currentPlayer) return;
    handleClickChecker('bar');
  };

  const handleClickPoint = (to) => {
    if (selectedFrom === null) return;
    const move = validMoves.find(m => m.f === selectedFrom && m.t === to);
    if (move) executeMove(move);
    setSelectedFrom(null);
  };

  const handleClickOff = () => {
    if (selectedFrom === null) return;
    const move = validMoves.find(m => m.f === selectedFrom && m.t === 'off');
    if (move) executeMove(move);
    setSelectedFrom(null);
  };

  const executeMove = (move) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    animateAndExecute(move, currentPlayer, () => {
      const newGs = applyMove(gs, currentPlayer, move);
      const w = checkWin(newGs);
      if (w) {
        newGs.winner = w;
        newGs.phase = 'done';
        updateState(newGs);
        setSelectedFrom(null);
        isAnimatingRef.current = false;
        return;
      }

      const remaining = getValidMoves(newGs, currentPlayer);
      if (remaining.length === 0 || newGs.moves.length === 0) {
        newGs.phase = 'roll';
        newGs.turn = currentPlayer === P1 ? P2 : P1;
        newGs.dice = [];
        newGs.moves = [];
        newGs.clock = foldClock(newGs, currentPlayer); // bank the finished turn
        setSelectedDie(null);
      } else {
        setSelectedDie(firstPlayableDie(newGs, currentPlayer));
      }

      updateState(newGs);
      setSelectedFrom(null);
      isAnimatingRef.current = false;
    });
  };

  // Post-move recipe shared by the canvas drag path (snap — no DOM tween).
  // Mutates newGs (phase/turn/dice/moves/winner), updates selection, returns it.
  const finishMove = (newGs, player) => {
    const w = checkWin(newGs);
    if (w) {
      newGs.winner = w;
      newGs.phase = 'done';
      setSelectedDie(null);
      setSelectedFrom(null);
      return newGs;
    }
    const remaining = getValidMoves(newGs, player);
    if (remaining.length === 0 || newGs.moves.length === 0) {
      newGs.phase = 'roll';
      newGs.turn = player === P1 ? P2 : P1;
      newGs.dice = [];
      newGs.moves = [];
      newGs.clock = foldClock(newGs, player); // bank the finished turn
      setSelectedDie(null);
    } else {
      setSelectedDie(firstPlayableDie(newGs, player));
    }
    setSelectedFrom(null);
    return newGs;
  };

  // Canvas drag commit: resolve a from->to (possibly combined, consuming 1..N
  // dice in one gesture) and run the SAME end-turn/AI/online flow as a click
  // move. Snap (no animation); guarded against the AI tween double-committing.
  const handleCanvasMove = useCallback(({ f, t }) => {
    if (isAnimatingRef.current) return;
    if (!myTurn || gs.phase !== 'move') return;
    if (isAI && currentPlayer === P2) return;
    const moved = applyCombinedMove(gs, currentPlayer, f, t);
    if (!moved) return; // illegal drop — ghost already snapped back, no commit
    updateState(finishMove(moved, currentPlayer));
  }, [gs, currentPlayer, myTurn, isAI, updateState]);

  // ── Doubling cube (Phase 8.5d) ────────────────────────────────────────────
  // Faithful to devanture's R7 variant (1->2->4, each side doubles once), but
  // restricted to the doubler's own roll phase so online never writes the shared
  // state during the opponent's turn (avoids the racy whole-object Firebase
  // write). Flow: click cube -> offer modal (self-confirm) -> accept modal
  // (opponent) -> accept doubles+transfers the cube / decline ends the game at
  // the pre-double value. All cube state lives in `gs` so it syncs for free.

  // Does THIS client decide for `color`? Online: only that slot. vs-AI: the
  // human owns white (black is auto-decided, no modal). Local hot-seat: both.
  const iControl = useCallback((color) => {
    if (isOnline) return playerSlot === playerOf(color);
    if (isAI) return color === 'white';
    return true;
  }, [isOnline, isAI, playerSlot]);

  // Click the cube to double: promise + raise the self-confirm offer modal in a
  // single write. Allowed only before rolling, on your own turn, when the rules
  // (canDouble) permit and nothing else is in flight.
  const onCubeClick = useCallback(() => {
    if (gs.winner || gs.cubeModal || isAnimatingRef.current) return;
    if (gs.phase !== 'roll' || !myTurn) return;
    if (isAI && currentPlayer === P2) return;
    const c = colorOf(currentPlayer);
    if (!canDouble(gs.cube, c)) return;
    updateState({ ...gs, cube: promiseDouble(gs.cube, c), cubeModal: { type: 'offer', player: c } });
  }, [gs, myTurn, isAI, currentPlayer, updateState]);

  const respondOffer = useCallback((yes) => {
    if (gs.cubeModal?.type !== 'offer') return;
    const offerer = gs.cubeModal.player;
    if (yes) {
      const opponent = offerer === 'white' ? 'black' : 'white';
      updateState({ ...gs, cubeModal: { type: 'accept', player: opponent, offerer } });
    } else {
      // Backed out — drop the promise and return to the roll button.
      updateState({ ...gs, cube: { ...gs.cube, promised: null }, cubeModal: null });
    }
  }, [gs, updateState]);

  const respondAccept = useCallback((yes) => {
    if (gs.cubeModal?.type !== 'accept') return;
    const { offerer } = gs.cubeModal;
    if (yes) {
      updateState({ ...gs, cube: acceptDouble(gs.cube, offerer), cubeModal: null });
    } else {
      const { cube, outcome } = declineDouble(gs.cube, offerer);
      updateState({
        ...gs, cube, cubeModal: null,
        winner: playerOf(outcome.winner), phase: 'done', endReason: 'decline',
      });
    }
  }, [gs, updateState]);

  // AI auto-decision on an offered double (vs-AI only; AI is always black). Reads
  // the live state via gsRef so the deps stay primitive and the timer is stable.
  useEffect(() => {
    if (!isAI) return undefined;
    if (gs.cubeModal?.type !== 'accept' || gs.cubeModal.player !== 'black' || gs.winner) return undefined;
    const t = setTimeout(() => {
      const cur = gsRef.current;
      if (cur.cubeModal?.type !== 'accept' || cur.cubeModal.player !== 'black') return;
      const advantage = evaluate(cur, P2) - evaluate(cur, P1);
      const { offerer } = cur.cubeModal;
      if (shouldAcceptDouble(advantage)) {
        updateState({ ...cur, cube: acceptDouble(cur.cube, offerer), cubeModal: null });
      } else {
        const { cube, outcome } = declineDouble(cur.cube, offerer);
        updateState({
          ...cur, cube, cubeModal: null,
          winner: playerOf(outcome.winner), phase: 'done', endReason: 'decline',
        });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [isAI, gs.cubeModal?.type, gs.cubeModal?.player, gs.winner, updateState]);

  // Clock forfeit (Phase 8.5d-2). Only the on-turn device commits it (single
  // authoritative writer); guarded so it never races a just-committed win/decline
  // and never fires outside an active phase. Opponent wins simple x cube value.
  useEffect(() => {
    if (!timers.expired) return;
    if (gs.winner || gs.endReason) return;
    if (!(gs.phase === 'roll' || gs.phase === 'move')) return;
    const opp = currentPlayer === P1 ? P2 : P1;
    updateState({
      ...gs, clock: foldClock(gs, currentPlayer),
      winner: opp, phase: 'done', endReason: 'forfeit',
    });
  }, [timers.expired]); // eslint-disable-line react-hooks/exhaustive-deps

  // Record the finished game to the player's Firebase stats profile, once per
  // game end. Skips local 2P (ambiguous identity) and missing nick. Online: both
  // clients fire, each recording for its own nick (no per-nick double-record).
  useEffect(() => {
    const w = gs.winner;
    if (!w) { recordedWinnerRef.current = 0; return; }
    if (recordedWinnerRef.current === w) return; // already recorded (or reconnect)
    recordedWinnerRef.current = w;
    if (!nick) return;
    const oppName = isOnline
      ? ((matchData?.players && matchData.players[playerSlot === P1 ? P2 : P1]) || 'Opponent')
      : 'AI';
    const result = gameEndResult({ gs, winner: w, isOnline, isAI, playerSlot, opponentName: oppName });
    if (result) appendGame(nick, result);
  }, [gs.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  // DEV-only hook for the Playwright verifier (read engine state + canvas geom).
  useEffect(() => { gsRef.current = gs; });
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__gs = {
      getState: () => gsRef.current,
      geom: () => canvasInstRef.current?.getGeom?.() || null,
      direction: () => direction,
      validMoves: () => getValidMoves(gsRef.current, gsRef.current.turn || P1),
      // Force a simple win (for the stats integration test). loser keeps off>0.
      forceWin: (player) => {
        const loser = player === P1 ? P2 : P1;
        updateState({ ...gsRef.current, off: { [player]: 15, [loser]: 3 }, winner: player, phase: 'done' });
      },
      // Put a player on roll (start of turn, pre-dice) so the cube becomes
      // doublable — lets the cube verifier reach the handshake deterministically.
      rollPhase: (player) => {
        updateState({ ...gsRef.current, turn: player, phase: 'roll', dice: [], moves: [] });
      },
      // Clock hooks for the timer verifier: read banks + backdate the turn so the
      // bank drains to a forfeit on the next tick (no waiting real seconds).
      clock: () => gsRef.current.clock,
      ageClock: (secs) => timers.debugAge(secs),
      // Merge an arbitrary partial into the state (verifier board setup, e.g. a
      // hit scenario for the flying-checker test).
      poke: (partial) => updateState({ ...gsRef.current, ...partial }),
      // Cube hooks for the doubling-cube verifier (read state + drive handshake
      // programmatically so a test doesn't depend on canvas/DOM hit-testing).
      cube: () => gsRef.current.cube,
      cubeModal: () => gsRef.current.cubeModal,
      offerDouble: () => {
        const cur = gsRef.current;
        const c = colorOf(cur.turn || P1);
        if (cur.winner || cur.cubeModal || cur.phase !== 'roll' || !canDouble(cur.cube, c)) return false;
        updateState({ ...cur, cube: promiseDouble(cur.cube, c), cubeModal: { type: 'offer', player: c } });
        return true;
      },
      respondOffer: (yes) => {
        const cur = gsRef.current;
        if (cur.cubeModal?.type !== 'offer') return false;
        const offerer = cur.cubeModal.player;
        if (yes) {
          const opp = offerer === 'white' ? 'black' : 'white';
          updateState({ ...cur, cubeModal: { type: 'accept', player: opp, offerer } });
        } else {
          updateState({ ...cur, cube: { ...cur.cube, promised: null }, cubeModal: null });
        }
        return true;
      },
      respondAccept: (yes) => {
        const cur = gsRef.current;
        if (cur.cubeModal?.type !== 'accept') return false;
        const { offerer } = cur.cubeModal;
        if (yes) {
          updateState({ ...cur, cube: acceptDouble(cur.cube, offerer), cubeModal: null });
        } else {
          const { cube, outcome } = declineDouble(cur.cube, offerer);
          updateState({ ...cur, cube, cubeModal: null, winner: playerOf(outcome.winner), phase: 'done', endReason: 'decline' });
        }
        return true;
      },
    };
    return () => { window.__gs = undefined; };
  }, [direction, updateState]);

  const handleNewGame = () => {
    const fresh = newGameState();
    recordedWinnerRef.current = 0; // arm stats recording for the next game's win
    updateState(fresh);
    setSelectedFrom(null);
    setSelectedDie(null);
    setMessage('');
    setPassOverlay(null);
    setFlyingChecker(null);
    setAnimatingFrom(null);
    setAnimatingPlayer(null);
    isAnimatingRef.current = false;
    resetTimers(); // clear the clock baseline so game 2's first turn starts fresh
    if (!isAI) setLocalDirection(d => d === 0 ? 1 : 0);
  };

  const playerName = (p) => {
    if (isOnline && matchData?.players) return matchData.players[p] || `Player ${p}`;
    if (isAI && p === P2) return 'Computer';
    return p === P1 ? (nick || 'White') : 'Black';
  };

  // The Firebase-profile nick for a player slot (null when there's none to show:
  // the AI, or local 2P's second seat). Clicking such a name opens StatsScreen.
  const profileNickFor = (p) => {
    if (isOnline) return matchData?.players?.[p] || null;
    if (p === P1) return nick || null; // local/AI: the human is P1
    return null;
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: theme.bg,
    padding: 16,
  };

  const statusStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 620,
    color: theme.text,
    marginBottom: 12,
    fontSize: 14,
  };

  const btnStyle = {
    background: theme.btnBg,
    color: theme.btnText,
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 16,
    cursor: 'pointer',
    fontWeight: 'bold',
  };

  const btnSmall = {
    background: 'transparent',
    color: theme.btnOutlineText,
    border: `1px solid ${theme.btnOutlineBorder}`,
    borderRadius: 8,
    padding: '8px 24px',
    fontSize: 14,
    cursor: 'pointer',
  };

  // ── Cube render state ──────────────────────────────────────────────────────
  const showCube = gs.phase !== 'opening';
  const cubeClickable = !gs.winner && !gs.cubeModal && !isAnimatingRef.current
    && gs.phase === 'roll' && myTurn && !(isAI && currentPlayer === P2)
    && canDouble(gs.cube, colorOf(currentPlayer));
  const cubeModal = gs.cubeModal;
  const showOffer = cubeModal?.type === 'offer' && iControl(cubeModal.player) && !gs.winner;
  const showAccept = cubeModal?.type === 'accept' && iControl(cubeModal.player) && !gs.winner;
  // Online: a handshake is in flight but it's the opponent's decision.
  const cubeWaiting = isOnline && cubeModal && !showOffer && !showAccept && !gs.winner;
  const offererName = cubeModal?.offerer ? playerName(playerOf(cubeModal.offerer)) : '';

  const cubeVeil = {
    position: 'fixed', inset: 0, zIndex: 90,
    background: 'rgba(0,0,0,0.78)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  };
  const cubeCard = {
    width: '100%', maxWidth: 380,
    background: theme.bgPanel, border: `1.5px solid ${theme.text}`, borderRadius: 12,
    padding: '24px 22px', color: theme.text, textAlign: 'center',
    boxShadow: '0 0 30px rgba(0,0,0,0.7)',
  };
  const cubeTitle = { fontSize: 20, fontWeight: 'bold', color: theme.textHighlight };
  const cubeSub = { fontSize: 14, color: theme.textSecondary, marginTop: 10, lineHeight: 1.4 };
  const cubeBtnRow = { display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 };

  // ── Clock render state ─────────────────────────────────────────────────────
  // Only THIS device's on-turn player gets the live countdown; everyone else
  // (and every off-turn player) shows the static synced bank. Hidden in opening.
  const showClock = gs.phase !== 'opening';
  const liveFor = (p) => p === currentPlayer && myTurn && isActivePhase && !gs.winner;
  const bankFor = (p) => (liveFor(p)
    ? Math.max(0, Math.ceil(timers.gameRemaining))
    : (gs.clock?.game?.[p] ?? GAME_BANK));
  const moveLeftFor = (p) => (liveFor(p) ? Math.ceil(timers.moveRemaining) : null);

  // ── Tap-to-roll (8.5e-3) ───────────────────────────────────────────────────
  // A tap on the canvas board rolls when a Roll button would be active for me —
  // the regular roll phase or my pending opening roll. The handlers no-op if the
  // tap is ill-timed, so the gate just mirrors the button visibility.
  const bothOpeningRolled = gs.openingRolls[P1] > 0 && gs.openingRolls[P2] > 0;
  const openingRollPending = gs.phase === 'opening' && !bothOpeningRolled && (
    isOnline ? gs.openingRolls[playerSlot] === 0
      : isAI ? gs.openingRolls[P1] === 0
        : (gs.openingRolls[P1] === 0 || gs.openingRolls[P2] === 0)
  );
  const canRollTap = !gs.winner && (
    (gs.phase === 'roll' && myTurn && !gs.cubeModal && !(isAI && currentPlayer === P2))
    || openingRollPending
  );
  const onRollTap = () => {
    if (gs.phase === 'opening') handleOpeningRoll();
    else if (gs.phase === 'roll') handleRoll();
  };

  return (
    <div style={containerStyle}>
      {/* Status bar */}
      <div style={statusStyle}>
        <PlayerTag
          name={playerName(P2)}
          player={P2}
          isYou={isOnline ? playerSlot === P2 : isAI ? false : false}
          isTurn={gs.phase === 'opening' ? false : currentPlayer === P2}
          action={
            gs.phase === 'opening'
              ? (gs.openingRolls[P2] > 0 ? `rolled ${gs.openingRolls[P2]}` : null)
              : (currentPlayer === P2 && !gs.winner ? (gs.phase === 'roll' ? 'Roll dice' : 'Move') : null)
          }
          winner={gs.winner === P2}
          pip={pip2}
          bank={showClock ? bankFor(P2) : null}
          moveLeft={showClock ? moveLeftFor(P2) : null}
          onNameClick={profileNickFor(P2) ? () => setProfileNick(profileNickFor(P2)) : undefined}
        />
        {gs.winner && (
          <span style={{ color: theme.textHighlight, fontWeight: 'bold', fontSize: 16 }}>
            {playerName(gs.winner)} wins!
          </span>
        )}
        <PlayerTag
          name={playerName(P1)}
          player={P1}
          isYou={isOnline ? playerSlot === P1 : isAI ? true : false}
          isTurn={gs.phase === 'opening' ? false : currentPlayer === P1}
          action={
            gs.phase === 'opening'
              ? (gs.openingRolls[P1] > 0 ? `rolled ${gs.openingRolls[P1]}` : null)
              : (currentPlayer === P1 && !gs.winner ? (gs.phase === 'roll' ? 'Roll dice' : 'Move') : null)
          }
          winner={gs.winner === P1}
          align="right"
          pip={pip1}
          bank={showClock ? bankFor(P1) : null}
          moveLeft={showClock ? moveLeftFor(P1) : null}
          onNameClick={profileNickFor(P1) ? () => setProfileNick(profileNickFor(P1)) : undefined}
        />
      </div>

      <div style={{ color: theme.textHighlight, fontSize: 14, marginBottom: 8, minHeight: 20, visibility: message ? 'visible' : 'hidden' }}>
        {message || '\u00A0'}
      </div>

      {/* Board — scales to fit viewport */}
      <div style={{
        width: '100%',
        maxWidth: BOARD_WIDTH,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          transform: `scale(${boardScale})`,
          transformOrigin: 'top center',
          marginBottom: boardScale < 1 ? -(1 - boardScale) * (useCanvas ? BOARD_WIDTH : 420) : 0,
          position: 'relative',
        }}>
          {useCanvas ? (
            <div style={{ width: BOARD_WIDTH, height: BOARD_WIDTH }}>
              <CanvasBoard
                gameState={gs}
                direction={direction}
                interactive={myTurn && gs.phase === 'move' && !(isAI && currentPlayer === P2)}
                onMove={handleCanvasMove}
                onReady={handleCanvasReady}
                onRoll={onRollTap}
                canRoll={canRollTap}
                showDice
              />
            </div>
          ) : (
            <Board
              gameState={gs}
              validMoves={validMoves}
              movableSources={movableSources}
              selectedFrom={selectedFrom}
              onClickChecker={handleClickChecker}
              onClickPoint={handleClickPoint}
              onClickBar={handleClickBar}
              onClickOff={handleClickOff}
              currentPlayer={currentPlayer}
              animatingFrom={animatingFrom}
              animatingPlayer={animatingPlayer}
              direction={direction}
            />
          )}
          {passOverlay && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 12,
              pointerEvents: 'none',
              zIndex: 10,
            }}>
              <Stone player={passOverlay} size={32} />
              <div style={{
                color: theme.textHighlight,
                fontSize: 28,
                fontWeight: 'bold',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}>
                No valid moves — Pass!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flying checker animation overlay */}
      {flyingChecker && (
        <div
          style={{
            position: 'fixed',
            left: flyingChecker.arrived ? flyingChecker.to.x - 18 : flyingChecker.from.x - 18,
            top: flyingChecker.arrived ? flyingChecker.to.y - 18 : flyingChecker.from.y - 18,
            zIndex: 9999,
            transition: `left ${ANIMATION_DURATION}ms ease-in-out, top ${ANIMATION_DURATION}ms ease-in-out`,
            pointerEvents: 'none',
          }}
        >
          <Checker player={flyingChecker.player} />
        </div>
      )}

      {/* Dice + controls — fixed height to prevent board from shifting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center', minHeight: 52 }}>
        {showCube && (
          <CubeControl
            value={gs.cube.value}
            clickable={cubeClickable}
            onClick={onCubeClick}
            owner={gs.cube.owner}
          />
        )}
        {gs.phase === 'opening' && (
          <>
            {gs.openingRolls[P1] > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Stone player={P1} size={14} />
                <DiceFace value={gs.openingRolls[P1]} />
              </div>
            )}
            {gs.openingRolls[P2] > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Stone player={P2} size={14} />
                <DiceFace value={gs.openingRolls[P2]} />
              </div>
            )}
            {gs.openingRolls[P1] > 0 && gs.openingRolls[P2] > 0 &&
              gs.openingRolls[P1] === gs.openingRolls[P2] && (
              <span style={{ color: theme.textHighlight, fontWeight: 'bold', fontSize: 14 }}>
                Tied! Rolling again...
              </span>
            )}
          </>
        )}

        {/* Turn dice: on the canvas board these animate on-board (see diceAnim);
            the DOM faces are only the legacy ?dom fallback + click-to-select. */}
        {!useCanvas && gs.phase !== 'opening' && gs.dice.length > 0 && gs.dice.map((d, i) => {
          // Count how many of this die value have been used
          const totalOfValue = gs.dice.filter(v => v === d).length;
          const remainingOfValue = gs.moves.filter(v => v === d).length;
          const usedOfValue = totalOfValue - remainingOfValue;
          // This specific die index is used if enough of its value are consumed
          const sameValueBefore = gs.dice.slice(0, i).filter(v => v === d).length;
          const used = sameValueBefore < usedOfValue;
          const canClick = !used && myTurn && gs.phase === 'move' && !(isAI && currentPlayer === P2);
          return (
            <DiceFace
              key={i}
              value={d}
              used={used}
              selected={!used && selectedDie === d}
              onClick={canClick ? () => { setSelectedDie(d); setSelectedFrom(null); } : undefined}
            />
          );
        })}

        {gs.phase === 'opening' && (() => {
          const bothRolled = gs.openingRolls[P1] > 0 && gs.openingRolls[P2] > 0;
          if (bothRolled) return null; // resolving or showing tie, no button

          if (isOnline) {
            if (gs.openingRolls[playerSlot] === 0) {
              return (
                <button onClick={handleOpeningRoll} style={btnStyle}>
                  Roll for first move
                </button>
              );
            }
            return (
              <span style={{ color: theme.textSecondary, fontSize: 14 }}>
                Waiting for opponent...
              </span>
            );
          }

          // Local: P1 rolls first, then P2
          if (gs.openingRolls[P1] === 0) {
            return (
              <button onClick={handleOpeningRoll} style={btnStyle}>
                {playerName(P1)} — Roll
              </button>
            );
          }
          // AI mode: P1 rolled, AI will auto-roll
          if (isAI) return null;
          // Local mode: P2's turn to roll
          return (
            <button onClick={handleOpeningRoll} style={btnStyle}>
              {playerName(P2)} — Roll
            </button>
          );
        })()}

        {gs.phase === 'roll' && !gs.winner && myTurn && !gs.cubeModal && !(isAI && currentPlayer === P2) && (
          <button onClick={handleRoll} style={btnStyle}>
            Roll Dice
          </button>
        )}

        {gs.winner && (
          <button onClick={handleNewGame} style={btnStyle}>
            New Game
          </button>
        )}
      </div>

      <button onClick={() => { if (!isOnline) clearLocalGame(); onBack(); }} style={{ ...btnSmall, marginTop: 24 }}>
        Leave Game
      </button>

      {profileNick && <StatsScreen nick={profileNick} onClose={() => setProfileNick(null)} />}

      {/* Doubling-cube handshake modal (Phase 8.5d) */}
      {showOffer && (
        <div style={cubeVeil} data-testid="cube-offer">
          <div style={cubeCard}>
            <div style={cubeTitle}>Double the stakes?</div>
            <div style={cubeSub}>
              Offer a double to <strong>×{nextCubeValue(gs.cube)}</strong>. Your opponent may accept,
              or decline and concede <strong>{gs.cube.value}</strong> point{gs.cube.value > 1 ? 's' : ''}.
            </div>
            <div style={cubeBtnRow}>
              <button onClick={() => respondOffer(true)} style={btnStyle} data-testid="cube-offer-yes">Offer</button>
              <button onClick={() => respondOffer(false)} style={btnSmall} data-testid="cube-offer-no">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAccept && (
        <div style={cubeVeil} data-testid="cube-accept">
          <div style={cubeCard}>
            <div style={cubeTitle}>{offererName} offers a double</div>
            <div style={cubeSub}>
              Accept to play on for <strong>×{nextCubeValue(gs.cube)}</strong> — or decline and lose{' '}
              <strong>{gs.cube.value}</strong> point{gs.cube.value > 1 ? 's' : ''}.
            </div>
            <div style={cubeBtnRow}>
              <button onClick={() => respondAccept(true)} style={btnStyle} data-testid="cube-accept-yes">Accept</button>
              <button onClick={() => respondAccept(false)} style={btnSmall} data-testid="cube-accept-no">Decline</button>
            </div>
          </div>
        </div>
      )}

      {cubeWaiting && (
        <div style={cubeVeil} data-testid="cube-waiting">
          <div style={cubeCard}>
            <div style={cubeSub}>Waiting for opponent…</div>
          </div>
        </div>
      )}
    </div>
  );
}
