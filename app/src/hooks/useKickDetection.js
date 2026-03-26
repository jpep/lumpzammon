import { useState, useEffect, useRef } from 'react';
import { sGet } from '../storage';

export default function useKickDetection(matchId, playerSlot) {
  const [kicked, setKicked] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!matchId || !playerSlot) return;

    intervalRef.current = setInterval(async () => {
      const data = await sGet(`bg:match:${matchId}`);
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
