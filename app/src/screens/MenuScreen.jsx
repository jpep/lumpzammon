import React, { useState } from 'react';

export default function MenuScreen({ onStart }) {
  const [nick, setNick] = useState('');

  return (
    <div style={containerStyle}>
      <h1 style={{ color: '#f5f5dc', fontSize: 36, marginBottom: 24 }}>Lumpzammon</h1>
      <input
        type="text"
        placeholder="Enter your nickname"
        value={nick}
        onChange={e => setNick(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && nick.trim() && onStart(nick.trim())}
        style={inputStyle}
        maxLength={20}
        autoFocus
      />
      <button
        onClick={() => nick.trim() && onStart(nick.trim())}
        disabled={!nick.trim()}
        style={{
          ...btnStyle,
          opacity: nick.trim() ? 1 : 0.5,
        }}
      >
        Play
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

const inputStyle = {
  background: '#2c1810',
  border: '2px solid #8b4513',
  borderRadius: 8,
  color: '#f5f5dc',
  padding: '12px 16px',
  fontSize: 16,
  width: 260,
  marginBottom: 16,
  outline: 'none',
  textAlign: 'center',
};

const btnStyle = {
  background: '#8b4513',
  color: '#f5f5dc',
  border: 'none',
  borderRadius: 8,
  padding: '12px 32px',
  fontSize: 18,
  cursor: 'pointer',
  fontWeight: 'bold',
};
