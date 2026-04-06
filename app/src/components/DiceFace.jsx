import React from 'react';
import { useTheme } from '../ThemeContext';

const DOT_POSITIONS = {
  1: [[1,1]],
  2: [[0,2],[2,0]],
  3: [[0,2],[1,1],[2,0]],
  4: [[0,0],[0,2],[2,0],[2,2]],
  5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
  6: [[0,0],[0,1],[0,2],[2,0],[2,1],[2,2]],
};

export default function DiceFace({ value, used, selected, onClick }) {
  const theme = useTheme();
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
        boxShadow: selected
          ? `0 0 10px 3px ${theme.goldBright}`
          : '0 2px 6px rgba(0,0,0,0.5)',
        border: selected ? `2px solid ${theme.goldBright}` : '2px solid transparent',
        transition: 'box-shadow 0.15s, border 0.15s',
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
