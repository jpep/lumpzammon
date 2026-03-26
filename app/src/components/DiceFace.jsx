import React from 'react';
import theme from '../theme';

const DOT_POSITIONS = {
  1: [[1,1]],
  2: [[0,2],[2,0]],
  3: [[0,2],[1,1],[2,0]],
  4: [[0,0],[0,2],[2,0],[2,2]],
  5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
  6: [[0,0],[0,1],[0,2],[2,0],[2,1],[2,2]],
};

export default function DiceFace({ value, used, onClick }) {
  const dots = DOT_POSITIONS[value] || [];
  return (
    <div
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        background: used ? theme.diceUsedBg : theme.diceBg,
        borderRadius: 8,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        padding: 6,
        gap: 2,
        opacity: used ? 0.4 : 1,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const hasDot = dots.some(([r, c]) => r === row && c === col);
        return (
          <div
            key={i}
            style={{
              borderRadius: '50%',
              background: hasDot ? (used ? theme.diceUsedDot : theme.diceDot) : 'transparent',
            }}
          />
        );
      })}
    </div>
  );
}
