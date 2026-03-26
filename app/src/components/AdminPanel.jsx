import React, { useState, useEffect } from 'react';
import { sList, sDel } from '../storage';

export default function AdminPanel({ onClose }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const keys = await sList('bg:match:');
      setMatches(keys);
      setLoading(false);
    })();
  }, []);

  const handleClear = async (key) => {
    await sDel(key);
    setMatches(prev => prev.filter(k => k !== key));
  };

  const handleClearAll = async () => {
    for (const key of matches) await sDel(key);
    setMatches([]);
  };

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
          <p>Loading matches...</p>
        ) : matches.length === 0 ? (
          <p>No active matches</p>
        ) : (
          <>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
              {matches.map(key => (
                <li key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: 13 }}>{key}</span>
                  <button onClick={() => handleClear(key)} style={btnStyle}>Delete</button>
                </li>
              ))}
            </ul>
            <button onClick={handleClearAll} style={{ ...btnStyle, background: '#8b0000' }}>
              Clear All Matches
            </button>
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
