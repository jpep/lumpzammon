// sounds.js — Effets sonores "pigeon" pour les dés (autonome, expose window.Sfx).
//
//   • battement d'ailes  = le LANCER de dés (4 variations, tirées au hasard)
//   • roucoulement (coo)  = identifie le CHIFFRE de chaque dé (1 coo par valeur)
//
// Lecture via HTML5 Audio (pas de p5.sound). cloneNode() permet de superposer
// plusieurs lectures. coo5/coo6 sont pour l'instant des PRISES ALTERNATIVES
// (placeholders) — à remplacer par les vrais roucoulements #5/#6 quand fournis.
// L'autoplay navigateur est OK car un dé n'est lancé qu'après une interaction.
(function (global) {
  'use strict';

  var BASE = 'sounds/';
  var enabled = true;

  function load(name) {
    try { var a = new Audio(BASE + name); a.preload = 'auto'; return a; }
    catch (e) { return null; }
  }

  var wings = [load('wing1.wav'), load('wing2.wav'), load('wing3.wav'), load('wing4.wav')];
  var coos  = { 1: load('coo1.wav'), 2: load('coo2.wav'), 3: load('coo3.wav'),
                4: load('coo4.wav'), 5: load('coo5.wav'), 6: load('coo6.wav') };

  function play(a, vol) {
    if (!enabled || !a) return;
    try {
      var n = a.cloneNode();          // copie → lectures superposables
      n.volume = (vol == null) ? 0.7 : vol;
      var p = n.play();               // TIMBRE NATUREL (pas de playbackRate)
      if (p && p.catch) p.catch(function () {});   // ignore les refus d'autoplay
    } catch (e) {}
  }

  var Sfx = {
    // ── Coordination (réglable en live : ex. Sfx.LEAD_MS = 250) ───────────────
    // Dés inchangés, sons NATURELS. L'aile démarre au DÉBUT DU TOUR ; le jet des
    // dés (visuel + roucoulements) suit après LEAD_MS (le « juste milieu »).
    LEAD_MS:       300,   // délai entre l'aile (début du tour) et le jet des dés
    COO1_DELAY_MS: 120,   // délai du 1er roucoulement après le jet
    COO_GAP_MS:    700,   // écart entre les 2 roucoulements (distinction des chiffres)

    setEnabled: function (b) { enabled = !!b; },
    isEnabled:  function () { return enabled; },

    // Le lancer : un battement d'ailes (timbre naturel).
    wing: function () { play(wings[Math.floor(Math.random() * wings.length)], 0.6); },
    // Un roucoulement pour une valeur (1-6), timbre naturel.
    coo: function (v) { play(coos[v], 0.85); },

    // Au JET des dés : 1 roucoulement par dé, séquencés (l'aile est jouée à part,
    // dès le début du tour, par l'appelant).
    diceCoos: function (v1, v2) {
      var self = this;
      var hasV2 = (typeof v2 === 'number' && v2 >= 1 && v2 <= 6);
      if (v1 >= 1 && v1 <= 6) setTimeout(function () { self.coo(v1); }, this.COO1_DELAY_MS);
      if (hasV2) setTimeout(function () { self.coo(v2); }, this.COO1_DELAY_MS + this.COO_GAP_MS);
    },
  };

  global.Sfx = Sfx;
})(typeof window !== 'undefined' ? window : this);
