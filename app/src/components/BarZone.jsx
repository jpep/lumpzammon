import React from 'react';
import Checker from './Checker';

export default function BarZone({ bar, onClickBar, selectedFrom }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: 50,
      background: '#3d2b1f',
      gap: 8,
      padding: '8px 0',
    }}>
      {/* P2 bar (top) */}
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
      {/* P1 bar (bottom) */}
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
