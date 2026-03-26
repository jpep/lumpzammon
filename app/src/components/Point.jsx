import React from 'react';
import Checker from './Checker';

export default function Point({
  index,
  point,
  isTop,
  isHighlighted,
  isSelected,
  onClickPoint,
  onClickChecker,
  selectedFrom,
}) {
  const { n, p } = point;
  const checkers = [];
  const maxShow = Math.min(n, 5);

  for (let i = 0; i < maxShow; i++) {
    const isTopChecker = i === maxShow - 1;
    checkers.push(
      <Checker
        key={i}
        player={p}
        selected={isSelected && isTopChecker}
        onClick={isTopChecker && onClickChecker ? () => onClickChecker(index) : undefined}
        style={{ marginBottom: isTop ? 2 : 0, marginTop: isTop ? 0 : 2 }}
      />
    );
  }

  const overflow = n > 5 ? n - 5 : 0;

  return (
    <div
      onClick={() => onClickPoint && onClickPoint(index)}
      style={{
        display: 'flex',
        flexDirection: isTop ? 'column' : 'column-reverse',
        alignItems: 'center',
        width: 42,
        minHeight: 200,
        paddingTop: isTop ? 4 : 0,
        paddingBottom: isTop ? 0 : 4,
        cursor: isHighlighted ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {/* Triangle */}
      <div
        style={{
          position: 'absolute',
          top: isTop ? 0 : undefined,
          bottom: isTop ? undefined : 0,
          width: 0,
          height: 0,
          borderLeft: '21px solid transparent',
          borderRight: '21px solid transparent',
          [isTop ? 'borderTop' : 'borderBottom']:
            `190px solid ${index % 2 === 0 ? '#8b4513' : '#d4a574'}`,
          opacity: isHighlighted ? 0.8 : 0.6,
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: isTop ? 'column' : 'column-reverse', alignItems: 'center' }}>
        {checkers}
        {overflow > 0 && (
          <div style={{
            color: '#fff',
            fontSize: 11,
            fontWeight: 'bold',
            textShadow: '0 1px 2px #000',
          }}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
