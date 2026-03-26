import React from 'react';
import { useTheme } from '../ThemeContext';

export default function KickedScreen({ onBack }) {
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
    padding: '12px 32px',
    fontSize: 16,
    cursor: 'pointer',
    fontWeight: 'bold',
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ color: theme.text, marginBottom: 12 }}>Disconnected</h2>
      <p style={{ color: theme.textSecondary, marginBottom: 24 }}>
        The match has ended or you were disconnected.
      </p>
      <button onClick={onBack} style={btnStyle}>
        Back to Menu
      </button>
    </div>
  );
}
