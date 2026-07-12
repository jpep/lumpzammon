// adapter.js – pont entre Logic (état jpep) et mockState (état de rendu)
// ─────────────────────────────────────────────────────────────────────────────
// Mapping index :  jpep index i  ↔  notre pt i+1  (pt 1-24)
//                  P1 (jpep) = white (skin, valeur positive)
//                  P2 (jpep) = black (skin, valeur négative)
// ─────────────────────────────────────────────────────────────────────────────

let gameState   = null;   // état réel (Logic)
let gameMode    = false;  // false = scénario mock, true = jeu réel
let aiMode      = false;  // true = l'IA joue black (P2)
let gameWinner  = 0;      // 0 = en cours, 1 = blanc, 2 = noir
let gameWinType = '';     // 'simple' | 'gammon' | 'backgammon' | 'resign'
let gameScore   = { white: 0, black: 0 };  // points cumulés du MATCH en cours
// Match joué en 5 POINTS (cube/gammon inclus), PAS en 5 parties. Au-delà, l'IA
// ne propose plus de revanche.
const MATCH_TARGET = 5;
function matchOver() { return gameScore.white >= MATCH_TARGET || gameScore.black >= MATCH_TARGET; }

// Opening roll visualisé : { white: vDice1, black: vDice2, winner: 1|2 } pendant la phase d'intro
let openingResult = null;
// Dés statiques affichés pendant l'opening (pour garder visibles ceux qui ne roulent pas)
let openingDisplay = { white: 0, black: 0 };
// Transition fade entre opening et démarrage du jeu : { winner, loser, winnerValue, loserValue, t0, dur }
let openingTransition = null;
// Vrai pendant toute la séquence d'opening (de Phase A jusqu'à fin Phase D')
let openingActive = false;
// Vrai dès qu'un joueur a possédé les dés au moins une fois (= a joué un tour)
// Tant que false, ses carrés ne sont pas dessinés (même pas en transparence)
let hasOwnedDice = { white: false, black: false };

// R7 doubling cube
// Variante du jeu : chaque joueur peut doubler UNE seule fois par partie.
// La valeur cubeValue est partagée (1 → 2 → 4) ; cubeUsed mémorise qui a déjà
// utilisé son double. Les deux indicateurs affichent la même valeur, mais
// celui qui a déjà doublé passe à 50 % d'opacité.
let cubeValue    = 1;     // 1, 2 ou 4
let cubePromised = null;  // 'white'|'black' = qui a promis d'offrir au prochain tour, ou null
let cubeOwner    = null;  // null (aucun, début de partie) | 'white' | 'black' = qui possède le cube
let cubeUsed     = { white: false, black: false };  // qui a consommé son double
let modalState   = null;  // null | { type:'offer'|'accept', player }

// Timers (jeu réel) : move = 15s par coup, game = 119s total par joueur
let timerState = {
  white:    { game: 119 },
  black:    { game: 119 },
  moveLeft: 15,
  active:   'move',   // 'move' | 'game'
};
let _timerInterval = null;

// ── Profils joueurs (mock) ───────────────────────────────────────────────────
// Données affichées dans l'overlay profil (clic sur un nom de joueur).
// Le rang est dérivé du nombre total de parties via rankFromGames().
const PLAYER_PROFILES = {
  white: {
    winPercent: 0.62,
    totalGames: 234,
    firstPlay:  '2024-03-15',
    // Adversaires variés : un panel réaliste (pas la même personne tout le temps)
    recentGames: [
      // < 24h → tableau affichera HH:MM
      { youScore: 4, oppScore: 2, opponent: 'NIA',     delta:  +2, playedAt: '2026-04-28T14:23:00' },
      { youScore: 1, oppScore: 2, opponent: 'KAI',     delta:  -1, playedAt: '2026-04-28T10:15:00' },
      { youScore: 8, oppScore: 4, opponent: 'OMAR',    delta:  +4, playedAt: '2026-04-27T22:30:00' },
      // > 24h → AA/MM/JJ
      { youScore: 3, oppScore: 5, opponent: 'LUNA',    delta:  -2, playedAt: '2026-04-25T18:00:00' },
      { youScore: 5, oppScore: 4, opponent: 'ROCCO',   delta:  +1, playedAt: '2026-04-22T09:45:00' },
      { youScore: 2, oppScore: 3, opponent: 'PRIYA',   delta:  -1, playedAt: '2026-04-18T16:12:00' },
      { youScore: 7, oppScore: 4, opponent: 'KENJI',   delta:  +3, playedAt: '2026-04-12T20:40:00' },
      { youScore: 0, oppScore: 1, opponent: 'MIRA',    delta:  -1, playedAt: '2026-04-05T11:30:00' },
      { youScore: 6, oppScore: 5, opponent: 'TOMAS',   delta:  +1, playedAt: '2026-03-28T19:00:00' },
      { youScore: 2, oppScore: 4, opponent: 'AKIRA',   delta:  -2, playedAt: '2026-03-19T13:25:00' },
      { youScore: 9, oppScore: 5, opponent: 'NEFFA',   delta:  +4, playedAt: '2026-03-08T17:50:00' },
      { youScore: 1, oppScore: 3, opponent: 'OREN',    delta:  -2, playedAt: '2026-02-25T08:15:00' },
      { youScore: 5, oppScore: 5, opponent: 'CIRO',    delta:  +1, playedAt: '2026-02-12T22:00:00' },
      { youScore: 3, oppScore: 4, opponent: 'YUNA',    delta:  -1, playedAt: '2026-01-30T14:40:00' },
      { youScore: 8, oppScore: 4, opponent: 'BRUNO',   delta:  +4, playedAt: '2026-01-15T16:00:00' },
      { youScore: 4, oppScore: 6, opponent: 'IRINA',   delta:  -2, playedAt: '2025-12-29T20:30:00' },
      { youScore: 7, oppScore: 5, opponent: 'DARIO',   delta:  +2, playedAt: '2025-12-10T11:55:00' },
    ],
    // Historique du score (Y) en fonction du temps (X = date ISO).
    // X0 = firstPlay, X_max = aujourd'hui ; Y_max = 1000 (réf affichage).
    scoreHistory: [
      { date: '2024-03-15', score:   0 },
      { date: '2024-04-20', score:  40 },
      { date: '2024-05-30', score:  80 },
      { date: '2024-07-10', score: 150 },
      { date: '2024-08-22', score: 130 },
      { date: '2024-10-05', score: 230 },
      { date: '2024-11-18', score: 290 },
      { date: '2025-01-04', score: 340 },
      { date: '2025-02-19', score: 320 },
      { date: '2025-04-12', score: 410 },
      { date: '2025-06-25', score: 470 },
      { date: '2025-09-08', score: 530 },
      { date: '2025-12-15', score: 510 },
      { date: '2026-02-28', score: 590 },
      { date: '2026-04-26', score: 620 },
    ],
  },
  black: {
    winPercent: 0.71,
    totalGames: 1456,
    firstPlay:  '2022-11-08',
    recentGames: [
      { youScore: 8, oppScore: 4, opponent: 'AKEMI',   delta:  +4, playedAt: '2026-04-28T13:50:00' },
      { youScore: 5, oppScore: 3, opponent: 'JAVIER',  delta:  +2, playedAt: '2026-04-27T23:10:00' },
      { youScore: 1, oppScore: 4, opponent: 'AURELIE', delta:  -3, playedAt: '2026-04-26T15:30:00' },
      { youScore: 6, oppScore: 4, opponent: 'TARO',    delta:  +2, playedAt: '2026-04-23T19:20:00' },
      { youScore: 2, oppScore: 3, opponent: 'INDRA',   delta:  -1, playedAt: '2026-04-19T10:00:00' },
      { youScore: 4, oppScore: 3, opponent: 'YANA',    delta:  +1, playedAt: '2026-04-14T16:45:00' },
      { youScore: 7, oppScore: 5, opponent: 'NORA',    delta:  +2, playedAt: '2026-04-08T22:15:00' },
      { youScore: 3, oppScore: 4, opponent: 'KENJI',   delta:  -1, playedAt: '2026-04-02T18:00:00' },
      { youScore: 5, oppScore: 6, opponent: 'IGOR',    delta:  -1, playedAt: '2026-03-25T11:30:00' },
      { youScore: 8, oppScore: 4, opponent: 'SOFIA',   delta:  +4, playedAt: '2026-03-18T20:50:00' },
      { youScore: 2, oppScore: 5, opponent: 'GAEL',    delta:  -3, playedAt: '2026-03-09T14:20:00' },
      { youScore: 6, oppScore: 5, opponent: 'AMRITA',  delta:  +1, playedAt: '2026-02-28T17:10:00' },
      { youScore: 4, oppScore: 7, opponent: 'BORIS',   delta:  -3, playedAt: '2026-02-15T09:35:00' },
      { youScore: 9, oppScore: 5, opponent: 'YAEL',    delta:  +4, playedAt: '2026-02-03T21:00:00' },
      { youScore: 1, oppScore: 3, opponent: 'EMRE',    delta:  -2, playedAt: '2026-01-22T13:40:00' },
      { youScore: 7, oppScore: 5, opponent: 'PEDRO',   delta:  +2, playedAt: '2026-01-08T15:15:00' },
    ],
    scoreHistory: [
      { date: '2022-11-08', score:   0 },
      { date: '2023-01-22', score:  90 },
      { date: '2023-04-15', score: 170 },
      { date: '2023-07-03', score: 250 },
      { date: '2023-09-21', score: 380 },
      { date: '2023-12-12', score: 460 },
      { date: '2024-03-04', score: 530 },
      { date: '2024-06-18', score: 610 },
      { date: '2024-09-25', score: 720 },
      { date: '2024-12-30', score: 690 },
      { date: '2025-03-22', score: 800 },
      { date: '2025-06-14', score: 850 },
      { date: '2025-09-08', score: 880 },
      { date: '2025-12-20', score: 920 },
      { date: '2026-04-26', score: 960 },
    ],
  },
};

// Score multijoueur (superscript in-game + parenthèses dans le profil) :
// somme des deltas des dernières parties — par cohérence avec le tableau affiché.
// Sur intégration jpep : remplacer par le vrai score cumulé Firebase.
function getMultiplayerScore(player) {
  if (typeof PLAYER_PROFILES === 'undefined') return 0;
  const p = PLAYER_PROFILES[player];
  if (!p || !p.recentGames) return 0;
  return p.recentGames.reduce((s, g) => s + (g.delta || 0), 0);
}

// Rangs ASCII-friendly (7 paliers) — affichés avec '#' devant.
//   0-50      = ROOKIE
//   51-150    = NOVICE
//   151-400   = AMATEUR
//   401-1000  = SKILLED
//   1001-2500 = ADVANCED
//   2501-5000 = EXPERT
//   5001+     = MASTER
function rankFromGames(n) {
  if (n <= 50)   return 'ROOKIE';
  if (n <= 150)  return 'NOVICE';
  if (n <= 400)  return 'AMATEUR';
  if (n <= 1000) return 'SKILLED';
  if (n <= 2500) return 'ADVANCED';
  if (n <= 5000) return 'EXPERT';
  return 'MASTER';
}

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

// ── Enregistrement des statistiques en fin de partie ─────────────────────────
// Appelé pour TOUS les types de fin (normale, resign, quit-to-room) afin que
// chaque partie incrémente totalGames et soit ajoutée en tête de recentGames
// pour les deux joueurs.
//   winnerColor : 'white' | 'black'
//   winType     : 'simple' | 'gammon' | 'backgammon' | 'resign'
function recordGameToProfile(winnerColor, winType) {
  if (typeof PLAYER_PROFILES === 'undefined') return;
  const loserColor = winnerColor === 'white' ? 'black' : 'white';
  const points = (winType === 'resign' ? 1 : winPoints(winType)) * cubeValue;
  const playedAt = new Date().toISOString();
  const winnerOpp = (mockState.players && mockState.players[loserColor])  || loserColor.toUpperCase();
  const loserOpp  = (mockState.players && mockState.players[winnerColor]) || winnerColor.toUpperCase();
  if (PLAYER_PROFILES[winnerColor]) {
    const p = PLAYER_PROFILES[winnerColor];
    p.totalGames  = (p.totalGames || 0) + 1;
    p.recentGames = p.recentGames || [];
    p.recentGames.unshift({
      youScore: gameScore[winnerColor],
      oppScore: gameScore[loserColor],
      opponent: winnerOpp,
      delta:   +points,
      playedAt,
    });
  }
  if (PLAYER_PROFILES[loserColor]) {
    const p = PLAYER_PROFILES[loserColor];
    p.totalGames  = (p.totalGames || 0) + 1;
    p.recentGames = p.recentGames || [];
    p.recentGames.unshift({
      youScore: gameScore[loserColor],
      oppScore: gameScore[winnerColor],
      opponent: loserOpp,
      delta:   -points,
      playedAt,
    });
  }
}

// ── Finaliser une étape de mouvement ─────────────────────────────────────────
function finalizeMoveStep() {
  // Mode LEARN : marque que white a joué un coup, ce qui arrête la boucle
  // de la vague de contraste (sens 24 → 1) sur ses triangles.
  if (typeof gameState !== 'undefined' && gameState && gameState.turn === 1
      && typeof learnWhiteHasMoved !== 'undefined') {
    learnWhiteHasMoved = true;
  }
  const winner = Logic.checkWin(gameState);
  if (winner) {
    gameWinner  = winner;
    gameWinType = classifyWin(gameState, winner);
    const key   = winner === 1 ? 'white' : 'black';
    gameScore[key] += winPoints(gameWinType) * cubeValue;
    recordGameToProfile(key, gameWinType);
    if (typeof GameLog !== 'undefined') {
      GameLog.endGame({ winner: key, type: gameWinType, cube: cubeValue, points: winPoints(gameWinType) * cubeValue });
    }
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

// ── Historique des mouvements pour l'undo partiel ────────────────────────────
// Pile de snapshots gameState (Logic.clone) prise AVANT chaque mouvement
// utilisateur (applyRealMove / applyMultipleMoves). Permet à l'utilisateur de
// rejouer le dernier coup en cliquant sur un dé déjà utilisé (= grisé) — le
// dé se rallume et la fiche revient à sa position de départ.
// Réinitialisée à chaque début de tour (rollAndStart) et à chaque démarrage
// de partie (startGame). Ne s'applique qu'au joueur LOCAL_PLAYER (white) —
// l'IA n'undo pas.
let turnHistory = [];
function pushTurnHistory() {
  if (!gameState) return;
  turnHistory.push(Logic.clone(gameState));
}
function clearTurnHistory() {
  turnHistory = [];
}
function canUndoMove() {
  return gameState && !gameWinner && turnHistory.length > 0;
}
function undoLastMove() {
  if (!canUndoMove()) return false;
  gameState = turnHistory.pop();
  syncMockState();
  return true;
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
  pushTurnHistory();           // snapshot AVANT mutation, pour undo via clic dé
  gameState = found.state;
  if (typeof GameLog !== 'undefined') GameLog.move(pl === 1 ? 'white' : 'black', found.seq);
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
  const snapshot = Logic.clone(gameState);   // snapshot AVANT toute mutation
  let applied = 0;
  const allSeq = [];                          // moves cumulés pour le log
  for (let i = 0; i < count; i++) {
    const found = findMoveSequence(gameState, pl, fromIdx, toIdx, k);
    if (!found) break;
    gameState = found.state;
    for (const m of found.seq) allSeq.push(m);
    applied++;
  }
  if (applied > 0) {
    turnHistory.push(snapshot);   // un seul snapshot pour tout le multi-pickup
    if (typeof GameLog !== 'undefined') GameLog.move(pl === 1 ? 'white' : 'black', allSeq);
    finalizeMoveStep();
  }
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
// Timer continu : décrémente le temps réel écoulé entre deux ticks
// (Date.now()) plutôt que de compter les ticks de setInterval. Ainsi, même
// si le navigateur throttle setInterval (page inactive, onglet en arrière-
// plan, app mobile minimisée…), le décompte reflète le temps écoulé exact
// quand le tick suivant arrive. Aucune pause hors mode LEARN — le timer
// continue pendant les modals, l'animation des dés, etc.
let _lastTickMs = 0;
let _accumulatedMs = 0;   // reste de seconde qui n'a pas encore été décrémenté
function resetTimers() {
  timerState = {
    white:    { game: 119 },
    black:    { game: 119 },
    moveLeft: 15,
    active:   'move',
  };
  _lastTickMs = 0;
  _accumulatedMs = 0;
  stopTurnTimer();
}

function startTurnTimer() {
  if (!gameMode || gameWinner) return;
  // Mode LEARN : pas de timer, le joueur prend tout son temps pour apprendre.
  if (typeof isLearnMode === 'function' && isLearnMode()) return;
  timerState.moveLeft = 15;
  timerState.active   = 'move';
  _lastTickMs    = Date.now();
  _accumulatedMs = 0;
  if (!_timerInterval) _timerInterval = setInterval(tickTimer, 1000);
}

function stopTurnTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

function tickTimer() {
  if (!gameMode || gameWinner) { stopTurnTimer(); return; }
  // Calcule le temps RÉEL écoulé depuis le dernier tick (immune au throttling
  // de setInterval pour les onglets inactifs). On accumule les fractions de
  // seconde dans _accumulatedMs et on décrémente d'autant de secondes entières
  // que possible — le reste est conservé pour le tick suivant.
  const now = Date.now();
  if (_lastTickMs === 0) { _lastTickMs = now; return; }
  _accumulatedMs += (now - _lastTickMs);
  _lastTickMs = now;
  let secsToConsume = Math.floor(_accumulatedMs / 1000);
  if (secsToConsume <= 0) return;
  _accumulatedMs -= secsToConsume * 1000;
  // Pendant un modal d'acceptation de cube, l'horloge débite le joueur QUI DOIT
  // décider (le répondant du double), pas celui dont c'est structurellement le
  // tour. Sinon, quand l'IA double, le temps s'écoulait à tort sur SON minuteur
  // alors que c'est le joueur qui réfléchit (take/drop).
  let turn = mockState.turn;
  if (modalState && modalState.type === 'accept' && modalState.player) {
    turn = modalState.player;
  }
  while (secsToConsume > 0 && !gameWinner) {
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
        if (typeof GameLog !== 'undefined') {
          GameLog.endGame({ winner: winner === 1 ? 'white' : 'black', type: 'timeout', cube: cubeValue, points: cubeValue });
        }
        cubePromised = null;
        return;
      }
    }
    secsToConsume--;
  }
}

function endTurn() {
  if (!gameState || gameWinner) return;
  // Garde anti-race : si l'utilisateur a annulé un coup via undoLastMove
  // pendant le délai (400 ms) avant que le endTurn programmé ne fire,
  // gameState.moves peut contenir à nouveau des dés non joués ET des coups
  // valides — auquel cas on doit RESTER sur le tour courant, pas le clore.
  if (gameState.moves.length > 0) {
    const vm = Logic.getValidMoves(gameState, gameState.turn);
    if (vm.length > 0) return;
  }
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
  // IA : abandonne si la défaite est mathématiquement certaine (course perdue,
  // tout au home) → évite de faire traîner une partie déjà jouée.
  if (maybeAIResign(nextPl)) return;
  // R7 : l'IA (black) peut décider d'offrir un double AVANT de lancer.
  if (maybeAIOfferDouble(nextPl)) return;
  rollAndStart(nextPl);
}

// Détecte si le joueur a des pièces sur la barre ET que les 6 points d'entrée
// sont tous bloqués (2+ fiches adverses) → aucun jet ne peut servir.
function isBarThrowImpossible(pl) {
  if (!gameState || !gameState.bar) return false;
  if (gameState.bar[pl] === 0) return false;
  const opp = pl === 1 ? 2 : 1;
  for (let die = 1; die <= 6; die++) {
    const idx = pl === 1 ? 24 - die : die - 1;   // jpep 0-indexé
    const e = gameState.pts[idx];
    const blocked = e.p === opp && e.n >= 2;
    if (!blocked) return false;
  }
  return true;
}

function rollAndStart(nextPl) {
  const turnColor = nextPl === 1 ? 'white' : 'black';
  // Nouveau tour → on jette l'historique d'undo (impossible d'annuler par-delà
  // une frontière de tour : les dés ont déjà été repassés à l'adversaire).
  clearTurnHistory();

  // Court-circuit : barre + toutes entrées bloquées → pas de jet, juste les
  // cadres vides en surbrillance, puis on passe.
  if (isBarThrowImpossible(nextPl)) {
    gameState.dice  = [];
    gameState.moves = [];
    syncMockState();
    clearDice();                 // diceAnim → EMPTY (cadres vides en surbrillance)
    hasOwnedDice[turnColor] = true;
    startTurnTimer();
    if (typeof GameLog !== 'undefined') GameLog.pass(turnColor, 'bar-blocked');
    _passCount++;
    noMovesNotice = { active: true, owner: turnColor };
    // En LEARN : pause prolongée pour laisser le temps de lire le tip "no moves"
    const learnNoMovesDur = (typeof isLearnMode === 'function' && isLearnMode()) ? 3500 : 1500;
    setTimeout(() => {
      noMovesNotice = { active: false, owner: null };
      endTurn();
    }, learnNoMovesDur);
    return;
  }

  // Aile dès le DÉBUT du tour ; dés vidés pendant le lead (le joueur ne peut pas
  // agir tant qu'ils ne sont pas jetés).
  gameState.dice  = [];
  gameState.moves = [];
  syncMockState();
  clearDice();
  if (typeof Sfx !== 'undefined') Sfx.wing();
  const LEAD = (typeof Sfx !== 'undefined' && typeof Sfx.LEAD_MS === 'number') ? Sfx.LEAD_MS : 0;

  // Le JET (visuel + roucoulements) suit après le lead.
  const launch = () => {
    if (!gameMode || gameWinner || gameState.turn !== nextPl) return;
    const newDice   = Logic.rollDice();
    gameState.dice  = newDice;
    gameState.moves = [...newDice];
    syncMockState();
    clearDice();
    startRoll(newDice, turnColor);
    hasOwnedDice[turnColor] = true;
    startTurnTimer();
    if (typeof GameLog !== 'undefined') GameLog.roll(turnColor, newDice);

    // Si aucun coup disponible → laisser le user voir le lancer, puis transparence, puis pass
    const vm = Logic.getValidMoves(gameState, nextPl);
    if (vm.length === 0 && _passCount < 2) {
      if (typeof GameLog !== 'undefined') GameLog.pass(turnColor, 'no-move');
      _passCount++;
      const ownerName = nextPl === 1 ? 'white' : 'black';
      const inLearn = (typeof isLearnMode === 'function' && isLearnMode());
      const readDur = inLearn ? 1800 : 800;
      const passDur = inLearn ? 2500 : 900;
      const waitDone = () => {
        if (typeof diceAnim !== 'undefined' && diceAnim.state !== 'done') {
          setTimeout(waitDone, 80);
          return;
        }
        setTimeout(() => {
          noMovesNotice = { active: true, owner: ownerName };
          setTimeout(() => {
            noMovesNotice = { active: false, owner: null };
            endTurn();
          }, passDur);
        }, readDur);
      };
      waitDone();
    } else {
      _passCount = 0;
      if (aiMode && nextPl === 2) {
        waitForDiceThenAITurn();
      } else {
        maybeAutoForcedHuman(nextPl);
      }
    }
  };
  if (LEAD > 0) setTimeout(launch, LEAD); else launch();
}

// ── Auto-jeu des coups FORCÉS en phase de sortie (bear-off) ──────────────────
// Confort : quand le joueur humain est en bear-off et que le lancer n'a qu'UNE
// seule façon d'être joué (une seule position finale légale), on le joue
// automatiquement après un court délai — sans jamais retirer un vrai choix.
let autoForcedEnabled = true;

// GEL des interactions joueur pendant un mouvement automatique (coup forcé en
// bear-off). Sans ça, si le joueur a le réflexe de saisir une fiche pendant
// l'auto-jeu, le drag entre en concurrence avec l'animation → la fiche peut
// rester visuellement en place alors que le moteur l'a déjà comptée sortie.
// On le pose AVANT le délai de lecture (maybeAutoForcedHuman) et on le lève
// uniquement à la toute fin de l'animation (ou si rien n'est joué).
let autoPlaying = false;

function autoPlayForced(pl) {
  if (!gameMode || gameWinner || modalState) return false;
  if (!gameState || !gameState.moves || gameState.moves.length === 0) return false;
  if (typeof AI === 'undefined' || !AI.enumerateSequences) return false;
  const res = AI.enumerateSequences(gameState, pl, 2);    // cap 2 : on veut juste savoir si forcé
  if (res.length !== 1 || !res[0].seq.length) return false;
  const seq = res[0].seq;
  if (typeof GameLog !== 'undefined') GameLog.move(pl === 1 ? 'white' : 'black', seq);

  // Animation mutualisée avec l'IA : chaîne les sous-coups d'une même pièce ET
  // FUSIONNE les pièces de même chemin (déplacées ENSEMBLE, ex. doubles). Gap
  // accéléré (~25 % : 180 → 135) — plus vif tout en gardant la fluidité.
  animateSequence(seq, pl, finalizeMoveStep, 135);
  return true;
}

// ── Lecture animée d'une séquence de coups (mutualisée IA + coups forcés) ────
// 1) chaîne les sous-coups d'une MÊME pièce (A→B→C → un seul vol) ;
// 2) fusionne les pièces de MÊME chemin en un multi-pickup (pieceCount > 1) →
//    deux fiches partent ENSEMBLE (typique des doubles) ;
// 3) anime groupe par groupe. pl : 1|2 ; gap : pause (ms) entre groupes (plus
//    court = plus rapide) ; onComplete : appelé à la fin.
function animateSequence(seq, pl, onComplete, gap) {
  if (typeof gap !== 'number') gap = 600;
  const opp = pl === 1 ? 2 : 1;
  // Coups forcés uniquement (l'IA a sa propre animation inline) → on gèle les
  // interactions joueur et on accélère le vol de ~25 % (durScale 0.75).
  autoPlaying = true;
  const FORCED_DUR_SCALE = 0.75;

  const chained = [];
  for (let k = 0; k < seq.length; k++) {
    const m = seq[k];
    if (chained.length > 0) {
      const prev  = chained[chained.length - 1];
      const lastM = prev.moves[prev.moves.length - 1];
      if (lastM.t !== 'off' && m.f === lastM.t) { prev.moves.push(m); prev.to = m.t; continue; }
    }
    chained.push({ from: m.f, to: m.t, moves: [m] });
  }

  function samePath(g1, g2) {
    if (g1.from !== g2.from || g1.to !== g2.to) return false;
    if (g1.moves.length !== g2.moves.length) return false;
    for (let i = 0; i < g1.moves.length; i++) {
      if (g1.moves[i].f !== g2.moves[i].f || g1.moves[i].t !== g2.moves[i].t || g1.moves[i].d !== g2.moves[i].d) return false;
    }
    return true;
  }
  const groups = [];
  for (const g of chained) {
    if (groups.length > 0 && samePath(groups[groups.length - 1], g)) {
      const prev = groups[groups.length - 1];
      prev.pieceCount = (prev.pieceCount || 1) + 1;
      prev.moves = prev.moves.concat(g.moves);
    } else {
      groups.push({ from: g.from, to: g.to, moves: g.moves.slice(), pieceCount: 1 });
    }
  }

  let i = 0;
  function applyNext() {
    if (gameWinner) { autoPlaying = false; return; }
    if (i >= groups.length) { autoPlaying = false; onComplete(); return; }
    const g = groups[i];
    const fromPt = g.from === 'bar' ? 'bar' : g.from + 1;
    const toPt   = g.to   === 'off' ? 0    : g.to   + 1;
    let hit = null, simState = gameState;
    for (const m of g.moves) {
      if (m.t !== 'off' && simState.pts[m.t] && simState.pts[m.t].p === opp && simState.pts[m.t].n === 1) {
        hit = { pt: m.t + 1, isWhite: opp === 1 }; break;
      }
      try { simState = Logic.applyMove(simState, pl, m); } catch (e) { break; }
    }
    const firstDiceValue = g.moves[0].d;
    const pieceCount  = g.pieceCount || 1;
    const chainLength = g.moves.length / pieceCount;
    const intermediates = [];
    for (let mi = 0; mi < chainLength - 1; mi++) {
      const im = g.moves[mi];
      intermediates.push(im.t === 'off' ? 0 : im.t + 1);
    }
    if (typeof startFlyingChecker === 'function') {
      startFlyingChecker(fromPt, toPt, pl === 1, () => {
        for (const m of g.moves) gameState = Logic.applyMove(gameState, pl, m);
        syncMockState();
        i++;
        setTimeout(applyNext, gap);
      }, hit, firstDiceValue, intermediates, pieceCount, FORCED_DUR_SCALE);
    } else {
      for (const m of g.moves) gameState = Logic.applyMove(gameState, pl, m);
      syncMockState();
      i++;
      setTimeout(applyNext, gap);
    }
  }
  applyNext();
}

function maybeAutoForcedHuman(pl) {
  if (!autoForcedEnabled || !gameMode || gameWinner || modalState) return;
  if (typeof isLearnMode === 'function' && isLearnMode()) return;      // pas en mode apprentissage
  if (!gameState || !Logic.allHome(gameState, pl)) return;             // bear-off uniquement
  const color = pl === 1 ? 'white' : 'black';
  const tryPlay = () => {
    if (!gameMode || gameWinner || modalState) return;
    if (mockState.turn !== color) return;                              // le tour a changé
    if (typeof diceAnim !== 'undefined' && diceAnim.state !== 'done') { setTimeout(tryPlay, 80); return; }
    if (!gameState.moves || gameState.moves.length === 0) return;
    if (!Logic.allHome(gameState, pl)) return;
    const seqs = AI.enumerateSequences(gameState, pl, 2);
    if (seqs.length !== 1 || !seqs[0].seq.length) return;              // pas forcé → on laisse jouer
    // On gèle DÈS le délai de lecture : c'est précisément cette fenêtre de
    // 450 ms où le joueur a le réflexe de saisir la fiche lui-même.
    autoPlaying = true;
    setTimeout(() => { if (!autoPlayForced(pl)) autoPlaying = false; }, 450);
  };
  tryPlay();
}

// Poll l'état de l'animation des dés ; quand DONE, déclenche playAITurn.
// En LEARN : on attend ÉGALEMENT que tout tip pédagogique en cours soit
// dismissé par le joueur, et on rallonge le délai final pour laisser le
// temps de comprendre la situation avant que l'IA enchaîne.
// Pour le PREMIER tour de l'IA en LEARN, on déclenche EN PLUS deux boucles
// de la vague de contraste dans le sens INVERSE (1 → 24) AVANT que l'IA
// ne joue, pour montrer au débutant que les sens d'avancement sont opposés.
let _learnFirstAITriggered = false;
function waitForDiceThenAITurn() {
  if (!gameMode || gameWinner) return;
  // Note : on N'ATTEND PLUS la fermeture des tips LEARN — les tips
  // s'auto-dismiss après LEARN_TIP_DUR ; l'IA enchaîne sans bloquer
  // l'utilisateur (qui peut agir dès la fin du message).
  if (typeof diceAnim !== 'undefined' && diceAnim.state !== 'done') {
    setTimeout(waitForDiceThenAITurn, 80);
    return;
  }
  // Premier tour AI en LEARN : déclenche 2 boucles de vague INVERSE
  // (sens 1 → 24, opposé à white) + un tip explicatif, puis joue l'IA.
  if (!_learnFirstAITriggered
      && typeof isLearnMode === 'function' && isLearnMode()
      && typeof learnTipsShown !== 'undefined' && learnTipsShown
      && !learnTipsShown.blackDirection) {
    _learnFirstAITriggered = true;
    learnTipsShown.blackDirection = true;
    if (typeof startLearnDirectionAnim === 'function') {
      startLearnDirectionAnim('black', 2);     // 2 boucles dans le sens 1 → 24
    }
    if (typeof showLearnTip === 'function') {
      showLearnTip("OPPONENT MOVES 1 → 24.");  // sens INVERSE de white
    }
    // Total = 2 boucles + 1 pause entre les deux
    const loopDur = (typeof LEARN_DIRECTION_DUR !== 'undefined') ? LEARN_DIRECTION_DUR : 2400;
    const pauseDur = (typeof LEARN_DIRECTION_PAUSE !== 'undefined') ? LEARN_DIRECTION_PAUSE : 1200;
    const totalDur = loopDur * 2 + pauseDur;
    setTimeout(playAITurn, totalDur + 200);
    return;
  }
  const learnDelay = (typeof isLearnMode === 'function' && isLearnMode()) ? 1800 : 350;
  setTimeout(playAITurn, learnDelay);
}

// ── Tour de l'IA (joue black, P2) — moves animés un par un, fusionnés par pièce ─
function playAITurn() {
  if (!gameMode || !aiMode || gameWinner) return;
  // Note : pas de gating sur les tips LEARN ici — ils s'auto-dismiss et
  // l'IA peut enchaîner immédiatement après son action.
  if (mockState.turn !== 'black') return;
  if (modalState) return;
  const _aiT0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const result = AI.aiPlay(gameState, 2);
  const _aiThink = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - _aiT0;
  if (!result.seq || result.seq.length === 0) {
    if (typeof GameLog !== 'undefined') GameLog.pass('black', 'no-move');
    finalizeMoveStep();
    return;
  }
  if (typeof GameLog !== 'undefined') GameLog.move('black', result.seq, _aiThink);
  // Fusion étape 1 : si la pièce passe par plusieurs cases (A→B→C), un seul
  // fade A→C — chaîne les moves consécutifs où la destination du précédent
  // = origine du courant.
  const chained = [];
  for (let k = 0; k < result.seq.length; k++) {
    const m = result.seq[k];
    if (chained.length > 0) {
      const prev = chained[chained.length - 1];
      const lastM = prev.moves[prev.moves.length - 1];
      if (lastM.t !== 'off' && m.f === lastM.t) {
        prev.moves.push(m);
        prev.to = m.t;
        continue;
      }
    }
    chained.push({ from: m.f, to: m.t, moves: [m] });
  }

  // Fusion étape 2 (doubles uniquement) : si plusieurs groupes chaînés ont
  // exactement le MÊME chemin (mêmes from, to, intermédiaires, séquence de
  // dés), on les fusionne en un seul groupe multi-pickup avec pieceCount > 1.
  // Reproduit le comportement humain : sur un double 6-6 envoyant 2 fiches
  // de 24 vers 12 (via 18), l'IA joue les deux fiches ENSEMBLE plutôt
  // qu'une après l'autre.
  function samePath(g1, g2) {
    if (g1.from !== g2.from || g1.to !== g2.to) return false;
    if (g1.moves.length !== g2.moves.length) return false;
    for (let i = 0; i < g1.moves.length; i++) {
      if (g1.moves[i].f !== g2.moves[i].f) return false;
      if (g1.moves[i].t !== g2.moves[i].t) return false;
      if (g1.moves[i].d !== g2.moves[i].d) return false;
    }
    return true;
  }
  const groups = [];
  for (const g of chained) {
    if (groups.length > 0 && samePath(groups[groups.length - 1], g)) {
      const prev = groups[groups.length - 1];
      prev.pieceCount = (prev.pieceCount || 1) + 1;
      // Concatène les moves : on appliquera prev.pieceCount × g.moves au state.
      prev.moves = prev.moves.concat(g.moves);
    } else {
      groups.push({ from: g.from, to: g.to, moves: g.moves.slice(), pieceCount: 1 });
    }
  }

  let i = 0;
  function applyNext() {
    if (gameWinner) return;
    if (i >= groups.length) {
      finalizeMoveStep();
      return;
    }
    const g = groups[i];
    const fromPt = g.from === 'bar' ? 'bar' : g.from + 1;
    const toPt   = g.to   === 'off' ? 0    : g.to   + 1;
    // Détection hit : pièce blanche seule (= blot) à n'importe quelle
    // destination du groupe — y compris les points INTERMÉDIAIRES d'un
    // mouvement combiné. Sinon les hits sur intermédiaires (ex. : black
    // joue 5+3, hit à l'étape +5) étaient ratés et l'animation ne se
    // déclenchait pas. On simule l'application séquentielle des sous-moves
    // pour vérifier l'état au moment de chaque étape, puis on garde le
    // premier hit rencontré (le plus proche du départ visuellement).
    let hit = null;
    let simState = gameState;
    for (const m of g.moves) {
      if (m.t !== 'off' && simState.pts[m.t]
          && simState.pts[m.t].p === 1 && simState.pts[m.t].n === 1) {
        hit = { pt: m.t + 1, isWhite: true };
        break;
      }
      // Simule l'application pour le check du sous-move suivant.
      try { simState = Logic.applyMove(simState, 2, m); }
      catch (e) { break; }
    }
    // Première valeur de dé du groupe (utilisée pour synchroniser le fade du dé)
    const firstDiceValue = g.moves[0].d;
    // Points intermédiaires (toutes les destinations sauf la finale).
    // En mode multi-pickup (pieceCount > 1), g.moves contient N copies du
    // chemin (pieceCount × chainLength) — on calcule donc les intermédiaires
    // d'UNE chaîne seulement pour éviter de répéter les mêmes points.
    const pieceCount  = g.pieceCount || 1;
    const chainLength = g.moves.length / pieceCount;
    const intermediates = [];
    for (let mi = 0; mi < chainLength - 1; mi++) {
      const im = g.moves[mi];
      intermediates.push(im.t === 'off' ? 0 : im.t + 1);
    }
    if (typeof startFlyingChecker === 'function') {
      startFlyingChecker(fromPt, toPt, false, () => {
        for (const m of g.moves) gameState = Logic.applyMove(gameState, 2, m);
        syncMockState();
        i++;
        setTimeout(applyNext, 600);
      }, hit, firstDiceValue, intermediates, pieceCount);
    } else {
      for (const m of g.moves) gameState = Logic.applyMove(gameState, 2, m);
      syncMockState();
      i++;
      setTimeout(applyNext, 800);
    }
  }
  applyNext();
}

// ── R6 : abandon — multiplicateur selon l'état du plateau du perdant ─────────
// Couvre AUSSI le cas "quitter la partie pour aller dans le room" (cf.
// modal type:'quit') qui appelle ce resign avec player = LOCAL_PLAYER.
// Règles officielles du backgammon appliquées au resign :
//   - perdant a sorti ≥ 1 pièce        → simple (×1) — affiché "RESIGN"
//   - perdant n'a sorti aucune pièce   → gammon (×2)
//   - perdant a une pièce sur la barre
//     ou dans le home du gagnant       → backgammon (×3)
// Le label affiché reste "RESIGN" pour le cas simple ; pour gammon/backgammon,
// le label naturel ("GAMMON" / "BACKGAMMON") est utilisé — c'est plus parlant
// que "RESIGN ×2" et cohérent avec la victoire normale.
// Stats : recordGameToProfile reçoit le type final → delta calculé en cohérence.
// Détecte une position initiale (aucun mouvement n'a été joué). Sert à
// déclasser un resign en début de partie : sinon classifyWin retournerait
// 'backgammon' à cause des pièces white initialement sur le point 24 (= home
// black) — ce qui pénaliserait injustement un joueur qui abandonne avant
// même d'avoir bougé.
function isInitialPosition(state) {
  if (!state || !state.pts) return false;
  if (state.off[1] !== 0 || state.off[2] !== 0) return false;
  if (state.bar[1] !== 0 || state.bar[2] !== 0) return false;
  const init = Logic.initialBoard();
  for (let i = 0; i < 24; i++) {
    if (state.pts[i].n !== init[i].n || state.pts[i].p !== init[i].p) return false;
  }
  return true;
}

function resign(player) {
  if (!gameMode || gameWinner) return;
  const winner     = player === 'white' ? 2 : 1;
  // Abandon AVANT tout mouvement = simple, peu importe la position de départ
  // (qui serait artificiellement classée 'backgammon' à cause des fiches
  // white initialement sur le point 24, dans le home black).
  const classified = isInitialPosition(gameState)
    ? 'simple'
    : classifyWin(gameState, winner);   // 'simple' | 'gammon' | 'backgammon'
  gameWinner   = winner;
  gameWinType  = (classified === 'simple') ? 'resign' : classified;
  const key    = winner === 1 ? 'white' : 'black';
  gameScore[key] += winPoints(classified) * cubeValue;
  if (typeof GameLog !== 'undefined') {
    GameLog.endGame({ winner: key, type: gameWinType, cube: cubeValue, points: winPoints(classified) * cubeValue });
  }
  cubePromised = null;
  recordGameToProfile(key, gameWinType);
}

// ── R7 : doubling cube actions ────────────────────────────────────────────────
// Cliquable à n'importe quel moment ; effet déclenché au début du prochain tour du joueur.
function clickCube(player) {
  if (!gameMode || gameWinner || modalState) return;
  if (cubeValue >= 4) return;
  // Variante : chaque joueur ne peut doubler qu'une seule fois.
  if (cubeUsed[player]) return;
  // Si l'adversaire a déjà promis → bloqué
  if (cubePromised && cubePromised !== player) return;
  cubePromised = player;
  // Reset du timer du notice "YOU WILL BE ABLE TO DOUBLE…" :
  // chaque clic (initial OU rappel) relance l'affichage à pleine opacité
  // pour bien rappeler au joueur qu'il faut attendre son tour.
  if (typeof doublePromiseT0 !== 'undefined') {
    doublePromiseT0 = (typeof millis === 'function') ? millis() : Date.now();
  }
}

function modalOfferResponse(accept) {
  if (!modalState || modalState.type !== 'offer') return;
  const offerer = modalState.player;
  if (accept) {
    const opponent = offerer === 'white' ? 'black' : 'white';
    if (typeof GameLog !== 'undefined') GameLog.cube('offer', offerer, cubeValue, Math.min(cubeValue * 2, 4));
    modalState = { type: 'accept', player: opponent, offerer };
    // Si l'opposant est l'IA → décision auto sans modal visible côté user
    if (aiMode && opponent === 'black') {
      setTimeout(decideAIAccept, 600);   // court délai pour la fluidité
    }
  } else {
    cubePromised = null;
    modalState   = null;
    rollAndStart(offerer === 'white' ? 1 : 2);
  }
}

function modalAcceptResponse(accept) {
  if (!modalState || modalState.type !== 'accept') return;
  const offerer  = modalState.offerer;
  const opponent = modalState.player;
  if (accept) {
    if (typeof GameLog !== 'undefined') GameLog.cube('take', opponent);
    cubeValue    = Math.min(cubeValue * 2, 4);
    cubeOwner    = opponent;       // l'accepteur possède désormais le cube
    cubeUsed[offerer] = true;       // l'offrant a consommé son double (variante 1×/joueur)
    cubePromised = null;
    modalState   = null;
    rollAndStart(offerer === 'white' ? 1 : 2);
  } else {
    // Refus → offrant gagne cubeValue (avant le doublement) en simple
    gameWinner   = offerer === 'white' ? 1 : 2;
    gameWinType  = 'simple';
    gameScore[offerer] += cubeValue;
    if (typeof GameLog !== 'undefined') {
      GameLog.cube('drop', opponent);
      GameLog.endGame({ winner: offerer, type: 'drop', cube: cubeValue, points: cubeValue });
    }
    modalState   = null;
    cubePromised = null;
  }
}

// ── IA : décision auto d'accepter ou refuser un double offert ────────────────
// Prise/passe fondée sur la proba de gain estimée et le point de prise
// (≈25 %, relevé par le risque de gammon). L'offrant (white) est sur le trait.
function decideAIAccept() {
  if (!modalState || modalState.type !== 'accept') return;
  if (modalState.player !== 'black') return;
  if (!aiMode || gameWinner) return;
  let accept = true;
  if (typeof AI !== 'undefined' && AI.cubeTake) {
    accept = AI.cubeTake(gameState, 2, /* doublerOnRoll */ true);
  } else if (typeof AI !== 'undefined' && AI.evaluate) {
    accept = (AI.evaluate(gameState, 2) - AI.evaluate(gameState, 1)) > -25; // fallback
  }
  modalAcceptResponse(accept);
}

// ── IA : décision d'OFFRIR un double au début de son tour (avant de lancer) ──
// Pose directement le modal d'acceptation côté joueur (white). Retourne true
// si un double a été proposé (l'appelant ne doit alors PAS lancer les dés).
function maybeAIOfferDouble(nextPl) {
  if (!aiMode || nextPl !== 2 || gameWinner) return false;
  if (cubeValue >= 4 || cubeUsed['black'] || cubePromised) return false;
  if (typeof AI === 'undefined' || !AI.cubeAction) return false;
  if (AI.cubeAction(gameState, 2, /* plOnRoll */ true) !== 'double') return false;
  cubePromised = 'black';
  if (typeof GameLog !== 'undefined') GameLog.cube('offer', 'black', cubeValue, Math.min(cubeValue * 2, 4));
  modalState   = { type: 'accept', player: 'white', offerer: 'black' };
  startTurnTimer();
  return true;
}

// Estimation du nombre de LANCERS pour sortir toutes les fiches en course
// pure : on sort ~2 fiches et ~8 pips par lancer → on retient la plus
// contraignante des deux bornes (fiches restantes / 2 ; pips / 8). Estimation
// volontairement simple mais robuste pour comparer deux courses parallèles.
function estBearoffRolls(state, pl) {
  const remaining = 15 - (state.off[pl] || 0);
  if (remaining <= 0) return 0;
  const pip = Logic.calcPipCount(state, pl);
  return Math.max(Math.ceil(remaining / 2), Math.ceil(pip / 8));
}

// ── IA : abandon quand la défaite est mathématiquement (quasi) certaine ──────
// Conditions PRUDENTES (ne jamais abandonner une partie gagnable) :
//   • course pure (aucun contact → l'issue ne dépend plus que des dés) ;
//   • IA entièrement au home ET ayant déjà sorti ≥ 1 fiche (gammon sauvé →
//     l'abandon vaut une perte SIMPLE, valeur correcte) ;
//   • retard décisif en NOMBRE DE LANCERS, selon DEUX cas :
//     (a) milieu de course : retard ≥ 2 lancers (marge contre la variance) ;
//     (b) TOUTE FIN : l'adversaire finit quasi sûrement au prochain coup
//         (rollsOpp ≤ 1) et l'IA ne peut PAS finir avant lui (rollsAI ≥ 2,
//         retard ≥ 1) → son seul espoir serait un double parfait sur son unique
//         lancer restant (< ~10 %). Sans (b), la marge tombait sous 2 quand il
//         ne reste que quelques fiches et l'IA jouait une fin déjà perdue.
// Le critère « pips » seul (écart ≥ 40) ne se déclenchait jamais en bear-off où
// les pips sont petits : on raisonne désormais en lancers restants.
const AI_RESIGN_ROLL_GAP = 2;
function maybeAIResign(nextPl) {
  if (!aiMode || nextPl !== 2 || gameWinner || modalState) return false;
  if (!gameState || typeof AI === 'undefined') return false;
  if (typeof isLearnMode === 'function' && isLearnMode()) return false;   // pas en apprentissage
  if (AI.hasContact && AI.hasContact(gameState)) return false;            // course pure seulement
  if (!Logic.allHome(gameState, 2) || gameState.off[2] < 1) return false; // tout au home + gammon sauvé
  const rollsAI  = estBearoffRolls(gameState, 2);
  const rollsOpp = estBearoffRolls(gameState, 1);
  const margin   = rollsAI - rollsOpp;
  const lost = (margin >= AI_RESIGN_ROLL_GAP)                  // (a) nettement derrière
            || (rollsOpp <= 1 && rollsAI >= 2 && margin >= 1); // (b) adversaire sur le point de finir
  if (!lost) return false;
  if (typeof resign === 'function') { resign('black'); return true; }     // l'IA abandonne
  return false;
}

// ── Démarrer une vraie partie ─────────────────────────────────────────────────
// startGame(openingDelay) : si openingDelay (ms) > 0, l'opening roll est
// reporté de ce délai. Sert à laisser un peu de temps après l'apparition
// progressive des fiches avant de lancer le 1er dé (1ère partie).
function startGame(openingDelay) {
  gameState    = Logic.newGameState();
  gameMode     = true;
  _passCount   = 0;
  gameWinner   = 0;
  gameWinType  = '';
  // Nouveau MATCH → score à zéro. La REVANCHE (continuation d'un match) sauvegarde
  // puis restaure ce score autour de startGame pour le conserver.
  gameScore.white = 0; gameScore.black = 0;
  cubeValue    = 1;
  cubePromised = null;
  cubeOwner    = null;
  cubeUsed     = { white: false, black: false };
  modalState   = null;
  hasOwnedDice = { white: false, black: false };
  clearTurnHistory();
  resetTimers();
  // Mode LEARN : reset les drapeaux des tips pédagogiques pour une nouvelle partie
  if (typeof resetLearnTips === 'function') resetLearnTips();
  _learnFirstAITriggered = false;
  // aiMode est défini par la touche d'entrée ([5] = hot-seat, [i] = vs IA)

  // Mirror : non implémenté côté logique pour l'instant.
  // L'inversion correcte (white reste en bas, plateau visuellement tourné)
  // nécessite getBoardIndices(dir) du repo principal — sera branché à l'intégration.

  mockState = {
    points:  new Array(25).fill(0),
    bar:     { white: 0, black: 0 },
    off:     { white: 0, black: 0 },
    turn:    'white',
    dice:    [],
    phase:   'normal',
    players: {
      white: (typeof userNick !== 'undefined' && userNick) ? userNick : 'WHITE',
      black: aiMode ? 'COMPUTER' : 'OPPONENT',
    },
    timers:  null,
  };
  // Affiche les fiches dès le départ (mais le fade-in visuel est piloté
  // par checkerAppearT0 côté sketch.js)
  syncMockState();

  // Log : nouvelle partie (additif, sans effet si gamelog.js absent).
  if (typeof GameLog !== 'undefined') {
    GameLog.newGame({
      mode: aiMode ? 'ai' : 'hotseat',
      players: { white: mockState.players.white, black: mockState.players.black },
    });
  }

  // Si délai demandé, on reporte l'opening roll pour laisser le temps aux
  // fiches d'apparaître + une petite pause avant le 1er lancer.
  if (openingDelay && openingDelay > 0) {
    setTimeout(_startOpeningRoll, openingDelay);
  } else {
    _startOpeningRoll();
  }
}

function _startOpeningRoll() {
  if (gameWinner) return;
  // ── Opening roll : chaque joueur lance un dé, à tour de rôle ──
  const rolls    = Logic.rollOpeningDice();
  const resolved = Logic.resolveOpening(rolls);
  openingDisplay = { white: 0, black: 0 };
  openingActive  = true;

  // Log : lancer d'ouverture + qui commence.
  if (typeof GameLog !== 'undefined') {
    GameLog.opening(rolls[1], rolls[2], resolved.turn === 1 ? 'white' : 'black');
  }

  // Phase A : white roule un dé (le 2e dé reste vide)
  clearDice();
  if (typeof Sfx !== 'undefined') Sfx.wing();
  startRoll([rolls[1]], 'white');
  setTimeout(() => {
    if (gameWinner) return;
    openingDisplay.white = rolls[1];           // garde le dé 1 visible côté white
    // Phase B : black roule à son tour
    clearDice();
    if (typeof Sfx !== 'undefined') Sfx.wing();
    startRoll([rolls[2]], 'black');
    setTimeout(() => {
      if (gameWinner) return;
      openingDisplay.black = rolls[2];         // garde le dé 1 visible côté black
      clearDice();                             // arrête l'animation, on passe en statique
      // Phase C : pause pour lire les deux dés (sans message texte)
      setTimeout(() => {
        if (gameWinner) return;
        // Phase D' : transition fade rapide — loser disparaît, winner.dé2 apparaît
        const winnerColor = resolved.turn === 1 ? 'white' : 'black';
        const loserColor  = resolved.turn === 1 ? 'black' : 'white';
        openingTransition = {
          winner:      winnerColor,
          loser:       loserColor,
          winnerValue: resolved.turn === 1 ? rolls[1] : rolls[2],
          loserValue:  resolved.turn === 1 ? rolls[2] : rolls[1],
          t0:          (typeof millis === 'function') ? millis() : performance.now(),
          dur:         400,
        };
        setTimeout(() => {
          openingTransition = null;
          openingDisplay    = { white: 0, black: 0 };
          openingActive     = false;
          if (gameWinner) return;
          Object.assign(gameState, resolved);
          // Ordonne dice/moves comme la transition : [winnerValue, loserValue]
          // pour éviter le "pivot" visuel des dés à la fin du transfer.
          const wV = openingTransition ? null :
                     (resolved.turn === 1 ? rolls[1] : rolls[2]);
          const lV = resolved.turn === 1 ? rolls[2] : rolls[1];
          const ordered = [
            resolved.turn === 1 ? rolls[1] : rolls[2],
            lV
          ];
          gameState.dice  = ordered.slice();
          gameState.moves = ordered.slice();
          syncMockState();
          clearDice();
          // Pas de re-lancer : les dés sont posés directement dans l'ordre du transfer
          const winnerColor2 = resolved.turn === 1 ? 'white' : 'black';
          setDiceFinal(ordered, winnerColor2);
          if (typeof GameLog !== 'undefined') GameLog.roll(winnerColor2, ordered);
          hasOwnedDice[winnerColor2] = true;
          startTurnTimer();
          if (aiMode && resolved.turn === 2) waitForDiceThenAITurn();
        }, 400);
      }, 1100);
    }, 2200);
  }, 2200);
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
  cubeOwner    = null;
  cubeUsed     = { white: false, black: false };
  modalState   = null;
  resetTimers();

  // Vider le plateau
  for (let i = 0; i < 24; i++) gameState.pts[i] = { n: 0, p: 0 };
  gameState.bar = { 1: 0, 2: 0 };
  gameState.off = { 1: 0, 2: 0 };

  // Scénario : barre NOIRE TOTALEMENT BLOQUÉE — c'est le tour de l'IA, donc
  // on voit DIRECTEMENT le comportement "pas de jet, cadres vides en
  // surbrillance, pass au tour suivant" déclenché par l'opposant.
  // Black entre depuis la barre sur les points 1-6 (jpep idx 0-5).
  // Pour tout bloquer : 2+ blanches sur CHACUN des 6 points (12 fiches).
  for (let i = 0; i <= 5; i++) gameState.pts[i] = { n: 2, p: 1 };  // 12 blanches sur pts 1-6
  // 3 blanches restantes (5+3+12 = ne marche pas, ajustons)
  gameState.pts[7]  = { n: 3, p: 1 };  // pt  8 : 3 blanches → total 12+3 = 15 ✓
  // Quelques noires pour contextualiser (black n'a pas perdu)
  gameState.pts[18] = { n: 5, p: 2 };  // pt 19 : 5 noires (home black)
  gameState.pts[16] = { n: 4, p: 2 };  // pt 17 : 4 noires
  gameState.pts[12] = { n: 5, p: 2 };  // pt 13 : 5 noires (= 14 + 1 barre)
  // 14 + 1 = 15 noires ✓

  gameState.bar[2] = 1;   // 1 fiche noire sur la barre
  gameState.turn   = 2;   // tour de l'opposant (black)
  gameState.dice   = [];
  gameState.moves  = [];
  aiMode = true;          // active mode IA pour que black soit l'IA

  mockState = {
    points:  new Array(25).fill(0),
    bar:     { white: 0, black: 0 },
    off:     { white: 0, black: 0 },
    turn:    'white',
    dice:    [],
    phase:   'normal',
    players: {
      white: (typeof userNick !== 'undefined' && userNick) ? userNick : 'WHITE',
      black: aiMode ? 'COMPUTER' : 'OPPONENT',
    },
    timers:  null,
  };

  syncMockState();
  clearDice();
  // Lance via le flow normal : rollAndStart pour BLACK (l'opposant). Le check
  // isBarThrowImpossible va déclencher : pas de jet, cadres vides en surbrillance,
  // puis pass automatique vers white.
  rollAndStart(2);
}
