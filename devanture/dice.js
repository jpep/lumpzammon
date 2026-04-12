// dice.js – Animation des dés
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 ROLLING  : 6 boules s'agitent librement (ROLL_FRAMES)
// Phase 2 SETTLING : toutes lerpent vers leurs pips assignés (SETTLE_FRAMES)
//                    Chaque pip est couvert au moins une fois ; les boules
//                    excédentaires partagent un pip aléatoire.
//                    À la fin du settling, les doublons sont désactivés.
// ─────────────────────────────────────────────────────────────────────────────

const DS = { EMPTY:'empty', ROLLING:'rolling', SETTLING:'settling', DONE:'done' };

const ROLL_FRAMES   = 24;
const SETTLE_FRAMES = 22;

const MAX_SPEED_N  = 0.095;
const PAD_N        = 0.18;
const BALL_R_N     = 0.064;
const CLIP_INSET_N = 0.04;

const PIP_LAYOUTS = {
  1: [[0.50, 0.50]],
  2: [[0.30, 0.30], [0.70, 0.70]],
  3: [[0.30, 0.30], [0.50, 0.50], [0.70, 0.70]],
  4: [[0.30, 0.30], [0.70, 0.30], [0.30, 0.70], [0.70, 0.70]],
  5: [[0.30, 0.30], [0.70, 0.30], [0.50, 0.50], [0.30, 0.70], [0.70, 0.70]],
  6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.50], [0.72, 0.50], [0.28, 0.75], [0.72, 0.75]],
};

let diceAnim = { state:DS.EMPTY, owner:'white', frame:0, values:[0,0], dice:[null,null] };

// ── Position des dés ──────────────────────────────────────────────────────────
function dieSize() { return 3 * r; }

function getDiePos(player, dieIdx) {
  const ds = dieSize();   // 3r = 1.5a

  if (diceOnSide) {
    // Dés à gauche — gap r/2 entre plateau et dé droit, gap r/2 entre les deux dés
    const xRight = bx - r/2;   // bord droit du dé 1 (gap r/2 depuis le plateau)
    const x = xRight - (2 - dieIdx) * ds - (1 - dieIdx) * r * 0.5;
    return player === 'white'
      ? { x, y: by + 13*a - ds }   // base basse alignée sur ligne inférieure du plateau
      : { x, y: by };              // base haute alignée sur ligne supérieure du plateau
  } else {
    // Dés au-dessus / en-dessous — alignés sur bx, gap r/2 entre dé et plateau
    const x = bx + dieIdx * (ds + r * 0.5);
    return player === 'white'
      ? { x, y: by + 13*a + r*1.6 }    // r*0.8 (bord→numéro) + r*0.8 (numéro→dé)
      : { x, y: by - ds - r*1.6 };     // symétrique en haut
  }
}

// ── Initialisation ────────────────────────────────────────────────────────────
function initDie(value) {
  const pips = PIP_LAYOUTS[value];
  const lo   = PAD_N + BALL_R_N, hi = 1 - PAD_N - BALL_R_N;

  // Mélanger les pips et les assigner aux 6 boules :
  // les 'value' premières couvrent chaque pip une fois, les restantes prennent un pip aléatoire.
  const shuffled = [...pips].sort(() => Math.random() - 0.5);

  const balls = [];
  for (let i = 0; i < 6; i++) {
    const pip = i < shuffled.length
      ? shuffled[i]
      : shuffled[Math.floor(Math.random() * shuffled.length)];
    balls.push({
      nx:  rnd(lo, hi),
      ny:  rnd(lo, hi),
      vnx: rnd(-MAX_SPEED_N, MAX_SPEED_N),
      vny: rnd(-MAX_SPEED_N, MAX_SPEED_N),
      tnx: pip[0],
      tny: pip[1],
      active: true,
    });
  }
  return { value, balls };
}

function rnd(a, b) { return a + Math.random() * (b - a); }

// ── Démarrage ─────────────────────────────────────────────────────────────────
function startRoll(values, player) {
  diceAnim = {
    state: DS.ROLLING, owner: player, frame: 0,
    values, dice: [initDie(values[0]), initDie(values[1])]
  };
}

// ── Update ────────────────────────────────────────────────────────────────────
function updateDiceAnim() {
  if (diceAnim.state === DS.EMPTY || diceAnim.state === DS.DONE) return;
  diceAnim.frame++;
  const f  = diceAnim.frame;
  const lo = PAD_N + BALL_R_N, hi = 1 - PAD_N - BALL_R_N;

  // Phase 1 : agitation libre
  if (diceAnim.state === DS.ROLLING) {
    for (const die of diceAnim.dice)
      for (const b of die.balls) bounceOne(b, lo, hi);
    if (f >= ROLL_FRAMES) diceAnim.state = DS.SETTLING;
    return;
  }

  // Phase 2 : lerp vers pip assigné
  if (diceAnim.state === DS.SETTLING) {
    const sf    = f - ROLL_FRAMES;
    const lerpF = 0.06 + (sf / SETTLE_FRAMES) * 0.14;
    for (const die of diceAnim.dice)
      for (const b of die.balls)
        if (b.active) {
          b.nx += (b.tnx - b.nx) * lerpF;
          b.ny += (b.tny - b.ny) * lerpF;
        }

    if (sf >= SETTLE_FRAMES) {
      // Dédoublonnage : garder une seule boule par pip
      for (const die of diceAnim.dice) {
        const seen = new Set();
        for (const b of die.balls) {
          const key = `${b.tnx},${b.tny}`;
          if (seen.has(key)) b.active = false;
          else seen.add(key);
        }
      }
      diceAnim.state = DS.DONE;
    }
  }
}

function bounceOne(b, lo, hi) {
  b.nx += b.vnx; b.ny += b.vny;
  if (b.nx < lo) { b.nx = lo; b.vnx =  Math.abs(b.vnx) + rnd(0, 0.01); }
  if (b.nx > hi) { b.nx = hi; b.vnx = -Math.abs(b.vnx) - rnd(0, 0.01); }
  if (b.ny < lo) { b.ny = lo; b.vny =  Math.abs(b.vny) + rnd(0, 0.01); }
  if (b.ny > hi) { b.ny = hi; b.vny = -Math.abs(b.vny) - rnd(0, 0.01); }
  b.vnx *= 0.97; b.vny *= 0.97;
  if (Math.abs(b.vnx) < 0.010) b.vnx += rnd(-0.015, 0.015);
  if (Math.abs(b.vny) < 0.010) b.vny += rnd(-0.015, 0.015);
  b.vnx = Math.max(-MAX_SPEED_N, Math.min(MAX_SPEED_N, b.vnx));
  b.vny = Math.max(-MAX_SPEED_N, Math.min(MAX_SPEED_N, b.vny));
}

// ── Dessin ────────────────────────────────────────────────────────────────────
function drawAllDice() {
  drawDiceForPlayer('white');
  drawDiceForPlayer('black');
}

function drawDiceForPlayer(player) {
  const ds    = dieSize();
  const ballR = ds * BALL_R_N;
  const inset = ds * CLIP_INSET_N;
  const show  = diceAnim.state !== DS.EMPTY && diceAnim.owner === player;

  for (let i = 0; i < 2; i++) {
    const pos = getDiePos(player, i);
    fill(C.board); stroke(C.ivory); strokeWeight(1.5);
    rect(pos.x, pos.y, ds, ds);

    if (!show || !diceAnim.dice[i]) continue;

    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(pos.x + inset, pos.y + inset, ds - 2*inset, ds - 2*inset);
    drawingContext.clip();
    drawingContext.fillStyle = 'rgba(245,240,218,1)';

    for (const b of diceAnim.dice[i].balls) {
      if (!b.active) continue;
      drawingContext.beginPath();
      drawingContext.arc(pos.x + b.nx * ds, pos.y + b.ny * ds, ballR, 0, Math.PI*2);
      drawingContext.fill();
    }

    drawingContext.restore();
    noFill(); stroke(C.ivory); strokeWeight(1.5);
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
function isClickOnDiceZone(px, py, player) {
  const ds = dieSize();
  for (let i = 0; i < 2; i++) {
    const p = getDiePos(player, i);
    if (px >= p.x && px <= p.x+ds && py >= p.y && py <= p.y+ds) return true;
  }
  return false;
}

function clearDice()   { diceAnim = { state:DS.EMPTY, owner:'white', frame:0, values:[0,0], dice:[null,null] }; }
function rescaleDice() {}
