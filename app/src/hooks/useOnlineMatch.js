import { useState, useEffect, useRef, useCallback } from 'react';
import { sGet, sSet, sDel, sList, sSubscribe } from '../storage';
import { newGameState, clone } from '../game/logic';
import { saveSession, clearSession } from '../storage/local';

export default function useOnlineMatch(nick) {
  const [matchId, setMatchId] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [playerSlot, setPlayerSlot] = useState(null);
  const unsubRef = useRef(null);

  const createMatch = useCallback(async () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const data = {
      id,
      players: { 1: nick, 2: null },
      state: newGameState(),
      created: Date.now(),
    };
    await sSet(`bg:match:${id}`, data);
    await sSet(`bg:lobby:${id}`, { id, host: nick, created: Date.now() });
    setMatchId(id);
    setPlayerSlot(1);
    setMatchData(data);
    saveSession(id, 1);
    return id;
  }, [nick]);

  const joinMatch = useCallback(async (id) => {
    const data = await sGet(`bg:match:${id}`);
    if (!data || data.players[2]) return false;
    data.players[2] = nick;
    await sSet(`bg:match:${id}`, data);
    await sDel(`bg:lobby:${id}`);
    setMatchId(id);
    setPlayerSlot(2);
    setMatchData(data);
    saveSession(id, 2);
    return true;
  }, [nick]);

  // Reconnect to an existing match without modifying DB data.
  // Returns true if match still exists and player belongs to it.
  const reconnectMatch = useCallback(async (id, slot) => {
    const data = await sGet(`bg:match:${id}`);
    if (!data) {
      clearSession();
      return false;
    }
    // Verify this player actually belongs to this match
    if (data.players[slot] !== nick) {
      clearSession();
      return false;
    }
    setMatchId(id);
    setPlayerSlot(slot);
    setMatchData(data);
    saveSession(id, slot);
    return true;
  }, [nick]);

  const updateMatch = useCallback(async (newState) => {
    if (!matchId) return;
    const data = await sGet(`bg:match:${matchId}`);
    if (!data) return;
    data.state = newState;
    await sSet(`bg:match:${matchId}`, data);
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    unsubRef.current = sSubscribe(`bg:match:${matchId}`, (data) => {
      if (data) setMatchData(data);
    });
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [matchId]);

  const leaveMatch = useCallback(async () => {
    if (matchId) {
      await sDel(`bg:match:${matchId}`);
      await sDel(`bg:lobby:${matchId}`);
    }
    if (unsubRef.current) unsubRef.current();
    setMatchId(null);
    setMatchData(null);
    setPlayerSlot(null);
    clearSession();
  }, [matchId]);

  return {
    matchId,
    matchData,
    playerSlot,
    createMatch,
    joinMatch,
    reconnectMatch,
    updateMatch,
    leaveMatch,
  };
}
