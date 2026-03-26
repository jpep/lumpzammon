import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MenuScreen from './screens/MenuScreen';
import ModeSelectScreen from './screens/ModeSelectScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import KickedScreen from './screens/KickedScreen';
import AdminPanel from './components/AdminPanel';
import BuildInfo from './components/BuildInfo';
import useOnlineMatch from './hooks/useOnlineMatch';
import useKickDetection from './hooks/useKickDetection';
import { getTheme } from './theme';
import { ThemeProvider } from './ThemeContext';
import { loadNick, saveNick, clearNick, loadSession, clearSession } from './storage/local';

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [nick, setNick] = useState('');
  const [mode, setMode] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const adminLongPress = useRef(null);
  const reconnectAttempted = useRef(false);

  const { matchId, matchData, playerSlot, createMatch, joinMatch, reconnectMatch, updateMatch, leaveMatch } =
    useOnlineMatch(nick);
  const kicked = useKickDetection(matchId, playerSlot);

  // On mount, try to reconnect to a saved session
  useEffect(() => {
    if (reconnectAttempted.current) return;
    reconnectAttempted.current = true;

    const savedNick = loadNick();
    const session = loadSession();
    if (!savedNick || !session) return;

    // Set nick first so the hook has it, then attempt reconnect
    setNick(savedNick);
  }, []);

  // Once nick is set from localStorage, attempt reconnect
  useEffect(() => {
    if (!nick || reconnectAttempted.current === 'done') return;
    const session = loadSession();
    if (!session) return;

    // Mark as done so we don't loop
    reconnectAttempted.current = 'done';

    reconnectMatch(session.matchId, session.playerSlot).then((ok) => {
      if (ok) {
        setMode('online');
        setScreen('game');
      } else {
        clearSession();
      }
    });
  }, [nick, reconnectMatch]);

  const handleStart = (nickname) => {
    setNick(nickname);
    saveNick(nickname);
    setScreen('modeSelect');
  };

  const handleSelectMode = async (selectedMode) => {
    setMode(selectedMode);
    if (selectedMode === 'online') {
      setScreen('lobby');
    } else {
      setScreen('game');
    }
  };

  const handleCreateMatch = async () => {
    await createMatch();
    setScreen('game');
  };

  const handleJoinMatch = async (id) => {
    const ok = await joinMatch(id);
    if (ok) setScreen('game');
  };

  const handleBack = () => {
    leaveMatch();
    setMode(null);
    setScreen('modeSelect');
  };

  const handleBackToMenu = () => {
    leaveMatch();
    setMode(null);
    setNick('');
    clearNick();
    setScreen('menu');
  };

  const theme = useMemo(() => getTheme(nick), [nick]);

  if (kicked && screen === 'game') {
    return (
      <ThemeProvider theme={theme}>
        <KickedScreen onBack={handleBackToMenu} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      {screen === 'menu' && <MenuScreen onStart={handleStart} />}
      {screen === 'modeSelect' && (
        <ModeSelectScreen
          nick={nick}
          onSelectMode={handleSelectMode}
          onBack={handleBackToMenu}
        />
      )}
      {screen === 'lobby' && (
        <LobbyScreen
          nick={nick}
          onCreateMatch={handleCreateMatch}
          onJoinMatch={handleJoinMatch}
          onBack={handleBack}
        />
      )}
      {screen === 'game' && (
        <GameScreen
          mode={mode}
          nick={nick}
          matchData={matchData}
          playerSlot={playerSlot}
          onUpdateMatch={updateMatch}
          onBack={handleBack}
        />
      )}

      <BuildInfo />

      {/* Admin toggle: double-click or long-tap (mobile) */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      <div
        onDoubleClick={() => setShowAdmin(true)}
        onTouchStart={() => { adminLongPress.current = setTimeout(() => setShowAdmin(true), 800); }}
        onTouchEnd={() => clearTimeout(adminLongPress.current)}
        onTouchMove={() => clearTimeout(adminLongPress.current)}
        style={{
          position: 'fixed',
          bottom: 8,
          right: 8,
          width: 28,
          height: 28,
          cursor: 'pointer',
          opacity: 0,
        }}
      />
    </ThemeProvider>
  );
}
