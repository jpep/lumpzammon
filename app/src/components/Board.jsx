import React from 'react';
import Point from './Point';
import BarZone from './BarZone';
import { TOP_IDX, BOT_IDX } from '../game/logic';

export default function Board({
  gameState,
  validMoves,
  selectedFrom,
  onClickChecker,
  onClickPoint,
  onClickBar,
  onClickOff,
  currentPlayer,
}) {
  const { pts, bar, off } = gameState;

  const highlightedTargets = new Set();
  if (selectedFrom !== null) {
    for (const m of validMoves) {
      if (m.f === selectedFrom) {
        if (m.t === 'off') highlightedTargets.add('off');
        else highlightedTargets.add(m.t);
      }
    }
  }

  const renderHalf = (indices, isTop) => (
    <div style={{ display: 'flex', gap: 0 }}>
      {indices.map((idx, i) => {
        if (idx === null) return null;
        return (
          <Point
            key={idx}
            index={idx}
            point={pts[idx]}
            isTop={isTop}
            isHighlighted={highlightedTargets.has(idx)}
            isSelected={selectedFrom === idx}
            onClickPoint={highlightedTargets.has(idx) ? onClickPoint : undefined}
            onClickChecker={onClickChecker}
            selectedFrom={selectedFrom}
          />
        );
      })}
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#2d5016',
      border: '8px solid #5c3a21',
      borderRadius: 12,
      overflow: 'hidden',
      width: 'fit-content',
    }}>
      {/* Top half */}
      <div style={{ display: 'flex' }}>
        <div style={{ display: 'flex' }}>
          {renderHalf(TOP_IDX.slice(0, 6), true)}
        </div>
        <BarZone bar={bar} onClickBar={onClickBar} selectedFrom={selectedFrom} />
        <div style={{ display: 'flex' }}>
          {renderHalf(TOP_IDX.slice(7), true)}
        </div>
        {/* Bear-off zone */}
        <div
          onClick={highlightedTargets.has('off') ? onClickOff : undefined}
          style={{
            width: 50,
            background: highlightedTargets.has('off') ? '#5c8a2f' : '#3d2b1f',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: 4,
            cursor: highlightedTargets.has('off') ? 'pointer' : 'default',
            gap: 2,
          }}
        >
          {off[2] > 0 && (
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
              P2: {off[2]}
            </div>
          )}
        </div>
      </div>

      {/* Bottom half */}
      <div style={{ display: 'flex' }}>
        <div style={{ display: 'flex' }}>
          {renderHalf(BOT_IDX.slice(0, 6), false)}
        </div>
        <BarZone bar={bar} onClickBar={onClickBar} selectedFrom={selectedFrom} />
        <div style={{ display: 'flex' }}>
          {renderHalf(BOT_IDX.slice(7), false)}
        </div>
        <div
          onClick={highlightedTargets.has('off') ? onClickOff : undefined}
          style={{
            width: 50,
            background: highlightedTargets.has('off') ? '#5c8a2f' : '#3d2b1f',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: 4,
            cursor: highlightedTargets.has('off') ? 'pointer' : 'default',
            gap: 2,
          }}
        >
          {off[1] > 0 && (
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
              P1: {off[1]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
