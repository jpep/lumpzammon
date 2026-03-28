import React from 'react';
import { useTheme } from '../ThemeContext';

const ITEMS = [
  // stars
  { emoji: '✦', x: 5, y: 8, size: 18, delay: 0, dur: 3 },
  { emoji: '✦', x: 92, y: 12, size: 14, delay: 1.2, dur: 2.5 },
  { emoji: '⭐', x: 15, y: 85, size: 16, delay: 0.5, dur: 3.5 },
  { emoji: '✦', x: 80, y: 90, size: 20, delay: 2, dur: 2.8 },
  { emoji: '⭐', x: 50, y: 5, size: 14, delay: 0.8, dur: 3.2 },
  { emoji: '✦', x: 35, y: 92, size: 12, delay: 1.5, dur: 2.6 },
  { emoji: '⭐', x: 70, y: 7, size: 16, delay: 2.2, dur: 3 },
  // flowers
  { emoji: '✿', x: 3, y: 40, size: 20, delay: 0.3, dur: 4 },
  { emoji: '❀', x: 95, y: 55, size: 18, delay: 1, dur: 3.8 },
  { emoji: '✿', x: 8, y: 65, size: 16, delay: 1.8, dur: 3.5 },
  { emoji: '❀', x: 90, y: 35, size: 22, delay: 0.6, dur: 4.2 },
  { emoji: '✿', x: 48, y: 95, size: 14, delay: 2.5, dur: 3 },
  { emoji: '❀', x: 60, y: 3, size: 16, delay: 1.3, dur: 3.6 },
  // rainbow sparkles
  { emoji: '🌈', x: 12, y: 20, size: 18, delay: 0.7, dur: 5 },
  { emoji: '🌈', x: 85, y: 75, size: 16, delay: 2.8, dur: 4.5 },
];

const COLORS = ['#ff0000', '#ff8800', '#ffdd00', '#00cc44', '#0088ff', '#aa44ff', '#ff44aa'];

const keyframesCSS = `
@keyframes rainbow-float {
  0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.7; }
  50% { transform: translateY(-12px) rotate(15deg); opacity: 1; }
}
@keyframes rainbow-title-glow {
  0% { text-shadow: 0 0 8px #ff0000, 0 0 16px #ff8800; }
  16% { text-shadow: 0 0 8px #ff8800, 0 0 16px #ffdd00; }
  33% { text-shadow: 0 0 8px #ffdd00, 0 0 16px #00cc44; }
  50% { text-shadow: 0 0 8px #00cc44, 0 0 16px #0088ff; }
  66% { text-shadow: 0 0 8px #0088ff, 0 0 16px #aa44ff; }
  83% { text-shadow: 0 0 8px #aa44ff, 0 0 16px #ff44aa; }
  100% { text-shadow: 0 0 8px #ff0000, 0 0 16px #ff8800; }
}
`;

export default function RainbowDecorations() {
  const theme = useTheme();
  if (theme.decorations !== 'rainbow') return null;

  return (
    <>
      <style>{keyframesCSS}</style>
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}>
        {ITEMS.map((item, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${item.x}%`,
              top: `${item.y}%`,
              fontSize: item.size,
              color: COLORS[i % COLORS.length],
              animation: `rainbow-float ${item.dur}s ease-in-out ${item.delay}s infinite`,
              filter: 'drop-shadow(0 0 4px currentColor)',
              userSelect: 'none',
            }}
          >
            {item.emoji}
          </span>
        ))}
      </div>
    </>
  );
}
