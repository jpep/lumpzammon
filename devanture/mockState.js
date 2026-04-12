// mockState.js
// Représente l'état du jeu backgammon pour le développement du skin.
//
// Convention des points :
//   points[n] > 0  →  n pièces blanches sur le point n
//   points[n] < 0  →  |n| pièces noires sur le point n
//   points[n] = 0  →  point vide
//
// Numérotation standard (perspective du joueur blanc) :
//   Blanc va de 24 → 1  (sens horaire)
//   Noir  va de 1  → 24 (sens anti-horaire)
//
//   Points 1-6   : home board blanc  (bas-droite)
//   Points 7-12  : outer board blanc (bas-gauche)
//   Points 13-18 : outer board noir  (haut-gauche)
//   Points 19-24 : home board noir   (haut-droite)

const SCENARIOS = {

  // ── Position initiale standard ──────────────────────────────────────────────
  initial: {
    points: [
      0,    // 0 : non utilisé (index 1-based)
      -2,   // 1 : 2 noirs
       0,   // 2
       0,   // 3
       0,   // 4
       0,   // 5
       5,   // 6 : 5 blancs
       0,   // 7
       3,   // 8 : 3 blancs
       0,   // 9
       0,   // 10
       0,   // 11
      -5,   // 12 : 5 noirs
       5,   // 13 : 5 blancs
       0,   // 14
       0,   // 15
       0,   // 16
      -3,   // 17 : 3 noirs
       0,   // 18
      -5,   // 19 : 5 noirs
       0,   // 20
       0,   // 21
       0,   // 22
       0,   // 23
       2,   // 24 : 2 blancs
    ],
    bar:   { white: 0, black: 0 },
    off:   { white: 0, black: 0 },
    dice:    [3, 5],
    turn:    'white',
    phase:   'playing',
    players: { white: 'USER 2', black: 'USER 1' },
    timers:  { move: 15, game: '01:59' },
  },

  // ── Milieu de partie – pièces sur la barre ──────────────────────────────────
  midgame: {
    points: [
      0,
      -2,  // 1
       0,0,0,
       3,  // 5
       3,  // 6
       0,
      -3,  // 8
       0,0,0,
      -4,  // 12
       4,  // 13
       0,0,0,
      -2,  // 17
       0,
      -3,  // 19
       0,0,0,0,  // 20-23
       2,        // 24 (blancs restants en route)
    ],
    bar:   { white: 1, black: 2 },
    off:   { white: 2, black: 1 },
    dice:    [2, 2],
    turn:    'black',
    phase:   'playing',
    players: { white: 'USER 2', black: 'USER 1' },
    timers:  { move: 15, game: '01:59' },
  },

  // ── Bearing off – fin de partie ─────────────────────────────────────────────
  bearingOff: {
    points: [
      0,
       2,  // 1
       1,  // 2
       3,  // 3
       2,  // 4
       3,  // 5
       2,  // 6
       0,0,0,0,0,0,0,0,0,0,0,0,
      -2,  // 19
      -3,  // 20
      -2,  // 21
      -3,  // 22
      -2,  // 23
      -1,  // 24
    ],
    bar:   { white: 0, black: 0 },
    off:   { white: 2, black: 2 },
    dice:    [4, 6],
    turn:    'white',
    phase:   'bearingOff',
    players: { white: 'USER 2', black: 'USER 1' },
    timers:  { move: 15, game: '01:59' },
  },

  // ── Test milieu de parcours : 3 pièces blanches en case 10, dés [2,5] ───────
  test1: {
    points: [
      0,
      0, 0, 0, 0, 0, 0, 0, 0, 0,   // 1–9
      3,                             // 10 : 3 blancs
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 11–24
    ],
    bar:   { white: 0, black: 0 },
    off:   { white: 0, black: 0 },
    dice:    [2, 5],
    turn:    'white',
    phase:   'playing',
    players: { white: 'USER 2', black: 'USER 1' },
    timers:  { move: 15, game: '01:59' },
  },
};

// Scénario actif — changer ici pour tester un autre état
let mockState = SCENARIOS.test1;
