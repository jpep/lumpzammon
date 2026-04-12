// ai_standalone.js – version plain-JS de ai.js (pas d'ES modules)
// Dépend de Logic (logic_standalone.js)
// Expose l'objet global `AI`

const AI = (() => {
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
        sc += (7 - Logic.pipDist(i, pl)) * 0.5;
      }
    }
    return sc;
  }

  function aiPlay(s, pl) {
    let cur = Logic.clone(s);
    const seq = [];

    while (cur.moves.length > 0) {
      const vm = Logic.getValidMoves(cur, pl);
      if (vm.length === 0) break;

      let bestMove = null, bestScore = -1e9;
      for (const m of vm) {
        const ns = Logic.applyMove(cur, pl, m);
        const sc = evaluate(ns, pl);
        if (sc > bestScore) { bestScore = sc; bestMove = m; }
      }

      seq.push(bestMove);
      cur = Logic.applyMove(cur, pl, bestMove);
    }

    return { seq, state: cur };
  }

  return { aiPlay };
})();
