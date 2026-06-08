// Online lobby, restyled to the GMMN look (Phase 8.5c-2): the fond/nortechico
// shell over the real Firebase lobby, framed like a GMMN room. Functionality
// (sList/sGet on KEY_LOBBY, create/join) is unchanged.

import React, { useState, useEffect, useRef } from 'react';
import { sList, sGet } from '../storage';
import { KEY_LOBBY } from '../game/constants';
import { useTheme } from '../ThemeContext';
import GmmnScreen from '../components/GmmnScreen';
import { gmmnTitle, gmmnButton, gmmnButtonSmall, NORTECHICO } from '../ui/gmmn';

export default function LobbyScreen({ nick, onCreateMatch, onJoinMatch, onBack }) {
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const theme = useTheme();

  const refresh = async () => {
    const keys = await sList(KEY_LOBBY);
    const results = [];
    for (const key of keys) {
      const data = await sGet(key);
      if (data) results.push(data);
    }
    setLobbies(results);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // GMMN "room": a board-outline frame around the lobby content.
  const frame = {
    border: `1.5px solid ${theme.text}`,
    borderRadius: 12,
    background: 'rgba(0,0,0,0.45)',
    padding: '24px 26px',
    width: 360,
    maxWidth: '100%',
    boxShadow: '0 0 30px rgba(0,0,0,0.6)',
  };

  return (
    <GmmnScreen>
      <h2 style={{ ...gmmnTitle(theme), fontSize: 26, marginBottom: 18 }}>Online Lobby</h2>

      <div style={frame}>
        <button onClick={onCreateMatch} style={{ ...gmmnButton(theme), width: '100%', minWidth: 0 }}>
          Create Match
        </button>

        <h3 style={{ color: theme.textSecondary, fontSize: 13, margin: '20px 0 10px', fontFamily: NORTECHICO, letterSpacing: 1 }}>
          OPEN MATCHES {loading ? '…' : `(${lobbies.length})`}
        </h3>

        {lobbies.length === 0 && !loading && (
          <p style={{ color: theme.textMuted, fontSize: 14, fontFamily: NORTECHICO }}>No open matches. Create one!</p>
        )}

        {lobbies.map((lobby) => (
          <div
            key={lobby.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(0,0,0,0.4)', border: `1px solid ${theme.border}`,
              borderRadius: 8, padding: '10px 14px', marginBottom: 8,
            }}
          >
            <span style={{ color: theme.text, fontFamily: NORTECHICO }}>{lobby.host}'s game</span>
            {lobby.host !== nick ? (
              <button onClick={() => onJoinMatch(lobby.id)} style={{ ...gmmnButtonSmall(theme), background: theme.btnBg, color: theme.btnText }}>
                Join
              </button>
            ) : (
              <span style={{ color: theme.textSecondary, fontSize: 13, fontFamily: NORTECHICO }}>Waiting…</span>
            )}
          </div>
        ))}
      </div>

      <button onClick={onBack} style={{ ...gmmnButtonSmall(theme), marginTop: 22 }}>
        Back
      </button>
    </GmmnScreen>
  );
}
