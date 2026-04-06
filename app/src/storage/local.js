// localStorage helpers for persisting session across browser reloads

const NICK_KEY = 'bg:nick';
const SESSION_KEY = 'bg:session';

export function saveNick(nick) {
  try { localStorage.setItem(NICK_KEY, nick); } catch (e) { /* noop */ }
}

export function loadNick() {
  try { return localStorage.getItem(NICK_KEY) || ''; } catch (e) { return ''; }
}

export function clearNick() {
  try { localStorage.removeItem(NICK_KEY); } catch (e) { /* noop */ }
}

export function saveSession(matchId, playerSlot) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ matchId, playerSlot }));
  } catch (e) { /* noop */ }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* noop */ }
}

// Local/AI game persistence across page reloads
const LOCAL_GAME_KEY = 'bg:localGame';

export function saveLocalGame(mode, state, direction) {
  try {
    localStorage.setItem(LOCAL_GAME_KEY, JSON.stringify({ mode, state, direction }));
  } catch (e) { /* noop */ }
}

export function loadLocalGame() {
  try {
    const raw = localStorage.getItem(LOCAL_GAME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearLocalGame() {
  try { localStorage.removeItem(LOCAL_GAME_KEY); } catch (e) { /* noop */ }
}
