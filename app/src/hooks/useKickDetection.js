import { useState, useEffect, useRef } from 'react';
import { sGet } from '../storage';
import { KEY_MATCH } from '../game/constants';

export default function useKickDetection(matchId, playerSlot) {
  const [kicked, setKicked] = useState(false);
  const intervalRef = useRef(null);

  // Reset when match changes (e.g. after leaving a match)
  useEffect(() => {
    setKicked(false);
  }, [matchId]);

  useEffect(() => {
    if (!matchId || !playerSlot) return;

    intervalRef.current = setInterval(async () => {
      const data = await sGet(`${KEY_MATCH}${matchId}`);
      if (!data) {
        setKicked(true);
        clearInterval(intervalRef.current);
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [matchId, playerSlot]);

  return kicked;
}
