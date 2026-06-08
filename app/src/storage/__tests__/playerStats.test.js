import { describe, it, expect } from 'vitest';
import {
  sanitizeNick,
  applyGameToProfile,
  getMultiplayerScore,
  rankFromGames,
  RECENT_GAMES_CAP,
} from '../playerStats.js';

// The Firebase-touching functions (getPlayer/ensurePlayer/appendGame) need a
// live DB, so they're exercised end-to-end via the browser verifier. Here we
// pin the pure surface: the sanitizer, the transaction reducer, and the
// display helpers.

const NOW = '2026-06-08T12:00:00.000Z';

describe('sanitizeNick', () => {
  it('lowercases and trims', () => {
    expect(sanitizeNick('  Pepo  ')).toBe('pepo');
  });

  it('replaces the Firebase-forbidden characters . $ # [ ] / with _', () => {
    expect(sanitizeNick('a.b$c#d[e]f/g')).toBe('a_b_c_d_e_f_g');
  });

  it('keeps colons and spaces (valid RTDB key chars)', () => {
    expect(sanitizeNick('jo se:1')).toBe('jo se:1');
  });

  it('returns empty string for nullish input', () => {
    expect(sanitizeNick(null)).toBe('');
    expect(sanitizeNick(undefined)).toBe('');
  });
});

describe('applyGameToProfile — fresh profile', () => {
  it('seeds a profile from null on the first win', () => {
    const p = applyGameToProfile(null, {
      youScore: 4, oppScore: 2, opponent: 'AI', delta: 2, didWin: true,
    }, NOW);
    expect(p.firstPlay).toBe(NOW);
    expect(p.totalGames).toBe(1);
    expect(p.wins).toBe(1);
    expect(p.winPercent).toBe(1);
    expect(p.recentGames).toHaveLength(1);
    expect(p.recentGames[0]).toMatchObject({
      youScore: 4, oppScore: 2, opponent: 'AI', delta: 2, playedAt: NOW,
    });
    expect(p.scoreHistory).toEqual([{ date: '2026-06-08', score: 2 }]);
  });

  it('records a loss (no win increment) on the first game', () => {
    const p = applyGameToProfile(undefined, {
      youScore: 1, oppScore: 4, opponent: 'AI', delta: -3, didWin: false,
    }, NOW);
    expect(p.totalGames).toBe(1);
    expect(p.wins).toBe(0);
    expect(p.winPercent).toBe(0);
    expect(p.scoreHistory).toEqual([{ date: '2026-06-08', score: -3 }]);
  });

  it('defaults a missing opponent to AI and coerces numeric fields', () => {
    const p = applyGameToProfile(null, { delta: '2', didWin: true }, NOW);
    expect(p.recentGames[0].opponent).toBe('AI');
    expect(p.recentGames[0].delta).toBe(2);
    expect(p.recentGames[0].youScore).toBe(0);
  });
});

describe('applyGameToProfile — existing profile', () => {
  const base = () => ({
    firstPlay: '2026-06-01T00:00:00.000Z',
    totalGames: 2,
    wins: 1,
    winPercent: 0.5,
    recentGames: [
      { youScore: 5, oppScore: 4, opponent: 'AI', delta: 1, playedAt: '2026-06-07T10:00:00.000Z' },
    ],
    scoreHistory: [{ date: '2026-06-07', score: 5 }],
  });

  it('does not mutate the input profile (pure reducer)', () => {
    const before = base();
    const snapshot = JSON.stringify(before);
    applyGameToProfile(before, { delta: 3, didWin: true }, NOW);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('increments counts and prepends the new game', () => {
    const p = applyGameToProfile(base(), {
      youScore: 7, oppScore: 5, opponent: 'NIA', delta: 2, didWin: true,
    }, NOW);
    expect(p.totalGames).toBe(3);
    expect(p.wins).toBe(2);
    expect(p.winPercent).toBeCloseTo(2 / 3);
    expect(p.recentGames[0].opponent).toBe('NIA'); // newest first
    expect(p.recentGames).toHaveLength(2);
    expect(p.firstPlay).toBe('2026-06-01T00:00:00.000Z'); // preserved
  });

  it('pushes a new dated point with the running cumulative score', () => {
    const p = applyGameToProfile(base(), { delta: 3, didWin: true }, NOW);
    // new day → cumulative = last (5) + delta (3)
    expect(p.scoreHistory).toEqual([
      { date: '2026-06-07', score: 5 },
      { date: '2026-06-08', score: 8 },
    ]);
  });

  it('aggregates same-day games into the last history point', () => {
    const sameDay = { delta: 4, didWin: true, playedAt: '2026-06-07T20:00:00.000Z' };
    const p = applyGameToProfile(base(), sameDay, NOW);
    expect(p.scoreHistory).toEqual([{ date: '2026-06-07', score: 9 }]);
  });

  it(`caps recentGames at ${RECENT_GAMES_CAP}`, () => {
    let p = {
      ...base(),
      recentGames: Array.from({ length: RECENT_GAMES_CAP }, (_, i) => ({
        youScore: 0, oppScore: 0, opponent: `OPP${i}`, delta: 0,
        playedAt: '2026-06-07T00:00:00.000Z',
      })),
    };
    p = applyGameToProfile(p, { opponent: 'NEW', delta: 1, didWin: true }, NOW);
    expect(p.recentGames).toHaveLength(RECENT_GAMES_CAP);
    expect(p.recentGames[0].opponent).toBe('NEW'); // newest kept
    expect(p.recentGames.some((g) => g.opponent === `OPP${RECENT_GAMES_CAP - 1}`)).toBe(false); // oldest dropped
  });

  it('treats a non-array recentGames/scoreHistory as fresh', () => {
    const p = applyGameToProfile(
      { totalGames: 1, wins: 1, recentGames: undefined, scoreHistory: null },
      { delta: 2, didWin: false },
      NOW
    );
    expect(p.recentGames).toHaveLength(1);
    expect(p.scoreHistory).toEqual([{ date: '2026-06-08', score: 2 }]);
  });
});

describe('getMultiplayerScore', () => {
  it('sums recent-game deltas', () => {
    expect(getMultiplayerScore({ recentGames: [{ delta: 2 }, { delta: -1 }, { delta: 3 }] })).toBe(4);
  });

  it('returns 0 for missing/empty profiles', () => {
    expect(getMultiplayerScore(null)).toBe(0);
    expect(getMultiplayerScore({})).toBe(0);
    expect(getMultiplayerScore({ recentGames: [] })).toBe(0);
  });
});

describe('rankFromGames', () => {
  it('maps the 7 tiers at their boundaries', () => {
    expect(rankFromGames(0)).toBe('ROOKIE');
    expect(rankFromGames(50)).toBe('ROOKIE');
    expect(rankFromGames(51)).toBe('NOVICE');
    expect(rankFromGames(150)).toBe('NOVICE');
    expect(rankFromGames(151)).toBe('AMATEUR');
    expect(rankFromGames(400)).toBe('AMATEUR');
    expect(rankFromGames(401)).toBe('SKILLED');
    expect(rankFromGames(1000)).toBe('SKILLED');
    expect(rankFromGames(1001)).toBe('ADVANCED');
    expect(rankFromGames(2500)).toBe('ADVANCED');
    expect(rankFromGames(2501)).toBe('EXPERT');
    expect(rankFromGames(5000)).toBe('EXPERT');
    expect(rankFromGames(5001)).toBe('MASTER');
  });
});
