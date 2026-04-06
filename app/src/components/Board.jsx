import React from 'react';
import Point from './Point';
import BarZone from './BarZone';
import { TOP_IDX, BOT_IDX } from '../game/logic';
import { useTheme } from '../ThemeContext';

export default function Board({
  gameState,
  validMoves,
  movableSources,
  selectedFrom,
  onClickChecker,
  onClickPoint,
  onClickBar,
  onClickOff,
  currentPlayer,
  animatingFrom,
  animatingPlayer,
}) {
  const theme = useTheme();
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
            isMovable={movableSources.has(idx)}
            onClickPoint={highlightedTargets.has(idx) ? onClickPoint : undefined}
            onClickChecker={onClickChecker}
            selectedFrom={selectedFrom}
            animatingFrom={animatingFrom}
          />
        );
      })}
    </div>
  );

  const offHighlight = highlightedTargets.has('off');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: theme.bgBoard,
      border: `8px solid ${theme.borderBoard}`,
      borderRadius: 12,
      overflow: 'hidden',
      width: 'fit-content',
      boxShadow: `0 0 20px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.3)`,
    }}>
      {/* Top half */}
      <div style={{ display: 'flex' }}>
        <div style={{ display: 'flex' }}>
          {renderHalf(TOP_IDX.slice(0, 6), true)}
        </div>
        <BarZone bar={bar} player={2} isMovable={movableSources.has('bar')} onClickBar={onClickBar} selectedFrom={selectedFrom} animatingFrom={animatingFrom} animatingPlayer={animatingPlayer} />
        <div style={{ display: 'flex' }}>
          {renderHalf(TOP_IDX.slice(7), true)}
        </div>
        <div
          data-point-id="off-2"
          onClick={offHighlight ? onClickOff : undefined}
          style={{
            width: 50,
            background: offHighlight ? theme.bgBearoffActive : theme.bgBearoff,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: 4,
            cursor: offHighlight ? 'pointer' : 'default',
            gap: 2,
          }}
        >
          {off[2] > 0 && (
            <div style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
              {off[2]}
            </div>
          )}
        </div>
      </div>

      {/* Bottom half */}
      <div style={{ display: 'flex' }}>
        <div style={{ display: 'flex' }}>
          {renderHalf(BOT_IDX.slice(0, 6), false)}
        </div>
        <BarZone bar={bar} player={1} isMovable={movableSources.has('bar')} onClickBar={onClickBar} selectedFrom={selectedFrom} animatingFrom={animatingFrom} animatingPlayer={animatingPlayer} />
        <div style={{ display: 'flex' }}>
          {renderHalf(BOT_IDX.slice(7), false)}
        </div>
        <div
          data-point-id="off-1"
          onClick={offHighlight ? onClickOff : undefined}
          style={{
            width: 50,
            background: offHighlight ? theme.bgBearoffActive : theme.bgBearoff,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: 4,
            cursor: offHighlight ? 'pointer' : 'default',
            gap: 2,
          }}
        >
          {off[1] > 0 && (
            <div style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
              {off[1]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
