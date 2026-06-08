// Static two-die renderer for the active player's settled roll, ported from
// devanture/dice.js (PIP_LAYOUTS + getDiePos + drawStaticPips) with globals
// parameterized over (p, g, C). The ball-physics roll ANIMATION is deferred to
// 8.5; here we render the settled faces only.
//
// Used-die fade reimplements devanture's isDieFaded over the engine shape: a
// die is "used" when its value is no longer in gs.moves (doubles use a played
// count). Reads gs.dice (the full roll) + gs.moves — NOT the snapshot.

// value(1..6) -> normalized pip centres in the die square. Copied verbatim.
export const PIP_LAYOUTS = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.3], [0.7, 0.7]],
  3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.50], [0.72, 0.50], [0.28, 0.75], [0.72, 0.75]],
};

const BALL_R_N = 0.064;
const CLIP_INSET_N = 0.04;

// Top-left of die `dieIdx` (0|1) for `player` ('white'|'black'). die side = 3.5r.
// Portrait: a row below (white) / above (black) the board. Landscape: a vertical
// column to the left of the board.
export function getDiePos(g, player, dieIdx) {
  const ds = 3.5 * g.r;
  if (g.diceOnSide) {
    const cx = g.bx - 2.75 * g.r;
    const x = cx - ds / 2;
    const cellH = ds + g.r;
    const yBase = g.by + 13 * g.a - ds;
    const cell = player === 'white' ? (dieIdx === 1 ? 0 : 1) : (dieIdx === 1 ? 5 : 4);
    return { x, y: yBase - cell * cellH };
  }
  const x = g.bx + dieIdx * (ds + g.r * 0.5);
  return player === 'white'
    ? { x, y: g.by + 13 * g.a + g.r * 1.6 }
    : { x, y: g.by - ds - g.r * 1.6 };
}

function drawDie(p, g, C, pos, value, squareAlpha, pipsAlpha) {
  const ds = 3.5 * g.r;
  const ballR = ds * BALL_R_N;
  const inset = ds * CLIP_INSET_N;
  const bA = Math.round(p.alpha(C.board) * squareAlpha);
  const sA = Math.round(p.alpha(C.ivory) * squareAlpha);
  p.fill(p.red(C.board), p.green(C.board), p.blue(C.board), bA);
  p.stroke(p.red(C.ivory), p.green(C.ivory), p.blue(C.ivory), sA);
  p.strokeWeight(1.5);
  p.rect(pos.x, pos.y, ds, ds);
  if (pipsAlpha <= 0 || value == null) return;
  const pips = PIP_LAYOUTS[value];
  if (!pips) return;
  const ctx = p.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(pos.x + inset, pos.y + inset, ds - 2 * inset, ds - 2 * inset);
  ctx.clip();
  ctx.fillStyle = `rgba(245,240,218,${pipsAlpha})`; // hardcoded ivory (matches source)
  for (const [nx, ny] of pips) {
    ctx.beginPath();
    ctx.arc(pos.x + nx * ds, pos.y + ny * ds, ballR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Derive the displayed faces + per-die used flags from the engine state.
export function diceFromGameState(gs) {
  const owner = gs.turn === 1 ? 'white' : 'black';
  const dice = gs.dice || [];
  const isDouble = dice.length === 4;
  const values = isDouble ? [dice[0], dice[0]] : [dice[0], dice[1]];
  const remaining = gs.moves || [];
  const used = [false, false];
  if (dice.length) {
    if (isDouble) {
      const played = 4 - remaining.length;
      used[0] = played >= 2;
      used[1] = played >= 4;
    } else {
      used[0] = !remaining.includes(values[0]);
      used[1] = !remaining.includes(values[1]);
    }
  }
  return { owner, values, used };
}

// Render the active player's two settled dice. Used die => 50% square + pips.
export function drawDice(p, g, C, gs) {
  if (!gs || !gs.dice || gs.dice.length === 0) return;
  const { owner, values, used } = diceFromGameState(gs);
  for (let i = 0; i < 2; i++) {
    if (values[i] == null) continue;
    const pos = getDiePos(g, owner, i);
    const sq = used[i] ? 0.5 : 1;
    drawDie(p, g, C, pos, values[i], sq, sq);
  }
}
