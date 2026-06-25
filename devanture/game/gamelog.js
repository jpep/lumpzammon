// gamelog.js — Journalisation par partie (autonome, expose `window.GameLog`).
//
// Enregistre 1 objet JSON par partie : métadonnées + flux d'événements
// horodatés (lancers, coups, passes, actions de cube) + résultat. On log les
// ENTRÉES BRUTES (dés + coups) : les états du plateau et les captures restent
// reconstructibles hors-ligne → log léger et robuste.
//
// Stockage : localStorage (cap des dernières parties). Export à la demande via
// GameLog.download() (fichier .json). Aucune dépendance : si localStorage /
// document / performance sont absents (ex. Node), le module dégrade sans erreur.
//
// Format (v1) :
//   { v, id, startedAt, mode, aiVersion, players:{white,black},
//     opening:{white,black,first},
//     events:[ {k:'roll', p, dice, t, dt},
//              {k:'move', p, moves:[{f,t,d}], t, dt, think?},
//              {k:'pass', p, reason, t, dt},
//              {k:'cube', ev:'offer'|'take'|'drop', by, from?, to?, t, dt} ],
//     result:{winner,type,cube,points}, endedAt, durationMs }
//   • t  = ms depuis le début de la partie  • dt = ms depuis l'événement précédent
//   • points/cases en numérotation 1–24 (+ 'bar' / 'off')

(function (global) {
  'use strict';

  var STORE_KEY  = 'devanture_gamelogs_v1';
  var MAX_GAMES  = 300;                    // cap anti-bloat du localStorage
  var AI_VERSION = 'eval2ply+cube-v1';     // tag de version de l'IA (à bumper si l'IA évolue)

  var current = null;                      // partie en cours (non persistée tant qu'inachevée)
  var t0 = 0;                              // origine temporelle de la partie

  function clock() {
    return (global.performance && global.performance.now)
      ? global.performance.now() : Date.now();
  }
  function nowMs() { return Math.round(clock() - t0); }

  // 0–23 → 1–24 ; 'bar'/'off' inchangés
  function ptLabel(x) { return (x === 'bar' || x === 'off') ? x : (x + 1); }

  function pushEvent(ev) {
    if (!current) return;
    var t = nowMs();
    var prev = current.events.length ? current.events[current.events.length - 1].t : 0;
    ev.t = t;
    ev.dt = t - prev;
    current.events.push(ev);
  }

  function loadAll() {
    try {
      if (typeof localStorage === 'undefined') return [];
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveAll(arr) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORE_KEY, JSON.stringify(arr));
    } catch (e) { /* quota dépassé / mode privé : on ignore silencieusement */ }
  }

  var GameLog = {
    VERSION:    1,
    AI_VERSION: AI_VERSION,

    // Démarre l'enregistrement d'une nouvelle partie.
    // meta : { mode, players:{white,black}, aiVersion? }
    newGame: function (meta) {
      t0 = clock();
      meta = meta || {};
      current = {
        v: 1,
        id: 'g-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        startedAt: new Date().toISOString(),
        tz: -(new Date().getTimezoneOffset()),   // minutes à l'est d'UTC (Paris été = +120)
        mode: meta.mode || 'unknown',
        aiVersion: meta.aiVersion || AI_VERSION,
        players: meta.players || { white: 'WHITE', black: 'BLACK' },
        opening: null,
        events: [],
        result: null,
        endedAt: null,
        durationMs: null,
      };
      return current.id;
    },

    // Lancer d'ouverture (1 dé chacun) + qui commence ('white'|'black').
    opening: function (whiteDie, blackDie, first) {
      if (!current) return;
      current.opening = { white: whiteDie, black: blackDie, first: first };
    },

    // Lancer de dés d'un tour.
    roll: function (player, dice) {
      pushEvent({ k: 'roll', p: player, dice: (dice || []).slice() });
    },

    // Coup(s) joué(s). seq : tableau de {f,t,d} (indices Logic 0–23 / 'bar' / 'off').
    // think (optionnel) : ms de réflexion (utile pour l'IA).
    move: function (player, seq, think) {
      if (!seq || !seq.length) return;
      var moves = [];
      for (var i = 0; i < seq.length; i++) {
        moves.push({ f: ptLabel(seq[i].f), t: ptLabel(seq[i].t), d: seq[i].d });
      }
      var ev = { k: 'move', p: player, moves: moves };
      if (typeof think === 'number') ev.think = Math.round(think);
      pushEvent(ev);
    },

    // Tour passé (impossible de jouer). reason : 'bar-blocked' | 'no-move'…
    pass: function (player, reason) {
      pushEvent({ k: 'pass', p: player, reason: reason || 'no-move' });
    },

    // Action de cube. ev : 'offer' | 'take' | 'drop'. by : joueur concerné.
    cube: function (ev, by, fromVal, toVal) {
      var e = { k: 'cube', ev: ev, by: by };
      if (typeof fromVal === 'number') e.from = fromVal;
      if (typeof toVal === 'number') e.to = toVal;
      pushEvent(e);
    },

    // Finalise et PERSISTE la partie. result : {winner,type,cube,points}.
    // Idempotent : un 2e appel sur la même partie est ignoré.
    endGame: function (result) {
      if (!current || current.result) return current;
      current.result    = result || null;
      current.endedAt   = new Date().toISOString();
      current.durationMs = nowMs();
      var all = loadAll();
      all.push(current);
      if (all.length > MAX_GAMES) all = all.slice(all.length - MAX_GAMES);
      saveAll(all);
      var done = current;
      current = null;
      return done;
    },

    // ── Accès / export ────────────────────────────────────────────────────
    current:    function () { return current; },
    all:        function () { return loadAll(); },
    count:      function () { return loadAll().length; },
    exportJSON: function () { return JSON.stringify(loadAll(), null, 2); },
    clear:      function () { saveAll([]); return 0; },

    // Télécharge toutes les parties stockées sous forme de fichier .json.
    download: function (filename) {
      var data = this.exportJSON();
      if (typeof document === 'undefined' || typeof Blob === 'undefined') return data;
      var blob = new Blob([data], { type: 'application/json' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url;
      a.download = filename ||
        ('devanture_gamelogs_' + new Date().toISOString().slice(0, 10) + '.json');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return this.count() + ' partie(s) exportée(s)';
    },
  };

  global.GameLog = GameLog;

  try {
    if (global.console && global.console.log) {
      global.console.log(
        '%cGameLog v1 prêt — ' + GameLog.count() +
        ' partie(s) stockée(s). GameLog.download() pour exporter.',
        'color:#6cf');
    }
  } catch (e) {}

})(typeof window !== 'undefined' ? window : this);
