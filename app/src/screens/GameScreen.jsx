import React, { useState, useEffect, useCallback, useRef } from 'react';
import Board from '../components/Board';
import Checker from '../components/Checker';
import DiceFace from '../components/DiceFace';
import { useTheme } from '../ThemeContext';
import {
  newGameState, rollDice, getValidMoves, applyMove, checkWin, clone, P1, P2
} from '../game/logic';
import { aiPlay } from '../game/ai';

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

function PlayerTag({ name, player, isYou, isTurn, action, winner, align }) {
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
  };
  const youTag = isYou && (
    <span style={{ color: theme.textYou, fontSize: 12, fontWeight: 'bold' }}>(you!)</span>
  );
  const sep = action && <span style={actionStyle}>—</span>;
  const act = action && <span style={actionStyle}>{action}</span>;

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
          <span style={nameStyle}>{name}</span>
          {youTag}
          <Stone player={player} />
        </>
      ) : (
        <>
          <Stone player={player} />
          <span style={nameStyle}>{name}</span>
          {youTag}
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

  const [localState, setLocalState] = useState(() => newGameState());
  const rawGs = isOnline ? (matchData?.state || localState) : localState;
  const gs = {
    ...rawGs,
    dice: rawGs.dice || [],
    moves: rawGs.moves || [],
    bar: rawGs.bar || { 1: 0, 2: 0 },
    off: rawGs.off || { 1: 0, 2: 0 },
  };

  const [selectedFrom, setSelectedFrom] = useState(null);
  const [selectedDie, setSelectedDie] = useState(null);
  const [message, setMessage] = useState('');
  const [passOverlay, setPassOverlay] = useState(null);
  const BOARD_WIDTH = 620;
  const calcScale = () => {
    const vw = (window.visualViewport?.width || window.innerWidth) - 32;
    return vw < BOARD_WIDTH ? vw / BOARD_WIDTH : 1;
  };
  const [boardScale, setBoardScale] = useState(calcScale);

  // Animation state
  const [flyingChecker, setFlyingChecker] = useState(null);
  const [animatingFrom, setAnimatingFrom] = useState(null);
  const [animatingPlayer, setAnimatingPlayer] = useState(null);
  const isAnimatingRef = useRef(false);

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
  const validMoves = selectedDie != null
    ? allValidMoves.filter(m => m.d === selectedDie)
    : allValidMoves;
  const movableSources = new Set(validMoves.map(m => m.f));

  const updateState = useCallback((newState) => {
    if (isOnline) {
      onUpdateMatch(newState);
    } else {
      setLocalState(newState);
    }
  }, [isOnline, onUpdateMatch]);

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
      newGs.phase = 'roll';
      newGs.turn = newGs.turn === P1 ? P2 : P1;
      newGs.dice = [];
      newGs.moves = [];
      setSelectedDie(null);
      setPassOverlay(currentPlayer);
      setTimeout(() => setPassOverlay(null), 2000);
    } else {
      setSelectedDie(dice[0]);
    }

    updateState(newGs);
  }, [gs, currentPlayer, myTurn, isOnline, updateState]);

  // AI turn — apply one move at a time with animation
  useEffect(() => {
    if (!isAI || currentPlayer !== P2 || gs.phase !== 'move') return;
    if (isAnimatingRef.current) return;

    const timer = setTimeout(() => {
      const { seq } = aiPlay(gs, P2);
      if (seq.length === 0) {
        const newGs = clone(gs);
        newGs.phase = 'roll';
        newGs.turn = P1;
        newGs.dice = [];
        newGs.moves = [];
        setPassOverlay(P2);
        setTimeout(() => setPassOverlay(null), 2000);
        updateState(newGs);
        return;
      }

      isAnimatingRef.current = true;
      animateAndExecute(seq[0], P2, () => {
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
          }
        }

        updateState(newGs);
        isAnimatingRef.current = false;
      });
    }, 750);
    return () => clearTimeout(timer);
  }, [isAI, currentPlayer, gs, updateState, animateAndExecute]);

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
        setSelectedDie(null);
      } else {
        setSelectedDie(newGs.moves[0]);
      }

      updateState(newGs);
      setSelectedFrom(null);
      isAnimatingRef.current = false;
    });
  };

  const handleNewGame = () => {
    const fresh = newGameState();
    updateState(fresh);
    setSelectedFrom(null);
    setSelectedDie(null);
    setMessage('');
  };

  const playerName = (p) => {
    if (isOnline && matchData?.players) return matchData.players[p] || `Player ${p}`;
    if (isAI && p === P2) return 'Computer';
    return p === P1 ? (nick || 'White') : 'Black';
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

  return (
    <div style={containerStyle}>
      {/* Status bar */}
      <div style={statusStyle}>
        <PlayerTag
          name={playerName(P2)}
          player={P2}
          isYou={isOnline ? playerSlot === P2 : isAI ? false : false}
          isTurn={currentPlayer === P2}
          action={currentPlayer === P2 && !gs.winner ? (gs.phase === 'roll' ? 'Roll dice' : 'Move') : null}
          winner={gs.winner === P2}
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
          isTurn={currentPlayer === P1}
          action={currentPlayer === P1 && !gs.winner ? (gs.phase === 'roll' ? 'Roll dice' : 'Move') : null}
          winner={gs.winner === P1}
          align="right"
        />
      </div>

      {message && (
        <div style={{ color: theme.textHighlight, fontSize: 14, marginBottom: 8 }}>{message}</div>
      )}

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
          marginBottom: boardScale < 1 ? -(1 - boardScale) * 420 : 0,
          position: 'relative',
        }}>
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
          />
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

      {/* Dice + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
        {gs.dice.length > 0 && gs.dice.map((d, i) => {
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

        {gs.phase === 'roll' && !gs.winner && myTurn && !(isAI && currentPlayer === P2) && (
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

      <button onClick={onBack} style={{ ...btnSmall, marginTop: 24 }}>
        Leave Game
      </button>
    </div>
  );
}
