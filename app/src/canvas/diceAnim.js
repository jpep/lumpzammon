// Dice ROLL ANIMATION (Phase 8.5e), ported from devanture/dice.js.
//
//   ROLLING  (24 frames): each die's 6 balls bounce freely off the die walls.
//   SETTLING (22 frames): the balls lerp toward their assigned pip positions.
//   DONE                : duplicate balls are deactivated (one ball per pip) so a
//                         die of value N shows exactly N pips.
//
// 8.4 ported only the static settled faces; this is the live ball physics the
// user asked for (translucent dice that "shake" then settle). Placement differs
// from devanture (which sits the dice beside/below the board): the embedded
// square canvas has no off-board room, so the dice land ON the board in the
// roller's near quadrant — the way physical dice rest after a roll.
//
// One animator per p5 instance (state in closure; no module globals so two
// instances can't bleed). The physics uses Math.random — fine in app code.

import { PIP_LAYOUTS, diceFromGameState } from './dice';

const ROLL_FRAMES = 24;
const SETTLE_FRAMES = 22;
const MAX_SPEED_N = 0.095;
const PAD_N = 0.18;
const BALL_R_N = 0.064;
const CLIP_INSET_N = 0.04;

const rnd = (a, b) => a + Math.random() * (b - a);

function initDie(value) {
  const pips = PIP_LAYOUTS[value];
  if (!pips) return null;
  const lo = PAD_N + BALL_R_N;
  const hi = 1 - PAD_N - BALL_R_N;
  // value-first balls cover each pip once; the rest take a random pip.
  const shuffled = [...pips].sort(() => Math.random() - 0.5);
  const balls = [];
  for (let i = 0; i < 6; i++) {
    const pip = i < shuffled.length ? shuffled[i] : shuffled[Math.floor(Math.random() * shuffled.length)];
    balls.push({
      nx: rnd(lo, hi), ny: rnd(lo, hi),
      vnx: rnd(-MAX_SPEED_N, MAX_SPEED_N), vny: rnd(-MAX_SPEED_N, MAX_SPEED_N),
      tnx: pip[0], tny: pip[1], active: true,
    });
  }
  return { value, balls };
}

function bounceOne(b, lo, hi) {
  b.nx += b.vnx; b.ny += b.vny;
  if (b.nx < lo) { b.nx = lo; b.vnx = Math.abs(b.vnx) + rnd(0, 0.01); }
  if (b.nx > hi) { b.nx = hi; b.vnx = -Math.abs(b.vnx) - rnd(0, 0.01); }
  if (b.ny < lo) { b.ny = lo; b.vny = Math.abs(b.vny) + rnd(0, 0.01); }
  if (b.ny > hi) { b.ny = hi; b.vny = -Math.abs(b.vny) - rnd(0, 0.01); }
  b.vnx *= 0.97; b.vny *= 0.97;
  if (Math.abs(b.vnx) < 0.010) b.vnx += rnd(-0.015, 0.015);
  if (Math.abs(b.vny) < 0.010) b.vny += rnd(-0.015, 0.015);
  b.vnx = Math.max(-MAX_SPEED_N, Math.min(MAX_SPEED_N, b.vnx));
  b.vny = Math.max(-MAX_SPEED_N, Math.min(MAX_SPEED_N, b.vny));
}

// Keep one ball per pip, snapped exactly onto it (kills the residual blob).
function dedupe(die) {
  const seen = new Set();
  for (const b of die.balls) {
    const key = `${b.tnx},${b.tny}`;
    if (seen.has(key)) { b.active = false; }
    else { b.nx = b.tnx; b.ny = b.tny; seen.add(key); }
  }
}

// Top-left of die `dieIdx` (0|1), centred as a pair in the roller's near
// quadrant (bottom for the near player, top for the far one). direction=1
// (online P2 perspective) flips which colour is "near".
function diePos(g, owner, dieIdx, direction, ds) {
  const nearColor = direction === 1 ? 'black' : 'white';
  const bottomForOwner = owner === nearColor;
  const gap = 0.5 * g.r;
  const pairW = 2 * ds + gap;
  const centerX = g.bx + 9.75 * g.a;                 // right-half centre
  const x = centerX - pairW / 2 + dieIdx * (ds + gap);
  const centerY = bottomForOwner ? g.by + 9.5 * g.a : g.by + 3.5 * g.a;
  return { x, y: centerY - ds / 2 };
}

export function createDiceAnimator() {
  let state = 'empty'; // 'empty' | 'rolling' | 'settling' | 'done'
  let owner = 'white';
  let frame = 0;
  let dice = [null, null];

  function start(values, own) {
    state = 'rolling';
    owner = own;
    frame = 0;
    dice = [initDie(values[0]), initDie(values[1])];
  }

  // Jump straight to settled faces (reconnect / no-animation path).
  function setFinal(values, own) {
    start(values, own);
    state = 'done';
    frame = ROLL_FRAMES + SETTLE_FRAMES;
    for (const die of dice) { if (die) { for (const b of die.balls) { b.nx = b.tnx; b.ny = b.tny; } dedupe(die); } }
  }

  function clear() { state = 'empty'; owner = 'white'; frame = 0; dice = [null, null]; }
  function isAnimating() { return state === 'rolling' || state === 'settling'; }

  function update() {
    if (state === 'empty' || state === 'done') return;
    frame++;
    const lo = PAD_N + BALL_R_N;
    const hi = 1 - PAD_N - BALL_R_N;
    if (state === 'rolling') {
      for (const die of dice) { if (die) for (const b of die.balls) bounceOne(b, lo, hi); }
      if (frame >= ROLL_FRAMES) state = 'settling';
      return;
    }
    // settling
    const sf = frame - ROLL_FRAMES;
    const lerpF = 0.06 + (sf / SETTLE_FRAMES) * 0.14;
    for (const die of dice) {
      if (!die) continue;
      for (const b of die.balls) {
        if (b.active) { b.nx += (b.tnx - b.nx) * lerpF; b.ny += (b.tny - b.ny) * lerpF; }
      }
    }
    if (sf >= SETTLE_FRAMES) { for (const die of dice) { if (die) dedupe(die); } state = 'done'; }
  }

  function draw(p, g, C, gs, direction = 0) {
    if (state === 'empty' || !gs) return;
    const { used } = diceFromGameState(gs);
    const ds = 2.4 * g.r;
    const ballR = ds * BALL_R_N;
    const inset = ds * CLIP_INSET_N;
    for (let i = 0; i < 2; i++) {
      const die = dice[i];
      if (!die) continue;
      const pos = diePos(g, owner, i, direction, ds);
      const faded = state === 'done' && used[i]; // dim a spent die (memory)
      const sqA = faded ? 0.5 : 1;
      // The die body: a slightly translucent dark square resting on the board,
      // with an ivory border + ivory pips (reads clearly over the triangles).
      p.fill(20, 18, 16, Math.round(205 * sqA));
      p.stroke(p.red(C.ivory), p.green(C.ivory), p.blue(C.ivory), Math.round(255 * sqA));
      p.strokeWeight(1.5);
      p.rect(pos.x, pos.y, ds, ds);
      const ctx = p.drawingContext;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pos.x + inset, pos.y + inset, ds - 2 * inset, ds - 2 * inset);
      ctx.clip();
      ctx.fillStyle = `rgba(245,240,218,${faded ? 0.5 : 1})`;
      for (const b of die.balls) {
        if (!b.active) continue;
        ctx.beginPath();
        ctx.arc(pos.x + b.nx * ds, pos.y + b.ny * ds, ballR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  return { start, setFinal, clear, isAnimating, update, draw };
}
