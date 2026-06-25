// ai_standalone.js – IA backgammon "plain JS" (pas d'ES modules)
// Dépend de Logic (logic_standalone.js). Expose l'objet global `AI`.
//
// Stratégie (bien plus forte que l'ancienne version gloutonne) :
//   • Évaluation statique riche, exprimée en unités de "pips" :
//       – course de pips (le signal dominant)
//       – exposition des blots par comptage RÉEL des tirs adverses /36
//         (tirs directs + combinés, en tenant compte des points bloquants)
//       – valeur du home board (points faits, super-linéaire)
//       – primes/blocages devant les fiches arrière adverses
//       – ancres défensives dans le home adverse
//       – malus barre / bonus barre adverse
//   • Recherche expectiminimax 1-ply : on énumère nos séquences, on garde les
//     meilleures au score statique, puis on les départage par la réponse
//     adverse moyennée sur les 21 lancers possibles.
//
// Interface publique inchangée : { aiPlay, greedyPlay, evaluate }.

const AI = (() => {
  // ── Poids de l'évaluation (échelle ≈ pips) ───────────────────────────────
  const W = {
    pip:        1.0,                       // 1 pt par pip d'avance dans la course
    off:        3.0,                       // bonus par fiche déjà sortie
    bar:        8.0,                       // malus supp. par fiche sur MA barre
    blot:       1.0,                       // poids du coût d'exposition d'un blot
    homePoint:  [0, 3, 7, 12, 19, 28, 30], // valeur cumulée selon le nb de points home faits
    prime:      2.5,                       // bonus par point de blocage consécutif
    anchor:     7.0,                       // ancre tenue dans le home adverse
  };

  // ── Y a-t-il encore contact ? (sinon : pure course, blots/structure inutiles) ─
  function hasContact(s) {
    let p1max = -1;
    if (s.bar[1] > 0) p1max = 24;
    else for (let i = 23; i >= 0; i--) if (s.pts[i].p === 1 && s.pts[i].n > 0) { p1max = i; break; }
    let p2min = 24;
    if (s.bar[2] > 0) p2min = -1;
    else for (let i = 0; i < 24; i++) if (s.pts[i].p === 2 && s.pts[i].n > 0) { p2min = i; break; }
    return p1max > p2min;
  }

  // ── Probabilité (0..1) que `op` touche un blot situé en `t` au prochain tour ──
  // Énumère les 36 lancers ordonnés ; un lancer compte si AU MOINS une fiche de
  // `op` peut atteindre `t` (tir direct, combiné via un relais libre, ou double).
  function hitProb(s, t, op) {
    const pl = op === 1 ? 2 : 1;
    const sources = [];
    if (s.bar[op] > 0) {
      // Fiche(s) sur la barre : doivent rentrer d'abord. On modélise la barre
      // comme une position virtuelle (-1 pour op2, 24 pour op1) et on ignore
      // les fiches de champ (approximation prudente).
      sources.push(op === 2 ? -1 : 24);
    } else {
      for (let j = 0; j < 24; j++)
        if (s.pts[j].p === op && s.pts[j].n > 0) sources.push(j);
    }
    if (sources.length === 0) return 0;

    const blocked = (x) => x >= 0 && x < 24 && s.pts[x].p === pl && s.pts[x].n >= 2;
    const inter   = (src, k) => (op === 2 ? src + k : src - k); // relais à k pas

    let hits = 0;
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const dbl = a === b;
        let hit = false;
        for (const src of sources) {
          const dist = op === 2 ? t - src : src - t;
          if (dist < 1) continue;
          if (!dbl) {
            if (dist === a || dist === b) { hit = true; break; }
            if (dist === a + b &&
                (!blocked(inter(src, a)) || !blocked(inter(src, b)))) { hit = true; break; }
          } else {
            const d = a;
            if (dist === d) { hit = true; break; }
            if (dist === 2 * d && !blocked(inter(src, d))) { hit = true; break; }
            if (dist === 3 * d && !blocked(inter(src, d)) && !blocked(inter(src, 2 * d))) { hit = true; break; }
            if (dist === 4 * d && !blocked(inter(src, d)) && !blocked(inter(src, 2 * d)) && !blocked(inter(src, 3 * d))) { hit = true; break; }
          }
        }
        if (hit) hits++;
      }
    }
    return hits / 36;
  }

  // ── Valeur du home board : nb de points faits (n>=2) dans mon quadrant ───────
  function homeBoardValue(s, pl) {
    const [lo, hi] = pl === 1 ? [0, 5] : [18, 23];
    let made = 0;
    for (let i = lo; i <= hi; i++) if (s.pts[i].p === pl && s.pts[i].n >= 2) made++;
    return W.homePoint[made];
  }

  // ── Blocage : longueur de prime consécutive devant la fiche arrière adverse ──
  function blockadeValue(s, pl, op) {
    let rear;
    if (op === 2) {
      rear = s.bar[2] > 0 ? -1 : null;
      if (rear === null) for (let i = 0; i < 24; i++) if (s.pts[i].p === 2 && s.pts[i].n > 0) { rear = i; break; }
    } else {
      rear = s.bar[1] > 0 ? 24 : null;
      if (rear === null) for (let i = 23; i >= 0; i--) if (s.pts[i].p === 1 && s.pts[i].n > 0) { rear = i; break; }
    }
    if (rear === null || rear === undefined) return 0;
    let len = 0, x = rear;
    for (let step = 0; step < 7; step++) {
      x = op === 2 ? x + 1 : x - 1;
      if (x < 0 || x > 23) break;
      if (s.pts[x].p === pl && s.pts[x].n >= 2) len++;
      else break;
    }
    return len * W.prime * (len >= 4 ? 2 : 1); // un (quasi-)prime étouffe vraiment
  }

  // ── Ancre défensive : un point tenu dans le home adverse ─────────────────────
  function anchorValue(s, pl, op) {
    const [lo, hi] = op === 1 ? [0, 5] : [18, 23];
    for (let i = lo; i <= hi; i++)
      if (s.pts[i].p === pl && s.pts[i].n >= 2) return W.anchor; // une ancre solide suffit
    return 0;
  }

  // ── Évaluation statique : score (plus haut = meilleur pour `pl`) ─────────────
  function evaluate(s, pl) {
    const op = pl === 1 ? 2 : 1;
    const myPip = Logic.calcPipCount(s, pl);
    const opPip = Logic.calcPipCount(s, op);

    let sc = 0;
    sc += (opPip - myPip) * W.pip;                 // course
    sc += (s.off[pl] - s.off[op]) * W.off;         // fiches sorties
    sc -= s.bar[pl] * W.bar;                        // mes fiches barrées (au-delà des pips)
    sc += s.bar[op] * W.bar * 0.6;                  // fiches adverses barrées

    if (hasContact(s)) {
      // Risque : chaque blot pénalisé par P(touché) × pips perdus si touché.
      for (let i = 0; i < 24; i++) {
        if (s.pts[i].p === pl && s.pts[i].n === 1) {
          const ph = hitProb(s, i, op);
          if (ph > 0) sc -= ph * (25 - Logic.pipDist(i, pl)) * W.blot;
        }
      }
      sc += homeBoardValue(s, pl);
      sc -= homeBoardValue(s, op) * 0.8;
      sc += blockadeValue(s, pl, op);
      sc += anchorValue(s, pl, op);
    }
    return sc;
  }

  // ── Greedy : meilleure séquence selon evaluate immédiat (modèle adverse) ─────
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

  // ── Énumère les séquences distinctes (dédup par état final) ──────────────────
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
      const vm = cur.moves.length === 0 ? [] : Logic.getValidMoves(cur, pl);
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

  // ── Score adverse attendu après sa meilleure réponse greedy ──────────────────
  // Pondéré par la proba de chaque lancer (15 non-doubles × 2/36, 6 doubles × 1/36).
  function expectedOpponentScore(s, op) {
    let total = 0, weight = 0;
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = d1; d2 <= 6; d2++) {
        const isDouble = d1 === d2;
        const ns = Logic.clone(s);
        ns.dice  = isDouble ? [d1, d1, d1, d1] : [d1, d2];
        ns.moves = ns.dice.slice();
        const r = greedyPlay(ns, op);
        const p = isDouble ? 1 / 36 : 2 / 36;
        total  += p * evaluate(r.state, op);
        weight += p;
      }
    }
    return weight > 0 ? total / weight : 0;
  }

  // ── Décision : 2-ply expectiminimax sur les top-K candidats ──────────────────
  // Pour chacun de mes K meilleurs coups, on moyenne sur les 21 lancers adverses :
  // l'adversaire joue SA MEILLEURE réponse (énumération), et on mesure MA
  // probabilité de victoire à ce moment-là. On garde le coup qui la maximise.
  // (Gain de profondeur pur : même évaluation, recherche plus loin que le 1-ply.)
  function aiPlay(s, pl) {
    const op = pl === 1 ? 2 : 1;
    const seqs = enumerateSequences(s, pl, 200);
    if (seqs.length === 0) return { seq: [], state: Logic.clone(s) };
    if (seqs.length === 1) return seqs[0];

    // Tri par proba de victoire immédiate (après mon coup, adversaire sur le trait).
    for (const c of seqs) c._w = winProb(c.state, pl, false);
    seqs.sort((a, b) => b._w - a._w);

    // Pure course : aucune réponse à modéliser, la meilleure proba immédiate suffit.
    if (!hasContact(s)) return seqs[0];

    // Contact : 2-ply sur les K meilleurs candidats.
    const K = Math.min(12, seqs.length);
    let best = null, bestVal = -1;
    for (let i = 0; i < K; i++) {
      const c = seqs[i];
      let avg = 0;
      for (let d1 = 1; d1 <= 6; d1++) {
        for (let d2 = d1; d2 <= 6; d2++) {
          const dbl = d1 === d2, p = dbl ? 1 / 36 : 2 / 36;
          const ns = Logic.clone(c.state);
          ns.dice  = dbl ? [d1, d1, d1, d1] : [d1, d2];
          ns.moves = ns.dice.slice();
          const oc = enumerateSequences(ns, op, 20);
          let chosen = ns, bestOppW = -1;
          for (const o of oc) {
            const ow = winProb(o.state, op, false);
            if (ow > bestOppW) { bestOppW = ow; chosen = o.state; }
          }
          avg += p * winProb(chosen, pl, true);   // ma proba quand je serai sur le trait
        }
      }
      if (avg > bestVal) { bestVal = avg; best = c; }
    }
    return best || seqs[0];
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CUBE DE DOUBLAGE
  // ─────────────────────────────────────────────────────────────────────────

  // Probabilité (0..1) que `pl` gagne la partie (sans cube), estimée en mappant
  // l'avantage d'évaluation (≈ 2× l'avance de pips + structure) par une
  // logistique calibrée. `plOnRoll` : true si `pl` est sur le trait, false si
  // c'est l'adversaire, undefined si neutre (on ajoute ~½ lancer ≈ 4 pips).
  function winProb(s, pl, plOnRoll) {
    const op = pl === 1 ? 2 : 1;
    let adv = evaluate(s, pl) - evaluate(s, op);
    if (plOnRoll === true)  adv += 8;          // ~4 pips, doublés dans adv
    else if (plOnRoll === false) adv -= 8;
    const S = 38;                              // ~10 pips d'avance (adv≈20) ⇒ ~0.63
    return 1 / (1 + Math.exp(-adv / S));
  }

  // Risque de gammon (0..1) SUR `loser` : probabilité grossière qu'il perde un
  // gammon (donc le double de la mise). Sert à durcir les décisions de cube.
  function gammonRisk(s, loser) {
    if (s.off[loser] >= 1) return 0;           // a déjà sorti une fiche : plus de gammon
    const winner = loser === 1 ? 2 : 1;
    const [lo, hi] = loser === 1 ? [0, 5] : [18, 23]; // home du PERDANT
    // Retardataires : fiches pas encore rentrées (hors home) + barre. S'il n'en
    // reste aucune, le perdant sortira une fiche à temps → pas de gammon.
    let stragglers = s.bar[loser];
    for (let i = 0; i < 24; i++)
      if (s.pts[i].p === loser && s.pts[i].n > 0 && (i < lo || i > hi)) stragglers += s.pts[i].n;
    if (stragglers === 0) return 0;

    const wp = Logic.calcPipCount(s, winner);
    let risk = 0;
    if (wp < 50) risk += 0.30;                 // gagnant tout proche de finir
    else if (wp < 80) risk += 0.15;
    risk += Math.min(0.45, stragglers * 0.10); // plus de retardataires = pire
    risk += Math.min(0.25, s.bar[loser] * 0.15);
    // Fiches piégées dans le home du GAGNANT (escapade difficile)
    const [wlo, whi] = winner === 1 ? [0, 5] : [18, 23];
    let trapped = 0;
    for (let i = wlo; i <= whi; i++) if (s.pts[i].p === loser) trapped += s.pts[i].n;
    risk += Math.min(0.25, trapped * 0.08);
    return Math.max(0, Math.min(0.85, risk));
  }

  // `pl` doit-il OFFRIR un double ? → 'double' | 'no-double'.
  // `plOnRoll` : true (défaut) car on double normalement avant de lancer.
  function cubeAction(s, pl, plOnRoll) {
    const p = winProb(s, pl, plOnRoll === false ? undefined : true);
    const DOUBLE_AT = 0.68;   // borne basse de la fenêtre de doublage (favori net)
    const TOO_GOOD  = 0.84;   // au-delà : on peut préférer jouer pour le gammon
    if (p < DOUBLE_AT) return 'no-double';
    if (p >= TOO_GOOD && gammonRisk(s, pl === 1 ? 2 : 1) > 0.35) return 'no-double';
    return 'double';
  }

  // `pl` doit-il ACCEPTER (prendre) un double ? → bool.
  // `doublerOnRoll` : true (défaut) car l'offrant lance juste après l'acceptation.
  function cubeTake(s, pl, doublerOnRoll) {
    const p = winProb(s, pl, doublerOnRoll === false ? undefined : false);
    // Point de prise ≈ 25 % en jeu mort, abaissé (cube life) puis relevé par le
    // risque de gammon (un gammon fait perdre le double de la mise prise).
    const tp = 0.22 + gammonRisk(s, pl) * 0.20;   // ~0.22 → ~0.39
    return p >= tp;
  }

  return { aiPlay, greedyPlay, evaluate, winProb, gammonRisk, cubeAction, cubeTake,
           enumerateSequences, hasContact };
})();
