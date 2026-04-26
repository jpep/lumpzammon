// adapter.js – pont entre Logic (état jpep) et mockState (état de rendu)
// ─────────────────────────────────────────────────────────────────────────────
// Mapping index :  jpep index i  ↔  notre pt i+1  (pt 1-24)
//                  P1 (jpep) = white (skin, valeur positive)
//                  P2 (jpep) = black (skin, valeur négative)
// ─────────────────────────────────────────────────────────────────────────────

let gameState   = null;   // état réel (Logic)
let gameMode    = false;  // false = scénario mock, true = jeu réel
let gameWinner  = 0;      // 0 = en cours, 1 = blanc, 2 = noir
let gameWinType = '';     // 'simple' | 'gammon' | 'backgammon' | 'resign'
let gameScore   = { white: 0, black: 0 };  // points cumulés sur la session

// R7 doubling cube
let cubeValue    = 1;     // 1, 2 ou 4
let cubePromised = null;  // 'white'|'black' = qui a promis d'offrir au prochain tour, ou null
let modalState   = null;  // null | { type:'offer'|'accept', player }

// Timers (jeu réel) : move = 15s par coup, game = 119s total par joueur
let timerState = {
  white:    { game: 119 },
  black:    { game: 119 },
  moveLeft: 15,
  active:   'move',   // 'move' | 'game'
};
let _timerInterval = null;

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

// ── Type de victoire : simple (1) | gammon (2) | backgammon (3) ──────────────
function classifyWin(state, winner) {
  const loser = winner === 1 ? 2 : 1;
  if (state.off[loser] > 0) return 'simple';
  // Perdant n'a sorti aucune fiche → au moins gammon
  // Backgammon si perdant a une fiche sur la barre OU dans le home du gagnant
  if (state.bar[loser] > 0) return 'backgammon';
  const [lo, hi] = winner === 1 ? [0, 5] : [18, 23];
  for (let i = lo; i <= hi; i++) {
    if (state.pts[i].p === loser && state.pts[i].n > 0) return 'backgammon';
  }
  return 'gammon';
}

function winPoints(type) {
  return type === 'backgammon' ? 3 : type === 'gammon' ? 2 : 1;
}

// ── Finaliser une étape de mouvement ─────────────────────────────────────────
function finalizeMoveStep() {
  const winner = Logic.checkWin(gameState);
  if (winner) {
    gameWinner  = winner;
    gameWinType = classifyWin(gameState, winner);
    const key   = winner === 1 ? 'white' : 'black';
    gameScore[key] += winPoints(gameWinType) * cubeValue;
    syncMockState();
    return;   // partie terminée, ne pas enchaîner
  }
  if (gameState.moves.length === 0) {
    setTimeout(endTurn, 400);
  } else {
    // Des dés restent mais peut-être aucun coup jouable (barre bloquée, etc.)
    const vm = Logic.getValidMoves(gameState, gameState.turn);
    if (vm.length === 0) setTimeout(endTurn, 400);
  }
  syncMockState();
}

// ── Recherche récursive d'une séquence depuis fromIdx vers toIdx ─────────────
// Explore jusqu'à `depth` dés combinés (1 à 4 selon ce qui reste à jouer).
function findMoveSequence(state, pl, fromIdx, toIdx, depth) {
  if (depth <= 0 || state.moves.length === 0) return null;
  const moves = Logic.getValidMoves(state, pl);
  for (const m of moves.filter(mv => mv.f === fromIdx)) {
    if (m.t === toIdx) {
      return { seq: [m], state: Logic.applyMove(state, pl, m) };
    }
  }
  for (const m of moves.filter(mv => mv.f === fromIdx && mv.t !== 'off')) {
    const ns  = Logic.applyMove(state, pl, m);
    const sub = findMoveSequence(ns, pl, m.t, toIdx, depth - 1);
    if (sub) return { seq: [m, ...sub.seq], state: sub.state };
  }
  return null;
}

// ── Appliquer un mouvement réel (1 à 4 dés combinés) ─────────────────────────
// fromPt : 1-24 ou 'bar'   toPt : 1-24 ou 0 (bearing off)
function applyRealMove(fromPt, toPt) {
  if (!gameState) return false;
  const pl      = gameState.turn;
  const fromIdx = fromPt === 'bar' ? 'bar' : fromPt - 1;
  const toIdx   = toPt   === 0    ? 'off' : toPt - 1;

  const found = findMoveSequence(gameState, pl, fromIdx, toIdx, gameState.moves.length);
  if (!found) return false;
  gameState = found.state;
  finalizeMoveStep();
  return true;
}

// ── Multi-pickup (doubles) : applique N séquences de k dés chacune ───────────
// k = floor(dés_restants / N) — autorise multi-sauts par fiche (ex: double 1-1 + 2 fiches = k=2)
function applyMultipleMoves(fromPt, toPt, count) {
  if (!gameState || count < 1) return 0;
  const pl      = gameState.turn;
  const fromIdx = fromPt === 'bar' ? 'bar' : fromPt - 1;
  const toIdx   = toPt   === 0    ? 'off' : toPt - 1;
  const k = Math.max(1, Math.floor(gameState.moves.length / count));
  let applied = 0;
  for (let i = 0; i < count; i++) {
    const found = findMoveSequence(gameState, pl, fromIdx, toIdx, k);
    if (!found) break;
    gameState = found.state;
    applied++;
  }
  if (applied > 0) finalizeMoveStep();
  return applied;
}

// ── Destinations valides (1 à 4 dés combinés) ────────────────────────────────
function collectTargets(state, pl, fromIdx, depth, targets) {
  if (depth <= 0 || state.moves.length === 0) return;
  const moves = Logic.getValidMoves(state, pl);
  for (const m of moves.filter(mv => mv.f === fromIdx)) {
    const dest = m.t === 'off' ? 0 : m.t + 1;
    if (!targets.includes(dest)) targets.push(dest);
    if (m.t !== 'off') {
      const ns = Logic.applyMove(state, pl, m);
      collectTargets(ns, pl, m.t, depth - 1, targets);
    }
  }
}

function getRealTargets(fromPt) {
  if (!gameState) return [];
  const pl      = gameState.turn;
  const fromIdx = fromPt === 'bar' ? 'bar' : fromPt - 1;
  const targets = [];
  // Multi-pickup : k dés par fiche autorisés (k = floor(dés_restants / N))
  const isMulti = (typeof drag !== 'undefined') && drag.active && (drag.numPieces || 1) > 1;
  const N       = isMulti ? drag.numPieces : 1;
  const depth   = isMulti
    ? Math.max(1, Math.floor(gameState.moves.length / N))
    : gameState.moves.length;
  collectTargets(gameState, pl, fromIdx, depth, targets);
  return targets;
}

// ── Fin de tour → dés adversaire + détection pass ────────────────────────────
let _passCount = 0;   // sécurité anti-boucle infinie
let noMovesNotice = { active: false, owner: null };

// ── Timers ───────────────────────────────────────────────────────────────────
function resetTimers() {
  timerState = {
    white:    { game: 119 },
    black:    { game: 119 },
    moveLeft: 15,
    active:   'move',
  };
  stopTurnTimer();
}

function startTurnTimer() {
  if (!gameMode || gameWinner) return;
  timerState.moveLeft = 15;
  timerState.active   = 'move';
  if (!_timerInterval) _timerInterval = setInterval(tickTimer, 1000);
}

function stopTurnTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

function tickTimer() {
  if (!gameMode || gameWinner) { stopTurnTimer(); return; }
  if (modalState) return;   // pause pendant un modal
  if (noMovesNotice && noMovesNotice.active) return;   // pause pendant fade pass
  // Pause tant que les dés ne sont pas posés (entre-tours, animation roll/settle)
  if (typeof diceAnim !== 'undefined' && diceAnim.state !== DS.DONE) return;
  const turn = mockState.turn;
  if (timerState.active === 'move') {
    timerState.moveLeft--;
    if (timerState.moveLeft <= 0) {
      timerState.moveLeft = 0;
      timerState.active   = 'game';
    }
  } else {
    timerState[turn].game--;
    if (timerState[turn].game <= 0) {
      timerState[turn].game = 0;
      stopTurnTimer();
      // Forfait : adversaire gagne (simple × cubeValue)
      const winner = turn === 'white' ? 2 : 1;
      gameWinner   = winner;
      gameWinType  = 'simple';
      gameScore[winner === 1 ? 'white' : 'black'] += cubeValue;
      cubePromised = null;
    }
  }
}

function endTurn() {
  if (!gameState || gameWinner) return;
  const nextPl = gameState.turn === 1 ? 2 : 1;
  gameState.turn  = nextPl;
  noMovesNotice   = { active: false, owner: null };
  syncMockState();

  const turnColor = nextPl === 1 ? 'white' : 'black';
  // R7 : si le joueur courant avait promis un double → modal AVANT lancer
  if (cubePromised === turnColor && cubeValue < 4) {
    modalState = { type: 'offer', player: turnColor };
    startTurnTimer();   // démarre le timer même en attente de décision
    return;
  }
  rollAndStart(nextPl);
}

function rollAndStart(nextPl) {
  const newDice   = Logic.rollDice();
  gameState.dice  = newDice;
  gameState.moves = [...newDice];
  syncMockState();
  clearDice();
  startRoll(newDice, nextPl === 1 ? 'white' : 'black');
  startTurnTimer();

  // Si aucun coup disponible → afficher dés vides + transparents puis pass
  const vm = Logic.getValidMoves(gameState, nextPl);
  if (vm.length === 0 && _passCount < 2) {
    _passCount++;
    const ownerName = nextPl === 1 ? 'white' : 'black';
    noMovesNotice = { active: true, owner: ownerName };
    setTimeout(() => {
      noMovesNotice = { active: false, owner: null };
      endTurn();
    }, 1200);
  } else {
    _passCount = 0;
  }
}

// ── R6 : abandon (toujours simple × cubeValue) ───────────────────────────────
function resign(player) {
  if (!gameMode || gameWinner || modalState) return;
  const winner = player === 'white' ? 2 : 1;
  gameWinner   = winner;
  gameWinType  = 'resign';
  const key    = winner === 1 ? 'white' : 'black';
  gameScore[key] += cubeValue;   // abandon = 1 × cubeValue, peu importe l'état du plateau
  cubePromised = null;
}

// ── R7 : doubling cube actions ────────────────────────────────────────────────
function clickCube(player) {
  if (!gameMode || gameWinner || modalState) return;
  if (cubeValue >= 4) return;
  if (cubePromised) return;
  if (mockState.turn !== player) return;
  cubePromised = player;
}

function modalOfferResponse(accept) {
  if (!modalState || modalState.type !== 'offer') return;
  const offerer = modalState.player;
  if (accept) {
    const opponent = offerer === 'white' ? 'black' : 'white';
    modalState = { type: 'accept', player: opponent, offerer };
  } else {
    cubePromised = null;
    modalState   = null;
    rollAndStart(offerer === 'white' ? 1 : 2);
  }
}

function modalAcceptResponse(accept) {
  if (!modalState || modalState.type !== 'accept') return;
  const offerer = modalState.offerer;
  if (accept) {
    cubeValue    = Math.min(cubeValue * 2, 4);
    cubePromised = null;
    modalState   = null;
    rollAndStart(offerer === 'white' ? 1 : 2);
  } else {
    // Refus → offrant gagne cubeValue (avant le doublement) en simple
    gameWinner   = offerer === 'white' ? 1 : 2;
    gameWinType  = 'simple';
    gameScore[offerer] += cubeValue;
    modalState   = null;
    cubePromised = null;
  }
}

// ── Démarrer une vraie partie ─────────────────────────────────────────────────
function startGame() {
  gameState    = Logic.newGameState();
  gameMode     = true;
  _passCount   = 0;
  gameWinner   = 0;
  gameWinType  = '';
  cubeValue    = 1;
  cubePromised = null;
  modalState   = null;
  resetTimers();

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
  startTurnTimer();
}

// ── Relancer les dés manuellement ────────────────────────────────────────────
function rollRealDice() {
  if (!gameState) return;
  if (gameState.moves.length === 0 && gameState.phase === 'move') endTurn();
}

// ── Scénario de test [6] : entrée depuis la barre, un dé bloqué ──────────────
// Blanc sur la barre, dés [3, 4]
// Pt 22 (idx 21) libre  → entrée avec dé 3 possible
// Pt 21 (idx 20) bloqué par 2 noires → entrée avec dé 4 impossible
// Attendu : après l'entrée avec le 3, le dé 4 passe automatiquement
function startBarEntryTest() {
  gameState    = Logic.newGameState();
  gameMode     = true;
  _passCount   = 0;
  gameWinner   = 0;
  gameWinType  = '';
  cubeValue    = 1;
  cubePromised = null;
  modalState   = null;
  resetTimers();

  // Vider le plateau
  for (let i = 0; i < 24; i++) gameState.pts[i] = { n: 0, p: 0 };
  gameState.bar = { 1: 0, 2: 0 };
  gameState.off = { 1: 0, 2: 0 };

  // Quelques pièces pour contextualiser
  gameState.pts[0]  = { n: 2, p: 2 };  // pt  1 : 2 noires (coin)
  gameState.pts[5]  = { n: 3, p: 1 };  // pt  6 : 3 blanches
  gameState.pts[11] = { n: 2, p: 2 };  // pt 12 : 2 noires
  gameState.pts[18] = { n: 3, p: 2 };  // pt 19 : 3 noires (home)
  // Case bloquée : pt 21 (jpep idx 20) → 2 noires bloquent le dé 4
  gameState.pts[20] = { n: 2, p: 2 };
  // Case libre  : pt 22 (jpep idx 21) → entrée avec dé 3 possible

  gameState.bar[1] = 1;   // 1 fiche blanche sur la barre
  gameState.turn   = 1;
  gameState.dice   = [3, 4];
  gameState.moves  = [3, 4];

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

  syncMockState();
  clearDice();
  startRoll([3, 4], 'white');
  startTurnTimer();
}
