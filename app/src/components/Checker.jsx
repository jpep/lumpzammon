import React from 'react';

const COLORS = { 1: '#f5f5dc', 2: '#2c1810' };
const BORDER = { 1: '#8b7355', 2: '#5c3a21' };

export default function Checker({ player, selected, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${COLORS[player]}, ${BORDER[player]})`,
        border: `2px solid ${selected ? '#ffcc00' : BORDER[player]}`,
        boxShadow: selected
          ? '0 0 8px 2px #ffcc00'
          : '0 2px 4px rgba(0,0,0,0.4)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
        ...style,
      }}
    />
  );
}
