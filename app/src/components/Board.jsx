import React from 'react';
import Point from './Point';
import BarZone from './BarZone';
import { getBoardIndices } from '../game/logic';
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
  direction,
}) {
  const theme = useTheme();
  const { pts, bar, off } = gameState;
  const { topIdx, botIdx } = getBoardIndices(direction);

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

  const offZone = (player, justify) => {
    const isActive = player === currentPlayer;
    return (
      <div
        data-point-id={`off-${player}`}
        onClick={offHighlight ? onClickOff : undefined}
        style={{
          width: 50,
          background: offHighlight ? theme.bgBearoffActive : theme.bgBearoff,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: justify,
          padding: 4,
          cursor: offHighlight ? 'pointer' : 'default',
          gap: 2,
          borderLeft: !bearOffLeft ? `2px solid ${isActive ? theme.goldBright : 'transparent'}` : 'none',
          borderRight: bearOffLeft ? `2px solid ${isActive ? theme.goldBright : 'transparent'}` : 'none',
          transition: 'border-color 0.3s',
        }}
      >
        <div style={{
          color: isActive ? theme.textHighlight : theme.text,
          fontSize: 8,
          opacity: isActive ? 0.8 : 0.3,
          textTransform: 'uppercase',
          letterSpacing: 1,
          writingMode: 'vertical-lr',
          fontWeight: isActive ? 'bold' : 'normal',
          transition: 'color 0.3s, opacity 0.3s',
        }}>
          home
        </div>
        {off[player] > 0 && (
          <div style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
            {off[player]}
          </div>
        )}
      </div>
    );
  };

  const bearOffLeft = direction === 1;
  // 180° rotation: swap which player's bar/off goes on which half
  const topPlayer = direction === 1 ? 1 : 2;
  const botPlayer = direction === 1 ? 2 : 1;

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
        {bearOffLeft && offZone(topPlayer, 'flex-start')}
        <div style={{ display: 'flex' }}>
          {renderHalf(topIdx.slice(0, 6), true)}
        </div>
        <BarZone bar={bar} player={topPlayer} isMovable={movableSources.has('bar')} onClickBar={onClickBar} selectedFrom={selectedFrom} animatingFrom={animatingFrom} animatingPlayer={animatingPlayer} />
        <div style={{ display: 'flex' }}>
          {renderHalf(topIdx.slice(7), true)}
        </div>
        {!bearOffLeft && offZone(topPlayer, 'flex-start')}
      </div>

      {/* Bottom half */}
      <div style={{ display: 'flex' }}>
        {bearOffLeft && offZone(botPlayer, 'flex-end')}
        <div style={{ display: 'flex' }}>
          {renderHalf(botIdx.slice(0, 6), false)}
        </div>
        <BarZone bar={bar} player={botPlayer} isMovable={movableSources.has('bar')} onClickBar={onClickBar} selectedFrom={selectedFrom} animatingFrom={animatingFrom} animatingPlayer={animatingPlayer} />
        <div style={{ display: 'flex' }}>
          {renderHalf(botIdx.slice(7), false)}
        </div>
        {!bearOffLeft && offZone(botPlayer, 'flex-end')}
      </div>
    </div>
  );
}
