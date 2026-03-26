import React, { useState } from 'react';
import MenuScreen from './screens/MenuScreen';
import ModeSelectScreen from './screens/ModeSelectScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import KickedScreen from './screens/KickedScreen';
import AdminPanel from './components/AdminPanel';
import useOnlineMatch from './hooks/useOnlineMatch';
import useKickDetection from './hooks/useKickDetection';

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [nick, setNick] = useState('');
  const [mode, setMode] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const { matchId, matchData, playerSlot, createMatch, joinMatch, updateMatch, leaveMatch } =
    useOnlineMatch(nick);
  const kicked = useKickDetection(matchId, playerSlot);

  const handleStart = (nickname) => {
    setNick(nickname);
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
    setScreen('menu');
  };

  if (kicked && screen === 'game') {
    return <KickedScreen onBack={handleBackToMenu} />;
  }

  return (
    <>
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

      {/* Admin toggle (Ctrl+Shift+A) */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      <div
        onDoubleClick={() => setShowAdmin(true)}
        style={{
          position: 'fixed',
          bottom: 4,
          right: 4,
          width: 20,
          height: 20,
          cursor: 'pointer',
          opacity: 0,
        }}
      />
    </>
  );
}
