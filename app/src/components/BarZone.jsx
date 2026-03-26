import React from 'react';
import Checker from './Checker';
import theme from '../theme';

export default function BarZone({ bar, onClickBar, selectedFrom }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: 50,
      background: theme.bgBar,
      gap: 8,
      padding: '8px 0',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {Array.from({ length: bar[2] }, (_, i) => (
          <Checker
            key={`b2-${i}`}
            player={2}
            selected={selectedFrom === 'bar' && i === bar[2] - 1}
            onClick={i === bar[2] - 1 && onClickBar ? () => onClickBar(2) : undefined}
          />
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {Array.from({ length: bar[1] }, (_, i) => (
          <Checker
            key={`b1-${i}`}
            player={1}
            selected={selectedFrom === 'bar' && i === bar[1] - 1}
            onClick={i === bar[1] - 1 && onClickBar ? () => onClickBar(1) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
