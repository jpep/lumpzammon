// Chess-clock timers (Phase 8.5d-2). Each turn gets MOVE_ALLOWANCE seconds free;
// time beyond that drains the on-turn player's GAME_BANK; an empty bank forfeits.
//
// Design (validated by the 8.5d-2 adversarial design review):
//   - DECOUPLED LOCAL MEASUREMENT — no shared wall-clock / no server time. Each
//     device measures its own turn elapsed from a local baseline ref. Drift
//     between clients is bounded by subscription lag and is accepted.
//   - SINGLE AUTHORITATIVE WRITER — only the on-turn client (`myTurn`) runs the
//     live countdown, folds its drained bank into the turn-flip write (foldClock),
//     and commits the forfeit. The off-turn client shows the STATIC synced bank.
//   - PAUSE — `paused` (cube modal / animation / non-active phase) freezes the
//     clock; paused seconds never count. So the clock runs only in roll + move;
//     opening / pass / done / the cube handshake are free.
//   - LIMITATION (accepted v1) — if the on-turn player disconnects, no forfeit
//     fires (their clock freezes); the game stalls until they return. A server
//     trigger would be needed to auto-forfeit a vanished player.

import { useRef, useEffect, useState, useCallback } from 'react';
import { MOVE_ALLOWANCE, GAME_BANK } from '../game/constants';

export default function useGameTimers({ bank, currentPlayer, myTurn, isActivePhase, paused, winner }) {
  const turnObservedAt = useRef(null); // ms baseline for the current active turn
  const pausedAccum = useRef(0);       // seconds paused so far this turn
  const pauseStartedAt = useRef(null); // ms a still-open pause began (or null)
  const prevPaused = useRef(false);
  const [, forceTick] = useState(0);

  // Re-baseline whenever a new active-turn window begins (turn flips, or a turn
  // becomes active). Keyed on (currentPlayer, isActivePhase) — NOT raw renders.
  useEffect(() => {
    turnObservedAt.current = Date.now();
    pausedAccum.current = 0;
    pauseStartedAt.current = paused ? Date.now() : null;
    prevPaused.current = paused;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, isActivePhase]);

  // Account pause transitions so paused time doesn't count toward the turn.
  useEffect(() => {
    if (paused && !prevPaused.current) {
      pauseStartedAt.current = Date.now();
    } else if (!paused && prevPaused.current) {
      if (pauseStartedAt.current != null) {
        pausedAccum.current += (Date.now() - pauseStartedAt.current) / 1000;
        pauseStartedAt.current = null;
      }
    }
    prevPaused.current = paused;
  }, [paused]);

  // 1 Hz display tick — only while THIS device owns the live (on-turn) clock.
  const live = myTurn && isActivePhase && !winner;
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => forceTick((n) => (n + 1) % 1e9), 1000);
    return () => clearInterval(id);
  }, [live]);

  // Real elapsed seconds this turn, excluding paused spans (incl. an open one).
  const elapsed = () => {
    if (turnObservedAt.current == null) return 0;
    let e = (Date.now() - turnObservedAt.current) / 1000 - pausedAccum.current;
    if (pauseStartedAt.current != null) e -= (Date.now() - pauseStartedAt.current) / 1000;
    return Math.max(0, e);
  };
  const overage = () => Math.max(0, elapsed() - MOVE_ALLOWANCE);
  const bankFor = (p) => (bank?.[p] ?? GAME_BANK);

  // Persist the on-turn player's drained bank into the SAME state object that
  // flips the turn (atomic). Reads the live refs, so a stale closure is fine.
  const foldClock = useCallback((g, me) => {
    const game = (g && g.clock && g.clock.game) || { 1: GAME_BANK, 2: GAME_BANK };
    const prev = game[me] ?? GAME_BANK;
    return { game: { ...game, [me]: Math.max(0, Math.floor(prev - overage())) } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    turnObservedAt.current = null;
    pausedAccum.current = 0;
    pauseStartedAt.current = null;
    prevPaused.current = false;
  }, []);

  // DEV-only: backdate the turn baseline so the verifier can drive the clock to
  // expiry without waiting real seconds. No-op effect on production behaviour.
  const debugAge = useCallback((secs) => {
    turnObservedAt.current = Date.now() - secs * 1000;
    pausedAccum.current = 0;
    pauseStartedAt.current = null;
  }, []);

  // Live values on the on-turn device; the static synced bank otherwise (B9).
  let moveRemaining = MOVE_ALLOWANCE;
  let gameRemaining = bankFor(currentPlayer);
  if (live) {
    const e = elapsed();
    moveRemaining = Math.max(0, MOVE_ALLOWANCE - e);
    gameRemaining = bankFor(currentPlayer) - Math.max(0, e - MOVE_ALLOWANCE);
  }
  const expired = live && gameRemaining <= 0;

  return { moveRemaining, gameRemaining, expired, foldClock, reset, debugAge };
}
