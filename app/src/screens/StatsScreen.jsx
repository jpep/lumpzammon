// Player profile overlay (Phase 8.5c). A dark veil over the board showing a
// player's real Firebase stats: name, cumulative multiplayer score (±N), win %,
// total games, rank, first-play date, and a recent-games table. Reads
// storage/playerStats (getPlayer / getMultiplayerScore / rankFromGames), which
// is now populated by the 8.5b game-end recording.
//
// Layout follows devanture's drawPlayerProfile; the score polyline chart is
// deferred (a later polish). Opened by clicking a player's name in GameScreen.

import React, { useEffect, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { getPlayer, getMultiplayerScore, rankFromGames } from '../storage/playerStats';

const GAIN = '#8fb4d9'; // pastel blue — wins (devanture gainBlue)
const LOSS = '#b3505f'; // burgundy/petrol — losses (devanture lossRed)

function formatGameDate(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const ageMs = Date.now() - t;
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  if (ageMs >= 0 && ageMs < 86400000) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${pad(d.getFullYear() % 100)}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

// Score-over-time polyline (devanture drawScorePolyline, as responsive SVG).
// X = date span; Y auto-scaled to the data (with the 0 baseline shown). Needs
// >= 2 history points; otherwise renders nothing.
function ScoreChart({ history, color, baselineColor }) {
  const pts = (history || []).filter((p) => p && p.date && Number.isFinite(Date.parse(p.date)));
  if (pts.length < 2) return null;
  const W = 520; const H = 96; const padX = 3; const padY = 8;
  const times = pts.map((p) => Date.parse(p.date));
  const t0 = Math.min(...times); const t1 = Math.max(...times);
  const span = Math.max(1, t1 - t0);
  const scores = pts.map((p) => Number(p.score) || 0);
  const lo = Math.min(0, ...scores);
  let hi = Math.max(0, ...scores);
  if (hi === lo) hi = lo + 1;
  const sx = (t) => padX + ((t - t0) / span) * (W - 2 * padX);
  const sy = (s) => padY + (1 - (s - lo) / (hi - lo)) * (H - 2 * padY);
  const line = pts.map((p) => `${sx(Date.parse(p.date)).toFixed(1)},${sy(Number(p.score) || 0).toFixed(1)}`).join(' ');
  const zeroY = sy(0).toFixed(1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
      style={{ display: 'block', marginTop: 12 }} aria-label="score over time">
      <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY}
        stroke={baselineColor} strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function StatsScreen({ nick, onClose }) {
  const theme = useTheme();
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = none

  useEffect(() => {
    let cancelled = false;
    setProfile(undefined);
    getPlayer(nick).then((p) => { if (!cancelled) setProfile(p); });
    return () => { cancelled = true; };
  }, [nick]);

  const veil = {
    position: 'fixed', inset: 0, zIndex: 100, // above BuildInfo's z-50 info icon
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  };
  const card = {
    width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
    background: theme.bgPanel, border: `1.5px solid ${theme.text}`, borderRadius: 12,
    padding: '20px 22px', color: theme.text,
    boxShadow: '0 0 30px rgba(0,0,0,0.7)',
  };

  const mpScore = getMultiplayerScore(profile);
  const totalGames = profile?.totalGames || 0;
  const winPct = Math.round((profile?.winPercent || 0) * 100);
  const rank = rankFromGames(totalGames);
  const sign = mpScore > 0 ? '+' : '';
  const games = Array.isArray(profile?.recentGames) ? profile.recentGames : [];

  return (
    <div style={veil} onClick={onClose} data-testid="stats-overlay">
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 30, fontWeight: 'bold', color: theme.textHighlight, letterSpacing: 1 }}>
            {String(nick || '').toUpperCase()}
          </span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: theme.textSecondary,
            fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {profile === undefined && (
          <div style={{ color: theme.textSecondary, marginTop: 16 }}>Loading…</div>
        )}

        {profile === null && (
          <div style={{ color: theme.textSecondary, marginTop: 16 }}>No games played yet.</div>
        )}

        {profile && (
          <>
            <div style={{ marginTop: 10, fontSize: 16, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 'bold', color: mpScore > 0 ? GAIN : mpScore < 0 ? LOSS : theme.text }}>
                ({sign}{mpScore})
              </span>
              <span>{winPct}%</span>
              <span style={{ color: theme.textSecondary }}>{totalGames} games</span>
              <span style={{ color: theme.goldBright, fontWeight: 'bold' }}>#{rank}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: theme.textSecondary }}>
              since {String(profile.firstPlay || '').slice(0, 10)}
            </div>

            <ScoreChart history={profile.scoreHistory} color={theme.goldBright} baselineColor={theme.border} />

            <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {games.map((g, i) => {
                  const won = g.delta > 0;
                  const pts = Math.abs(g.delta);
                  return (
                    <tr key={i} style={{ borderTop: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '5px 6px', color: won ? GAIN : LOSS, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {won ? '↑+' : '↓'}{g.delta}
                      </td>
                      <td style={{ padding: '5px 6px' }}>
                        YOU <sup style={{ color: theme.textSecondary }}>({g.youScore})</sup>
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {won ? pts : 0} - {won ? 0 : pts}
                      </td>
                      <td style={{ padding: '5px 6px' }}>
                        {g.opponent} <sup style={{ color: theme.textSecondary }}>({g.oppScore})</sup>
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                        {formatGameDate(g.playedAt)}
                      </td>
                    </tr>
                  );
                })}
                {games.length === 0 && (
                  <tr><td style={{ padding: '8px 6px', color: theme.textSecondary }}>No recent games.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
