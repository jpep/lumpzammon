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

  // ── Greedy : choisit la meilleure séquence selon evaluate immédiat ────────
  function greedyPlay(s, pl) {
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

  // ── Énumère toutes les séquences distinctes (dédup par état final) ────────
  function enumerateSequences(s, pl, maxResults) {
    const out  = [];
    const seen = new Set();
    function key(st) {
      let k = '';
      for (let i = 0; i < 24; i++) k += st.pts[i].p + '.' + st.pts[i].n + '|';
      k += 'b' + st.bar[1] + '.' + st.bar[2] + '|o' + st.off[1] + '.' + st.off[2];
      return k;
    }
    function recurse(cur, seq) {
      if (out.length >= maxResults) return;
      const vm = (cur.moves.length === 0) ? [] : Logic.getValidMoves(cur, pl);
      if (vm.length === 0) {
        const k = key(cur);
        if (!seen.has(k)) { seen.add(k); out.push({ seq: seq.slice(), state: cur }); }
        return;
      }
      for (const m of vm) {
        if (out.length >= maxResults) return;
        const ns = Logic.applyMove(cur, pl, m);
        seq.push(m);
        recurse(ns, seq);
        seq.pop();
      }
    }
    recurse(Logic.clone(s), []);
    return out;
  }

  // ── Score attendu de l'adversaire après son meilleur coup greedy ──────────
  // Pondère par la probabilité de chaque lancer (15 non-doubles × 1/18, 6 doubles × 1/36)
  function expectedOpponentScore(s, op) {
    let total = 0, weight = 0;
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = d1; d2 <= 6; d2++) {
        const isDouble = d1 === d2;
        const ns = Logic.clone(s);
        ns.dice  = isDouble ? [d1, d1, d1, d1] : [d1, d2];
        ns.moves = ns.dice.slice();
        const r  = greedyPlay(ns, op);
        const sc = evaluate(r.state, op);
        const p  = isDouble ? 1/36 : 2/36;
        total  += p * sc;
        weight += p;
      }
    }
    return weight > 0 ? total / weight : 0;
  }

  // ── 1-ply lookahead : énumère mes séquences, évalue la réponse adverse ────
  function aiPlay(s, pl) {
    const op  = pl === 1 ? 2 : 1;
    const seqs = enumerateSequences(s, pl, 60);   // cap raisonnable
    if (seqs.length === 0) return { seq: [], state: Logic.clone(s) };
    if (seqs.length === 1) return seqs[0];

    let best = null, bestScore = -1e9;
    for (const cand of seqs) {
      const myScore   = evaluate(cand.state, pl);
      const oppExpect = expectedOpponentScore(cand.state, op);
      const net       = myScore - oppExpect;
      if (net > bestScore) { bestScore = net; best = cand; }
    }
    return best || seqs[0];
  }

  return { aiPlay, greedyPlay, evaluate };
})();
