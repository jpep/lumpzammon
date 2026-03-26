import React from 'react';

export default function KickedScreen({ onBack }) {
  return (
    <div style={containerStyle}>
      <h2 style={{ color: '#f5f5dc', marginBottom: 12 }}>Disconnected</h2>
      <p style={{ color: '#d4a574', marginBottom: 24 }}>
        The match has ended or you were disconnected.
      </p>
      <button onClick={onBack} style={btnStyle}>
        Back to Menu
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
