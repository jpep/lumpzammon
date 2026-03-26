import React, { useState, useEffect } from 'react';
import { sList, sGet, sDel } from '../storage';
import { useTheme } from '../ThemeContext';

export default function AdminPanel({ onClose }) {
  const [matches, setMatches] = useState([]);
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      const [matchKeys, lobbyKeys] = await Promise.all([
        sList('bg:match:'),
        sList('bg:lobby:'),
      ]);
      const matchData = await Promise.all(
        matchKeys.map(async (key) => {
          const data = await sGet(key);
          const p1 = data?.players?.[1] || '?';
          const p2 = data?.players?.[2] || 'waiting...';
          return { key, label: `${p1} vs ${p2}` };
        })
      );
      const lobbyData = await Promise.all(
        lobbyKeys.map(async (key) => {
          const data = await sGet(key);
          return { key, label: data?.host || '?' };
        })
      );
      setMatches(matchData);
      setLobbies(lobbyData);
      setLoading(false);
    })();
  }, []);

  const handleClear = async (key, type) => {
    await sDel(key);
    if (type === 'match') {
      setMatches(prev => prev.filter(item => item.key !== key));
    } else {
      setLobbies(prev => prev.filter(item => item.key !== key));
    }
  };

  const handleClearAll = async (type) => {
    const items = type === 'match' ? matches : lobbies;
    for (const item of items) await sDel(item.key);
    if (type === 'match') setMatches([]);
    else setLobbies([]);
  };

  const btnStyle = {
    background: theme.btnBg,
    color: theme.btnText,
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13,
  };

  const renderSection = (title, items, type) => (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 8px', color: theme.gold }}>{title} ({items.length})</h4>
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: theme.textMuted }}>None</p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
            {items.map(item => (
              <li key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 13 }}>{item.label}</span>
                <button onClick={() => handleClear(item.key, type)} style={btnStyle}>Delete</button>
              </li>
            ))}
          </ul>
          <button onClick={() => handleClearAll(type)} style={{ ...btnStyle, background: theme.btnBgDanger }}>
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
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: theme.bgPanel,
        border: `2px solid ${theme.border}`,
        borderRadius: 12,
        padding: 24,
        minWidth: 300,
        maxWidth: 500,
        color: theme.text,
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
