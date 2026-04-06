import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { loadNick } from '../storage/local';

export default function MenuScreen({ onStart }) {
  const [nick, setNick] = useState(() => loadNick());
  const theme = useTheme();

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: theme.bg,
  };

  const inputStyle = {
    background: theme.bgPanel,
    border: `2px solid ${theme.border}`,
    borderRadius: 8,
    color: theme.text,
    padding: '12px 16px',
    fontSize: 16,
    width: 260,
    marginBottom: 16,
    outline: 'none',
    textAlign: 'center',
  };

  const btnStyle = {
    background: theme.btnBg,
    color: theme.btnText,
    border: 'none',
    borderRadius: 8,
    padding: '12px 32px',
    fontSize: 18,
    cursor: 'pointer',
    fontWeight: 'bold',
  };

  return (
    <div style={containerStyle}>
      <h1 style={{
        fontSize: 36,
        marginBottom: 4,
        letterSpacing: 2,
        ...(theme.decorations === 'rainbow'
          ? {
              background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffdd00, #00cc44, #0088ff, #aa44ff, #ff44aa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'rainbow-title-glow 4s linear infinite',
            }
          : { color: theme.text }),
      }}>Lumpzammon!</h1>
      <div style={{
        width: 120,
        height: 2,
        background: theme.decorations === 'rainbow'
          ? 'linear-gradient(90deg, #ff0000, #ff8800, #ffdd00, #00cc44, #0088ff, #aa44ff)'
          : theme.gold,
        marginBottom: 24,
      }} />
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
