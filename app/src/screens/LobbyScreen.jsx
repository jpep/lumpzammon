import React, { useState, useEffect, useRef } from 'react';
import { sList, sGet } from '../storage';

export default function LobbyScreen({ nick, onCreateMatch, onJoinMatch, onBack }) {
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

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

  return (
    <div style={containerStyle}>
      <h2 style={{ color: '#f5f5dc', marginBottom: 24 }}>Online Lobby</h2>

      <button onClick={onCreateMatch} style={btnStyle}>
        Create Match
      </button>

      <div style={{ marginTop: 24, width: 320 }}>
        <h3 style={{ color: '#d4a574', marginBottom: 12 }}>
          Open Matches {loading ? '...' : `(${lobbies.length})`}
        </h3>
        {lobbies.length === 0 && !loading && (
          <p style={{ color: '#886644', fontSize: 14 }}>No open matches. Create one!</p>
        )}
        {lobbies.map(lobby => (
          <div
            key={lobby.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#2c1810',
              border: '1px solid #8b4513',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 8,
            }}
          >
            <span style={{ color: '#f5f5dc' }}>{lobby.host}'s game</span>
            {lobby.host !== nick && (
              <button
                onClick={() => onJoinMatch(lobby.id)}
                style={{ ...btnSmall, background: '#5c8a2f' }}
              >
                Join
              </button>
            )}
            {lobby.host === nick && (
              <span style={{ color: '#d4a574', fontSize: 13 }}>Waiting...</span>
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

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: '#1a0f00',
};

const btnStyle = {
  background: '#8b4513',
  color: '#f5f5dc',
  border: 'none',
  borderRadius: 8,
  padding: '12px 32px',
  fontSize: 16,
  cursor: 'pointer',
  fontWeight: 'bold',
};

const btnSmall = {
  background: 'transparent',
  color: '#d4a574',
  border: '1px solid #8b4513',
  borderRadius: 8,
  padding: '6px 16px',
  fontSize: 13,
  cursor: 'pointer',
};
