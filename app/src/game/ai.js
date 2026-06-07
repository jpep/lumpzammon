import { clone, getValidMoves, applyMove, pipDist } from './logic';

// Static position evaluation from pl's perspective. Unchanged from the original
// (and byte-identical to devanture's evaluate): borne-off + opponent-on-bar are
// good, own-on-bar + blots are bad (blots in the opponent's home worse), plus a
// small advancement bonus. Exported so the cube AI can reuse it.
export function evaluate(s, pl) {
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

// Greedy one-ply: each step picks the single move maximizing immediate
// evaluate(), then repeats until the dice are spent. Fast, no opponent modeling.
// Kept as the cheap difficulty level and reused as the opponent's reply model.
export function greedyPlay(s, pl) {
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

// Enumerate distinct full-turn sequences, deduped by final board key, capped at
// maxResults to bound the branching for doubles.
function enumerateSequences(s, pl, maxResults) {
  const out = [];
  const seen = new Set();
  function key(st) {
    let k = '';
    for (let i = 0; i < 24; i++) k += st.pts[i].p + '.' + st.pts[i].n + '|';
    k += 'b' + st.bar[1] + '.' + st.bar[2] + '|o' + st.off[1] + '.' + st.off[2];
    return k;
  }
  function recurse(cur, seq) {
    if (out.length >= maxResults) return;
    const vm = (cur.moves.length === 0) ? [] : getValidMoves(cur, pl);
    if (vm.length === 0) {
      const k = key(cur);
      if (!seen.has(k)) { seen.add(k); out.push({ seq: seq.slice(), state: cur }); }
      return;
    }
    for (const m of vm) {
      if (out.length >= maxResults) return;
      const ns = applyMove(cur, pl, m);
      seq.push(m);
      recurse(ns, seq);
      seq.pop();
    }
  }
  recurse(clone(s), []);
  return out;
}

// Probability-weighted expected score of the opponent's best greedy reply,
// over all 21 distinct rolls (non-doubles 2/36, doubles 1/36).
function expectedOpponentScore(s, op) {
  let total = 0, weight = 0;
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = d1; d2 <= 6; d2++) {
      const isDouble = d1 === d2;
      const ns = clone(s);
      ns.dice = isDouble ? [d1, d1, d1, d1] : [d1, d2];
      ns.moves = ns.dice.slice();
      const r = greedyPlay(ns, op);
      const sc = evaluate(r.state, op);
      const p = isDouble ? 1 / 36 : 2 / 36;
      total += p * sc;
      weight += p;
    }
  }
  return weight > 0 ? total / weight : 0;
}

// 1-ply expectiminimax: enumerate my turn sequences and pick the one maximizing
// evaluate(me) minus the expected best greedy opponent reply. Blot/safety aware
// but much heavier than greedy (~up to 60 sequences × 21 opponent rollouts).
export function lookaheadPlay(s, pl) {
  const op = pl === 1 ? 2 : 1;
  const seqs = enumerateSequences(s, pl, 60);
  if (seqs.length === 0) return { seq: [], state: clone(s) };
  if (seqs.length === 1) return seqs[0];

  let best = null;
  let bestScore = -1e9;
  for (const cand of seqs) {
    const myScore = evaluate(cand.state, pl);
    const oppExpect = expectedOpponentScore(cand.state, op);
    const net = myScore - oppExpect;
    if (net > bestScore) { bestScore = net; best = cand; }
  }
  return best || seqs[0];
}

// Public entry. Returns { seq, state }.
//   difficulty 'easy'   -> greedy (cheap, original behaviour)
//   difficulty 'normal' -> 1-ply lookahead (devanture's stronger AI, default)
// The toggle will be surfaced in the UI in Phase 8.5; default 'normal' adopts
// devanture's engine. Use 'easy' on low-power devices if lookahead lags.
export function aiPlay(s, pl, difficulty = 'normal') {
  return difficulty === 'easy' ? greedyPlay(s, pl) : lookaheadPlay(s, pl);
}
