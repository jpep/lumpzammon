// localStorage helpers for persisting session across browser reloads
//
// Session and local game keys are scoped by nickname so two tabs with
// different nicks (e.g. testing online mode against yourself) don't
// clash. The nick itself uses a fixed key (last nick entered).

const NICK_KEY = 'bg:nick';

// Current nick used to scope other keys. Set by the app on login.
let _currentNick = '';

export function setCurrentNick(nick) {
  _currentNick = nick;
}

function sessionKey() {
  return _currentNick ? `bg:session:${_currentNick}` : 'bg:session';
}

function localGameKey() {
  return _currentNick ? `bg:localGame:${_currentNick}` : 'bg:localGame';
}

// Nick uses sessionStorage (per-tab) so two tabs can hold different nicks,
// with a localStorage fallback to pre-fill the field on fresh tabs.
export function saveNick(nick) {
  try {
    sessionStorage.setItem(NICK_KEY, nick);
    localStorage.setItem(NICK_KEY, nick);
  } catch (e) { /* noop */ }
}

export function loadNick() {
  try {
    return sessionStorage.getItem(NICK_KEY) || localStorage.getItem(NICK_KEY) || '';
  } catch (e) { return ''; }
}

export function clearNick() {
  try {
    sessionStorage.removeItem(NICK_KEY);
  } catch (e) { /* noop */ }
}

export function saveSession(matchId, playerSlot) {
  try {
    localStorage.setItem(sessionKey(), JSON.stringify({ matchId, playerSlot }));
  } catch (e) { /* noop */ }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(sessionKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(sessionKey()); } catch (e) { /* noop */ }
}

// Local/AI game persistence across page reloads
export function saveLocalGame(mode, state, direction) {
  try {
    localStorage.setItem(localGameKey(), JSON.stringify({ mode, state, direction }));
  } catch (e) { /* noop */ }
}

export function loadLocalGame() {
  try {
    const raw = localStorage.getItem(localGameKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearLocalGame() {
  try { localStorage.removeItem(localGameKey()); } catch (e) { /* noop */ }
}
