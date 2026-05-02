// sketch.js – GOMMAN skin preview  [variante chromatique + fibre optique]
// ─────────────────────────────────────────────────────────────────────────────
// Géométrie : r, a = 2r, plateau 13a × 13a
// Raccourcis : [1][2][3][4] → scénarios
// ─────────────────────────────────────────────────────────────────────────────

let r, a, bx, by;
let diceOnSide = true;   // true = dés à gauche (paysage) ; false = dés au-dessus/dessous (portrait)
const MARGIN    = 24;
const MAX_STACK = 6;

// Zones cliquables mises à jour à chaque draw
let resignBtn = null;    // { x, y, w, h, player }
let cubeBtns  = { white: null, black: null };
let modalBtns = null;    // { yes, no, accept, decline, cancel }
let exitBtns  = [];      // zones cliquables précises (au lieu d'un seul gros rectangle)
let roomBtns  = [];      // [{ x, y, w, h, player }]
let nameBtns   = { white: null, black: null };  // zones cliquables sur le nom (overlay profil)
let nameBlockW = { white: 0, black: 0 };

// Overlay profil joueur : null (fermé) ou 'white'|'black' (ouvert sur ce joueur)
let profileOverlay = null;
// Bouton SIGN OUT dans l'overlay profil (visible uniquement sur le profil du LOCAL_PLAYER)
let signoutBtn     = null;
// Scroll vertical du tableau des dernières parties (en pixels, 0 = plus récent)
let recentGamesScroll = 0;
// État de drag tactile pour le scroll du tableau
let _scrollTouchY = null;
// Mode tactile dans l'overlay profil : 'scroll' | 'graph' | null
let _touchMode    = null;
// Vrai dès le 1er touch (pour distinguer un appareil tactile d'une souris)
let _hasTouched   = false;
// Zone du graphique de score (mise à jour à chaque frame par drawPlayerProfile)
let _chartZone    = null;
// Vrai si le tap courant a ouvert l'overlay profil (évite la fermeture immédiate)
let _profileOpenedAtTouch = false;

// Animation d'un mouvement (trajectoire parabolique) — visualisation pour IA / adversaire
let flyingChecker = null;   // { from, to, isWhite, fromX, fromY, toX, toY, t0, dur, onDone }

// Joueur local (l'utilisateur sur cet écran) — par défaut blanc pour les tests
const LOCAL_PLAYER = 'white';

// État "armé" du drapeau resign : true après un 1er click (compat tactile sans hover)
let resignArmed = false;

// Échelle des messages (modaux + overlays) — agrandi pour la lisibilité mobile
const MSG_SCALE = 1.3;

// Heure de début d'affichage du notice "double promise" (pour le fade out après 3s)
let doublePromiseT0 = null;

// État global de l'app : 'intro' (animation d'ouverture) | 'menu' (mode select)
//                       | 'signin' (saisie nickname) | 'game' (table)
//                       | 'room' (lobby) | 'waiting'
let appState   = 'intro';
let inviteTarget = null;

// ── Intro animée (cadre + GOMMAN synchronisés en creux, puis menu en fade) ───
let introT0 = 0;                      // millis() du début de la phase intro
const INTRO_DUR       = 2800;         // ms : durée commune du tracé cadre + fade titre (synchrones, plus lents)
const INTRO_MENU_FADE = 1200;         // ms : fade-in des options de jeu après l'intro (plus lent)

let menuT0 = 0;                       // millis() du début de la phase menu (pour le fade-in des boutons)
// Mode de jeu sélectionné depuis le menu d'accueil ('local' | 'ai' | 'online')
let gameModeSelected = null;
let menuBtns = [];                    // boutons cliquables du menu d'accueil
// Transition menu → game : fade-out de la fenêtre noire translucide pour
// révéler le plateau, puis enchaîne sur le wave d'apparition.
let menuFadeOutT0 = 0;
const MENU_FADE_OUT_DUR = 600;        // ms : durée du fade-out du voile menu

// ── Transition fluide des tailles nom/info à chaque changement de tour ──────
// prevTurn et currentTurn permettent d'interpoler les tailles entre l'ancien
// et le nouveau tour pendant TURN_FADE_DUR ms. Easing smootherstep (quintique
// Perlin) → progression très moelleuse, dérivée nulle aux extrêmes, pas de
// snap au début ni à l'arrivée.
let prevTurn      = null;
let currentTurn   = null;
let turnChangeT0  = 0;
const TURN_FADE_DUR = 550;            // ms : transition allongée pour souplesse

// ── Animation de remplissage du plateau (1ère entrée en partie) ──────────────
// Triangles "poussent" depuis la base vers la pointe avec deux courants
// croisés : les PAIRS (2,4,…,24) propagent dans le sens 2→24 (delay croissant
// avec pt), les IMPAIRS (1,3,…,23) dans le sens 23→1 (delay croissant quand
// pt décroît). Deux vagues simultanées qui se croisent visuellement.
// Une fois la dernière pousse terminée, startGame() est appelée → opening
// roll + apparition des fiches.
let gameFillT0 = 0;
const FILL_PT_STEP = 55;              // ms : décalage entre triangles d'une même vague
const FILL_PER_TRI = 700;             // ms : durée de pousse individuelle
// Total = (12 triangles - 1) * step + duration = 11 * 55 + 700 = 1305 ms
const FILL_TOTAL_DUR = 11 * FILL_PT_STEP + FILL_PER_TRI;
// Animation de la barre centrale : ligne unique au milieu qui se sépare en
// deux jusqu'à atteindre les bords finaux de la barre (largeur a). Démarre
// en même temps que le fill des triangles.
const BAR_APPEAR_DUR = 700;

// ── Constantes du wave de remplissage du plateau (1ère apparition) ─────────
// Chaque triangle se construit en 2 phases (bar fine r/6 → paliers en cascade
// smootherstep) sur TEST_PAIR_FADE_DUR ms, avec un décalage TEST_PAIR_STEP ms
// entre triangles consécutifs (chevauchement temporel pour fluidité).
// Pairs : depuis pt 12 (BL) en CCW → 12, 10, …, 14
// Impairs : depuis pt 13 (TL) en CW  → 13, 15, …, 11
// Les deux waves partent simultanément des coins opposés du bord gauche.
const TEST_PAIR_STEP      = 110;      // plus court → encore plus d'overlap (90 %)
const TEST_PAIR_FADE_DUR  = 1100;     // plus long → construction très douce
const TEST_PAIR_ORDER   = [12, 10, 8, 6, 4, 2, 24, 22, 20, 18, 16, 14];
const TEST_IMPAIR_ORDER = [13, 15, 17, 19, 21, 23, 1, 3, 5, 7, 9, 11];
let _testFillP = null;                 // legacy hook (gardé pour compat drawTri)

// ── Délai d'apparition pour le triangle pt ──────────────────────────────────
// Deux particules tracent le périmètre du plateau dans des sens OPPOSÉS :
//   - IMPAIRS : depuis pt 1 (BR), sens horaire (CW visuel)
//     → 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23
//   - PAIRS  : depuis pt 12 (BL), sens anti-horaire (CCW visuel)
//     → 12, 10, 8, 6, 4, 2, 24, 22, 20, 18, 16, 14
// Les deux partent simultanément des deux EXTRÉMITÉS OPPOSÉES de la rangée
// du bas (BR + BL) et circulent en sens contraires : ils se croisent à la
// barre du bot, basculent sur le top en positions opposées, se croisent à
// la barre du top, et reviennent. Aucune symétrie miroir.
//
// Mode MIRROR : start points = pt 13 + pt 12 (qui sont visuellement à droite
// après le flip). Sens visuel inversé pour rester cohérent (CW visuel =
// logical CCW, et inversement).
function triFillStartDelay(pt) {
  const isImpair = (pt % 2 === 1);
  const isMirror = (typeof mirrorMode !== 'undefined' && mirrorMode);
  let dist;
  if (isImpair) {
    if (!isMirror) {
      // Normal : impair CW depuis pt 1 (sens des pt croissants)
      dist = ((pt - 1 + 24) % 24) / 2;
    } else {
      // Mirror : impair "CW visuel" = logical CCW depuis pt 13
      dist = ((13 - pt + 24) % 24) / 2;
    }
  } else {
    if (!isMirror) {
      // Normal : pair CCW depuis pt 12 (sens des pt décroissants)
      dist = ((12 - pt + 24) % 24) / 2;
    } else {
      // Mirror : pair "CCW visuel" = logical CW depuis pt 12
      dist = ((pt - 12 + 24) % 24) / 2;
    }
  }
  return dist * FILL_PT_STEP;
}

// Délai d'apparition pour le pt dans la nouvelle séquence test (= position
// dans TEST_PAIR_ORDER ou TEST_IMPAIR_ORDER × TEST_PAIR_STEP).
function triNewFillDelay(pt) {
  const pi = TEST_PAIR_ORDER.indexOf(pt);
  if (pi >= 0) return pi * TEST_PAIR_STEP;
  const ii = TEST_IMPAIR_ORDER.indexOf(pt);
  if (ii >= 0) return ii * TEST_PAIR_STEP;
  return 0;
}

// ── Apparition progressive des fiches (initial conditions) ──────────────────
// Chaque pièce apparaît à sa COULEUR FINALE dès que son moment d'arrivée
// est atteint. Pas de fade-in alpha — juste une visibilité gated par delay.
//   - Délai par PT = triNewFillDelay(pt) (même que les triangles : pair depuis
//     pt 12 / impair depuis pt 13).
//   - Mini-décalage par position dans la pile (CHK_FADE_PER_STACK).
// checkerAppearT0 = 0 → fiches visibles immédiatement (default).
// checkerAppearT0 > 0 → progressivement visibles selon le délai per-piece.
let checkerAppearT0 = 0;
const CHK_FADE_PER_STACK = 60;        // ms entre pièces d'un même stack
const CHK_FADE_DUR       = 350;       // ms : durée du fade-in d'une pièce (legacy, plus utilisé)
function checkerFadeAlpha(pt, stackIdx) {
  if (checkerAppearT0 === 0) return 1;
  const elapsed = millis() - checkerAppearT0;
  const ptDelay    = triNewFillDelay(pt);                  // même séquence que triangles
  const stackDelay = (stackIdx || 0) * CHK_FADE_PER_STACK;
  const local = elapsed - ptDelay - stackDelay;
  return (local >= 0) ? 1 : 0;                              // visibilité on/off, couleur finale immédiate
}

// Nickname utilisateur (clé localStorage 'bg:nick' partagée avec le repo jpep)
// Pas de vérification d'identité : on prend tel quel ce que l'utilisateur saisit.
// L'unicité (pour rattacher les stats) est supposée respectée par convention pour l'instant.
const NICK_STORAGE_KEY = 'bg:nick';
let userNick = null;            // nickname courant (string ou null si pas encore saisi)
let signinInputEl = null;       // <input> HTML : nickname (full) ou guest name
let signinPassEl  = null;       // <input> HTML : password (full uniquement)
let signinMode    = 'choice';   // 'choice' | 'full' | 'guest'
let signinChoiceBtns = [];      // boutons cliquables SIGN IN / GUEST

// Liste mockée de joueurs dans le room (à brancher sur le multijoueur jpep)
const ROOM_PLAYERS = [
  { name: 'ALICE',   online: true,  busy: false },
  { name: 'BOB',     online: true,  busy: true  },
  { name: 'CHARLIE', online: true,  busy: false },
  { name: 'DIANA',   online: true,  busy: false },
  { name: 'EVE',     online: false, busy: false },
];

let fontLarge, fontSmall, fontMed;
// Chaîne CSS de fallback pour les noms : nortechico (pixel) FORCÉ en premier,
// puis Noto Sans pour les caractères qu'il n'a pas. Le browser pioche
// par-caractère ; nortechico est déclaré explicitement en @font-face dans
// index.html pour garantir qu'il soit toujours résolu en premier.
const NAME_FONT_CSS =
  "'nortechico','nortechico 100','nortechico-100','Noto Sans','Noto Sans JP','Noto Sans SC','Noto Sans Arabic',sans-serif";
// Variante PIX-60 (light) avec fallback Noto Sans pour les dingbats absents
// (utilisée par le notice de doublage par exemple).
const PIX60_FONT_CSS =
  "'nortechico-60','Noto Sans','sans-serif'";

// Helper : dessine un nom (avec fallback Noto Sans) directement via le canvas
// 2D context (bypass de p5 textFont qui ne gère pas la chaîne CSS multi-fonte).
// Retourne la largeur réellement mesurée pour que l'appelant chaîne les segments.
function drawNameText(name, x, y, sz, col, baseline) {
  const ctx = drawingContext;
  ctx.save();
  ctx.font         = `${sz}px ${NAME_FONT_CSS}`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = baseline || 'top';
  ctx.fillStyle    = `rgb(${red(col)},${green(col)},${blue(col)})`;
  ctx.fillText(name, x, y);
  const w = ctx.measureText(name).width;
  ctx.restore();
  return w;
}


// ── Palette globale (accessible depuis dice.js) ───────────────────────────────
let C;
let bgImage;
let dominantHue = 0;   // extrait du fond au setup (mis à jour à chaque nouvelle partie)

// Pool de fonds — l'un est tiré aléatoirement à chaque nouvelle partie (touche [m])
const FOND_LIST = ['fond.jpg', 'fond0.jpg', 'fond1.jpg', 'fond2.jpg',
                   'fond4.jpg'];
let currentFond = 'fond.jpg';
let mirrorMode  = false;   // bascule l'orientation des fiches d'une partie à l'autre

function preload() {
  // Choix aléatoire d'un fond pour la 1ʳᵉ partie
  currentFond = FOND_LIST[Math.floor(Math.random() * FOND_LIST.length)];
  bgImage     = loadImage(currentFond);
  fontLarge   = loadFont('fonts/nortechico-100.otf');
  fontSmall   = loadFont('fonts/nortechico-60.otf');
  fontMed     = loadFont('fonts/nortechico-80.otf');   // poids intermédiaire
}

// Extrait la teinte dominante de l'image (moyenne circulaire, pixels saturés seulement)
function extractDominantHue(img) {
  img.loadPixels();
  const step = max(1, floor(img.width / 20));
  let sinSum = 0, cosSum = 0, count = 0;
  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const i  = (y * img.width + x) * 4;
      const pr = img.pixels[i] / 255;
      const pg = img.pixels[i+1] / 255;
      const pb = img.pixels[i+2] / 255;
      const mx = Math.max(pr, pg, pb);
      const mn = Math.min(pr, pg, pb);
      const d  = mx - mn;
      const sat = mx > 0 ? d / mx : 0;
      if (sat < 0.15 || mx < 0.10 || mx > 0.92) continue;
      let h = 0;
      if (d > 0) {
        if      (mx === pr) h = ((pg - pb) / d + 6) % 6;
        else if (mx === pg) h = (pb - pr) / d + 2;
        else                h = (pr - pg) / d + 4;
        h = h * 60;
      }
      sinSum += Math.sin(h * Math.PI / 180);
      cosSum += Math.cos(h * Math.PI / 180);
      count++;
    }
  }
  if (count === 0) return 0;   // fallback rouge/corail si image terne
  return (Math.atan2(sinSum / count, cosSum / count) * 180 / Math.PI + 360) % 360;
}

// Palette monochrome dérivée de la teinte dominante de fond.jpg
// Les % d'opacité sont fixes ; la teinte suit l'image.
function buildPalette() {
  // Si la teinte tombe dans le violet (270-330°), on l'écarte vers le rouge profond
  // pour éviter les rendus chromatiques bizarres sur certains fonds.
  let h = dominantHue;
  if (h >= 270 && h <= 330) h = (h < 300) ? 260 : 340;
  colorMode(HSB, 360, 100, 100, 255);
  C = {
    bg:       color(h, 22,  96, 255),
    board:    color(h, 52,  62, 153),
    // Triangles : COULEUR UNIQUE sombre (B=18 < board B=62) → plus sombre que
    // le plateau mais translucide. B=18 = 10% plus sombre que B=20 précédent.
    // Différence pair vs impair = ~20% d'alpha pour distinguer les cases.
    triA:     color(h, 50,  18, 160),    // pair  : alpha 160 (~63%)
    triB:     color(h, 50,  18, 110),    // impair : alpha 110 (~43%, ~20% de moins)
    bar:      color(h, 42,  52, 153),
    ivory:    color(h,  8,  97, 255),
    ruby:     color(h, 45,  20, 255),    // fiche noire (lum 10→20, plus visible)
    offwhite: color(h, 12,  92, 255),
    numColor: color(h, 90,  10, 255),    // numéros très foncés (16 → 10)
    fiberDot: color(h,  5, 100, 255),
    fiberSnap:color(h, 32, 100, 255),
    // Couleurs deltas profil joueur :
    // gainBlue : bleu pastel un peu désaturé pour les +points (victoires)
    // lossRed  : rouge bordeaux/pétrole pour les −points (défaites)
    gainBlue: color(210, 35, 78, 255),
    lossRed:  color(355, 55, 50, 255),
  };
  colorMode(RGB, 255, 255, 255, 255);
}

// ── Drag ─────────────────────────────────────────────────────────────────────
let drag = {
  active: false, fromPt: null,
  mouseX: 0, mouseY: 0,
  dispX:  0, dispY:  0,
  snapPt: null,
  numPieces: 1,   // multi-pickup pour les doubles
};

// ── Géométrie responsive ──────────────────────────────────────────────────────
const NAMES_W_A = 9;   // largeur réservée à droite (a-units) pour nom + super + score + cube + drapeau
                       // (passé de 7 à 9 pour accueillir des nicknames plus longs en paysage)

function computeGeometry() {
  diceOnSide = windowWidth >= windowHeight * 1.1;   // paysage → dés à gauche

  if (diceOnSide) {
    // Plateau centré dans la fenêtre. Marges symétriques = max(3.5a dés, NAMES_W_A·a noms).
    // Vertical : marge r*1.2 au-dessus et en-dessous pour les numéros 1-24.
    const maxW = windowWidth  - 2 * MARGIN;
    const maxH = windowHeight - 2 * MARGIN;
    const sideA  = Math.max(3.5, NAMES_W_A);
    const totalA = 13 + 2 * sideA;
    const totalH = 13 + 1.2;
    a  = min(maxW / totalA, maxH / totalH);
    // Sur desktop large (paysage en taille de fenêtre pleine), réduire de 20%
    // l'ensemble pour aérer le rendu et garder un rapport agréable au vide.
    if (windowWidth >= 900) a *= 0.80;
    r  = a / 2;
    bx = (windowWidth  - 13*a) / 2;
    by = (windowHeight - 13*a) / 2;
  } else {
    // Dés au-dessus (noir) et en-dessous (blanc).
    // Bloc texte = 2 lignes (szN + gap + szP = 3.5r) → même hauteur que les dés.
    // Le tout (dé+gap+plateau+gap+dé) est centré verticalement dans la fenêtre.
    const maxH = (windowHeight - 2 * MARGIN) * 26 / 39.5;
    const maxW = windowWidth  - 2 * MARGIN;
    const side = min(maxW, maxH);
    a  = side / 13;
    r  = a / 2;
    bx = (windowWidth  - 13*a) / 2;
    // Centrage vertical : block vertical = dé(3.5r) + gap(r*1.6) + plateau(13a) + gap(r*1.6) + dé(3.5r)
    const block  = dieSize() + r * 1.6;          // 5.1r de chaque côté
    const totalH = 2 * block + 13 * a;
    const vide   = max(0, windowHeight - totalH);
    by = vide / 2 + block;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(30);
  computeGeometry();
  dominantHue = extractDominantHue(bgImage);
  buildPalette();
  document.body.style.backgroundImage = `url('${currentFond}')`;

  // Lecture du nickname (clé partagée avec jpep) — utilisé après l'intro
  try { userNick = localStorage.getItem(NICK_STORAGE_KEY); }
  catch (e) { userNick = null; }
  if (userNick) applyUserNick(userNick);

  // Toujours démarrer par l'intro animée (GOMMAN + cadre en tracé)
  appState = 'intro';
  introT0  = millis();
}

// Propage le nickname à mockState (et à PLAYER_PROFILES si présent) pour que
// le LOCAL_PLAYER ('white' par convention) soit affiché partout avec ce nom.
function applyUserNick(nick) {
  userNick = nick;
  if (typeof mockState !== 'undefined' && mockState && mockState.players) {
    mockState.players.white = nick;
    mockState.players.black = aiMode ? 'COMPUTER' : (mockState.players.black || 'OPPONENT');
  }
  // Met à jour le profil joueur local (si présent) avec le nickname
  if (typeof PLAYER_PROFILES !== 'undefined' && PLAYER_PROFILES.white) {
    PLAYER_PROFILES.white.name = nick;
  }
}

// ── Nouvelle partie : random fond + bascule miroir ────────────────────────────
function newMatch() {
  // Tire un fond différent du courant (si possible)
  let next = currentFond;
  if (FOND_LIST.length > 1) {
    while (next === currentFond) {
      next = FOND_LIST[Math.floor(Math.random() * FOND_LIST.length)];
    }
  }
  currentFond = next;
  loadImage(currentFond, (img) => {
    bgImage = img;
    dominantHue = extractDominantHue(img);
    buildPalette();
    document.body.style.backgroundImage = `url('${currentFond}')`;
  });
  mirrorMode = !mirrorMode;
  // TODO: la bascule effective des positions/orientation viendra avec l'intégration jpep
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeGeometry();
  buildPalette();
  rescaleDice();
}

// Helpers mirror : axe de symétrie horizontale = centre du plateau
function mirrorX(x)   { return 2 * (bx + 6.5*a) - x; }
function effMouseX()  { return mirrorMode ? mirrorX(mouseX) : mouseX; }

// ── Boucle principale ─────────────────────────────────────────────────────────
function draw() {
  clear();

  // Intro animée (GOMMAN + tracé du cadre) — couvre toute la fenêtre, ne dessine
  // PAS le plateau dessous. Quand l'intro est terminée, on bascule sur 'menu'
  // (ou 'signin' si pas de nickname).
  if (appState === 'intro')   { drawIntro();   return; }
  if (appState === 'menu')    { drawMenu();    return; }

  // ── Transition menu → game : fade-out de la fenêtre noire translucide ──────
  // Le plateau (fond seulement) apparaît progressivement, puis le wave démarre.
  if (menuFadeOutT0 > 0) {
    const elapsed = millis() - menuFadeOutT0;
    const fadeP   = Math.min(1, elapsed / MENU_FADE_OUT_DUR);

    // Fond du plateau (toujours visible, révélé au fur et à mesure)
    push();
    if (mirrorMode) { translate(2 * (bx + 6.5*a), 0); scale(-1, 1); }
    noStroke(); fill(C.board);
    rect(bx, by, 13*a, 13*a);
    pop();

    // Menu rendu PAR-DESSUS avec alpha décroissant
    drawingContext.save();
    drawingContext.globalAlpha = 1 - fadeP;
    drawMenu();
    drawingContext.restore();

    if (fadeP >= 1) {
      menuFadeOutT0 = 0;
      // Démarre le wave : barre → triangles → pause → fiches → pause → 1er dé
      gameFillT0 = millis();
      const waveDur = 11 * TEST_PAIR_STEP + TEST_PAIR_FADE_DUR;
      const POST_TRI_PAUSE = 300;
      const maxPieceTime   = 11 * TEST_PAIR_STEP + 4 * CHK_FADE_PER_STACK;
      const POST_PLACEMENT_PAUSE = 600;
      checkerAppearT0 = millis() + BAR_APPEAR_DUR + waveDur + POST_TRI_PAUSE;
      const openingDelay = BAR_APPEAR_DUR + waveDur + POST_TRI_PAUSE + maxPieceTime + POST_PLACEMENT_PAUSE;
      if (typeof startGame === 'function') startGame(openingDelay);
    }
    return;
  }

  // ── Animation de remplissage du plateau (1ère entrée en partie) ───────────
  // drawBoard() anime la barre + les triangles (drawTri détecte gameFillT0).
  // drawCheckers() rend les fiches qui sont déjà placées dans mockState
  // (startGame a été appelée dès le menu click avec un long openingDelay).
  // Chaque fiche est gated par checkerFadeAlpha → visible 0/1 selon son delay.
  if (gameFillT0 > 0) {
    push();
    if (mirrorMode) { translate(2 * (bx + 6.5*a), 0); scale(-1, 1); }
    drawBoard();
    drawCheckers();
    pop();

    const elapsed = millis() - gameFillT0;
    const waveDur = 11 * TEST_PAIR_STEP + TEST_PAIR_FADE_DUR;
    const POST_TRI_PAUSE = 300;
    const maxPieceTime = 11 * TEST_PAIR_STEP + 4 * CHK_FADE_PER_STACK;
    const fullFillDur = BAR_APPEAR_DUR + waveDur + POST_TRI_PAUSE + maxPieceTime;
    if (elapsed >= fullFillDur) {
      gameFillT0 = 0;
      checkerAppearT0 = 0;   // wave + fiches placées : gating off, tout visible
    }
    return;
  }

  // Zone "plateau" : flip horizontal en mirror (board + checkers + drag + off + flying)
  push();
  if (mirrorMode) {
    translate(2 * (bx + 6.5*a), 0);
    scale(-1, 1);
  }
  drawBoard();
  drawCheckers();
  if (drag.active) {
    updateDragDisplay();
    drawDraggedChecker();
  }
  drawFlyingChecker();
  pop();

  // Bearing off : toujours à droite (hors flip mirror) pour éviter les chevauchements
  drawOff();

  // Hors flip (textes lisibles + UI) : positions ajustées via mirrorX si nécessaire
  drawPointNumbers();
  updateDiceAnim();
  drawAllDice();
  drawPlayerInfo();
  drawInfo();
  drawDoublePromiseNotice();
  drawModal();
  if (gameMode && gameWinner) drawGameOver();
  if (appState === 'room')    drawRoom();
  if (appState === 'waiting') drawWaiting();
  drawPlayerProfile();   // overlay profil joueur (clic sur nom)
  // EXIT en dernier pour qu'il soit toujours visible (room, game-over, jeu, overlay profil)
  drawExitButton();
  // Sign-in en couvre-tout — dessiné en dernier pour être au-dessus
  if (appState === 'signin') drawSignin();
  else if (signinInputEl) destroySigninInput();
}

// ── Helpers d'easing pour l'intro ────────────────────────────────────────────
function easeOutCubic(t)  { return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
function easeInCubic(t)   { return t * t * t; }
function easeInQuart(t)   { return t * t * t * t; }
// Smootherstep (Perlin) : courbe quintique super-douce aux deux extrêmes,
// dérivée et dérivée seconde nulles à 0 et 1 → transition très "moelleuse".
function smootherstep(t)  { return t * t * t * (t * (t * 6 - 15) + 10); }
// easeOutBack très doux : ressort à l'arrivée avec ~1 % d'overshoot — donne
// une sensation d'élasticité subtile sans débordement visible.
function easeOutBackGentle(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 0.6;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── Mesure et taille du titre GOMMAN qui s'inscrit dans le carré du plateau ──
// Retourne { size, width } adapté pour que la largeur reste à ≤ 85% de 13a.
function gommanTitleMetrics() {
  const ctx = drawingContext;
  let sz = a * 2.0;                       // taille initiale (~2a / lettre)
  ctx.font = `${sz}px ${NAME_FONT_CSS}`;
  let w = ctx.measureText('GOMMAN').width;
  const maxW = 13 * a * 0.85;
  if (w > maxW) {
    sz *= maxW / w;
    ctx.font = `${sz}px ${NAME_FONT_CSS}`;
    w = ctx.measureText('GOMMAN').width;
  }
  return { size: sz, width: w };
}

// ── Dessine GOMMAN "en creux" (destination-out) + voile blanc translucide ───
// titleAlpha ∈ [0,1] : 0 = invisible, 1 = creux maximal.
// Positionné dans la PARTIE HAUTE du cadre (≈ 28 % de hauteur depuis le haut).
// Step 1 : destination-out sur le voile sombre → révèle le fond.
// Step 2 : source-over blanc translucide → ajoute du contraste si le fond
// est trop sombre (le pixel résultant = blanc 35 % + fond 65 %).
function drawGommanHollow(titleAlpha) {
  const ctx = drawingContext;
  const cxC = bx + 13 * a / 2;
  const cyC = by + 13 * a * 0.28;     // titre en haut du cadre, pas centré
  const m = gommanTitleMetrics();
  ctx.save();
  ctx.font = `${m.size}px ${NAME_FONT_CSS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Step 1 : creux (révèle le fond)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${titleAlpha})`;
  ctx.fillText('GOMMAN', cxC, cyC);
  // Step 2 : voile blanc translucide pour le contraste sur fond sombre
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(255,255,255,${0.35 * titleAlpha})`;
  ctx.fillText('GOMMAN', cxC, cyC);
  ctx.restore();
}

// ── Trace les deux côtés + bas du cadre depuis le point haut-centre ──────────
// progress ∈ [0,1] : 0 = rien tracé, 1 = cadre complet (sans le bord supérieur).
// Deux "stylos" partent du milieu haut, descendent les côtés et se rejoignent
// au milieu bas. Tracé en deux passes : creux (destination-out) + voile blanc
// translucide (source-over) pour le contraste sur fond sombre.
function drawIntroFrame(progress) {
  const ctx = drawingContext;
  const cxC = bx + 13 * a / 2;
  const lenPath = 13 * a / 2 + 13 * a + 13 * a / 2;   // 26a par stylo
  const drawn = lenPath * progress;

  // Construction d'un sous-chemin pour un stylo (factorisé pour 2 passes)
  function buildPenPath(direction) {
    let rem = drawn;
    let x = cxC, y = by;
    ctx.beginPath();
    ctx.moveTo(x, y);
    {
      const seg = 13 * a / 2;
      const step = Math.min(seg, rem);
      x += direction * step;
      ctx.lineTo(x, y);
      rem -= step;
    }
    if (rem > 0) {
      const seg = 13 * a;
      const step = Math.min(seg, rem);
      y += step;
      ctx.lineTo(x, y);
      rem -= step;
    }
    if (rem > 0) {
      const step = Math.min(13 * a / 2, rem);
      x -= direction * step;
      ctx.lineTo(x, y);
    }
  }

  ctx.save();
  ctx.lineWidth = 2.0;                 // même épaisseur que le contour du plateau
  ctx.lineCap = 'butt';

  // Pass 1 : creux (destination-out)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = 'rgba(0,0,0,1)';
  buildPenPath(-1); ctx.stroke();
  buildPenPath(+1); ctx.stroke();

  // Pass 2 : voile blanc translucide (boost le contraste sur fond sombre)
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  buildPenPath(-1); ctx.stroke();
  buildPenPath(+1); ctx.stroke();

  ctx.restore();
}

// ── Voile sombre style "messages" (alpha ≈ 220/255) ──────────────────────────
function drawMessageVeil(alpha) {
  const ctx = drawingContext;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha !== undefined ? alpha : 0.86})`;
  ctx.fillRect(0, 0, windowWidth, windowHeight);
  ctx.restore();
}

// ── Intro animée : cadre + GOMMAN synchrones (même fenêtre INTRO_DUR)
// Le cadre se trace (easeInOutCubic, plus doux) en MÊME TEMPS que GOMMAN
// fade-in (easeOutCubic). Tous deux finissent à INTRO_DUR. ENSUITE seulement
// les options de jeu apparaissent (drawMenu/drawSignin avec leur propre fade).
function drawIntro() {
  const elapsed = millis() - introT0;
  const t = Math.min(1, elapsed / INTRO_DUR);

  drawMessageVeil(0.86);
  // Cadre : easeInOutCubic — tracé fluide, mi-parcours visuel à mi-temps.
  // Titre : easeInQuart (t⁴) — fade-in beaucoup plus lent au début. Sans ça,
  // les lettres sont déjà reconnaissables à 0.5 d'opacité alors que le cadre
  // n'est qu'à mi-tracé, donnant l'impression que le texte "finit avant".
  // easeInQuart : à t=0.5 → 0.0625 (presque invisible), à t=0.8 → 0.41,
  // à t=1.0 → 1.0. La perception visuelle est alors alignée avec le cadre.
  drawIntroFrame(easeInOutCubic(t));
  drawGommanHollow(easeInQuart(t));

  if (t >= 1) {
    // Après l'intro on présente toujours le sign-in/choice (même si un
    // nickname est déjà stocké) → le joueur peut basculer vers GUEST ou
    // re-saisir son nick à chaque session.
    appState = 'signin';
    signinMode = 'choice';                  // reset pour garantir l'écran choice
    menuT0   = millis();                    // démarre le fade-in des options
  }
}

// Animation de construction d'un triangle (utilisée pendant le wave de
// remplissage du plateau) :
//   Phase 1 (fillP < PHASE1_END) : la barre de largeur r/6 apparaît
//     INSTANTANÉMENT à pleine hauteur (6a) depuis la base jusqu'à la pointe.
//     C'est juste un trait fin dressé qui couvre tout le segment du triangle.
//   Phase 2 (fillP ≥ PHASE1_END) : chaque palier s'épaissit séquentiellement
//     du BAS vers le HAUT, héritant la "vague" du palier précédent. Chaque
//     palier interpole sa largeur de r/6 jusqu'à sa wA × a finale (différente
//     selon l'étage). Cascade du bas (palier 0) vers la pointe (palier 6).
function drawTestTriStaircase(pt, fillP, overrideColor, veilAlpha) {
  let x, baseY, pointUp;
  if (pt >= 1 && pt <= 6) {
    x = bx + (13 - pt) * a; baseY = by + 13*a; pointUp = true;
  } else if (pt >= 7 && pt <= 12) {
    x = bx + (12 - pt) * a; baseY = by + 13*a; pointUp = true;
  } else if (pt >= 13 && pt <= 18) {
    x = bx + (pt - 13) * a; baseY = by; pointUp = false;
  } else {
    x = bx + (pt - 12) * a; baseY = by; pointUp = false;
  }

  noStroke();
  // Si une couleur override est fournie (ex: tous les impairs en triB pour
  // les distinguer des pairs), on l'utilise. Sinon on reprend la couleur du
  // cas existant via triColorForPoint(pt).
  fill(overrideColor || triColorForPoint(pt));
  const cx = x + a / 2;

  // Hauteur cumulée jusqu'au top de chaque palier (en unités de a)
  const cumH = [];
  let acc = 0;
  for (let k = 0; k < TRI_LAYERS.length; k++) {
    acc += TRI_LAYERS[k].hA;
    cumH.push(acc);
  }
  const startW       = r / 6;          // largeur initiale fine (= a/12)
  const startH       = r;              // hauteur initiale de la "barre" (= a/2)
  const finalH       = 6 * a;          // hauteur finale (toute la hauteur du triangle)
  const PHASE1_END   = 0.35;           // fillP : fin de la croissance en hauteur de la barre
  const WIDEN_START  = 0.175;          // fillP : ~mi-phase1 → barre ≈ 3a → palier 0 démarre

  // ── HAUTEUR COURANTE DE LA "BARRE" (= cap maximum de visibilité) ──────────
  // La barre n'est PAS dessinée séparément. À la place, chaque palier est
  // CLIPÉ à la hauteur courante de la barre. Au début, seule palier 0 est
  // visible (au sein de la base). Plus h grandit, plus de paliers deviennent
  // visibles (du bas vers le haut). Pas de double-stacking d'opacité.
  const phase1 = Math.min(1, fillP / PHASE1_END);
  const h = startH + (finalH - startH) * smootherstep(phase1);

  // ── PHASE 2 : largeur des paliers (épaississement en cascade) ────────────
  const phase2 = fillP >= WIDEN_START ? (fillP - WIDEN_START) / (1 - WIDEN_START) : 0;
  const N = TRI_LAYERS.length;

  for (let i = 0; i < N; i++) {
    const cumPrev = i > 0 ? cumH[i - 1] : 0;
    // Y range naturel du palier i
    const palierTopY    = pointUp ? baseY - cumH[i] * a : baseY + cumPrev * a;
    const palierBottomY = pointUp ? baseY - cumPrev * a : baseY + cumH[i] * a;
    // Clip par la hauteur courante de la barre
    let visTopY, visBotY;
    if (pointUp) {
      const barTopY = baseY - h;
      visTopY = Math.max(palierTopY, barTopY);
      visBotY = palierBottomY;
    } else {
      const barBotY = baseY + h;
      visTopY = palierTopY;
      visBotY = Math.min(palierBottomY, barBotY);
    }
    if (visBotY <= visTopY) continue;   // palier au-delà du cap de la barre

    // Largeur du palier : easeOutBackGentle pour une touche d'élasticité
    // (~1 % d'overshoot à l'arrivée) → sensation de "boing" subtile.
    // Math.max(startW, …) garantit la largeur MINIMALE r/6.
    const p2Start = i / N;
    const p2End   = (i + 1) / N;
    const p2Local = Math.max(0, Math.min(1, (phase2 - p2Start) / (p2End - p2Start)));
    const finalW  = TRI_LAYERS[i].wA * a;
    const w       = Math.max(startW, startW + (finalW - startW) * easeOutBackGentle(p2Local));

    rect(cx - w / 2, visTopY, w, visBotY - visTopY);
  }

  // Seconde passe : voile blanc translucide PAR-DESSUS (si veilAlpha > 0)
  // → "couleur sombre + voile" pour distinguer les impairs des pairs.
  if (veilAlpha > 0) {
    fill(255, 255, 255, Math.round(255 * veilAlpha));
    for (let i = 0; i < N; i++) {
      const cumPrev = i > 0 ? cumH[i - 1] : 0;
      const p2Start = i / N;
      const p2End   = (i + 1) / N;
      const p2Local = Math.max(0, Math.min(1, (phase2 - p2Start) / (p2End - p2Start)));
      const finalW  = TRI_LAYERS[i].wA * a;
      const w       = startW + (finalW - startW) * smootherstep(p2Local);
      const h       = TRI_LAYERS[i].hA * a;
      const topY    = pointUp ? baseY - cumH[i] * a : baseY + cumPrev * a;
      rect(cx - w / 2, topY, w, h);
    }
  }
}

// ── Menu d'accueil : cadre + GOMMAN figés + options en fade-in ──────────────
function drawMenu() {
  drawMessageVeil(0.86);
  drawIntroFrame(1.0);
  drawGommanHollow(1.0);

  const elapsedMenu = menuT0 ? (millis() - menuT0) : INTRO_MENU_FADE;
  const menuP = Math.min(1, elapsedMenu / INTRO_MENU_FADE);
  drawMenuOptions(easeOutCubic(menuP));
}

// ── Helper : dessine les boutons de sélection de mode avec alpha global ─────
function drawMenuOptions(alpha) {
  menuBtns = [];
  const buttons = [
    { id: 'local',  label: 'LOCAL  (2 PLAYERS)' },
    { id: 'ai',     label: 'VS  COMPUTER' },
    { id: 'online', label: 'ONLINE' },
  ];
  const cxC = bx + 13 * a / 2;
  const btnSize = r * 0.95 * MSG_SCALE;
  const gap     = btnSize * 0.65;
  const startY  = by + 13 * a * 0.50;     // sous GOMMAN, dans le cadre

  textFont(fontLarge);
  textSize(btnSize);
  textAlign(CENTER, TOP);
  noStroke();

  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const ty = startY + i * (btnSize + gap);
    const tw = textWidth(b.label);
    const isHover = mouseX >= cxC - tw/2 - btnSize*0.4 && mouseX <= cxC + tw/2 + btnSize*0.4
                 && mouseY >= ty - btnSize*0.2 && mouseY <= ty + btnSize * 1.2;
    // Surbrillance simple : 100 % d'opacité au hover, 50 % sinon. Pas de halo
    // ni de crochets — juste la modulation alpha sur la couleur ivoire.
    const opa = isHover ? 255 : 128;
    fill(red(C.ivory), green(C.ivory), blue(C.ivory), opa * alpha);
    text(b.label, cxC, ty);
    // Zone cliquable activée seulement quand le fade-in est ≥ 90 %.
    if (alpha >= 0.9) {
      menuBtns.push({
        x: cxC - tw/2 - btnSize*0.6, y: ty - btnSize*0.2,
        w: tw + btnSize*1.2, h: btnSize * 1.4,
        id: b.id,
      });
    }
  }
}

// ── Sign-in : saisie du nickname (clé localStorage 'bg:nick' partagée jpep) ──
// Affiché SOUS le cadre GOMMAN (même base visuelle que l'intro/menu).
// L'input HTML overlay donne accès au clavier natif mobile.
function drawSignin() {
  // Cadre + GOMMAN figés + options du sign-in en fade-in
  drawMessageVeil(0.86);
  drawIntroFrame(1.0);
  drawGommanHollow(1.0);

  const elapsedMenu = menuT0 ? (millis() - menuT0) : INTRO_MENU_FADE;
  const menuP = Math.min(1, elapsedMenu / INTRO_MENU_FADE);
  drawSigninOptions(easeOutCubic(menuP));
}

// ── Helper : sign-in 3 sous-modes (choice / full / guest) ────────────────────
function drawSigninOptions(alpha) {
  signinChoiceBtns = [];
  noStroke();
  textAlign(CENTER, TOP);
  const labelY = by + 13*a * 0.40;

  if (signinMode === 'choice') {
    // 2 boutons : SIGN IN / GUEST (mêmes styles que le menu mode select)
    // Pas de titre/sous-titre — les boutons parlent d'eux-mêmes.
    const cxC = windowWidth / 2;
    const btnSize = r * 0.95 * MSG_SCALE;
    const gap = btnSize * 0.65;
    const startY = by + 13*a * 0.50;
    const buttons = [{ id: 'full', label: 'SIGN IN' }, { id: 'guest', label: 'GUEST' }];
    textFont(fontLarge); textSize(btnSize); textAlign(CENTER, TOP);
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      const ty = startY + i * (btnSize + gap);
      const tw = textWidth(b.label);
      const isHover = mouseX >= cxC - tw/2 - btnSize*0.4 && mouseX <= cxC + tw/2 + btnSize*0.4
                   && mouseY >= ty - btnSize*0.2 && mouseY <= ty + btnSize * 1.2;
      const opa = isHover ? 255 : 128;
      fill(red(C.ivory), green(C.ivory), blue(C.ivory), opa * alpha);
      text(b.label, cxC, ty);
      if (alpha >= 0.9) {
        signinChoiceBtns.push({
          x: cxC - tw/2 - btnSize*0.6, y: ty - btnSize*0.2,
          w: tw + btnSize*1.2, h: btnSize * 1.4,
          id: b.id,
        });
      }
    }
    return;
  }

  // Modes 'full' et 'guest' : labels + input(s) HTML
  const isFull  = (signinMode === 'full');
  textFont(fontLarge); textSize(r * 0.95 * MSG_SCALE);
  fill(red(C.ivory), green(C.ivory), blue(C.ivory), 255 * alpha);
  text(isFull ? 'SIGN IN' : 'GUEST', windowWidth / 2, labelY);
  textFont(fontSmall); textSize(r * 0.50 * MSG_SCALE);
  fill(red(C.ivory), green(C.ivory), blue(C.ivory), 170 * alpha);
  text(isFull ? 'NICKNAME + PASSWORD' : 'MAX 6 CHARS — PREFIXED INV_',
       windowWidth / 2, labelY + r * 1.0);

  if (alpha >= 0.7) {
    if (!signinInputEl) createSigninInputs(signinMode);
    positionSigninInputs(signinMode);
    if (signinInputEl) signinInputEl.style.opacity = String(alpha);
    if (signinPassEl)  signinPassEl.style.opacity  = String(alpha);
  }
}

function makeSigninInput(placeholder, maxLen, isPass) {
  const el = document.createElement('input');
  el.type = isPass ? 'password' : 'text';
  el.maxLength = maxLen;
  el.autocomplete = 'off';
  el.autocapitalize = isPass ? 'off' : 'characters';
  el.spellcheck = false;
  el.placeholder = placeholder;
  el.style.position    = 'absolute';
  el.style.background  = 'transparent';
  el.style.color       = '#f3ecdf';
  el.style.border      = 'none';
  el.style.borderBottom= '2px solid #f3ecdf';
  el.style.outline     = 'none';
  el.style.textAlign   = 'center';
  el.style.textTransform = isPass ? 'none' : 'uppercase';
  el.style.letterSpacing = '0.05em';
  el.style.fontFamily  = NAME_FONT_CSS;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitSignin(); }
  });
  document.body.appendChild(el);
  return el;
}

function createSigninInputs(mode) {
  if (mode === 'full') {
    signinInputEl = makeSigninInput('NICKNAME', 16, false);
    signinPassEl  = makeSigninInput('PASSWORD', 32, true);
    setTimeout(() => signinInputEl && signinInputEl.focus(), 50);
  } else if (mode === 'guest') {
    signinInputEl = makeSigninInput('GUEST NAME', 6, false);
    signinPassEl  = null;
    setTimeout(() => signinInputEl && signinInputEl.focus(), 50);
  }
}

function positionSigninInputs(mode) {
  if (!signinInputEl) return;
  const w = 13*a * 0.55;
  const h = r * 1.8;
  const fontSize = `${Math.round(r * 1.0 * MSG_SCALE)}px`;
  const baseTop = by + 13*a * 0.50;

  signinInputEl.style.left   = `${(windowWidth - w) / 2}px`;
  signinInputEl.style.top    = `${baseTop}px`;
  signinInputEl.style.width  = `${w}px`;
  signinInputEl.style.height = `${h}px`;
  signinInputEl.style.fontSize = fontSize;

  let hintY = baseTop + h + r * 0.5;
  if (mode === 'full' && signinPassEl) {
    const passTop = baseTop + h + r * 0.5;
    signinPassEl.style.left   = `${(windowWidth - w) / 2}px`;
    signinPassEl.style.top    = `${passTop}px`;
    signinPassEl.style.width  = `${w}px`;
    signinPassEl.style.height = `${h}px`;
    signinPassEl.style.fontSize = fontSize;
    hintY = passTop + h + r * 0.5;
  }

  noStroke(); fill(C.ivory);
  textAlign(CENTER, TOP); textFont(fontLarge);
  textSize(r * 0.75 * MSG_SCALE);
  text('[ENTER]  OR  TAP  HERE', windowWidth / 2, hintY);
}

function submitSignin() {
  if (signinMode === 'full') {
    if (!signinInputEl || !signinPassEl) return;
    const raw  = (signinInputEl.value || '').trim().toUpperCase();
    const pass = (signinPassEl.value || '');
    if (!raw || !pass) return;          // les deux requis
    try { localStorage.setItem(NICK_STORAGE_KEY, raw); } catch (e) {}
    applyUserNick(raw);
  } else if (signinMode === 'guest') {
    if (!signinInputEl) return;
    const raw = (signinInputEl.value || '').trim().toUpperCase();
    if (!raw) return;
    const finalName = 'INV_' + raw;
    try { localStorage.setItem(NICK_STORAGE_KEY, finalName); } catch (e) {}
    applyUserNick(finalName);
  } else {
    return;   // 'choice' : pas de submit possible (juste les boutons)
  }
  destroySigninInput();
  signinMode = 'choice';                // reset pour la prochaine fois
  appState = 'menu';
}

function destroySigninInput() {
  if (signinInputEl && signinInputEl.parentNode) {
    signinInputEl.parentNode.removeChild(signinInputEl);
  }
  signinInputEl = null;
  if (signinPassEl && signinPassEl.parentNode) {
    signinPassEl.parentNode.removeChild(signinPassEl);
  }
  signinPassEl = null;
}

// ── Notice "double promise" : en bas de l'écran, fade out après 3s ───────────
function drawDoublePromiseNotice() {
  if (!gameMode || typeof cubePromised === 'undefined' || !cubePromised) {
    doublePromiseT0 = null;
    return;
  }
  if (aiMode && cubePromised !== LOCAL_PLAYER) return;   // chez l'IA : invisible

  if (doublePromiseT0 === null) doublePromiseT0 = millis();
  const elapsed   = millis() - doublePromiseT0;
  const fadeStart = 3000;
  const fadeDur   = 2000;
  let alpha = 1;
  if (elapsed > fadeStart) {
    alpha = 1 - (elapsed - fadeStart) / fadeDur;
    if (alpha <= 0) return;
  }

  // Position : au-dessus des infos de l'adversaire (c'est lui qu'on challenge).
  const cx = windowWidth / 2;
  let cy;
  const canvasTopSafe = r / 2;
  if (diceOnSide) {
    // Paysage : 1/3 entre le haut du plateau et le bord supérieur du canvas.
    cy = canvasTopSafe + (by - canvasTopSafe) * 2 / 3;
  } else {
    // Portrait : à mi-distance entre le score (X) (= die.y / 2) et le bord
    // SUPÉRIEUR des dés noirs (= die.y) → notice = die.y * 3/4.
    const yBtextTop = by - dieSize() - r*1.6;   // = top des dés noirs
    cy = yBtextTop * 0.75;
  }
  // Symbole du cube à la valeur APRÈS doublage (cubeValue × 2) — même glyphe
  // que celui dessiné par drawDoublingCube (❶❷❹❽…). Rendu via PIX60_FONT_CSS :
  // nortechico-60 (PIX poids light) en priorité, fallback Noto Sans pour les
  // dingbats absents de PIX. Lettres/digits restent rendus par PIX-60.
  const v   = (typeof cubeValue !== 'undefined') ? cubeValue : 1;
  const nv  = v * 2;
  const sym = nv === 1 ? '❶' : nv === 2 ? '❷' : nv === 4 ? '❹'
            : nv === 8 ? '❽' : nv === 16 ? '⓾' : String(nv);
  const sz  = r * 0.95 * MSG_SCALE;
  const ctx = drawingContext;
  ctx.save();
  ctx.font         = `${sz}px ${PIX60_FONT_CSS}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = `rgba(${red(C.ivory)},${green(C.ivory)},${blue(C.ivory)},${alpha})`;
  ctx.fillText(`${sym}  NEXT TURN BEFORE YOU ROLL`, cx, cy);
  ctx.restore();
}

// ↪▯ EXIT — bouton global en bas de l'écran
//  - Portrait : centré, à r/2 du bord bas
//  - Paysage  : aligné à droite, à r/2 des bords droit et bas
function drawExitButton() {
  // Visible en jeu, en game-over et dans le lobby (room).
  // Caché uniquement pendant l'écran "waiting" ou un modal actif.
  if (appState === 'waiting') return;
  if (modalState && !(gameMode && gameWinner)) return;

  const arrow = '→';   // → RIGHTWARDS ARROW
  const rect0 = '⁰';   // ⁰ porte (U+2070 SUPERSCRIPT ZERO — rendu rectangulaire en nortechico)
  const rect1 = '⁰';   // même glyphe ; hover identique pour l'instant
  const sz    = r * 1.4;             // taille flèche
  const szRct = sz * 0.825;          // porte ≈ 82.5 % de la flèche (80-85 %)

  // Tout en nortechico-100 (typo référence)
  textAlign(LEFT, TOP);
  if (fontLarge) textFont(fontLarge);

  // Mesures
  textSize(sz);
  const arrowW = textWidth(arrow);
  textSize(szRct);
  const rectW  = textWidth(rect0);
  const gap    = sz * 0.15;             // léger espacement entre flèche et porte
  const totalW = arrowW + gap + rectW;

  let x, y;
  if (diceOnSide) {
    // Paysage : bas-droite, r/2 des bords
    x = windowWidth  - r/2 - totalW;
    y = windowHeight - r/2 - sz;
  } else {
    // Portrait : centré, bas à r/2 du bord inférieur (entièrement visible)
    x = (windowWidth - totalW) / 2;
    y = windowHeight - r/2 - sz;
  }

  const isHover = mouseX >= x && mouseX <= x + totalW
               && mouseY >= y && mouseY <= y + sz;

  noStroke(); fill(C.ivory);
  // Flèche
  textSize(sz);
  text(arrow, x, y);
  // Porte (réduite, alignée verticalement au bas de la flèche)
  textSize(szRct);
  const rectY = y + (sz - szRct);     // bas-aligné sur la flèche
  text(isHover ? rect1 : rect0, x + arrowW + gap, rectY);

  exitBtns.push({ x, y, w: totalW, h: sz });
}

// ── Lobby (Room) — liste des joueurs disponibles ─────────────────────────────
function drawRoom() {
  noStroke(); fill(0, 0, 0, 200);
  rect(0, 0, windowWidth, windowHeight);

  // Cadre = mêmes coords que le plateau (contour extérieur)
  noFill(); stroke(C.ivory); strokeWeight(1.5);
  rect(bx, by, 13*a, 13*a);

  // Titre
  noStroke(); fill(C.ivory);
  textAlign(CENTER, TOP);
  if (fontLarge) textFont(fontLarge);
  textSize(r * 1.6 * MSG_SCALE);
  text('ROOM', bx + 13*a/2, by + r * 0.8);

  // Sous-titre
  textFont(fontSmall); textSize(r * 0.7 * MSG_SCALE);
  text('CLICK A PLAYER TO INVITE', bx + 13*a/2, by + r * 3.2);

  // Liste joueurs (centrée verticalement dans le cadre)
  roomBtns = [];
  textAlign(LEFT, CENTER); textFont(fontLarge); textSize(r * 1.0 * MSG_SCALE);
  const startY = by + r * 5.5;
  const lineH  = r * 1.6;
  const colX   = bx + 2*a;
  const colW   = 9 * a;

  for (let i = 0; i < ROOM_PLAYERS.length; i++) {
    const p = ROOM_PLAYERS[i];
    const ly = startY + i * lineH;
    const clickable = p.online && !p.busy;
    const tag = !p.online ? 'OFFLINE' : (p.busy ? 'BUSY' : 'AVAILABLE');

    // Pastille de statut
    fill(p.online ? (p.busy ? C.ruby : C.offwhite) : color(120));
    noStroke();
    ellipse(colX, ly, r * 0.6, r * 0.6);

    // Nom
    const aFill = clickable ? 255 : 110;
    fill(red(C.ivory), green(C.ivory), blue(C.ivory), aFill);
    text(p.name, colX + r, ly);

    // Tag à droite
    textAlign(RIGHT, CENTER); textFont(fontSmall); textSize(r * 0.6 * MSG_SCALE);
    text(tag, colX + colW, ly);
    textAlign(LEFT, CENTER); textFont(fontLarge); textSize(r * 1.0 * MSG_SCALE);

    if (clickable) {
      roomBtns.push({ x: colX, y: ly - r*0.8, w: colW, h: r * 1.4, player: p });
    }
  }
}

// ── Modal d'attente d'acceptation d'invitation ───────────────────────────────
function drawWaiting() {
  noStroke(); fill(0, 0, 0, 200);
  rect(0, 0, windowWidth, windowHeight);

  const cx = windowWidth / 2;
  const cy = windowHeight / 2;
  fill(255); textAlign(CENTER, CENTER);
  if (fontLarge) textFont(fontLarge);
  textSize(r * 1.1 * MSG_SCALE);
  text(`Waiting for ${inviteTarget ? inviteTarget.name : '...'}`, cx, cy - r * 1.4);

  textSize(r * 0.7 * MSG_SCALE);
  text('CANCEL', cx, cy + r * 0.8);
  modalBtns = { cancel: { cx, cy: cy + r * 0.8, hw: r * 1.6 * MSG_SCALE, hh: r * 0.9 * MSG_SCALE } };
}

// ── Overlay profil joueur ─────────────────────────────────────────────────────
// Fond assombri en dehors du plateau, contenu profil dans le rectangle du plateau.
// Ouvert via clic sur le nom d'un joueur ; fermé via le bouton EXIT.
function drawPlayerProfile() {
  if (!profileOverlay) return;
  if (typeof PLAYER_PROFILES === 'undefined') return;
  const player  = profileOverlay;
  const profile = PLAYER_PROFILES[player];
  if (!profile) return;

  // Voile sombre couvrant tout l'écran (le plateau dessous reste légèrement visible)
  noStroke(); fill(0, 0, 0, 210);
  rect(0, 0, windowWidth, windowHeight);

  // ── Nom (gros, en haut) ────────────────────────────────────────────────────
  // Note : le cadre (encadrement ivoire) est dessiné en DERNIER, avec une
  // hauteur calculée dynamiquement pour s'arrêter juste après le graphique
  // (la table et le bouton SIGN OUT sont placés EN DEHORS du cadre, en bas).
  noStroke(); fill(C.ivory);
  if (fontLarge) textFont(fontLarge);
  textAlign(LEFT, TOP);
  const padX  = r * 4;            // marge interne 4r ↔ encadrement (3r + r demandé)
  const padY  = r * 0.8;          // marge interne haute
  const innerX = bx + padX;
  const innerW = 13*a - 2*padX;
  let yCur     = by + padY;

  const baseName = (mockState.players && mockState.players[player])
                || (player === 'white' ? 'WHITE' : 'BLACK');
  const szName  = r * 2.4;
  // Fallback Noto Sans pour caractères non-PIX (JP/CN/AR…) — via ctx direct
  drawNameText(baseName, innerX, yCur, szName, C.ivory, 'top');
  yCur += szName * 1.1;

  // ── Ligne 2 : (mpScoreCumulé) gros + XX% + 🥧 + total + 📊 + #RANK ─────────
  // Le score entre parenthèses correspond au cumul des deltas affichés dans
  // le tableau (cohérence visuelle avec le superscript in-game). Si nul → (0).
  const szLine = r * 1.0;
  const mpScore = (typeof getMultiplayerScore === 'function')
    ? getMultiplayerScore(player) : 0;
  const rank = rankFromGames(profile.totalGames);
  const winPct = Math.round(profile.winPercent * 100);

  textSize(szLine); textFont(fontLarge); fill(C.ivory);
  let lineX = innerX;

  // Score multijoueur cumulé : (+N) si positif, (-N) si négatif, (0) si nul
  const sign      = mpScore > 0 ? '+' : '';
  const scoreStr  = `(${sign}${mpScore})`;
  text(scoreStr, lineX, yCur);
  lineX += textWidth(scoreStr) + r * 0.8;

  // Pourcentage XX%
  const pctStr = `${winPct}%`;
  text(pctStr, lineX, yCur);
  lineX += textWidth(pctStr) + r * 0.25;

  // Pictogramme tarte (camembert) — juste la part pleine, pas de cercle vide
  const pieR = szLine * 0.45;     // rayon = ~45 % de la hauteur ligne
  const pieCX = lineX + pieR;
  const pieCY = yCur + szLine * 0.5;
  drawPiePicto(pieCX, pieCY, pieR, profile.winPercent);
  lineX += pieR * 2 + r * 0.5;

  // Nombre total de parties
  const totalStr = String(profile.totalGames);
  text(totalStr, lineX, yCur);
  lineX += textWidth(totalStr) + r * 0.8;

  // Pictogramme podium (3 barres décroissantes)
  const podW = szLine * 0.95;
  const podH = szLine * 0.85;
  drawPodiumPicto(lineX, yCur + (szLine - podH), podW, podH);
  lineX += podW + r * 0.3;

  // # + nom du rang
  const rankStr = `#${rank}`;
  text(rankStr, lineX, yCur);

  yCur += szLine * 1.6;

  // ── Date du premier jeu ────────────────────────────────────────────────────
  textFont(fontSmall); textSize(szLine * 0.75);
  fill(red(C.ivory), green(C.ivory), blue(C.ivory), 180);
  text(`since ${profile.firstPlay}`, innerX, yCur);
  yCur += szLine * 1.4;

  // ── Polyligne lissée score = f(temps) ─────────────────────────────────────
  // X de firstPlay à aujourd'hui, Y de 0 à 1000, sans labels.
  // Épaisseur 4.5 (= 3 × contour du plateau). Espace réservé au-dessous pour
  // un éventuel intitulé du graphique à venir.
  const chartH = szLine * 4.5;
  _chartZone = { x: innerX, y: yCur, w: innerW, h: chartH };
  drawScorePolyline(profile, innerX, yCur, innerW, chartH);
  yCur += chartH + szLine * 1.8;   // marge 1.8 pour titre futur

  // ── Cadre (encadrement) — couvre tout le rectangle du plateau (13a × 13a),
  // contient l'ensemble du contenu (header + chart + table). Seul le bouton
  // SIGN OUT est placé EN DEHORS, juste sous le cadre.
  noFill(); stroke(C.ivory); strokeWeight(1.5);
  rect(bx, by, 13*a, 13*a);

  // ── Tableau dernières parties ──────────────────────────────────────────────
  // 4 colonnes : ↑+N / ↓-N | You(score) | P - O (résultat monoespacé) | Adversaire(rank)
  // La colonne delta est à gauche du nom du joueur. Le résultat affiche les points
  // de chaque côté ; seul le vainqueur est mis en surbrillance (bleu si on gagne,
  // rouge si on perd), le perdant reste ivoire.
  // Police agrandie ; les chiffres sont alignés autour d'un tiret fixe.
  const tableTextSize = szLine * 0.90;
  const rowH      = tableTextSize * 1.30;
  const colWidth  = innerW;
  const colDelta  = colWidth * 0.16;
  const colYou    = colWidth * 0.20;
  const colRes    = colWidth * 0.18;
  const colDate   = colWidth * 0.18;          // colonne date à droite
  const colOpp    = colWidth - colDelta - colYou - colRes - colDate;

  textFont(fontLarge);
  textSize(tableTextSize);
  textAlign(LEFT, TOP);
  noStroke();   // évite que le stroke ivoire du chart/cadre dessine un contour autour des caractères

  // Largeurs fixes pour monoespacement du résultat (jusqu'à 2 chiffres / côté)
  const digitsW = textWidth('00');
  const dashStr = ' - ';
  const dashW   = textWidth(dashStr);
  const resTotW = digitsW + dashW + digitsW;
  const resStart = innerX + colDelta + colYou + Math.max(0, (colRes - resTotW) / 2);

  // Zone scrollable des parties : commence à yCur (sous le graphique), s'étend
  // jusqu'au bas du cadre (le SIGN OUT est dessiné après, hors du cadre).
  const tableTopY = yCur;
  const tableBotY = by + 13*a - padY - 2*r;   // +2r d'espace vide jusqu'au bord inférieur du cadre (r supplémentaire demandé)
  // Hauteur totale "logique" du contenu et bornes de scroll
  const games = profile.recentGames || [];
  const totalH = games.length * rowH;
  const visibleH = Math.max(0, tableBotY - tableTopY);
  const maxScroll = Math.max(0, totalH - visibleH);
  if (recentGamesScroll > maxScroll) recentGamesScroll = maxScroll;
  if (recentGamesScroll < 0)         recentGamesScroll = 0;

  // Clip pour empêcher le tableau de déborder de la zone visible
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(innerX - 4, tableTopY, innerW + 8, visibleH);
  drawingContext.clip();

  for (let i = 0; i < games.length; i++) {
    const ry = tableTopY + i * rowH - recentGamesScroll;
    if (ry + rowH < tableTopY) continue;     // au-dessus de la zone visible
    if (ry > tableBotY)        break;        // sous la zone visible
    const g = games[i];
    const playerWon = g.delta > 0;
    const winPts    = Math.abs(g.delta);
    const playerPts = playerWon ? winPts : 0;
    const oppPts    = playerWon ? 0     : winPts;

    // Colonne 1 : flèche + delta — couleur bleue (gain) / rouge (perte)
    const arrowChar = playerWon ? '↑' : '↓';
    const deltaStr  = `${arrowChar}${playerWon ? '+' : ''}${g.delta}`;
    fill(playerWon ? C.gainBlue : C.lossRed);
    textAlign(LEFT, TOP);
    text(deltaStr, innerX, ry);

    // Colonne 2 : YOU + (score) en superscript (×1.5 plus grand qu'avant)
    fill(C.ivory);
    text('YOU', innerX + colDelta, ry);
    {
      const baseW = textWidth('YOU');
      const supSize = tableTextSize * 0.825;     // 0.55 × 1.5
      textSize(supSize);
      text(`(${g.youScore})`, innerX + colDelta + baseW + tableTextSize * 0.06, ry);
      textSize(tableTextSize);
    }

    // Colonne 3 : résultat "P - O" monoespacé.
    // Plus de surbrillance couleur : tout en ivoire. Le vainqueur est marqué
    // par la fonte nortechico-80 (poids intermédiaire) au lieu de la couleur.
    fill(C.ivory);
    if (playerWon && fontMed) textFont(fontMed);
    textAlign(RIGHT, TOP);
    text(String(playerPts), resStart + digitsW, ry);

    textFont(fontLarge);
    textAlign(LEFT, TOP);
    text(dashStr, resStart + digitsW, ry);

    if (!playerWon && fontMed) textFont(fontMed);
    text(String(oppPts), resStart + digitsW + dashW, ry);
    textFont(fontLarge);

    // Colonne 4 : OPPONENT + (score) en superscript (×1.5 plus grand)
    fill(C.ivory);
    textAlign(LEFT, TOP);
    const oppX = innerX + colDelta + colYou + colRes;
    text(g.opponent, oppX, ry);
    {
      const baseW = textWidth(g.opponent);
      const supSize = tableTextSize * 0.825;
      textSize(supSize);
      text(`(${g.oppScore})`, oppX + baseW + tableTextSize * 0.06, ry);
      textSize(tableTextSize);
    }

    // Colonne 5 (droite) : date AA/MM/JJ ou HH:MM si < 24h
    if (g.playedAt) {
      fill(red(C.ivory), green(C.ivory), blue(C.ivory), 200);
      textAlign(RIGHT, TOP);
      textFont(fontSmall); textSize(tableTextSize * 0.85);
      text(formatGameDate(g.playedAt), innerX + colWidth, ry);
      textFont(fontLarge); textSize(tableTextSize);
    }
  }

  drawingContext.restore();
  yCur = tableBotY;     // sortie de la zone scrollable

  // ── SIGN OUT (LOCAL_PLAYER uniquement, EN DEHORS du cadre, en dessous) ────
  signoutBtn = null;
  if (player === LOCAL_PLAYER) {
    const sz = szLine * 1.10;
    textFont(fontLarge); textSize(sz);
    fill(C.ivory);
    textAlign(CENTER, TOP);
    const label = '[ SIGN OUT ]';
    const w = textWidth(label);
    const cx = bx + 13*a / 2;
    const sy = by + 13*a + szLine * 0.6;          // juste sous le cadre
    text(label, cx, sy);
    signoutBtn = { x: cx - w/2, y: sy, w, h: sz };
    textAlign(LEFT, TOP);
  }
}

// Dessine une part de tarte monochrome (juste la part pleine)
// Démarre à 12h, sens horaire ; pas de tracé pour la part vide.
function drawPiePicto(cx, cy, rad, pct) {
  if (pct <= 0) return;
  noStroke(); fill(C.ivory);
  if (pct >= 1) {
    ellipse(cx, cy, rad * 2, rad * 2);
    return;
  }
  const a0 = -HALF_PI;                    // 12h
  const a1 = -HALF_PI + TWO_PI * pct;
  arc(cx, cy, rad * 2, rad * 2, a0, a1, PIE);
}

// Dessine un pictogramme podium (3 barres : moyenne, longue, courte)
// Layout : barre 2 plus haute au milieu, barre 1 à gauche, barre 3 à droite décroissantes.
function drawPodiumPicto(x, y, w, h) {
  const barW = w / 4;
  const gap  = (w - 3 * barW) / 2;
  const h1 = h * 0.65;
  const h2 = h * 1.00;
  const h3 = h * 0.45;
  noStroke(); fill(C.ivory);
  rect(x,                 y + (h - h1), barW, h1);
  rect(x + barW + gap,    y + (h - h2), barW, h2);
  rect(x + 2*(barW+gap),  y + (h - h3), barW, h3);
}

// Format de la date de partie : HH:MM si < 24h, sinon AA/MM/JJ.
function formatGameDate(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  const now = Date.now();
  const ageMs = now - t;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const d = new Date(t);
  const pad = n => String(n).padStart(2, '0');
  if (ageMs >= 0 && ageMs < ONE_DAY) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const yy = pad(d.getFullYear() % 100);
  return `${yy}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

// ── Polyligne lissée score = f(temps) ────────────────────────────────────────
// Sans axes ni labels : X de firstPlay à aujourd'hui ; Y de 0 à Y_MAX (1000).
// Épaisseur du trait identique au contour du plateau (1.5). Lissée via curveVertex.
function drawScorePolyline(profile, x, y, w, h) {
  const Y_MAX = 1000;
  const hist  = profile.scoreHistory;
  if (!hist || hist.length < 2) return;

  // X = timestamp ms ; bornes : firstPlay → aujourd'hui
  const t0 = Date.parse(profile.firstPlay);
  const t1 = Date.now();
  const span = Math.max(1, t1 - t0);

  // Conversion (date, score) → (px, py) dans la zone (x, y, w, h)
  function pt(p) {
    const tx = (Date.parse(p.date) - t0) / span;
    const sy = Math.max(0, Math.min(1, p.score / Y_MAX));
    return { px: x + tx * w, py: y + h - sy * h, date: p.date, score: p.score };
  }
  const pts = hist.map(pt);

  // Tracé lissé via curveVertex (Catmull-Rom). Premier et dernier point dupliqués
  // pour que la spline atteigne effectivement les extrémités.
  noFill();
  stroke(C.ivory);
  strokeWeight(4.5);   // 3 × contour du plateau (1.5)
  beginShape();
  curveVertex(pts[0].px, pts[0].py);
  for (const p of pts) curveVertex(p.px, p.py);
  curveVertex(pts[pts.length - 1].px, pts[pts.length - 1].py);
  endShape();
  noStroke();

  // ── Tooltip au survol : (score) AAAA/MM/DD positionné sur la courbe
  // Visible :
  //  - desktop (souris hover) : quand pas de touch en cours
  //  - mobile : seulement quand le doigt est en mode 'graph' (touch sur le graphique)
  const showTip = _hasTouched ? (_touchMode === 'graph') : true;
  const padY = h * 0.4;
  if (showTip
      && mouseX >= x && mouseX <= x + w
      && mouseY >= y - padY && mouseY <= y + h + padY) {
    // Interpolation linéaire entre les deux points encadrant mouseX
    let pA = pts[0], pB = pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i].px <= mouseX && pts[i+1].px >= mouseX) {
        pA = pts[i]; pB = pts[i+1];
        break;
      }
    }
    const tF   = pB.px === pA.px ? 0 : (mouseX - pA.px) / (pB.px - pA.px);
    const tMs  = Date.parse(pA.date) + tF * (Date.parse(pB.date) - Date.parse(pA.date));
    const score = Math.round(pA.score + tF * (pB.score - pA.score));
    // Y interpolé sur la courbe au point survolé (pas le curseur)
    const curveY = pA.py + tF * (pB.py - pA.py);
    const date  = new Date(tMs);
    const yyyy  = date.getFullYear();
    const mm    = String(date.getMonth() + 1).padStart(2, '0');
    const dd    = String(date.getDate()).padStart(2, '0');
    const label = `(${score}) ${yyyy}/${mm}/${dd}`;
    const txSz  = r * 0.825;             // taille agrandie ×1.5
    // Étiquette ancrée en BAS-DROITE du graphique, ne suit plus la courbe :
    // évite tout chevauchement avec la polyligne. Les valeurs (score/date)
    // varient selon la position du curseur ou du doigt (mobile).
    textFont(fontSmall); textSize(txSz); textAlign(RIGHT, BOTTOM);
    fill(C.ivory);
    text(label, x + w, y + h);
    textAlign(LEFT, TOP);
  }
}

// ── Modal "Offer double?" / "Accept?" (R7) ───────────────────────────────────
function drawModal() {
  modalBtns = null;
  if (!modalState) return;

  // Voile sombre semi-opaque sur tout l'écran
  noStroke(); fill(0, 0, 0, 200);
  rect(0, 0, windowWidth, windowHeight);

  const cx = windowWidth / 2;
  const cy = windowHeight / 2;
  fill(255); textAlign(CENTER, CENTER);

  // Espacement entre la question et les boutons YES/NO doublé (était 2.4r → 4.8r)
  // Question centrée à cy - 2.4r, boutons à cy + 2.4r → écart total 4.8r symétrique
  if (modalState.type === 'offer') {
    if (fontLarge) textFont(fontLarge);
    textSize(r * 1.1 * MSG_SCALE);
    text('Offer double?', cx, cy - r * 2.4);

    textSize(r * 1.0 * MSG_SCALE);
    const dx = r * 3;
    const yY = cy + r * 2.4;
    text('YES', cx - dx, yY);
    text('NO',  cx + dx, yY);
    modalBtns = {
      yes: { cx: cx - dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
      no:  { cx: cx + dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
    };

  } else if (modalState.type === 'resign') {
    if (fontLarge) textFont(fontLarge);
    textSize(r * 1.1 * MSG_SCALE);
    text('Resign current game?', cx, cy - r * 2.4);

    textSize(r * 1.0 * MSG_SCALE);
    const dx = r * 3;
    const yY = cy + r * 2.4;
    text('YES', cx - dx, yY);
    text('NO',  cx + dx, yY);
    modalBtns = {
      yes: { cx: cx - dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
      no:  { cx: cx + dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
    };

  } else if (modalState.type === 'quit') {
    if (fontLarge) textFont(fontLarge);
    textSize(r * 1.1 * MSG_SCALE);
    text('Quit current game?', cx, cy - r * 2.4);

    textSize(r * 1.0 * MSG_SCALE);
    const dx = r * 3;
    const yY = cy + r * 2.4;
    text('YES', cx - dx, yY);
    text('NO',  cx + dx, yY);
    modalBtns = {
      yes: { cx: cx - dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
      no:  { cx: cx + dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
    };

  } else if (modalState.type === 'accept') {
    // En mode IA, l'IA décide seule → ne pas afficher le modal côté user
    if (aiMode && modalState.player === 'black') return;
    if (fontLarge) textFont(fontLarge);
    textSize(r * 0.9 * MSG_SCALE);
    text('Your opponent offers you a double', cx, cy - r * 2.2);

    textFont('Arial');
    textSize(r * 2.7 * MSG_SCALE);
    const dx = r * 3;
    const yY = cy + r * 0.8;
    const acceptBtn  = { cx: cx - dx, cy: yY, hw: r * 1.8 * MSG_SCALE, hh: r * 1.8 * MSG_SCALE };
    const declineBtn = { cx: cx + dx, cy: yY, hw: r * 1.8 * MSG_SCALE, hh: r * 1.8 * MSG_SCALE };
    const hoverA = isClickInBtn(acceptBtn);
    const hoverD = isClickInBtn(declineBtn);

    // ✓ : gras simulé via stroke au survol
    fill(255);
    if (hoverA) { stroke(255); strokeWeight(3); } else { noStroke(); }
    text('\u2713', cx - dx, yY);

    // ⚐ → ⚑ (drapeau plein) au survol
    noStroke();
    text(hoverD ? '\u2691' : '\u2690', cx + dx, yY);

    modalBtns = { accept: acceptBtn, decline: declineBtn };
  }
}

function isClickInBtn(btn) {
  return Math.abs(mouseX - btn.cx) < btn.hw
      && Math.abs(mouseY - btn.cy) < btn.hh;
}

// ── Overlay fin de partie ────────────────────────────────────────────────────
function drawGameOver() {
  noStroke();
  fill(0, 0, 0, 170);
  rect(0, 0, windowWidth, windowHeight);

  const cx = windowWidth / 2;
  const cy = windowHeight / 2;
  const winnerName = gameWinner === 1
    ? ((mockState.players && mockState.players.white) || 'WHITE')
    : ((mockState.players && mockState.players.black) || 'BLACK');
  const isResign = gameWinType === 'resign';
  const pts   = (isResign ? 1 : winPoints(gameWinType)) * cubeValue;
  const label = isResign ? 'RESIGN' : gameWinType.toUpperCase();

  fill(C.ivory);
  textAlign(CENTER, CENTER);
  if (fontLarge) textFont(fontLarge);
  // 4 lignes uniformément espacées autour de cy (centrage vertical)
  // Espacement = 2.7r entre centres → spans 8.1r répartis [-4.05r .. +4.05r]
  textSize(r * 2.0 * MSG_SCALE); text('GAME OVER',           cx, cy - r * 4.05);
  textSize(r * 1.4 * MSG_SCALE); text(`${winnerName} WINS`,  cx, cy - r * 1.35);
  textSize(r * 1.0 * MSG_SCALE); text(`${label}  +${pts}`,   cx, cy + r * 1.35);
  textSize(r * 0.7 * MSG_SCALE); text('[5] nouvelle partie', cx, cy + r * 4.05);
}

// ── Smooth drag (vitesse d'accroche / 2) ─────────────────────────────────────
// Multi-pickup : la pièce du curseur (au bas de la pile traînée pour une source
// BOT, au haut pour une source TOP) doit s'aimanter à un slot tel que les
// AUTRES pièces du groupe restent DANS le plateau. Quand source et destination
// n'ont pas la même orientation (BOT→TOP ou TOP→BOT), on décale le snap de
// (N−1)·a dans la direction de la destination pour que le groupe entier rentre
// sans déborder du bord supérieur ou inférieur.
function updateDragDisplay() {
  const tx = drag.snapPt !== null ? ptCenterX(drag.snapPt) : drag.mouseX;
  let ty;
  if (drag.snapPt !== null) {
    ty = ptNextY(drag.snapPt);
    if (typeof drag.snapPt === 'number' && drag.snapPt >= 1 && drag.snapPt <= 24) {
      const N = drag.numPieces || 1;
      if (N > 1) {
        const isBotSrc  = (drag.fromPt !== 'bar') && (drag.fromPt <= 12);
        const isBotDest = drag.snapPt <= 12;
        if (isBotSrc !== isBotDest) {
          // Décalage vers le côté du board où le groupe doit s'étendre
          ty += (isBotDest ? -1 : 1) * (N - 1) * a;
        }
      }
    }
  } else {
    ty = drag.mouseY;
  }
  drag.dispX = lerp(drag.dispX, tx, 0.13);
  drag.dispY = lerp(drag.dispY, ty, 0.13);
}

// ── Plateau ───────────────────────────────────────────────────────────────────
function drawBoard() {
  const SW = 2;   // épaisseur unique pour tous les contours du plateau

  // Position des bords de la barre — animés au démarrage de la 1ère partie :
  // une ligne unique au milieu (cx) qui se sépare en deux lignes symétriques
  // jusqu'aux positions finales bx+6a et bx+7a. La largeur de la zone
  // colorée (C.bar) entre les deux croît avec la séparation.
  let barLX = bx + 6*a;
  let barRX = bx + 7*a;
  if (gameFillT0 > 0) {
    const elapsedBar = millis() - gameFillT0;
    const barP = Math.min(1, elapsedBar / BAR_APPEAR_DUR);
    const cxBar = bx + 6.5*a;
    const halfW = (a / 2) * easeInOutCubic(barP);
    barLX = cxBar - halfW;
    barRX = cxBar + halfW;
  }

  // Fond tablier (sans contour)
  noStroke();
  fill(C.board);
  rect(bx, by, 13*a, 13*a);

  // Barre — fill SANS contour (pour éviter le double-trait au top/bottom où
  // ça chevaucherait avec le contour du plateau). Largeur animée au start.
  fill(C.bar);
  noStroke();
  rect(barLX, by, barRX - barLX, 13*a);

  // Triangles — pt passé pour que chaque triangle ait un léger décalage de phase
  // dans son halo (rappel visuel que les options sont indépendantes).
  const targets = drag.active ? getValidTargets(drag.fromPt) : [];
  for (let i = 0; i < 6; i++) {
    const dark = (i % 2 === 0);
    drawTri(bx + (12-i)*a, by + 13*a, true,  dark,  targets.includes(1+i),  drag.snapPt === 1+i,  1+i);
    drawTri(bx + (5-i)*a,  by + 13*a, true,  !dark, targets.includes(7+i),  drag.snapPt === 7+i,  7+i);
    drawTri(bx + i*a,      by,         false, dark,  targets.includes(13+i), drag.snapPt === 13+i, 13+i);
    drawTri(bx + (7+i)*a,  by,         false, !dark, targets.includes(19+i), drag.snapPt === 19+i, 19+i);
  }

  // Contours en DERNIER (pour rester au-dessus des triangles).
  // Bords verticaux de la barre + contour extérieur du plateau, à la même
  // épaisseur SW, pour éviter toute surépaisseur résiduelle.
  stroke(C.ivory);
  strokeWeight(SW);
  noFill();
  // Contour extérieur (entièrement à l'extérieur du fond)
  rect(bx - SW/2, by - SW/2, 13*a + SW, 13*a + SW);
  // Lignes verticales de la barre — positions animées au start (au début les
  // deux lignes se confondent au milieu du plateau, puis s'écartent).
  line(barLX, by, barLX, by + 13*a);
  line(barRX, by, barRX, by + 13*a);
}

// ── Triangle "staircase" : demi-palier base + 6 paliers symétriques ────────
// Variation visuelle : pas de contour, juste la couleur de remplissage.
// 7 layers du bas vers la pointe :
//   0 : demi-palier base, lower half  → h=a/2, w=1a    (touche les triangles adjacents)
//   1 : demi-palier base, upper half  → h=a/2, w=9/10a (crée un trait creux léger)
//   2 : palier 2                       → h=a,   w=5/6a
//   3 : palier 3                       → h=a,   w=2/3a
//   4 : palier 4                       → h=a,   w=1/2a
//   5 : palier 5                       → h=a,   w=1/3a
//   6 : palier 6 (pointe)              → h=a,   w=1/6a
// Total : a/2 + a/2 + 5a = 6a (= hauteur d'origine).
// Highlight subtil (target/snap) : halo blanc qui balaie la base vers la pointe
// avec une amplitude douce et un cycle long.
const TRI_LAYERS = [
  { wA: 1,     hA: 0.5 },   // 0 — base lower half
  { wA: 19/20, hA: 0.5 },   // 1 — base upper half (trait creux fin : 0.05a d'inset)
  { wA: 5/6,   hA: 1.0 },   // 2
  { wA: 2/3,   hA: 1.0 },   // 3
  { wA: 1/2,   hA: 1.0 },   // 4
  { wA: 1/3,   hA: 1.0 },   // 5
  { wA: 1/6,   hA: 1.0 },   // 6 — pointe
];

function drawTri(x, baseY, pointUp, isDark, isTarget, isSnapped, pt) {
  // ── Animation de remplissage du jeu (1ère apparition du plateau) ──────────
  // Pendant le wave : chaque triangle se construit en 2 phases (bar fine r/6
  // pleine hauteur, puis paliers qui s'épaississent en cascade) — la même
  // séquence smooth validée dans la fenêtre test (t). Couleur FINALE dès le
  // départ (pas de globalAlpha fade-in qui créerait des superpositions).
  // Le chevauchement temporel entre triangles consécutifs (TEST_PAIR_STEP <
  // TEST_PAIR_FADE_DUR) crée la fluidité entre les apparitions successives.
  if (gameFillT0 > 0 && typeof pt === 'number' && _testFillP === null) {
    const delay   = triNewFillDelay(pt);
    const elapsed = millis() - gameFillT0 - BAR_APPEAR_DUR - delay;
    if (elapsed < 0) return;     // pas encore arrivé
    const fillP = Math.min(1, elapsed / TEST_PAIR_FADE_DUR);
    // Couleur finale dès le départ — la fluidité vient de l'animation 2-phases
    // (bar fine puis paliers en cascade smootherstep). Pas de globalAlpha qui
    // créerait des superpositions d'opacités fantômes.
    drawTestTriStaircase(pt, fillP, isDark ? C.triA : C.triB);
    return;     // pas de halo pendant le fill du jeu
  }

  noStroke();
  fill(isDark ? C.triA : C.triB);

  const cx = x + a / 2;

  // Y du top de chaque layer (cumul des hauteurs depuis la base)
  function layerTopY(i) {
    let off = 0;
    for (let k = 0; k <= i; k++) off += TRI_LAYERS[k].hA * a;
    return pointUp ? baseY - off : baseY + off - TRI_LAYERS[i].hA * a;
  }

  // ── Override _testFillP (fenêtre test) : clip simple ──────────────────────
  let _fillRestore = false;
  let fillP = 1;
  if (typeof _testFillP === 'number') {
    fillP = _testFillP;
    if (fillP < 1) {
      const visibleH = 6 * a * fillP;
      const clipY = pointUp ? baseY - visibleH : baseY;
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.rect(x, clipY, a, visibleH);
      drawingContext.clip();
      _fillRestore = true;
    }
  }

  // Dessin des layers (couleur de remplissage uniquement)
  for (let i = 0; i < TRI_LAYERS.length; i++) {
    const w = TRI_LAYERS[i].wA * a;
    const h = TRI_LAYERS[i].hA * a;
    rect(cx - w / 2, layerTopY(i), w, h);
  }

  if (_fillRestore) {
    drawingContext.restore();
    return;   // pas de halo pendant le remplissage initial (test)
  }

  // Halo (target/snap) : périmètre en zigzag + glow point animé qui parcourt
  // l'arête (logique reprise de la version standard, adaptée à l'escalier).
  if (isTarget || isSnapped) {
    // ── 1. Construction du périmètre en zigzag autour de l'escalier ─────
    // Vertices ordonnés en partant du coin bas-droit, en remontant la droite
    // palier par palier, en traversant la pointe, puis en redescendant la
    // gauche en miroir jusqu'au coin bas-gauche. La base ferme la boucle
    // (segment implicite verts[N-1] → verts[0]).
    const sgn = pointUp ? -1 : 1;     // pointUp : Y décroît vers le haut
    const verts = [];
    // Coin de base, côté droit
    verts.push({ x: cx + TRI_LAYERS[0].wA / 2 * a, y: baseY });
    // Côté droit : on monte palier par palier
    let cumOff = 0;
    for (let i = 0; i < TRI_LAYERS.length; i++) {
      cumOff += TRI_LAYERS[i].hA * a;
      const topY = baseY + sgn * cumOff;
      // Haut du palier i, bord droit
      verts.push({ x: cx + TRI_LAYERS[i].wA / 2 * a, y: topY });
      // Marche horizontale vers l'intérieur (vers le palier suivant, plus étroit)
      if (i < TRI_LAYERS.length - 1) {
        verts.push({ x: cx + TRI_LAYERS[i + 1].wA / 2 * a, y: topY });
      }
    }
    // Sommet de la pointe : traversée horizontale vers la gauche
    const tipY = baseY + sgn * 6 * a;
    verts.push({ x: cx - TRI_LAYERS[TRI_LAYERS.length - 1].wA / 2 * a, y: tipY });
    // Côté gauche : on redescend palier par palier en miroir
    cumOff = 6 * a;
    for (let i = TRI_LAYERS.length - 1; i >= 0; i--) {
      cumOff -= TRI_LAYERS[i].hA * a;
      const botY = baseY + sgn * cumOff;
      verts.push({ x: cx - TRI_LAYERS[i].wA / 2 * a, y: botY });
      // Marche horizontale vers l'extérieur (vers le palier précédent, plus large)
      if (i > 0) {
        verts.push({ x: cx - TRI_LAYERS[i - 1].wA / 2 * a, y: botY });
      }
    }
    // verts[N-1] = (cx - 0.5a, baseY) — coin bas-gauche.
    // Le segment implicite verts[N-1] → verts[0] est la base (bord du bas).

    const N = verts.length;
    const lens = [];
    let total = 0;
    for (let i = 0; i < N; i++) {
      const u = verts[i], v = verts[(i + 1) % N];
      const L = Math.hypot(v.x - u.x, v.y - u.y);
      lens.push(L);
      total += L;
    }

    const cR = red(C.ivory), cG = green(C.ivory), cB = blue(C.ivory);

    // ── 2. Contour fin TOUJOURS visible (lueur de base discrète sur le bord)
    // Garantit que la cible soit identifiable dès le pickup même quand le
    // glow point est sur l'autre face de l'escalier.
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < N; i++) drawingContext.lineTo(verts[i].x, verts[i].y);
    drawingContext.closePath();
    drawingContext.lineWidth   = 1.0;
    drawingContext.lineJoin    = 'miter';
    drawingContext.strokeStyle = `rgba(${cR},${cG},${cB},${isSnapped ? 0.22 : 0.13})`;
    drawingContext.stroke();
    drawingContext.restore();

    // ── 3. Glow point animé qui parcourt le périmètre (2 points, 180° d'écart)
    // Le halo peut s'étendre sur plusieurs segments courts (les marches font
    // souvent < segHalf) — on dessine donc segment par segment en propageant
    // l'alpha autour du pic.
    const speed   = 200;                    // px/s le long du périmètre
    const segHalf = r * 1.8;                // demi-longueur du halo : périmètre d'action étendu
    const sw      = 1.05;                   // +5% par rapport au contour de base : surbrillance à peine plus marquée
    const peakA   = isSnapped ? 1.0 : 0.85;
    const phaseOff = (typeof pt === 'number') ? (((pt - 1) * 7) % 24) / 24 : 0;
    const t0 = ((millis() / 1000 * speed) % total + phaseOff * total) % total;
    const t1 = (t0 + total / 2) % total;

    function drawSubSeg(segIdx, gA, gB, alphaA, alphaB) {
      if (gB <= gA) return;
      const u = verts[segIdx], v = verts[(segIdx + 1) % N];
      const len = lens[segIdx];
      if (len <= 0) return;
      const ax = u.x + (v.x - u.x) * gA / len;
      const ay = u.y + (v.y - u.y) * gA / len;
      const bx2 = u.x + (v.x - u.x) * gB / len;
      const by2 = u.y + (v.y - u.y) * gB / len;
      const grad = drawingContext.createLinearGradient(ax, ay, bx2, by2);
      grad.addColorStop(0, `rgba(${cR},${cG},${cB},${alphaA})`);
      grad.addColorStop(1, `rgba(${cR},${cG},${cB},${alphaB})`);
      drawingContext.strokeStyle = grad;
      drawingContext.beginPath();
      drawingContext.moveTo(ax, ay);
      drawingContext.lineTo(bx2, by2);
      drawingContext.stroke();
    }

    function drawGlowAt(tPos) {
      // Localise le segment qui contient tPos
      let rem = tPos, si = 0;
      for (; si < N; si++) {
        if (rem <= lens[si]) break;
        rem -= lens[si];
      }
      if (si >= N) si = N - 1;
      drawingContext.save();
      drawingContext.lineCap   = 'round';
      drawingContext.globalCompositeOperation = 'lighter';

      function paintTrail(lw, alphaScale) {
        drawingContext.lineWidth = lw;
        // Propage en arrière le long du périmètre (alpha décroît)
        let walked = 0, segIdx = si, pos = rem;
        while (walked < segHalf) {
          const stepLen = Math.min(pos, segHalf - walked);
          if (stepLen > 0) {
            const aNear = peakA * alphaScale * (1 - walked / segHalf);
            const aFar  = peakA * alphaScale * (1 - (walked + stepLen) / segHalf);
            drawSubSeg(segIdx, pos - stepLen, pos, aFar, aNear);
            walked += stepLen;
            pos    -= stepLen;
          }
          if (walked >= segHalf) break;
          segIdx = (segIdx - 1 + N) % N;
          pos    = lens[segIdx];
        }
        // Propage en avant
        walked = 0; segIdx = si; pos = rem;
        while (walked < segHalf) {
          const stepLen = Math.min(lens[segIdx] - pos, segHalf - walked);
          if (stepLen > 0) {
            const aNear = peakA * alphaScale * (1 - walked / segHalf);
            const aFar  = peakA * alphaScale * (1 - (walked + stepLen) / segHalf);
            drawSubSeg(segIdx, pos, pos + stepLen, aNear, aFar);
            walked += stepLen;
            pos    += stepLen;
          }
          if (walked >= segHalf) break;
          segIdx = (segIdx + 1) % N;
          pos    = 0;
        }
      }

      paintTrail(sw * 3.5, 0.22);  // halo large, additif → rayonnement
      paintTrail(sw,       1.0);   // cœur du trait

      drawingContext.restore();
    }

    drawGlowAt(t0);
    drawGlowAt(t1);
  }
}

// ── Centres & positions ───────────────────────────────────────────────────────
function ptCenterX(pt) {
  if (pt === 0) {
    // Off zone : center X du prochain slot (pour le drag visual / animation).
    // En portrait : pile horizontale → idx-ième fiche à x0 - w - idx*step
    // En paysage  : grille 8×N à droite du plateau
    const idx = mockState.turn === 'white' ? mockState.off.white : mockState.off.black;
    if (diceOnSide) {
      const w = 2*r, colW = w + r/2;
      return bx + 13*a + r + Math.floor(idx/8)*colW + w/2;
    }
    const G = offGeomPortrait();
    return G.x0 - G.w - idx * G.step + G.w/2;
  }
  let lx;
  if      (pt >=  1 && pt <=  6) lx = bx + (13-pt)*a;
  else if (pt >=  7 && pt <= 12) lx = bx + (12-pt)*a;
  else if (pt >= 13 && pt <= 18) lx = bx + (pt-13)*a;
  else                           lx = bx + (pt-12)*a;
  return lx + a/2;
}

function ptNextY(pt) {
  if (pt === 0) {
    // Off zone : center Y du prochain slot
    if (diceOnSide) {
      const h = r * 0.4, step = h + h, cy = by + 6.5*a;
      const idx = mockState.turn === 'white' ? mockState.off.white : mockState.off.black;
      const pos = idx % 8;
      return mockState.turn === 'white'
        ? cy + r + pos*step + h/2
        : cy - r - pos*step - h/2;
    }
    const G = offGeomPortrait();
    return mockState.turn === 'white' ? G.yW + G.h/2 : G.yB + G.h/2;
  }
  const n    = abs(mockState.points[pt] || 0);
  const isBot = pt <= 12;
  const visN  = min(n, MAX_STACK);
  return isBot ? by + 13*a - r - visN*a : by + r + visN*a;
}

function ptTopY(pt) {
  const n    = abs(mockState.points[pt] || 0);
  if (!n) return 0;
  const isBot  = pt <= 12;
  const topIdx = min(n, MAX_STACK) - 1;
  return isBot ? by + 13*a - r - topIdx*a : by + r + topIdx*a;
}

// ── Pièces ────────────────────────────────────────────────────────────────────
function drawCheckers() {
  for (let pt = 1; pt <= 24; pt++) {
    const val = mockState.points[pt];
    if (!val) continue;
    let skipN = drag.active && drag.fromPt === pt ? (drag.numPieces || 1) : 0;
    if (flyingChecker && flyingChecker.from === pt) skipN = Math.max(skipN, 1);
    // Pendant un hit : skip aussi la pièce mangée (elle est dessinée en fade out par drawFlyingChecker)
    if (flyingChecker && flyingChecker.hit && flyingChecker.hit.pt === pt) {
      skipN = Math.max(skipN, 1);
    }
    drawStackOnPoint(pt, abs(val), val > 0, skipN);
  }
  const barCX = bx + 6.5*a;
  const skipWhiteBar = drag.active && drag.fromPt === 'bar' && mockState.turn === 'white';
  const skipBlackBar = drag.active && drag.fromPt === 'bar' && mockState.turn === 'black';
  const barIdx = drag.barIdx != null ? drag.barIdx : -1;
  for (let i = 0; i < mockState.bar.white; i++) {
    if (skipWhiteBar && i === barIdx) continue;
    drawChecker(barCX, by + 6.5*a - r - i*a, true, false, false, C.bar);
  }
  for (let i = 0; i < mockState.bar.black; i++) {
    if (skipBlackBar && i === barIdx) continue;
    drawChecker(barCX, by + 6.5*a + r + i*a, false, false, false, C.bar);
  }
}

function drawStackOnPoint(pt, count, isWhite, skipN) {
  const drawN   = count - (skipN || 0);
  if (drawN <= 0) return;
  const cx      = ptCenterX(pt);
  const isBot   = pt <= 12;
  const visible = min(drawN, MAX_STACK);
  const overflow = max(drawN - MAX_STACK, 0);

  // Est-ce que ce point est une cible valide ?
  const targets = drag.active ? getValidTargets(drag.fromPt) : [];
  const isTarget = targets.includes(pt);
  const isSnapped = drag.snapPt === pt;

  const bgCol = triColorForPoint(pt);
  for (let i = 0; i < visible; i++) {
    const cy = isBot ? by + 13*a - r - i*a : by + r + i*a;
    const isTop = (i === visible - 1);
    // Apparition fade-in par pièce au démarrage de partie
    const alpha = checkerFadeAlpha(pt, i);
    if (alpha <= 0) continue;
    const useAlpha = alpha < 1;
    if (useAlpha) {
      drawingContext.save();
      drawingContext.globalAlpha = alpha;
    }
    if (isTop && overflow > 0) {
      // Pièce du sommet portant le label "+N" : pas de symbole nortechico
      // (drawCheckerLabel ne le dessine pas). Les pièces du dessous gardent
      // leur symbole normalement.
      drawCheckerLabel(cx, cy, isWhite, `+${overflow}`);
    } else {
      drawChecker(cx, cy, isWhite, isTop && (isTarget || isSnapped), false, bgCol);
    }
    if (useAlpha) drawingContext.restore();
  }
}

// Couleur du triangle au point pt (1-24). Reproduit l'alternance de drawBoard.
function triColorForPoint(pt) {
  if (pt < 1 || pt > 24) return null;
  let dark;
  if      (pt >=  1 && pt <=  6) dark = (pt % 2 === 1);  // pt impair = triA
  else if (pt >=  7 && pt <= 12) dark = (pt % 2 === 0);  // pt pair   = triA
  else if (pt >= 13 && pt <= 18) dark = (pt % 2 === 1);
  else                            dark = (pt % 2 === 0);
  return dark ? C.triA : C.triB;
}

function drawChecker(cx, cy, isWhite, fiberOptic, suppressMark, bgCol) {
  fill(isWhite ? C.offwhite : C.ruby); noStroke();
  ellipse(cx, cy, 2*r, 2*r);
  // Theme 'nortechico' : symbole gravé sur les pièces white ET black.
  // Couleur du symbole choisie pour rester VISIBLE :
  //  - pièce white (claire) → couleur du triangle/bar (foncé) à 20 % → tint sombre
  //  - pièce black (foncée) → couleur claire (offwhite) à 20 % → tint claire
  // Le rendu garde le sens "fenêtre 20 % vers le board" pour le white ; pour le
  // black on choisit l'inverse colorimétrique pour que le glyphe soit lisible.
  if (!suppressMark && bgCol && typeof userNick !== 'undefined' && userNick === 'NORTECHICO') {
    const markCol = isWhite ? bgCol : C.offwhite;
    drawNortechicoMark(cx, cy, markCol);
  }
}

// Symbole custom Norte Chico (U+F8FF dans la police nortechico) "translucide"
// sur la pièce : on dessine le symbole avec la COULEUR DU FOND DU PLATEAU
// (triangle ou bar) à 20 % d'opacité par-dessus la pièce — la pièce reste
// opaque (pas de punch vers le backdrop canvas), seule la teinte du board
// transparaît dans la forme du symbole. Centrage vertical micro-corrigé via
// NORTECHICO_Y_NUDGE pour compenser l'ascender pixel-font.
// Mirror : on re-flip localement pour que le glyphe reste orienté correctement.
const NORTECHICO_GLYPH = '';
// Nudge vertical : positif = descend, négatif = monte. La pixel-font place
// le glyphe bas dans son em ; on remonte de −0.27·r (≈ ½ cellule pixel
// supplémentaire au-delà de −0.20) pour bien centrer le symbole.
const NORTECHICO_Y_NUDGE = -0.27;
function drawNortechicoMark(cx, cy, bgCol) {
  if (!fontLarge) return;
  noStroke();
  fill(red(bgCol), green(bgCol), blue(bgCol), Math.round(255 * 0.20));
  textFont(fontLarge); textSize(r * 1.6); textAlign(CENTER, CENTER);
  const cyOff = cy + r * NORTECHICO_Y_NUDGE;
  if (mirrorMode) {
    push(); translate(cx, cyOff); scale(-1, 1); text(NORTECHICO_GLYPH, 0, 0); pop();
  } else {
    text(NORTECHICO_GLYPH, cx, cyOff);
  }
}

function drawCheckerLabel(cx, cy, isWhite, label) {
  fill(isWhite ? C.offwhite : C.ruby); noStroke();
  ellipse(cx, cy, 2*r, 2*r);
  noStroke();
  fill(isWhite ? C.numColor : C.ivory);
  textAlign(CENTER, CENTER);
  textFont(fontLarge);
  textSize(r * 0.78);
  // En mirror le canvas est flippé horizontalement : on ré-flip localement le texte
  if (mirrorMode) {
    push();
    translate(cx, cy);
    scale(-1, 1);
    text(label, 0, 0);
    pop();
  } else {
    text(label, cx, cy);
  }
}

// ── Animation parabolique d'un mouvement (IA / adversaire) ───────────────────
function pieceXY(pt, isWhite) {
  if (pt === 'bar') {
    // Position du sommet de la pile bar (où se trouve la prochaine fiche à sortir)
    const n      = isWhite ? mockState.bar.white : mockState.bar.black;
    const stackN = Math.max(1, n);
    const cy     = by + 6.5*a;
    return isWhite
      ? { x: bx + 6.5*a, y: cy - r - (stackN - 1) * a }
      : { x: bx + 6.5*a, y: cy + r + (stackN - 1) * a };
  }
  if (pt === 0) {
    // Off zone : position du prochain slot pour ce joueur (utilisé pour le
    // flying checker, dessiné dans le flip mirror — donc coords board).
    const idx = isWhite ? mockState.off.white : mockState.off.black;
    if (diceOnSide) {
      const w = 2*r, h = r*0.4, step = h + h, cy = by + 6.5*a;
      const colW = w + r/2;
      const x = bx + 13*a + r + Math.floor(idx/8)*colW + w/2;
      const pos = idx % 8;
      const y = isWhite ? cy + r + pos*step + h/2 : cy - r - pos*step - h/2;
      return { x, y };
    }
    const G = offGeomPortrait();
    const x = G.x0 - G.w - idx * G.step + G.w/2;
    const y = isWhite ? G.yW + G.h/2 : G.yB + G.h/2;
    return { x, y };
  }
  return { x: ptCenterX(pt), y: ptTopY(pt) };
}

// Position d'ATTERRISSAGE d'une pièce sur un point de destination — différente
// de pieceXY qui retourne la position de la pièce du sommet déjà existante.
// - Sur un point board : slot suivant (ou slot 0 si la cible est vide ou si on hit).
// - Sur la barre        : juste au-dessus des pièces déjà sur la barre.
// - Sur off (pt=0)      : pieceXY retourne déjà la position du prochain slot.
function landingXY(toPt, isWhite, hit) {
  if (toPt === 0) return pieceXY(0, isWhite);
  if (toPt === 'bar') {
    const n  = isWhite ? mockState.bar.white : mockState.bar.black;
    const cy = by + 6.5 * a;
    return isWhite
      ? { x: bx + 6.5 * a, y: cy - r - n * a }
      : { x: bx + 6.5 * a, y: cy + r + n * a };
  }
  let nDest = Math.abs(mockState.points[toPt] || 0);
  if (hit) nDest = Math.max(0, nDest - 1);    // la pièce mangée est retirée avant l'arrivée
  const isBot = toPt <= 12;
  const visN  = Math.min(nDest, MAX_STACK);
  return {
    x: ptCenterX(toPt),
    y: isBot ? by + 13*a - r - visN * a : by + r + visN * a,
  };
}

function startFlyingChecker(fromPt, toPt, isWhite, onDone, hit, diceValue, intermediatePts) {
  const a0 = pieceXY(fromPt, isWhite);
  const a1 = landingXY(toPt, isWhite, hit);   // ← position réelle d'atterrissage
  // hit = { pt, isWhite } : pièce mangée à toPt (fade out simultané)
  // diceValue = valeur du dé consommé (fade en sync avec l'anim)
  // intermediatePts = liste des points intermédiaires d'un mouvement combiné (cercles vides)
  const interms = (intermediatePts || []).map(pt => pieceXY(pt, isWhite));
  flyingChecker = {
    from: fromPt, to: toPt, isWhite,
    fromX: a0.x, fromY: a0.y, toX: a1.x, toY: a1.y,
    t0: millis(), dur: 900, onDone,
    hit: hit || null,
    diceValue: diceValue || null,
    dicePlayer: isWhite ? 'white' : 'black',
    intermediates: interms,
  };
}

function drawFlyingChecker() {
  if (!flyingChecker) return;
  const fc = flyingChecker;
  const elapsed = millis() - fc.t0;
  if (elapsed >= fc.dur) {
    const cb = fc.onDone;
    flyingChecker = null;
    if (cb) cb();
    return;
  }
  const t   = elapsed / fc.dur;
  const ts  = t * t * (3 - 2 * t);                 // smoothstep
  const col = fc.isWhite ? C.offwhite : C.ruby;
  const cR  = red(col), cG = green(col), cB = blue(col);
  noStroke();

  // Animation par GLISSEMENT : la pièce se déplace de fromXY → toXY à pleine
  // opacité, sans fade. Pour ne pas passer "au-dessus" des pièces empilées
  // sur les points intermédiaires, la trajectoire est légèrement courbée :
  //  - même demi-plateau (top↔top ou bot↔bot) : bulge vers le centre du
  //    plateau (les piles sont sur les bords) → contourne les pièces comme
  //    le ferait un doigt
  //  - traverse la barre verticale : léger HOP supplémentaire pour visualiser
  //    le passage au-dessus de la barre
  const barX  = bx + 6.5 * a;
  const fromRight = fc.fromX > barX;
  const toRight   = fc.toX > barX;
  const crossesBar = fromRight !== toRight;

  const midY    = by + 6.5 * a;
  const fromTop = fc.fromY < midY;
  const toTop   = fc.toY   < midY;
  const sameHalf = fromTop === toTop;

  const px = fc.fromX + (fc.toX - fc.fromX) * ts;
  let py   = fc.fromY + (fc.toY - fc.fromY) * ts;

  // Bulge vers le centre si même demi-plateau (sinon trajet passe déjà au milieu)
  if (sameHalf) {
    const bulge = a * 1.5;                  // amplitude du contournement
    py += (fromTop ? 1 : -1) * 4 * bulge * ts * (1 - ts);
  }
  // Hop additionnel si on traverse la barre verticale
  if (crossesBar) {
    const lift = r * 0.7;
    py -= 4 * lift * ts * (1 - ts);
  }

  // Pièce volante à pleine opacité (plus de fade source/destination)
  fill(cR, cG, cB);
  ellipse(px, py, 2*r, 2*r);
  // Theme nortechico : conserve le symbole pendant le glissement
  if (typeof userNick !== 'undefined' && userNick === 'NORTECHICO') {
    // Couleur de fond approximative : on prend le triangle du point d'origine
    // si pt valide, sinon C.bar.
    const fromBg = (typeof fc.from === 'number') ? triColorForPoint(fc.from) : C.bar;
    if (fromBg) {
      const markCol = fc.isWhite ? fromBg : C.offwhite;
      drawNortechicoMark(px, py, markCol);
    }
  }

  // Pièce mangée : fade out simultané à sa position
  if (fc.hit) {
    const hCol = fc.hit.isWhite ? C.offwhite : C.ruby;
    const hPos = pieceXY(fc.hit.pt, fc.hit.isWhite);
    fill(red(hCol), green(hCol), blue(hCol), Math.round(255 * (1 - ts)));
    ellipse(hPos.x, hPos.y, 2*r, 2*r);
  }
  // Positions intermédiaires d'un mouvement combiné : cercles vides pour indiquer le passage
  if (fc.intermediates && fc.intermediates.length > 0) {
    noFill();
    stroke(C.ivory);
    strokeWeight(1);
    for (const ip of fc.intermediates) ellipse(ip.x, ip.y, 2*r, 2*r);
  }
}

// Pièce(s) en cours de drag — la fiche cliquée est au curseur, les autres suivent
// l'orientation de la pile sur le plateau (au-dessus pour pt 1-12, en-dessous pour 13-24)
function drawDraggedChecker() {
  const isWhite = drag.fromPt === 'bar'
    ? mockState.turn === 'white'
    : mockState.points[drag.fromPt] > 0;
  const N = drag.numPieces || 1;
  // pt 1-12 (bas plateau, pile vers le haut sur le plateau) → empile vers le haut depuis curseur
  // pt 13-24 (haut plateau, pile vers le bas sur le plateau) → empile vers le bas depuis curseur
  const isBot = (drag.fromPt !== 'bar') && (drag.fromPt <= 12);
  const dy = isBot ? -1 : 1;
  noStroke();
  fill(0, 0, 0, 25);
  ellipse(drag.dispX + 2, drag.dispY + 3, 2*r + 8, 2*r + 8);
  // Couleur du fond pour le symbole nortechico (basée sur le point d'origine)
  const dragBg  = drag.fromPt === 'bar' ? C.bar : triColorForPoint(drag.fromPt);
  const showSym = dragBg && typeof userNick !== 'undefined' && userNick === 'NORTECHICO';
  for (let i = 0; i < N; i++) {
    const cx = drag.dispX;
    const cy = drag.dispY + dy * i * a;
    fill(isWhite ? C.offwhite : C.ruby);
    ellipse(cx, cy, 2*r, 2*r);
    if (showSym) {
      const markCol = isWhite ? dragBg : C.offwhite;
      drawNortechicoMark(cx, cy, markCol);
    }
  }
}

// ── Mouvements valides ────────────────────────────────────────────────────────
// Retourne les destinations valides ; 0 = bearing off
function getValidTargets(fromPt) {
  if (gameMode) return getRealTargets(fromPt);

  // Mode mock (scénarios de test [1]-[4])
  const dice    = mockState.dice;
  const targets = [];

  function addDest(dest) {
    if (dest >= 1 && dest <= 24) {
      if (!targets.includes(dest)) targets.push(dest);
    } else if (dest <= 0 && mockState.phase === 'bearingOff') {
      if (!targets.includes(0)) targets.push(0);
    }
  }

  for (const d of dice) addDest(fromPt - d);

  if (dice.length === 2) {
    const sum  = dice[0] + dice[1];
    const mid0 = fromPt - dice[0];
    const mid1 = fromPt - dice[1];
    if (isPtAvailable(mid0) || isPtAvailable(mid1)) addDest(fromPt - sum);
  }
  return targets;
}

// Vérifie qu'un point n'est pas bloqué (mode mock uniquement)
function isPtAvailable(pt) {
  if (pt < 1 || pt > 24) return false;
  const val  = mockState.points[pt] || 0;
  const sign = mockState.turn === 'white' ? 1 : -1;
  return val * sign >= 0 || Math.abs(val) <= 1;
}

// ── Événements souris ─────────────────────────────────────────────────────────
function mousePressed() {
  // ── Intro : un tap saute l'animation et passe au sign-in/choice ──
  if (appState === 'intro') {
    appState = 'signin';
    signinMode = 'choice';
    return;
  }

  // ── Menu : sélection du mode de jeu ──
  if (appState === 'menu') {
    for (const btn of menuBtns) {
      if (mouseX >= btn.x && mouseX <= btn.x + btn.w
          && mouseY >= btn.y && mouseY <= btn.y + btn.h) {
        gameModeSelected = btn.id;
        if (btn.id === 'online') {
          appState = 'room';   // lobby existant
        } else {
          appState = 'game';
          aiMode  = (btn.id === 'ai');
          // Démarre le fade-out de la fenêtre menu. Le wave (gameFillT0,
          // startGame, …) sera lancé une fois le voile entièrement disparu.
          menuFadeOutT0 = millis();
        }
        return;
      }
    }
    return;
  }

  // ── Sign-in : 3 sous-modes ─────────────────────────────────────────────
  //  - 'choice' : clic sur SIGN IN / GUEST → bascule en sous-mode correspondant
  //  - 'full' / 'guest' : tap n'importe où soumet (input garde le focus mobile)
  if (appState === 'signin') {
    if (signinMode === 'choice') {
      for (const btn of signinChoiceBtns) {
        if (mouseX >= btn.x && mouseX <= btn.x + btn.w
            && mouseY >= btn.y && mouseY <= btn.y + btn.h) {
          signinMode = btn.id;   // 'full' ou 'guest'
          return;
        }
      }
      return;
    }
    submitSignin();
    return;
  }

  // ── Room (lobby) : click sur joueur disponible → invitation + accept auto (mock) ──
  if (appState === 'room') {
    // EXIT : retour au jeu (ou état neutre si aucune partie en cours)
    for (const eb of exitBtns) {
      if (mouseX >= eb.x && mouseX <= eb.x + eb.w
          && mouseY >= eb.y && mouseY <= eb.y + eb.h) {
        appState = 'game';
        return;
      }
    }
    for (const btn of roomBtns) {
      if (mouseX >= btn.x && mouseX <= btn.x + btn.w
          && mouseY >= btn.y && mouseY <= btn.y + btn.h) {
        inviteTarget = btn.player;
        appState = 'waiting';
        // Mock : l'adversaire accepte automatiquement après 1.5 s
        setTimeout(() => {
          if (appState === 'waiting' && inviteTarget === btn.player) {
            appState = 'game';
            // Reset score session pour une vraie nouvelle partie
            if (typeof gameScore !== 'undefined') {
              gameScore.white = 0; gameScore.black = 0;
            }
            // Bascule miroir + nouveau fond entre deux parties
            mirrorMode = !mirrorMode;
            const next = FOND_LIST[Math.floor(Math.random() * FOND_LIST.length)];
            currentFond = next;
            loadImage(currentFond, (img) => {
              bgImage = img;
              dominantHue = extractDominantHue(img);
              buildPalette();
              document.body.style.backgroundImage = `url('${currentFond}')`;
            });
            startGame();
            checkerAppearT0 = 0;   // pas de fade-in : fiches à couleur finale directe
            inviteTarget = null;
          }
        }, 1500);
        return;
      }
    }
    return;
  }

  // ── Waiting : cancel ──
  if (appState === 'waiting') {
    if (modalBtns && modalBtns.cancel && isClickInBtn(modalBtns.cancel)) {
      appState = 'room';
      inviteTarget = null;
    }
    return;
  }

  // R7 + Quit : modals prioritaires
  if (modalState && modalBtns) {
    if (modalState.type === 'offer') {
      if (modalBtns.yes && isClickInBtn(modalBtns.yes)) { modalOfferResponse(true);  return; }
      if (modalBtns.no  && isClickInBtn(modalBtns.no))  { modalOfferResponse(false); return; }
    }
    if (modalState.type === 'accept') {
      if (modalBtns.accept  && isClickInBtn(modalBtns.accept))  { modalAcceptResponse(true);  return; }
      if (modalBtns.decline && isClickInBtn(modalBtns.decline)) { modalAcceptResponse(false); return; }
    }
    if (modalState.type === 'quit') {
      if (modalBtns.yes && isClickInBtn(modalBtns.yes)) {
        modalState = null; appState = 'room'; return;
      }
      if (modalBtns.no && isClickInBtn(modalBtns.no)) {
        modalState = null; return;
      }
    }
    if (modalState.type === 'resign') {
      if (modalBtns.yes && isClickInBtn(modalBtns.yes)) {
        const player = modalState.player;
        modalState = null;
        resign(player);
        return;
      }
      if (modalBtns.no && isClickInBtn(modalBtns.no)) {
        modalState = null; return;
      }
    }
    return;
  }

  // Bouton EXIT (↪⁰) : zones cliquables précises
  // - Overlay profil ouvert : EXIT ferme l'overlay
  // - Game over          : EXIT retourne au room
  // - Sinon              : EXIT ouvre le modal QUIT
  for (const eb of exitBtns) {
    if (mouseX >= eb.x && mouseX <= eb.x + eb.w
        && mouseY >= eb.y && mouseY <= eb.y + eb.h) {
      if (profileOverlay) { profileOverlay = null; return; }
      if (gameWinner)     { appState = 'room';     return; }
      modalState = { type: 'quit' };
      return;
    }
  }

  // Si overlay profil ouvert :
  //  - clic sur SIGN OUT  → reset nickname + retour à l'écran sign-in
  //  - clic n'importe où  → ferme l'overlay
  if (profileOverlay) {
    if (signoutBtn
        && mouseX >= signoutBtn.x && mouseX <= signoutBtn.x + signoutBtn.w
        && mouseY >= signoutBtn.y && mouseY <= signoutBtn.y + signoutBtn.h) {
      try { localStorage.removeItem(NICK_STORAGE_KEY); } catch (e) {}
      userNick = null;
      profileOverlay = null;
      appState = 'signin';
      return;
    }
    profileOverlay = null;
    return;
  }

  // Clic sur le nom d'un joueur → ouvre l'overlay profil
  for (const player of ['white', 'black']) {
    const nb = nameBtns[player];
    if (nb && mouseX >= nb.x && mouseX <= nb.x + nb.w
          && mouseY >= nb.y && mouseY <= nb.y + nb.h) {
      profileOverlay = player;
      recentGamesScroll = 0;        // reset scroll à l'ouverture du profil
      return;
    }
  }

  if (gameMode && gameWinner) return;

  // R6 : drapeau RESIGN — 1 clic ouvre directement le modal de confirmation.
  // Le drapeau passe plein (⚑) pendant que le modal est ouvert.
  const onResign = resignBtn
      && mouseX >= resignBtn.x && mouseX <= resignBtn.x + resignBtn.w
      && mouseY >= resignBtn.y && mouseY <= resignBtn.y + resignBtn.h;
  if (onResign) {
    modalState = { type: 'resign', player: resignBtn.player };
    return;
  }

  // R7 : clic sur le doubling cube — n'importe quand, pour le LOCAL_PLAYER (et son adversaire en hot-seat)
  for (const player of ['white', 'black']) {
    if (aiMode && player !== LOCAL_PLAYER) continue;   // en IA, seul le joueur local clique
    const cb = cubeBtns && cubeBtns[player];
    if (cb && dist(mouseX, mouseY, cb.x, cb.y) <= cb.r) {
      clickCube(player);
      return;
    }
  }

  if (isClickOnDiceZone(mouseX, mouseY, mockState.turn)) {
    // En mode jeu réel : pas de relance manuelle (les dés sont gérés par endTurn)
    if (!gameMode && (diceAnim.state === DS.EMPTY || diceAnim.state === DS.DONE)) {
      clearDice();
      startRoll(mockState.dice, mockState.turn);
    }
    return;
  }

  // En mode IA, pendant le tour de l'IA → pas de drag possible (l'IA joue toute seule)
  if (aiMode && mockState.turn !== LOCAL_PLAYER) return;
  // Fiches sur la barre (priorité : must move bar pieces first)
  const barCX = bx + 6.5*a;
  if (mockState.turn === 'white' && mockState.bar.white > 0) {
    for (let bi = 0; bi < mockState.bar.white; bi++) {
      const barCY = by + 6.5*a - r - bi*a;
      if (dist(mouseX, mouseY, barCX, barCY) < r) {
        drag.active = true; drag.fromPt = 'bar'; drag.numPieces = 1;
        drag.barIdx = bi;     // index de la pièce prise (0 = sommet)
        drag.mouseX = drag.dispX = mouseX;
        drag.mouseY = drag.dispY = mouseY;
        drag.snapPt = null;
        return;
      }
    }
  }
  if (mockState.turn === 'black' && mockState.bar.black > 0) {
    for (let bi = 0; bi < mockState.bar.black; bi++) {
      const barCY = by + 6.5*a + r + bi*a;
      if (dist(mouseX, mouseY, barCX, barCY) < r) {
        drag.active = true; drag.fromPt = 'bar'; drag.numPieces = 1;
        drag.barIdx = bi;
        drag.mouseX = drag.dispX = mouseX;
        drag.mouseY = drag.dispY = mouseY;
        drag.snapPt = null;
        return;
      }
    }
  }
  const eMx = effMouseX();   // x logique (compense le flip mirror sur le board)
  for (let pt = 1; pt <= 24; pt++) {
    const val = mockState.points[pt];
    if (!val) continue;
    if (mockState.turn === 'white' && val < 0) continue;
    if (mockState.turn === 'black' && val > 0) continue;
    const cx = ptCenterX(pt);
    const stackCount = abs(val);
    const isBot      = pt <= 12;
    const visible    = min(stackCount, MAX_STACK);

    let clickedIdx = -1;
    for (let i = 0; i < visible; i++) {
      const cy = isBot ? by + 13*a - r - i*a : by + r + i*a;
      if (dist(eMx, mouseY, cx, cy) < r) clickedIdx = i;
    }
    if (clickedIdx < 0) continue;

    let numTaken = visible - clickedIdx;
    if (gameMode && gameState && gameState.dice && gameState.dice.length === 4) {
      numTaken = min(numTaken, gameState.moves.length);
    } else {
      numTaken = 1;
    }
    if (numTaken < 1) numTaken = 1;

    drag.active    = true;
    drag.fromPt    = pt;
    drag.numPieces = numTaken;
    drag.mouseX    = drag.dispX = eMx;
    drag.mouseY    = drag.dispY = mouseY;
    drag.snapPt    = null;
    break;
  }
}

function mouseDragged() {
  if (!drag.active) return;
  const eMx = effMouseX();
  drag.mouseX = eMx;
  drag.mouseY = mouseY;
  drag.snapPt = null;
  for (const tpt of getValidTargets(drag.fromPt)) {
    if (tpt === 0) {
      // Off zone : zone large pour faciliter le drop bear-off.
      // Paysage  : à droite du plateau (anywhere right of the board edge).
      // Portrait : tout l'espace SOUS le plateau (white) ou AU-DESSUS (black).
      if (diceOnSide) {
        if (eMx > bx + 13*a) { drag.snapPt = 0; break; }
      } else {
        if (mockState.turn === 'white' && mouseY > by + 13*a) { drag.snapPt = 0; break; }
        if (mockState.turn === 'black' && mouseY < by)         { drag.snapPt = 0; break; }
      }
    } else {
      if (abs(eMx - ptCenterX(tpt)) <= a / 2) { drag.snapPt = tpt; break; }
    }
  }
}

function mouseReleased() {
  if (!drag.active) return;
  if (drag.snapPt !== null) {
    if (gameMode) {
      const N = drag.numPieces || 1;
      if (N > 1) applyMultipleMoves(drag.fromPt, drag.snapPt, N);
      else       applyRealMove(drag.fromPt, drag.snapPt);
    } else {
      // Mode mock : mutation directe
      const sign = mockState.turn === 'white' ? 1 : -1;
      mockState.points[drag.fromPt] -= sign;
      if (drag.snapPt === 0) {
        if (mockState.turn === 'white') mockState.off.white++;
        else                            mockState.off.black++;
      } else {
        mockState.points[drag.snapPt] += sign;
      }
    }
  }
  drag.active = false; drag.fromPt = null; drag.snapPt = null;
  drag.numPieces = 1;
}

// ── Bearing off ─────────────────────────────────────────────────────────────
// Layout style "horizontal" historique : fiches pivotées (0.4r × 2r) empilées
// le long du bord droit du plateau, en allant vers la gauche.
// Y des piles :
//  - Portrait : 1/3 sous le bas du bloc info white (vers EXIT) ; 1/3 au-dessus
//    du haut du bloc info black (vers haut canvas) — symétrique.
//  - Paysage : axe central du plateau ; white descend, black monte.
// Compteur (XX) à gauche de la dernière fiche, jusqu'à (15).
// Si plus de place : on tronque les fiches mais (XX) affiche le vrai total.
function offGeomPortrait() {
  const w    = r * 0.4;
  const h    = 2 * r;
  const gap  = (r / 2) * 4/5;        // 0.4r → step = 0.8r
  const step = w + gap;
  const x0   = bx + 13*a;
  const ds   = dieSize();
  const yWtextBot = by + 13*a + r*1.6 + ds;
  const yBtextTop = by - ds - r*1.6;
  // Aligne le centre vertical des pièces de bearing-off sur le centre du
  // texte (X) → midpoint entre yWtextBot et windowHeight (white), ou
  // entre yBtextTop et 0 (black). Pièce a hauteur h, donc top = center - h/2.
  const yW = (yWtextBot + windowHeight) / 2 - h / 2;
  const yB = yBtextTop / 2 - h / 2;
  return { w, h, gap, step, x0, yW, yB };
}

function drawOff() {
  const canBearOff = drag.active && getValidTargets(drag.fromPt).includes(0);
  if (diceOnSide) drawOffLandscape(canBearOff);
  else            drawOffPortrait(canBearOff);
}

function drawOffPortrait(canBearOff) {
  const G = offGeomPortrait();
  const cntSize = r * 0.7;
  const cntPad  = r * 0.4;

  drawSideStack('white', C.offwhite, G.yW);
  drawSideStack('black', C.ruby,     G.yB);

  function drawSideStack(player, color, y) {
    const off       = mockState.off[player];
    const showGhost = canBearOff && mockState.turn === player;
    const totalDraw = off + (showGhost ? 1 : 0);
    if (totalDraw === 0) return;

    // Cap : combien de fiches tiennent + compteur avant le bord gauche du canvas
    textFont(fontLarge); textSize(cntSize);
    const cntStr   = '(' + String(off).padStart(2, '0') + ')';
    const cntStrW  = textWidth('(15)');
    const leftSafe = r / 2;
    const availW   = G.x0 - leftSafe - cntStrW - cntPad;
    const maxN     = Math.max(0, Math.min(15, Math.floor((availW + G.gap) / G.step)));
    const visN     = Math.min(totalDraw, maxN);
    const visOff   = Math.min(off, visN);
    const visGhost = (visN > visOff) ? 1 : 0;

    // Fiches réelles
    fill(color); noStroke();
    for (let i = 0; i < visOff; i++) {
      rect(G.x0 - G.w - i * G.step, y, G.w, G.h);
    }
    // Fiche fantôme (prochain bear-off)
    if (visGhost) {
      fill(red(color), green(color), blue(color), 153);
      rect(G.x0 - G.w - visOff * G.step, y, G.w, G.h);
    }

    // Compteur (XX) à gauche de la dernière fiche, centré verticalement
    if (off >= 1) {
      noStroke(); fill(C.ivory);
      textFont(fontLarge); textSize(cntSize);
      textAlign(RIGHT, CENTER);
      const lastIdx = Math.max(0, (visOff + visGhost) - 1);
      const lastX   = G.x0 - G.w - lastIdx * G.step;     // bord gauche dernière fiche
      text(cntStr, lastX - cntPad, y + G.h / 2);
      textAlign(LEFT, TOP);
    }
  }
}

function drawOffLandscape(canBearOff) {
  // Layout paysage historique : axe central, fiches 2r × 0.4r empilées
  // verticalement, white vers le bas, black vers le haut. Compteur (XX) à
  // l'extrémité de la pile, plafond max 15.
  const w    = 2*r;
  const h    = r * 0.4;
  const gap  = h;
  const step = h + gap;       // 0.8r
  const colW = w + r/2;
  const cy   = by + 6.5*a;
  const ox   = bx + 13*a + r;
  const cntSize = r * 0.7;
  const cntPad  = r * 0.4;

  drawSideStack('white', C.offwhite, true);
  drawSideStack('black', C.ruby,     false);

  function drawSideStack(player, color, growDown) {
    const off       = mockState.off[player];
    const showGhost = canBearOff && mockState.turn === player;
    const totalDraw = off + (showGhost ? 1 : 0);
    if (totalDraw === 0) return;

    // 8 fiches par colonne, on tient sur 2 colonnes max → 16 ≥ 15
    const visN     = Math.min(totalDraw, 15);
    const visOff   = Math.min(off, visN);
    const visGhost = (visN > visOff) ? 1 : 0;

    function px(i) { return ox + Math.floor(i/8) * colW; }
    function py(i) {
      const pos = i % 8;
      return growDown ? cy + r + pos*step : cy - r - pos*step - h;
    }

    fill(color); noStroke();
    for (let i = 0; i < visOff; i++) rect(px(i), py(i), w, h);
    if (visGhost) {
      fill(red(color), green(color), blue(color), 153);
      rect(px(visOff), py(visOff), w, h);
    }

    if (off >= 1) {
      noStroke(); fill(C.ivory);
      textFont(fontLarge); textSize(cntSize);
      const cntStr = '(' + String(off).padStart(2, '0') + ')';
      const lastIdx = Math.max(0, (visOff + visGhost) - 1);
      const cx = px(lastIdx) + w / 2;
      const cntY = growDown ? py(lastIdx) + h + cntPad : py(lastIdx) - cntPad;
      textAlign(CENTER, growDown ? TOP : BOTTOM);
      text(cntStr, cx, cntY);
      textAlign(LEFT, TOP);
    }
  }
}

// ── Numéros des points ────────────────────────────────────────────────────────
// Dessinés HORS flip pour rester lisibles ; position x miroir si mirrorMode
function drawPointNumbers() {
  textFont(fontSmall);
  textSize(r * 0.55);
  textAlign(CENTER, CENTER);
  noStroke();
  fill(C.ivory);
  for (let pt = 1; pt <= 24; pt++) {
    const cy = pt <= 12 ? by + 13*a + r*0.8 : by - r*0.8;
    let cx = ptCenterX(pt);
    if (mirrorMode) cx = mirrorX(cx);
    text(pt, cx, cy);
  }
}

// ── Pip count ─────────────────────────────────────────────────────────────────
function computePip(color) {
  let total = 0;
  for (let pt = 1; pt <= 24; pt++) {
    const val = mockState.points[pt] || 0;
    if (color === 'white' && val > 0) total += pt * val;
    if (color === 'black' && val < 0) total += (25 - pt) * abs(val);
  }
  total += (color === 'white') ? mockState.bar.white * 25 : mockState.bar.black * 25;
  return total;
}

// ── Info joueurs ──────────────────────────────────────────────────────────────
function drawPlayerInfo() {
  if (!fontLarge || !fontSmall) return;
  noStroke();
  fill(C.ivory);

  // Détection du changement de tour pour la transition de taille fluide.
  // Pendant l'opening roll (joueur initial pas encore déterminé), on utilise
  // un sentinel 'none' qui force les DEUX joueurs en disposition INACTIVE
  // (nom grand, info petite). Quand l'opening se termine, currentTurn passe
  // de 'none' à 'white' / 'black' → la transition fluide habituelle anime
  // l'agrandissement de l'info / réduction du nom du joueur actif uniquement.
  if (mockState && mockState.turn) {
    const _inOpening = (typeof openingActive !== 'undefined' && openingActive);
    const effectiveTurn = _inOpening ? 'none' : mockState.turn;
    if (currentTurn !== effectiveTurn) {
      if (currentTurn !== null) {
        prevTurn     = currentTurn;
        turnChangeT0 = millis();
      }
      currentTurn = effectiveTurn;
    }
  }

  const pipW  = computePip('white');
  const pipB  = computePip('black');
  const sW    = (typeof gameScore !== 'undefined') ? gameScore.white : 0;
  const sB    = (typeof gameScore !== 'undefined') ? gameScore.black : 0;
  const baseW = (mockState.players && mockState.players.white) || 'USER 2';
  const baseB = (mockState.players && mockState.players.black) || 'USER 1';
  // Bloc nom + pip line ≈ 3.5r — top aligné sur bord sup du dé,
  // bottom aligné sur bord inf du dé (dieSize = 3.5r).
  // Tailles ADAPTÉES À TOUR DE RÔLE :
  //   - Joueur ACTIF (son tour) : nom + info à la MÊME taille moyenne (1.6r)
  //     pour bien lire les minuteurs sans contraste exagéré (1.6 + 0.3 + 1.6 = 3.5r ✓).
  //   - Joueur INACTIF : disposition standard nom GRAND (2r) + info petite (1.2r)
  //     (2 + 0.3 + 1.2 = 3.5r ✓).
  // Total blockH = 3.5r dans les deux cas → alignement avec dieSize intact.
  const SZ_BIG   = r * 2.00;
  const SZ_SMALL = r * 1.20;
  const SZ_MID   = r * 1.60;
  const gap = r * 0.30;
  // Tailles cible pour un joueur en fonction du tour actif (turn === player ?)
  function _szTarget(player, turn) {
    const active = (turn === player);
    return { n: active ? SZ_MID : SZ_BIG, p: active ? SZ_MID : SZ_SMALL };
  }
  // Coefficient de transition [0..1] : 1 = état stable (pas d'animation),
  // valeurs intermédiaires = en cours d'interpolation.
  // smootherstep (quintique) > easeInOutCubic en termes de douceur :
  // dérivée ET dérivée seconde nulles aux extrêmes → arrivée et départ
  // sans à-coup, transition la plus "souple" possible.
  function _turnT() {
    if (prevTurn === null || !turnChangeT0) return 1;
    const el = millis() - turnChangeT0;
    if (el >= TURN_FADE_DUR) return 1;
    return smootherstep(el / TURN_FADE_DUR);
  }
  // Le sentinel 'none' (utilisé pendant l'opening roll) fait que _szTarget
  // retourne la disposition inactive (SZ_BIG/SZ_SMALL) pour les DEUX joueurs.
  // Pas besoin de short-circuit ici, la logique d'interpolation s'en charge.
  function szN_for(player) {
    const t = _turnT();
    const to = _szTarget(player, currentTurn || mockState.turn).n;
    if (t >= 1 || prevTurn === null) return to;
    const from = _szTarget(player, prevTurn).n;
    return from + (to - from) * t;
  }
  function szP_for(player) {
    const t = _turnT();
    const to = _szTarget(player, currentTurn || mockState.turn).p;
    if (t >= 1 || prevTurn === null) return to;
    const from = _szTarget(player, prevTurn).p;
    return from + (to - from) * t;
  }
  function blockHFor(player) { return szN_for(player) + gap + szP_for(player); }

  /* drawExitUnderPip supprimé : EXIT est maintenant en bas via drawExitButton.
     Bloc commenté ci-dessous pour éviter les références mortes à szExit.
  function _removed_drawExitUnderPip(x, y) {
    const arrow = '\u21AA';
    const rect0 = '\u25AF';
    const rect1 = '\u25AE';
    textFont('Arial'); textSize(szExit); textAlign(LEFT, TOP);
    noStroke(); fill(C.ivory);
    const arrowW = textWidth(arrow);
    const rectW  = textWidth(rect0);
    const totalW = arrowW + rectW;
    const isHover = mouseX >= x && mouseX <= x + totalW
                 && mouseY >= y && mouseY <= y + szExit;
    text(arrow, x, y);
  } */

  // Dessine la 2e ligne : +XXX⬤ (15) (1:59) ⚐
  function drawSecondLine(x, y, pip, player) {
    const szP       = szP_for(player);              // taille de l'info ligne (per-tour)
    const useDyn    = gameMode && !!timerState;
    const isCurrent = mockState.turn === player;
    // Seul le joueur courant voit son move timer décompter ; l'adversaire affiche (15) figé
    const moveLeft  = (useDyn && isCurrent) ? timerState.moveLeft     : 15;
    const gameSec   = useDyn               ? timerState[player].game : 119;
    const active    = useDyn               ? timerState.active       : 'move';

    textAlign(LEFT, TOP);
    noStroke();
    let cx = x;

    // +XXX (largeur fixe basée sur "+999")
    textFont(fontSmall); textSize(szP);
    fill(C.ivory);
    const pipStr = '+' + pip;
    text(pipStr, cx, y);
    cx += textWidth('+999');

    // ⬤ couleur du joueur — centré sur le milieu visuel du texte (top + ascent+descent)/2
    const dotR     = szP * 0.40;
    const padDotL  = szP * 0.10;   // faible espacement entre le nombre et le cercle
    const padDotR  = szP * 0.25;
    const dotCY    = y + (textAscent() + textDescent()) / 2;
    fill(player === 'white' ? C.offwhite : C.ruby);
    ellipse(cx + padDotL + dotR, dotCY, dotR * 2, dotR * 2);
    cx += padDotL + dotR * 2 + padDotR;

    // Opacité des minuteurs :
    //  - hors gameMode (scénarios statiques [1][2][3][4]) ou pendant l'opening
    //    roll → tous translucides (aucun joueur n'est encore "actif")
    //  - en gameMode normal : 255 pour le timer actif du joueur courant, 128
    //    pour tous les autres
    const inOpening = (typeof openingActive !== 'undefined' && openingActive);
    const liveTimer = useDyn && !inOpening && isCurrent;

    // (MM) move timer — largeur fixe basée sur "(99)"
    textFont(fontSmall); textSize(szP);
    const moveStr = '(' + String(moveLeft).padStart(2, '0') + ')';
    const aMove   = liveTimer ? (active === 'move' ? 255 : 128) : 128;
    fill(red(C.ivory), green(C.ivory), blue(C.ivory), aMove);
    text(moveStr, cx, y);
    cx += textWidth('(99)');

    // séparateur fixe
    fill(C.ivory);
    text(' ', cx, y);
    cx += textWidth(' ');

    // (M:SS) game timer — largeur fixe basée sur "(9:99)"
    const mins = Math.floor(gameSec / 60);
    const secs = gameSec % 60;
    const gameStr = '(' + mins + ':' + String(secs).padStart(2, '0') + ')';
    const aGame   = liveTimer ? (active === 'game' ? 255 : 128) : 128;
    fill(red(C.ivory), green(C.ivory), blue(C.ivory), aGame);
    text(gameStr, cx, y);
    cx += textWidth('(9:99)');

    // Cube de doublage et drapeau RESIGN sont maintenant dessinés à côté du
    // (X) (score session) — voir drawSessionGroup() / drawSessionScoreNearDie().
  }

  // Helper : dessine le cube de doublage + drapeau resign à côté d'une
  // position donnée. Retourne la largeur totale dessinée (cube + flag + gaps).
  // Tailles réduites de 36 % au total (0.80 × 0.80) par rapport à SZ_BIG, et
  // descendus de 0.25r par rapport au centre du score pour mieux flotter.
  function drawSessionGroup(player, startX, centerY) {
    if (!(gameMode && !gameWinner)) return 0;
    let cx = startX;
    const cubeR = SZ_BIG * 0.352;       // 0.44 × 0.80 = 0.352
    const isCurrent = mockState.turn === player;
    const cy = centerY + r * 0.25;      // descend un peu sous le score
    cx += r * 0.4;
    drawDoublingCube(cx + cubeR, cy, cubeR, player, isCurrent);
    cx += cubeR * 2;

    const showFlag = aiMode ? (player === LOCAL_PLAYER) : (mockState.turn === player);
    if (showFlag) {
      cx += r * 0.4;
      const flagH = SZ_BIG * 0.736;     // 0.92 × 0.80 = 0.736
      const flagY = cy - flagH / 2;
      textFont('Arial'); textSize(flagH); textAlign(LEFT, TOP);
      const flagW = textWidth('⚐');
      const isHover = mouseX >= cx && mouseX <= cx + flagW
                   && mouseY >= flagY && mouseY <= flagY + flagH;
      const modalOpen = modalState && modalState.type === 'resign'
                     && modalState.player === player;
      const showAsk = isHover || modalOpen;
      fill(C.ivory); noStroke();
      text(showAsk ? '⚑' : '⚐', cx, flagY);
      resignBtn = { x: cx, y: flagY, w: flagW, h: flagH, player };
      cx += flagW;
    }
    return cx - startX;
  }

  // drawThirdLine supprimé : drapeau désormais sur la 2e ligne (drawSecondLine), exit en bas (drawExitButton)

  /* drawExitInline supprimé : EXIT déplacé en bas via drawExitButton.
  function drawExitInline(x, y, sz) {
    const arrow = '\u21AA';
    const rect0 = '\u25AF';   // ▯ vide
    const rect1 = '\u25AE';   // ▮ plein
    // Centre vertical = milieu visuel de la ligne PIP (mesuré en fontSmall)
    textFont(fontSmall); textSize(sz);
    const centerY = y + (textAscent() + textDescent()) / 2;
    textFont('Arial'); textSize(sz);
    noStroke(); fill(C.ivory); textAlign(LEFT, CENTER);
    const arrowW = textWidth(arrow);
    const rectW  = textWidth(rect0);
    const totalW = arrowW + rectW;
    const topY   = centerY - sz / 2;
    const isHover = mouseX >= x && mouseX <= x + totalW
                 && mouseY >= topY && mouseY <= topY + sz;
    text(arrow, x, centerY);
    text(isHover ? rect1 : rect0, x + arrowW, centerY);
    return x + totalW;
  } */

  // Dessine : NAME ⁽elo⁾ [(sessionScore)]
  // En PORTRAIT le score session (X) est déplacé près du dé gauche (sous pour
  // white, au-dessus pour black) et n'est PAS ajouté à la suite du nom ici.
  // En PAYSAGE on le garde inline après le nom comme avant.
  function drawNameLeft(baseName, sessionScore, x, y, player) {
    const szN = szN_for(player);                   // taille du nom (per-tour)
    textAlign(LEFT, TOP);
    fill(C.ivory); noStroke();
    let cx = x;

    // Nom (taille normale) — fallback Noto Sans pour caractères non-PIX (JP/CN/AR…)
    // On bypasse p5 textFont (qui ne gère pas une chaîne CSS multi-fonte)
    // et on dessine directement via ctx.fillText.
    cx += drawNameText(baseName, cx, y, szN, C.ivory, 'top');

    // Tout ce qui suit (symboles, parenthèses, chiffres) doit rester en PIX
    // quelle que soit la langue du nom — la fonte PIX est forcée explicitement.
    textFont(fontLarge);

    // Superscript : score multijoueur cumulé (somme des deltas du tableau profil)
    const mpScore = (typeof getMultiplayerScore === 'function')
      ? getMultiplayerScore(player) : 0;
    const mpSign  = mpScore > 0 ? '+' : '';
    const mpStr   = `(${mpSign}${mpScore})`;
    cx += szN * 0.08;
    textSize(szN * 0.45);
    text(mpStr, cx, y);
    cx += textWidth(mpStr);

    // Score session (X) — inline UNIQUEMENT en paysage. En portrait, voir
    // drawSessionScoreNearDie() ci-dessous.
    // Taille FIXE (SZ_BIG) — ne suit pas la transition per-tour pour rester
    // un repère visuel stable.
    if (diceOnSide) {
      textSize(SZ_BIG);
      text(` (${sessionScore})`, cx, y);
      cx += textWidth(` (${sessionScore})`);
      // Cube + drapeau resign immédiatement à droite du (X)
      const groupCY = y + SZ_BIG * 0.5;
      cx += drawSessionGroup(player, cx, groupCY);
    }

    nameBlockW[player] = cx - x;
    // Zone cliquable sur le bloc nom (ouvre l'overlay profil joueur)
    nameBtns[player] = { x, y, w: cx - x, h: szN, player };
  }

  // En portrait : place le score session (X) à mi-chemin entre le bord du dé
  // GAUCHE et le bord de l'écran correspondant :
  //   - white (en bas) : entre le bas du dé blanc et le bas du canvas
  //   - black (en haut) : entre le haut du dé noir et le haut du canvas
  // Centré horizontalement sur le dé gauche, à la même taille que le nom.
  function drawSessionScoreNearDie(player, sessionScore) {
    if (diceOnSide) return;
    const ds  = dieSize();
    const die = getDiePos(player, 0);
    const dieCX = die.x + ds / 2;
    const txt = `(${sessionScore})`;
    let cy;
    if (player === 'white') {
      const dieBot = die.y + ds;
      cy = (dieBot + windowHeight) / 2;
    } else {
      const dieTop = die.y;
      cy = (dieTop + 0) / 2;
    }
    // (X) reste CENTRÉ sur dieCX (position d'origine, pas décalé par
    // l'ajout du cube/flag). Cube + flag sont juste positionnés à droite.
    fill(C.ivory); noStroke();
    textFont(fontLarge); textSize(SZ_BIG);
    textAlign(CENTER, CENTER);
    text(txt, dieCX, cy);
    // Cube + flag juste à droite du (X) — sans décaler le (X) de sa position.
    const txtW = textWidth(txt);
    drawSessionGroup(player, dieCX + txtW / 2, cy);
    textAlign(LEFT, TOP);
  }

  // Reset des zones cliquables (recalculées plus bas)
  resignBtn = null;
  cubeBtns  = { white: null, black: null };
  exitBtns  = [];
  nameBtns  = { white: null, black: null };

  if (diceOnSide) {
    // ── Paysage : à r/2 à droite de la ligne latérale droite du plateau ──
    // ↪▯ exit déplacé en bas-droite (drawExitButton). Drapeau sur la 2e ligne (drawSecondLine).
    const x = bx + 13*a + r/2;
    // Black (haut) : top à by
    drawNameLeft(baseB, sB, x, by, 'black');
    drawSecondLine(x, by + szN_for('black') + gap, pipB, 'black');
    drawNameAccessories(x, by, szN_for('black'), 'black');

    // White (bas) : alignement inférieur sur le bord bas du plateau conservé
    const yWtop = by + 13*a - blockHFor('white');
    drawNameLeft(baseW, sW, x, yWtop, 'white');
    drawSecondLine(x, yWtop + szN_for('white') + gap, pipW, 'white');
    drawNameAccessories(x, yWtop, szN_for('white'), 'white');

  } else {
    // ── Portrait : à droite des dés (bloc 2 lignes = dieSize) ──
    // Drapeau sur la 2e ligne (drawSecondLine). Exit centré en bas (drawExitButton).
    const ds = dieSize();
    const tx = bx + 2*ds + r;
    const yBlackTop = by - ds - r*1.6;
    const yWhiteTop = by + 13*a + r*1.6;
    drawNameLeft(baseB, sB, tx, yBlackTop, 'black');
    drawSecondLine(tx, yBlackTop + szN_for('black') + gap, pipB, 'black');
    drawNameLeft(baseW, sW, tx, yWhiteTop, 'white');
    drawSecondLine(tx, yWhiteTop + szN_for('white') + gap, pipW, 'white');
    drawNameAccessories(tx, yBlackTop, szN_for('black'), 'black');
    drawNameAccessories(tx, yWhiteTop, szN_for('white'), 'white');
    // Score session (X) déplacé près du dé gauche en portrait :
    // black au-dessus du dé haut, white sous le dé bas.
    drawSessionScoreNearDie('black', sB);
    drawSessionScoreNearDie('white', sW);
  }
}

// ── Cube X 1/2/4 à droite du nom (drapeau RESIGN désormais dans drawSecondLine) ─
function drawNameAccessories(nameX, nameY, szN, player) {
  // Si la partie est terminée par abandon : drapeau figé à côté du nom du perdant
  if (gameMode && gameWinner && gameWinType === 'resign') {
    const loserColor = gameWinner === 1 ? 'black' : 'white';
    if (player === loserColor) {
      const flagX = nameX + (nameBlockW[player] || 0) + r * 0.4;
      textFont('Arial'); textSize(szN * 0.8);
      noStroke(); fill(C.ivory); textAlign(LEFT, TOP);
      text('\u2691', flagX, nameY);
    }
    return;
  }
  if (!gameMode || gameWinner) return;

  // Cube de doublage et drapeau RESIGN actif sont désormais dans drawSecondLine
  // (à gauche du drapeau, sur la ligne du timer) — voir drawSecondLine.
}

// ── Doubling cube (R7) — caractères ❶ ❷ ❹ ────────────────────────────────────
function drawDoublingCube(cx, cy, rad, player, isCurrentTurn) {
  const v  = (typeof cubeValue !== 'undefined') ? cubeValue : 1;
  const ch = v === 1 ? '\u2776' : v === 2 ? '\u2777' : '\u2779';

  // Variante "1 double par joueur" :
  //  - chaque joueur a son propre cube indicateur, JAMAIS clignotant
  //  - les deux affichent la même valeur (1, 2 ou 4)
  //  - opacité 100 % tant que le joueur n'a pas utilisé son double, 50 % sinon
  const used = (typeof cubeUsed !== 'undefined') && cubeUsed[player];
  const aMul = used ? 0.5 : 1.0;

  noStroke();
  fill(red(C.ivory), green(C.ivory), blue(C.ivory), Math.round(255 * aMul));
  textFont('Arial');
  textSize(rad * 2.4);
  textAlign(CENTER, CENTER);
  text(ch, cx, cy);

  cubeBtns[player] = { x: cx, y: cy, r: rad, player };
}

// ── Info scénario ─────────────────────────────────────────────────────────────
function drawInfo() {
  textSize(12);
  textAlign(LEFT, TOP);
  noStroke();
  fill(C.ivory);
  const name = gameMode ? 'GAME' : (Object.keys(SCENARIOS).find(k => SCENARIOS[k] === mockState) || '?');
  text(`[${name}${aiMode ? '+AI' : ''}] tour: ${mockState.turn}  dés: [${mockState.dice}]  fond: ${currentFond}${mirrorMode ? '  [MIRROR]' : ''}  — [1][2][3][4]  [5]=jeu réel  [i]=vs IA  [b]=test barre  [m]=nouvelle partie`, 6, 4);
}

// ── Touch (délègue aux handlers souris, return false bloque scroll/zoom) ─────
function touchStarted() {
  _hasTouched = true;
  _profileOpenedAtTouch = false;
  if (profileOverlay) {
    // Si le doigt commence dans la zone du graphique → mode 'graph' (tooltip,
    // pas de scroll). Sinon → mode 'scroll' du tableau. Le mode est verrouillé
    // pour la durée du touch pour éviter le mélange des deux interactions.
    const inChart = _chartZone
      && mouseX >= _chartZone.x && mouseX <= _chartZone.x + _chartZone.w
      && mouseY >= _chartZone.y - r * 0.5
      && mouseY <= _chartZone.y + _chartZone.h + r * 0.5;
    if (inChart) {
      _touchMode = 'graph';
      _scrollTouchY = null;
    } else {
      _touchMode = 'scroll';
      _scrollTouchY = mouseY;
    }
    return false;
  }
  // Overlay fermé : le tap peut ouvrir l'overlay (clic sur le nom). On le
  // mémorise pour ne pas refermer aussitôt au touchEnded.
  const wasOpen = !!profileOverlay;
  mousePressed();
  if (!wasOpen && profileOverlay) _profileOpenedAtTouch = true;
  return false;
}
function touchMoved() {
  if (profileOverlay) {
    if (_touchMode === 'scroll' && _scrollTouchY !== null) {
      recentGamesScroll = Math.max(0, recentGamesScroll - (mouseY - _scrollTouchY));
      _scrollTouchY = mouseY;
    }
    // En mode 'graph' : mouseX/mouseY suivent le doigt, le tooltip s'affiche
    // automatiquement dans drawScorePolyline.
    return false;
  }
  mouseDragged(); return false;
}
function touchEnded() {
  if (profileOverlay) {
    const wasGraph   = _touchMode === 'graph';
    const movedScroll = _touchMode === 'scroll' && _scrollTouchY !== null
                     && Math.abs(mouseY - _scrollTouchY) > 4;
    const justOpened = _profileOpenedAtTouch;
    _touchMode    = null;
    _scrollTouchY = null;
    _profileOpenedAtTouch = false;
    // Tap sans mouvement notable, hors graphique, et qui n'a pas servi à OUVRIR
    // l'overlay → traité comme un clic (close, signout ou EXIT). Sinon on ne
    // fait rien (sinon on fermerait l'overlay aussitôt après l'avoir ouvert).
    if (!wasGraph && !movedScroll && !justOpened) { mousePressed(); }
    return false;
  }
  mouseReleased(); return false;
}

// Scroll molette / trackpad sur l'overlay profil
function mouseWheel(event) {
  if (profileOverlay) {
    recentGamesScroll = Math.max(0, recentGamesScroll + event.delta);
    return false;   // empêche le scroll de la page
  }
  return true;
}

// ── Raccourcis clavier ────────────────────────────────────────────────────────
function keyPressed() {
  // Pendant la saisie du nickname (ou l'intro), aucune touche ne doit fuir
  // dans les raccourcis dev (sinon taper '5' / 'i' / 't' / 'm' / 'b' dans son
  // nom déclencherait un scénario ou démarrerait une partie).
  if (appState === 'signin' || appState === 'intro') return;
  // Helper : recharge un scénario mock et propage le nickname utilisateur
  function loadScenario(state) {
    gameMode = false;
    mockState = state;
    if (typeof userNick !== 'undefined' && userNick) applyUserNick(userNick);
    clearDice();
  }
  if (key === '1') { loadScenario(SCENARIOS.initial);    }
  if (key === '2') { loadScenario(SCENARIOS.midgame);    }
  if (key === '3') { loadScenario(SCENARIOS.bearingOff); }
  if (key === '4') { loadScenario(SCENARIOS.test1);      }
  if (key === '5') { aiMode = false; startGame(); }              // Hot-seat
  if (key === 'i' || key === 'I') { aiMode = true;  startGame(); } // vs IA (joue black)
  if (key === 'b' || key === 'B') { startBarEntryTest(); }       // Test barre (passe par startGame)
  if (key === 'm' || key === 'M') { newMatch(); }                // Nouvelle partie
  // Test window (touche 't') retiré — séquence absorbée dans le flow principal.
}
