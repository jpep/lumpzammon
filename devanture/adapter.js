// adapter.js – pont entre Logic (état jpep) et mockState (état de rendu)
// ─────────────────────────────────────────────────────────────────────────────
// Mapping index :  jpep index i  ↔  notre pt i+1  (pt 1-24)
//                  P1 (jpep) = white (skin, valeur positive)
//                  P2 (jpep) = black (skin, valeur négative)
// ─────────────────────────────────────────────────────────────────────────────

let gameState   = null;   // état réel (Logic)
let gameMode    = false;  // false = scénario mock, true = jeu réel

// ── Sync : met mockState à jour depuis gameState ──────────────────────────────
function syncMockState() {
  if (!gameState) return;
  const gs = gameState;
  const pl  = gs.turn;

  for (let i = 0; i < 24; i++) {
    const { n, p } = gs.pts[i];
    mockState.points[i + 1] = n === 0 ? 0 : (p === 1 ? n : -n);
  }
  mockState.points[0] = 0;

  mockState.bar.white = gs.bar[1];
  mockState.bar.black = gs.bar[2];
  mockState.off.white = gs.off[1];
  mockState.off.black = gs.off[2];

  mockState.turn  = pl === 1 ? 'white' : 'black';
  mockState.dice  = [...new Set(gs.moves)];
  mockState.phase = (pl > 0 && Logic.allHome(gs, pl)) ? 'bearingOff' : 'normal';
}

// ── Finaliser une étape de mouvement ─────────────────────────────────────────
function finalizeMoveStep() {
  const winner = Logic.checkWin(gameState);
  if (winner) console.log('Gagnant :', winner === 1 ? 'Blanc' : 'Noir');
  if (gameState.moves.length === 0) setTimeout(endTurn, 400);
  syncMockState();
}

// ── Appliquer un mouvement réel (simple ou combiné deux dés) ─────────────────
// fromPt : 1-24 ou 'bar'   toPt : 1-24 ou 0 (bearing off)
function applyRealMove(fromPt, toPt) {
  if (!gameState) return false;
  const pl      = gameState.turn;
  const fromIdx = fromPt === 'bar' ? 'bar' : fromPt - 1;
  const toIdx   = toPt   === 0    ? 'off' : toPt - 1;

  const moves = Logic.getValidMoves(gameState, pl);

  // Tentative mouvement simple (un dé)
  const single = moves.find(m => m.f === fromIdx && m.t === toIdx);
  if (single) {
    gameState = Logic.applyMove(gameState, pl, single);
    finalizeMoveStep();
    return true;
  }

  // Tentative mouvement combiné (deux dés en un seul drag)
  for (const m1 of moves.filter(m => m.f === fromIdx && m.t !== 'off')) {
    const gs1    = Logic.applyMove(gameState, pl, m1);
    const moves2 = Logic.getValidMoves(gs1, pl);
    const m2     = moves2.find(m => m.f === m1.t && m.t === toIdx);
    if (m2) {
      gameState = Logic.applyMove(gs1, pl, m2);
      finalizeMoveStep();
      return true;
    }
  }

  return false;
}

// ── Destinations valides (simples + combinées) ────────────────────────────────
function getRealTargets(fromPt) {
  if (!gameState) return [];
  const pl      = gameState.turn;
  const fromIdx = fromPt === 'bar' ? 'bar' : fromPt - 1;
  const moves   = Logic.getValidMoves(gameState, pl);
  const targets = [];

  // Destinations simples (un dé)
  for (const m of moves.filter(m => m.f === fromIdx)) {
    const dest = m.t === 'off' ? 0 : m.t + 1;
    if (!targets.includes(dest)) targets.push(dest);
  }

  // Destinations combinées (deux dés en un drag)
  for (const m1 of moves.filter(m => m.f === fromIdx && m.t !== 'off')) {
    const gs1    = Logic.applyMove(gameState, pl, m1);
    const moves2 = Logic.getValidMoves(gs1, pl);
    for (const m2 of moves2.filter(m => m.f === m1.t)) {
      const dest = m2.t === 'off' ? 0 : m2.t + 1;
      if (!targets.includes(dest)) targets.push(dest);
    }
  }

  return targets;
}

// ── Fin de tour → dés adversaire + détection pass ────────────────────────────
let _passCount = 0;   // sécurité anti-boucle infinie

function endTurn() {
  if (!gameState) return;
  const nextPl = gameState.turn === 1 ? 2 : 1;
  gameState.turn  = nextPl;
  const newDice   = Logic.rollDice();
  gameState.dice  = newDice;
  gameState.moves = [...newDice];
  syncMockState();
  clearDice();
  startRoll(newDice, nextPl === 1 ? 'white' : 'black');

  // Si aucun coup disponible (pièce sur la barre bloquée, etc.) → pass auto
  const vm = Logic.getValidMoves(gameState, nextPl);
  if (vm.length === 0 && _passCount < 2) {
    _passCount++;
    setTimeout(endTurn, 1500);   // affiche les dés 1.5s avant de passer
  } else {
    _passCount = 0;
  }
}

// ── Démarrer une vraie partie ─────────────────────────────────────────────────
function startGame() {
  gameState  = Logic.newGameState();
  gameMode   = true;
  _passCount = 0;

  mockState = {
    points:  new Array(25).fill(0),
    bar:     { white: 0, black: 0 },
    off:     { white: 0, black: 0 },
    turn:    'white',
    dice:    [],
    phase:   'normal',
    players: { white: 'WHITE', black: 'BLACK' },
    timers:  null,
  };

  const rolls    = Logic.rollOpeningDice();
  const resolved = Logic.resolveOpening(rolls);
  Object.assign(gameState, resolved);
  syncMockState();
  clearDice();
  startRoll(resolved.dice, resolved.turn === 1 ? 'white' : 'black');
}

// ── Relancer les dés manuellement ────────────────────────────────────────────
function rollRealDice() {
  if (!gameState) return;
  if (gameState.moves.length === 0 && gameState.phase === 'move') endTurn();
}
