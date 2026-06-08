// Player stats over the lumpzammon Firebase Realtime DB, namespace /players/<nick>.
//
// Re-homed from devanture/firebase.js + devanture/adapter.js onto the project's
// single modular-ESM Firebase app (the one in firebaseAdapter.js) so there is
// one project, one SDK, one nick sanitizer. The /players schema is unchanged
// from the skin:
//
//   /players/<nick> = {
//     firstPlay:    ISO date string of the first recorded game,
//     totalGames:   number,                 // games played (all outcomes)
//     wins:         number,
//     winPercent:   number,                 // wins / totalGames (0..1)
//     recentGames:  [ { youScore, oppScore, opponent, delta, playedAt }, ... ]   // append-front, capped 50
//     scoreHistory: [ { date: 'YYYY-MM-DD', score } , ... ]                       // cumulative delta per day
//   }
//
// appendGame is transactional (runTransaction) — unlike the skin's read/set,
// it is safe against the racy last-write-wins seen elsewhere in online play.
//
// NOTE: not wired to any screen until Phase 8.5. This is infrastructure only.

import { ref, get, runTransaction } from 'firebase/database';
import { getDb } from './firebaseAdapter';

export const RECENT_GAMES_CAP = 50;

// Firebase RTDB keys cannot contain . $ # [ ] / — collapse them to _. This is
// the single canonical nick sanitizer (replaces devanture's sanitizeNick).
export function sanitizeNick(nick) {
  return String(nick || '').trim().toLowerCase().replace(/[.$#\[\]/]/g, '_');
}

// A brand-new, empty profile stamped at `nowIso`.
function freshProfile(nowIso) {
  return {
    firstPlay: nowIso,
    totalGames: 0,
    wins: 0,
    winPercent: 0,
    recentGames: [],
    scoreHistory: [],
  };
}

// Pure reducer: current profile (or null/undefined) + a game result → next
// profile. No I/O — this is exactly what the appendGame transaction applies and
// what the unit tests exercise. Faithful to devanture/firebase.js appendGame.
//   gameResult = { youScore, oppScore, opponent, delta, didWin, playedAt? }
export function applyGameToProfile(profile, gameResult, nowIso) {
  const playedAt = gameResult.playedAt || nowIso;
  const next = profile ? { ...profile } : freshProfile(nowIso);

  const entry = {
    youScore: Number(gameResult.youScore) || 0,
    oppScore: Number(gameResult.oppScore) || 0,
    opponent: String(gameResult.opponent || 'AI'),
    delta: Number(gameResult.delta) || 0,
    playedAt,
  };

  next.totalGames = (next.totalGames || 0) + 1;
  if (gameResult.didWin) next.wins = (next.wins || 0) + 1;
  next.winPercent = next.totalGames > 0 ? next.wins / next.totalGames : 0;

  next.recentGames = Array.isArray(next.recentGames)
    ? [entry, ...next.recentGames].slice(0, RECENT_GAMES_CAP)
    : [entry];

  // scoreHistory: cumulative delta, one point per day (aggregate same-day games).
  const dayKey = playedAt.slice(0, 10);
  const history = Array.isArray(next.scoreHistory) ? [...next.scoreHistory] : [];
  if (history.length === 0) {
    next.scoreHistory = [{ date: dayKey, score: entry.delta }];
  } else {
    const last = { ...history[history.length - 1] };
    const cumulative = (last.score || 0) + entry.delta;
    if (last.date === dayKey) {
      history[history.length - 1] = { ...last, score: cumulative };
    } else {
      history.push({ date: dayKey, score: cumulative });
    }
    next.scoreHistory = history;
  }

  return next;
}

// Read a profile. Returns null for an empty nick, an absent profile, or on error.
export async function getPlayer(nick) {
  const key = sanitizeNick(nick);
  if (!key) return null;
  try {
    const snap = await get(ref(getDb(), `players/${key}`));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error('[playerStats] getPlayer error:', e);
    return null;
  }
}

// Create the profile if absent; return the existing-or-created profile.
export async function ensurePlayer(nick) {
  const key = sanitizeNick(nick);
  if (!key) return null;
  const nowIso = new Date().toISOString();
  const node = ref(getDb(), `players/${key}`);
  try {
    const res = await runTransaction(node, (curr) =>
      curr == null ? freshProfile(nowIso) : curr
    );
    const snap = res.snapshot;
    return snap && snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error('[playerStats] ensurePlayer error:', e);
    return null;
  }
}

// Append a finished game to a player's profile, atomically. Returns the updated
// profile, or null on empty nick / error.
//   gameResult = { youScore, oppScore, opponent, delta, didWin, playedAt? }
export async function appendGame(nick, gameResult) {
  const key = sanitizeNick(nick);
  if (!key) return null;
  const nowIso = new Date().toISOString();
  const node = ref(getDb(), `players/${key}`);
  try {
    const res = await runTransaction(node, (curr) =>
      applyGameToProfile(curr, gameResult, nowIso)
    );
    const snap = res.snapshot;
    return res.committed && snap && snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error('[playerStats] appendGame error:', e);
    return null;
  }
}

// ── Pure display helpers (re-homed from devanture/adapter.js) ────────────────

// Cumulative multiplayer score = sum of recent-game deltas. Matches the in-game
// superscript and the profile parenthetical. Takes a profile object (decoupled
// from the skin's PLAYER_PROFILES mock, which is retired).
export function getMultiplayerScore(profile) {
  if (!profile || !Array.isArray(profile.recentGames)) return 0;
  return profile.recentGames.reduce((s, g) => s + (g.delta || 0), 0);
}

// 7-tier ASCII-friendly rank from total games played (displayed with a leading '#').
export function rankFromGames(n) {
  if (n <= 50) return 'ROOKIE';
  if (n <= 150) return 'NOVICE';
  if (n <= 400) return 'AMATEUR';
  if (n <= 1000) return 'SKILLED';
  if (n <= 2500) return 'ADVANCED';
  if (n <= 5000) return 'EXPERT';
  return 'MASTER';
}
