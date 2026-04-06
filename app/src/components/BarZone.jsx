import React from 'react';
import Checker from './Checker';
import { useTheme } from '../ThemeContext';

export default function BarZone({ bar, player, isMovable, onClickBar, selectedFrom, animatingFrom, animatingPlayer }) {
  const theme = useTheme();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: player === 2 ? 'flex-start' : 'flex-end',
      width: 50,
      background: theme.bgBar,
      padding: '8px 0',
    }}>
      <div data-bar-player={player} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {Array.from({ length: bar[player] }, (_, i) => (
          <Checker
            key={`b${player}-${i}`}
            player={player}
            selected={selectedFrom === 'bar' && i === bar[player] - 1}
            movable={isMovable && i === bar[player] - 1 && selectedFrom !== 'bar'}
            onClick={i === bar[player] - 1 && onClickBar ? () => onClickBar(player) : undefined}
            style={{
              opacity: i === bar[player] - 1 && animatingFrom === 'bar' && animatingPlayer === player ? 0 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
