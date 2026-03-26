import React, { useState, useEffect } from 'react';
import { sList, sDel } from '../storage';

export default function AdminPanel({ onClose }) {
  const [matches, setMatches] = useState([]);
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [matchKeys, lobbyKeys] = await Promise.all([
        sList('bg:match:'),
        sList('bg:lobby:'),
      ]);
      setMatches(matchKeys);
      setLobbies(lobbyKeys);
      setLoading(false);
    })();
  }, []);

  const handleClear = async (key, type) => {
    await sDel(key);
    if (type === 'match') {
      setMatches(prev => prev.filter(k => k !== key));
    } else {
      setLobbies(prev => prev.filter(k => k !== key));
    }
  };

  const handleClearAll = async (type) => {
    const keys = type === 'match' ? matches : lobbies;
    for (const key of keys) await sDel(key);
    if (type === 'match') setMatches([]);
    else setLobbies([]);
  };

  const renderSection = (title, keys, type) => (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 8px', color: '#d4a574' }}>{title} ({keys.length})</h4>
      {keys.length === 0 ? (
        <p style={{ fontSize: 13, color: '#886644' }}>None</p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
            {keys.map(key => (
              <li key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 13 }}>{key}</span>
                <button onClick={() => handleClear(key, type)} style={btnStyle}>Delete</button>
              </li>
            ))}
          </ul>
          <button onClick={() => handleClearAll(type)} style={{ ...btnStyle, background: '#8b0000' }}>
            Clear All
          </button>
        </>
      )}
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#2c1810',
        border: '2px solid #8b4513',
        borderRadius: 12,
        padding: 24,
        minWidth: 300,
        maxWidth: 500,
        color: '#f5f5dc',
      }}>
        <h3 style={{ margin: '0 0 16px' }}>Admin Panel</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {renderSection('Active Matches', matches, 'match')}
            {renderSection('Open Lobbies', lobbies, 'lobby')}
          </>
        )}
        <div style={{ marginTop: 16 }}>
          <button onClick={onClose} style={btnStyle}>Close</button>
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  background: '#8b4513',
  color: '#f5f5dc',
  border: 'none',
  borderRadius: 6,
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 13,
};
