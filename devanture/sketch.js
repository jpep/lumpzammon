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
let nameBlockW = { white: 0, black: 0 };

// Animation d'un mouvement (trajectoire parabolique) — visualisation pour IA / adversaire
let flyingChecker = null;   // { from, to, isWhite, fromX, fromY, toX, toY, t0, dur, onDone }

// Joueur local (l'utilisateur sur cet écran) — par défaut blanc pour les tests
const LOCAL_PLAYER = 'white';

// État global de l'app : 'game' (table de jeu) | 'room' (lobby) | 'waiting' (attente invitation)
let appState   = 'game';
let inviteTarget = null;

// Liste mockée de joueurs dans le room (à brancher sur le multijoueur jpep)
const ROOM_PLAYERS = [
  { name: 'ALICE',   online: true,  busy: false },
  { name: 'BOB',     online: true,  busy: true  },
  { name: 'CHARLIE', online: true,  busy: false },
  { name: 'DIANA',   online: true,  busy: false },
  { name: 'EVE',     online: false, busy: false },
];

let fontLarge, fontSmall;


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
const NAMES_W_A = 8;   // largeur réservée à droite (a-units) pour nom + super + score + cube + drapeau + RESIGN?

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
    // Dés au-dessus (noir) et en-dessous (blanc)
    // Numéros à r*0.8 du bord ; dés à r*0.8 des numéros → r*1.6 du bord
    // Espace vertical : (r*1.6 + ds) × 2 + 13a = 9.2r + 26r = 35.2r
    const maxH = (windowHeight - 2 * MARGIN) * 26 / 35.2;
    const maxW = windowWidth  - 2 * MARGIN;
    const side = min(maxW, maxH);
    a  = side / 13;
    r  = a / 2;
    bx = (windowWidth  - 13*a) / 2;
    by = (windowHeight - 13*a) / 2;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(30);
  computeGeometry();
  dominantHue = extractDominantHue(bgImage);
  buildPalette();
  document.body.style.backgroundImage = `url('${currentFond}')`;
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
  drawExitButton();
  drawModal();
  if (gameMode && gameWinner) drawGameOver();
  if (appState === 'room')    drawRoom();
  if (appState === 'waiting') drawWaiting();
}

// ↪▯ exit est dessiné inline dans drawSecondLine (portrait) ou
// drawExitUnderPip (paysage). Plus rien à faire ici.
function drawExitButton() { /* no-op */ }

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
  textSize(r * 1.6);
  text('ROOM', bx + 13*a/2, by + r * 0.8);

  // Sous-titre
  textFont(fontSmall); textSize(r * 0.7);
  text('CLICK A PLAYER TO INVITE', bx + 13*a/2, by + r * 3.2);

  // Liste joueurs (centrée verticalement dans le cadre)
  roomBtns = [];
  textAlign(LEFT, CENTER); textFont(fontLarge); textSize(r * 1.0);
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
    textAlign(RIGHT, CENTER); textFont(fontSmall); textSize(r * 0.6);
    text(tag, colX + colW, ly);
    textAlign(LEFT, CENTER); textFont(fontLarge); textSize(r * 1.0);

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
  textSize(r * 1.1);
  text(`Waiting for ${inviteTarget ? inviteTarget.name : '...'}`, cx, cy - r * 1.4);

  textSize(r * 0.7);
  text('CANCEL', cx, cy + r * 0.8);
  modalBtns = { cancel: { cx, cy: cy + r * 0.8, hw: r * 1.6, hh: r * 0.9 } };
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
    textSize(r * 1.1);
    text('Offer double?', cx, cy - r * 1.6);

    textSize(r * 1.0);
    const dx = r * 3;
    const yY = cy + r * 0.8;
    text('YES', cx - dx, yY);
    text('NO',  cx + dx, yY);
    modalBtns = {
      yes: { cx: cx - dx, cy: yY, hw: r * 1.4, hh: r * 1.0 },
      no:  { cx: cx + dx, cy: yY, hw: r * 1.4, hh: r * 1.0 },
    };

  } else if (modalState.type === 'quit') {
    if (fontLarge) textFont(fontLarge);
    textSize(r * 1.1);
    text('Quit current game?', cx, cy - r * 1.6);

    textSize(r * 1.0);
    const dx = r * 3;
    const yY = cy + r * 0.8;
    text('YES', cx - dx, yY);
    text('NO',  cx + dx, yY);
    modalBtns = {
      yes: { cx: cx - dx, cy: yY, hw: r * 1.4, hh: r * 1.0 },
      no:  { cx: cx + dx, cy: yY, hw: r * 1.4, hh: r * 1.0 },
    };

  } else if (modalState.type === 'accept') {
    // En mode IA, l'IA décide seule → ne pas afficher le modal côté user
    if (aiMode && modalState.player === 'black') return;
    if (fontLarge) textFont(fontLarge);
    textSize(r * 0.9);
    text('Your opponent offers you a double', cx, cy - r * 2.2);

    textFont('Arial');
    textSize(r * 2.7);
    const dx = r * 3;
    const yY = cy + r * 0.8;
    const acceptBtn  = { cx: cx - dx, cy: yY, hw: r * 1.8, hh: r * 1.8 };
    const declineBtn = { cx: cx + dx, cy: yY, hw: r * 1.8, hh: r * 1.8 };
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
  textSize(r * 2.0); text('GAME OVER', cx, cy - r * 2.5);
  textSize(r * 1.4); text(`${winnerName} WINS`, cx, cy - r * 0.5);
  textSize(r * 1.0); text(`${label}  +${pts}`, cx, cy + r * 1.0);
  textSize(r * 0.7); text('[5] nouvelle partie', cx, cy + r * 2.5);
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
    if (!diceOnSide) {
      // Portrait : aligné sur la prochaine fiche dans la pile bearing off (drawOffPortrait)
      const w   = r * 0.4;
      const gap = (r / 2) * 4/5;
      const step = w + gap;
      const x0  = bx + 13*a;   // bord droit de la 1ʳᵉ fiche au bord du plateau
      const idx = mockState.turn === 'white' ? mockState.off.white : mockState.off.black;
      return x0 - w - idx * step + w / 2;
    }
    // Paysage : centre x du prochain slot
    const idx = mockState.turn === 'white' ? mockState.off.white : mockState.off.black;
    return bx + 13*a + r + floor(idx/8)*(2*r + r/2) + r;
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
    const h = r * 0.4;
    if (!diceOnSide) {
      // Portrait : centre = mi-hauteur de la fiche (h = 2r)
      return mockState.turn === 'white'
        ? by + 13*a + r*1.6 + r
        : by - r*1.6 - r;
    }
    // Paysage : depuis l'axe central, blancs vers le bas, noirs vers le haut
    const step = h + h;   // 0.8r (gap = hauteur d'une fiche)
    const cy   = by + 6.5*a;
    const idx  = mockState.turn === 'white' ? mockState.off.white : mockState.off.black;
    const pos  = idx % 8;
    if (mockState.turn === 'white') {
      return cy + r + pos*step + h/2;
    } else {
      return cy - r - pos*step - h/2;
    }
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
    drawChecker(barCX, by + 6.5*a - r - i*a, true, false);
  }
  for (let i = 0; i < mockState.bar.black; i++) {
    if (skipBlackBar && i === barIdx) continue;
    drawChecker(barCX, by + 6.5*a + r + i*a, false, false);
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

  for (let i = 0; i < visible; i++) {
    const cy = isBot ? by + 13*a - r - i*a : by + r + i*a;
    const isTop = (i === visible - 1);
    if (isTop && overflow > 0) {
      drawCheckerLabel(cx, cy, isWhite, `+${overflow}`);
    } else {
      drawChecker(cx, cy, isWhite, isTop && (isTarget || isSnapped));
    }
  }
}

function drawChecker(cx, cy, isWhite, fiberOptic) {
  fill(isWhite ? C.offwhite : C.ruby); noStroke();
  ellipse(cx, cy, 2*r, 2*r);
}

function drawCheckerLabel(cx, cy, isWhite, label) {
  fill(isWhite ? C.offwhite : C.ruby); noStroke();
  ellipse(cx, cy, 2*r, 2*r);
  noStroke();
  fill(isWhite ? C.numColor : C.ivory);
  textAlign(CENTER, CENTER);
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
    if (diceOnSide) {
      const cy = by + 6.5*a;
      return isWhite
        ? { x: bx + 13*a + 2*r, y: cy + r + 2 }
        : { x: bx + 13*a + 2*r, y: cy - r - 2 };
    }
    return { x: bx + 13*a - r, y: isWhite ? by + 13*a + r*1.6 + r : by - r*1.6 - r };
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
  fill(isWhite ? C.offwhite : C.ruby);
  for (let i = 0; i < N; i++) {
    ellipse(drag.dispX, drag.dispY + dy * i * a, 2*r, 2*r);
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
  // ── Room (lobby) : click sur joueur disponible → invitation + accept auto (mock) ──
  if (appState === 'room') {
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
    return;
  }

  // Bouton EXIT (↪▯) : zones cliquables précises (pas de zone englobante)
  for (const eb of exitBtns) {
    if (mouseX >= eb.x && mouseX <= eb.x + eb.w
        && mouseY >= eb.y && mouseY <= eb.y + eb.h) {
      if (gameWinner) { appState = 'room'; }
      else            { modalState = { type: 'quit' }; }
      return;
    }
  }

  if (gameMode && gameWinner) return;

  // R6 : drapeau RESIGN
  if (resignBtn
      && mouseX >= resignBtn.x && mouseX <= resignBtn.x + resignBtn.w
      && mouseY >= resignBtn.y && mouseY <= resignBtn.y + resignBtn.h) {
    resign(resignBtn.player);
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
      if (diceOnSide) {
        if (eMx > bx + 13*a) { drag.snapPt = 0; break; }
      } else {
        if (mockState.turn === 'white' && mouseY > by + 13*a - r) { drag.snapPt = 0; break; }
        if (mockState.turn === 'black' && mouseY < by + r)         { drag.snapPt = 0; break; }
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

// ── Zone bearing off ──────────────────────────────────────────────────────────
function drawOff() {
  const canBearOff = drag.active && getValidTargets(drag.fromPt).includes(0);
  if (diceOnSide) drawOffLandscape(canBearOff);
  else            drawOffPortrait(canBearOff);
}

function drawOffLandscape(canBearOff) {
  const ox   = bx + 13*a + r;   // gap r entre plateau et 1ʳᵉ fiche
  const w    = 2*r;
  const h    = r * 0.4;
  const gap  = h;                // espace entre fiches = h (r*0.4)
  const step = h + gap;          // 0.8r par fiche
  const colW = w + r/2;          // largeur colonne + écart = 2.5r
  const cy   = by + 6.5*a;       // axe central du plateau

  // i-ème fiche : colonne = floor(i/8), position dans col = i%8
  function px(i) { return ox + floor(i/8)*colW; }
  function yW(i) { return cy + r + (i%8)*step; }           // blancs vers le bas
  function yB(i) { return cy - r - (i%8)*step - h; }       // noirs vers le haut

  for (let i = 0; i < mockState.off.white; i++) {
    fill(C.offwhite); noStroke();
    rect(px(i), yW(i), w, h);
  }
  for (let i = 0; i < mockState.off.black; i++) {
    fill(C.ruby); noStroke();
    rect(px(i), yB(i), w, h);
  }
  if (canBearOff) {
    const isW  = mockState.turn === 'white';
    const idx  = isW ? mockState.off.white : mockState.off.black;
    const base = isW ? C.offwhite : C.ruby;
    noStroke(); fill(red(base), green(base), blue(base), 153);
    rect(px(idx), isW ? yW(idx) : yB(idx), w, h);
  }
}

function drawOffPortrait(canBearOff) {
  // Fiches pivotées 90° : 0.4r de large × 2r de haut
  // Empilées droite → gauche, bord droit de la 1ʳᵉ fiche au bord du plateau
  const w    = r * 0.4;
  const h    = 2 * r;
  const gap  = (r / 2) * 4/5;
  const step = w + gap;
  const x0   = bx + 13*a;
  const MAX_OFF_VIS = 8;       // au-delà, afficher "+N" pour éviter chevauchement texte

  function rx(i) { return x0 - w - i * step; }

  const yW   = by + 13*a + r*1.6;
  const yB   = by - r*1.6 - h;
  const szN  = r * 1.4;        // même taille de référence que drawPlayerInfo

  function drawOffStack(off, y, fillColor, isWhiteSide) {
    const visible = Math.min(off, MAX_OFF_VIS);
    fill(fillColor); noStroke();
    for (let i = 0; i < visible; i++) rect(rx(i), y, w, h);
    if (off > MAX_OFF_VIS) {
      const overflow = off - MAX_OFF_VIS;
      // Centre horizontal de la pile visible
      const stackCx = (rx(0) + rx(MAX_OFF_VIS - 1)) / 2 + w / 2;
      // Label sous la pile (white, en bas) ou au-dessus (black, en haut)
      // → évite le chevauchement avec le drapeau RESIGN qui est sur la ligne du nom
      const labelY = isWhiteSide ? y + h + r * 0.3 : y - r * 0.3;
      const vAlign = isWhiteSide ? TOP : BOTTOM;
      textAlign(CENTER, vAlign); noStroke();
      textFont(fontLarge); textSize(szN * 0.7);
      fill(C.ivory);
      text('+' + overflow, stackCx, labelY);
    }
  }

  drawOffStack(mockState.off.white, yW, C.offwhite, true);
  drawOffStack(mockState.off.black, yB, C.ruby,     false);

  // Fantôme : seulement si la prochaine fiche reste dans la zone visible
  if (canBearOff) {
    const isW  = mockState.turn === 'white';
    const idx  = isW ? mockState.off.white : mockState.off.black;
    if (idx < MAX_OFF_VIS) {
      const base = isW ? C.offwhite : C.ruby;
      noStroke(); fill(red(base), green(base), blue(base), 153);
      rect(rx(idx), isW ? yW : yB, w, h);
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
  const szN = r * 1.4;
  const szP = r * 0.85;
  const gap = r * 0.2;

  // En paysage : ↪▯ ajouté sous le PIP → bloc plus grand
  const szExit  = r * 1.0;
  const exitGap = r * 0.5;   // espacement supplémentaire avant ↪▯
  function blockH() { return szN + gap + szP + (diceOnSide ? exitGap + szExit : 0); }

  // Dessine ↪▯ sous le PIP (paysage uniquement, joueur local seulement) + hover
  function drawExitUnderPip(x, y) {
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
    text(isHover ? rect1 : rect0, x + arrowW, y);
    if (isHover) {
      textFont(fontSmall); textSize(szExit * 0.7);
      text('  EXIT?', x + totalW, y);
    }
    exitBtns.push({ x, y, w: totalW, h: szExit });
  }

  // Dessine la 2e ligne : +XXX⬤ (15) (1:59) [/ NOTICE]
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

    // (MM) move timer — largeur fixe basée sur "(99)"
    textFont(fontSmall); textSize(szP);
    const moveStr = '(' + String(moveLeft).padStart(2, '0') + ')';
    const aMove   = (!isCurrent || active === 'move') ? 255 : 128;
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
    const aGame   = (!isCurrent || active === 'game') ? 255 : 128;
    fill(red(C.ivory), green(C.ivory), blue(C.ivory), aGame);
    text(gameStr, cx, y);
    cx += textWidth('(9:99)');

    // ↪▯ exit — en portrait, à la suite du game timer (joueur local seulement)
    if (!diceOnSide && gameMode && LOCAL_PLAYER === player) {
      cx += r * 0.4;
      cx = drawExitInline(cx, y, szP);
    }

    // / NOTICE (visible uniquement côté joueur ayant promis le double)
    if (gameMode && cubePromised === player) {
      fill(C.ivory);
      textFont(fontSmall); textSize(szP);
      text(' / DOUBLE BEFORE YOU ROLL', cx, y);
    }
  }

  // Dessine ↪▯ inline + hover (▯→▮ + " EXIT?"). Retourne le nouveau cx.
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
    let cx = x + totalW;
    // Réserve toujours la largeur du label EXIT? pour que le texte suivant ne saute pas
    textFont(fontSmall); textSize(sz);
    if (isHover) text('  EXIT?', cx, centerY);
    cx += textWidth('  EXIT?');
    exitBtns.push({ x, y: topY, w: totalW, h: sz });
    return cx;
  }

  // Dessine : NAME ⁽elo⁾ (sessionScore) — superscript entre le nom et le score session
  function drawNameLeft(baseName, sessionScore, x, y, player) {
    textAlign(LEFT, TOP);
    fill(C.ivory); noStroke();
    let cx = x;

    // Nom (taille normale)
    textFont(fontLarge); textSize(szN);
    text(baseName, cx, y);
    cx += textWidth(baseName);

    // Superscript : score multijoueur
    const mpScore = (typeof getMultiplayerScore === 'function')
      ? getMultiplayerScore(player) : 0;
    cx += szN * 0.08;
    textSize(szN * 0.45);
    text(`(${mpScore})`, cx, y);
    cx += textWidth(`(${mpScore})`);

    // Score session (taille normale)
    textSize(szN);
    text(` (${sessionScore})`, cx, y);
    cx += textWidth(` (${sessionScore})`);

    nameBlockW[player] = cx - x;
  }

  // Reset des zones cliquables (recalculées plus bas)
  resignBtn = null;
  cubeBtns  = { white: null, black: null };
  exitBtns  = [];

  if (diceOnSide) {
    // ── Paysage : à r/2 à droite de la ligne latérale droite du plateau ──
    // ↪▯ ajouté sous le PIP du joueur local pour éviter la superposition avec RESIGN
    const x = bx + 13*a + r/2;
    // Black (haut) : top à by
    drawNameLeft(baseB, sB, x, by, 'black');
    drawSecondLine(x, by + szN + gap, pipB, 'black');
    if (LOCAL_PLAYER === 'black')
      drawExitUnderPip(x, by + szN + gap + szP + exitGap);
    drawNameAccessories(x, by, szN, 'black');

    // White (bas) : alignement inférieur sur le bord bas du plateau conservé
    const yWtop = by + 13*a - blockH();
    drawNameLeft(baseW, sW, x, yWtop, 'white');
    drawSecondLine(x, yWtop + szN + gap, pipW, 'white');
    if (LOCAL_PLAYER === 'white')
      drawExitUnderPip(x, yWtop + szN + gap + szP + exitGap);
    drawNameAccessories(x, yWtop, szN, 'white');

  } else {
    // ── Portrait : à droite des dés ──
    const ds = dieSize();
    const tx = bx + 2*ds + r;
    drawNameLeft(baseB, sB, tx, by - ds - r*1.6, 'black');
    drawSecondLine(tx, by - ds - r*1.6 + szN + gap, pipB, 'black');
    drawNameLeft(baseW, sW, tx, by + 13*a + r*1.6, 'white');
    drawSecondLine(tx, by + 13*a + r*1.6 + szN + gap, pipW, 'white');
    drawNameAccessories(tx, by - ds - r*1.6,   szN, 'black');
    drawNameAccessories(tx, by + 13*a + r*1.6, szN, 'white');
  }
}

// ── Drapeau RESIGN + cube X 1/2/4 à droite du nom ────────────────────────────
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

  const totalNameW = nameBlockW[player] || 0;
  const isCurrentTurn = mockState.turn === player;

  // ── Cube X 1/2/4 ──
  const cubeR = r * 0.5;
  const cubeX = nameX + totalNameW + r * 0.4 + cubeR;
  const cubeY = nameY + szN * 0.5;
  drawDoublingCube(cubeX, cubeY, cubeR, player, isCurrentTurn);

  // ── Drapeau RESIGN ──
  // En mode IA : toujours visible côté LOCAL_PLAYER (peut abandonner à tout moment)
  // En hot-seat : visible côté joueur courant uniquement
  const showResign = aiMode ? (player === LOCAL_PLAYER) : isCurrentTurn;
  if (showResign) {
    const flagX = cubeX + cubeR + r * 0.4;
    const flagY = nameY;
    const flagH = szN * 0.8;
    textFont('Arial'); textSize(flagH);
    const flagW = textWidth('⚐');
    const isHover = mouseX >= flagX && mouseX <= flagX + flagW
                 && mouseY >= flagY && mouseY <= flagY + flagH;
    resignBtn = { x: flagX, y: flagY, w: flagW, h: flagH, player };

    fill(C.ivory); noStroke(); textAlign(LEFT, TOP);
    text(isHover ? '⚑' : '⚐', flagX, flagY);
    if (isHover) {
      textFont(fontSmall); textSize(szN * 0.55);
      text('  RESIGN?', flagX + flagW, flagY);
    }
  }
}

// ── Doubling cube (R7) — caractères ❶ ❷ ❹ ────────────────────────────────────
function drawDoublingCube(cx, cy, rad, player, isCurrentTurn) {
  const v  = (typeof cubeValue !== 'undefined') ? cubeValue : 1;
  const ch = v === 1 ? '\u2776' : v === 2 ? '\u2777' : '\u2779';

  // alpha de base 25% ; pendant son tour : pulsation 25% → 100% → 25%
  let aMul = 0.25;
  if (isCurrentTurn && cubePromised !== player && !modalState) {
    const t = (millis() / 1000) % 2;
    if      (t < 0.7) aMul = 0.25 + (t / 0.7) * 0.75;
    else if (t < 1.4) aMul = 1.0;
    else              aMul = 1.0 - ((t - 1.4) / 0.6) * 0.75;
  }
  const isHover = isCurrentTurn && cubePromised !== player && !modalState
               && dist(mouseX, mouseY, cx, cy) <= rad;
  if (isHover) aMul = 1;

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
function touchStarted() { mousePressed();  return false; }
function touchMoved()   { mouseDragged();  return false; }
function touchEnded()   { mouseReleased(); return false; }

// ── Raccourcis clavier ────────────────────────────────────────────────────────
function keyPressed() {
  if (key === '1') { gameMode = false; mockState = SCENARIOS.initial;    clearDice(); }
  if (key === '2') { gameMode = false; mockState = SCENARIOS.midgame;    clearDice(); }
  if (key === '3') { gameMode = false; mockState = SCENARIOS.bearingOff; clearDice(); }
  if (key === '4') { gameMode = false; mockState = SCENARIOS.test1;      clearDice(); }
  if (key === '5') { aiMode = false; startGame(); }              // Hot-seat
  if (key === 'i' || key === 'I') { aiMode = true;  startGame(); } // vs IA (joue black)
  if (key === 'b' || key === 'B') { startBarEntryTest(); }       // Test barre
  if (key === 'm' || key === 'M') { newMatch(); }                // Nouvelle partie
}
