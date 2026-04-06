import React from 'react';
import { useTheme } from '../ThemeContext';

export default function Checker({ player, selected, movable, onClick, style }) {
  const theme = useTheme();
  const colors = {
    1: { fill: theme.checkerWhite[0], border: theme.checkerWhite[1] },
    2: { fill: theme.checkerBlack[0], border: theme.checkerBlack[1] },
  };
  const { fill, border } = colors[player];
  let boxShadow = '0 2px 4px rgba(0,0,0,0.6)';
  let borderColor = border;
  if (selected) {
    boxShadow = `0 0 8px 2px ${theme.goldBright}`;
    borderColor = theme.goldBright;
  } else if (movable) {
    boxShadow = `0 0 6px 2px ${theme.gold}`;
    borderColor = theme.gold;
  }
  return (
    <div
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${fill}, ${border})`,
        border: `2px solid ${borderColor}`,
        boxShadow,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, border 0.15s',
        ...style,
      }}
    />
  );
}
