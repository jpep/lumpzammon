// sketch.js – Lumpzammon skin preview  [variante chromatique + fibre optique]
// ─────────────────────────────────────────────────────────────────────────────
// Géométrie : r, a = 2r, plateau 13a × 13a
// Raccourcis : [1][2][3][4] → scénarios
// ─────────────────────────────────────────────────────────────────────────────

let r, a, bx, by;
let diceOnSide = true;   // true = dés à gauche (paysage) ; false = dés au-dessus/dessous (portrait)
const MARGIN    = 24;
const MAX_STACK = 6;

let fontLarge, fontSmall;


// ── Palette globale (accessible depuis dice.js) ───────────────────────────────
let C;
let bgImage;
let dominantHue = 0;   // extrait de fond.jpg au setup

function preload() {
  bgImage   = loadImage('fond.jpg');
  fontLarge = loadFont('fonts/nortechico-100.otf');
  fontSmall = loadFont('fonts/nortechico-60.otf');
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
  const h = dominantHue;
  colorMode(HSB, 360, 100, 100, 255);
  C = {
    bg:       color(h, 22,  96, 255),    // tint très léger (non utilisé en fond direct)
    board:    color(h, 52,  62, 153),    // plateau   60 % opacité
    triA:     color(h, 78,  32, 128),    // triangle foncé    50 %
    triB:     color(h, 90,  18, 128),    // triangle très foncé 50 %
    bar:      color(h, 42,  52, 153),    // barre     60 %
    ivory:    color(h,  8,  97, 255),    // ivoire (lignes, textes)
    ruby:     color(h, 85,  32, 255),    // fiche noire : foncé saturé
    offwhite: color(h, 12,  92, 255),    // fiche blanche : quasi-blanc teinté
    numColor: color(h, 90,  16, 255),    // numéros très foncés
    fiberDot: color(h,  5, 100, 255),    // point fibre optique
    fiberSnap:color(h, 32, 100, 255),    // point fibre optique – snap
  };
  colorMode(RGB, 255, 255, 255, 255);
}

// ── Drag ─────────────────────────────────────────────────────────────────────
let drag = {
  active: false, fromPt: null,
  mouseX: 0, mouseY: 0,
  dispX:  0, dispY:  0,
  snapPt: null,
};

// ── Géométrie responsive ──────────────────────────────────────────────────────
function computeGeometry() {
  diceOnSide = windowWidth >= windowHeight * 1.1;   // paysage → dés à gauche

  if (diceOnSide) {
    // Zone dés à gauche : r/2 (gap plateau) + ds + r/2 (gap inter) + ds = 7r = 3.5a
    // Total horizontal : 13a + 3.5a = 16.5a
    const maxW = windowWidth  - 2 * MARGIN;
    const maxH = windowHeight - 2 * MARGIN;
    a  = min(maxW / 16.5, maxH / 13);
    r  = a / 2;
    const diceW = 3.5 * a;   // 7r
    bx = (windowWidth - 13*a - diceW) / 2 + diceW;
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
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeGeometry();
  buildPalette();
  rescaleDice();
}

// ── Boucle principale ─────────────────────────────────────────────────────────
function draw() {
  clear();   // canvas transparent → image CSS du body visible en dessous
  drawBoard();
  drawPointNumbers();
  drawCheckers();
  if (drag.active) {
    updateDragDisplay();
    drawDraggedChecker();
  }
  drawOff();
  updateDiceAnim();
  drawAllDice();
  drawPlayerInfo();
  drawInfo();
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
  // Fond tablier
  fill(C.board);
  stroke(C.ivory);
  strokeWeight(1.5);
  rect(bx, by, 13*a, 13*a);

  const targets = drag.active ? getValidTargets(drag.fromPt, mockState.dice) : [];

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
      // Portrait : fiches 0.4r×2r, gap r/2
      const w = r*0.4, step = w + r/2;
      const idx = mockState.turn === 'white' ? mockState.off.white : mockState.off.black;
      return bx + 13*a - r/2 - w - idx*step + w/2;   // centre du prochain slot
    }
    // Paysage : centre x du prochain slot
    const idx = mockState.turn === 'white' ? mockState.off.white : mockState.off.black;
    return bx + 13*a + r + floor(idx/8)*(2*r + r/2) + r;   // ox + col*colW + w/2
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
    const skipTop = drag.active && drag.fromPt === pt;
    drawStackOnPoint(pt, abs(val), val > 0, skipTop);
  }
  const barCX = bx + 6.5*a;
  for (let i = 0; i < mockState.bar.white; i++)
    drawChecker(barCX, by + 3*a - r - i*a, true, false);
  for (let i = 0; i < mockState.bar.black; i++)
    drawChecker(barCX, by + 10*a + r + i*a, false, false);
}

function drawStackOnPoint(pt, count, isWhite, skipTop) {
  const drawN   = skipTop ? count - 1 : count;
  if (drawN <= 0) return;
  const cx      = ptCenterX(pt);
  const isBot   = pt <= 12;
  const visible = min(drawN, MAX_STACK);
  const overflow = max(drawN - MAX_STACK, 0);

  // Est-ce que ce point est une cible valide ?
  const targets = drag.active ? getValidTargets(drag.fromPt, mockState.dice) : [];
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
  fill(isWhite ? C.offwhite : C.ruby);
  stroke(C.ivory);
  strokeWeight(1.5);
  ellipse(cx, cy, 2*r, 2*r);

  // Fibre optique supprimée des fiches : uniquement sur les triangles/colonnes.
}

function drawCheckerLabel(cx, cy, isWhite, label) {
  fill(isWhite ? C.offwhite : C.ruby);
  stroke(C.ivory);
  strokeWeight(1.5);
  ellipse(cx, cy, 2*r, 2*r);
  noStroke();
  fill(isWhite ? C.numColor : C.ivory);
  textAlign(CENTER, CENTER);
  textSize(r * 0.78);
  text(label, cx, cy);
}

// Pièce en cours de drag
function drawDraggedChecker() {
  const isWhite = mockState.points[drag.fromPt] > 0;
  noStroke();
  fill(0, 0, 0, 25);
  ellipse(drag.dispX + 2, drag.dispY + 3, 2*r + 8, 2*r + 8);
  fill(isWhite ? C.offwhite : C.ruby);
  stroke(C.ivory);
  strokeWeight(2);
  ellipse(drag.dispX, drag.dispY, 2*r, 2*r);
}

// ── Mouvements valides ────────────────────────────────────────────────────────
// Retourne les destinations valides ; 0 = bearing off (sortie du plateau)
function getValidTargets(fromPt, dice) {
  const targets = [];

  function addDest(dest) {
    if (dest >= 1 && dest <= 24) {
      if (!targets.includes(dest)) targets.push(dest);
    } else if (dest <= 0 && mockState.phase === 'bearingOff') {
      if (!targets.includes(0)) targets.push(0);
    }
  }

  // Mouvements individuels
  for (const d of dice) addDest(fromPt - d);

  // Somme des deux dés (si une case intermédiaire est accessible)
  if (dice.length === 2) {
    const sum  = dice[0] + dice[1];
    const mid0 = fromPt - dice[0];
    const mid1 = fromPt - dice[1];
    if (isPtAvailable(mid0) || isPtAvailable(mid1)) addDest(fromPt - sum);
  }

  return targets;
}

// Vérifie qu'un point n'est pas bloqué par l'adversaire (≥ 2 pièces ennemies)
function isPtAvailable(pt) {
  if (pt < 1 || pt > 24) return false;
  const val  = mockState.points[pt] || 0;
  const sign = mockState.turn === 'white' ? 1 : -1;
  return val * sign >= 0 || Math.abs(val) <= 1;
}

// ── Événements souris ─────────────────────────────────────────────────────────
function mousePressed() {
  if (isClickOnDiceZone(mouseX, mouseY, mockState.turn)) {
    if (diceAnim.state === DS.EMPTY || diceAnim.state === DS.DONE) {
      clearDice();
      startRoll(mockState.dice, mockState.turn);
    }
    return;
  }
  for (let pt = 1; pt <= 24; pt++) {
    const val = mockState.points[pt];
    if (!val) continue;
    if (mockState.turn === 'white' && val < 0) continue;
    if (mockState.turn === 'black' && val > 0) continue;
    const cx = ptCenterX(pt), cy = ptTopY(pt);
    if (dist(mouseX, mouseY, cx, cy) < r) {
      drag.active = true;
      drag.fromPt = pt;
      drag.mouseX = drag.dispX = mouseX;
      drag.mouseY = drag.dispY = mouseY;
      drag.snapPt = null;
      break;
    }
  }
}

function mouseDragged() {
  if (!drag.active) return;
  drag.mouseX = mouseX;
  drag.mouseY = mouseY;
  drag.snapPt = null;
  for (const tpt of getValidTargets(drag.fromPt, mockState.dice)) {
    if (tpt === 0) {
      if (diceOnSide) {
        // Paysage : snap à droite du tablier
        if (mouseX > bx + 13*a) { drag.snapPt = 0; break; }
      } else {
        // Portrait : snap sous le plateau (blanc) ou au-dessus (noir)
        if (mockState.turn === 'white' && mouseY > by + 13*a - r) { drag.snapPt = 0; break; }
        if (mockState.turn === 'black' && mouseY < by + r)         { drag.snapPt = 0; break; }
      }
    } else {
      if (abs(mouseX - ptCenterX(tpt)) <= a / 2) { drag.snapPt = tpt; break; }
    }
  }
}

function mouseReleased() {
  if (!drag.active) return;
  if (drag.snapPt !== null) {
    const sign = mockState.turn === 'white' ? 1 : -1;
    mockState.points[drag.fromPt] -= sign;
    if (drag.snapPt === 0) {
      // Bearing off
      if (mockState.turn === 'white') mockState.off.white++;
      else                            mockState.off.black++;
    } else {
      mockState.points[drag.snapPt] += sign;
    }
  }
  drag.active = false; drag.fromPt = null; drag.snapPt = null;
}

// ── Zone bearing off ──────────────────────────────────────────────────────────
function drawOff() {
  const canBearOff = drag.active && getValidTargets(drag.fromPt, mockState.dice).includes(0);
  if (diceOnSide) drawOffLandscape(canBearOff);
  else            drawOffPortrait(canBearOff);
}

function drawOffLandscape(canBearOff) {
  const ox   = bx + 13*a + r;   // x gauche colonne 0
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
    fill(C.offwhite); stroke(C.ivory); strokeWeight(1);
    rect(px(i), yW(i), w, h);
  }
  for (let i = 0; i < mockState.off.black; i++) {
    fill(C.ruby); stroke(C.ivory); strokeWeight(1);
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
  // Empilées droite → gauche, r/2 du bord droit du plateau, r/2 entre fiches
  const w    = r * 0.4;        // largeur (fine) après rotation
  const h    = 2 * r;          // hauteur après rotation
  const gap  = r / 2;          // espace entre fiches
  const step = w + gap;        // pas horizontal
  const x0   = bx + 13*a - r/2; // bord droit de la 1ʳᵉ fiche

  function rx(i) { return x0 - w - i * step; }  // x gauche de la fiche i

  const ds   = dieSize();
  const yW   = by + 13*a + r*1.6;       // bord sup des dés blancs (côté plateau)
  const yB   = by - r*1.6 - h;          // bord inf des dés noirs (côté plateau) − h

  // Blancs : alignées sur l'arête supérieure des dés blancs, droite → gauche
  for (let i = 0; i < mockState.off.white; i++) {
    fill(C.offwhite); stroke(C.ivory); strokeWeight(1);
    rect(rx(i), yW, w, h);
  }
  // Noirs : alignées sur l'arête supérieure des dés noirs, droite → gauche
  for (let i = 0; i < mockState.off.black; i++) {
    fill(C.ruby); stroke(C.ivory); strokeWeight(1);
    rect(rx(i), yB, w, h);
  }
  // Fantôme
  if (canBearOff) {
    const isW  = mockState.turn === 'white';
    const idx  = isW ? mockState.off.white : mockState.off.black;
    const base = isW ? C.offwhite : C.ruby;
    noStroke(); fill(red(base), green(base), blue(base), 153);
    rect(rx(idx), isW ? yW : yB, w, h);
  }
}

// ── Numéros des points ────────────────────────────────────────────────────────
function drawPointNumbers() {
  textSize(11);
  textAlign(CENTER, CENTER);
  noStroke();
  fill(C.ivory);
  for (let pt = 1; pt <= 24; pt++) {
    const cy = pt <= 12 ? by + 13*a + r*0.8 : by - r*0.8;
    text(pt, ptCenterX(pt), cy);
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
  const nameW = (mockState.players && mockState.players.white) || 'USER 2';
  const nameB = (mockState.players && mockState.players.black) || 'USER 1';
  const t     = mockState.timers;
  const timerStr = t
    ? '(' + String(t.move).padStart(2, '0') + ')  ' + t.game
    : null;

  const szN = r * 1.4;
  const szP = r * 0.85;
  const gap = r * 0.2;

  // Hauteur totale d'un bloc (nom + pip [+ timer])
  function blockH() { return szN + gap + szP + (timerStr ? gap + szP : 0); }

  // Dessine un bloc aligné à gauche depuis (x, y) vers le bas
  function drawBlockLeft(name, pip, x, y) {
    textAlign(LEFT, TOP);
    textFont(fontLarge); textSize(szN); text(name,        x, y);
    textFont(fontSmall); textSize(szP); text('pip ' + pip, x, y + szN + gap);
    if (timerStr) text(timerStr, x, y + szN + gap + szP + gap);
  }

  // Dessine un bloc aligné à droite depuis (x, y) vers le bas
  function drawBlockRight(name, pip, x, y) {
    textAlign(RIGHT, TOP);
    textFont(fontLarge); textSize(szN); text(name,        x, y);
    textFont(fontSmall); textSize(szP); text('pip ' + pip, x, y + szN + gap);
    if (timerStr) text(timerStr, x, y + szN + gap + szP + gap);
  }

  if (diceOnSide) {
    // ── Paysage : à r/2 à droite de la ligne latérale droite du plateau ──
    const x = bx + 13*a + r/2;
    drawBlockLeft(nameB, pipB, x, by);                           // USER 1 (noir) – aligné haut plateau
    drawBlockLeft(nameW, pipW, x, by + 13*a - blockH());        // USER 2 (blanc) – aligné bas plateau

  } else {
    // ── Portrait : à droite des dés ──
    const ds = dieSize();
    const tx = bx + 2*ds + r;   // droite des dés + gap r
    drawBlockLeft(nameB, pipB, tx, by - ds - r*1.6);             // USER 1 (noir) – haut
    drawBlockLeft(nameW, pipW, tx, by + 13*a + r*1.6);           // USER 2 (blanc) – bas
  }
}

// ── Info scénario ─────────────────────────────────────────────────────────────
function drawInfo() {
  textSize(12);
  textAlign(LEFT, TOP);
  noStroke();
  fill(C.ivory);
  const name = Object.keys(SCENARIOS).find(k => SCENARIOS[k] === mockState) || '?';
  text(`[${name}] tour: ${mockState.turn}  dés: [${mockState.dice}]  — [1][2][3][4]`, 6, 4);
}

// ── Raccourcis clavier ────────────────────────────────────────────────────────
function keyPressed() {
  if (key === '1') { mockState = SCENARIOS.initial;    clearDice(); }
  if (key === '2') { mockState = SCENARIOS.midgame;    clearDice(); }
  if (key === '3') { mockState = SCENARIOS.bearingOff; clearDice(); }
  if (key === '4') { mockState = SCENARIOS.test1;      clearDice(); }
}
