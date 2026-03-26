import React from 'react';

export default function ModeSelectScreen({ nick, onSelectMode, onBack }) {
  return (
    <div style={containerStyle}>
      <h2 style={{ color: '#f5f5dc', marginBottom: 8 }}>Welcome, {nick}</h2>
      <p style={{ color: '#d4a574', marginBottom: 32 }}>Choose game mode</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => onSelectMode('local')} style={btnStyle}>
          Local (2 Players)
        </button>
        <button onClick={() => onSelectMode('ai')} style={btnStyle}>
          vs Computer
        </button>
        <button onClick={() => onSelectMode('online')} style={btnStyle}>
          Online
        </button>
      </div>

      <button onClick={onBack} style={{ ...btnSmall, marginTop: 32 }}>
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
  padding: '14px 48px',
  fontSize: 18,
  cursor: 'pointer',
  fontWeight: 'bold',
  minWidth: 220,
};

const btnSmall = {
  background: 'transparent',
  color: '#d4a574',
  border: '1px solid #8b4513',
  borderRadius: 8,
  padding: '8px 24px',
  fontSize: 14,
  cursor: 'pointer',
};
