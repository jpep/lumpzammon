import { describe, it, expect } from 'vitest';
import { gameEndResult } from '../gameResult.js';
import { P1, P2 } from '../logic.js';

const emptyPts = () => Array.from({ length: 24 }, () => ({ n: 0, p: 0 }));
function st(overrides = {}) {
  return {
    pts: emptyPts(),
    bar: { 1: 0, 2: 0 },
    off: { 1: 0, 2: 0 },
    dice: [], moves: [],
    turn: 0, phase: 'done', winner: 0,
    ...overrides,
  };
}

// A simple win for `winner`: loser has borne off >=1 so classifyWin => 'simple' (1pt).
function simpleWin(winner) {
  const loser = winner === P1 ? P2 : P1;
  const s = st({ off: { [winner]: 15, [loser]: 3 }, winner });
  s.pts[10] = { n: 12, p: loser };
  return s;
}

describe('gameEndResult — guards', () => {
  it('returns null with no winner', () => {
    expect(gameEndResult({ gs: st(), winner: 0, isAI: true })).toBeNull();
  });
  it('returns null for local two-player (no single identity)', () => {
    expect(gameEndResult({ gs: simpleWin(P1), winner: P1, isOnline: false, isAI: false })).toBeNull();
  });
});

describe('gameEndResult — vs AI (human is P1)', () => {
  it('records a win when P1 wins', () => {
    const r = gameEndResult({ gs: simpleWin(P1), winner: P1, isAI: true });
    expect(r).toMatchObject({ didWin: true, delta: 1, youScore: 1, oppScore: 0, opponent: 'AI' });
  });
  it('records a loss when P2 (AI) wins', () => {
    const r = gameEndResult({ gs: simpleWin(P2), winner: P2, isAI: true });
    expect(r).toMatchObject({ didWin: false, delta: -1, youScore: 0, oppScore: 1, opponent: 'AI' });
  });
});

describe('gameEndResult — online (identity = playerSlot)', () => {
  it('P1 client: win when winner is P1', () => {
    const r = gameEndResult({ gs: simpleWin(P1), winner: P1, isOnline: true, playerSlot: P1, opponentName: 'bob' });
    expect(r).toMatchObject({ didWin: true, delta: 1, opponent: 'bob' });
  });
  it('P2 client: loss when winner is P1', () => {
    const r = gameEndResult({ gs: simpleWin(P1), winner: P1, isOnline: true, playerSlot: P2, opponentName: 'alice' });
    expect(r).toMatchObject({ didWin: false, delta: -1, opponent: 'alice' });
  });
  it('P2 client: win when winner is P2', () => {
    const r = gameEndResult({ gs: simpleWin(P2), winner: P2, isOnline: true, playerSlot: P2, opponentName: 'alice' });
    expect(r).toMatchObject({ didWin: true, delta: 1, opponent: 'alice' });
  });
});

describe('gameEndResult — gammon/backgammon scoring', () => {
  it('gammon (loser bore off none) = 2 points', () => {
    const s = st({ off: { 1: 15, 2: 0 }, winner: P1 });
    s.pts[10] = { n: 15, p: P2 }; // outside P1 home, not on bar => gammon
    const r = gameEndResult({ gs: s, winner: P1, isAI: true });
    expect(r).toMatchObject({ didWin: true, delta: 2, youScore: 2 });
  });
  it('backgammon (loser on the bar) = 3 points', () => {
    const s = st({ off: { 1: 15, 2: 0 }, bar: { 1: 0, 2: 1 }, winner: P1 });
    s.pts[10] = { n: 14, p: P2 };
    const r = gameEndResult({ gs: s, winner: P1, isAI: true });
    expect(r).toMatchObject({ didWin: true, delta: 3, youScore: 3 });
  });
  it('a loss carries the negative magnitude (gammon loss = -2)', () => {
    const s = st({ off: { 1: 15, 2: 0 }, winner: P1 });
    s.pts[10] = { n: 15, p: P2 };
    const r = gameEndResult({ gs: s, winner: P1, isOnline: true, playerSlot: P2, opponentName: 'x' });
    expect(r).toMatchObject({ didWin: false, delta: -2, oppScore: 2 });
  });
});
