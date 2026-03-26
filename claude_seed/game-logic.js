// ============================================================
// FILE: src/game/logic.js
// Pure game functions — no React, no side effects
// ============================================================

export const P1 = 1;
export const P2 = 2;

export const TOP_IDX = [12,13,14,15,16,17,null,18,19,20,21,22,23];
export const BOT_IDX = [11,10,9,8,7,6,null,5,4,3,2,1,0];

export function initialBoard() {
  const p = Array.from({ length: 24 }, () => ({ n: 0, p: 0 }));
  p[23] = { n: 2, p: 1 }; p[12] = { n: 5, p: 1 };
  p[7]  = { n: 3, p: 1 }; p[5]  = { n: 5, p: 1 };
  p[0]  = { n: 2, p: 2 }; p[11] = { n: 5, p: 2 };
  p[16] = { n: 3, p: 2 }; p[18] = { n: 5, p: 2 };
  return p;
}

export function newGameState() {
  return {
    pts: initialBoard(),
    bar: { 1: 0, 2: 0 },
    off: { 1: 0, 2: 0 },
    dice: [], moves: [],
    turn: 0, phase: 'roll', winner: 0,
  };
}

export function clone(s) {
  return JSON.parse(JSON.stringify(s));
}

export function rollDice() {
  const a = Math.floor(Math.random() * 6) + 1;
  const b = Math.floor(Math.random() * 6) + 1;
  return a === b ? [a, a, a, a] : [a, b];
}

export function canLand(pts, i, pl) {
  return pts[i].p === 0 || pts[i].p === pl || pts[i].n <= 1;
}

export function allHome(s, pl) {
  if (s.bar[pl] > 0) return false;
  const [lo, hi] = pl === 1 ? [0, 5] : [18, 23];
  for (let i = 0; i < 24; i++) {
    if (s.pts[i].p === pl && s.pts[i].n > 0 && (i < lo || i > hi))
      return false;
  }
  return true;
}

export function pipDist(i, pl) {
  return pl === 1 ? i + 1 : 24 - i;
}

export function farthestHome(s, pl) {
  const [lo, hi] = pl === 1 ? [0, 5] : [18, 23];
  if (pl === 1) {
    for (let i = hi; i >= lo; i--)
      if (s.pts[i].p === pl && s.pts[i].n > 0) return i;
  } else {
    for (let i = lo; i <= hi; i++)
      if (s.pts[i].p === pl && s.pts[i].n > 0) return i;
  }
  return -1;
}

export function getValidMoves(s, pl) {
  const mv = [];
  const u = [...new Set(s.moves)];

  if (s.bar[pl] > 0) {
    for (const d of u) {
      const t = pl === 1 ? 24 - d : d - 1;
      if (t >= 0 && t < 24 && canLand(s.pts, t, pl))
        mv.push({ f: 'bar', t, d });
    }
    return mv;
  }

  const ah = allHome(s, pl);
  for (let i = 0; i < 24; i++) {
    if (s.pts[i].p !== pl || s.pts[i].n === 0) continue;
    for (const d of u) {
      const t = pl === 1 ? i - d : i + d;
      if (t >= 0 && t < 24 && canLand(s.pts, t, pl)) {
        mv.push({ f: i, t, d });
      } else if (ah && (t < 0 || t > 23)) {
        const dd = pipDist(i, pl);
        if (dd === d) mv.push({ f: i, t: 'off', d });
        else if (dd < d && farthestHome(s, pl) === i)
          mv.push({ f: i, t: 'off', d });
      }
    }
  }
  return mv;
}

export function applyMove(s, pl, m) {
  const ns = clone(s);
  if (m.f === 'bar') ns.bar[pl]--;
  else {
    ns.pts[m.f].n--;
    if (ns.pts[m.f].n === 0) ns.pts[m.f].p = 0;
  }
  if (m.t === 'off') {
    ns.off[pl]++;
  } else {
    const op = pl === 1 ? 2 : 1;
    if (ns.pts[m.t].p === op && ns.pts[m.t].n === 1) {
      ns.pts[m.t].n = 0; ns.pts[m.t].p = 0;
      ns.bar[op]++;
    }
    ns.pts[m.t].n++;
    ns.pts[m.t].p = pl;
  }
  const idx = ns.moves.indexOf(m.d);
  if (idx !== -1) ns.moves.splice(idx, 1);
  return ns;
}

export function checkWin(s) {
  if (s.off[1] >= 15) return 1;
  if (s.off[2] >= 15) return 2;
  return 0;
}


// ============================================================
// FILE: src/game/ai.js
// AI evaluation and move selection
// ============================================================

import { clone, getValidMoves, applyMove, pipDist } from './logic';

function evaluate(s, pl) {
  let sc = 0;
  const op = pl === 1 ? 2 : 1;
  sc += s.off[pl] * 25;
  sc += s.bar[op] * 18;
  sc -= s.bar[pl] * 25;

  for (let i = 0; i < 24; i++) {
    if (s.pts[i].p === pl) {
      if (s.pts[i].n >= 2) sc += 5;
      if (s.pts[i].n === 1) {
        const [lo, hi] = op === 1 ? [0, 5] : [18, 23];
        sc += (i >= lo && i <= hi) ? -10 : -4;
      }
      sc += (7 - pipDist(i, pl)) * 0.5;
    }
  }
  return sc;
}

export function aiPlay(s, pl) {
  let cur = clone(s);
  const seq = [];

  while (cur.moves.length > 0) {
    const vm = getValidMoves(cur, pl);
    if (vm.length === 0) break;

    let bestMove = null;
    let bestScore = -1e9;
    for (const m of vm) {
      const ns = applyMove(cur, pl, m);
      const sc = evaluate(ns, pl);
      if (sc > bestScore) { bestScore = sc; bestMove = m; }
    }

    seq.push(bestMove);
    cur = applyMove(cur, pl, bestMove);
  }

  return { seq, state: cur };
}
