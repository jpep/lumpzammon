// sketch.js – Lumpzammon skin preview  [variante chromatique + fibre optique]
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

// État global de l'app : 'signin' (saisie nickname) | 'game' (table) | 'room' (lobby) | 'waiting'
let appState   = 'game';
let inviteTarget = null;

// Nickname utilisateur (clé localStorage 'bg:nick' partagée avec le repo jpep)
// Pas de vérification d'identité : on prend tel quel ce que l'utilisateur saisit.
// L'unicité (pour rattacher les stats) est supposée respectée par convention pour l'instant.
const NICK_STORAGE_KEY = 'bg:nick';
let userNick = null;            // nickname courant (string ou null si pas encore saisi)
let signinInputEl = null;       // <input> HTML overlay pour la saisie

// Liste mockée de joueurs dans le room (à brancher sur le multijoueur jpep)
const ROOM_PLAYERS = [
  { name: 'ALICE',   online: true,  busy: false },
  { name: 'BOB',     online: true,  busy: true  },
  { name: 'CHARLIE', online: true,  busy: false },
  { name: 'DIANA',   online: true,  busy: false },
  { name: 'EVE',     online: false, busy: false },
];

let fontLarge, fontSmall, fontMed;


// ── Palette globale (accessible depuis dice.js) ───────────────────────────────
let C;
let bgImage;
let dominantHue = 0;   // extrait du fond au setup (mis à jour à chaque nouvelle partie)

// Pool de fonds — l'un est tiré aléatoirement à chaque nouvelle partie (touche [m])
const FOND_LIST = ['fond.jpg', 'fond0.jpg', 'fond1.jpg', 'fond2.jpg',
                   'fond4.jpg', 'fond5.jpg', 'fond6.jpg'];
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
    triA:     color(h, 45,  22, 140),    // triangle foncé    (lum 12→22)
    triB:     color(h, 55,  14, 140),    // triangle très foncé (lum 6→14)
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
const NAMES_W_A = 7;   // largeur réservée à droite (a-units) pour nom + super + score + cube + drapeau + RESIGN?

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

  // Lecture du nickname (clé partagée avec jpep) — sinon on bascule en sign-in
  try { userNick = localStorage.getItem(NICK_STORAGE_KEY); }
  catch (e) { userNick = null; }
  if (!userNick) {
    appState = 'signin';
  } else {
    applyUserNick(userNick);
  }
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

// ── Sign-in : saisie du nickname (clé localStorage 'bg:nick' partagée jpep) ──
// Pas d'authentification réelle ; on prend la chaîne saisie telle quelle.
// Utilise un <input> HTML overlay pour bénéficier du clavier mobile natif.
function drawSignin() {
  // Voile sombre couvrant tout
  noStroke(); fill(0, 0, 0, 220);
  rect(0, 0, windowWidth, windowHeight);

  // Cadre = rectangle du plateau
  noFill(); stroke(C.ivory); strokeWeight(1.5);
  rect(bx, by, 13*a, 13*a);

  // Titre + sous-titre
  noStroke(); fill(C.ivory);
  textAlign(CENTER, CENTER);
  if (fontLarge) textFont(fontLarge);
  textSize(r * 1.4 * MSG_SCALE);
  text('CHOOSE YOUR NICKNAME', windowWidth / 2, by + 13*a * 0.32);

  textFont(fontSmall); textSize(r * 0.7 * MSG_SCALE);
  fill(red(C.ivory), green(C.ivory), blue(C.ivory), 180);
  text('USED TO IDENTIFY YOU AND TRACK YOUR STATS', windowWidth / 2, by + 13*a * 0.32 + r * 1.6);

  // Crée l'input HTML s'il n'existe pas encore (focus auto)
  if (!signinInputEl) createSigninInput();
  positionSigninInput();
}

function createSigninInput() {
  signinInputEl = document.createElement('input');
  signinInputEl.type = 'text';
  signinInputEl.maxLength = 16;
  signinInputEl.autocomplete = 'off';
  signinInputEl.autocapitalize = 'characters';
  signinInputEl.spellcheck = false;
  signinInputEl.placeholder = 'YOUR NICKNAME';
  signinInputEl.style.position    = 'absolute';
  signinInputEl.style.background  = 'transparent';
  signinInputEl.style.color       = '#f3ecdf';
  signinInputEl.style.border      = 'none';
  signinInputEl.style.borderBottom= '2px solid #f3ecdf';
  signinInputEl.style.outline     = 'none';
  signinInputEl.style.textAlign   = 'center';
  signinInputEl.style.textTransform = 'uppercase';
  signinInputEl.style.letterSpacing = '0.05em';
  signinInputEl.style.fontFamily  = 'monospace';
  signinInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitSignin(); }
  });
  document.body.appendChild(signinInputEl);
  setTimeout(() => signinInputEl && signinInputEl.focus(), 50);
}

function positionSigninInput() {
  if (!signinInputEl) return;
  const w = 13*a * 0.55;
  const h = r * 2.0;
  signinInputEl.style.left   = `${(windowWidth - w) / 2}px`;
  signinInputEl.style.top    = `${by + 13*a * 0.50}px`;
  signinInputEl.style.width  = `${w}px`;
  signinInputEl.style.height = `${h}px`;
  signinInputEl.style.fontSize = `${Math.round(r * 1.0 * MSG_SCALE)}px`;

  // Bouton ENTER dessiné en canvas (clic / Enter clavier déclenchent submitSignin)
  noStroke(); fill(C.ivory);
  textAlign(CENTER, CENTER); textFont(fontSmall);
  textSize(r * 0.85 * MSG_SCALE);
  text('[ENTER] OR TAP HERE', windowWidth / 2, by + 13*a * 0.50 + h + r * 1.4);
}

function submitSignin() {
  if (!signinInputEl) return;
  const raw = (signinInputEl.value || '').trim().toUpperCase();
  if (!raw) return;   // vide → ne rien faire
  try { localStorage.setItem(NICK_STORAGE_KEY, raw); } catch (e) {}
  applyUserNick(raw);
  destroySigninInput();
  appState = 'game';
}

function destroySigninInput() {
  if (signinInputEl && signinInputEl.parentNode) {
    signinInputEl.parentNode.removeChild(signinInputEl);
  }
  signinInputEl = null;
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

  // Position : symétrique par rapport à l'axe central du plateau, AU-DESSUS
  // des infos de l'adversaire (c'est lui qu'on challenge avec le double).
  // Distance : 1/3 entre le haut du bloc info adverse et le bord supérieur du canvas.
  const cx = windowWidth / 2;
  let cy;
  const canvasTopSafe = r / 2;
  if (diceOnSide) {
    // Paysage : adversaire à droite, blocs noir et blanc s'opposent verticalement.
    // On place la notice à 1/3 entre le haut du plateau et le bord supérieur du canvas.
    cy = canvasTopSafe + (by - canvasTopSafe) * 2 / 3;
  } else {
    // Portrait : 1/3 au-dessus du haut du bloc info BLACK
    const yBtextTop = by - dieSize() - r*1.6;
    cy = yBtextTop - (yBtextTop - canvasTopSafe) / 3;
  }
  noStroke();
  fill(red(C.ivory), green(C.ivory), blue(C.ivory), Math.round(255 * alpha));
  textAlign(CENTER, CENTER);
  textFont(fontSmall); textSize(r * 0.95 * MSG_SCALE);
  text('YOU WILL BE ABLE TO DOUBLE BEFORE YOU ROLL.', cx, cy);
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
    // Portrait : centré, r/2 du bord bas
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

  // Cadre = rectangle du plateau (comme drawRoom)
  noFill(); stroke(C.ivory); strokeWeight(1.5);
  rect(bx, by, 13*a, 13*a);

  // ── Nom (gros, en haut) ────────────────────────────────────────────────────
  noStroke(); fill(C.ivory);
  if (fontLarge) textFont(fontLarge);
  textAlign(LEFT, TOP);
  const padX  = r * 1.2;          // marge interne gauche
  const padY  = r * 0.8;          // marge interne haute
  const innerX = bx + padX;
  const innerW = 13*a - 2*padX;
  let yCur     = by + padY;

  const baseName = (mockState.players && mockState.players[player])
                || (player === 'white' ? 'WHITE' : 'BLACK');
  const szName  = r * 2.4;
  textSize(szName);
  text(baseName, innerX, yCur);
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

  // Largeurs fixes pour monoespacement du résultat (jusqu'à 2 chiffres / côté)
  const digitsW = textWidth('00');
  const dashStr = ' - ';
  const dashW   = textWidth(dashStr);
  const resTotW = digitsW + dashW + digitsW;
  const resStart = innerX + colDelta + colYou + Math.max(0, (colRes - resTotW) / 2);

  // Zone scrollable des parties : commence à yCur, s'étend jusqu'au bas du cadre
  // (avec marge pour le bouton SIGN OUT en bas).
  const tableTopY = yCur;
  const tableBotY = by + 13*a - r * 2.4;     // réserve sous le tableau pour SIGN OUT
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

  // ── SIGN OUT (uniquement sur son propre profil) ────────────────────────────
  // Bouton visible centré en bas du cadre du plateau. Click → reset localStorage + signin.
  signoutBtn = null;
  if (player === LOCAL_PLAYER) {
    const sz = szLine * 1.10;
    textFont(fontLarge); textSize(sz);
    fill(C.ivory);
    textAlign(CENTER, BOTTOM);
    const label = '[ SIGN OUT ]';
    const w = textWidth(label);
    const h = sz;
    const bx2 = bx + 13*a / 2;                  // centre X du plateau
    const by2 = by + 13*a - r * 0.6;            // près du bas du cadre
    text(label, bx2, by2);
    signoutBtn = { x: bx2 - w/2, y: by2 - h, w, h };
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

  if (modalState.type === 'offer') {
    if (fontLarge) textFont(fontLarge);
    textSize(r * 1.1 * MSG_SCALE);
    text('Offer double?', cx, cy - r * 1.6);

    textSize(r * 1.0 * MSG_SCALE);
    const dx = r * 3;
    const yY = cy + r * 0.8;
    text('YES', cx - dx, yY);
    text('NO',  cx + dx, yY);
    modalBtns = {
      yes: { cx: cx - dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
      no:  { cx: cx + dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
    };

  } else if (modalState.type === 'resign') {
    if (fontLarge) textFont(fontLarge);
    textSize(r * 1.1 * MSG_SCALE);
    text('Resign current game?', cx, cy - r * 1.6);

    textSize(r * 1.0 * MSG_SCALE);
    const dx = r * 3;
    const yY = cy + r * 0.8;
    text('YES', cx - dx, yY);
    text('NO',  cx + dx, yY);
    modalBtns = {
      yes: { cx: cx - dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
      no:  { cx: cx + dx, cy: yY, hw: r * 1.4 * MSG_SCALE, hh: r * 1.0 * MSG_SCALE },
    };

  } else if (modalState.type === 'quit') {
    if (fontLarge) textFont(fontLarge);
    textSize(r * 1.1 * MSG_SCALE);
    text('Quit current game?', cx, cy - r * 1.6);

    textSize(r * 1.0 * MSG_SCALE);
    const dx = r * 3;
    const yY = cy + r * 0.8;
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
function updateDragDisplay() {
  const tx = drag.snapPt !== null ? ptCenterX(drag.snapPt) : drag.mouseX;
  const ty = drag.snapPt !== null ? ptNextY(drag.snapPt)   : drag.mouseY;
  drag.dispX = lerp(drag.dispX, tx, 0.13);   // 0.09 → 0.13 : légèrement plus fort
  drag.dispY = lerp(drag.dispY, ty, 0.13);
}

// ── Plateau ───────────────────────────────────────────────────────────────────
function drawBoard() {
  // Fond tablier (sans contour)
  noStroke();
  fill(C.board);
  rect(bx, by, 13*a, 13*a);
  // Contour entièrement à l'extérieur (offset = strokeWeight) pour ne pas chevaucher les fiches
  noFill();
  stroke(C.ivory);
  strokeWeight(1.5);
  rect(bx - 0.75, by - 0.75, 13*a + 1.5, 13*a + 1.5);

  const targets = drag.active ? getValidTargets(drag.fromPt) : [];

  for (let i = 0; i < 6; i++) {
    const dark = (i % 2 === 0);
    drawTri(bx + (12-i)*a, by + 13*a, true,  dark, targets.includes(1+i),  drag.snapPt === 1+i);
    drawTri(bx + (5-i)*a,  by + 13*a, true,  !dark, targets.includes(7+i),  drag.snapPt === 7+i);
    drawTri(bx + i*a,      by,         false, dark, targets.includes(13+i), drag.snapPt === 13+i);
    drawTri(bx + (7+i)*a,  by,         false, !dark, targets.includes(19+i), drag.snapPt === 19+i);
  }

  // Barre
  fill(C.bar);
  stroke(C.ivory);
  strokeWeight(1.5);
  rect(bx + 6*a, by, a, 13*a);
}

// ── Triangle + fibre optique ──────────────────────────────────────────────────
function drawTri(x, baseY, pointUp, isDark, isTarget, isSnapped) {
  fill(isDark ? C.triA : C.triB);
  stroke(C.ivory);
  strokeWeight(1);

  const h  = 6*a;
  const cx = x + a/2;
  let p1, p2, tip;

  if (pointUp) {
    p1  = createVector(x,    baseY);
    p2  = createVector(x+a,  baseY);
    tip = createVector(cx,   baseY - h);
  } else {
    p1  = createVector(x,    baseY);
    p2  = createVector(x+a,  baseY);
    tip = createVector(cx,   baseY + h);
  }

  triangle(p1.x, p1.y, p2.x, p2.y, tip.x, tip.y);

  // ── Halo glissant le long des arêtes, clipé à chaque segment ──
  if (isTarget || isSnapped) {
    const speed   = 200;                      // px/s — constant
    const segHalf = 2 * r;                   // demi-longueur halo = 2r (total 4r)
    const sw      = 3.0;

    const segs    = [[tip, p2], [p2, p1], [p1, tip]];
    const lengths = segs.map(([u, v]) => p5.Vector.dist(u, v));
    const total   = lengths.reduce((s, l) => s + l, 0);

    function drawGlowPoint(tPos) {
      let rem = tPos, si = 0;
      for (; si < segs.length - 1; si++) {
        if (rem <= lengths[si]) break;
        rem -= lengths[si];
      }
      const [u, v] = segs[si];
      const len = lengths[si];
      const g0  = Math.max(0, rem - segHalf);
      const g1  = Math.min(len, rem + segHalf);
      if (g1 <= g0) return;

      const ptA = p5.Vector.lerp(u, v, g0 / len);
      const ptB = p5.Vector.lerp(u, v, g1 / len);
      const ct  = (rem - g0) / (g1 - g0);   // centre dans [0,1]
      const al  = 0.85;

      const grad = drawingContext.createLinearGradient(ptA.x, ptA.y, ptB.x, ptB.y);
      grad.addColorStop(0,  'rgba(245,240,218,0)');
      grad.addColorStop(ct, `rgba(245,240,218,${al})`);
      grad.addColorStop(1,  'rgba(245,240,218,0)');

      drawingContext.save();
      drawingContext.strokeStyle = grad;
      drawingContext.lineWidth   = sw;
      drawingContext.lineCap     = 'round';
      drawingContext.beginPath();
      drawingContext.moveTo(ptA.x, ptA.y);
      drawingContext.lineTo(ptB.x, ptB.y);
      drawingContext.stroke();
      drawingContext.restore();
    }

    const t0 = (millis() / 1000 * speed) % total;
    const t1 = (t0 + total / 2) % total;   // second halo, côté opposé
    drawGlowPoint(t0);
    drawGlowPoint(t1);
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
    if (isTop && overflow > 0) {
      // Pièce du sommet portant le label "+N" : pas de symbole nortechico
      // (drawCheckerLabel ne le dessine pas). Les pièces du dessous gardent
      // leur symbole normalement.
      drawCheckerLabel(cx, cy, isWhite, `+${overflow}`);
    } else {
      drawChecker(cx, cy, isWhite, isTop && (isTarget || isSnapped), false, bgCol);
    }
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

function startFlyingChecker(fromPt, toPt, isWhite, onDone, hit, diceValue, intermediatePts) {
  const a0 = pieceXY(fromPt, isWhite);
  const a1 = pieceXY(toPt,   isWhite);
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
  // Animation : fade out (départ) + fade in (arrivée), courbe smoothstep pour subtilité
  const t   = elapsed / fc.dur;
  const ts  = t * t * (3 - 2 * t);
  const col = fc.isWhite ? C.offwhite : C.ruby;
  const cR  = red(col), cG = green(col), cB = blue(col);
  noStroke();
  fill(cR, cG, cB, Math.round(255 * (1 - ts)));
  ellipse(fc.fromX, fc.fromY, 2*r, 2*r);
  fill(cR, cG, cB, Math.round(255 * ts));
  ellipse(fc.toX, fc.toY, 2*r, 2*r);
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
  // ── Sign-in : tap n'importe où soumet (l'input garde le focus pour le clavier mobile) ──
  if (appState === 'signin') {
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
      // Off zone : à droite du plateau (en board-coord, donc eMx)
      if (diceOnSide) {
        if (eMx > bx + 13*a) { drag.snapPt = 0; break; }
      } else {
        // Portrait : pile en dessous du texte joueur (white) ou au-dessus (black)
        if (mockState.turn === 'white' && mouseY > by + 13*a + r * 4) { drag.snapPt = 0; break; }
        if (mockState.turn === 'black' && mouseY < by - r * 4)         { drag.snapPt = 0; break; }
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
  const exitH    = r * 1.4;
  const exitTopY = windowHeight - r/2 - exitH;
  const yWtextBot = by + 13*a + r*1.6 + ds;
  const yBtextTop = by - ds - r*1.6;
  const canvasTopSafe = r / 2;
  // 1/3 de la distance — proche du texte, loin du bord
  const yW = yWtextBot + (exitTopY - yWtextBot) / 3;
  const yB = yBtextTop - (yBtextTop - canvasTopSafe) / 3 - h;
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

  const pipW  = computePip('white');
  const pipB  = computePip('black');
  const sW    = (typeof gameScore !== 'undefined') ? gameScore.white : 0;
  const sB    = (typeof gameScore !== 'undefined') ? gameScore.black : 0;
  const baseW = (mockState.players && mockState.players.white) || 'USER 2';
  const baseB = (mockState.players && mockState.players.black) || 'USER 1';
  // Bloc nom + pip line ≈ 3.5r — top aligné sur bord sup du dé,
  // bottom aligné sur bord inf du dé (dieSize = 3.5r).
  // Le superscript ⁽elo⁾ peut déborder un peu au-dessus, c'est accepté.
  const szN = r * 2.00;
  const szP = r * 1.20;
  const gap = r * 0.30;

  // En paysage : ↪▯ ajouté sous le PIP
  // szExit / exitGap supprimés : le bouton EXIT est maintenant en bas (drawExitButton)
  function blockH() { return szN + gap + szP; }

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

    // Cube de doublage + drapeau RESIGN inline après le timer (même ligne).
    // Ordre : timer  [cube]  [drapeau]
    // Le cube précède le drapeau (toujours visible, même avec un nom long en mobile).
    if (gameMode && !gameWinner) {
      // Centre vertical commun (milieu visuel de la ligne PIP) + nudge pour
      // recentrer cube/drapeau sur le baseline visuel du texte pixel-font.
      textFont(fontSmall); textSize(szP);
      const lineCY = y + (textAscent() + textDescent()) / 2 + szP * 0.12;

      // ── Cube doublage ──
      const cubeR  = szP * 0.55;
      cx += r * 0.4;                  // espacement timer→cube (inchangé)
      const cubeCX = cx + cubeR;
      const cubeCY = lineCY;
      drawDoublingCube(cubeCX, cubeCY, cubeR, player, isCurrent);
      cx += cubeR * 2 + r * 0.4;      // espacement cube→drapeau doublé (0.2 → 0.4)

      // ── Drapeau RESIGN ──
      // En IA : seulement côté LOCAL_PLAYER (peut abandonner à tout moment)
      // En hot-seat : seulement côté joueur courant
      const showFlag = aiMode ? (player === LOCAL_PLAYER) : (mockState.turn === player);
      if (showFlag) {
        const flagH = szP * 1.15;
        const flagY = lineCY - flagH / 2;
        textFont('Arial'); textSize(flagH); textAlign(LEFT, TOP);
        const flagW  = textWidth('⚐');
        const isHover = mouseX >= cx && mouseX <= cx + flagW
                     && mouseY >= flagY && mouseY <= flagY + flagH;
        // Drapeau plein pendant le modal RESIGN (sinon : hover-only)
        const modalOpen = modalState && modalState.type === 'resign'
                       && modalState.player === player;
        const showAsk   = isHover || modalOpen;
        fill(C.ivory); noStroke();
        text(showAsk ? '⚑' : '⚐', cx, flagY);
        resignBtn = { x: cx, y: flagY, w: flagW, h: flagH, player };
      }
    }
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
    textAlign(LEFT, TOP);
    fill(C.ivory); noStroke();
    let cx = x;

    // Nom (taille normale)
    textFont(fontLarge); textSize(szN);
    text(baseName, cx, y);
    cx += textWidth(baseName);

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
    if (diceOnSide) {
      textSize(szN);
      text(` (${sessionScore})`, cx, y);
      cx += textWidth(` (${sessionScore})`);
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
    const die = getDiePos(player, 0);   // dé idx 0 = dé gauche
    const dieCX = die.x + ds / 2;
    const txt = `(${sessionScore})`;
    textFont(fontLarge); textSize(szN);
    fill(C.ivory); noStroke();
    textAlign(CENTER, CENTER);
    let cy;
    if (player === 'white') {
      const dieBot   = die.y + ds;
      const screenBot = windowHeight;
      cy = (dieBot + screenBot) / 2;
    } else {
      const dieTop   = die.y;
      const screenTop = 0;
      cy = (dieTop + screenTop) / 2;
    }
    text(txt, dieCX, cy);
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
    drawSecondLine(x, by + szN + gap, pipB, 'black');
    drawNameAccessories(x, by, szN, 'black');

    // White (bas) : alignement inférieur sur le bord bas du plateau conservé
    const yWtop = by + 13*a - blockH();
    drawNameLeft(baseW, sW, x, yWtop, 'white');
    drawSecondLine(x, yWtop + szN + gap, pipW, 'white');
    drawNameAccessories(x, yWtop, szN, 'white');

  } else {
    // ── Portrait : à droite des dés (bloc 2 lignes = dieSize) ──
    // Drapeau sur la 2e ligne (drawSecondLine). Exit centré en bas (drawExitButton).
    const ds = dieSize();
    const tx = bx + 2*ds + r;
    const yBlackTop = by - ds - r*1.6;
    const yWhiteTop = by + 13*a + r*1.6;
    drawNameLeft(baseB, sB, tx, yBlackTop, 'black');
    drawSecondLine(tx, yBlackTop + szN + gap, pipB, 'black');
    drawNameLeft(baseW, sW, tx, yWhiteTop, 'white');
    drawSecondLine(tx, yWhiteTop + szN + gap, pipW, 'white');
    drawNameAccessories(tx, yBlackTop, szN, 'black');
    drawNameAccessories(tx, yWhiteTop, szN, 'white');
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
}
