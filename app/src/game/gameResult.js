// Build the playerStats record for a finished game, from THIS device's identity.
//
// Returns null when there's no single clear identity to attribute the game to
// (local two-player on one device) or when there's no winner yet. Gammon /
// backgammon are scored via rules.js, then multiplied by the doubling-cube
// value (Phase 8.5d). A declined double or a clock forfeit (endReason 'decline'
// / 'forfeit') is always a simple win at the (pre-double) cube value — the board
// position is irrelevant, so we skip classifyWin and force a single.
//
// gameResult shape (consumed by storage/playerStats.appendGame):
//   { youScore, oppScore, opponent, delta, didWin }

import { classifyWin, winPoints } from './rules';
import { P1 } from './logic';

export function gameEndResult({ gs, winner, isOnline, isAI, playerSlot, opponentName }) {
  if (!winner) return null;
  if (!isOnline && !isAI) return null; // local 2P: which side is "the nick"? ambiguous.

  const mySlot = isOnline ? playerSlot : P1; // vs-AI: the human is P1
  const didWin = winner === mySlot;
  const cubeValue = gs.cube?.value || 1;
  const concession = gs.endReason === 'decline' || gs.endReason === 'forfeit';
  const winType = concession ? 'simple' : classifyWin(gs, winner);
  const points = winPoints(winType) * cubeValue;

  return {
    youScore: didWin ? points : 0,
    oppScore: didWin ? 0 : points,
    opponent: opponentName || (isAI ? 'AI' : 'Opponent'),
    delta: didWin ? points : -points,
    didWin,
  };
}
