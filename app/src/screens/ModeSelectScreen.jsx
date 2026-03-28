import React from 'react';
import { useTheme } from '../ThemeContext';

export default function ModeSelectScreen({ nick, onSelectMode, onBack }) {
  const theme = useTheme();

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
    padding: '14px 48px',
    fontSize: 18,
    cursor: 'pointer',
    fontWeight: 'bold',
    minWidth: 220,
  };

  const btnSmall = {
    background: 'transparent',
    color: theme.btnOutlineText,
    border: `1px solid ${theme.btnOutlineBorder}`,
    borderRadius: 8,
    padding: '8px 24px',
    fontSize: 14,
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle}>
      <h2 style={{
        marginBottom: 8,
        ...(theme.decorations === 'rainbow'
          ? {
              background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffdd00, #00cc44, #0088ff, #aa44ff, #ff44aa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }
          : { color: theme.text }),
      }}>Welcome, {nick}</h2>
      <p style={{ color: theme.textSecondary, marginBottom: 32 }}>Choose game mode</p>

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
