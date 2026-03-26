import React, { useState, useEffect, useCallback } from 'react';
import Board from '../components/Board';
import DiceFace from '../components/DiceFace';
import {
  newGameState, rollDice, getValidMoves, applyMove, checkWin, clone, P1, P2
} from '../game/logic';
import { aiPlay } from '../game/ai';

function Stone({ player, size = 16 }) {
  const colors = { 1: ['#f5f5dc', '#8b7355'], 2: ['#2c1810', '#5c3a21'] };
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
  const isRight = align === 'right';
  const actionStyle = {
    color: '#ffcc00',
    fontSize: 12,
    fontWeight: 'bold',
    fontStyle: 'italic',
  };
  const nameStyle = {
    color: isTurn ? '#ffcc00' : '#f5f5dc',
    fontWeight: isTurn ? 'bold' : 'normal',
    fontSize: 15,
  };
  const youTag = isYou && (
    <span style={{ color: '#5c8a2f', fontSize: 12, fontWeight: 'bold' }}>(you!)</span>
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

export default function GameScreen({
  mode,
  nick,
  matchData,
  playerSlot,
  onUpdateMatch,
  onBack,
}) {
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
  const [message, setMessage] = useState('');

  const currentPlayer = gs.turn || P1;
  const myTurn = isOnline ? (playerSlot === currentPlayer) : true;
  const validMoves = gs.phase === 'move' ? getValidMoves(gs, currentPlayer) : [];

  const updateState = useCallback((newState) => {
    if (isOnline) {
      onUpdateMatch(newState);
    } else {
      setLocalState(newState);
    }
  }, [isOnline, onUpdateMatch]);

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
      setMessage(`No valid moves! Turn passes.`);
      setTimeout(() => setMessage(''), 2000);
    }

    updateState(newGs);
  }, [gs, currentPlayer, myTurn, isOnline, updateState]);

  // AI turn
  useEffect(() => {
    if (!isAI || currentPlayer !== P2 || gs.phase !== 'move') return;
    const timer = setTimeout(() => {
      const { state: newState } = aiPlay(gs, P2);
      const w = checkWin(newState);
      if (w) {
        newState.winner = w;
        newState.phase = 'done';
      } else {
        newState.phase = 'roll';
        newState.turn = P1;
        newState.dice = [];
        newState.moves = [];
      }
      updateState(newState);
    }, 600);
    return () => clearTimeout(timer);
  }, [isAI, currentPlayer, gs, updateState]);

  // AI auto-roll
  useEffect(() => {
    if (!isAI || currentPlayer !== P2 || gs.phase !== 'roll' || gs.winner) return;
    const timer = setTimeout(handleRoll, 500);
    return () => clearTimeout(timer);
  }, [isAI, currentPlayer, gs.phase, gs.winner, handleRoll]);

  const handleClickChecker = (from) => {
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
    const newGs = applyMove(gs, currentPlayer, move);
    const w = checkWin(newGs);
    if (w) {
      newGs.winner = w;
      newGs.phase = 'done';
      updateState(newGs);
      setSelectedFrom(null);
      return;
    }

    const remaining = getValidMoves(newGs, currentPlayer);
    if (remaining.length === 0 || newGs.moves.length === 0) {
      newGs.phase = 'roll';
      newGs.turn = currentPlayer === P1 ? P2 : P1;
      newGs.dice = [];
      newGs.moves = [];
    }

    updateState(newGs);
    setSelectedFrom(null);
  };

  const handleNewGame = () => {
    const fresh = newGameState();
    updateState(fresh);
    setSelectedFrom(null);
    setMessage('');
  };

  const playerName = (p) => {
    if (isOnline && matchData?.players) return matchData.players[p] || `Player ${p}`;
    if (isAI && p === P2) return 'Computer';
    return p === P1 ? (nick || 'White') : 'Black';
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
          <span style={{ color: '#ffcc00', fontWeight: 'bold', fontSize: 16 }}>
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
        <div style={{ color: '#ffcc00', fontSize: 14, marginBottom: 8 }}>{message}</div>
      )}

      {/* Board */}
      <Board
        gameState={gs}
        validMoves={validMoves}
        selectedFrom={selectedFrom}
        onClickChecker={handleClickChecker}
        onClickPoint={handleClickPoint}
        onClickBar={handleClickBar}
        onClickOff={handleClickOff}
        currentPlayer={currentPlayer}
      />

      {/* Dice + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
        {gs.dice.length > 0 && gs.dice.map((d, i) => (
          <DiceFace
            key={i}
            value={d}
            used={!gs.moves.includes(d) || gs.moves.indexOf(d) > gs.moves.lastIndexOf(d) - i}
          />
        ))}

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

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: '#1a0f00',
  padding: 16,
};

const statusStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: 600,
  color: '#f5f5dc',
  marginBottom: 12,
  fontSize: 14,
};

const btnStyle = {
  background: '#8b4513',
  color: '#f5f5dc',
  border: 'none',
  borderRadius: 8,
  padding: '10px 24px',
  fontSize: 16,
  cursor: 'pointer',
  fontWeight: 'bold',
};

const btnSmall = {
  background: 'transparent',
  color: '#d4a574',
  border: '1px solid #8b4513',
  borderRadius: 8,
  padding: '8px 24px',
  fontSize: 14,
  cursor: 'pointer',
};
