# GOMMAN Accessible — Document de conception (v0.3)

> Exploration locale — **rien n'est poussé sur GitHub**. Document vivant,
> consolidé au fil des intuitions présentées en session (2026-06-11).
> Base de travail : la skin devanture (« GOMMAN »), https://jpep.github.io/lumpzammon/devanture/

## 1. But et cadre

Rendre le backgammon GOMMAN jouable par des personnes malvoyantes et aveugles,
**sans version dégradée** : l'accessibilité comme une autre mise en scène du
même jeu, avec la même exigence de beauté (principe fondateur du projet : le
jeu n'a délibérément aucun son aujourd'hui plutôt qu'un son médiocre par
défaut).

Publics et canaux :
- **Malvoyants** : vision résiduelle réelle (flux, mouvement, masses, contrastes
  perçus même flous) → canal visuel repensé (focales, couleurs, jetons) + son.
- **Aveugles** : canal sonore complet (grammaire sonore + voix) + entrée clavier.
- Effet « bateau de trottoir » : la grammaire sonore peut devenir l'identité
  sonore du jeu pour tous (PLAN.md Phase 2 réclame déjà des effets sonores,
  jamais cochés).

## 2. Principes directeurs

1. **Du sens ou rien** — aucun son, aucune couleur, aucun mouvement décoratif
   dans le mode accessible : chaque signal encode une information.
2. **Redondance des canaux** — son + voix ensemble au début ; la voix se
   débraye quand l'oreille est éduquée (réglage de verbosité). Jamais de
   décodage pur imposé à un débutant. La couleur ne porte jamais un sens seule
   (daltonisme) : toujours doublée par forme, position ou texte/chiffre.
3. **Stabilité des mappings** — ce qui porte du sens ne varie jamais
   (hauteurs de notes fixes, couleurs de jans fixes, sens de traversée fixes).
   La variété esthétique par match passe par l'ambiance, pas par la sémantique.
4. **Chunking** — peu de règles, fixes, rythmées : le cerveau apprend des
   motifs (sons, trajectoires) comme des mots, pas des lettres.
5. **Les canaux parlent la même langue** — le numéro de point affiché en grand
   est celui que la voix prononce ; le son de frappe accompagne l'arrachement
   visuel vers le haut.

## 3. Pilier 1 — La grammaire sonore

### 3.1 Partition vs interprètes
- La **partition** : quelles notes, quels intervalles, quelle syntaxe, quel
  rythme. Définie et validée d'abord, avec des sons de synthèse jetables
  (WebAudio, zéro asset).
- Les **interprètes** : à terme, sons d'instruments enregistrés par des
  musiciens professionnels. Remplacement de timbre sans toucher la grammaire
  (banque de sons substituable).

### 3.2 Le lancer de dés (intuition fondatrice)
Syntaxe fixe, toujours le même rythme :

    [roulement] → [note du dé 1] → [note du dé 2]

- Valeurs 1–6 = **six notes fixes d'une gamme** (majeure = repères familiers ;
  pentatonique = toutes les paires consonantes — à trancher à l'oreille).
- Chaque lancer = un motif à deux notes (un intervalle). Un double = la même
  note répétée, naturellement saillant + petite fioriture (un double = 4 coups).
- **Timbre = joueur** : même gamme, instrument différent par joueur.
- **Opening roll audible** : blanc lance (sa note, son timbre), noir lance
  (sa note, son timbre) — *la note la plus haute gagne*, le résultat s'entend
  sans un mot. Se cale sur la chorégraphie existante (~2,2 s par joueur).

### 3.3 Extension aux autres événements (à spécifier)
Signatures distinctes : déplacement, frappe (hit), rentrée de barre, sortie
(bear off), « aucun coup possible », changement de tour, videau, fin de partie,
alertes timer. Le son d'attaque (« préfixe ») annonce la catégorie, comme le
roulement annonce les dés.

### 3.4 Garde-fous
- Voix redondante au début ; réglage de verbosité ; touche « répéter » toujours
  disponible.
- « Entraîneur » dans le menu : appuyer sur 1–6 pour entendre chaque note
  (standard des jeux audio).
- Hauteurs fixes pour toujours — résister à la transposition par match.

## 4. Pilier 2 — La scène-jan et la grammaire spatiale

### 4.1 Deux focales (plan large / gros plan)
- **Plan large** : plateau entier — gestalt, flux, masses. La basse vision y
  perçoit la direction et l'accumulation, surtout avec les jetons unifiés
  (pilier 3) qui réduisent le fouillis.
- **Gros plan (scène-jan)** : un seul jan affiché, plein écran — triangles ~4×
  plus grands, pions comptables. C'est la vue d'action.
- Bascule : suivi automatique de l'action + navigation manuelle (parcourir les
  4 jans, touche « maison » = jan intérieur). Coupes franches plutôt que
  panoramiques (les pans rapides sont pénibles en basse vision) ; pano lent en
  option.

### 4.2 Théâtre fixe, pièces voyageuses
La scène ne défile pas : **ce sont les fiches qui traversent**. Le changement
de jan est une conséquence : la fiche sort par un bord → coupe → elle entre
par le bord opposé de la scène suivante.

### 4.3 Grammaire des bords (chaque bord = un seul sens)
- **Horizontal = la course.** Mes pièces traversent toujours de droite à
  gauche (entrent à droite, sortent à gauche) ; celles de l'adversaire
  toujours de gauche à droite. → *La direction seule identifie l'acteur*,
  même perçue floue.
- **Vertical = la barre.** Frappe : la pièce est arrachée vers le haut (sort
  par le haut). Rentrée de barre : elle descend depuis le haut dans le jan
  intérieur adverse, puis reprend la course.
- **Ligne d'arrivée.** Le bear off = franchir le bord gauche du jan intérieur
  (continuation naturelle de la course). Le bord bas reste vierge.
- Longs trajets (doubles) = relais de traversées. (Ancêtre dans le code : la
  « vague directionnelle » du mode Learn.)

### 4.4 Les 4 couleurs de jans et le halo-leitmotiv
- Une couleur fixe par jan (4 repères, une géographie qu'on apprend).
  Dans un jan, les 6 triangles alternent deux nuances de la même teinte.
- **Le halo de la pièce porte la couleur de sa destination** : il bascule
  (cross-fade, ex. rouge → vert) pendant le déplacement — il *annonce* la
  scène suivante avant la coupe. Continuité chromatique à la place de la
  continuité spatiale.
- Penchant actuel : couleurs **relatives au joueur** (mon jan intérieur a
  toujours la même couleur) pour les modes vs IA / en ligne. Cas hot-seat à
  trancher (fourche ouverte §6).

### 4.5 La boussole (contexte global en gros plan)
Bandeau de 4 blocs aux couleurs des jans, chacun avec deux grands chiffres
(mes pions / les siens), cliquable pour sauter de vue. Complété par le canal
sonore : la narration dit ce qui se passe hors-champ (« blot exposé dans le
jan vert »).

### 4.6 Lieux spéciaux
- La **barre** : un « lieu » à part entière, avec identité visuelle propre,
  accessible dans la navigation.
- La **zone de sortie** : accrochée à la vue du jan intérieur (derrière la
  ligne d'arrivée).
- Dés + tour : toujours à l'écran, en très grand, dans toutes les vues.

## 5. Pilier 3 — Les jetons sémantiques (fiches unifiées)

Compression sémantique : représenter une pile par **un seul jeton** qui montre
le *sens* plutôt que le décompte — la lecture experte du jeu :
- 1 pion = **blot** (vulnérable) → traitement vraiment distinctif, c'est
  l'information de sécurité binaire du jeu.
- 2+ = point fait (imprenable), 3+ = réserves.

Encodage (fourche ouverte, à départager par prototype) :
- **Préconisé** : forme/taille — jeton allongé dont la hauteur croît avec
  l'effectif, segments internes pour le compte exact, chiffre en option.
  Deux familles de jetons, une par joueur. La couleur reste réservée aux
  canaux « qui » (joueur) et « où » (jan).
- **Variante d'origine à tester** : une couleur par effectif (2, 3, 4…),
  déclinée par joueur. Risque identifié : surcharge du canal couleur.

Note technique : `mockState.points` stocke déjà un nombre signé par flèche —
le jeton unique est plus proche de la donnée que l'empilement actuel de
cercles. Ancêtres dans le code : labels « +N » d'overflow, `drawCheckerLabel`,
glyphes nortechico sur pions.

## 6. Fourches ouvertes (décisions à prendre)

1. Couleurs de jans : relatives au joueur vs absolues (et le cas hot-seat).
2. Jetons : forme/segments vs couleur-par-effectif (prototype comparatif).
3. Transitions : coupe franche vs pano lent (réglage ?).
4. Annonces : quoi en automatique, quoi à la demande ; ordre des dés annoncés
   (ordre du lancer vs le plus fort d'abord).
5. Langue de la voix : FR / EN / réglage (UI actuelle en anglais,
   `lang="fr"` dans le HTML).
6. Timers en mode accessible : désactivés (comme Learn) ou étendus.
7. Gamme : majeure vs pentatonique (à l'oreille).
8. Navigation clavier complète (grammaire de saisie d'un coup) — non spécifiée
   encore, primitives prêtes (`getRealTargets`, `applyRealMove`).
9. Compatibilité lecteur d'écran : miroir `aria-live` des annonces (gratuit,
   à confirmer).

## 7. Existant technique mobilisable (skin devanture)

- `adapter.js` = goulot unique des événements (~10 points d'ancrage :
  `rollAndStart`, `applyRealMove`, `endTurn`, `finalizeMoveStep`,
  `playAITurn` (détecte déjà les hits), opening roll, modals videau, timers).
- Primitives prêtes pour le clavier : `getRealTargets(from)`,
  `applyRealMove(from, to)` (séquences multi-dés comprises).
- **Mode Learn = précédent clé** : messages textuels contextuels
  (`showLearnTip`), suggestions de coups (`getLearnSuggestion`), timers
  désactivés, vague directionnelle (`startLearnDirectionAnim`).
- Page HTML normale autour du canvas (inputs DOM au sign-in) → zone
  `aria-live` facile à ajouter.
- Dev sans Docker/npm : `python serve.py 3132 devanture`.
- Obstacles connus : aucune entrée clavier de jeu (tout est drag & drop),
  timers 15 s/coup hostiles, chorégraphies purement visuelles à doubler,
  `user-scalable=no` (zoom bloqué — pénalise les malvoyants),
  palette dérivée du fond (prévoir palette haut contraste).

## 8. Prochaines étapes candidates (quand on décidera de prototyper)

1. **Prototype sonore** (~1 h) : entendre un 6-3, un double 4, un opening roll
   — gamme majeure vs pentatonique, WebAudio pur, page standalone.
2. **Maquette scène-jan** standalone (culture du projet : devanture est née
   ainsi à côté de l'app React) : un jan plein écran, jetons sémantiques,
   une traversée avec halo-leitmotiv et coupe.
3. **Clavier minimal** sur la skin réelle : choisir une source, entendre les
   destinations, jouer le coup (via les primitives de l'adapter).

---
*v0.1 : grammaire sonore (dés). v0.2 : scène-jan, halo, boussole.
v0.3 : focales plan large/gros plan, grammaire des bords, jetons sémantiques,
partition/interprètes.*
