// logic_standalone.js – version plain-JS de logic.js (pas d'ES modules)
// Expose l'objet global `Logic`

const Logic = (() => {
  const P1 = 1, P2 = 2;

  function initialBoard() {
    const p = Array.from({ length: 24 }, () => ({ n: 0, p: 0 }));
    p[23] = { n: 2, p: 1 }; p[12] = { n: 5, p: 1 };
    p[7]  = { n: 3, p: 1 }; p[5]  = { n: 5, p: 1 };
    p[0]  = { n: 2, p: 2 }; p[11] = { n: 5, p: 2 };
    p[16] = { n: 3, p: 2 }; p[18] = { n: 5, p: 2 };
    return p;
  }

  function newGameState() {
    return {
      pts: initialBoard(),
      bar: { 1: 0, 2: 0 },
      off: { 1: 0, 2: 0 },
      dice: [], moves: [],
      openingRolls: { 1: 0, 2: 0 },
      turn: 0, phase: 'opening', winner: 0,
    };
  }

  function clone(s) {
    return JSON.parse(JSON.stringify(s));
  }

  function rollSingleDie() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function rollDice() {
    const a = Math.floor(Math.random() * 6) + 1;
    const b = Math.floor(Math.random() * 6) + 1;
    return a === b ? [a, a, a, a] : [a, b];
  }

  function rollOpeningDice() {
    let a, b;
    do { a = rollSingleDie(); b = rollSingleDie(); } while (a === b);
    return { 1: a, 2: b };
  }

  function resolveOpening(rolls) {
    if (rolls[1] === rolls[2]) return null;
    const winner = rolls[1] > rolls[2] ? P1 : P2;
    return { dice: [rolls[1], rolls[2]], moves: [rolls[1], rolls[2]], phase: 'move', turn: winner };
  }

  function canLand(pts, i, pl) {
    return pts[i].p === 0 || pts[i].p === pl || pts[i].n <= 1;
  }

  function allHome(s, pl) {
    if (s.bar[pl] > 0) return false;
    const [lo, hi] = pl === 1 ? [0, 5] : [18, 23];
    for (let i = 0; i < 24; i++) {
      if (s.pts[i].p === pl && s.pts[i].n > 0 && (i < lo || i > hi)) return false;
    }
    return true;
  }

  function pipDist(i, pl) {
    return pl === 1 ? i + 1 : 24 - i;
  }

  function calcPipCount(s, pl) {
    let total = 0;
    for (let i = 0; i < 24; i++) {
      if (s.pts[i].p === pl && s.pts[i].n > 0)
        total += pipDist(i, pl) * s.pts[i].n;
    }
    total += s.bar[pl] * 25;
    return total;
  }

  function farthestHome(s, pl) {
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

  function getValidMoves(s, pl) {
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

  function applyMove(s, pl, m) {
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

  function checkWin(s) {
    if (s.off[1] >= 15) return 1;
    if (s.off[2] >= 15) return 2;
    return 0;
  }

  return { P1, P2, initialBoard, newGameState, clone, rollSingleDie, rollDice,
           rollOpeningDice, resolveOpening, canLand, allHome, pipDist,
           calcPipCount, farthestHome, getValidMoves, applyMove, checkWin };
})();
