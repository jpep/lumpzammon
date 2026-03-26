import { useState, useEffect, useRef, useCallback } from 'react';
import { sGet, sSet, sDel, sList, sSubscribe } from '../storage';
import { newGameState, clone } from '../game/logic';

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
  }, [matchId]);

  return {
    matchId,
    matchData,
    playerSlot,
    createMatch,
    joinMatch,
    updateMatch,
    leaveMatch,
  };
}
