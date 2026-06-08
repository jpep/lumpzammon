// Unified GMMN entry screen (Phase 8.5c-2): nickname + game-mode selection in
// one screen (ModeSelect merged in), on the fond/nortechico GMMN shell with the
// per-nick palette tinting the accents. onStart(nick, mode) goes straight to the
// game (local/ai) or the lobby (online).

import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { loadNick } from '../storage/local';
import GmmnScreen from '../components/GmmnScreen';
import { gmmnTitle, gmmnDivider, gmmnButton, gmmnInput, NORTECHICO } from '../ui/gmmn';

export default function MenuScreen({ onStart }) {
  const [nick, setNick] = useState(() => loadNick());
  const theme = useTheme();
  const ready = nick.trim().length > 0;
  const start = (mode) => { if (ready) onStart(nick.trim(), mode); };

  const modes = [
    { mode: 'local', label: 'Local (2 Players)' },
    { mode: 'ai', label: 'vs Computer' },
    { mode: 'online', label: 'Online' },
  ];

  return (
    <GmmnScreen>
      <h1 style={{ ...gmmnTitle(theme), fontSize: 44, marginBottom: 4 }}>Lumpzammon!</h1>
      <div style={gmmnDivider(theme)} />

      <input
        type="text"
        placeholder="Enter your nickname"
        value={nick}
        onChange={(e) => setNick(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && ready && start('ai')}
        style={{ ...gmmnInput(theme), marginBottom: 22 }}
        maxLength={20}
        autoFocus
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {modes.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => start(mode)}
            disabled={!ready}
            style={{ ...gmmnButton(theme), opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'not-allowed' }}
          >
            {label}
          </button>
        ))}
      </div>

      <p style={{ marginTop: 26, color: theme.textMuted, fontSize: 12, fontFamily: NORTECHICO, letterSpacing: 1 }}>
        enter a nickname, then pick a mode
      </p>
    </GmmnScreen>
  );
}
