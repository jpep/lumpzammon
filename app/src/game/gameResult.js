// Build the playerStats record for a finished game, from THIS device's identity.
//
// Returns null when there's no single clear identity to attribute the game to
// (local two-player on one device) or when there's no winner yet. Gammon /
// backgammon are scored via rules.js; the doubling-cube and resign multipliers
// are deferred to Phase 8.5d (no cube exists in the engine yet).
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
  const points = winPoints(classifyWin(gs, winner));

  return {
    youScore: didWin ? points : 0,
    oppScore: didWin ? 0 : points,
    opponent: opponentName || (isAI ? 'AI' : 'Opponent'),
    delta: didWin ? points : -points,
    didWin,
  };
}
