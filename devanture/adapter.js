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
  const pl  = gs.turn;   // 1, 2, ou 0 (opening)

  // Points
  for (let i = 0; i < 24; i++) {
    const { n, p } = gs.pts[i];
    mockState.points[i + 1] = n === 0 ? 0 : (p === 1 ? n : -n);
  }
  mockState.points[0] = 0;   // unused slot

  // Bar / Off
  mockState.bar.white = gs.bar[1];
  mockState.bar.black = gs.bar[2];
  mockState.off.white = gs.off[1];
  mockState.off.black = gs.off[2];

  // Tour
  mockState.turn = pl === 1 ? 'white' : 'black';

  // Dés : valeurs uniques restantes pour le rendu
  mockState.dice = [...new Set(gs.moves)];

  // Phase
  mockState.phase = (pl > 0 && Logic.allHome(gs, pl)) ? 'bearingOff' : 'normal';
}

// ── Appliquer un mouvement réel ───────────────────────────────────────────────
// fromPt : 1-24 ou 'bar'   toPt : 1-24 ou 0 (bearing off)
function applyRealMove(fromPt, toPt) {
  if (!gameState) return false;
  const pl      = gameState.turn;
  const fromIdx = fromPt === 'bar' ? 'bar' : fromPt - 1;
  const toIdx   = toPt   === 0    ? 'off' : toPt - 1;

  const validMoves = Logic.getValidMoves(gameState, pl);
  const move = validMoves.find(m => m.f === fromIdx && m.t === toIdx);
  if (!move) return false;

  gameState = Logic.applyMove(gameState, pl, move);

  // Vérifier victoire
  const winner = Logic.checkWin(gameState);
  if (winner) {
    console.log('Gagnant :', winner === 1 ? 'Blanc' : 'Noir');
  }

  // Si plus de coups → fin de tour automatique
  if (gameState.moves.length === 0) {
    setTimeout(endTurn, 400);
  }

  syncMockState();
  return true;
}

// ── Destinations valides pour le rendu (remplace getValidTargets) ─────────────
function getRealTargets(fromPt) {
  if (!gameState) return [];
  const pl      = gameState.turn;
  const fromIdx = fromPt === 'bar' ? 'bar' : fromPt - 1;
  return Logic.getValidMoves(gameState, pl)
    .filter(m => m.f === fromIdx)
    .map(m => m.t === 'off' ? 0 : m.t + 1);
}

// ── Fin de tour → lancer les dés adversaire ───────────────────────────────────
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
}

// ── Démarrer une vraie partie ─────────────────────────────────────────────────
function startGame() {
  gameState  = Logic.newGameState();
  gameMode   = true;
  const rolls    = Logic.rollOpeningDice();
  const resolved = Logic.resolveOpening(rolls);
  Object.assign(gameState, resolved);
  syncMockState();
  clearDice();
  startRoll(resolved.dice, resolved.turn === 1 ? 'white' : 'black');
}

// ── Relancer les dés (clic sur la zone dés en mode jeu) ───────────────────────
function rollRealDice() {
  if (!gameState) return;
  // En mode jeu, les dés sont lancés automatiquement au changement de tour.
  // Ce bouton relance si les moves sont déjà vides (après animation).
  if (gameState.moves.length === 0 && gameState.phase === 'move') {
    endTurn();
  }
}
