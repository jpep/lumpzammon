import React, { useState, useEffect, useRef } from 'react';
import { sList, sGet } from '../storage';
import { useTheme } from '../ThemeContext';

export default function LobbyScreen({ nick, onCreateMatch, onJoinMatch, onBack }) {
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const theme = useTheme();

  const refresh = async () => {
    const keys = await sList('bg:lobby:');
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

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: theme.bg,
  };

  const btnStyle = {
    background: theme.btnBg,
    color: theme.btnText,
    border: 'none',
    borderRadius: 8,
    padding: '12px 32px',
    fontSize: 16,
    cursor: 'pointer',
    fontWeight: 'bold',
  };

  const btnSmall = {
    background: 'transparent',
    color: theme.btnOutlineText,
    border: `1px solid ${theme.btnOutlineBorder}`,
    borderRadius: 8,
    padding: '6px 16px',
    fontSize: 13,
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ color: theme.text, marginBottom: 24 }}>Online Lobby</h2>

      <button onClick={onCreateMatch} style={btnStyle}>
        Create Match
      </button>

      <div style={{ marginTop: 24, width: 320 }}>
        <h3 style={{ color: theme.textSecondary, marginBottom: 12 }}>
          Open Matches {loading ? '...' : `(${lobbies.length})`}
        </h3>
        {lobbies.length === 0 && !loading && (
          <p style={{ color: theme.textMuted, fontSize: 14 }}>No open matches. Create one!</p>
        )}
        {lobbies.map(lobby => (
          <div
            key={lobby.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 8,
            }}
          >
            <span style={{ color: theme.text }}>{lobby.host}'s game</span>
            {lobby.host !== nick && (
              <button
                onClick={() => onJoinMatch(lobby.id)}
                style={{ ...btnSmall, background: theme.btnBg }}
              >
                Join
              </button>
            )}
            {lobby.host === nick && (
              <span style={{ color: theme.textSecondary, fontSize: 13 }}>Waiting...</span>
            )}
          </div>
        ))}
      </div>

      <button onClick={onBack} style={{ ...btnSmall, marginTop: 24 }}>
        Back
      </button>
    </div>
  );
}
