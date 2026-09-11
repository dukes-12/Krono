'use strict';
/* Mesure la vraie hauteur visible via JS plutôt que de faire confiance à
   une unité CSS : window.innerHeight est toujours exact, quel que soit
   le moteur (Safari, WebView, navigateur avec sa propre barre d'outils).
   Posée tout en haut du script pour être en place avant le premier
   rendu — un flash d'une frame sans elle vaudrait mieux qu'un blanc
   permanent, mais autant l'éviter. Recalculée au redimensionnement et à
   la rotation, où la barre d'outils mobile change le plus souvent. */
function majHauteurReelle(){
  document.documentElement.style.setProperty('--vh100', window.innerHeight + 'px');
}
majHauteurReelle();
window.addEventListener('resize', majHauteurReelle);
window.addEventListener('orientationchange', () => setTimeout(majHauteurReelle, 120));
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', majHauteurReelle);
}

/* ═══════════════════════════════════════════════════════════════
   DÉFILEMENT — le document est la surface de défilement
   ═══════════════════════════════════════════════════════════════
   L'app tenait auparavant dans un viewport figé (body en
   overflow:hidden, un scroller interne par écran). Confortable à
   écrire, mais Safari sur iPhone n'écoute que le scroller racine :
   sans lui, la barre d'adresse ne se rétracte jamais et mange une
   quarantaine de pixels en permanence. La page défile donc de nouveau
   normalement, jusqu'à un vrai pied de page.

   Deux situations veulent malgré tout un fond immobile : l'écran de
   jeu, dont la mise en page dépend d'une hauteur exacte et où un
   glissement du doigt ne doit jamais faire bouger le chrono, et les
   modales, sous lesquelles le contenu ne doit pas filer. D'où ce gel,
   compté par raison : plusieurs causes peuvent se superposer (une
   modale ouverte pendant une partie) sans que la première levée ne
   dégèle trop tôt. La position est mémorisée puis restituée, sinon
   position:fixed renverrait la page en haut à chaque dégel.          */
const GELS = new Set();
let scrollGele = 0;

function gelerFond(raison, actif){
  const b = document.body, avant = GELS.size;
  if(actif) GELS.add(raison); else GELS.delete(raison);
  if(!avant && GELS.size){
    scrollGele = window.scrollY || window.pageYOffset || 0;
    b.style.setProperty('--gel-y', (-scrollGele) + 'px');
    b.classList.add('fige');
  } else if(avant && !GELS.size){
    b.classList.remove('fige');
    b.style.removeProperty('--gel-y');
    window.scrollTo(0, scrollGele);
  }
}

/* Les écrans qui gardent un viewport figé : le jeu solo/soirée, dont la
   mise en page répartit chrono, badges et bandeaux sur une hauteur connue
   au pixel près, et le Duo local, où deux moitiés d'écran se partagent
   cette même hauteur. Dans les deux cas, un glissement du doigt serait
   pris pour un appui. Tous les autres écrans, résultat et fin de partie
   compris, défilent normalement. */
const ECRANS_FIGES = new Set(['fluide', 'duo']);

/* Changer d'écran, c'est arriver en haut du nouvel écran : sans ça on
   hériterait de la position de défilement du précédent, au milieu de
   nulle part. 'instant' plutôt que le scroll-behavior:smooth du
   document, qu'on ne veut que pour les ancres. */
function hautDePage(){
  try{ window.scrollTo({ top:0, left:0, behavior:'instant' }); }
  catch(e){ window.scrollTo(0, 0); }
}

/* En-tête condensé : dès que la page a bougé de quelques pixels, le
   titre se resserre et le filet se pose. Passif et sans lecture de mise
   en page — scrollY seul, comparé à un seuil — pour ne rien coûter au
   défilement. */
addEventListener('scroll', () => {
  const bas = (window.scrollY || window.pageYOffset || 0) > 18;
  document.body.classList.toggle('defile', bas);
}, { passive:true });

/* Les surcouches plein écran (confirmation, réglages rapides) sont
   ouvertes et fermées depuis une douzaine d'endroits. Plutôt que de
   poser un gel à chacun — et d'en oublier un le jour où un dialogue
   s'ajoute — on observe la classe qui les affiche. Une seule source de
   vérité, impossible à désynchroniser. */
addEventListener('DOMContentLoaded', () => {
  const couches = ['modale', 'panneau-reg'].map(id => document.getElementById(id))
                                           .filter(Boolean);
  if(!couches.length) return;
  const obs = new MutationObserver(() => {
    gelerFond('couche', couches.some(c => c.classList.contains('on')));
  });
  couches.forEach(c => obs.observe(c, { attributes:true, attributeFilter:['class'] }));
});

// Verrou d'orientation, en complément du garde-fou CSS (#garde-rotation) :
// ne fonctionne qu'en mode installé/plein écran sur les navigateurs qui
// exposent l'API (surtout Android) — silencieux partout ailleurs (iOS ne
// l'expose pas du tout, un onglet normal la refuse). C'est pour ça que le
// panneau CSS reste la vraie garantie, celle-ci n'est qu'un bonus.
function verrouillerOrientation(){
  try{ screen.orientation && screen.orientation.lock
    && screen.orientation.lock('portrait').catch(() => {}); }catch(e){}
}
verrouillerOrientation();
addEventListener('DOMContentLoaded', verrouillerOrientation);

// Fonction sécurisée pour envoyer des événements à GA4
function trackEvent(eventName, eventParams = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, eventParams);
  } else {
    console.warn(`GA bloqué, événement ignoré : ${eventName}`, eventParams);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MODE EN LIGNE — clés du projet Supabase.
   La clé ci-dessous est la clé « anon public » : elle est destinée à
   figurer dans le code visible, ce sont les règles RLS de la base qui
   protègent les données. Ne jamais y mettre la clé « service_role ».
   Vider ces deux valeurs désactive entièrement le mode en ligne.
   ═══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://qnjcufneugvggrtcgmzw.supabase.co';
// L'adresse publique de l'app : Google y renvoie l'utilisateur après connexion.
// Calculée au moment du clic plutôt que figée : sinon un test depuis
// test-krono.kronogame.workers.dev renverrait quand même vers la production.
// L'adresse obtenue doit être listée dans « Authorized JavaScript origins »
// côté Google ET dans Supabase → Authentication → URL Configuration →
// Redirect URLs — pour la prod ET pour l'adresse de test, chacune une fois.
const siteUrl = () => location.origin + location.pathname;
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuamN1Zm5ldWd2Z2dydGNnbXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODE1MTcsImV4cCI6MjEwMTI1NzUxN30.Tjj_l-JJJ__VoLM-kVn6Z21RmdMCw9wbmi4fON5qS7g';

/* ════════ RÉGLAGES ════════ */
const CFG = { aff:'visible', diff:'simple', gor:'bar',
              evts:'aucun', maxTours:20, horo:true, pariBlind:false,
              mode:'classique', da:'casino', lat:'materiel', minutes:false,
  sv:{paliers:true, pari:false, son:true, vibr:true, anim:true,
      evenements:false, musique:true, biomes:true, triche:false, intro:'cine',
      ambiance:true, bloquer:true, fonds:true, flouOcean:false} };
const SAUF = { visible:{simple:35, hard:20}, aveugle:{simple:40, hard:30} };
const RATE = { bar:3, appart:3, gros:4 };
const PRES = 3, RANGE = 50, JB = 25;
const ZONE_DEPART_SURVIE = 30;
// Le plafond ne bouge pas avant le tour 60 : les longues parties restent
// possibles, mais elles finissent par se refermer.
const PILES_PAR_PALIER_PLAFOND = 5;   // tous les 5 piles, le plafond monte de
const BONUS_PLAFOND = 5;              // cinq centièmes, sans jamais redescendre
const BONUS_PLAFOND_MAX = 40;         // borne : au plus +0,40 sur une partie
function bonusPlafondPiles(){
  const piles = (S && S.pilesSurvie) || 0;
  return Math.min(BONUS_PLAFOND_MAX,
    Math.floor(piles / PILES_PAR_PALIER_PLAFOND) * BONUS_PLAFOND);
}
function plafondSurvie(tour){
  const base = tour >= 100 ? 35 : tour >= 60 ? 40 : 50;
  // l'Aurore relève le plafond : c'est le palier de récompense
  const b = CFG.mode === 'survie' && CFG.sv && CFG.sv.biomes ? biomeDe(tour) : null;
  return base + ((b && b.eff && b.eff.plafond) || 0) + bonusPlafondPiles();
}
const ZONE_MAX_SURVIE = 50;          // valeur de référence pour l'anneau
const ZONE_CRITIQUE = 8;             // en dessous, l'écran change de registre
const PALIER_SURVIE = 10;            // un palier tous les dix tours
const VIES_MAX_SURVIE = 1;
const viesMax = () => effB('vies') || VIES_MAX_SURVIE;
// Survie : on commente le terrain gagné ou perdu, avec assez de variantes
// pour que ça ne devienne pas un bruit de fond.
const GAINS = {
  gros:  ["Tu agrandis la zone de {n} centièmes !",
          "Superbe · {n} centièmes repris d'un coup",
          "La zone respire · +{n} centièmes",
          "Du terrain gagné · +{n} centièmes"],
  petit: ["Bien vu · +{n} centièmes",
          "Ça remonte · +{n} centièmes",
          "Tu grappilles {n} centièmes",
          "Un peu d'air · +{n} centièmes"],
  stable:["Tu tiens, sans plus",
          "Ni gagné ni perdu, ou presque",
          "Le terrain reste à peu près",
          "Statu quo"],
  perte: ["Aïe · encore {n} centièmes de perdus",
          "Ça se resserre · −{n} centièmes",
          "Tu perds du terrain · −{n} centièmes",
          "La zone se referme · −{n} centièmes",
          "Attention · {n} centièmes en moins"]
};
function phraseGain(delta){
  const L = delta >= 5 ? GAINS.gros : delta > 0 ? GAINS.petit
          : delta === 0 ? GAINS.stable : GAINS.perte;
  return L[Math.floor(Math.random() * L.length)].replace('{n}', Math.abs(delta));
}   // plafond affiché ET appliqué : les deux doivent coïncider
const zoneBase = () => SAUF[CFG.aff][CFG.diff];
const zone = () => S.zoneTour || zoneBase();

/* couleur propre à chaque joueur, stable toute la partie */
const COULEURS = ['#E8C15A','#E8735A','#6BC49A','#7FA8E8','#C88AE8','#E8A0C0',
                  '#9BD45A','#5AC8D8','#E8945A','#A0A8E8','#D8CDB0','#8FD8C8'];
const coul = i => COULEURS[((i % COULEURS.length) + COULEURS.length) % COULEURS.length];
const hexA = (hex, a) => { const n = parseInt(hex.slice(1),16);
  return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
// quatre habillages possibles, choisis dans l'onglet test
// cartouche : contour à la couleur du joueur, fond très légèrement teinté
function surligner(el, c){
  el.classList.add('pilule');
  el.style.color = c;
  el.style.borderColor = c;
  el.style.background = hexA(c, .07);
}
// la couleur est attribuée une fois pour toutes : insérer un joueur en cours
// de partie ne doit pas repeindre toute la table
const coulNom = n => {
  const p = MEM.profil;
  // le joueur principal garde la couleur choisie dans son profil
  if(p && p.couleur && (n === p.pseudo || (estSolo(CFG.mode) && n === S.joueurs[0])))
    return p.couleur;
  return (S.couleurs && S.couleurs[n]) || coul(Math.max(0, S.joueurs.indexOf(n)));
};
function couleurLibre(){
  const prises = new Set(Object.values(S.couleurs || {}));
  for(let i = 0; i < COULEURS.length; i++) if(!prises.has(coul(i))) return coul(i);
  return coul(Object.keys(S.couleurs || {}).length);
}

/* ════════ MODES DE JEU ════════ */
const MODES = [
  {id:'classique', n:'Classique',
   d:"Le barème habituel, chacun pour soi."},
  {id:'blind', n:'Blind',
   d:"Cible aléatoire (1 à 10s), chrono caché. La zone et les gorgées s'adaptent à la durée."},
  {id:'enchere', n:"L'enchère", test:1,
   d:"Annoncer la précision qu'on vise avant de lancer."},
  {id:'elimination', n:'Élimination', test:1,
   d:"Trois sorties de zone et l'on quitte la table."},
  {id:'handicap', n:'Handicap', test:1,
   d:"La zone s'adapte au niveau de chacun."},
  {id:'coop', n:'Coopératif', test:1,
   d:"La table partage trois vies et vise 30 secondes."},
  {id:'compte', n:'Le compte est bon', test:1,
   d:"Atteindre exactement 20,00 s en dix tours."}
];
const MODE = () => MODES.find(m => m.id === CFG.mode) || MODES[0];
const ENCHERES = [
  {seuil:20, n:2, label:'Prudent · ± 0,20'},
  {seuil:10, n:3, label:'Normal · ± 0,10'},
  {seuil:5,  n:5, label:'Audacieux · ± 0,05'}
];

/* ════════ MODES SOLO ════════ */
// Chaque mode solo décrit sa cible, sa condition de fin et son barème.
// « seul » les distingue des modes de soirée dans l'interface.
const SOLOS = [
  {id:'solo', n:'Solo classique', tours:10, fam:'score',
   regle:"Dix cibles, chacune sur une seconde pleine. Un pile vaut 100 points, un écart de 3 centièmes ou moins en vaut 50, rester dans la zone en vaut 20.",
   astuce:"Enchaîner des piles multiplie les points : le deuxième vaut double, le troisième triple, jusqu'à cinq.",
   d:"Dix cibles, des points, des piles à enchaîner."},

  {id:'defi', n:'Défi du jour', tours:0, fam:'defi',
   regle:"Un objectif unique, le même pour tout le monde, tiré de la date du jour. Trois tentatives par jour, pas une de plus : c'est la meilleure qui compte.",
   astuce:"Le défi change chaque nuit. Rien ne sert de relancer au-delà de trois essais, la consigne restera la même jusqu'à demain.",
   d:"Un objectif pour tous, renouvelé chaque jour."},

  {id:'survie', n:'Survie', tours:0, fam:'survie',
   regle:"La zone sûre rétrécit à chaque tour, de plus en plus vite. Une sortie met fin à la partie, sauf si vous avez gagné une vie. Le score est le nombre de tours tenus.",
   astuce:"Un pile élargit la zone de 4 centièmes, un écart de 3 centièmes ou moins de 3 — et dans les deux cas l'usure du tour est annulée. Deux bons coups d'affilée majorent le gain de moitié, trois le doublent. Trois piles au total, ou deux d'affilée, offrent une vie de rattrapage.",
   d:"La zone rétrécit. Une sortie et c'est fini."},

  {id:'escalier', n:"L'escalier", tours:0, fam:'escalier', desactive:1,
   regle:"Les cibles s'allongent : 1 s, puis 1,5 s, puis 2 s. Rester dans la zone fait monter d'une marche, la rater fait redescendre. Trois chutes et la partie s'arrête.",
   astuce:"La zone se resserre aussi en montant. Le score est la marche la plus haute atteinte.",
   d:"Des cibles de plus en plus longues."},

  {id:'sprint', n:'Contre-la-montre', tours:0, fam:'sprint', desactive:1,
   regle:"Trente secondes au compteur réel. Chaque cible fait une seconde. Enchaînez-en le plus possible : le décompte ne s'arrête jamais.",
   astuce:"Le temps entre deux tours compte aussi. Hésiter coûte une cible.",
   d:"Trente secondes pour enchaîner un maximum de cibles."},

  {id:'nues', n:'Décimales', tours:10, fam:'score',
   regle:"Les cibles ne tombent plus sur des secondes rondes : 2,41 s, 3,78 s. Compter dans sa tête ne sert plus à rien.",
   astuce:"Les points valent double, la difficulté n'a rien de comparable.",
   d:"Des cibles non rondes. Compter ne sert plus."},

  {id:'solo2', n:'Solo · enchaîné', tours:10, fam:'score', desactive:1,
   regle:"Comme le solo classique, mais les frôlements s'enchaînent : le premier vaut 50, le deuxième 60, le troisième 70, et ainsi de suite.",
   astuce:"Les piles gardent leur multiplicateur. Un tour hors zone remet les deux compteurs à zéro.",
   d:"Variante : les frôlements s'enchaînent aussi."},

  {id:'combat', n:'Combat', tours:0, fam:'combat',
   regle:"Un adversaire ouvre sa garde à un instant précis. Frapper dans la fenêtre lui inflige des dégâts, frapper à côté vous en fait subir. Le premier à zéro perd.",
   astuce:"Toucher au centre exact de la garde double les dégâts. Trois coups encaissés et l'adversaire resserre sa garde pour le reste du combat.",
   d:"Frapper dans la garde d'un adversaire. Le premier à zéro perd."},

  {id:'reflexe', n:'Réflexe', tours:10, fam:'reflexe',
   regle:"Le bouton d'arrêt apparaît à un endroit imprévisible de l'écran, entre 0,25 et 2 secondes après le départ. Touchez-le le plus vite possible.",
   astuce:"Dix manches. Sur un écran tactile, l'affichage ajoute 30 à 60 ms : sous 300 ms, c'est déjà exceptionnel.",
   d:"Le bouton surgit au hasard. Vitesse pure."}
];
SOLOS.push({id:'aventure', n:'Aventure', tours:0, fam:'aventure', test:1,
  regle:"Le même chemin que la Survie, mais une autre économie. Les décors ne "
    + "donnent plus rien : il ne reste que leurs malus. Chaque cible touchée "
    + "rapporte de l'expérience, et un frôlement annule l'usure du tour. Tous "
    + "les dix-huit pas, un gardien barre la route.",
  astuce:"L'expérience se garde entre les parties et s'achète en armes et en "
    + "armure : l'arme accélère les gardiens et majore tous les gains, "
    + "l'armure élargit la zone de départ. Perdre ne fait rien perdre.",
  d:"Aventure · expérience, armes, armures et gardiens."});
const estSolo = id => SOLOS.some(s => s.id === id);
const SOLO = () => SOLOS.find(s => s.id === CFG.mode);

/* ════════ LABORATOIRE · DIX MODES ════════ */
// Dix mécaniques proposées, implémentées sans aucun décor : l'objectif est de
// juger le geste, pas l'habillage. Chaque mode se décrit entièrement dans cette
// table et se branche sur le moteur par sept points seulement — cibleSuivante,
// zoneDe, partieFinie, resoudre, afficherFin, boucleChiffres et arreter.
// Aucun d'eux n'apparaît dans le menu : ils vivent dans l'onglet Test.

// Trois cadrans, du plus tolérant au plus sévère, mais aucun n'est hors de
// portée d'une main humaine : sous vingt millièmes, on ne mesure plus que le
// bruit de l'écran tactile. La difficulté vient du budget d'erreurs, pas d'un
// seuil impossible.
const BRAQUAGE = [
  {n:'Le pêne',     ms:2000, tol:60},
  {n:'Le barillet', ms:3500, tol:40},
  {n:'Le coffre',   ms:5000, tol:25}
];
const ALARME_MAX = 3;
const cadranCourant = () =>
  Math.min(BRAQUAGE.length - 1, (S.lab && S.lab.cadran) || 0);
const MAREE = [100,150,200,250,300,250,200,150,100,150,200,250];
// deux modes se jouent sans jamais arrêter le chrono : chaque appui est un tour
const ENCHAINES = {cascade:{n:10, pas:100}};
const REMISE_A_ZERO = ['nues','braquage','sniper','cascade','blind'];
// Aventure : seul un combat (gardien ou monstre) repart de zéro visuellement,
// jamais un tour de marche normal — d'où ce helper séparé plutôt qu'un ajout
// de 'aventure' à REMISE_A_ZERO, qui s'applique à chaque tour sans distinction.
const remiseAZero = () => REMISE_A_ZERO.includes(CFG.mode)
  || (AVT() && S.avt && S.avt.enCombat);

const moyEcarts = () => {
  const L = S.ecarts || [];
  return L.length ? L.reduce((a,b) => a+b, 0) / L.length : 0;
};
const ecartType = L => {
  if(L.length < 2) return 0;
  const m = L.reduce((a,b) => a+b, 0) / L.length;
  return Math.sqrt(L.reduce((a,b) => a + (b-m)*(b-m), 0) / L.length);
};
const coulEcart = (e, a, b, c) =>
  e === 0 ? 't-s100' : e <= a ? 't-s50' : e <= b ? 't-s20' : e <= c ? 't-vert' : 't-s0';
const signe = d => d > 0 ? '+' : d < 0 ? '−' : '±';
// millièmes : le braquage et le sniper se jouent sous le centième
const fmtMs = ms => (ms/1000).toFixed(3).replace('.', ',');

// ════════ CASCADE · CALCUL DES POINTS ════════
// Source unique du score de Cascade, réutilisée par tour() (en direct) et
// fin() (récapitulatif). Le détail du barème est dans CALCUL-CASCADE.md.
//
// Chaque appui vaut des points selon sa précision : parfait (±3 c) 100,
// dégressif jusqu'à 0 au-delà d'un dixième et demi. Une série d'appuis
// parfaits consécutifs applique un multiplicateur croissant, ce qui
// récompense la régularité bien plus qu'un unique coup chanceux. À la fin,
// deux primes : régularité (faible dispersion) et sans-faute (aucun appui
// au-delà d'un dixième).
function scoreCascade(ecarts){
  const POINT_MAX = 100;      // un appui parfait
  const TOL = 15;             // au-delà de ±0,15 s, l'appui ne rapporte rien
  const PARFAIT = 3;          // ±0,03 s : le seuil du « parfait » qui nourrit la série
  let brut = 0, serie = 0, meilleureSerie = 0;
  ecarts.forEach(e => {
    // points de base : linéaire de POINT_MAX (écart nul) à 0 (écart ≥ TOL)
    const base = Math.max(0, Math.round(POINT_MAX * (1 - e / TOL)));
    if(e <= PARFAIT){
      serie++;
      meilleureSerie = Math.max(meilleureSerie, serie);
    } else {
      serie = 0;
    }
    // multiplicateur de série : 1er parfait ×1, puis +0,25 par parfait
    // consécutif, plafonné à ×2,5 (un sans-faute complet)
    const multi = serie > 0 ? Math.min(2.5, 1 + (serie - 1) * 0.25) : 1;
    brut += Math.round(base * multi);
  });
  // primes de fin, seulement sur une partie complète (dix appuis)
  let primeRegularite = 0, primeSansFaute = 0;
  if(ecarts.length >= 10){
    const moy = ecarts.reduce((a,b) => a+b, 0) / ecarts.length;
    const variance = ecarts.reduce((a,b) => a + (b-moy)*(b-moy), 0) / ecarts.length;
    const disp = Math.sqrt(variance);
    // moins de ±0,05 s de dispersion : jusqu'à 300 points — mais seulement si
    // le niveau moyen est correct, sinon « régulièrement mauvais » serait primé
    if(disp < 5 && moy <= 8) primeRegularite = Math.round((5 - disp) / 5 * 300);
    // aucun appui au-delà d'un dixième : 200 points
    if(ecarts.every(e => e <= 10)) primeSansFaute = 200;
  }
  // multiplicateur affiché en direct : celui de la série en cours
  const serieCourante = serie;
  const multiCourant = serie > 0 ? Math.min(2.5, 1 + (serie - 1) * 0.25) : 1;
  return {
    total: brut + primeRegularite + primeSansFaute,
    serieCourante, meilleureSerie,
    multi: multiCourant,
    primeRegularite, primeSansFaute
  };
}

const LABOS = [

/* ─── 1 · Cascade ────────────────────────────────────────────────── */
{id:'cascade', n:'Cascade', tours:10,
 d:"Le chrono tourne dix secondes. Un appui à chaque seconde.",
 regle:"Le chrono part et ne s'arrête plus. Il faut appuyer à chaque seconde "
   + "pleine — 1,00 puis 2,00 puis 3,00 — jusqu'à dix. Aucun écran de repos "
   + "entre deux appuis : c'est un seul geste répété dix fois.",
 astuce:"C'est le tour du chronomètre de l'iPhone. L'erreur ne se rattrape pas : "
   + "un appui en retard laisse le chrono devant, il faut viser la seconde "
   + "suivante, pas compenser.",
 cible:() => ((S.lab.laps || []).length + 1) * 100,
 zone:() => 15,
 tour(c){
   const L = S.lab.laps, ecarts = L.map((v,i) => Math.abs(v - (i+1)*100));
   const r = scoreCascade(ecarts);
   S.points = r.total;
   const dernier = ecarts[ecarts.length - 1];
   return {pts:0, couleur:coulEcart(dernier, 3, 6, 12),
     titre:S.points + ' points',
     sous:'appui ' + L.length + '/10 · ± ' + fmt(dernier)
        + (dernier <= 3 ? ' · parfait' + (r.serieCourante > 1 ? ' ×' + r.serieCourante : '')
           : dernier <= 8 ? ' · bon' : ' · décroché')
        + (r.multi > 1 ? ' · série ×' + r.multi.toFixed(1) : '')};
 },
 fini:() => (S.lab.laps || []).length >= 10,
 fin:() => {
   const L = S.lab.laps || [], e = L.map((v,i) => Math.abs(v - (i+1)*100));
   const r = scoreCascade(e);
   const detail = [];
   if(r.primeRegularite) detail.push('régularité +' + r.primeRegularite);
   if(r.primeSansFaute)  detail.push('sans-faute +' + r.primeSansFaute);
   if(r.meilleureSerie >= 3) detail.push('meilleure série ' + r.meilleureSerie + ' appuis');
   return {t:S.points + ' points',
     r:'Cascade · ' + fmt(e.reduce((a,b)=>a+b,0)) + ' d\'écart cumulé · '
       + (detail.join(' · ') || 'aucune prime'),
     rev:{t:'La dérive', s:L.length
       ? 'Premier appui ± ' + fmt(e[0]) + ', dernier ± ' + fmt(e[e.length-1]) + '. '
         + (e[e.length-1] > e[0] + 5
            ? 'La main dérive : chaque retard s\'ajoute au suivant au lieu d\'être corrigé.'
            : 'La cadence tient jusqu\'au bout, c\'est le plus dur de ce mode.')
       : ''}};
 }},

/* ─── 2 · Le Braquage ────────────────────────────────────────────── */
{id:'braquage', n:'Le Braquage', tours:0,
 d:"Trois cadrans à forcer, trois erreurs avant l'alarme.",
 regle:"Un coffre à trois cadrans, de plus en plus sévères : le pêne demande "
   + "2,000 s à ± 0,060, le barillet 3,500 s à ± 0,040, le coffre 5,000 s à "
   + "± 0,025. Tout se joue à l'aveugle et se mesure au millième. Un cadran "
   + "manqué ne termine rien : on le retente, mais l'alarme monte d'un cran. "
   + "Trois crans et l'on se fait prendre.",
 astuce:"Chaque cadran rapporte d'autant plus qu'on tombe près du centre : "
   + "200 points au bord de la tolérance, 500 en plein milieu. Ouvrir le coffre "
   + "sans déclencher l'alarme une seule fois double presque le score.",
 // le coffre ouvert, cibleSuivante est encore appelée une fois : on borne
 cible:() => Math.round(BRAQUAGE[cadranCourant()].ms / 10),
 zone:() => Math.max(1, Math.round(BRAQUAGE[cadranCourant()].tol / 10)),
 aveugle:true,
 tour(c){
   const cad = BRAQUAGE[S.lab.cadran];
   const dms = Math.round(c.ms) - cad.ms, abs = Math.abs(dms);
   if(abs <= cad.tol){
     // au bord de la tolérance 200 points, au centre exact 500
     const pts = 200 + Math.round((1 - abs / cad.tol) * 300);
     S.points += pts;
     S.lab.cadrans.push({n:cad.n, dms, pts});
     S.lab.cadran++;
     if(S.lab.cadran >= BRAQUAGE.length){
       S.lab.ouvert = true;
       const propre = S.lab.alarme === 0;
       if(propre) S.points += 500;
       return {pts:0, couleur:'t-s100',
         titre:'Le coffre est ouvert',
         sous:propre ? 'sans une seule alarme · prime de 500 · total ' + S.points
                     : S.lab.alarme + ' alarme'
                       + (S.lab.alarme > 1 ? 's' : '') + ' au compteur · total ' + S.points};
     }
     return {pts:0, couleur:abs <= cad.tol / 3 ? 't-s100' : 't-s50',
       titre:cad.n + ' cède · +' + pts,
       sous:signe(dms) + fmtMs(abs) + ' s pour ± ' + fmtMs(cad.tol)
          + ' · au suivant : ' + BRAQUAGE[S.lab.cadran].n.toLowerCase()
          + ' à ± ' + fmtMs(BRAQUAGE[S.lab.cadran].tol)};
   }
   S.lab.alarme++;
   if(S.lab.alarme >= ALARME_MAX) S.mort = true;
   return {pts:0, couleur:'t-signal',
     titre:S.mort ? 'Pris sur le fait' : 'Alarme · cran ' + S.lab.alarme,
     sous:signe(dms) + fmtMs(abs) + ' s pour ± ' + fmtMs(cad.tol)
        + (S.mort ? ' · trois crans, le casse est fini'
                  : ' · ' + (ALARME_MAX - S.lab.alarme) + ' erreur'
                    + (ALARME_MAX - S.lab.alarme > 1 ? 's' : '')
                    + ' avant la fin · on retente ' + cad.n.toLowerCase())};
 },
 fini:() => S.mort === true || S.lab.ouvert === true,
 fin:() => {
   const C = S.lab.cadrans || [];
   return {t:S.lab.ouvert ? 'Coffre ouvert' : C.length + ' cadran'
             + (C.length > 1 ? 's' : '') + ' sur 3',
     r:'Le Braquage · ' + (C.map(x => x.n.toLowerCase() + ' ' + signe(x.dms)
         + fmtMs(Math.abs(x.dms))).join(' · ') || 'aucun cadran forcé')
       + ' · ' + S.lab.alarme + ' alarme' + (S.lab.alarme > 1 ? 's' : '')
       + ' · ' + S.points + ' points',
     rev:{t:'Ce que ça demande', s:S.lab.ouvert
       ? (S.lab.alarme === 0
          ? 'Trois cadrans du premier coup. À ± 0,025 sur cinq secondes, il n\'y a plus de méthode de comptage qui tienne : c\'est de la mémoire de geste.'
          : 'Le coffre s\'ouvre. Les erreurs coûtent des points, pas la partie — c\'est ce qui rend le troisième cadran jouable.')
       : 'Trois erreurs. Le cadran qui bloque se retente autant qu\'on veut dans la limite du budget : mieux vaut viser large et régulier que juste une fois sur trois.'}};
 }},

/* ─── 3 · Le Duel ────────────────────────────────────────────────── */
{id:'duelf', n:'Le Duel', tours:10,
 d:"Face au fantôme de votre meilleure partie, tour par tour.",
 regle:"Dix cibles d'une seconde. À chaque tour, votre écart est comparé à celui "
   + "que vous aviez réalisé au même tour lors de votre meilleure partie. Le "
   + "plus proche de la cible prend le point.",
 astuce:"Sans fantôme enregistré, un adversaire moyen est généré pour la première "
   + "partie. Toute partie gagnée devient le nouveau fantôme.",
 cible:t => t + 100,
 zone:() => 25,
 tour(c){
   const g = S.lab.fantome[S.tour - 1];
   const gagne = c.ecart < g, nul = c.ecart === g;
   if(gagne) S.lab.mesPoints++; else if(!nul) S.lab.sesPoints++;
   S.points = S.lab.mesPoints;
   return {pts:0, couleur:gagne ? 't-s100' : nul ? 't-s20' : 't-s0',
     titre:gagne ? 'Point pour vous' : nul ? 'Égalité' : 'Point pour le fantôme',
     sous:'vous ± ' + fmt(c.ecart) + ' · fantôme ± ' + fmt(g)
        + ' · score ' + S.lab.mesPoints + ' – ' + S.lab.sesPoints};
 },
 fin:() => {
   const m = S.lab.mesPoints, s = S.lab.sesPoints;
   if(m > s){
     const L = MEM.labo = MEM.labo || {};
     L.fantome = (S.ecarts || []).slice(0, 10);
     ecrireMem();
   }
   return {t:m + ' – ' + s,
     r:'Le Duel · ' + (m > s ? 'vous battez votre fantôme, il est remplacé'
       : m === s ? 'match nul, le fantôme reste en place'
       : 'le fantôme tient bon') + ' · écart moyen ± ' + fmt(Math.round(moyEcarts()))};
 }},

/* ─── 4 · Marée ──────────────────────────────────────────────────── */
{id:'maree', n:'Marée', tours:12,
 d:"La cible monte et redescend : 1 s, 1,5 s, 2 s, 2,5 s, 3 s, puis retour.",
 regle:"Douze cibles dont la durée suit une marée : elle monte jusqu'à trois "
   + "secondes puis redescend, et remonte. Le barème est le même à chaque "
   + "palier, mais une cible longue se rate plus largement qu'une courte.",
 astuce:"Le piège est le retournement : après quatre cibles qui s'allongent, "
   + "la main continue d'allonger. Les deux tours qui suivent le sommet sont "
   + "les plus ratés du mode.",
 cible:t => t + MAREE[Math.min(MAREE.length - 1, S.lab.pas)],
 zone:() => 20 + Math.round(MAREE[Math.min(MAREE.length - 1, S.lab.pas)] / 25),
 tour(c){
   const p = c.ecart === 0 ? 100 : c.ecart <= 3 ? 50 : c.ecart <= this.zone() ? 20 : 0;
   const d = MAREE[Math.min(MAREE.length - 1, S.lab.pas)];
   const monte = S.lab.pas + 1 < MAREE.length && MAREE[S.lab.pas + 1] > d;
   S.lab.pas++;
   return {pts:p, couleur:coulEcart(c.ecart, 3, this.zone(), this.zone()),
     titre:p ? '+' + p + ' points' : 'Hors zone',
     sous:'cible ' + fmt(d) + ' · écart ' + signe(c.delta) + fmt(c.ecart)
        + ' · la marée ' + (monte ? 'monte' : 'redescend')
        + ' · total ' + (S.points + p)};
 },
 fin:() => ({t:S.points + ' points',
   r:'Marée · écart moyen ± ' + fmt(Math.round(moyEcarts())) + ' sur douze paliers'})},

/* ─── 5 · Le Sniper ──────────────────────────────────────────────── */
{id:'sniper', n:'Le Sniper', tours:1,
 d:"Une cible, un tir, au millième. Rien d'autre.",
 regle:"Quatre secondes exactement, à l'aveugle, une seule tentative. Le score "
   + "est votre écart au millième de seconde. Il n'y a pas de zone sûre, pas de "
   + "seconde chance, pas de moyenne qui rattrape.",
 astuce:"C'est le mode le plus court du jeu et le plus difficile à améliorer : "
   + "sans répétition, il n'y a rien à corriger en cours de route.",
 cible:t => t + 400,
 zone:() => 10,
 aveugle:true,
 tour(c){
   const abs = Math.abs(Math.round(c.ms) - 4000);
   S.points = Math.max(0, 1000 - abs);
   return {pts:0, couleur:abs <= 20 ? 't-s100' : abs <= 60 ? 't-s50'
                        : abs <= 150 ? 't-s20' : 't-s0',
     titre:signe(Math.round(c.ms) - 4000) + fmtMs(abs) + ' s',
     sous:(abs <= 20 ? 'tir de précision' : abs <= 60 ? 'bon tir'
         : abs <= 150 ? 'tir correct' : 'raté') + ' · ' + S.points + ' points'};
 },
 fin:() => {
   const abs = 1000 - S.points;
   return {t:signe(0) + fmtMs(abs) + ' s',
     r:'Le Sniper · 4,000 s visé · ' + S.points + ' points',
     rev:{t:'Ce que ça vaut', s:abs <= 20
       ? 'Sous vingt millièmes sur un seul tir à l\'aveugle. C\'est au niveau du bruit de l\'écran tactile : impossible de faire nettement mieux.'
       : abs <= 60 ? 'Bon tir. Compter quatre secondes de tête donne typiquement 100 à 200 millièmes d\'erreur.'
       : 'L\'horloge interne dérive vite au-delà de trois secondes. Un rythme régulier bat le comptage mental.'}};
 }},

/* ─── 6 · Ricochet ───────────────────────────────────────────────── */
{id:'ricochet', n:'Ricochet', tours:0,
 d:"Chaque réussite raccourcit la cible suivante. Jusqu'où descendez-vous ?",
 regle:"La première cible fait deux secondes. Chaque réussite raccourcit la "
   + "suivante d'un cinquième : 2,00 puis 1,60 puis 1,30, et ainsi de suite. "
   + "Une sortie de zone arrête tout. Le score est le nombre de ricochets.",
 astuce:"La zone se resserre avec la cible, donc la difficulté double à chaque "
   + "palier. Le plancher est à 0,25 s, personne n'y arrive.",
 cible:t => t + (S.lab.duree || 200),
 zone:() => Math.max(4, Math.round((S.lab.duree || 200) * 0.12)),
 tour(c){
   const ok = c.ecart <= this.zone();
   if(ok){
     S.lab.ricochets++; S.points = S.lab.ricochets;
     S.lab.duree = Math.max(25, Math.round((S.lab.duree * 0.8) / 5) * 5);
   } else S.mort = true;
   return {pts:0, couleur:ok ? (c.ecart <= 3 ? 't-s100' : 't-s50') : 't-signal',
     titre:ok ? 'Ricochet ' + S.lab.ricochets : 'La pierre coule',
     sous:ok ? 'prochaine cible ' + fmt(S.lab.duree) + ' · zone ± ' + fmt(this.zone())
             : 'écart ± ' + fmt(c.ecart) + ' pour une zone de ± ' + fmt(this.zone())};
 },
 fini:() => S.mort === true,
 fin:() => ({t:S.points + ' ricochet' + (S.points > 1 ? 's' : ''),
   r:'Ricochet · dernière cible tenue ' + fmt(Math.round((S.lab.duree || 200) / 0.8))
     + ' · zone finale ± ' + fmt(Math.max(4, Math.round((S.lab.duree || 200) * 0.12)))})},

/* ─── 7 · Le Vertige ─────────────────────────────────────────────── */
{id:'vertige', n:'Le Vertige', tours:0,
 d:"La cible double à chaque palier : 1 s, 2 s, 4 s, 8 s, 16 s…",
 regle:"Chaque palier double la durée à tenir, toujours à l'aveugle. La zone "
   + "double aussi, donc la difficulté reste théoriquement constante — sauf que "
   + "l'horloge interne, elle, ne suit pas. Un palier raté termine la partie.",
 astuce:"Au-delà de huit secondes, compter ne marche plus : la dérive du "
   + "comptage mental dépasse la zone. Le score est le palier atteint.",
 cible:t => t + (S.lab.duree || 100),
 zone:() => Math.max(8, Math.round((S.lab.duree || 100) * 0.06)),
 aveugle:true,
 tour(c){
   const ok = c.ecart <= this.zone();
   if(ok){
     S.lab.palier++; S.points = S.lab.palier;
     S.lab.duree = Math.min(6400, S.lab.duree * 2);
   } else S.mort = true;
   return {pts:0, couleur:ok ? (c.ecart <= this.zone()/3 ? 't-s100' : 't-s50') : 't-signal',
     titre:ok ? 'Palier ' + S.lab.palier + ' franchi' : 'Le vide',
     sous:ok ? 'prochain palier ' + fmt(S.lab.duree) + ' · zone ± ' + fmt(this.zone())
             : 'écart ± ' + fmt(c.ecart) + ' pour une zone de ± ' + fmt(this.zone())};
 },
 fini:() => S.mort === true,
 fin:() => ({t:'Palier ' + S.points,
   r:'Le Vertige · dernière durée tenue ' + fmt(Math.round((S.lab.duree || 100) / 2))
     + ' · écart moyen ± ' + fmt(Math.round(moyEcarts())),
   rev:{t:'Où ça casse', s:S.points >= 5
     ? 'Au-delà de seize secondes, aucune méthode de comptage ne tient : la dérive est de l\'ordre de 5 % de la durée.'
     : 'Les premiers paliers se comptent. Le mode ne commence vraiment qu\'à huit secondes.'}})},

/* ─── 8 · Origami ───────────────────────────────────────────────── */
{id:'origami', n:'Origami', tours:0,
 d:"Un pli par tour. Le motif se complète si l'on reste précis.",
 regle:"Huit plis à faire, un par tour, sur des cibles d'une seconde. Un écart "
   + "de 3 centièmes ou moins pose un pli. Rester dans la zone ne pose rien mais "
   + "n'abîme rien. Sortir de la zone défait le dernier pli.",
 astuce:"C'est le seul mode où l'on peut reculer sans perdre : le motif se "
   + "termine quand les huit plis tiennent en même temps.",
 cible:t => t + 100,
 zone:() => 22,
 tour(c){
   let titre, coul;
   if(c.ecart <= 3){
     S.lab.plis = Math.min(8, S.lab.plis + 1);
     titre = 'Pli ' + S.lab.plis + ' posé'; coul = 't-s100';
   } else if(c.ecart <= this.zone()){
     titre = 'Pli hésitant'; coul = 't-s20';
   } else {
     S.lab.plis = Math.max(0, S.lab.plis - 1);
     titre = 'Le papier se déplie'; coul = 't-signal';
   }
   S.points = S.lab.plis;
   const motif = '▲'.repeat(S.lab.plis) + '△'.repeat(8 - S.lab.plis);
   return {pts:0, couleur:coul,
     titre, sous:motif + ' · ' + S.lab.plis + ' pli' + (S.lab.plis > 1 ? 's' : '')
        + ' sur 8 · écart ± ' + fmt(c.ecart)};
 },
 fini:() => S.lab.plis >= 8 || S.tour >= 20,
 fin:() => ({t:S.lab.plis >= 8 ? 'Motif achevé' : S.lab.plis + ' plis sur 8',
   r:'Origami · ' + S.tour + ' tour' + (S.tour > 1 ? 's' : '')
     + ' · écart moyen ± ' + fmt(Math.round(moyEcarts()))
     + (S.lab.plis >= 8 ? ' · terminé en ' + S.tour + ' tours' : ' · vingt tours au maximum')})},

/* ─── 11 · Quitte ou double ──────────────────────────────────────── */
{id:'quitte', n:'Quitte ou double', tours:0,
 d:"Chaque cible réussie double la cagnotte. Encaisser, ou continuer ?",
 regle:"La cible est toujours une seconde ronde et la zone ne bouge jamais : "
   + "±0,12 du début à la fin. Chaque réussite double la cagnotte — 10, 20, "
   + "40, 80, 160… Après chaque tour réussi, deux boutons : encaisser et "
   + "s'arrêter là, ou relancer. Un seul tour manqué et la cagnotte tombe à "
   + "zéro. Le score retenu est ce que vous avez encaissé, jamais ce que vous "
   + "auriez pu avoir.",
 astuce:"Ce mode ne mesure pas la précision mais le sang-froid : la zone est "
   + "large et constante, donc chaque tour a à peu près les mêmes chances. "
   + "Ce qui change, c'est ce que vous mettez en jeu. Un joueur moyen qui "
   + "s'arrête à six tours bat un excellent joueur qui vise le neuvième.",
 cible:() => (S.lab.pas + 1) * 100,
 zone:() => 12,
 tour(c){
   const ok = c.ecart <= 12;
   if(!ok){
     // tout est perdu : la cagnotte ne suit pas le joueur hors de la zone
     S.lab.cagnotte = 0;
     S.mort = true;
     return {pts:0, couleur:'t-signal',
       titre:'Cagnotte perdue',
       sous:'± ' + fmt(c.ecart) + ' · il fallait rester sous 0,12'};
   }
   S.lab.pas++;
   S.lab.cagnotte = S.lab.cagnotte ? S.lab.cagnotte * 2 : 10;
   S.points = S.lab.cagnotte;
   return {pts:0, couleur:c.ecart <= 4 ? 't-s100' : 't-s50',
     titre:S.lab.cagnotte + ' en jeu',
     sous:'tour ' + S.lab.pas + ' · ± ' + fmt(c.ecart)
        + ' · encaisser ou doubler'};
 },
 fini:() => S.mort === true || S.lab.encaisse === true,
 fin:() => {
   const encaisse = S.lab.encaisse ? S.lab.cagnotte : 0;
   S.points = encaisse;
   return {t:encaisse + ' points',
     r:'Quitte ou double · ' + S.lab.pas + ' tour' + (S.lab.pas > 1 ? 's' : '')
       + ' tenu' + (S.lab.pas > 1 ? 's' : '')
       + (S.lab.encaisse ? ' · encaissé' : ' · perdu au tour ' + (S.lab.pas + 1)),
     rev:{t:S.lab.encaisse ? 'Bien vu' : 'Le tour de trop',
       s:S.lab.encaisse
         ? 'Encaissé à ' + encaisse + ' après ' + S.lab.pas + ' tours. '
           + (S.lab.pas >= 6 ? 'Peu de joueurs vont aussi loin sans tout perdre.'
              : 'Prudent, mais un point encaissé vaut mieux que dix rêvés.')
         : 'La cagnotte était à ' + (S.lab.pas ? Math.pow(2, S.lab.pas - 1) * 10 : 0)
           + ' avant ce dernier tour. '
           + (S.lab.pas >= 6 ? 'À ce niveau, s\'arrêter était le bon calcul.'
              : 'La zone ne se resserre jamais : c\'est vous qui montez la mise.')}};
 }},

/* ─── 12 · Nouveau score ─────────────────────────────────────────────
   Banc d'essai du barème à combos. Rien n'est figé : tous les nombres
   ci-dessous sont réglables depuis l'onglet Test, pour pouvoir juger le
   ressenti sans recompiler.

   Deux notions distinctes, à ne pas confondre :
     · la CHAÎNE DE PILES  — pile après pile, 100 → 500, plafonnée à 5.
       C'est le barème existant du Solo classique, conservé tel quel.
     · la SÉRIE            — tours consécutifs réussis, un pile OU un
       frôlé. Elle casse au-delà du seuil de rupture (3 centièmes par
       défaut) : rester dans la zone large ne suffit pas à la tenir. */
{id:'scoring', n:'Scoring', tours:10,
 d:"Chaîne de piles, série qui multiplie, dix figures.",
 regle:"Dix tours, cibles de 1,00 à 10,00 comme avant. Pile 100, frôlé 50, "
   + "zone 20. Les piles d'affilée enchaînent 100, 200, 300… jusqu'à 500. "
   + "Une série sous 3 centièmes multiplie les points, jusqu'à ×4 — un "
   + "tour au-delà la casse. Des figures ajoutent des primes, détaillées "
   + "plus bas.",
 astuce:"Le seuil qui compte, c'est 3 centièmes — pas la zone.",
 /* exactement la trajectoire du Solo classique : la seconde ronde suivante
    sur le chrono cumulé, donc 1,00 puis 2,00 … jusqu'à 10,00. On appelle
    prochaineCible() plutôt que de recopier la formule, pour que les deux
    modes ne puissent jamais diverger. */
 cible:(total) => prochaineCible(total),
 zone:() => zoneBase(),
 tour(c){
   const P = paramsScore();
   const L = S.lab;
   const e = c.ecart;
   const pile = e === 0;
   const tenu = e <= P.seuil;          // ce qui prolonge la série
   const primes = [];

   /* ── 1. points de base, chaîne de piles inchangée ── */
   let base;
   if(pile){
     L.piles = (L.piles || 0) + 1;
     base = PTS.pile * Math.min(MULT_MAX, L.piles);   // 100 → 500
   } else {
     L.piles = 0;
     base = e <= PRES ? PTS.frole : e <= zoneBase() ? PTS.zone : PTS.rate;
   }

   /* ── 2. série : elle vit sur le seuil, pas sur la zone ── */
   const avant = L.serie || 0;
   L.serie = tenu ? avant + 1 : 0;
   L.meilleureSerie = Math.max(L.meilleureSerie || 0, L.serie);
   if(!tenu) L.sansFaute = false;
   const multi = tenu ? multiSerie(L.serie, P) : 1;

   /* ── 3. mémoire des tours ──
      On garde l'écart ET son signe : plusieurs figures ne se calculent
      qu'à partir du côté de l'erreur (trop tôt / trop tard), une donnée
      que le barème n'exploitait pas du tout jusqu'ici. */
   L.ecarts = L.ecarts || [];
   L.deltas = L.deltas || [];
   L.ecarts.push(e);
   L.deltas.push(c.delta);

   /* ── 4. figures ── */
   if(pile && L.pilesAvant && P.double > 0) primes.push({n:'Doublé', v:P.double});
   if(pile && L.dernierRate) primes.push({n:'Remontée', v:P.remontee});

   /* Métronome — trois tours du même côté, à P.metro centièmes près.
      Récompense l'erreur CONSTANTE, qui est une compétence : c'est elle
      qu'un joueur doit repérer chez lui pour se corriger. */
   const d3 = L.deltas.slice(-3);
   if(d3.length === 3 && !L.metroPris){
     const memeCote = d3.every(x => x > 0) || d3.every(x => x < 0);
     const es = d3.map(Math.abs);
     if(memeCote && Math.max(...es) - Math.min(...es) <= P.metro){
       primes.push({n:'Métronome', v:P.metronome});
       L.metroPris = true;      // une seule fois : sinon 5 tours réguliers en donnent 3
     }
   }

   /* Verrou — cinq tours d'affilée à 1 centième ou moins. Un second
      palier de précision, bien plus dur que le seuil de série. */
   const e5 = L.ecarts.slice(-5);
   if(e5.length === 5 && !L.verrouPris && e5.every(x => x <= P.verrouSeuil)){
     primes.push({n:'Verrou', v:P.verrou});
     L.verrouPris = true;
   }

   /* Crescendo — quatre écarts qui diminuent strictement. La seule figure
      qui puisse tomber après un mauvais départ : elle donne une raison de
      continuer quand la partie commence mal. */
   const e4 = L.ecarts.slice(-4);
   if(e4.length === 4 && !L.crescPris
      && e4[3] < e4[2] && e4[2] < e4[1] && e4[1] < e4[0]){
     primes.push({n:'Crescendo', v:P.crescendo});
     L.crescPris = true;
   }

   /* Le dernier mot — un pile au tour 10. Le seul coup dont on sait, en le
      jouant, qu'il est le dernier : ça donne enfin un enjeu au tour final. */
   if(pile && S.tour >= 10 && !L.motPris){
     primes.push({n:'Le dernier mot', v:P.dernierMot});
     L.motPris = true;
   }

   /* Coup double — figure méta : elle récompense la coïncidence de deux
      figures dans le même tour. Calculée en dernier, sur la liste déjà
      figée, pour qu'elle ne puisse pas se déclencher sur elle-même. */
   if(primes.length >= 2) primes.push({n:'Coup double', v:P.coupDouble});

   L.pilesAvant = pile;
   L.dernierRate = !tenu;

   const gagnePrimes = primes.reduce((a,p) => a + p.v, 0);
   const pts = Math.round(base * multi) + gagnePrimes;
   L.base = (L.base || 0) + base;
   L.apport = (L.apport || 0) + (Math.round(base * multi) - base);
   L.primes = (L.primes || 0) + gagnePrimes;
   L.detail = L.detail || [];
   primes.forEach(p => L.detail.push(p));
   S.points += pts;

   const calc = base + (multi > 1 ? ' × ' + multi.toFixed(1).replace('.', ',') : '')
     + (gagnePrimes ? ' + ' + gagnePrimes : '')
     + ' = ' + pts;
   return {pts:0,
     couleur:pile ? 't-s100' : e <= PRES ? 't-s50' : e <= zoneBase() ? 't-s20' : 't-s0',
     titre:'+' + pts + ' points'
       + (primes.length ? '  ·  ' + primes.map(p => p.n).join(' + ') : ''),
     sous:calc + ' · série ' + L.serie
        + (L.piles > 1 ? ' · chaîne de ' + L.piles + ' piles' : '')
        + ' · total ' + S.points};
 },
 fini:() => S.tour >= 10,
 fin:() => {
   const L = S.lab, P = paramsScore();
   let total = S.points;
   let bonus = '';
   /* les lignes du décompte sont construites ici, dans l'ordre où elles
      seront révélées à l'écran de fin */
   const lignes = [
     {lb:'Points de base', vl:'+' + (L.base || 0)},
     {lb:'Apport des multiplicateurs', vl:'+' + (L.apport || 0), cls:'bonus'}
   ];
   const compte = {};
   (L.detail || []).forEach(p => {
     compte[p.n] = compte[p.n] || {n:0, v:0};
     compte[p.n].n++; compte[p.n].v += p.v;
   });
   Object.keys(compte).forEach(n => {
     lignes.push({lb:n + (compte[n].n > 1 ? ' ×' + compte[n].n : ''),
                  vl:'+' + compte[n].v, cls:'prime'});
   });
   /* ── Symétrie : figure de bilan, jamais de tour ──
      Le biais cumulé (somme des deltas SIGNÉS) finit près de zéro : les
      avances et les retards se sont compensés. Le jeu mesure déjà cette
      qualité dans le profil, mais ne l'avait jamais récompensée.
      Elle est calculée AVANT la ligne « aucune figure », sinon celle-ci
      s'afficherait juste au-dessus d'une figure obtenue. */
   const biais = (L.deltas || []).reduce((a, b) => a + b, 0);
   const symOk = (L.deltas || []).length && Math.abs(biais) <= P.symetrie;
   if(symOk){
     total += P.symetriePrime;
     L.primes = (L.primes || 0) + P.symetriePrime;
     lignes.push({lb:'Symétrie · biais final ' + (biais > 0 ? '+' : '')
                    + fmt(biais), vl:'+' + P.symetriePrime, cls:'prime'});
   }
   if(!Object.keys(compte).length && !symOk)
     lignes.push({lb:'Aucune figure', vl:'—'});

   /* ── Éclipse : le nerf des cumuls ──
      Sans-faute, Sans filet et Main sûre partageaient tous la même
      condition de fond (peu ou aucune sortie du seuil), donc une partie
      parfaite les cumulait systématiquement — c'est ce qui faisait
      exploser les scores par simple multiplication en cascade. Quand
      Éclipse est actif, la condition du Sans-faute (déterminée dès la
      fin de partie, indépendamment des deux autres) empêche Sans filet
      et Main sûre de s'ajouter : la récompense ultime se suffit à
      elle-même, plutôt que de s'empiler avec les paliers inférieurs. */
   const eclipseOk = P.eclipse && L.sansFaute !== false;

   /* ── Main sûre : huit tours tenus, même non consécutifs ──
      Tout le reste du barème repose sur la consécutivité : une erreur au
      tour 5 efface la série et la plupart des figures. C'est la seule
      figure qui juge le total sans se soucier de l'ordre. */
   const tenus = (L.ecarts || []).filter(x => x <= P.seuil).length;
   if(!eclipseOk && tenus >= P.mainSure){
     total += P.mainSurePrime;
     L.primes = (L.primes || 0) + P.mainSurePrime;
     lignes.push({lb:'Main sûre · ' + tenus + ' tours dans les ' + P.seuil
                    + ' centièmes', vl:'+' + P.mainSurePrime, cls:'prime'});
   }

   /* ── Montée en régime : la seconde moitié bat la première ──
      Crescendo exige quatre tours qui s'améliorent d'affilée, ce qui est
      rare. Celle-ci juge la tendance, donc elle récompense l'apprentissage
      en cours de partie et tombe bien plus souvent. */
   const E = L.ecarts || [];
   if(E.length >= 6){
     const moit = Math.floor(E.length / 2);
     const m1 = E.slice(0, moit).reduce((a, b) => a + b, 0) / moit;
     const m2 = E.slice(-moit).reduce((a, b) => a + b, 0) / moit;
     if(m2 * P.montee <= m1 && m1 > 0){
       total += P.monteePrime;
       L.primes = (L.primes || 0) + P.monteePrime;
       lignes.push({lb:'Montée en régime · ± ' + fmt(Math.round(m1))
                      + ' puis ± ' + fmt(Math.round(m2)),
                    vl:'+' + P.monteePrime, cls:'prime'});
     }
   }

   /* ── Sans filet : aucun tour sorti de la zone ──
      Critère bien plus large que le Sans-faute : c'est le palier d'entrée
      du même registre, celui qu'un joueur voit dès ses premières parties. */
   if(!eclipseOk && E.length && E.every(x => x <= zoneBase())){
     const g = Math.round(total * (P.sansFilet - 1));
     total += g;
     L.primes = (L.primes || 0) + g;
     lignes.push({lb:'Sans filet · jamais sorti de la zone',
                  vl:'×' + P.sansFilet.toFixed(2).replace('.', ','), cls:'bonus'});
   }

   /* ── Palier de précision ──
      Le seul élément du barème qui juge la précision MOYENNE plutôt qu'une
      séquence. Un joueur régulier mais sans figure sort enfin récompensé. */
   const moy = (L.ecarts || []).length
     ? (L.ecarts.reduce((a, b) => a + b, 0) / L.ecarts.length) : 999;
   const pal = PALIERS_PRECISION.find(p => moy <= p.max);
   if(pal){
     const gain = Math.round(total * (pal.mult - 1));
     total += gain;
     L.primes = (L.primes || 0) + gain;
     lignes.push({lb:'Précision · ' + pal.n + ' (moyenne ± ' + fmt(Math.round(moy)) + ')',
                  vl:'×' + pal.mult.toFixed(2).replace('.', ','), cls:'bonus'});
   } else {
     lignes.push({lb:'Précision · moyenne ± ' + fmt(Math.round(moy)), vl:'—'});
   }

   if(L.sansFaute !== false){
     total = Math.round(total * P.sansFaute);
     bonus = ' · sans-faute ×' + P.sansFaute.toFixed(1).replace('.', ',');
     lignes.push({lb:(eclipseOk ? 'Éclipse' : 'Sans-faute')
                    + ' · dix tours dans les ' + P.seuil + ' centièmes'
                    + (eclipseOk ? ' · remplace Sans filet et Main sûre' : ''),
                  vl:'×' + P.sansFaute.toFixed(1).replace('.', ','), cls:'bonus'});
   } else {
     lignes.push({lb:P.eclipse ? 'Éclipse' : 'Sans-faute', vl:'manqué'});
   }
   S.decompte = {lignes, total,
     note:'meilleure série : ' + (L.meilleureSerie || 0) + ' tours'};
   S.points = total;
   const noms = {};
   (L.detail || []).forEach(p => noms[p.n] = (noms[p.n] || 0) + 1);
   const listeP = Object.keys(noms)
     .map(n => n + (noms[n] > 1 ? ' ×' + noms[n] : '')).join(' · ');
   /* le titre ne donne PAS le total : il est révélé par le décompte juste
      en dessous, sinon l'animation ne sert plus à rien */
   return {t:(L.meilleureSerie || 0) >= 8 ? 'Presque parfait'
            : (L.meilleureSerie || 0) >= 5 ? 'Belle série'
            : (L.meilleureSerie || 0) >= 3 ? 'Ça tenait' : 'Décousu',
     r:'Nouveau score · meilleure série ' + (L.meilleureSerie || 0)
       + ' tours' + bonus,
     rev:{t:'Ce qui a payé',
       s:'Meilleure série : ' + (L.meilleureSerie || 0) + ' tours. '
         + (listeP ? 'Figures : ' + listeP + '. ' : 'Aucune figure. ')
         + ((L.apport || 0) > (L.base || 0) / 2
            ? 'Les multiplicateurs ont pesé plus que les points eux-mêmes : '
              + 'c\'est exactement ce que ce barème cherche à provoquer.'
            : 'Les séries sont restées courtes — le barème ne s\'est jamais '
              + 'emballé, il faudrait peut-être adoucir le seuil de rupture.')}};
 }},

];

const LAB = () => LABOS.find(l => l.id === CFG.mode);
/* modes visibles uniquement dans l'onglet Test, le temps de les juger */
const ESSAIS = ['quitte', 'solo'];   // Solo classique repart en essai, Nouveau score devient réel

/* ─── paramètres réglables du nouveau barème ──────────────────────────
   Chaque valeur est modifiable depuis l'onglet Test et persiste dans la
   sauvegarde : le but est de pouvoir tester plusieurs équilibrages dans
   la même soirée sans toucher au code. */
const SCORE_DEF = {
  seuil:3,          // centièmes — au-delà, la série casse (frôlé = 3)
  palier:0.5,       // ce que chaque cran de série ajoute au multiplicateur
  plafond:4,        // multiplicateur maximum
  double:0,         // désactivé par défaut : redondant avec la chaîne de piles (100→500)
  remontee:100,     // prime pour un pile juste après une rupture
  metronome:200,    // prime pour trois tours du même côté
  metro:2,          // dispersion tolérée entre ces trois écarts
  verrou:220,       // prime pour cinq tours très serrés
  verrouSeuil:1,    // « très serré » = 1 centième ou moins
  crescendo:250,    // prime pour quatre écarts qui diminuent
  symetriePrime:160,// prime pour un biais final quasi nul
  symetrie:3,       // tolérance sur ce biais, en centièmes
  eclipse:1,        // 1 = Éclipse annule et remplace Sans filet + Main sûre
  dernierMot:250,   // prime pour un pile au dernier tour
  coupDouble:150,   // prime quand deux figures tombent le même tour
  mainSure:8,       // nombre de tours tenus exigé, ordre indifférent
  mainSurePrime:180,
  montee:2,         // la 2e moitié doit être N fois meilleure que la 1re
  monteePrime:240,
  sansFilet:1.10,   // multiplicateur si aucun tour hors de la zone
  sansFaute:1.5     // multiplicateur du total si aucun tour au-dessus du seuil
};
const SCORE_LBL = {
  seuil:'Seuil de rupture (centièmes)',
  palier:'Gain de multiplicateur par cran',
  plafond:'Plafond du multiplicateur',
  double:'Prime · Doublé',
  remontee:'Prime · Remontée',
  metronome:'Prime · Métronome',
  metro:'Métronome · dispersion tolérée',
  verrou:'Prime · Verrou',
  verrouSeuil:'Verrou · seuil (centièmes)',
  crescendo:'Prime · Crescendo',
  symetriePrime:'Prime · Symétrie',
  symetrie:'Symétrie · biais toléré',
  dernierMot:'Prime · Le dernier mot',
  coupDouble:'Prime · Coup double',
  mainSure:'Main sûre · tours exigés',
  mainSurePrime:'Prime · Main sûre',
  montee:'Montée · facteur exigé',
  monteePrime:'Prime · Montée en régime',
  sansFilet:'Bonus · Sans filet (× total)',
  eclipse:'Éclipse remplace Sans filet + Main sûre (0/1)',
  sansFaute:'Bonus · Éclipse / Sans-faute (× total)'
};

/* Paliers de précision globale — le seul élément du barème qui juge la
   précision MOYENNE de la partie plutôt qu'une séquence de tours. Un
   joueur régulier qui ne déclenche aucune figure sort enfin récompensé.
   L'ordre compte : on retient le PREMIER palier atteint, donc du plus
   exigeant au plus large. */
const PALIERS_PRECISION = [
  {max:2,  n:'chirurgical', mult:1.60},
  {max:4,  n:'excellent',   mult:1.40},
  {max:7,  n:'très bon',    mult:1.25},
  {max:12, n:'bon',         mult:1.12},
  {max:20, n:'correct',     mult:1.05}
];
function construireParamsScore(){
  const M = $('params-score');
  if(!M) return;
  const P = paramsScore();
  M.innerHTML = '';
  Object.keys(SCORE_DEF).forEach(k => {
    const l = document.createElement('label');
    l.className = 'pscore';
    /* pas est adapté à la nature du réglage : les primes se comptent en
       dizaines de points, les multiplicateurs au dixième */
    const decimal = (k === 'palier' || k === 'sansFaute' || k === 'plafond');
    l.innerHTML = '<span class="lb">' + SCORE_LBL[k] + '</span>';
    const i = document.createElement('input');
    i.type = 'number';
    i.step = decimal ? '0.1' : (k === 'seuil' || k === 'eclipse' ? '1' : '10');
    i.min = '0';
    if(k === 'eclipse') i.max = '1';
    i.value = P[k];
    i.oninput = () => {
      const v = parseFloat(i.value);
      if(isNaN(v)) return;
      MEM.score = Object.assign({}, paramsScore(), {[k]:v});
      ecrireMem();
    };
    l.appendChild(i);
    M.appendChild(l);
  });
  /* liaison ici plutôt qu'au niveau supérieur : ce bloc s'exécute avant la
     définition de $, et une liaison globale déclenchait une erreur de zone
     morte temporelle qui bloquait tout le script */
  const d = $('score-defauts');
  if(d) d.onclick = () => { MEM.score = null; ecrireMem(); construireParamsScore(); };
}

function paramsScore(){
  return Object.assign({}, SCORE_DEF, (MEM.score || {}));
}
/* série 1 → ×1, puis +palier par cran, borné au plafond */
function multiSerie(n, P){
  if(n <= 1) return 1;
  return Math.min(P.plafond, 1 + (n - 1) * P.palier);
}
LABOS.forEach(l => SOLOS.push({id:l.id, n:l.n, tours:l.tours || 0, fam:'labo',
  regle:l.regle, astuce:l.astuce, d:l.d, labo:1}));

function initLabo(){
  const l = LAB();
  S.lab = {laps:[], cadrans:[], cadran:0, alarme:0, ouvert:false,
           duree:100, ricochets:0, palier:0, plis:0,
           pas:0, mesPoints:0, sesPoints:0, fantome:[],
           cagnotte:0, encaisse:false,
           piles:0, serie:0, meilleureSerie:0, sansFaute:true,
           pilesAvant:false, dernierRate:false,
           ecarts:[], deltas:[],
           metroPris:false, verrouPris:false, crescPris:false, motPris:false,
           base:0, apport:0, primes:0, detail:[]};
  S.mort = false;
  if(!l) return;
  if(l.id === 'ricochet') S.lab.duree = 200;
  if(l.id === 'vertige')  S.lab.duree = 100;
  if(l.id === 'duelf'){
    const g = ((MEM.labo || {}).fantome || []).slice(0, 10);
    // sans fantôme enregistré, un adversaire moyen : écarts de 0 à 11 centièmes
    S.lab.fantome = g.length === 10 ? g
      : Array.from({length:10}, () => Math.floor(Math.random() * 12));
  }
}

// position du balancier plutôt que temps écoulé

/* ════════ MODE AVENTURE ════════ */
// Même chemin que la Survie — les mêmes biomes, le même rétrécissement — mais
// une économie différente : aucun bonus de décor, seulement les malus ; chaque
// bon coup rapporte de l'expérience ; l'expérience s'achète en armes et en
// armure, qui se gardent d'une partie à l'autre. À la fin de chaque biome, un
// gardien. Perdre n'efface rien : on revient à la boutique plus riche.

const AVT = () => CFG.mode === 'aventure';
// les clés d'effet qui aident le joueur : neutralisées en Aventure
const BONUS_BIOME = ['zoneDep','pile','demiUsure','seuil','vies','viesGardees',
                     'doubleAveugle','majGain','pari','plafond','plafondDepart',
                     'paradis','reset'];

// ═══ AVENTURE UNIQUEMENT — table des monstres par biome ═══
// N'ajoute rien à BIOMES (partagé avec Survie) : table séparée, indexée sur
// les mêmes id. secret:true = pas de gardien, seulement les deux monstres
// lambda (faible, moyen). Noms et stats de départ — à affiner biome par
// biome selon vos retours individuels.
const AVT_MONSTRES = {
  jungle:     {secret:false, faible:{n:'Épine rampante',   pv:8,  xp:5,  or:3},
                              moyen: {n:'Liane tressée',     pv:14, xp:10, or:6}},
  orage:      {secret:false, faible:{n:'Étincelle folle',   pv:10, xp:6,  or:4},
                              moyen: {n:'Nuée grondante',    pv:17, xp:12, or:7}},
  corail:     {secret:false, faible:{n:'Poisson-lame',      pv:10, xp:6,  or:4},
                              moyen: {n:'Anémone vive',      pv:17, xp:12, or:7}},
  desert:     {secret:false, faible:{n:'Scorpion de verre', pv:12, xp:7,  or:5},
                              moyen: {n:'Mirage armé',       pv:20, xp:14, or:8}},
  toundra:    {secret:false, faible:{n:'Renard blanc',      pv:12, xp:7,  or:5},
                              moyen: {n:'Bourrasque vive',   pv:20, xp:14, or:8}},
  ocean:      {secret:false, faible:{n:'Méduse pressée',    pv:14, xp:8,  or:5},
                              moyen: {n:'Courant sourd',     pv:23, xp:16, or:9}},
  faille:     {secret:true,  faible:{n:'Écho dédoublé',     pv:14, xp:8,  or:5},
                              moyen: {n:'Fracture vive',     pv:23, xp:16, or:9}},
  grotte:     {secret:false, faible:{n:'Chauve-souris pâle',pv:16, xp:9,  or:6},
                              moyen: {n:'Écho griffu',       pv:26, xp:18, or:10}},
  marais:     {secret:false, faible:{n:'Sangsue trouble',   pv:16, xp:9,  or:6},
                              moyen: {n:'Vase mouvante',     pv:26, xp:18, or:10}},
  horlogerie: {secret:false, faible:{n:'Rouage égaré',      pv:18, xp:10, or:7},
                              moyen: {n:'Aiguille folle',    pv:29, xp:20, or:11}},
  metropole:  {secret:true,  faible:{n:'Silhouette pressée',pv:18, xp:10, or:7},
                              moyen: {n:'Néon errant',       pv:29, xp:20, or:11}},
  incendie:   {secret:false, faible:{n:'Braise volante',    pv:20, xp:11, or:8},
                              moyen: {n:'Flamme rampante',   pv:32, xp:22, or:12}},
  ruines:     {secret:false, faible:{n:'Gravat vivant',     pv:20, xp:11, or:8},
                              moyen: {n:'Poussière armée',   pv:32, xp:22, or:12}},
  abysses:    {secret:true,  faible:{n:'Lueur froide',      pv:22, xp:12, or:9},
                              moyen: {n:'Poids des profondeurs', pv:35, xp:24, or:13}},
  reseau:     {secret:false, faible:{n:'Signal parasite',   pv:22, xp:12, or:9},
                              moyen: {n:'Écho numérique',    pv:35, xp:24, or:13}},
  spatial:    {secret:false, faible:{n:'Poussière stellaire',pv:24,xp:13, or:10},
                              moyen: {n:'Ombre en apesanteur',pv:38,xp:26, or:14}},
  enfer:      {secret:false, faible:{n:'Cendre hurlante',   pv:26, xp:14, or:11},
                              moyen: {n:'Flamme jugée',      pv:41, xp:28, or:15}},
  paradis:    {secret:false, faible:{n:'Plume égarée',      pv:24, xp:13, or:10},
                              moyen: {n:'Lumière insistante',pv:38, xp:26, or:14}},
  aurore:     {secret:false, faible:{n:'Reflet tardif',     pv:20, xp:12, or:10},
                              moyen: {n:'Dernière ombre',    pv:32, xp:24, or:13}},
  // biomes secrets non encore reliés à la carte — stub, mêmes stats qu'un
  // biome milieu de parcours en attendant leur emplacement définitif
  mine:           {secret:true, faible:{n:'Wagonnet fou',     pv:16, xp:9,  or:6},
                                 moyen: {n:'Poussière de charbon', pv:26, xp:18, or:10}},
  chantier:       {secret:true, faible:{n:'Gravier vif',      pv:16, xp:9,  or:6},
                                 moyen: {n:'Poutrelle branlante',  pv:26, xp:18, or:10}},
  concert_rock:   {secret:true, faible:{n:'Larsen aigu',      pv:16, xp:9,  or:6},
                                 moyen: {n:'Basse tonnante',       pv:26, xp:18, or:10}},
  labyrinthe:     {secret:true, faible:{n:'Écho perdu',       pv:16, xp:9,  or:6},
                                 moyen: {n:'Mur mouvant',          pv:26, xp:18, or:10}},
  bibliotheque:   {secret:true, faible:{n:'Page volante',     pv:16, xp:9,  or:6},
                                 moyen: {n:'Silence pesant',       pv:26, xp:18, or:10}},
  cite_engloutie: {secret:true, faible:{n:'Algue vive',       pv:16, xp:9,  or:6},
                                 moyen: {n:'Cloche noyée',         pv:26, xp:18, or:10}},
  volcan:         {secret:true, faible:{n:'Cendre chaude',    pv:16, xp:9,  or:6},
                                 moyen: {n:'Coulée vive',          pv:26, xp:18, or:10}}
};
// Station n'a jamais de monstre : ce n'est pas une zone de combat, seulement
// un accès rapide vers un biome déjà visité (voir la carte des chemins).
const monstresDe = id => AVT_MONSTRES[id] || AVT_MONSTRES.jungle;

// Récits de transition entre biomes, ton post-apocalyptique / steampunk.
// Affichés sur un écran dédié, une seule fois, quand un gardien vaincu fait
// franchir la frontière vers le biome suivant.
const RECIT_BIOME_AVT = {
  jungle: "La canopée a repris ses droits sur les carcasses de métal. Sous "
    + "les lianes, des rouages rouillés tournent encore, entretenus par on "
    + "ne sait quelle mémoire mécanique.",
  orage: "Le ciel crache sa foudre sur des pylônes tordus, derniers "
    + "vestiges d'un réseau qui reliait le monde avant l'effondrement. "
    + "Chaque éclair réveille une machine qu'on croyait morte.",
  corail: "La mer a englouti la ville et le corail a fait sien ce qui "
    + "restait des coques. Entre les récifs, des hublots de laiton "
    + "regardent encore vers une surface qu'ils ne reverront jamais.",
  desert: "Le sable a mangé l'usine jusqu'à l'os. Ses cheminées penchent "
    + "comme des os brisés, et le vent y siffle une mélodie de vapeur "
    + "qui ne sort plus de nulle part.",
  toundra: "Le gel a figé les derniers convois à mi-course. Leurs "
    + "chaudières, éteintes depuis des décennies, dessinent des tombes "
    + "de fer sous la neige tassée.",
  ocean: "La pression écrase ce qui a coulé ici — des bathyscaphes de "
    + "cuivre, des tuyauteries éclatées. Quelque chose, tout en bas, "
    + "respire encore au rythme d'une turbine oubliée.",
  faille: "La terre s'est déchirée le jour où la grande machine a cédé. "
    + "Dans la faille, le temps lui-même semble s'être coincé entre deux "
    + "engrenages.",
  grotte: "Les galeries de mine s'enfoncent bien plus loin que prévu par "
    + "leurs bâtisseurs. Des wagonnets vides roulent encore, poussés par "
    + "un courant d'air qu'on n'explique pas.",
  marais: "La raffinerie a sombré dans la vase, et le marais digère "
    + "lentement ses cuves rouillées. Des bulles de gaz remontent en "
    + "silence, comme un dernier souffle industriel.",
  horlogerie: "Le cœur mécanique du vieux monde bat encore ici, immense, "
    + "au milieu de ses propres ruines. Des rouages plus larges qu'un "
    + "homme tournent sans que personne ne sache pourquoi.",
  metropole: "Les néons de l'ancienne mégapole clignotent sur des tours "
    + "vidées de leurs habitants. La ville continue de briller pour "
    + "personne, fidèle à un programme que plus rien ne supervise.",
  station: "Les quais sont vides, les rails envahis par la rouille. Un "
    + "tableau d'affichage à vapeur crache encore, de loin en loin, une "
    + "destination que plus aucun train ne rejoindra.",
  incendie: "Le sol brûle depuis si longtemps que personne ne se souvient "
    + "de l'étincelle. D'anciens derricks flambent comme des torches, "
    + "éclairant un paysage qui ne s'éteint jamais.",
  ruines: "Ce qui reste de la capitale s'effondre par pans entiers. "
    + "Statues de fer et colonnes de brique se mêlent dans une poussière "
    + "dorée que le vent ne dissipe jamais tout à fait.",
  abysses: "Ici, la pression a broyé jusqu'au métal. Dans le noir total, "
    + "quelques lueurs bioluminescentes dessinent les contours d'une "
    + "machinerie qu'on préférerait ne pas voir de plus près.",
  reseau: "Un réseau de câbles morts quadrille encore l'horizon, portant "
    + "un signal que personne n'écoute plus. Quelque part, un serveur "
    + "continue d'émettre, par pure inertie.",
  spatial: "L'épave d'une station dérive parmi les étoiles, ses hublots "
    + "éclatés respirant le vide. À l'intérieur, l'apesanteur a figé la "
    + "poussière en une neige immobile.",
  enfer: "La chaleur ici vient d'en dessous, d'une fonderie qu'on "
    + "imaginait engloutie pour de bon. L'acier en fusion coule encore, "
    + "sans ouvrier pour le couler nulle part.",
  paradis: "Contre toute attente, un jardin a survécu à l'effondrement, "
    + "suspendu au-dessus du chaos par une armature qu'on ne voit qu'en "
    + "levant les yeux. Ici, l'air redevient respirable.",
  aurore: "L'horizon s'éclaircit enfin, au-delà de tout ce qui a été "
    + "traversé. Ce n'est pas une fin — juste le premier matin d'un monde "
    + "qui n'a plus besoin de machines pour se souvenir de lui-même.",
};

// ═══ Graphe du parcours d'Aventure ═══
// Remplace la progression strictement linéaire (BIOMES[gardiens]) par un
// vrai graphe, fidèle à la carte dessinée à la main.
//   suivants   : le ou les biomes accessibles normalement après le gardien.
//                Un seul élément = pas de choix. Deux éléments = embranchement,
//                un écran de décision s'affiche après le combat.
//   secrets    : chemins secrets, jamais empruntés automatiquement — ils ne
//                se déclenchent qu'en événement aléatoire pendant la marche.
//   sortieDepuisGrotte : règle spéciale d'Enfer — si on y est entré par le
//                chemin secret de Grotte, la sortie se fait vers Incendie
//                plutôt que vers la suite normale (Aurore).
const PARCOURS_AVT = {
  jungle:     {suivants:['orage']},
  orage:      {suivants:['desert']},
  desert:     {suivants:['corail','ocean']},
  corail:     {suivants:['marais']},
  ocean:      {suivants:['marais'], secrets:['abysses']},
  marais:     {suivants:['grotte']},
  grotte:     {suivants:['toundra'], secrets:['abysses','enfer']},
  toundra:    {suivants:['horlogerie'], secrets:['station']},
  horlogerie: {suivants:['incendie'], secrets:['metropole']},
  metropole:  {suivants:['incendie']},
  incendie:   {suivants:['ruines']},
  ruines:     {suivants:['reseau'], secrets:['faille']},
  faille:     {suivants:['spatial']},
  reseau:     {suivants:['spatial']},
  spatial:    {suivants:['enfer','paradis']},
  enfer:      {suivants:['aurore'], sortieDepuisGrotte:'incendie'},
  paradis:    {suivants:['aurore']},
  aurore:     {suivants:[]},
  abysses:    {suivants:['grotte']},
  station:    {suivants:[], hub:true},
};
// le premier biome d'une nouvelle histoire
const BIOME_DEPART_AVT = 'jungle';

// Rang de chaque biome dans le parcours — sert uniquement à calculer la
// difficulté du gardien (PV, dégâts, nom dans GARDIENS) : deux biomes
// parallèles à un embranchement (Corail/Océan, Enfer/Paradis) partagent le
// même rang, puisqu'ils représentent la même profondeur de parcours.
const RANG_BIOME_AVT = {
  jungle:0, orage:1, desert:2, corail:3, ocean:3, marais:4,
  grotte:5, abysses:5, toundra:6, station:6, horlogerie:7, metropole:7,
  incendie:8, ruines:9, faille:9, reseau:10, spatial:11,
  enfer:12, paradis:12, aurore:13,
};

const biomeAvtCourant = () =>
  biomeParId(S.avt && S.avt.biomeId) || BIOMES.find(b => b.id === BIOME_DEPART_AVT);
const rangBiomeAvt = id => RANG_BIOME_AVT[id] || 0;

// Récits de départ, un par gardien — dans le même ordre que GARDIENS, donc
// dans le même ordre que les biomes qu'ils gardent. Affichés sur l'écran de
// victoire du boss, juste avant l'écran d'arrivée dans le biome suivant :
// on quitte quelque chose, avant d'entrer ailleurs.
const RECIT_DEPART_AVT = [
  "Le Guetteur des lianes s'effondre dans un cliquetis de rouages et de "
    + "feuilles mortes. La jungle referme lentement le passage derrière vous "
    + "— on ne revient jamais tout à fait d'ici.",
  "La Foudre nouée se disperse en une dernière étincelle. L'orage retombe "
    + "sur des pylônes muets, et pour la première fois depuis longtemps, "
    + "le silence redevient possible.",
  "Le Récif affamé coule à pic, entraînant avec lui des siècles de rouille "
    + "engloutie. La mer se referme au-dessus de la ville noyée, et avec "
    + "elle, un chapitre qu'on ne rouvrira pas.",
  "Le Vent de sable s'éteint d'un coup, comme une bougie soufflée. "
    + "L'usine ensevelie garde son secret, et le désert reprend son silence "
    + "minéral derrière vous.",
  "Le Silence blanc se brise enfin, et avec lui le gel qui tenait la "
    + "toundra immobile depuis des décennies. Les convois abandonnés "
    + "restent là où ils sont — vous, vous continuez.",
  "Ce qui dort sous la pierre ne dort plus, ou peut-être dort-il "
    + "définitivement. La pression referme les abysses derrière vous, "
    + "et la surface semble soudain très loin.",
  "La Ville sans nom s'effrite en poussière dorée. La faille qui l'a vue "
    + "naître se resserre lentement, comme si le temps lui-même reprenait "
    + "son souffle.",
  "Le Grand Balancier s'arrête net, pour la première fois depuis sa "
    + "création. Les galeries de mine restent derrière vous, plongées dans "
    + "un silence qu'elles n'avaient jamais connu.",
  "La Chose des fosses retourne à la vase qui l'a portée. Le marais se "
    + "referme sur ses cuves rouillées, et l'air, enfin, redevient "
    + "respirable derrière vous.",
  "Le Premier Jour s'immobilise, rouage après rouage, jusqu'au silence "
    + "complet. Le cœur mécanique du vieux monde a cessé de battre — vous "
    + "l'avez laissé loin derrière.",
  "La Faille se referme sur elle-même, emportant avec elle les derniers "
    + "néons de la mégapole. La ville continuera de briller pour personne, "
    + "mais plus jamais pour vous.",
  "Ce qui reste ne reste plus. Les quais désertés retrouvent un calme "
    + "qu'ils n'avaient jamais eu, et le tableau d'affichage s'éteint sur "
    + "une dernière destination sans nom.",
  "Le Marcheur des eaux s'effondre dans les flammes qui l'ont vu naître. "
    + "Le sol continuera de brûler longtemps après votre départ — mais "
    + "sans plus personne pour le regarder faire.",
  "Le Chef de gare rend son dernier souffle de vapeur. Les colonnes "
    + "brisées de la capitale s'enfoncent un peu plus dans leur propre "
    + "poussière, et vous vous éloignez, indemne.",
  "Le Jardin dur cède enfin, dans le noir total des abysses. Ce qui "
    + "restait de lumière bioluminescente s'éteint derrière vous, et la "
    + "pression retrouve son calme.",
  "Le Silence radio s'arrête d'émettre pour de bon. Le réseau mort ne "
    + "portera plus aucun signal — vous êtes, désormais, la seule chose "
    + "qui bouge encore dans ce chapitre.",
  "Le Portier s'efface dans le vide qu'il gardait. L'épave dérive un peu "
    + "plus loin dans l'obscurité, et vous, vous continuez votre chemin "
    + "parmi les étoiles.",
  "Le Dernier Gardien tombe, comme tous ceux qui l'ont précédé. Ce qu'il "
    + "gardait s'éloigne déjà derrière vous — il y a toujours quelque "
    + "chose de plus loin.",
];
// deux tournures possibles pour l'annonce de défaite, choisies au hasard
const TOURNURES_DEFAITE = [nom => nom + ' est tombé…', nom => nom + ' a été vaincu…'];

// Récits affichés sur l'écran de décision, aux deux embranchements du
// parcours — le chemin se divise, il faut choisir.
const RECIT_DECISION_AVT = {
  desert: "Le sable s'ouvre en deux traces distinctes. À l'est, une rumeur "
    + "d'eau et de sel — quelque chose qui vit encore, peut-être. Au nord, "
    + "un silence plus profond, tout aussi liquide, mais glacé.",
  spatial: "L'épave se scinde en deux coques désolidarisées, chacune "
    + "dérivant vers un horizon différent. L'une tombe vers une chaleur "
    + "ancienne. L'autre s'éloigne vers un calme qu'on n'espérait plus "
    + "trouver ici.",
};

// Récits des chemins secrets — un par destination, hors Station qui a son
// propre écran (un hub, pas un simple lieu à visiter).
const RECIT_SECRET_AVT = {
  abysses: "Une fissure dans la roche laisse filtrer un froid inhabituel, "
    + "presque magnétique. Quelque chose, plus bas, semble attendre depuis "
    + "longtemps qu'on descende.",
  metropole: "Un passage de service à moitié effondré laisse entrevoir des "
    + "lumières qui ne devraient plus s'allumer depuis si longtemps. "
    + "Quelqu'un, quelque part, entretient encore le courant.",
  enfer: "Une chaleur monte du sol lui-même, à travers une fissure trop "
    + "régulière pour être naturelle. Quelque chose l'a creusée, et ce "
    + "n'était pas la nature.",
  faille: "L'air se plie légèrement à cet endroit précis, comme si "
    + "l'espace hésitait sur sa propre forme. Un pas de trop, et on ne "
    + "sait plus très bien où l'on met les pieds.",
};

// ═══ AVENTURE UNIQUEMENT — niveaux ═══
const NIVEAUX_AVT = 30;
// probabilité de croiser un monstre lambda à chaque tour de marche éligible
// (hors combat, hors tour juste après une rencontre) — ajustable
const TAUX_RENCONTRE_AVT = 0.20;
// chemins secrets : plus rares qu'une rencontre de monstre, pour que ça
// reste un événement notable plutôt qu'une routine
const TAUX_SECRET_AVT = 0.07;
// XP cumulée nécessaire pour atteindre le niveau n
const xpPourNiveau = n => Math.round(100 * n * (1 + n / NIVEAUX_AVT));
// le niveau atteint pour une XP totale donnée, plafonné à NIVEAUX_AVT
function niveauDe(xpTotal){
  let n = 0;
  while(n < NIVEAUX_AVT && xpTotal >= xpPourNiveau(n + 1)) n++;
  return n;
}

// ═══ AVENTURE UNIQUEMENT — arbre de compétences ═══
// Quatre branches, cinq nœuds chacune (coût 1,1,2,2,3 = 9 par branche
// complète). Achat séquentiel : impossible d'acheter un nœud sans les
// précédents de sa branche. Les effets ne sont pas encore appliqués en jeu à
// ce stade — seuls l'achat et le suivi des points sont fonctionnels.
const ARBRE_AVT = {
  precision: {n:'Précision', ic:'◎', noeuds:[
    {id:'fil-tendu', n:'Fil tendu', cout:1, e:'+1 centième de zone, en permanence'},
    {id:'ligne-sure', n:'Ligne sûre', cout:1, e:'+1 centième de plus (total +2)'},
    {id:'oeil-chrono', n:'Œil du chronomètre', cout:2, e:'le seuil du frôlé s\'élargit'},
    {id:'main-forgeron', n:'Main du forgeron', cout:2, e:'+2 centièmes de plus (total +4)'},
    {id:'etalon-or', n:'Étalon d\'or', cout:3, e:'un pile allège l\'usure du tour suivant'}
  ]},
  vitalite: {n:'Vitalité', ic:'♥', noeuds:[
    {id:'cuir-tanne', n:'Cuir tanné', cout:1, e:'+1 coup manqué toléré en rencontre'},
    {id:'nerfs-acier', n:'Nerfs d\'acier', cout:1, e:'un gardien tombe au 4e coup manqué'},
    {id:'sang-froid', n:'Sang froid', cout:2, e:'après un raté, le coup suivant frappe plus fort'},
    {id:'rescape', n:'Rescapé', cout:2, e:'1re défaite en rencontre rejouée gratuitement'},
    {id:'ultime-rempart', n:'Ultime rempart', cout:3, e:'une chute fatale évitée, une fois par expédition'}
  ]},
  fortune: {n:'Fortune', ic:'◆', noeuds:[
    {id:'piece-trouvee', n:'Pièce trouvée', cout:1, e:'+10 % d\'or sur chaque victoire'},
    {id:'filon', n:'Filon', cout:1, e:'+10 % de plus (total +20 %)'},
    {id:'marchand-habile', n:'Marchand habile', cout:2, e:'prix de la Boutique réduits de 10 %'},
    {id:'poche-profonde', n:'Poche profonde', cout:2, e:'+20 % d\'or de plus (total +40 %)'},
    {id:'tresor-gardien', n:'Trésor du gardien', cout:3, e:'un gardien vaincu laisse un bonus d\'or fixe'}
  ]},
  instinct: {n:'Instinct', ic:'✦', noeuds:[
    {id:'odorat-pisteur', n:'Odorat du pisteur', cout:1, e:'le palier ennemi visible avant le combat'},
    {id:'pas-leger', n:'Pas léger', cout:1, e:'le taux de rencontre baisse légèrement'},
    {id:'sens-fuite', n:'Sens de la fuite', cout:2, e:'une rencontre évitée gratuitement par biome'},
    {id:'regard-percant', n:'Regard perçant', cout:2, e:'les ennemis majeurs se font plus rares'},
    {id:'sixieme-sens', n:'Sixième sens', cout:3, e:'la difficulté progresse plus lentement'}
  ]}
};
// points de compétence disponibles : un par niveau, moins ceux déjà dépensés
function pointsCompetenceDispo(){
  const M = avtMem();
  const depenses = Object.values(ARBRE_AVT).flatMap(b => b.noeuds)
    .filter(nd => M.competences.includes(nd.id))
    .reduce((s, nd) => s + nd.cout, 0);
  return niveauDe(M.xp) - depenses;
}
// un nœud est achetable si ses prérequis (les nœuds précédents de sa
// branche) sont possédés, qu'il ne l'est pas déjà, et qu'il reste assez de
// points
function noeudAchetable(cleBranche, index){
  const M = avtMem(), branche = ARBRE_AVT[cleBranche];
  const noeud = branche.noeuds[index];
  if(M.competences.includes(noeud.id)) return false;
  for(let i = 0; i < index; i++){
    if(!M.competences.includes(branche.noeuds[i].id)) return false;
  }
  return pointsCompetenceDispo() >= noeud.cout;
}
function acheterNoeud(cleBranche, index){
  if(!noeudAchetable(cleBranche, index)) return false;
  const M = avtMem();
  M.competences.push(ARBRE_AVT[cleBranche].noeuds[index].id);
  ecrireMem();
  sauvegarderAvtCompte();
  return true;
}

const ARMES = [
  {id:'baton',  n:'Bâton ferré',    prix:0,    degats:10, xp:1.0,
   d:"Ce qu'on ramasse par terre. Il tape, c'est déjà ça."},
  {id:'dague',  n:'Dague de verre', prix:60,   degats:14, xp:1.1,
   d:"Légère et précise. Elle récompense la main sûre."},
  {id:'epee',   n:'Épée d\'acier',  prix:180,  degats:20, xp:1.25,
   d:"L'arme d'équilibre : assez lourde pour compter, assez vive pour durer."},
  {id:'hache',  n:'Hache lourde',   prix:400,  degats:28, xp:1.4,
   d:"Deux coups bien placés valent mieux que six approximatifs."},
  {id:'lame',   n:'Lame du temps',  prix:900,  degats:40, xp:1.6,
   d:"Elle coupe la seconde en deux. Les gardiens tombent en trois coups."}
];
const ARMURES = [
  {id:'tunique', n:'Tunique',        prix:0,    zone:0, d:"Du tissu. Aucune marge."},
  {id:'cuir',    n:'Cuir bouilli',   prix:80,   zone:2, d:"Deux centièmes de marge en plus, tout au long de la partie."},
  {id:'mailles', n:'Cotte de mailles', prix:220, zone:4, d:"Quatre centièmes. On sent la différence dès le deuxième biome."},
  {id:'plates',  n:'Harnois',        prix:500,  zone:6, d:"Six centièmes. La partie change de longueur."},
  {id:'chrono',  n:'Plastron d\'horloger', prix:1000, zone:9,
   d:"Neuf centièmes. Le dernier palier : au-delà, le jeu n'aurait plus d'intérêt."}
];
const avtMem = () => {
  MEM.avt = MEM.avt || {xp:0, or:0, arme:'baton', armure:'tunique',
                         meilleur:0, gardiens:0, parties:0, competences:[]};
  MEM.avt.competences = MEM.avt.competences || [];   // migration douce
  return MEM.avt;
};
const monArme   = () => ARMES.find(a => a.id === avtMem().arme)     || ARMES[0];
const monArmure = () => ARMURES.find(a => a.id === avtMem().armure) || ARMURES[0];

// zone fixe, sans usure : 15 centièmes de tolérance du premier au dernier pas
const ZONE_AVT = 15;
// nombre de tours de marche avant que le gardien du décor ne se montre
const TOURS_AVT = 30;
const GARDIENS = ['Le Guetteur des lianes', 'La Foudre nouée', 'Le Récif affamé',
  'Le Vent de sable', 'Le Silence blanc', 'Ce qui dort sous la pierre',
  'La Ville sans nom', 'Le Grand Balancier', 'La Chose des fosses',
  'Le Premier Jour', 'La Faille', 'Ce qui reste', 'Le Marcheur des eaux',
  'Le Chef de gare', 'Le Jardin dur', 'Le Silence radio', 'Le Portier',
  'Le Dernier Gardien'];
const gardienNom = () => GARDIENS[Math.min(GARDIENS.length - 1,
                                           S.avt ? rangBiomeAvt(S.avt.biomeId) : 0)];
// le gardien apparaît au dernier tour de chaque biome
const pvGardien = idx => 40 + 25 * idx;

// Bonus de zone cumulé des compétences de la branche Précision achetées.
// fil-tendu +1, ligne-sûre +1 (total 2), main-forgeron +2 (total 4) —
// exactement ce que décrit chaque nœud, en centièmes.
function bonusZoneCompetences(){
  const M = avtMem();
  let bonus = 0;
  if(M.competences.includes('fil-tendu')) bonus += 1;
  if(M.competences.includes('ligne-sure')) bonus += 1;
  if(M.competences.includes('main-forgeron')) bonus += 2;
  return bonus;
}

function initAventure(){
  const A = avtMem();
  const zoneBase = ZONE_AVT + monArmure().zone + bonusZoneCompetences();
  // +5 pv max par niveau déjà atteint sur le compte, au-delà de la base —
  // calculé une fois ici, pas remis à jour en cours d'expédition (le niveau
  // du compte, lui, n'évolue qu'à la fin, quand l'xp de la run est fusionnée)
  const pvBase = PV_JOUEUR_BASE + 5 * niveauDe(A.xp || 0);
  S.avt = {xp:0, or:0, zoneDepart:zoneBase,
           zone:zoneBase, pvBoss:0,
           pvJoueur:pvBase, pvJoueurMax:pvBase,
           biomeId:BIOME_DEPART_AVT, visites:[BIOME_DEPART_AVT],
           gardiens:0, coups:0, enCombat:false, pas:0, journal:[],
           typeCible:null, recemmentRencontre:false, dernierEchangeEtaitCombat:false,
           decisionEnAttente:null, enferViaGrotte:false};
  // sans cette remise à zéro, la partie suivante croit changer de décor et
  // affiche la carte du biome, qui verrouille le départ
  S.biome = null; S.boucleFaite = false;
  S.mort = false;
  S.points = 0;
}
// l'Aventure n'a plus d'usure du terrain : la zone reste fixe à ZONE_AVT
// (+ bonus d'armure) du premier au dernier pas de chaque expédition

// Vie du joueur pendant un combat d'Aventure : base fixe, indépendante de
// l'armure (qui joue déjà sur la zone de marche, pas sur le combat).
const PV_JOUEUR_BASE = 100;
// Dégâts qu'un gardien inflige sur un coup non paré, croissant avec la
// progression — même logique que pvGardien, une autre échelle.
const degatsGardien = idx => 8 + 4 * idx;
// Pour un monstre lambda, les dégâts se déduisent de ses PV plutôt que d'être
// fixés à la main pour chacun des biomes — un monstre plus costaud tape aussi
// plus fort, sans avoir à retoucher toute la table AVT_MONSTRES.
const degatsMonstre = m => Math.max(4, Math.round(m.pv / 4));

// Forcé à 0,00 dès l'entrée en combat : sans ça, le chiffre du tour de
// marche qui vient de déclencher la rencontre resterait affiché un instant,
// ce qui ne correspond à rien pour l'échange de combat qui commence. Décalé
// d'un tick : le rendu du verdict du tour de marche écrit sa propre valeur
// juste après cet appel dans le même passage, il faut le laisser terminer.
// Centre le chrono dans l'espace réel entre le bas du HUD et le haut du bloc
// verdict, mesuré sur le rendu — remplace une marge fixe devinée par un
// calcul qui s'adapte à la vraie hauteur disponible sur l'appareil.
function ajusterChronoSousHud(){
  requestAnimationFrame(() => {
    const hud = document.getElementById('avt-hud');
    const centre = document.querySelector('.f-centre');
    const verdict = document.getElementById('f-verdict');
    const fluide = document.getElementById('fluide');
    if(!hud || !centre || !fluide) return;
    const centreRect = centre.getBoundingClientRect();
    const bas = hud.getBoundingClientRect().bottom - centreRect.top;
    if(bas <= 0) return;   // mesure invalide (ex. environnement de test sans mise en page)
    // chrono à mi-chemin entre le bas du HUD et le haut du verdict, avec un
    // minimum de 24px de respiration si l'espace est très serré
    const hautVerdict = verdict
      ? verdict.getBoundingClientRect().top - centreRect.top
      : bas + 200;
    const cible = hautVerdict > bas
      ? bas + (hautVerdict - bas) / 2
      : bas + 24;
    fluide.style.setProperty('--chr-y', Math.max(bas + 24, cible) + 'px');
  });
}

function chronoAZeroImmediat(){
  setTimeout(() => {
    const c = document.getElementById('f-chrono');
    if(c && S.avt && S.avt.enCombat) c.textContent = '0,00';
  }, 0);
}

function entrerCombat(){
  S.avt.enCombat = true;
  S.avt.typeCible = 'gardien';
  const rang = rangBiomeAvt(S.avt.biomeId);
  S.avt.pvBoss = pvGardien(rang);
  S.avt.pvMax = S.avt.pvBoss;
  S.avt.degatsCible = degatsGardien(rang);
  // la vie du joueur n'est plus remise à fond ici : elle persiste depuis le
  // début de l'expédition, un combat encaissé se ressent sur le suivant —
  // jusqu'à l'introduction d'un système de soin
  S.avt.coups = 0;
  // le verdict du tour de marche qui a déclenché cette rencontre ne doit
  // plus apparaître une fois le popup refermé : rien n'a encore été résolu
  // dans ce combat
  $('f-verdict').style.visibility = 'hidden';
  annoncerMonstre(gardienNom());
  chronoAZeroImmediat();
}

// Popup bloquant annonçant l'arrivée ou la défaite d'une cible. Se referme
// tout seul après un court délai (+0,5s par rapport à la version précédente).
// Pendant qu'il est affiché, le voile capte les appuis (impossible de lancer
// le chrono) ET le HUD/chrono restent masqués (classe sur #fluide) : le jeu
// n'apparaît qu'une fois le popup refermé, plutôt que de se dévoiler en
// même temps que lui.
function annoncerMonstre(nom, victoire){
  const el = document.getElementById('avt-voile');
  const fl = document.getElementById('fluide');
  if(!el) return;
  document.getElementById('avt-surgit-nom').textContent = victoire ? nom + ' vaincu !' : nom;
  document.getElementById('avt-voile-eyebrow').textContent
    = victoire ? 'Combat remporté' : 'Un ennemi surgit';
  document.getElementById('avt-voile-ic').textContent = victoire ? '✓' : '⚔';
  el.classList.toggle('succes', !!victoire);
  el.classList.add('on');
  if(fl) fl.classList.add('avt-popup-actif');
  if(S.tAvtSurgit) clearTimeout(S.tAvtSurgit);
  S.tAvtSurgit = setTimeout(() => {
    el.classList.remove('on');
    const bio = victoire && S.avt ? S.avt.biomeTransitionEnAttente : null;
    if(bio){
      // le HUD reste masqué : il ne réapparaîtra qu'à la fermeture de l'écran
      // de transition (bouton Poursuivre), jamais entre les deux popups
      S.avt.biomeTransitionEnAttente = null;
      afficherTransitionBiome(bio);
    } else if(fl){
      fl.classList.remove('avt-popup-actif');
      // fluidePhase('repos') nettoie les classes de couleur (dont le violet
      // de combat) laissées sur le chrono et le verdict ; fluidePret()
      // recalcule ensuite l'affichage pour le tour de marche qui reprend
      fluidePhase('repos'); fluidePret();
    }
  }, victoire ? 1000 : 1200);
}

// Écran de transition entre deux biomes, affiché une fois le popup de
// victoire refermé — plein écran, isolé du HUD de combat.
// Écran de victoire d'un gardien : nom, tournure aléatoire, récit de départ
// propre au biome qu'on quitte. Remplace le petit popup pour les boss
// uniquement — un monstre lambda garde le popup existant.
// Écran de décision à un embranchement : un récit, un bouton par biome
// accessible. Le choix pose S.avt.biomeId et enchaîne sur l'écran de
// transition habituel, comme pour un chemin sans embranchement.
function afficherDecisionBiome(biomeQuitteId, options){
  document.getElementById('avt-dec-recit').textContent
    = RECIT_DECISION_AVT[biomeQuitteId] || 'Le chemin se divise devant vous.';
  const conteneur = document.getElementById('avt-dec-choix');
  conteneur.innerHTML = options.map(id => {
    const b = biomeParId(id);
    return '<button class="bouton" data-biome="' + id + '">'
      + (b ? b.n : id) + '</button>';
  }).join('');
  [...conteneur.querySelectorAll('button')].forEach(bouton => {
    bouton.onclick = () => {
      const choix = bouton.dataset.biome;
      S.avt.biomeId = choix;
      if(!S.avt.visites.includes(choix)) S.avt.visites.push(choix);
      S.avt.decisionEnAttente = null;
      document.getElementById('avt-decision').classList.remove('on');
      afficherTransitionBiome(choix);
    };
  });
  const fl = document.getElementById('fluide');
  if(fl) fl.classList.add('avt-popup-actif');
  document.getElementById('avt-decision').classList.add('on');
}

// Événement de chemin secret : un récit, deux issues. « Rester là » ne
// change rien à la marche — rien n'a été remis à zéro puisqu'on n'est
// jamais entré en combat.
function afficherEvenementSecret(cibleId){
  const origineId = S.avt.biomeId;   // capturé avant toute mutation
  document.getElementById('avt-secret-recit').textContent
    = RECIT_SECRET_AVT[cibleId] || "Un chemin détourné s'ouvre, à peine visible.";
  document.getElementById('avt-secret-aller').onclick = () => {
    S.avt.biomeId = cibleId;
    if(!S.avt.visites.includes(cibleId)) S.avt.visites.push(cibleId);
    // règle spéciale : Enfer atteint par le chemin secret de Grotte change
    // sa propre sortie (voir PARCOURS_AVT.enfer.sortieDepuisGrotte)
    if(cibleId === 'enfer' && origineId === 'grotte') S.avt.enferViaGrotte = true;
    document.getElementById('avt-secret').classList.remove('on');
    afficherTransitionBiome(cibleId);
  };
  document.getElementById('avt-secret-rester').onclick = () => {
    document.getElementById('avt-secret').classList.remove('on');
    const fl = document.getElementById('fluide');
    if(fl) fl.classList.remove('avt-popup-actif');
    fluidePhase('repos'); fluidePret();
  };
  const fl = document.getElementById('fluide');
  if(fl) fl.classList.add('avt-popup-actif');
  document.getElementById('avt-secret').classList.add('on');
}

// Hub Station : un bouton par lieu déjà visité (hors le lieu courant et
// Station elle-même), plus la possibilité de rester sur place.
function afficherStationHub(){
  const conteneur = document.getElementById('avt-station-choix');
  const options = (S.avt.visites || [])
    .filter(id => id !== S.avt.biomeId && id !== 'station');
  if(!options.length){
    conteneur.innerHTML = '<p style="color:var(--gris);font-size:12.5px;'
      + 'font-family:var(--cond)">Aucun autre lieu encore visité.</p>';
  } else {
    conteneur.innerHTML = options.map(id => {
      const b = biomeParId(id);
      return '<button class="bouton fantome" data-biome="' + id + '">'
        + (b ? b.n : id) + '</button>';
    }).join('');
    [...conteneur.querySelectorAll('button')].forEach(bouton => {
      bouton.onclick = () => {
        const choix = bouton.dataset.biome;
        S.avt.biomeId = choix;
        if(!S.avt.visites.includes(choix)) S.avt.visites.push(choix);
        document.getElementById('avt-station').classList.remove('on');
        afficherTransitionBiome(choix);
      };
    });
  }
  document.getElementById('avt-station-rester').onclick = () => {
    document.getElementById('avt-station').classList.remove('on');
    const fl = document.getElementById('fluide');
    if(fl) fl.classList.remove('avt-popup-actif');
    fluidePhase('repos'); fluidePret();
  };
  const fl = document.getElementById('fluide');
  if(fl) fl.classList.add('avt-popup-actif');
  document.getElementById('avt-station').classList.add('on');
}

function afficherVictoireBoss(nom, biomeQuitteId){
  const idx = rangBiomeAvt(biomeQuitteId);
  const recit = RECIT_DEPART_AVT[Math.min(RECIT_DEPART_AVT.length - 1, idx)]
    || (nom + " s'efface derrière vous.");
  const tournure = TOURNURES_DEFAITE[Math.floor(Math.random() * TOURNURES_DEFAITE.length)];
  document.getElementById('avt-boss-nom').textContent = tournure(nom);
  document.getElementById('avt-boss-recit').textContent = recit;
  const fl = document.getElementById('fluide');
  if(fl) fl.classList.add('avt-popup-actif');
  document.getElementById('avt-boss-vaincu').classList.add('on');
 // À intégrer dans afficherVictoireBoss()
  trackEvent('unlock_achievement', {
    achievement_id: 'boss_vaincu',
    achievement_name: nom, // Le nom du boss (ex: "Le Guetteur des lianes")
    biome: biomeQuitteId
  });
}

function afficherTransitionBiome(id){
  const b = BIOMES.find(x => x.id === id) || {n: id};
  document.getElementById('avt-trans-nom').textContent = b.n;
  document.getElementById('avt-trans-recit').textContent
    = RECIT_BIOME_AVT[id] || "Le paysage change du tout au tout.";
  document.getElementById('avt-transition').classList.add('on');
}

// Rencontre aléatoire : un monstre lambda (faible ou moyen) du biome courant,
// jamais un gardien. Même mécanique de résolution, un combat plus court.
function entrerCombatMonstre(type){
  const m = monstresDe(biomeAvtCourant().id)[type];
  S.avt.enCombat = true;
  S.avt.typeCible = type;
  S.avt.nomCible = m.n;
  S.avt.pvBoss = m.pv;
  S.avt.pvMax = m.pv;
  S.avt.degatsCible = degatsMonstre(m);
  // idem : la vie du joueur persiste, aucune remise à fond entre deux combats
  S.avt.coups = 0;
  S.avt.recompenseCible = {xp:m.xp, or:m.or};
  $('f-verdict').style.visibility = 'hidden';
  annoncerMonstre(m.n);
  chronoAZeroImmediat();
}
// nom affiché de la cible en combat, quel que soit son type — jamais de
// mention du palier (faible/moyen/gardien) : le joueur le découvre à l'usage
const nomCibleCombat = () => S.avt.typeCible === 'gardien' ? gardienNom() : S.avt.nomCible;

/* ─── écran de boutique ─── */
// Écran d'accueil Aventure : reprise disponible ou nouvelle expédition,
// plus l'accès à la personnalisation (la Boutique, déjà existante).
function construireAventureAccueil(){
  const r = repriseAvtDispo(), M = avtMem();
  const niv = niveauDe(M.xp);
  const seuilBas = niv > 0 ? xpPourNiveau(niv) : 0;
  const seuilHaut = niv < NIVEAUX_AVT ? xpPourNiveau(niv + 1) : seuilBas;
  const pc = niv >= NIVEAUX_AVT ? 100
    : Math.max(0, Math.min(100, Math.round((M.xp - seuilBas) / (seuilHaut - seuilBas) * 100)));
  $('av-niveau').textContent = niv;
  $('av-niveau-barre').style.width = pc + '%';
  $('av-niveau-xp').textContent = niv >= NIVEAUX_AVT
    ? M.xp + ' xp · niveau maximum'
    : M.xp + ' / ' + seuilHaut + ' xp';
  $('av-niveau-or').textContent = (M.or || 0) + ' or';
  $('av-lancer').textContent = r ? 'Reprendre l\'expédition' : 'Nouvelle expédition';
  $('av-resume').textContent = r
    ? 'Tour ' + r.tour + ' · ' + r.gardiens + ' gardien' + (r.gardiens > 1 ? 's' : '')
      + ' abattu' + (r.gardiens > 1 ? 's' : '') + ' · reprise laissée en cours de route'
    : M.parties
      ? M.parties + ' expédition' + (M.parties > 1 ? 's' : '') + ' déjà tentée'
        + (M.parties > 1 ? 's' : '')
      : "Première expédition. Le bâton et la tunique sont fournis — la Boutique "
        + "permet de les remplacer dès que vous avez de l'or.";
}

function construireCompetences(){
  const M = avtMem();
  $('cp-points').textContent = pointsCompetenceDispo();
  const zoneEffective = ZONE_AVT + monArmure().zone + bonusZoneCompetences();
  const bonusComp = bonusZoneCompetences();
  $('cp-zone-actuelle').textContent = 'Zone actuelle : ± ' + fmt(zoneEffective)
    + (bonusComp > 0 ? ' (dont +' + fmt(bonusComp) + ' de compétences)' : '');
  const conteneur = $('cp-arbre');
  conteneur.innerHTML = '';
  Object.keys(ARBRE_AVT).forEach(cle => {
    const branche = ARBRE_AVT[cle];
    const col = document.createElement('div');
    col.className = 'cp-branche';
    col.innerHTML = '<div class="cp-branche-tete"><div class="ic">' + branche.ic
      + '</div><div class="n">' + branche.n + '</div></div>';
    branche.noeuds.forEach((noeud, i) => {
      const possede = M.competences.includes(noeud.id);
      const achetable = !possede && noeudAchetable(cle, i);
      const el = document.createElement('div');
      el.className = 'cp-noeud ' + (possede ? 'possede' : achetable ? 'achetable' : 'verrouille');
      el.innerHTML = '<span class="cout">' + noeud.cout + ' pt' + (noeud.cout > 1 ? 's' : '')
        + '</span><div class="n">' + noeud.n + '</div><div class="e">' + noeud.e + '</div>';
      if(achetable) el.onclick = () => { acheterNoeud(cle, i); construireCompetences(); };
      col.appendChild(el);
    });
    conteneur.appendChild(col);
  });
}

function construireBoutique(){
  const A = avtMem();
  // le niveau remplace l'xp brute à l'affichage : c'est l'or qui achète ici
  $('bo-xp').textContent = 'Niveau ' + niveauDe(A.xp) + ' · ' + (A.or || 0) + ' or';
  $('bo-resume').textContent = A.parties
    ? A.parties + ' expédition' + (A.parties > 1 ? 's' : '') + ' · meilleur tour atteint '
      + A.meilleur + ' · ' + A.gardiens + ' gardien' + (A.gardiens > 1 ? 's' : '') + ' abattu'
      + (A.gardiens > 1 ? 's' : '')
    : "Première expédition. Le bâton et la tunique sont fournis.";
  const ligne = (o, type, porte) => {
    const possede = (A.achats || []).includes(o.id) || o.prix === 0;
    const abordable = (A.or || 0) >= o.prix;
    return `<div class="bo-l${porte ? ' porte' : ''}" data-t="${type}" data-id="${o.id}">
      <div class="bo-n">${esc(o.n)}${porte ? '<span class="bo-eq">équipé</span>' : ''}</div>
      <div class="bo-d">${esc(o.d)}</div>
      <div class="bo-s">${type === 'arme'
        ? o.degats + ' dégâts · expérience ×' + o.xp.toFixed(2).replace('.', ',')
        : 'zone de départ ' + (o.zone ? '+ ' + fmt(o.zone) : 'de base')}</div>
      <div class="bo-b"><button ${possede ? '' : abordable ? '' : 'disabled'}>${
        porte ? 'Équipé' : possede ? 'Équiper' : o.prix + ' or'}</button></div>
    </div>`;
  };
  $('bo-armes').innerHTML   = ARMES.map(o => ligne(o, 'arme', A.arme === o.id)).join('');
  $('bo-armures').innerHTML = ARMURES.map(o => ligne(o, 'armure', A.armure === o.id)).join('');
  [...document.querySelectorAll('#boutique .bo-l button')].forEach(b => {
    b.onclick = async () => {
      const l = b.closest('.bo-l'), type = l.dataset.t, id = l.dataset.id;
      const o = (type === 'arme' ? ARMES : ARMURES).find(x => x.id === id);
      const A = avtMem();
      A.achats = A.achats || [];
      if(!A.achats.includes(o.id) && o.prix > 0){
        if((A.or || 0) < o.prix) return;
        A.or -= o.prix; A.achats.push(o.id);
      }
      if(type === 'arme') A.arme = o.id; else A.armure = o.id;
      await ecrireMem();
      sauvegarderAvtCompte();
      construireBoutique();
    };
  });
}

// cascade : le chrono ne s'arrête jamais, chaque appui vaut un tour
function tourEnchaine(t){
  const E = ENCHAINES[CFG.mode];
  const cs = enCentiemes(t - S.t0);
  const L = S.lab.laps;
  L.push(cs);
  vibrer(12);
  if(L.length >= E.n){
    S.encours = false;
    purgerMinuteries();
    S.tour = E.n; S.cible = E.n * E.pas;
    $('f-sprint').classList.remove('on', 'urgent');
    afficherResultat(cs);
    return;
  }
  S.tour = L.length + 1;
  S.cible = (L.length + 1) * E.pas;
  const e = cs - L.length * E.pas;
  const el = $('f-sprint');
  el.textContent = L.length + '/' + E.n + ' · ' + signe(e) + fmt(Math.abs(e));
  el.classList.toggle('urgent', Math.abs(e) > 8);
  // l'objectif suit sans repasser par fluidePret, qui remettrait la phase à
  // zéro. Seul le texte change : rien n'apparaît ni ne disparaît en cours de
  // mesure, sinon la mise en page bouge et le chiffre paraît sauter.
  $('f-tour').textContent = 'Appui ' + (L.length + 1) + ' / ' + E.n;
  // En mode Blind, tant que le joueur n'a pas cliqué sur "Suivant", on conserve l'ancienne cible affichée
  if (CFG.mode === 'blind' && !S.blindPret && S.cibleBlindJouee) {
    $('f-obj-cible').textContent = fmt(S.cibleBlindJouee);
  } else {
    $('f-obj-cible').textContent = fmt(S.cible);
  }
}

// générateur déterministe : la même date produit partout la même séquence
function graine(n){
  let x = n >>> 0;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
                 return x / 4294967296; };
}
// Chaque jour tire un défi dans cette liste. Les consignes sont volontairement
// courtes : on doit comprendre en une phrase, sans avoir joué avant.
const DEFIS = [
  {id:'long', n:'La longue', consigne:"Tenir 6,00 s à l'aveugle",
   detail:"Une seule cible. Le score est votre écart, au centième.",
   cible:600, essais:1, aff:'aveugle', mesure:'ecart'},
  {id:'double', n:'Deux piles', consigne:"Faire 2 piles en 10 essais",
   detail:"Chaque pile compte. Le score est le nombre de piles réussis.",
   cible:100, essais:10, mesure:'piles', but:2},
  {id:'triple', n:'Trois sur trois', consigne:"Trois cibles dans la zone, sans en rater une",
   detail:"Une seule erreur termine le défi. Le score est le nombre de réussites.",
   cible:100, essais:3, mesure:'suite'},
  {id:'court', n:'La courte', consigne:"Tenir 0,40 s au plus juste",
   detail:"Une seule cible, très brève. Le score est votre écart.",
   cible:40, essais:1, mesure:'ecart'},
  {id:'moyenne', n:'La régulière', consigne:"Cinq cibles d'une seconde, le plus régulièrement possible",
   detail:"Le score est votre écart moyen sur les cinq.",
   cible:100, essais:5, mesure:'moyenne'},
  {id:'demi', n:'La demie', consigne:"Tenir 2,50 s exactement",
   detail:"Une seule cible, sur une demi-seconde. Le score est votre écart.",
   cible:250, essais:1, mesure:'ecart'},
  {id:'huit', n:"L'endurance", consigne:"Tenir 8,00 s à l'aveugle",
   detail:"Une seule cible, très longue. Le score est votre écart.",
   cible:800, essais:1, aff:'aveugle', mesure:'ecart'}
];
const defiDuJour = () => DEFIS[jourCourant() % DEFIS.length];
const MAX_ESSAIS_DEFI = 3;
function essaisRestants(){
  const d = (MEM.defi || {});
  return d.jour === jourCourant() ? Math.max(0, MAX_ESSAIS_DEFI - (d.n || 0))
                                  : MAX_ESSAIS_DEFI;
}
function consommerEssai(){
  const j = jourCourant();
  MEM.defi = (MEM.defi && MEM.defi.jour === j)
    ? {jour:j, n:(MEM.defi.n || 0) + 1, best:MEM.defi.best}
    : {jour:j, n:1, best:null};
  majStreakDefi();
  ecrireMem();
}

const jourCourant = () => { const d = new Date();
  return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); };
// jour absolu (comparable par simple soustraction, contrairement à
// jourCourant qui encode année/mois/jour et casserait aux changements de
// mois) : sert uniquement à savoir si la série quotidienne se poursuit.
const jourEpoque = () => Math.floor(Date.now() / 86400000);

/* ESSAI EN TEST — série quotidienne du défi du jour (point 3, non déployé
   à tout le monde : voir carteMode). Un jour ne compte qu'une fois, même
   avec plusieurs tentatives ; un jour sauté remet la série à 1. */
function majStreakDefi(){
  const j = jourEpoque(), s = MEM.defiStreak || {jour:null, n:0};
  if(s.jour === j) return;                 // déjà compté aujourd'hui
  MEM.defiStreak = {jour:j, n:s.jour === j - 1 ? s.n + 1 : 1};
}

/* ════════ BIOMES ════════ */
// Survie change de décor tous les trente tours. Le biome ne touche jamais
// les règles : c'est une récompense visuelle qui marque le chemin parcouru.
const BIOMES = [
  {id:'jungle',  n:'Jungle',   accent:'#4FD07A', halo:'rgba(79,208,122,.15)',
   fond:'rgba(10,30,18,.75)', gamme:[220.00, 261.63, 329.63, 392.00],
   d:"Terrain neutre. Aucun effet, c'est l'étalon.",
   malus:null, bonus:null, eff:{}},

  {id:'orage',   n:'Orage',    accent:'#9FC2FF', halo:'rgba(120,150,255,.14)',
   fond:'rgba(20,24,48,.9)',  gamme:[146.83, 174.61, 220.00, 293.66],
   d:"Des éclairs cassent la concentration.",
   malus:'Flash blanc aléatoire', bonus:'Zone de départ +0,05',
   eff:{flash:true, zoneDep:5}},

  {id:'corail',  n:'Corail',   accent:'#FF96BE', halo:'rgba(255,150,190,.13)',
   fond:'rgba(38,14,26,.82)', gamme:[185.00, 233.08, 277.18, 369.99],
   d:"Le courant fait vibrer le chiffre par moments.",
   malus:'Le chrono tremble par intermittence', bonus:'Un pile rapporte 5',
   eff:{tremble:true, pile:5}},

  {id:'desert',  n:'Désert',   accent:'#E8A33D', halo:'rgba(232,163,61,.16)',
   fond:'rgba(46,30,10,.7)',  gamme:[233.08, 293.66, 349.23, 415.30],
   d:"L'air tremble. Le chiffre se dérobe sans prévenir.",
   malus:'Chrono clignotant en permanence', bonus:'Un pile rapporte 5',
   eff:{clignote:true, pile:5}},

  {id:'toundra', n:'Toundra',  accent:'#BFE1F5', halo:'rgba(190,225,245,.14)',
   fond:'rgba(30,44,58,.8)',  gamme:[220.00, 277.18, 329.63, 440.00],
   d:"Le blizzard souffle par bourrasques et le givre gagne du terrain.",
   malus:'Bourrasques de neige · le givre s\'épaissit', bonus:'Usure réduite d\'un centième',
   eff:{voile:true, usure:-1}},

  {id:'ocean',   n:'Océan',    accent:'#3FB8D4', halo:'rgba(63,184,212,.18)',
   fond:'rgba(6,28,42,.82)',  gamme:[196.00, 246.94, 293.66, 349.23],
   d:"La pression monte. Punit la prudence.",
   malus:'Usure augmentée d\'un centième', bonus:'Un pile rapporte 6',
   eff:{usure:1, pile:6}},

  {id:'faille',  n:'Faille',   accent:'#A078FF', halo:'rgba(160,120,255,.15)',
   fond:'rgba(18,10,32,.88)', gamme:[155.56, 207.65, 246.94, 311.13],
   d:"Un tour sur six se rejoue. Seul le second compte.",
   malus:'Un tour sur six rejoué', bonus:'Deux piles d\'affilée donnent une vie',
   eff:{boucle:6, vieRapide:true}},

  {id:'grotte',  n:'Grotte',   accent:'#5AD2DC', halo:'rgba(90,210,220,.16)',
   fond:'rgba(12,26,30,.85)', gamme:[164.81, 196.00, 246.94, 329.63],
   d:"La pénombre. On distingue mal le chiffre.",
   malus:'Chrono à peine visible', bonus:'Deux vies possibles',
   eff:{penombre:true, vies:2}},

  {id:'marais',  n:'Marais',   accent:'#5AFFC8', halo:'rgba(90,255,200,.13)',
   fond:'rgba(6,26,22,.86)', gamme:[155.56, 196.00, 233.08, 311.13],
   d:"Le chrono défile par à-coups. La mesure, elle, est exacte.",
   malus:'Défilement saccadé du chrono', bonus:'Le frôlé passe à 5 centièmes',
   eff:{saccade:true, seuil:5}},

  {id:'horlogerie', n:'Horlogerie', accent:'#C9A227', halo:'rgba(201,162,39,.17)',
   fond:'rgba(34,26,10,.8)',  gamme:[261.63, 329.63, 392.00, 523.25],
   d:"Le mécanisme tourne à l'envers. Le chrono décompte.",
   malus:'Le chrono descend au lieu de monter', bonus:'Un pile rapporte 8 centièmes',
   eff:{rebours:true, pile:8}},

  {id:'metropole', n:'Métropole', accent:'#FF3C8C', halo:'rgba(255,60,140,.14)',
   fond:'rgba(14,6,26,.9)',   gamme:[220.00, 261.63, 349.23, 415.30],
   d:"Les néons changent la couleur du chiffre.",
   malus:'Couleur du chiffre alternée', bonus:'Un pile rapporte 5',
   eff:{neons:true, pile:5}},

  {id:'station', n:'Station',  accent:'#E6E6F0', halo:'rgba(230,230,240,.10)',
   fond:'rgba(28,30,38,.85)', gamme:[261.63, 349.23, 392.00, 523.25],
   d:"Un tour sur cinq passe en alerte rouge.",
   malus:'Zone divisée par deux 1 tour sur 5', bonus:'Un tour d\'alerte réussi rend 8 centièmes',
   eff:{alerte:5}},

  {id:'incendie',n:'Incendie', accent:'#FF5B2E', halo:'rgba(255,91,46,.20)',
   fond:'rgba(44,10,4,.8)',   gamme:[261.63, 311.13, 392.00, 466.16],
   d:"Quatre secondes pour lancer, pas une de plus.",
   malus:'Départ forcé après 4 secondes', bonus:'Le pari ne coûte que 2 centièmes',
   eff:{urgence:4000, pari:2}},

  {id:'ruines',  n:'Ruines',   accent:'#E8C48C', halo:'rgba(255,220,140,.14)',
   fond:'rgba(36,28,14,.82)', gamme:[220.00, 261.63, 293.66, 349.23],
   d:"Le sol s'effrite. L'usure ne s'annule plus jamais.",
   malus:'L\'usure ne s\'annule jamais', bonus:'Les gains sont majorés de moitié',
   eff:{effritement:true, majGain:true}},

  {id:'abysses', n:'Abysses',  accent:'#78FFDC', halo:'rgba(30,90,110,.2)',
   fond:'rgba(6,20,26,.9)',   gamme:[116.54, 146.83, 174.61, 233.08],
   d:"Noir total. Plus rien que le chiffre.",
   malus:'Aucun repère à l\'écran', bonus:'Usure réduite d\'un centième',
   eff:{noir:true, usure:-1}},

  {id:'reseau',  n:'Réseau',   accent:'#5AF0FF', halo:'rgba(90,240,255,.12)',
   fond:'rgba(4,20,26,.9)',  gamme:[246.94, 293.66, 369.99, 493.88],
   d:"Rien ne filtre. Ni le chiffre, ni l'écart, ni la zone.",
   malus:'Aucun retour après validation', bonus:'Sauvegarde Cloud : ressuscite au début du biome (1 fois)',
   eff:{masque:true, cloud:true}},

  {id:'spatial', n:'Spatial',  accent:'#B98CFF', halo:'rgba(185,140,255,.17)',
   fond:'rgba(10,8,28,.85)',  gamme:[174.61, 220.00, 261.63, 349.23],
   d:"Un tour sur trois se joue à l'aveugle.",
   malus:'Chrono masqué 1 tour sur 3', bonus:'Un tour aveugle réussi vaut double',
   eff:{aveugle:3, doubleAveugle:true}},

  {id:'enfer',   n:'Enfer',    accent:'#FF3020', halo:'rgba(255,48,32,.20)',
   fond:'rgba(21,2,4,.92)',  gamme:[138.59, 164.81, 207.65, 277.18],
   d:"Aucun bonus. Ici, la perfection se paie.",
   malus:'Un pile coûte 4 centièmes · aucune vie · usure jamais annulée',
   bonus:null,
   eff:{enfer:true, effritement:true, sansVie:true, reset:30}},

  {id:'paradis', n:'Paradis',  accent:'#C9A227', halo:'rgba(201,162,39,.14)',
   fond:'rgba(244,241,230,.92)', gamme:[261.63, 329.63, 392.00, 523.25],
   d:"Aucun malus. Un pile te fait gagner un tour.",
   malus:null,
   bonus:'Un pile fait sauter un tour · usure divisée par deux · zone au plafond',
   eff:{paradis:true, clair:true, demiUsure:true, plafondDepart:true}},

  {id:'aurore',  n:'Aurore',   accent:'#78FFB4', halo:'rgba(120,255,180,.13)',
   fond:'rgba(8,20,16,.85)',  gamme:[196.00, 246.94, 293.66, 392.00],
   d:"L'arrivée. Plus aucune contrainte.",
   malus:null, bonus:'Plafond de zone relevé de 5 centièmes',
   eff:{plafond:5}}
];
const effB = c => {
  // Aventure : les décors ne donnent plus rien, ils ne font que gêner
  if(CFG.mode === 'aventure' && BONUS_BIOME.includes(c)) return 0;
  const b = biomeCourant(); return (b && b.eff && b.eff[c]) || 0;
};

/* ════════ DÉCORS EN ESSAI ════════ */
// Les dix décors du document de propositions. Ils ne sont PAS dans la
// progression : on ne peut les atteindre que depuis l'onglet Test, par un décor
// forcé. Chacun ne garde qu'un malus et qu'un bonus — le document en proposait
// trois de chaque, mais trois effets simultanés rendent un décor illisible.
const BIOMES_TEST = [
  {id:'cite', n:'Cité engloutie', accent:'#6FD3E8', halo:'rgba(111,211,232,.16)',
   fond:'rgba(6,32,43,.82)', gamme:[164.81, 196.00, 246.94, 329.63],
   d:"Des tours brisées défilent au fond de l'eau.",
   malus:'La pression use un centième de plus par tour',
   bonus:'Un frôlement rapporte 5 au lieu de 3',
   eff:{usure:1, frole:5}},

  {id:'chantier', n:'Chantier', accent:'#FFB020', halo:'rgba(255,176,32,.16)',
   fond:'rgba(42,28,6,.8)', gamme:[130.81, 174.61, 196.00, 261.63],
   d:"Grues et poutrelles se croisent en fond.",
   malus:'Un tour sur cinq, le chiffre des dixièmes est masqué',
   bonus:'La zone ne descend jamais sous 0,08',
   eff:{dixiemes:5, plancher:8}},

  {id:'serre', n:'Serre', accent:'#7BE3A0', halo:'rgba(123,227,160,.15)',
   fond:'rgba(10,36,22,.78)', gamme:[196.00, 246.94, 293.66, 392.00],
   d:"Des plantes poussent lentement sur les bords.",
   malus:'Buée permanente sur le chiffre',
   bonus:'Usure divisée par deux',
   eff:{voile:true, demiUsure:true}},

  {id:'mine', n:'Mine', accent:'#C89B5A', halo:'rgba(200,155,90,.15)',
   fond:'rgba(30,20,8,.82)', gamme:[146.83, 174.61, 220.00, 293.66],
   d:"Des wagonnets passent au premier plan.",
   malus:'Le grisou souffle la lampe · noir complet, entre un tour sur trois et un sur huit',
   bonus:'Un pile rapporte 7 centièmes',
   eff:{noirMine:true, pile:7}},

  {id:'autoroute', n:'Autoroute', accent:'#FF6B4A', halo:'rgba(255,107,74,.15)',
   fond:'rgba(11,10,22,.86)', gamme:[123.47, 155.56, 207.65, 246.94],
   d:"Des phares défilent en sens inverse.",
   malus:'Un klaxon éclate à contretemps',
   bonus:'Zone remise à 0,25 en entrant',
   eff:{klaxon:true, reset:25}},

  {id:'biblio', n:'Bibliothèque', accent:'#D8C89A', halo:'rgba(216,200,154,.14)',
   fond:'rgba(28,22,8,.8)', gamme:[220.00, 261.63, 311.13, 415.30],
   d:"Des rayonnages glissent doucement.",
   malus:'Silence total · aucun son, aucune vibration',
   bonus:'Le frôlement passe à 4 centièmes',
   eff:{muet:true, seuil:4}},

  {id:'volcan', n:'Volcan', accent:'#FF4530', halo:'rgba(255,69,48,.17)',
   fond:'rgba(26,6,4,.86)', gamme:[138.59, 164.81, 207.65, 277.18],
   d:"Des coulées descendent en arrière-plan.",
   malus:'Les cendres font clignoter le chiffre',
   bonus:'Un pile rapporte 8 centièmes',
   eff:{clignote:true, pile:8}},

  {id:'aero', n:'Aérodrome', accent:'#9FD8FF', halo:'rgba(159,216,255,.15)',
   fond:'rgba(10,24,38,.8)', gamme:[174.61, 220.00, 261.63, 349.23],
   d:"Des avions traversent lentement le ciel.",
   malus:'Décollage forcé après cinq secondes',
   bonus:'Zone remise à 0,30 en entrant',
   eff:{urgence:5, reset:30}},

  {id:'cirque', n:'Cirque', accent:'#FF7BC8', halo:'rgba(255,123,200,.16)',
   fond:'rgba(38,7,26,.84)', gamme:[184.997, 233.08, 277.18, 369.99],
   d:"Un chapiteau et des projecteurs tournent.",
   malus:'Un projecteur laisse le reste dans la pénombre',
   bonus:'Deux vies possibles au lieu d\'une',
   eff:{penombre:true, vies:2}},

  {id:'banquise', n:'Banquise', accent:'#BFEFFF', halo:'rgba(191,239,255,.14)',
   fond:'rgba(12,28,36,.8)', gamme:[196.00, 246.94, 293.66, 392.00],
   d:"Des blocs de glace dérivent lentement.",
   malus:'Le gel ajoute 30 ms à chaque appui',
   bonus:'L\'usure ne dépasse jamais 2 centièmes',
   eff:{gel:30, usureMax:2}}
];
const estBiomeTest = id => BIOMES_TEST.some(b => b.id === id);
const biomeParId = id => BIOMES.find(b => b.id === id)
                      || BIOMES_TEST.find(b => b.id === id) || null;

const biomeCourant = () => {
  // Aventure : on ne change de décor qu'en abattant le gardien, jamais au
  // milieu d'un combat — sinon le sol changerait sous les pieds du joueur.
  // Ce calcul ne dépend d'aucun réglage Survie : l'identité du biome fait
  // partie du cœur de l'Aventure, pas une option.
  if(CFG.mode === 'aventure') return biomeAvtCourant();
  if(!CFG.sv || !CFG.sv.biomes) return null;
  return CFG.mode === 'survie' ? biomeDe(S.tour) : null;
};
const TOURS_BIOME = 30;
// S.biomeForce n'est posé que par l'onglet Test : en partie normale, le décor
// reste strictement dérivé du numéro de tour, donc identique pour tout le monde.
const biomeDe = tour => S.biomeForce
  ? (biomeParId(S.biomeForce) || BIOMES[0])
  : BIOMES[Math.min(BIOMES.length - 1, Math.floor((tour - 1) / TOURS_BIOME))];

// Effets visuels propres au biome : clignotement, néons, noir total, flash.
// Boucles d'effets ponctuels. Elles tournent en continu, indépendamment des
// clics du joueur : une minuterie relancée à chaque appui n'arrive jamais à
// terme si le joueur enchaîne les tours.
const boucles = {};
function lancerBoucleEffet(nom, action, mini, variation){
  if(boucles[nom]) return;                 // déjà en route, on n'y touche pas
  const pas = () => {
    if(!S.partie || (CFG.mode !== 'survie' && CFG.mode !== 'aventure')){
      arreterBoucleEffet(nom); return;
    }
    action();
    boucles[nom] = setTimeout(pas, mini + Math.random() * variation);
  };
  boucles[nom] = setTimeout(pas, 800 + Math.random() * variation);
}
function arreterBoucleEffet(nom){
  if(boucles[nom]){ clearTimeout(boucles[nom]); boucles[nom] = null; }
}
function arreterToutesBoucles(){ Object.keys(boucles).forEach(arreterBoucleEffet); }

function appliquerEffetsBiome(){
  const F = $('fluide');
  F.classList.toggle('noir-total', !!effB('noir'));
  // Océan : option à l'essai · le chiffre est flou, comme sous l'eau
  const sousEau = (CFG.mode === 'aventure' || (CFG.sv && CFG.sv.flouOcean))
                  && biomeCourant() && biomeCourant().id === 'ocean';
  F.classList.toggle('flou-eau', sousEau);
  const C = $('f-chrono');
  if(effB('neons')) C.style.color = S.tour % 2 ? '#FF3C8C' : '#00E6FF';
  else C.style.removeProperty('color');
  // toggle() ne relance rien si la classe est déjà là : les animations de
  // fond continuent de tourner pendant que le joueur joue
  C.classList.toggle('clignote', !!effB('clignote'));   // Désert
  C.classList.toggle('penombre', !!effB('penombre'));   // Grotte
  C.classList.toggle('tremble',  !!effB('tremble'));    // Corail
  // Toundra : le voile respire, et son opacité monte au fil des trente tours
  const voile = !!effB('voile');
  F.classList.toggle('voile', voile);
  // couche de fond animée : réglage optionnel en Survie (onglet Test),
  // toujours active en Aventure (posée par majBiome, jamais désactivée ici)
  if(CFG.mode === 'survie')
    $('f-fond').classList.toggle('on', !!(CFG.sv && CFG.sv.fonds && CFG.sv.biomes));
  if(voile){
    // du givre léger au premier tour à un blizzard dense au trentième —
    // la progression dans le biome se lit différemment selon le mode :
    // Survie cycle en continu sur S.tour, l'Aventure compte ses pas depuis
    // le dernier gardien (S.avt.pas)
    const progression = CFG.mode === 'aventure' && S.avt
      ? S.avt.pas % TOURS_AVT
      : (S.tour - 1) % TOURS_BIOME;
    const denom = (CFG.mode === 'aventure' ? TOURS_AVT : TOURS_BIOME) - 1;
    const avance = progression / Math.max(1, denom);
    F.style.setProperty('--givre', (0.10 + avance * 0.26).toFixed(3));
    lancerBoucleEffet('bourrasque', bourrasque, 2600, 3400);
  } else {
    F.style.removeProperty('--givre');
    arreterBoucleEffet('bourrasque');
  }
  if(effB('flash')) lancerBoucleEffet('eclair', eclair, 2200, 3600);
  else arreterBoucleEffet('eclair');
}
// Une bourrasque : deux secondes où l'on ne distingue presque plus rien.
function bourrasque(){
  const B = $('f-bourrasque');
  B.classList.remove('on'); void B.offsetWidth; B.classList.add('on');
  souffle({type:'highpass', freq:2600, vol:.045, duree:2.0});
  setTimeout(() => B.classList.remove('on'), 2100);
}

function eclair(){
  grondement({de:110, a:34, duree:1.6, vol:.09});
  const E = $('f-eclair');
  E.classList.remove('on'); void E.offsetWidth; E.classList.add('on');
  setTimeout(() => E.classList.remove('on'), 140);
}

function majBiome(){
  const F = $('fluide');
  // une partie terminée ne change plus de décor : la carte masquerait
  // l'écran de fin et bloquerait le bouton
  // Survie garde son réglage optionnel ; l'Aventure n'en a pas d'équivalent —
  // et n'en a pas besoin, l'identité visuelle du biome fait partie du cœur
  // de l'expérience, jamais une option qu'on pourrait couper
  const actif = S.partie && !partieFinie() && (
    (CFG.mode === 'survie' && CFG.sv && CFG.sv.biomes) || CFG.mode === 'aventure'
  );
  if(!actif){
    F.removeAttribute('data-biome');
    F.style.removeProperty('--bio-accent');
    F.style.removeProperty('--bio-halo');
    F.style.removeProperty('--bio-fond');
    $('f-biome').classList.remove('on');
    S.biome = null;
    return;
  }
  const b = biomeCourant() || biomeDe(S.tour);
  if(S.biome === b.id) return;
  if(S.retourDetail){ S.retourDetail = false; return; }
  const change = S.biome !== null && S.biome !== undefined;
  // le décor quitté conservait-il les vies ? sinon on repart à zéro
  if(change && CFG.mode === 'survie' && S.partie){
    // certains décors imposent leur zone de départ : on entre à égalité
    if(b.eff && b.eff.reset) S.zoneSurvie = b.eff.reset;
    if(b.eff && b.eff.plafondDepart) S.zoneSurvie = plafondSurvie(S.tour);
    const prec = BIOMES.find(x => x.id === S.biome);
    if(!(prec && prec.eff && prec.eff.viesGardees)) S.vies = Math.min(S.vies, viesMax());
    S.boucleFaite = false;
  }
  S.biome = b.id;
  F.setAttribute('data-biome', b.id);
  F.style.setProperty('--bio-accent', b.accent);
  F.style.setProperty('--bio-halo', b.halo);
  F.style.setProperty('--bio-fond', b.fond);
  // en Aventure, la couche de fond animée est toujours active — elle ne
  // dépend pas du réglage Survie (CFG.sv.fonds), qui n'a pas d'équivalent ici
  if(CFG.mode === 'aventure') $('f-fond').classList.add('on');
  const E = $('f-biome');
  E.textContent = b.n;
  E.classList.add('on');
  // en Aventure, l'écran de transition dédié (récit steampunk, propre à ce
  // mode) annonce déjà le changement de biome : cette cérémonie-ci (carte de
  // règles + cinématique), pensée pour Survie, ferait double emploi
  if(change && CFG.mode !== 'aventure'){
    const style = (CFG.sv && CFG.sv.intro) || 'cine';
    const bloque = !!(CFG.sv && CFG.sv.bloquer);
    // La carte des règles vient d'abord ; l'animation ne part qu'à sa
    // fermeture, pour qu'on la regarde au lieu de lire par-dessus.
    if(bloque) verrouillerDepart(true);
    E.classList.remove('surgir');
    annoncerEffet(b, bloque, () => {
      lancerCine(b);
      E.classList.remove('surgir'); void E.offsetWidth; E.classList.add('surgir');
      // la classe est retirée à la fin, sinon elle traîne et fausse tout
      if(S.tSurgir) clearTimeout(S.tSurgir);
      S.tSurgir = setTimeout(() => E.classList.remove('surgir'), 2900);
      sonBiome();
    });
  }
}
// Cinématique courte : un effet plein écran qui illustre le biome, une seconde.
function lancerCine(b){
  const C = $('f-cine');
  C.className = 'cine on cine-' + b.id;
  C.style.setProperty('--cin', b.accent);
  if(S.tCine) clearTimeout(S.tCine);
  S.tCine = setTimeout(() => C.className = 'cine', 1200);
}

// Bascule bloquante : le bouton Démarrer reste inactif tant que l'animation
// et les règles n'ont pas été vues.
function verrouillerDepart(on){
  S.departVerrou = !!on;
  const D = $('f-droite');
  if(D){ D.disabled = !!on; D.classList.toggle('verrou', !!on); }
}

function annoncerEffet(b, attendreOk, apres){
  const A = $('f-effet');
  A.innerHTML = `<div class="ef-carte" style="border-color:${b.accent}">`
    + htmlRegles(reglesBiome(b), 'ef')
    + `<button class="ef-ok" style="border-color:${b.accent};color:${b.accent}">`
    + (attendreOk ? 'Commencer' : 'Compris') + '</button></div>';
  A.classList.add('on');
  A.classList.toggle('bloquant', !!attendreOk);
  let fait = false;
  const fermer = () => {
    if(fait) return;
    fait = true;
    A.classList.remove('on', 'bloquant');
    if(S.tEffet){ clearTimeout(S.tEffet); S.tEffet = null; }
    verrouillerDepart(false);
    if(apres) apres();
  };
  A.querySelector('.ef-ok').onclick = ev => { ev.stopPropagation(); fermer(); };
  A.onclick = ev => { ev.stopPropagation(); fermer(); };
  if(S.tEffet) clearTimeout(S.tEffet);
  // un essai de biome attend l'appui : on veut lire les règles avant de jouer
  S.tEffet = attendreOk ? null : setTimeout(fermer, 5600);
}
function sonBiome(){
  if(!CFG.sv || !CFG.sv.son) return;
  grondement({de:64, a:28, duree:1.6, vol:.06});     // la secousse du changement
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => bip(f, .22, .04), i * 110));
  const f = AMBIANCES[S.biome];
  if(f) setTimeout(f, 620);                          // puis l'ambiance du nouveau lieu
}

/* ════════ SON ET RETOUR HAPTIQUE ════════ */
// Un contexte audio unique, créé au premier appui : les navigateurs refusent
// de le démarrer sans geste de l'utilisateur.
let ctxAudio = null;
function audio(){
  if(ctxAudio) return ctxAudio;
  try{ ctxAudio = new (window.AudioContext || window.webkitAudioContext)(); }
  catch(e){ ctxAudio = false; }
  return ctxAudio;
}
function bip(freq, duree, vol){
  if(!CFG.sv || !CFG.sv.son) return;
  const a = audio();
  if(!a) return;
  if(a.state === 'suspended'){ try{ a.resume(); }catch(e){} }
  try{
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || .05, a.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + duree);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + duree);
  }catch(e){}
}
function sonSurvie(quoi){
  if(muet()) return;
  ({pile:  () => { bip(880, .12, .06); setTimeout(() => bip(1320, .16, .05), 90); },
    bon:   () => bip(660, .10, .045),
    passe: () => bip(392, .08, .03),
    vie:   () => { bip(523, .12, .06); setTimeout(() => bip(784, .18, .05), 110); },
    mort:  () => { bip(196, .28, .07); setTimeout(() => bip(147, .40, .06), 160); }
  }[quoi] || (() => {}))();
}
/* ─── musique de fond ─── */
// Une nappe synthwave minimale : une basse tenue, un arpège de quatre notes,
// et un tempo qui monte quand la zone se resserre. Rien n'est préchargé :
// tout est synthétisé, donc zéro octet de plus dans l'application.
let musique = null, musPas = 0, musGain = null;
const gammeCourante = () => {
  const b = BIOMES.find(x => x.id === S.biome);
  return (b && b.gamme) || BIOMES[0].gamme;
};
function noteMus(freq, duree, vol, type){
  const a = audio();
  if(!a || !musGain) return;
  // iOS suspend le contexte dès que l'app passe en arrière-plan
  if(a.state === 'suspended'){ try{ a.resume(); }catch(e){} }
  try{
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sawtooth'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(vol, a.currentTime + .02);
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + duree);
    o.connect(g); g.connect(musGain);
    o.start(); o.stop(a.currentTime + duree);
  }catch(e){}
}
function lancerMusique(){
  arreterMusique();
  if(!CFG.sv || !CFG.sv.musique || !CFG.sv.son) return;
  const a = audio();
  if(!a) return;
  try{
    musGain = a.createGain();
    musGain.gain.value = .055;            // volontairement discret
    const filtre = a.createBiquadFilter();
    filtre.type = 'lowpass'; filtre.frequency.value = 1400;
    musGain.connect(filtre); filtre.connect(a.destination);
  }catch(e){ return; }
  musPas = 0;
  const pas = () => {
    if(!S.partie || CFG.mode !== 'survie' || !CFG.sv.musique){ arreterMusique(); return; }
    if(!musGain){ arreterMusique(); return; }
    const g = gammeCourante();
    const z = Math.max(1, S.zoneSurvie);
    const tendu = z <= ZONE_CRITIQUE;
    // basse tous les quatre temps, arpège à chaque temps
    if(musPas % 4 === 0) noteMus(g[0] / 2, .55, .10, 'triangle');
    noteMus(g[musPas % g.length] * (tendu ? 2 : 1), .28, tendu ? .06 : .045);
    if(tendu && musPas % 2 === 1) noteMus(g[3] * 2, .14, .035, 'square');
    musPas++;
    // de 480 ms au large à 260 ms en zone critique
    const ms = 260 + Math.min(1, z / 30) * 220;
    musique = setTimeout(pas, ms);
  };
  musique = setTimeout(pas, 300);
}
function arreterMusique(){
  if(musique){ clearTimeout(musique); musique = null; }
  if(musGain){ try{ musGain.disconnect(); }catch(e){} musGain = null; }
}

/* ─── ambiances et bruitages ─── */
// Tout est synthétisé : du bruit blanc filtré suffit à évoquer le vent, la
// pluie ou un grondement. Zéro fichier, zéro octet ajouté.
let bruitTampon = null;
function tamponBruit(){
  const a = audio();
  if(!a) return null;
  if(bruitTampon) return bruitTampon;
  try{
    const n = a.sampleRate * 2;
    const b = a.createBuffer(1, n, a.sampleRate);
    const d = b.getChannelData(0);
    for(let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    bruitTampon = b;
  }catch(e){ bruitTampon = null; }
  return bruitTampon;
}
// une bouffée de bruit filtré : vent, pluie, souffle, grondement
function souffle(o){
  if(!CFG.sv || !CFG.sv.son) return;
  const a = audio(), buf = tamponBruit();
  if(!a || !buf) return;
  try{
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = a.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.value = o.freq || 600;
    f.Q.value = o.q || 1;
    const g = a.createGain();
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(o.vol || .04, a.currentTime + (o.attaque || .15));
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + (o.duree || 1.2));
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(); src.stop(a.currentTime + (o.duree || 1.2) + .05);
  }catch(e){}
}
// un grondement grave, pour le tonnerre ou la secousse
function grondement(o){
  if(!CFG.sv || !CFG.sv.son) return;
  const a = audio();
  if(!a) return;
  try{
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(o.de || 70, a.currentTime);
    osc.frequency.exponentialRampToValueAtTime(o.a || 32,
      a.currentTime + (o.duree || 1.4));
    const f = a.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 260;
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(o.vol || .07, a.currentTime + .08);
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + (o.duree || 1.4));
    osc.connect(f); f.connect(g); g.connect(a.destination);
    osc.start(); osc.stop(a.currentTime + (o.duree || 1.4) + .05);
  }catch(e){}
}

// Chaque biome a son ambiance : une bouffée légère, de loin en loin.
const AMBIANCES = {
  jungle:  () => souffle({type:'bandpass', freq:2400, q:2.5, vol:.020, duree:.9}),
  orage:   () => { grondement({de:80, a:30, duree:1.8, vol:.08});
                   souffle({type:'lowpass', freq:900, vol:.035, duree:2.2}); },
  corail:  () => souffle({type:'bandpass', freq:520, q:.8, vol:.022, duree:1.6}),
  desert:  () => souffle({type:'highpass', freq:1600, vol:.024, duree:2.4}),
  toundra: () => souffle({type:'highpass', freq:2200, vol:.030, duree:2.8}),
  ocean:   () => souffle({type:'lowpass', freq:420, vol:.032, duree:2.6}),
  faille:  () => { bip(1180, .5, .03); setTimeout(() => bip(590, .7, .025), 180); },
  grotte:  () => { bip(220, .9, .022); setTimeout(() => bip(220, .6, .012), 520); },
  marais:  () => souffle({type:'bandpass', freq:300, q:1.5, vol:.026, duree:1.4}),
  horlogerie:() => { for(let i = 0; i < 4; i++)
                      setTimeout(() => bip(2100, .035, .020), i * 260); },
  metropole:() => souffle({type:'bandpass', freq:1100, q:.6, vol:.024, duree:1.5}),
  station: () => { bip(1320, .09, .028); setTimeout(() => bip(1320, .09, .028), 260); },
  incendie:() => souffle({type:'bandpass', freq:760, q:.5, vol:.034, duree:1.9}),
  ruines:  () => grondement({de:56, a:26, duree:2.2, vol:.045}),
  abysses: () => souffle({type:'lowpass', freq:180, vol:.030, duree:3.2}),
  reseau:  () => { for(let i = 0; i < 3; i++)
                    setTimeout(() => bip(1500 + i * 400, .05, .018), i * 90); },
  spatial: () => souffle({type:'lowpass', freq:260, vol:.018, duree:3.4}),
  enfer:   () => { grondement({de:48, a:22, duree:2.6, vol:.075});
                   souffle({type:'bandpass', freq:640, q:.5, vol:.032, duree:2.2}); },
  paradis: () => { [523, 659, 784].forEach((f, i) =>
                     setTimeout(() => bip(f, .9, .022), i * 340)); },
  aurore:  () => souffle({type:'bandpass', freq:1500, q:.4, vol:.022, duree:3.0})
};
let tAmbiance = null;
function lancerAmbiance(){
  arreterAmbiance();
  if(!CFG.sv || !CFG.sv.son || !CFG.sv.ambiance) return;
  const pas = () => {
    if(!S.partie || CFG.mode !== 'survie' || !CFG.sv.ambiance){ arreterAmbiance(); return; }
    const f = AMBIANCES[S.biome];
    if(f) f();
    // de loin en loin : entre 5 et 11 secondes
    tAmbiance = setTimeout(pas, 5000 + Math.random() * 6000);
  };
  tAmbiance = setTimeout(pas, 1800);
}
function arreterAmbiance(){ if(tAmbiance){ clearTimeout(tAmbiance); tAmbiance = null; } }

// battement de cœur : sa cadence suit le resserrement de la zone
let battement = null;
function lancerBattement(){
  arreterBattement();
  if(!CFG.sv || !CFG.sv.son || CFG.mode !== 'survie') return;
  const tic = () => {
    if(!S.partie || CFG.mode !== 'survie'){ arreterBattement(); return; }
    const z = Math.max(1, S.zoneSurvie);
    bip(z <= ZONE_CRITIQUE ? 150 : 110, .07, z <= ZONE_CRITIQUE ? .05 : .028);
    // de 1200 ms au large à 340 ms quand la zone est critique
    const ms = 340 + Math.min(1, z / 30) * 860;
    battement = setTimeout(tic, ms);
  };
  battement = setTimeout(tic, 900);
}
function arreterBattement(){ if(battement){ clearTimeout(battement); battement = null; } }
// Bibliothèque : plus aucun retour, ni sonore ni haptique
const muet = () => !!effB('muet');
// Chantier : l'échafaudage est une promesse, elle doit tenir sur tous les
// chemins qui rognent la zone — usure, vie consommée, sortie encaissée.
const plancherZone = () => Math.max(1, effB('plancher') || 1);
function vibrerSv(ms){ if(CFG.sv && CFG.sv.vibr && !muet()) vibrer(ms); }

/* ════════ COMBAT ════════ */
// Chaque boss est une combinaison de trois variables : largeur de garde,
// cadence, et points de vie. Rien d'autre — la variété vient du jeu, pas des chiffres.
const BOSS = [
  {id:'coucou',    n:'Le Coucou',    garde:30, cadence:100, pv:80,  degats:12,
   d:"Cadence régulière, garde large. Le combat d'apprentissage."},
  {id:'trotteuse', n:'La Trotteuse', garde:18, cadence:0,   pv:120, degats:15,
   d:"Sa cadence change à chaque coup, entre 1 et 3 secondes."},
  {id:'metronome', n:'Le Métronome', garde:10, cadence:75,  pv:140, degats:18,
   d:"Tempo serré et garde étroite. Aucune place pour l'hésitation."},
  {id:'ombre',     n:"L'Ombre",      garde:20, cadence:0,   pv:160, degats:18, aveugle:1,
   d:"Le chrono reste masqué. Il faut sentir le moment."},
  {id:'quartz',    n:'Le Quartz',    garde:6,  cadence:0,   pv:200, degats:22,
   d:"Garde minuscule, cadence imprévisible. Le dernier."}
];
const bossCourant = () => BOSS[Math.min(S.bossIdx || 0, BOSS.length - 1)];

/* ════════ ÉVÉNEMENTS ════════ */
// « fausse » : le tour est exclu du profil, la mesure n'est pas comparable
/* ════════ ÉVÉNEMENTS ════════ */
// « fausse » : le tour est exclu du profil, la mesure n'est pas comparable
const EVTS = [
  {id:'demi',    n:'Demi-seconde',  d:"La cible tombe sur X,50 s. Le repère mental saute.", fausse:1},
  {id:'longue',  n:'Longue',        d:"La cible recule d'une seconde. La dérive s'installe.", fausse:1},
  {id:'double',  n:'Double ou rien', d:"Les gorgées du tour comptent double."},
  {id:'bord',    n:'Effet de bord',  d:"Hors zone, toute la table boit."},
  {id:'bouclier',n:'Bouclier',       d:"Jeton gratuit annulant la prochaine peine."},
  {id:'yeux',    n:'Yeux fermés',    d:"L'écran reste noir pendant le tour.", fausse:1},
  {id:'demitour',n:'Demi-tour',      d:"Le sens de rotation s'inverse."},
  {id:'choix',   n:'Tu choisis',     d:"Le joueur découvre son score et désigne sa victime."},
  {id:'duel',    n:'Duel',           d:"Le joueur suivant refait le même tour pour le battre.", fausse:1}
];
const EVT = id => EVTS.find(e => e.id === id);

/* ════════ BLAGUES ════════ */
const BLAGUES = {
  parfait:  ["Pile. Il y a un quartz quelque part dans cette tête.",
             "Pile. La daronne de Jean encadre déjà la capture d'écran.",
             "Pile. Jean n'a jamais fait ça. Jean ne fera jamais ça.",
             "Pile. Même la pendule de la tante de Jean s'incline.",
             "Pile. L'arbre généalogique de Jean vient de perdre une branche d'un coup.",
             "Pile. Appelez la sœur de Jean, elle voudra vérifier elle-même.",
             "Pile. La table a le droit de réclamer un contrôle antidopage.",
             "Pile. Personne ne te croira demain matin, et c'est bien dommage."],
  excellent:["À trois centièmes. Les Suisses recrutent.",
             "Photo-finish. Il faudrait un juge de touche et deux témoins.",
             "Trois centièmes. Jean appellerait ça un exploit. Jean n'a jamais rien réussi.",
             "Si près. La sœur de Jean aurait applaudi, mais elle chronomètre au four.",
             "À ce niveau de précision, ça commence à devenir louche.",
             "Encore un centième et on convoquait un notaire.",
             "La tante de Jean vise moins bien, et elle a eu quarante ans pour s'entraîner.",
             "Presque. Mais « presque » ne fait boire personne."],
  mauvais:  ["Le chrono a eu le temps de s'ennuyer.",
             "La daronne de Jean fait le café plus vite. Et elle le fait mal.",
             "Il y avait une seconde à tenir, pas une sieste à faire.",
             "La tante de Jean a un coucou plus précis. Le coucou est mort en 1994.",
             "Techniquement, c'est encore du chronométrage. Techniquement.",
             "Jean aurait fait pareil. Prends une seconde pour digérer ça.",
             "La sœur de Jean compte les moutons plus régulièrement.",
             "On visait une seconde pleine, pas une estimation au jugé."],
  desastre: ["Ce n'est plus un écart, c'est un trajet.",
             "L'arbre généalogique de Jean est moins tordu que cette courbe.",
             "On a eu le temps de refaire l'arbre généalogique de Jean. Il y a des trous.",
             "La daronne de Jean a rappelé : même elle trouve ça long.",
             "Le chrono demande officiellement à changer de joueur.",
             "Quelqu'un peut vérifier que le téléphone n'est pas tombé quelque part ?",
             "À ce rythme, la prochaine cible tombera l'année prochaine.",
             "Jean vient d'être promu deuxième plus mauvais. Il te remercie."]
};
// séries de piles en entraînement, indexées à partir de deux d'affilée
const MOTS_SERIE = [
  "Deux d'affilée. Jean commence à transpirer.",
  "Trois d'affilée. La tante de Jean parle ouvertement de sorcellerie.",
  "Quatre. On a prévenu la sœur de Jean, elle est en route.",
  "Cinq. L'arbre généalogique de Jean demande l'asile politique.",
  "Toujours en série. La daronne de Jean a coupé son téléphone."
];
const MOTS_MINUTE = [
  "La minute pile. Ça se raconte pendant des années.",
  "Soixante secondes rondes. La daronne de Jean l'apprendra par la rumeur.",
  "Une minute au centième près. Il n'y a plus rien à ajouter.",
  "La minute. Toute la famille de Jean boit, par pure solidarité.",
  "La minute pile. Même la pendule de la tante de Jean s'est arrêtée de respect."
];
// barème v2 : le pile vaut 100, multiplié par la longueur de la série en cours
const PTS = {pile:100, frole:50, zone:20, rate:0};
const MULT_MAX = 5;
const BILAN = [
  [2500, "Range le téléphone, il n'a plus rien à t'apprendre."],
  [1400, "Solide. Le genre de score dont Jean parle en soirée sans y avoir été."],
  [700,  "Correct. Il reste de la marge, mais on sent le métier."],
  [300,  "Passable. Le chrono, lui, s'est bien amusé."],
  [0,    "Bonne nouvelle : tu bats Jean. Mauvaise nouvelle : de peu."]
];
const bilan = p => {
  const b = BILAN.find(x => p >= x[0]) || BILAN[BILAN.length-1];
  return (MASQUER_JEAN && nommeJean(b[1]) && BILAN_NEUTRE[b[0]]) || b[1];
};

// une blague seulement sur les extrêmes, et jamais deux fois la même catégorie
const MASQUER_JEAN = true;                 // Jean est en veille, pas supprimé
const nommeJean = s => /Jean/.test(s || '');
// écarte de l'affichage les répliques qui nomment Jean ; si la liste se vide,
// on retombe sur une phrase neutre plutôt que sur du vide
function sansJean(L, secours){
  if(!MASQUER_JEAN) return L;
  const f = L.filter(s => !nommeJean(s));
  return f.length ? f : [secours || ''];
}
// la série de piles : toutes les variantes nomment Jean, donc en veille on
// fabrique une phrase neutre à partir de la longueur de la série
function motSerie(chaine){
  const i = Math.min(chaine, 6) - 2;
  if(!MASQUER_JEAN) return MOTS_SERIE[i];
  return Math.min(chaine, 6) + " d'affilée. La main est chaude.";
}
// bilan de fin : deux paliers sur cinq nomment Jean, remplacés en veille
const BILAN_NEUTRE = {
  1400: "Solide. Le genre de score dont on parle en soirée.",
  0:    "Bonne nouvelle : c'est un début. Le chrono, lui, s'est bien amusé."
};

function blague(ecart){
  const z = zone();
  let cat = null;
  if(ecart === 0)          cat = 'parfait';
  else if(ecart <= PRES)   cat = 'excellent';
  else if(ecart > z * 4)   cat = 'desastre';
  else if(ecart > z * 2)   cat = 'mauvais';
  if(!cat || cat === S.derniereBlague){ S.derniereBlague = cat; return ''; }
  S.derniereBlague = cat;
  const L = sansJean(BLAGUES[cat], '');
  return L[Math.floor(Math.random() * L.length)];
}

/* ════════ RÉSEAU ════════ */
// Aucune bibliothèque externe : l'API REST de Supabase se pilote au fetch.
// Tout échec est silencieux et non bloquant — le jeu doit rester jouable
// dans une cave sans réseau.
const EN_LIGNE = () => !!(SUPABASE_URL && SUPABASE_KEY);
const CLE_FILE = 'krono.file';

async function api(chemin, options){
  if(!EN_LIGNE()) throw new Error('hors ligne');
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + chemin, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options && options.headers)
    }
  });
  if(!r.ok) throw new Error('HTTP ' + r.status + ' ' + await r.text());
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

// code de salon lisible à voix haute : ni O ni I, qu'on confond avec 0 et 1
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const nouveauCode = () => Array.from({length:5},
  () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

async function creerSalon(){
  for(let essai = 0; essai < 5; essai++){
    const code = nouveauCode();
    try{
      await api('salons', {method:'POST', body:JSON.stringify({code})});
      return code;
    }catch(e){
      if(!/409|duplicate/i.test(e.message)) throw e;   // sinon on retire au sort
    }
  }
  throw new Error('impossible de générer un code');
}
async function salonExiste(code){
  const r = await api('salons?code=eq.' + encodeURIComponent(code) + '&select=code');
  return Array.isArray(r) && r.length > 0;
}

// file d'attente : ce qui n'a pas pu partir repart au prochain lancement
function lireFile(){
  try{ return JSON.parse(localStorage.getItem(CLE_FILE) || '[]'); }catch(e){ return []; }
}
function ecrireFile(f){
  try{ localStorage.setItem(CLE_FILE, JSON.stringify(f.slice(-50))); }catch(e){}
}
async function envoyer(lignes){
  if(!EN_LIGNE() || !lignes.length) return false;
  await api('resultats', {method:'POST', body:JSON.stringify(lignes)});
  return true;
}
async function viderFile(){
  const f = lireFile();
  if(!f.length) return;
  try{ await envoyer(f); ecrireFile([]); majEtatSalon(); }catch(e){}
}

// résultats d'une partie, agrégés par joueur — aucun tour individuel n'est envoyé
function resultatsPartie(){
  if(!S.salon) return [];
  return S.joueurs.filter(n => S.stats[n] && S.stats[n].tours > 0).map(n => {
    const s = S.stats[n];
    return {
      salon: S.salon, pseudo: n, mode: CFG.mode,
      config: sigCourante(), tours: s.tours, somme: s.ecart, biais: s.biais,
      carres: s.carres, piles: s.piles, gorgees: s.gorgees, culs: s.culs,
      points: estSolo(CFG.mode) && n === S.joueurs[0] ? S.points : 0
    };
  });
}
async function publierPartie(){
  const lignes = resultatsPartie();
  if(!lignes.length) return;
  try{ await envoyer(lignes); }
  catch(e){ ecrireFile([...lireFile(), ...lignes]); }   // on réessaiera plus tard
  majEtatSalon();
}

/* ════════ TROPHÉES ════════ */
// Chaque trophée lit un profil cumulé et renvoie soit null, soit un état.
// « seuils » permet les paliers : bronze, argent, or.
const TROPHEES = [
  {id:'premier', n:'Baptême', d:"Terminer une première partie.",
   m:"Il faut bien commencer quelque part.",
   test:p => p.parties >= 1},
  {id:'pile', n:'Le pile', d:"Tomber exactement sur la seconde.",
   m:"Une seconde entière, pas un centième de plus.",
   test:p => p.piles >= 1},
  {id:'piles', n:'Horloger', d:"Cumuler des piles.", seuils:[3, 10, 25],
   m:"Une fois, c'est de la chance. Plusieurs fois, c'est autre chose.",
   valeur:p => p.piles},
  {id:'regulier', n:'Métronome', d:"Descendre sous un écart-type de régularité.",
   seuils:[15, 10, 6], inverse:true, minTours:15,
   m:"Se tromper est humain. Se tromper toujours pareil est une compétence.",
   valeur:p => Math.round(analyse(p).disp)},
  {id:'precis', n:'Chirurgien', d:"Descendre sous une précision moyenne.",
   seuils:[20, 12, 7], inverse:true, minTours:15,
   m:"La main ne tremble pas.",
   valeur:p => Math.round(analyse(p).precision)},
  {id:'centre', n:'Bien calibré', d:"Ramener son biais sous 2 centièmes.",
   minTours:20, m:"Ni trop tôt, ni trop tard. Juste au milieu.",
   test:p => Math.abs(analyse(p).moy) < 2},
  {id:'assidu', n:'Habitué', d:"Enchaîner les parties.", seuils:[5, 20, 50],
   m:"On te voit souvent par ici.",
   valeur:p => p.parties},
  {id:'marathon', n:'Marathonien', d:"Accumuler les tours joués.", seuils:[100, 500, 1500],
   m:"Le chrono a tourné longtemps entre tes mains.",
   valeur:p => p.tours},
  {id:'serie', n:'En série', d:"Enchaîner des piles en solo.", seuils:[2, 3, 5],
   m:"Deux fois de suite, ça commence à faire beaucoup.",
   valeur:p => p.serie || 0},
  {id:'score', n:'Grand score', d:"Marquer en solo.", seuils:[500, 1500, 3000],
   m:"Seul face au chrono, sans personne pour trinquer.",
   valeur:p => p.meilleurScore || 0},
  {id:'minute', n:'La minute', d:"Tomber pile sur une minute ronde.",
   m:"Quelque part, très loin, une minute entière est tombée juste.",
   test:p => (p.minutes || 0) >= 1},
  {id:'arrose', n:'Bon public', d:"Encaisser les gorgées sans broncher.", seuils:[50, 200, 500],
   m:"Tu n'as pas beaucoup de chance, mais tu as de la constance.",
   valeur:p => p.gorgees}
];
const RANGS = ['bronze','argent','or'];

// renvoie {rang, valeur, seuil, suivant} ou null si non débloqué
function etatTrophee(tr, p){
  if(!p || !p.tours) return null;
  if(tr.minTours && p.tours < tr.minTours) return null;
  if(tr.test) return tr.test(p) ? {rang:2, valeur:null} : null;
  const v = tr.valeur(p);
  let rang = -1;
  tr.seuils.forEach((s, i) => { if(tr.inverse ? v <= s : v >= s) rang = i; });
  if(rang < 0) return null;
  return {rang, valeur:v, seuil:tr.seuils[rang], suivant:tr.seuils[rang+1]};
}
function trophees(nom){
  const p = MEM.profils[nom];
  return TROPHEES.map(tr => ({tr, e:etatTrophee(tr, p)})).filter(x => x.e);
}

/* ════════ ÉTAT ════════ */
const S = { joueurs:[], idx:0, sens:1, total:0, cible:100, cibleBase:100, tour:1,
            contre:0, t0:0, encours:false, historique:[], stats:{}, jetons:{},
            evt:null, force:null, dernierEvt:-9, duel:null, prochain:null,
            partie:false, enregistre:false, enAttente:100, minuteries:[], latence:null,
            fautes:{}, elimines:[], vies:3, points:0, chaine:0, meilleureChaine:0,
            zoneTour:0, enchere:null,
            derniereBlague:null, tableauDepart:[], nbSous:0, couleurs:{}, salon:null,
            marche:1, zoneSolo:0, sequence:[], finSprint:0,
            bossIdx:0, pvBoss:0, pvMoi:0, gardeBoss:0, touches:0, critiques:0,
            phase:1, biaisPhase:0, latences:[], delais:[] };

const $ = id => document.getElementById(id);
// Au-delà de la minute, un nombre à trois chiffres devient étroit :
// on peut basculer sur 1:00,00. Réglable dans l'onglet Test.
const fmt = c => {
  if(CFG.minutes && c >= 6000){
    const m = Math.floor(c / 6000), r = c - m * 6000;
    return m + ':' + String(Math.floor(r / 100)).padStart(2, '0')
             + ',' + String(r % 100).padStart(2, '0');
  }
  return (c/100).toFixed(2).replace('.',',');
};
const esc = s => { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; };
const gorg = n => n + (n>1 ? ' gorgées' : ' gorgée');
const nomCulSec = () => CFG.gor === 'bar' ? 'shot' : 'cul sec';
const culs = n => CFG.gor === 'bar' ? n + (n>1 ? ' shots' : ' shot') : n + (n>1 ? ' culs secs' : ' cul sec');
const calcFrole = n => CFG.gor === 'appart' ? 3 : (CFG.gor === 'gros' ? n*2 : n);
const ecranJeu = () => 'fluide';
// La barre du bas s'affiche partout SAUF pendant une partie et sur les écrans
// de transition (résultat, fin) : la liste des exclus est plus courte et plus
// stable que celle des inclus, qui grandit à chaque nouvel écran.
const ONGLETS = {jouer:'reglages', ligues:'ligues', amis:'amis', panth:'pantheon', trophees:'trophees', profil:'profil'};
const ECRANS_SANS_BARRE = ['fluide', 'resultat', 'fin', 'duo', 'duo-joueurs', 'duo-mode', 'duo-reglages'];
const porteBarre = id => !ECRANS_SANS_BARRE.includes(id);

/* ─── historique de navigation ─────────────────────────────────────────
   Un bouton « ‹ » est injecté à gauche de chaque barre de navigation et
   ramène à l'écran précédemment quitté. La pile est plafonnée : sans ça,
   un aller-retour répété entre deux écrans la ferait grossir sans fin. */
const PILE_ECRANS = [];
const SANS_RETOUR = ['reglages'];   // la racine n'a nulle part où revenir
function retourEcran(){
  const cible = PILE_ECRANS.pop();
  montrer(cible || 'reglages', true);
}
function majBoutonsRetour(){
  const dispo = PILE_ECRANS.length > 0;
  document.querySelectorAll('.btn-retour').forEach(b => {
    const ec = b.closest('.ecran');
    b.style.display = (dispo && ec && !SANS_RETOUR.includes(ec.id)) ? '' : 'none';
  });
}
function injecterRetours(){
  document.querySelectorAll('.ecran .nav').forEach(nav => {
    const ec = nav.closest('.ecran');
    if(!ec || SANS_RETOUR.includes(ec.id) || nav.querySelector('.btn-retour')) return;
    const b = document.createElement('button');
    b.className = 'btn-retour';
    b.setAttribute('aria-label', 'Revenir à l\'écran précédent');
    b.textContent = '‹';
    b.onclick = retourEcran;
    nav.insertBefore(b, nav.firstChild);
  });
  majBoutonsRetour();
}

function montrer(id, sansPile){
  const ecrans = document.querySelectorAll('.ecran');
  if(![...ecrans].some(e => e.id === id)) id = S.partie ? ecranJeu() : 'reglages';
  const avant = document.querySelector('.ecran.actif');
  // le sondage du duel ne tourne que pendant que son écran est ouvert :
  // construireEcranDuel() le relance en y revenant.
  if(avant && avant.id === 'duel' && id !== 'duel') arreterSondageDuel();
  /* on n'empile ni les retours eux-mêmes, ni un écran vers lui-même */
  if(!sansPile && avant && avant.id !== id){
    PILE_ECRANS.push(avant.id);
    if(PILE_ECRANS.length > 12) PILE_ECRANS.shift();
  }
  ecrans.forEach(e => {
    const actif = e.id === id;
    e.classList.toggle('actif', actif);
    e.classList.toggle('avec-barre', actif && porteBarre(e.id));
  });
  const B = $('barre-bas');
  if(B){
    B.classList.toggle('on', porteBarre(id));
    // les écrans sans onglet propre (fiche, boutique, test…) n'allument aucun
    // onglet, mais la barre reste là pour repartir vers une grande section
    const onglet = id === 'ligue' ? 'ligues'
      : id === 'amis-classement' ? 'amis'
      : id === 'profil-vs' ? (PROFIL_VS_RETOUR === 'ligue' ? 'ligues' : 'amis')
      : Object.keys(ONGLETS).find(k => ONGLETS[k] === id);
    B.querySelectorAll('.bb').forEach(b =>
      b.setAttribute('aria-selected', b.id === 'bb-' + onglet));
  }
  /* Le fond se fige sur l'écran de jeu et redevient défilable ailleurs.
     hautDePage() vient après le dégel : sur un body encore en
     position:fixed, window.scrollTo ne ferait rien. Dans l'autre sens
     l'appel est sans effet, mais le gel du jeu se pose toujours en haut
     (body.jeu.fige neutralise le décalage), donc rien à rattraper. */
  const fige = ECRANS_FIGES.has(id);
  document.body.classList.toggle('jeu', fige);
  gelerFond('ecran', fige);
  document.body.classList.toggle('avec-barre', porteBarre(id));
  if(!avant || avant.id !== id) hautDePage();
  majBoutonsRetour();
}

// horodatage matériel de l'événement quand il est fiable : supprime le délai
// que la boucle JavaScript ajoute entre le doigt et le traitement
// Trois façons de compenser la latence d'affichage et de saisie.
const LAT_TXT = {
  materiel:"L'horodatage matériel de l'événement est utilisé : le délai de traitement JavaScript est retranché, mais pas celui de l'écran tactile.",
  fixe:"En plus de l'horodatage matériel, 24 ms sont retranchés forfaitairement — la latence moyenne d'un écran tactile. Utile pour comparer avec un test de laboratoire.",
  brut:"Aucune compensation : c'est l'heure à laquelle JavaScript a traité l'appui. Plus lent et plus irrégulier, à ne garder que pour comparer."
};
const LAT_FIXE = 24;   // compensation forfaitaire de l'écran tactile

function tempsEvt(ev){
  const now = performance.now();
  const fiable = ev && typeof ev.timeStamp === 'number' && ev.timeStamp > 0
                 && Math.abs(ev.timeStamp - now) < 3000;
  if(fiable){
    S.latence = Math.max(0, Math.round(now - ev.timeStamp));
    noterLatence(S.latence);
    noterDelai(ev.timeStamp, S.latence);
  }
  if(CFG.lat === 'brut') return now;
  if(CFG.lat === 'fixe') return (fiable ? ev.timeStamp : now) - LAT_FIXE;
  // CFG.horo à false : on mesure la latence mais on ne la retranche pas
  return (fiable && CFG.horo) ? ev.timeStamp : now;
}

/* ════════ CONFIRMATION ════════ */
// confirm() est bloqué dans une iframe sandboxée : on gère la modale nous-mêmes
// La modale couvre tout l'écran : elle DOIT toujours avoir une sortie.
// On peut taper le fond ou presser Échap, et elle ignore les 260 premières
// millisecondes pour ne pas être traversée par le clic fantôme du doigt
// qui vient de l'ouvrir.
function choisir(titre, sous, opts){
  return new Promise(res => {
    const M = $('modale'), ouvertA = performance.now();
    $('mod-titre').textContent = titre;
    $('mod-sous').textContent = sous;
    const b = $('mod-b'); b.innerHTML = '';
    let clos = false;
    const fin = v => {
      if(clos) return;
      clos = true;
      M.classList.remove('on');
      M.onclick = null; M.onpointerdown = null;
      document.removeEventListener('keydown', clavier);
      res(v);
    };
    const tropTot = () => performance.now() - ouvertA < 260;
    function clavier(e){ if(e.key === 'Escape' && !tropTot()) fin(null); }
    opts.forEach(o => {
      const el = document.createElement('button');
      el.className = 'bouton' + (o.doux ? ' fantome' : '');
      el.textContent = o.label;
      el.dataset.val = String(o.val);
      el.onclick = () => { if(!tropTot()) fin(o.val); };
      b.appendChild(el);
    });
    M.onclick = e => { if(e.target === M && !tropTot()) fin(null); };
    document.addEventListener('keydown', clavier);
    M.classList.add('on');
    // filet ultime : la modale ne peut pas rester bloquée indéfiniment
    S.minuteries.push(setTimeout(() => { if(!clos && M.classList.contains('on')) fin(null); }, 45000));
  });
}
const demander = (titre, sous, oui) => choisir(titre, sous,
  [{label:'Annuler', val:false, doux:true}, {label:oui||'Confirmer', val:true}]);

/* ════════ RÈGLES ════════ */
function evaluer(ecart){
  if(ecart === 0)     return {code:'pile',  couleur:'t-s100', n:0}; // Violet
  if(ecart <= PRES)   return {code:'frole', couleur:'t-s50', n:calcFrole(PRES + 1 - ecart)}; // Vert
  if(ecart <= zone()) return {code:'sauf',  couleur:'t-s20',  n:0}; // Jaune
  return                     {code:'rate',  couleur:'t-signal', n:RATE[CFG.gor]}; // Rouge
}
function prochaineCible(total){
  let c = (Math.floor(total/100) + 1) * 100;
  while(c - total <= 50) c += 100;
  return c;
}
const vivant = n => !S.elimines.includes(n);
const actifs = () => S.joueurs.filter(vivant);
function idxSuivant(){
  if(S.prochain !== null) return S.prochain;
  const n = S.joueurs.length;
  let i = S.idx;
  for(let k = 0; k < n; k++){
    i = ((i + S.sens) % n + n) % n;
    if(vivant(S.joueurs[i])) return i;
  }
  return S.idx;
}

// cible : trajectoire imposée en « compte est bon », seconde pleine sinon
function cibleSuivante(total){
  const m = CFG.mode;
  // laboratoire : chaque mode décrit sa propre trajectoire
  const lb = LAB();
  if(lb) return lb.cible(total);
  // séquence figée : défi du jour, fantôme, cibles nues
  if(S.sequence.length){
    const d = S.sequence[Math.min(S.tour - 1, S.sequence.length - 1)];
    // cibles nues : le chrono repart de zéro à chaque tour, aucun repère cumulé
    return (m === 'nues' ? 0 : total) + d;
  }

  // NOUVEAU : Cible du mode Blind
  if(m === 'blind') {
    if (CFG.diff === 'hard') {
      // Hard : Décimales aléatoires entre 1.00s (100) et 10.00s (1000)
      return total + 100 + Math.floor(Math.random() * 901);
    } else {
      // Classique : Secondes rondes pleines entre 1.00s et 10.00s
      return total + (Math.floor(Math.random() * 10) + 1) * 100;
    }
  }

  // l'escalier monte par demi-secondes : la progression est moins brutale
  if(m === 'escalier') return total + Math.round(100 + (S.marche - 1) * 50);
  if(m === 'sprint')   return total + 100;
  if(m === 'reflexe')  return total + 100;
  // combat : la cadence du boss donne le rythme, fixe ou tirée au sort
  if(m === 'combat'){
    const b = bossCourant();
    const c = b.cadence || (100 + Math.floor(Math.random() * 3) * 50);
    // sous 25 PV, il accélère : les derniers coups sont les plus durs
    return total + Math.round(c * (S.pvBoss <= 25 ? 0.8 : 1));
  }
  if(m === 'survie'){
    if(rebours()){
      // on descend vers la seconde pleine inférieure, jamais à moins d'une
      // demi-seconde : sinon le tour serait injouable
      let p = Math.floor(total / 100) * 100;
      while(total - p < 50) p -= 100;
      return Math.max(0, p);
    }
    return prochaineCible(total);
  }
  if(m === 'aventure' && rebours() && !(S.avt && S.avt.enCombat)){
    // même logique qu'en Survie, réservée à la marche : un combat repart
    // toujours de zéro, descendre n'y aurait aucun sens
    let p = Math.floor(total / 100) * 100;
    while(total - p < 50) p -= 100;
    return Math.max(0, p);
  }
  if(m === 'compte'){
    const reste = Math.max(1, (CFG.maxTours || 10) - S.tour);
    const ecart = Math.max(20, Math.round((2000 - total) / reste));
    return total + ecart;
  }
  return prochaineCible(total);
}

// handicap : plus on est précis au panthéon, plus la zone se resserre
function zoneDe(nom){
  const lb = LAB();
  if(lb) return lb.zone();
  // survie : la zone se resserre, mais bien viser la fait respirer
  if(CFG.mode === 'aventure'){
    if(!S.avt) return ZONE_AVT;
    return Math.max(1, S.avt.enCombat ? Math.ceil(S.avt.zone / 2) : S.avt.zone);
  }
  if(CFG.mode === 'survie') return Math.max(1, S.zoneSurvie);
  
  // Zone du mode Blind (calcul proportionnel, gelé au-delà de 6 s)
  if(CFG.mode === 'blind') {
    const dSec = (S.cibleBase - S.total) / 100;
    // La zone s'élargissait sans jamais s'arrêter (jusqu'à ±0,75 en
    // Simple, ±0,80 en Hard à 10 s) : au-delà de 6 s, une cible longue
    // devenait beaucoup trop confortable. On gèle donc la croissance à
    // sa valeur de 6 s — rien ne change avant cette durée.
    const dGel = Math.min(dSec, 6);
    if (CFG.diff === 'hard') {
      return Math.round(30 + (dGel - 1) * (50 / 9));
    } else {
      return Math.round(25 + (dGel - 1) * (50 / 9));
    }
  }

  // escalier : plus la marche est haute, plus la zone est étroite
  if(CFG.mode === 'escalier') return Math.max(8, 34 - (S.marche - 1) * 2);
  if(CFG.mode === 'combat')   return Math.max(3, S.gardeBoss);
  if(CFG.mode === 'nues')   return zoneBase();
  if(CFG.mode !== 'handicap') return zoneBase();
  const a = analyse(MEM.profils[nom]);
  if(!a || a.tours < 5) return zoneBase();
  const prec = Math.max(2, Math.min(40, a.precision));
  const f = 0.6 + 0.4 * ((prec - 2) / 38);      // 0,6 pour les meilleurs, 1,0 pour les autres
  return Math.round(zoneBase() * f);
}

function partieFinie(){
  const m = CFG.mode;
  const lb = LAB();
  if(lb) return lb.fini ? lb.fini() : !!(CFG.maxTours && S.tour >= CFG.maxTours);
  // l'essai s'arrête dès que le trentième tour est joué : la condition est
  // évaluée avant l'incrément du tour, d'où le >=
  if(m === 'survie') return S.mort === true
    || !!(S.essaiBiome && S.tour >= S.essaiBiome.fin);
  if(m === 'aventure') return S.mort === true;
  if(m === 'escalier') return S.chutes >= 3;
  if(m === 'combat')   return S.pvBoss <= 0 || S.pvMoi <= 0;
  // le sprint se joue sur du temps réel, pas sur le chrono du jeu
  if(m === 'sprint')   return S.sprintFini === true
    || (S.debutSprint > 0 && (performance.now() - S.debutSprint) >= 30000);
  if(m === 'defi' && S.defi && S.defi.mesure === 'suite')
    return S.mort === true || S.tour >= S.defi.essais;
  if(CFG.mode === 'elimination') return actifs().length <= 1;
  if(CFG.mode === 'coop')        return S.vies <= 0 || S.total >= 3000;
  return !!(CFG.maxTours && S.tour >= CFG.maxTours);
}

/* ════════ MÉMOIRE PERSISTANTE ════════ */
const CLE = 'krono.v1';
const NEUF = () => ({joueurs:['Alexandre','Charles','Jean','Hugo'], cfg:null, profils:{},
                     scores:[], connus:[], salon:null, defi:null, defis:{}, profil:null, reprise:null,
                     usage:{heures:{}, modes:{}, reflexes:[], parties:0}});
let MEM = NEUF();

async function lireMem(){
  try{ if(window.storage){ const r = await window.storage.get(CLE, false);
       if(r && r.value) return JSON.parse(r.value); } }catch(e){}
  try{ const v = localStorage.getItem(CLE); if(v) return JSON.parse(v); }catch(e){}
  return null;
}
// Les écritures sont sérialisées : deux sauvegardes concurrentes pouvaient se
// chevaucher et la plus lente écrasait la plus récente — le salon disparaissait.
let ecritureEnCours = Promise.resolve();
async function ecrireMem(){
  ecritureEnCours = ecritureEnCours.then(async () => {
    if(S.salon) MEM.salon = S.salon;        // le salon vivant fait toujours foi
    const s = JSON.stringify(MEM);
    try{ if(window.storage){ await window.storage.set(CLE, s, false); return; } }catch(e){}
    try{ localStorage.setItem(CLE, s); }catch(e){}
  }).catch(() => {});
  return ecritureEnCours;
}
async function effacerMem(){
  try{ if(window.storage) await window.storage.delete(CLE, false); }catch(e){}
  try{ localStorage.removeItem(CLE); }catch(e){}
  MEM = NEUF();
}
// un score d'entraînement n'est comparable qu'à réglages identiques
const signature = e => e.aff + '·' + e.diff + '·' + e.tours + '·' + (e.bareme || 'v1');
const sigCourante = () => CFG.aff + '·' + CFG.diff + '·' + (CFG.maxTours || 10)
  + '·' + (estSolo(CFG.mode) ? CFG.mode : 'v2');
const libelleSig = s => {
  if(!s) return 'réglages inconnus';
  const [a,d,t,b] = s.split('·');
  const mode = (SOLOS.find(x => x.id === b) || {}).n;
  return (mode ? mode + ' · ' : '')
       + (a === 'aveugle' ? "À l'aveugle" : 'Visible') + ' · '
       + (d === 'hard' ? 'Hard' : 'Simple')
       + (mode ? '' : ' · ' + t + ' tours')
       + (b === 'v1' ? ' · ancien barème' : '');
};
const MAX_SCORES = 30;
// on garde les 30 meilleurs de chaque configuration, pas les 30 derniers :
// un panthéon doit récompenser la performance, pas la récence
function elaguerScores(){
  const paquets = {};
  (MEM.scores || []).forEach(e => (paquets[signature(e)] ||= []).push(e));
  MEM.scores = Object.values(paquets)
    .flatMap(l => l.sort((a,b) => b.p - a.p).slice(0, MAX_SCORES));
}
const scoresDe = sig => (MEM.scores || []).filter(e => signature(e) === sig)
                                          .sort((a,b) => b.p - a.p);
const coulHash = n => coul([...String(n)].reduce((a,c) => a + c.charCodeAt(0), 0));

// Statistiques d'usage : trois agrégats, aucun horodatage précis, aucune donnée
// personnelle. Elles servent à savoir quels modes sont joués et quand.
function noterUsage(mode, termine){
  const u = MEM.usage || (MEM.usage = {heures:{}, modes:{}, reflexes:[], parties:0});
  const hr = String(new Date().getHours());
  u.heures[hr] = (u.heures[hr] || 0) + 1;
  u.modes[mode] = u.modes[mode] || {parties:0, finies:0};
  u.modes[mode].parties++;
  if(termine) u.modes[mode].finies++;
  u.parties++;
}
function noterReflexe(moy){
  const u = MEM.usage || (MEM.usage = {heures:{}, modes:{}, reflexes:[], parties:0});
  u.reflexes.push(moy);
  if(u.reflexes.length > 100) u.reflexes = u.reflexes.slice(-100);
}

const profilVide = () => ({tours:0, somme:0, biais:0, carres:0,
                           piles:0, gorgees:0, culs:0, parties:0,
                           serie:0, meilleurScore:0, minutes:0, configs:{}});
function analyse(p){
  if(!p || !p.tours) return null;
  const moy = p.biais / p.tours;
  return { tours:p.tours, moy, parties:p.parties||0, piles:p.piles||0,
           gorgees:p.gorgees||0, culs:p.culs||0, configs:p.configs||{},
           disp: Math.sqrt(Math.max(0, p.carres/p.tours - moy*moy)),
           precision: p.somme / p.tours };
}
function phraseBiais(a){
  if(!a) return '';
  if(Math.abs(a.moy) < 1.5) return 'bien centré';
  return 'part ' + fmt(Math.round(Math.abs(a.moy))) + ' s trop ' + (a.moy < 0 ? 'tôt' : 'tard');
}
function jaugeHTML(a){
  const pos  = Math.max(1, Math.min(99, 50 + (a.moy/JB)*50));
  const larg = Math.min(49, (a.disp/JB)*50);
  return `<span class="jauge">
      <span class="disp" style="left:${Math.max(0,pos-larg)}%;width:${larg*2}%"></span>
      <span class="axe"></span><span class="m" style="left:${pos}%"></span></span>`;
}

/* ════════ PRÉNOMS CONNUS ════════ */
// tout prénom saisi une fois reste proposé, même si aucune partie n'a été terminée
function memoriser(noms){
  MEM.connus = MEM.connus || [];
  (Array.isArray(noms) ? noms : [noms])
    .map(n => (n || '').trim())
    .filter(n => n && !/^Joueur \d+$/.test(n))
    .forEach(n => { if(!MEM.connus.includes(n)) MEM.connus.push(n); });
  if(MEM.connus.length > 40) MEM.connus = MEM.connus.slice(-40);
}
// les habitués d'abord, puis le reste par ordre alphabétique
function tousLesNoms(){
  const s = new Set([...(MEM.connus || []), ...(MEM.joueurs || []),
                     ...Object.keys(MEM.profils || {})]);
  return [...s].filter(n => n && !/^Joueur \d+$/.test(n))
    .sort((a,b) => {
      const ta = (MEM.profils[a] || {}).tours || 0, tb = (MEM.profils[b] || {}).tours || 0;
      return tb - ta || a.localeCompare(b, 'fr');
    });
}
function majDatalist(){
  $('prenoms').innerHTML = tousLesNoms()
    .map(n => `<option value="${esc(n)}"></option>`).join('');
}

// sélecteur : on tape un prénom, ou on en reprend un déjà utilisé
function demanderNom(titre, sous, exclure, sansSuggestions){
  return new Promise(res => {
    const M = $('modale'), ouvertA = performance.now();
    $('mod-titre').textContent = titre;
    $('mod-sous').textContent = sous || '';
    $('mod-saisie').style.display = 'flex';
    const champ = $('mod-champ');
    champ.value = '';
    let clos = false;
    const tropTot = () => performance.now() - ouvertA < 260;
    const fin = v => {
      if(clos) return;
      clos = true;
      M.classList.remove('on'); M.onclick = null;
      $('mod-saisie').style.display = 'none';
      $('mod-noms').style.display = 'none';
      document.removeEventListener('keydown', clavier);
      res(v);
    };
    function clavier(e){
      if(e.key === 'Escape' && !tropTot()) fin(null);
      if(e.key === 'Enter' && champ.value.trim() && !tropTot()) fin(champ.value.trim());
    }
    const N = $('mod-noms'); N.innerHTML = '';
    const hors = (Array.isArray(exclure) ? exclure : [exclure]).filter(Boolean);
    const liste = sansSuggestions ? []
                : tousLesNoms().filter(n => !hors.includes(n)).slice(0, 12);
    champ.removeAttribute('list');
    if(!sansSuggestions) champ.setAttribute('list', 'prenoms');
    champ.placeholder = sansSuggestions ? 'ABCDE' : 'Nouveau prénom';
    champ.style.textTransform = sansSuggestions ? 'uppercase' : 'none';
    champ.style.letterSpacing = sansSuggestions ? '.24em' : '.03em';
    liste.forEach(n => {
      const b = document.createElement('button');
      b.className = 'nom-pill';
      b.textContent = n;
      b.style.color = coulHash(n);
      b.onclick = () => { if(!tropTot()) fin(n); };
      N.appendChild(b);
    });
    N.style.display = liste.length ? 'flex' : 'none';
    $('mod-ok').onclick = () => {
      const v = champ.value.trim();
      if(v && !tropTot()) fin(v);
    };
    const b = $('mod-b'); b.innerHTML = '';
    const a = document.createElement('button');
    a.className = 'bouton fantome'; a.textContent = 'Annuler'; a.dataset.val = 'null';
    a.onclick = () => { if(!tropTot()) fin(null); };
    b.appendChild(a);
    M.onclick = e => { if(e.target === M && !tropTot()) fin(null); };
    document.addEventListener('keydown', clavier);
    M.classList.add('on');
    S.minuteries.push(setTimeout(() => { if(!clos && M.classList.contains('on')) fin(null); }, 45000));
  });
}

/* ════════ ÉCRAN RÉGLAGES ════════ */
function rang(v,n){
  const d = document.createElement('div');
  d.className = 'rang';
  d.innerHTML = `<span class="puce" style="background:${coul(n-1)}"></span><b>${n}</b>
    <input maxlength="14" placeholder="Prénom" list="prenoms" autocomplete="off" autocapitalize="words">
    <button class="monter" aria-label="Remonter ce joueur">▲</button>
    <button class="derouler" aria-label="Choisir un prénom déjà utilisé">▾</button>
    <button class="retirer" aria-label="Retirer">×</button>
    <span class="hist"></span>`;
  const inp = d.querySelector('input');
  inp.value = v || '';
  inp.style.color = coul(n-1);
  inp.addEventListener('input', () => majHist(d));
  inp.addEventListener('change', enregistrerListe);
  inp.addEventListener('blur', enregistrerListe);
  // une seule flèche : pour descendre un joueur, on remonte celui d'en dessous.
  // Deux flèches par ligne donneraient des cibles trop petites au doigt.
  d.querySelector('.monter').onclick = () => {
    const l = $('liste'), i = [...l.children].indexOf(d);
    if(i <= 0) return;
    l.insertBefore(d, l.children[i-1]);
    renumeroter(); enregistrerListe();
  };
  d.querySelector('.derouler').onclick = async () => {
    const autres = [...$('liste').querySelectorAll('input')]
      .filter(x => x !== inp).map(x => x.value.trim());   // pas deux fois le même à table
    const n2 = await demanderNom('Qui joue ?',
      'Reprenez un prénom déjà utilisé, ou saisissez-en un nouveau.', autres);
    if(!n2) return;
    inp.value = n2; majHist(d); enregistrerListe();
  };
  d.querySelector('.retirer').onclick = () => { d.remove(); renumeroter(); enregistrerListe(); };
  majHist(d);
  return d;
}
function renumeroter(){
  const seul = $('liste').children.length <= 1;
  [...$('liste').children].forEach((r,i) => {
    r.querySelector('.retirer').style.visibility = seul ? 'hidden' : 'visible';
    r.querySelector('.monter').disabled = (i === 0);
    r.querySelector('b').textContent = i+1;
    r.querySelector('.puce').style.background = coul(i);
    r.querySelector('input').style.color = coul(i);
  });
}
function majHist(d){
  const a = analyse(MEM.profils[d.querySelector('input').value.trim()]);
  d.querySelector('.hist').textContent = a
    ? a.tours + ' tours · ' + phraseBiais(a) + ' · précision ±' + fmt(Math.round(a.precision))
    : '';
}
// En entraînement, un seul joueur est affiché : les autres restent en mémoire
// et reviennent dès qu'on quitte le mode.
// la liste du menu est sauvegardée dès qu'elle change, sans attendre une partie
function enregistrerListe(){
  const j = lireListe();
  MEM.joueurs = j;
  memoriser(j);
  majDatalist();
  ecrireMem();
}
function peupler(){
  const solo = estSolo(CFG.mode);
  if(solo){
    // même logique qu'à lireListe() : la ligne affichée doit déjà montrer
    // le bon nom, pas seulement le nom utilisé au lancement de la partie
    const pseudo = pseudoConnecte();
    if(pseudo) MEM.joueurs[0] = pseudo;
  }
  const liste = solo ? MEM.joueurs.slice(0,1) : MEM.joueurs;
  $('liste').innerHTML = '';
  liste.forEach((n,i) => $('liste').appendChild(rang(n, i+1)));
  // le bouton reste visible en solo : il sert à repasser à plusieurs d'un geste
  $('ajouter').style.display = 'block';
  $('ajouter').textContent = solo ? '+ Passer à plusieurs' : '+ Ajouter un joueur';
  $('note-joueurs').textContent = solo
    ? "Mode solo : seul le premier joueur joue. Ajoutez quelqu'un pour passer en mode soirée."
    : '';
  renumeroter();
}
/* Nom de profil du compte connecté, à imposer en solo. Vérification
   purement locale (lireSession() lit le stockage, sans requête réseau) :
   un simple changement d'écran ne doit jamais attendre le serveur. Si le
   profil local n'a pas encore de pseudo synchronisé, on ne force rien —
   le joueur garde la main tant que son compte n'a pas de nom. */
function pseudoConnecte(){
  if(!lireSession()) return null;
  const p = monPro();
  return (p && p.pseudo) || null;
}
function lireListe(){
  const vus = [...$('liste').querySelectorAll('input')]
    .map((i,k) => i.value.trim() || 'Joueur ' + (k+1));
  if(!estSolo(CFG.mode)) return vus;
  const gardes = (MEM.joueurs || []).slice();
  if(!gardes.length) return vus;
  gardes[0] = vus[0] || gardes[0];
  // le pseudo du compte prime toujours en solo : ni le champ texte, ni un
  // ancien nom mémorisé ne doivent plus jamais s'afficher à sa place
  const pseudo = pseudoConnecte();
  if(pseudo) gardes[0] = pseudo;
  return gardes;
}
$('ajouter').onclick = () => {
  const l = $('liste');
  // depuis un mode solo, ajouter quelqu'un fait basculer en soirée
  if(estSolo(CFG.mode)){
    MEM.joueurs = lireListe();
    CFG.mode = 'classique';
    MEM.cfg = {...CFG}; ecrireMem();
    construireModes(); appliquerCfg(); peupler(); rafraichir();
  }
  if(l.children.length < 12){ l.appendChild(rang('', l.children.length+1)); enregistrerListe(); }
};

function segmente(id, cb){
  const el = $(id);
  if(!el) return;              // le sélecteur peut ne pas exister sur cet écran
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x===b));
    cb(b.dataset.v); rafraichir();
  });
}
segmente('seg-aff',  v => CFG.aff = v);
segmente('seg-diff', v => CFG.diff = v);
segmente('seg-gor',  v => CFG.gor = v);
segmente('seg-evt',  v => CFG.evts = v);
segmente('seg-horo', v => { CFG.horo = v === '1'; MEM.cfg = {...CFG}; ecrireMem(); majLatence(); });
segmente('seg-fin',  v => CFG.maxTours = +v);

function rafraichir(){
  tableau();
  majLatence();
}
// le barème n'existe plus qu'au sein d'une fiche de mode de soirée
function tableau(){
  const cible = $('fi-tableau');
  if(!cible) return;

  if(CFG.mode === 'blind') {
    const L = [
      ['var(--laiton)', 'pile', 'le suivant fait ' + nomCulSec() + ' (x1 à x2 selon durée) — ou riposte'],
      ['var(--laiton)', '± 0,03', 'le suivant boit (de 2 à 8 gorgées selon durée)'],
      ['var(--vert)',   'zone sûre', 'personne ne boit (la tolérance s\'élargit avec le temps)'],
      ['var(--signal)', 'hors zone', 'tu bois (de 5 à 2 gorgées selon durée)']
    ];
    cible.innerHTML = L.map(([c,k,t],i) =>
      `<div><span class="pastille" style="background:${c};opacity:${i>0&&i<3?.55:1}"></span>
       <i>${k}</i><span style="flex:1; line-height:1.4; margin-top:2px">${t}</span></div>`).join('');
    return;
  }

  const L = [
    ['var(--laiton)', 'la minute', 'chrono à 60,00 pile : tous les autres, ' + nomCulSec()],
    ['var(--laiton)', 'pile', 'le suivant fait ' + nomCulSec() + ' — ou riposte'],
    ['var(--laiton)', '± 0,01', 'le suivant boit ' + gorg(calcFrole(3))],
    ['var(--laiton)', '± 0,02', 'le suivant boit ' + gorg(calcFrole(2))],
    ['var(--laiton)', '± 0,03', 'le suivant boit ' + gorg(calcFrole(1))],
    ['var(--vert)',   '± ' + fmt(zoneBase()), 'personne ne boit'],
    ['var(--signal)', 'au-delà', 'tu bois ' + gorg(RATE[CFG.gor])]
  ];
  cible.innerHTML = L.map(([c,k,t],i) =>
    `<div><span class="pastille" style="background:${c};opacity:${i>1&&i<5?.55:1}"></span>
     <i>${k}</i>${t}</div>`).join('');
}

function majMem(){
  const ns = Object.keys(MEM.profils);
  const t = ns.reduce((s,n) => s + MEM.profils[n].tours, 0);
  $('note-mem').textContent = ns.length
    ? ns.length + ' profil' + (ns.length>1?'s':'') + ' · ' + t + ' tours enregistrés'
    : "Rien d'enregistré. Les profils se créent à la fin d'une partie.";
}
// Cinq habillages : mêmes composants, palettes différentes.
const DA_TXT = {
  instrument:"L'apparence d'origine. Sobre et contrastée, pensée pour rester lisible à bout de bras dans une pièce sombre.",
  retro:"Terminal à phosphore ambré : balayage cathodique, angles droits, une seule couleur chaude. Rétro-futurisme sobre, très lisible.",
  synth:"Rétro-futurisme années 80 : halos, grille spatiale, chiffres électriques. Plus spectaculaire, un peu moins net.",
  pop:"Fond clair, ombres dures, couleurs franches. Chaleureux et accessible, mais il éblouit dans le noir.",
  ultraviolet:"Violet saturé, un seul accent doré réservé à ce qui s'appuie. Énergique sans grille ni bruit — le plus vif des cinq.",
  glacier:"Violet profond et froid, accent cyan plutôt que doré. Le plus net et le plus posé, pensé pour de longues sessions.",
  stade:"Pelouse et jaune de maillot, capitales condensées de panneau d'affichage. L'anneau devient une piste. Le plus compétitif.",
  atelier:"Établi, papier millimétré et cuivre. Un instrument de mesure plutôt qu'un jeu : angles droits et coins de repère.",
  maree:"Turquoise profond qui s'éclaircit vers le bas, sable en accent. Le seul décor qui éclaire là où sont les boutons.",
  casino:"Feutre vert et or vieilli, liseré de table de jeu. L'anneau devient un jeton à tranche crantée. Cérémonieux et tendu.",
  bar:"Bois sombre, ambre de whisky, une enseigne au néon en haut d'écran. Le plus confortable dans une pièce mal éclairée."
};
function appliquerDA(){
  document.documentElement.dataset.da = CFG.da || 'casino';
  const n = $('note-da');
  if(n) n.textContent = DA_TXT[CFG.da || 'casino'];
  if(typeof majSegDaMenu === 'function') majSegDaMenu();
  /* le sélecteur de l'onglet Test suit aussi : deux entrées, un seul état */
  const sd = $('seg-da');
  if(sd) sd.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.v === (CFG.da || 'casino'))));
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content', CFG.da === 'pop' ? '#FDF5E4'
                                : CFG.da === 'synth' ? '#0B0410'
                                : CFG.da === 'retro' ? '#0C0A06'
                                : CFG.da === 'ultraviolet' ? '#3A1178'
                                : CFG.da === 'glacier' ? '#2E2260'
                                : CFG.da === 'stade' ? '#0C3320'
                                : CFG.da === 'atelier' ? '#1C1A17'
                                : CFG.da === 'maree' ? '#04333C'
                                : CFG.da === 'casino' ? '#0B3226'
                                : CFG.da === 'bar' ? '#1A0E0B' : '#0E1116');
}
segmente('seg-da', v => { CFG.da = v; MEM.cfg = {...CFG}; ecrireMem(); appliquerDA(); });

/* ─── panneau de réglages rapides (bouton ☰ de l'en-tête) ───────────────
   L'apparence n'était réglable que depuis l'onglet Test, protégé par un
   mot de passe : autant dire nulle part pour un joueur. Ce panneau la
   sort au premier niveau, sans toucher au sélecteur existant — les deux
   restent synchronisés puisqu'ils écrivent le même CFG.da. */
/* Rétro, Synthwave et Pop restent codés et accessibles depuis l'onglet
   Test, mais disparaissent du panneau rapide le temps qu'on tranche —
   Casino devient l'habillage par défaut du jeu. */
const DA_NOMS = [
  ['casino','Casino'], ['instrument','Origine'],
  ['ultraviolet','Ultraviolet'], ['glacier','Glacier'],
  ['stade','Stade'], ['atelier','Atelier'], ['maree','Marée'],
  ['bar','Bar']
];
function construireSegDaMenu(){
  const el = $('seg-da-menu');
  if(!el || el.dataset.pret) return;
  el.innerHTML = DA_NOMS.map(([v,n]) =>
    `<button data-v="${v}" aria-pressed="false">${n}</button>`).join('');
  el.dataset.pret = '1';
  segmente('seg-da-menu', v => {
    CFG.da = v; MEM.cfg = {...CFG}; ecrireMem(); appliquerDA();
  });
}
function majSegDaMenu(){
  const el = $('seg-da-menu');
  if(!el) return;
  const actuel = CFG.da || 'casino';
  el.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.v === actuel)));
  const n = $('note-da-menu');
  if(n) n.textContent = DA_TXT[actuel];
}
function ouvrirPanneauReglages(){
  construireSegDaMenu();
  majSegDaMenu();
  $('panneau-reg').classList.add('on');
}
function fermerPanneauReglages(){ $('panneau-reg').classList.remove('on'); }
if($('ouvrir-reglages')) $('ouvrir-reglages').onclick = ouvrirPanneauReglages;
if($('pnr-fermer'))      $('pnr-fermer').onclick      = fermerPanneauReglages;
/* toucher le fond ferme, toucher la boîte ne ferme pas */
if($('panneau-reg')) $('panneau-reg').onclick = e => {
  if(e.target === $('panneau-reg')) fermerPanneauReglages();
};
segmente('seg-min', v => {
  CFG.minutes = v === 'oui'; MEM.cfg = {...CFG}; ecrireMem();
  $('note-min').textContent = CFG.minutes
    ? "Au-delà de la minute, le chrono affiche 1:00,00 plutôt que 60,00. Plus lisible en Survie, où l'on dépasse vite les trois chiffres."
    : "Le chrono affiche toujours des centièmes : 60,00 puis 61,00. Simple, mais un nombre à trois chiffres devient étroit.";
});
segmente('seg-intro', v => {
  CFG.sv = CFG.sv || {}; CFG.sv.intro = v; MEM.cfg = {...CFG}; ecrireMem();
});
segmente('seg-lat', v => {
  CFG.lat = v; MEM.cfg = {...CFG}; ecrireMem();
  $('note-lat').textContent = LAT_TXT[v];
});

function appliquerCfg(){
  appliquerDA();
  const nl = $('note-lat');
  if(nl) nl.textContent = LAT_TXT[CFG.lat || 'materiel'];
  const nm = $('note-min');
  if(nm) nm.textContent = CFG.minutes
    ? "Au-delà de la minute, le chrono affiche 1:00,00 plutôt que 60,00."
    : "Le chrono affiche toujours des centièmes : 60,00 puis 61,00.";
  const m = {'seg-da':CFG.da || 'casino', 'seg-lat':CFG.lat || 'materiel',
             'seg-intro':(CFG.sv && CFG.sv.intro) || 'cine',
             'seg-min':CFG.minutes ? 'oui' : 'non',
             'seg-aff':CFG.aff, 'seg-diff':CFG.diff, 'seg-gor':CFG.gor,
             'seg-evt':CFG.evts, 'seg-fin':String(CFG.maxTours),
             'seg-horo':CFG.horo ? '1' : '0'};
  for(const id in m){ const e = $(id); if(!e) continue;
    e.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.v === m[id])); }
}
$('oublier').onclick = async () => {
  if(!await demander('Effacer les profils ?',
      'Toutes les statistiques cumulées seront perdues. Irréversible.', 'Effacer')) return;
  await effacerMem(); peupler(); majMem(); construirePantheon();
};

/* ════════ ENTRAÎNEMENT : ACTIONS RAPIDES ════════ */
async function changerJoueur(){
  const n = await demanderNom('Qui joue ?',
    'Le score en cours est abandonné. Reprenez un prénom déjà utilisé, '
    + 'ou saisissez-en un nouveau.', S.joueurs[0]);
  if(!n) return;
  memoriser(n); majDatalist();
  MEM.joueurs = [n, ...MEM.joueurs.filter(x => x !== n)];
  await ecrireMem();
  peupler();
  demarrerPartie();
}
$('f-sol-changer').onclick = changerJoueur;
$('f-sol-recommencer').onclick = () => demarrerPartie();

/* ════════ AJOUT D'UN JOUEUR EN COURS ════════ */
async function ajouterJoueurEnCours(){
  if(!S.partie || S.joueurs.length >= 12) return;
  const n = await demanderNom('Ajouter un joueur',
    'Il prend sa place juste derrière le joueur en cours : il jouera '
    + 'au bout d\'un tour complet.', S.joueurs);
  if(!n) return;
  S.joueurs.splice(S.idx, 0, n);   // devant le joueur courant dans le tableau…
  S.idx++;                         // …qui garde donc la main
  S.stats[n] = {gorgees:0, donnees:0, culs:0, ecart:0, tours:0, piles:0, biais:0, carres:0, minutes:0, hist:[]};
  S.jetons[n] = 0; S.fautes[n] = 0;
  S.couleurs[n] = couleurLibre();
  memoriser(n);
  MEM.joueurs = S.joueurs.slice();
  await ecrireMem();
  peupler(); majDatalist();
  fluidePret();
}
$('f-ajouter').onclick = ajouterJoueurEnCours;

/* ════════ SAUVEGARDE ════════ */
// Le panthéon ne vit que dans le navigateur. Un fichier exportable est la seule
// protection contre un changement d'adresse, un effacement des données du site
// ou la purge automatique de stockage d'iOS.
function contenuSauvegarde(){
  return JSON.stringify({
    app:'krono', version:1, date:new Date().toISOString(),
    joueurs:MEM.joueurs, cfg:MEM.cfg, profils:MEM.profils, scores:MEM.scores || [],
    salon:MEM.salon || null
  }, null, 1);
}
function resumeSauvegarde(d){
  const np = Object.keys(d.profils || {}).length;
  const nt = Object.values(d.profils || {}).reduce((s,p) => s + (p.tours||0), 0);
  return np + ' profil' + (np>1?'s':'') + ' · ' + nt + ' tours · '
       + ((d.scores||[]).length) + ' score' + ((d.scores||[]).length>1?'s':'');
}

$('exporter').onclick = async () => {
  const texte = contenuSauvegarde();
  const nom = 'krono-sauvegarde-' + new Date().toISOString().slice(0,10) + '.json';
  let telecharge = false, copie = false;
  try{
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texte], {type:'application/json'}));
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    telecharge = true;
  }catch(e){}
  try{ await navigator.clipboard.writeText(texte); copie = true; }catch(e){}
  choisir('Sauvegarde exportée',
    resumeSauvegarde(JSON.parse(texte)) + '.'
    + (telecharge ? ' Fichier ' + nom + ' enregistré.' : '')
    + (copie ? ' Le contenu est aussi dans le presse-papier.' : '')
    + ' Gardez-le hors du téléphone : mail, notes, cloud.',
    [{label:'Compris', val:true}]);
};

$('importer').onclick = () => $('fichier').click();
$('fichier').onchange = ev => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if(!f) return;
  const lec = new FileReader();
  lec.onload = async () => {
    let d;
    try{ d = JSON.parse(lec.result); }catch(e){
      return choisir('Fichier illisible',
        "Ce n'est pas une sauvegarde Krono valide.", [{label:'Fermer', val:true}]);
    }
    if(!d || typeof d.profils !== 'object')
      return choisir('Fichier inattendu',
        "Aucun profil trouvé dans ce fichier.", [{label:'Fermer', val:true}]);
    const quoi = await choisir('Importer cette sauvegarde ?',
      resumeSauvegarde(d) + '. Fusionner additionne les statistiques ; '
      + 'remplacer efface ce qui est enregistré ici.',
      [{label:'Annuler', val:'non', doux:true},
       {label:'Fusionner', val:'fusion'},
       {label:'Remplacer', val:'remplace'}]);
    if(quoi === 'non' || quoi === null) return;
    if(quoi === 'remplace'){
      MEM = Object.assign(NEUF(), {joueurs:d.joueurs || NEUF().joueurs,
        cfg:d.cfg || null, profils:d.profils || {}, scores:d.scores || [],
        salon:S.salon || null});   // le salon rejoint survit à un import
      if(MEM.cfg){ Object.assign(CFG, MEM.cfg); appliquerCfg(); }
    } else {
      MEM.scores = MEM.scores || [];
      for(const n in d.profils){
        const p = d.profils[n], q = MEM.profils[n] || (MEM.profils[n] = profilVide());
        ['tours','somme','biais','carres','piles','gorgees','culs','parties']
          .forEach(k => q[k] = (q[k]||0) + (p[k]||0));
      }
      const vus = new Set(MEM.scores.map(e => e.n+'|'+e.p+'|'+e.d));
      (d.scores || []).forEach(e => {
        const k = e.n+'|'+e.p+'|'+e.d;
        if(!vus.has(k)){ vus.add(k); MEM.scores.push(e); }
      });
    }
    await ecrireMem();
    peupler(); majMem(); rafraichir(); construirePantheon();
    choisir('Sauvegarde importée', resumeSauvegarde({profils:MEM.profils, scores:MEM.scores})
      + ' en mémoire.', [{label:'Parfait', val:true}]);
  };
  lec.readAsText(f);
};

/* ════════ NAVIGATION ════════ */
// les réglages sont fermés pendant une partie : on en sort par « Quitter »
// « Panthéon » ouvre le salon s'il y en a un, le local sinon
function ouvrirPantheon(){
  if(S.salon && EN_LIGNE()){ construireGlobal(); montrer('classement-global'); }
  else { construirePantheon(); montrer('pantheon'); }
}
$('go-test').onclick      = () => { verrouTest(); majLatence(); construireUsage();
  construireSvOpts(); construireBioEssai(); construireBioTest(); construireTest();
  montrer('test'); };
$('pr-test').onclick      = () => { verrouTest(); majLatence(); construireUsage();
  construireSvOpts(); construireBioEssai(); construireBioTest(); construireTest();
  montrer('test'); };
$('panth-retour').onclick = () => montrer('reglages');
$('test-retour').onclick  = () => { if(S.partie) afficherPret(); else montrer('reglages'); };
$('recap-panth').onclick  = () => ouvrirPantheon();
$('recap-fermer').onclick = () => montrer('reglages');
$('fin-menu-aventure').onclick = async () => {
  await chargerAvtCompte();
  construireAventureAccueil(); montrer('aventure-accueil');
};
// Saut de tour : réservé au mode invincible. Le tour est compté comme joué,
// sans usure ni score — c'est un déplacement, pas une partie.
$('f-saut').onclick = ev => {
  ev.stopPropagation();
  if(!S.partie || S.encours) return;
  if(!(CFG.mode === 'survie' && CFG.sv && CFG.sv.triche)) return;
  S.total = S.cible;
  S.tour++;
  S.cible = S.cibleBase = cibleSuivante(S.total);
  S.dernier = null; S.finDeTour = null; S.enAttente = S.cible;
  if(partieFinie()){ afficherFin(); return; }
  // si le saut franchit une frontière de décor, on le repeint sans carte
  if(biomeCourant() && S.biome !== biomeCourant().id){
    S.biome = null; majBiome(); verrouillerDepart(false);
  }
  fluidePhase('repos');
  fluidePret();
};
// Choisir son tour : le même déplacement que le saut, mais en une fois. Le
// chrono suit, sinon la cible se retrouverait derrière lui.
$('f-tour-choix').onclick = async ev => {
  ev.stopPropagation();
  if(!S.partie || S.encours) return;
  if(!(CFG.mode === 'survie' && CFG.sv && CFG.sv.triche)) return;
  const b = biomeCourant();
  const rep = await demanderNom('Aller à quel tour ?',
    'Tour actuel : ' + S.tour + (b ? ' · ' + b.n : '')
    + '. Les décors changent tous les ' + TOURS_BIOME + ' tours.', [], true);
  const cible = parseInt(String(rep || '').replace(/\D/g, ''), 10);
  if(!cible || cible < 1) return;
  if(cible > 9999) return choisir('Trop loin',
    'Le compteur s\'arrête à 9999.', [{label:'Fermer', val:true}]);
  allerAuTour(cible);
};

function allerAuTour(cible){
  const pas = cible - S.tour;
  S.tour = cible;
  // le chrono avance d'autant de secondes que de tours franchis : la cible
  // doit rester devant lui, dans le sens où il va
  if(pas > 0) S.total += pas * 100;
  else S.total = Math.max(0, S.total + pas * 100);
  S.cible = S.cibleBase = cibleSuivante(S.total);
  S.dernier = null; S.finDeTour = null; S.enAttente = S.cible;
  S.zoneSurvie = Math.min(plafondSurvie(S.tour), Math.max(1, S.zoneSurvie));
  if(S.essaiBiome) S.essaiBiome = null;   // on quitte le cadre de l'essai
  if(partieFinie()){ afficherFin(); return; }
  // le décor de destination doit s'afficher tout de suite, sans carte ni
  // verrou : on repeint comme au premier tour d'une partie
  S.biome = null; majBiome();
  verrouillerDepart(false);
  fluidePhase('repos');
  fluidePret();
}
$('fin-menu').onclick     = () => { S.essaiBiome = null; montrer('reglages'); };
// un essai de biome ramène là d'où il vient
$('fin-test').onclick     = () => {
  S.essaiBiome = null;
  verrouTest(); majLatence(); construireUsage();
  construireSvOpts(); construireBioEssai();
  montrer('test');
};
async function quitterPartie(){
  // en survie, on peut mettre la partie de côté et la retrouver plus tard
  if(CFG.mode === 'survie' && S.partie && S.tour > 1 && !S.mort){
    const choix = await choisir('Quitter la partie ?',
      'Tour ' + S.tour + ' · zone ± ' + fmt(Math.max(1, S.zoneSurvie))
      + (S.vies ? ' · une vie en réserve' : ''),
      [{label:'Garder pour plus tard', val:'garder'},
       {label:'Abandonner', val:'stop'},
       {label:'Continuer', val:null}]);
    if(!choix) return;
    if(choix === 'garder'){
      sauverPartie();
      S.partie = false; S.encours = false;
      arreterBattement(); arreterMusique(); arreterAmbiance();
      purgerMinuteries();
      montrer('reglages'); construireModes();
      return;
    }
    S.abandon = true; afficherFin(); return;
  }
  // en aventure, même logique, mais un système de reprise entièrement séparé
  // (MEM.repriseAvt) : rien ici ne touche à la reprise de Survie
  if(AVT() && S.partie && S.avt && S.avt.pas + (S.avt.gardiens * TOURS_AVT) > 0 && !S.mort){
    const choix = await choisir('Quitter l\'expédition ?',
      'Tour ' + S.tour + ' · ' + S.avt.gardiens + ' gardien'
      + (S.avt.gardiens > 1 ? 's' : '') + ' abattu' + (S.avt.gardiens > 1 ? 's' : '')
      + ' · ' + S.avt.xp + ' xp de cette expédition',
      [{label:'Garder pour plus tard', val:'garder'},
       {label:'Abandonner', val:'stop'},
       {label:'Continuer', val:null}]);
    if(!choix) return;
    if(choix === 'garder'){
      sauverPartieAvt();
      S.partie = false; S.encours = false;
      arreterBattement(); arreterMusique(); arreterAmbiance();
      purgerMinuteries();
      montrer('reglages'); construireModes();
      return;
    }
    S.abandon = true; afficherFin(); return;
  }
  const solo = estSolo(CFG.mode);
  const ok = await demander('Quitter la partie ?',
    solo ? 'Une partie solo abandonnée ne compte pas : ni score, ni précision, '
           + 'ni trophée ne seront enregistrés.'
         : 'Le classement et les profils seront enregistrés avant de sortir.',
    'Quitter');
  if(!ok) return;
  if(solo){ S.abandon = true; }
  afficherFin();
}
$('f-quitter').onclick = quitterPartie;

/* ════════ PARTIE ════════ */
async function demarrerPartie(){
  // dernier rempart : aucun chemin ne doit permettre une 4ᵉ tentative
  if(CFG.mode === 'defi' && essaisRestants() <= 0){
    montrer('reglages');
    await choisir('Défi épuisé',
      'Vous avez utilisé vos ' + MAX_ESSAIS_DEFI + ' tentatives du jour. '
      + 'Un nouveau défi arrive demain.', [{label:'Compris', val:true}]);
    return;
  }
  const j = lireListe();
  if(!estSolo(CFG.mode) && j.length < 2){
    demander('Il faut au moins deux joueurs',
      'Ajoutez quelqu\'un, ou passez en Mode Solo.', 'Compris');
    return false;
  }
  S.joueurs = j; S.stats = {}; S.jetons = {}; S.couleurs = {};
  j.forEach((n,i) => S.couleurs[n] = coul(i));
  j.forEach(n => { S.stats[n] = {gorgees:0, donnees:0, culs:0, ecart:0, tours:0,
                                 piles:0, biais:0, carres:0, minutes:0, hist:[]}; S.jetons[n] = 0; });
  S.idx = 0; S.sens = 1; S.total = 0; S.tour = 1; S.contre = 0;
  S.historique = []; S.enregistre = false; S.partie = true;
  if($('titres-c')) $('titres-c').style.display = 'none';
  // une partie relancée pendant qu'un chrono tourne laissait S.encours à vrai :
  // l'écran repartait en pensant être en pleine mesure
  S.encours = false;
  S.evt = null; S.force = null; S.dernierEvt = -9; S.duel = null; S.prochain = null;
  S.fautes = {}; S.elimines = []; S.vies = 3;
  S.points = 0; S.chaine = 0; S.meilleureChaine = 0; S.chaineFrole = 0;
  S.dernier = null; S.finDeTour = null; S.dernierMs = undefined;
  S.sequence = []; // La correction est ici !
  verrouillerDepart(false);
  $('f-sprint').classList.remove('on'); $('f-sprint').textContent = '';
  $('f-vie-ind').classList.remove('on');
  $('f-gain').classList.remove('on');   $('f-gain').textContent = '';
  S.gainSurvie = null;
  S.tropheesAvant = {}; S.gagnes = []; S.abandon = false; S.ecarts = []; S.usageNote = false;
  j.forEach(n => S.tropheesAvant[n] = trophees(n).map(x => x.tr.id + ':' + x.e.rang));
  S.zoneTour = 0; S.enchere = null;
  // Sans cette remise à zéro, un aller-retour vers l'écran de détails laissait
  // majBiome se croire en « retour » au premier tour de la partie suivante :
  // il sautait son tour, et le décor de l'essai précédent restait affiché
  // jusqu'au premier chrono lancé.
  S.retourDetail = false;
  S.alerteTour = false;
  $('fluide').classList.remove('alerte-tour', 'zone-critique', 'noir-mine');
  $('f-voile-noir').classList.remove('on');
  $('f-critique').classList.remove('on');
  $('f-critique').textContent = '';
  $('f-anneau').classList.remove('critique');
  if(estSolo(CFG.mode)){
    S.joueurs = [j[0]];
    S.tableauDepart = scoresDe(sigCourante()).map(e => ({n:e.n, p:e.p}));
    S.nbSous = 0;
    preparerSolo();
  }
  S.derniereBlague = null;
  if(CFG.mode === 'compte') CFG.maxTours = 10;
  S.cible = S.cibleBase = cibleSuivante(0);
  MEM.joueurs = j; MEM.cfg = {...CFG};
  memoriser(j); majDatalist(); ecrireMem();
  garderEcranAllume();
  
  S.blindPret = true; // <-- AJOUTE CETTE LIGNE ICI

  afficherPret();
 // À intégrer dans demarrerPartie()
  trackEvent('level_start', {
    level_name: CFG.mode, // ex: 'survie', 'blind', 'classique'
    difficulty: CFG.diff, // ex: 'simple', 'hard'
    player_count: S.joueurs.length,
    blind_bet_active: CFG.pariBlind ? 'oui' : 'non'
  });
  return true;
}

// construit la séquence de cibles et l'état propre au mode solo choisi
function preparerSolo(){
  const m = CFG.mode;
  S.sequence = []; S.marche = 1; S.mort = false; S.finSprint = 0;
  S.phase = 1; S.chutes = 0;
  S.defi = null; S.reussites = 0; S.debutSprint = 0; S.reflexes = [];
  const s = SOLO();
  CFG.maxTours = s && s.tours ? s.tours : 0;
  if(LAB()) initLabo();
  if(m === 'aventure') initAventure();
  if(m !== 'survie') S.biomeForce = null;

  if(m === 'defi'){
    consommerEssai();
    S.defi = defiDuJour();
    CFG.maxTours = S.defi.essais;
    if(S.defi.aff) CFG.aff = S.defi.aff;
    for(let i = 0; i < S.defi.essais; i++) S.sequence.push(S.defi.cible);
  }
  if(m === 'nues'){
    const r = graine(Date.now() & 0xffffff);
    for(let i = 0; i < 10; i++) S.sequence.push(80 + Math.floor(r() * 320));
  }
  if(m === 'survie'){
    S.biome = null; S.essaiBiome = null; S.biomeForce = null;
    S.boucleFaite = false;
    S.cloudUtilise = false;
    S.zoneSurvie = ZONE_DEPART_SURVIE + effB('zoneDep');
    S.chaineSurvie = 0; S.gainSurvie = null; S.sautTour = false;
    S.vies = 0; S.pilesSurvie = 0; S.pariSurvie = false;
    S.biome = null;
    S.graine = (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0;
    S.alea = graine(S.graine);
    S.dernierRdv = undefined;
    S.prochainRdv = tirerProchainRdv(0);
    S.interruptions = 0; S.trocPropose = false; S.vaToutPropose = false;
    S.seriePropose = false; S.defiSerie = null; S.vaTout = false;
    S.courbe = []; S.meilleureSerie = {n:0, tour:0, de:0, a:0};
  }
  if(m === 'sprint'){ S.debutSprint = 0; S.sprintFini = false; }
  if(m === 'reflexe') CFG.maxTours = 10;
  if(m === 'combat'){
    const b = bossCourant();
    S.pvBoss = b.pv; S.pvMoi = 100;
    S.gardeBoss = b.garde; S.touches = 0; S.critiques = 0;
    if(b.aveugle) CFG.aff = 'aveugle';
  }
}

function tirerEvenement(){
  S.evt = null;
  // Invariant : la cible reste à plus de 0,50 s devant le chrono, dans le sens
  // où il va. En marche arrière, « devant » veut dire en dessous — sans cette
  // distinction, la cible héritée du décor précédent restait au-dessus d'un
  // chrono qui descend, et le tour était injouable.
  const marge = rebours() ? S.total - S.cibleBase : S.cibleBase - S.total;
  if(marge <= (CFG.mode === 'compte' ? 5 : 50))
    S.cibleBase = cibleSuivante(S.total);
  S.cible = S.cibleBase;
  if(S.force){ S.evt = S.force; S.force = null; }
  else {
    if(S.contre > 0) return;
    if(S.tour - S.dernierEvt < 2) return;
    if(estSolo(CFG.mode)) return; // BLOQUE LES ÉVÈNEMENTS EN SOLO
    const p = {aucun:0, rares:0.12, frequents:0.30}[CFG.evts];
    if(Math.random() >= p) return;
    
    // NOUVEAU : On filtre le bouclier (max 5 joueurs) ET les événements désactivés
    CFG.evtExclus = CFG.evtExclus || [];
    const evtsDispo = EVTS.filter(e => {
      if(CFG.evtExclus.includes(e.id)) return false;
      if(e.id === 'bouclier' && S.joueurs.length > 5) return false;
      return true;
    });
    
    // S'il reste au moins un événement autorisé, on le tire au sort
    if(evtsDispo.length > 0){
      S.evt = evtsDispo[Math.floor(Math.random() * evtsDispo.length)].id;
    } else {
      return; // Si tout est sur OFF, il ne se passe rien
    }
  }
  S.dernierEvt = S.tour;
  if(S.evt === 'demi')   S.cible = S.cibleBase + 50;
  if(S.evt === 'longue') S.cible = S.cibleBase + 100;
}

async function afficherPret(){
  purgerMinuteries();
  S.zoneTour = zoneDe(S.joueurs[S.idx]);
  S.enchere = null;
  fluidePret();
  if(CFG.mode === 'enchere' && S.contre === 0){
    S.enchere = await choisir('Ton enchère, ' + S.joueurs[S.idx],
      'Tenu, c\'est le suivant qui boit. Manqué, tu bois le double.',
      ENCHERES.map(e => ({label:e.label, val:e.seuil})));
    if(S.enchere === null) S.enchere = ENCHERES[0].seuil;   // fond tapé : mise prudente
    majEnchere();
  }
}
const estMinute = c => c > 0 && c % 6000 === 0;

// Conversion millisecondes → centièmes, unique pour tout le jeu.
// Arrondi au centième le plus proche — seul comportement, plus de réglage.
function enCentiemes(ms){
  return Math.round(ms / 10);
}

function compteursMode(p){
  // la minute pile est un événement de soirée : rien à faire boire en solo
  $(p+'minute').classList.toggle('on', !estSolo(CFG.mode) && estMinute(S.cible));
  const v = $(p+'vies'), nom = S.joueurs[S.idx];
  let t = '';
  if(CFG.mode === 'coop')        t = S.vies + ' vie' + (S.vies>1?'s':'');
  if(CFG.mode === 'elimination') t = (3 - (S.fautes[nom]||0)) + ' faute'
    + (3-(S.fautes[nom]||0)>1?'s':'') + ' restante' + (3-(S.fautes[nom]||0)>1?'s':'');
  const md = CFG.mode;
  const V = $('f-vie-ind');
  V.classList.toggle('on', md === 'survie' && S.partie);
  const invincible = md === 'survie' && S.partie && !!(CFG.sv && CFG.sv.triche);
  $('f-triche').classList.toggle('on', invincible);
  // en invincible, on doit pouvoir traverser un décor sans le jouer
  $('f-saut').classList.toggle('on', invincible && !S.encours);
  $('f-tour-choix').classList.toggle('on', invincible && !S.encours);
  if(md === 'survie' && S.partie){
    V.classList.toggle('pleine', S.vies > 0);
    V.classList.toggle('vide', !S.vies);
    V.innerHTML = '<span class="c">' + (S.vies > 0 ? '♥' : '♡') + '</span>'
      + (S.vies > 0 ? 'une vie' : 'sans filet');
  }
  if(md === 'survie'){
    t = 'zone ± ' + fmt(Math.max(1, S.zoneSurvie));
    if(S.alerteTour) t = 'ALERTE · zone comptée pour moitié';
    if(S.vaTout)         t = 'VA-TOUT · trois centièmes ou rien';
    else if(S.defiSerie) t = 'Défi · ' + S.defiSerie.reste + ' coup'
      + (S.defiSerie.reste > 1 ? 's' : '') + ' à placer';
  } else if(md === 'escalier') t = 'record ' + fmt(100 + (Math.max(1,S.points)-1)*50) + ' s';
  else if(md === 'combat')   t = S.pvMoi + ' PV · garde ± ' + fmt(S.gardeBoss);
  else if(md === 'reflexe')  t = S.reflexes.length
    ? Math.round(S.reflexes.reduce((a,b)=>a+b,0)/S.reflexes.length) + ' ms' : '';
  else if(md === 'defi' && S.defi) t = S.defi.consigne;
  else if(estSolo(md) && !AVT()) t = S.points + ' pts'
    + (S.chaine > 1 ? ' · série ×' + Math.min(MULT_MAX, S.chaine) : '');
  v.className = 'bouclier ' + (estSolo(CFG.mode)
    ? (S.chaine > 1 ? 'serie' : 'or') : 'vies') + (t ? ' on' : '');
  v.textContent = t;
  const solo = estSolo(CFG.mode);
  $('f-solo-actions').classList.toggle('on', !AVT());
  $('f-sol-recommencer').style.display = solo ? 'block' : 'none';
  $('f-sol-changer').style.display = solo ? 'block' : 'none';
  $('f-ajouter').style.display = solo ? 'none' : 'block';
  $('f-retirer').style.display = (solo || S.joueurs.length <= 2) ? 'none' : 'block';
}
async function retirerJoueurEnCours(){
  if(!S.partie || S.joueurs.length <= 2) return;
  const nom = await choisir('Retirer un joueur', 
    'Qui quitte la table ?', 
    S.joueurs.map((n, i) => ({label: n, val: i, doux: i === S.idx}))
  );
  if(nom === null) return;
  
  const i = nom;
  S.joueurs.splice(i, 1);
  if(S.idx >= S.joueurs.length) S.idx = 0;
  MEM.joueurs = S.joueurs.slice();
  await ecrireMem();
  peupler();
  fluidePret();
}
$('f-retirer').onclick = retirerJoueurEnCours;
function majEnchere(){
  const e = ENCHERES.find(x => x.seuil === S.enchere);
  const txt = e ? 'Enchère ' + e.label.split(' · ')[1] : '';
  $('f-enchere').classList.toggle('on', !!e);
  $('f-enchere').textContent = txt;
}

/* ════════ CHRONO ════════ */
let verrou = 0;
function purgerMinuteries(){
  S.minuteries.forEach(clearTimeout); S.minuteries = [];
  if(S.tRdv){ clearTimeout(S.tRdv); S.tRdv = null; }   // et les propositions en attente
}
function purgerBiome(){
  arreterToutesBoucles();
  const B = $('f-bourrasque');
  if(B) B.classList.remove('on');
}
const attendre = (ms, f) => S.minuteries.push(setTimeout(f, ms));


function demarrer(ev){
  if(ev) ev.preventDefault();
  if(S.departVerrou) return;    // la bascule de décor n'est pas terminée
  const t = tempsEvt(ev);
  if(t - verrou < 120) return;
  verrou = t;
  purgerMinuteries();
  // le joueur a lancé : toute proposition en attente est annulée
  if(S.tRdv){ clearTimeout(S.tRdv); S.tRdv = null; }
  if(CFG.mode === 'reflexe'){
    fluidePhase('course');
    lancerReflexe();
    return;
  }
  if(remiseAZero()) S.total = 0;   // chaque tour (ou combat d'aventure) repart de zéro
  if(CFG.mode === 'survie' && !battement){
    lancerBattement(); lancerMusique(); lancerAmbiance();
  }
  // Cascade : le compteur d'appuis est posé AVANT le départ. Le faire
  // apparaître au premier appui décalait la mise en page en pleine mesure,
  // ce qui se voyait comme une saccade sur la première seconde.
  if(ENCHAINES[CFG.mode]){
    const el = $('f-sprint');
    el.classList.add('on'); el.classList.remove('urgent');
    el.textContent = '0/' + ENCHAINES[CFG.mode].n + ' · ±0,00';
  }
  S.t0 = t; S.encours = true;
  S.saccadeAt = undefined; S.saccadeVal = undefined;
  S.totalAvantTour = S.total; S.cibleAvantTour = S.cible;   // pour la Faille
  calerChrono();          // la taille est figée pour tout le tour
  if(CFG.mode === 'sprint' && !S.debutSprint){ S.debutSprint = t; boucleSprint(); }
  // Autoroute : un klaxon éclate à un moment imprévisible de la course
  if(effB('klaxon') && !muet()){
    attendre(400 + Math.floor(Math.random() * 1600), () => {
      if(!S.encours) return;
      bip(180, .22, .09); vibrer(45);
    });
  }
  fluidePhase('course');
  if(CFG.aff === 'visible' && S.evt !== 'yeux' && !S.aveugleTour) boucleChiffres();
}
function boucleChiffres(){
  if(!S.encours) return;
  const ecoule = performance.now() - S.t0;
  let cs = enCentiemes(ecoule);
  // Marais : l'affichage n'avance que par bonds de 13 centièmes, à cadence
  // irrégulière. La mesure interne, elle, reste rigoureusement exacte.
  if((CFG.mode === 'survie' || CFG.mode === 'aventure') && effB('saccade')){
    if(S.saccadeAt === undefined || ecoule - S.saccadeAt > 130 + Math.random() * 120){
      S.saccadeAt = ecoule;
      S.saccadeVal = cs;
    }
    cs = S.saccadeVal !== undefined ? S.saccadeVal : cs;
  }
  const txt = affChrono(valeurAtteinte(cs));
  $('f-chrono').textContent = S.dixiemesTour ? masquerDixiemes(txt) : txt;
  requestAnimationFrame(boucleChiffres);
}
// sprint : un décompte visible en permanence, même entre deux tours
function boucleSprint(){
  if(CFG.mode !== 'sprint' || !S.partie || !S.debutSprint) return;
  const reste = Math.max(0, 30 - (performance.now() - S.debutSprint) / 1000);
  const el = $('f-sprint');
  el.classList.add('on');
  el.textContent = reste.toFixed(1).replace('.', ',');
  el.classList.toggle('urgent', reste <= 10);
  if(reste > 0){ requestAnimationFrame(boucleSprint); return; }
  el.textContent = '0,0';
  // le temps est écoulé : on coupe net, sauf si un chrono est en cours —
  // dans ce cas le tour va au bout, puis la partie s'arrête
  if(S.encours){ S.sprintFini = true; return; }
  afficherFin();
}
function arreter(ev){
  if(!S.encours) return;
  if(ev) ev.preventDefault();
  const brut = tempsEvt(ev);
  if(brut - verrou < 120) return;
  verrou = brut;
  // Banquise : le gel ajoute un retard fixe à la mesure. Il est annoncé, donc
  // rattrapable en anticipant — c'est un décalage constant, pas un aléa. Le
  // verrou anti-rebond, lui, reste sur l'heure réelle de l'appui.
  const t = brut + effB('gel');
  S.msBrut = t - S.t0;              // mesure brute, pour les modes au millième
  if(ENCHAINES[CFG.mode]){ tourEnchaine(t); return; }
  S.encours = false;
  purgerMinuteries(); vibrer(18);
  S.blindPret = false; // <-- AJOUTE CETTE LIGNE ICI
  afficherResultat(valeurAtteinte(enCentiemes(t - S.t0)));
}
addEventListener('keydown', ev => {
  if(ev.code !== 'Space' && ev.code !== 'Enter') return;
  if(!$('fluide').classList.contains('actif')) return;
  ev.preventDefault();
  if(S.encours) arreter(); else if(S.fPhase === 'repos') demarrer();
});

/* ════════ RÉSULTAT ════════ */
// qui vient-on de doubler au classement d'entraînement ?
function depassements(){
  const L = S.tableauDepart;
  if(!L.length) return '';
  const sous = L.filter(e => e.p < S.points).length;
  if(sous <= S.nbSous) return '';
  const neufs = L.slice(L.length - sous, L.length - S.nbSous);
  S.nbSous = sous;
  if(sous === L.length) return 'meilleur score de cette configuration';
  if(neufs.length === 1) return 'tu passes devant ' + neufs[0].n;
  return 'tu passes devant ' + neufs[0].n + ' et ' + (neufs.length - 1) + ' autre'
    + (neufs.length > 2 ? 's' : '');
}

/* auteur : qui inflige la peine, quand ce n'est pas la victime elle-même.
   Sert au titre L'inévitable (gorgées distribuées) et au Bourreau. On ne
   compte que ce qui est réellement bu (après bouclier éventuel), pour que
   « distribué » et « bu » restent deux chiffres cohérents entre eux. */
function peine(nom, n, attaque = false, auteur = null){
  if(!attaque && S.jetons[nom] > 0){ S.jetons[nom]--; return 0; }
  S.stats[nom].gorgees += n;
  if(auteur && auteur !== nom && S.stats[auteur])
    S.stats[auteur].donnees = (S.stats[auteur].donnees || 0) + n;
  return n;
}

// rappel du biome en cours dans l'écran de détails
// Les règles d'un biome : un seul texte, réutilisé au lancement et en détails.
function reglesBiome(b, tour){
  const suivant = (Math.floor(((tour || S.tour) - 1) / TOURS_BIOME) + 1) * TOURS_BIOME + 1;
  const idx = BIOMES.indexOf(b);
  if(idx === -1) return {           // décor en essai : hors de toute progression
    titre:b.n, accent:b.accent, d:b.d, plage:'Décor en essai · hors progression',
    malus:b.malus, bonus:b.bonus,
    suite:'Il ne se déclenche que depuis l\'onglet Test'
  };
  return {
    titre:b.n, accent:b.accent, d:b.d,
    plage:'Tours ' + (idx * TOURS_BIOME + 1) + ' à '
      + (idx === BIOMES.length - 1 ? '∞' : (idx + 1) * TOURS_BIOME),
    malus:b.malus, bonus:b.bonus,
    suite:idx === BIOMES.length - 1
      ? 'Dernier décor · il ne change plus'
      : 'Prochain décor au tour ' + suivant + ' · ' + BIOMES[idx + 1].n
  };
}
function htmlRegles(r, cl){
  return `<div class="${cl}-t" style="color:${r.accent}">${esc(r.titre)}</div>
    <div class="${cl}-pl">${esc(r.plage)}</div>
    <div class="${cl}-d">${esc(r.d)}</div>
    ${r.malus ? `<div class="${cl}-l ma"><span>−</span>${esc(r.malus)}</div>` : ''}
    ${r.bonus ? `<div class="${cl}-l bo"><span>+</span>${esc(r.bonus)}</div>` : ''}
    ${!r.malus && !r.bonus ? `<div class="${cl}-l ne">Terrain neutre · aucun effet</div>` : ''}
    <div class="${cl}-p">${esc(r.suite)}</div>`;
}
function majDetailBiome(){
  const D = $('res-biome');
  if(!D) return;
  const b = biomeCourant();
  if(!b){ D.classList.remove('on'); return; }
  D.classList.add('on');
  D.innerHTML = htmlRegles(reglesBiome(b), 'db');
}

function afficherResultat(valeur){
  S.cibleBlindJouee = S.cible; // <-- AJOUT Mémorise la cible jouée
  if(S.evt === 'demitour') S.sens *= -1;

  const delta = valeur - S.cible, ecart = Math.abs(delta);
  const joueur = S.joueurs[S.idx];
  const st = S.stats[joueur];

  if(!(S.evt && EVT(S.evt).fausse)){
    st.ecart += ecart; st.tours++; st.biais += delta; st.carres += delta*delta;
    /* historique par tour, nécessaire aux titres de fin de soirée qui
       comparent la première et la seconde moitié de partie (Le grimpeur,
       L'essoufflé). On ne le pousse pas sur un tour faussé (evt.fausse),
       cohérent avec le reste des compteurs ci-dessus. */
    (st.hist = st.hist || []).push(ecart);
  }
  if(ecart === 0) st.piles++;
  (S.ecarts = S.ecarts || []).push(ecart);

  $('res-nom').textContent = joueur + (S.contre > 0 ? ' · riposte'
    : S.evt ? ' · ' + EVT(S.evt).n.toLowerCase() : '');
  surligner($('res-nom'), coulNom(joueur));
  $('leg-zone').textContent = 'zone sûre ± ' + fmt(zone());
  $('res-cible').textContent = 'Objectif ' + fmt(S.cible);
  $('res-score').textContent = fmt(valeur);
  $('res-ecart').textContent = (delta>0?'+':delta<0?'−':'±') + fmt(ecart);
  $('ech-axe').textContent = fmt(S.cible);
  $('zv').style.left = $('zv').style.right = (50 - zone()) + '%';
  $('marqueur').style.left = Math.max(0, Math.min(100, 50 + (delta/RANGE)*50)) + '%';
  $('bande').classList.toggle('pile', ecart === 0);

  if(S.evt === 'choix' && S.prochain === null){
    $('f-chrono').textContent = affChrono(valeur);
    const v = evaluer(ecart);
    $('f-chrono').className = 'f-chrono ' + v.couleur;
    
    let phraseDistribution = "";
    if (v.code === 'pile') {
        phraseDistribution = `🎯 PILE ! Tu offres 1 ${nomCulSec()} et choisis qui joue après :`;
    } else if (v.code === 'frole') {
        phraseDistribution = `✨ Frôlé ! Tu donnes ${gorg(v.n)} et choisis qui joue après :`;
    } else if (v.code === 'sauf') {
        phraseDistribution = `C'est dans la marge. Qui joue après toi ?`;
    } else {
        phraseDistribution = `❌ Hors zone ! Tu bois ${gorg(RATE[CFG.gor])}. Qui joue après toi ?`;
    }
    
    $('f-choix-recit').textContent = phraseDistribution;
    const o = $('f-choix-opts'); o.innerHTML = '';
    S.joueurs.forEach((n,i) => {
      if(i === S.idx) return;
      const b = document.createElement('button');
      b.className = 'bouton';
      b.textContent = n;
      b.style.color = coul(i);
      b.style.borderColor = coul(i);
      b.onclick = () => { 
        S.prochain = i; 
        $('f-choix-popup').classList.remove('on');
        resoudre(valeur, delta, ecart); 
      };
      o.appendChild(b);
    });
    $('f-choix-popup').classList.add('on');
    return;
  }
  $('verdict').style.display = 'block';
  resoudre(valeur, delta, ecart);
}

function resoudre(valeur, delta, ecart){
  const dureeVoulue = S.cible - S.total;      // ce qu'il fallait tenir
  const dureeTenue  = valeur - S.total;       // ce qui a réellement été tenu
  const joueur = S.joueurs[S.idx];
  const suiv   = S.joueurs[idxSuivant()];
  const st = S.stats[joueur];
  const T = $('ver-titre'), U = $('ver-sous');
  let mult = S.evt === 'double' ? 2 : 1;

  // en solo, tomber pile sur une minute n'a plus d'effet ni d'affichage :
  // il n'y a personne à faire boire. Réservé aux modes soirée.
  const minutePile = estMinute(valeur) && !estSolo(CFG.mode);
  let couleur = 't-vert', avance = true;

  /* ─── la minute pile : le chrono cumulé tombe rond sur une minute ─── */
  if(minutePile){
        couleur = 't-s100';
        st.minutes = (st.minutes || 0) + 1;
        const autres = S.joueurs.filter(n => n !== joueur && vivant(n));
        autres.forEach(n => S.stats[n].culs += 1);
        T.textContent = 'La minute pile';
        U.textContent = autres.length
          ? 'tout le monde sauf ' + joueur + ' : ' + nomCulSec()
          : 'personne d\'autre à table, personne ne boit';
        S.contre = 0; S.duel = null;          // le jackpot dissout riposte et duel
        vibrer([0,90,60,90,60,90,60,260]);
   }
  else if(S.evt === 'duel' && !S.duel){
    S.duel = {nom:joueur, val:valeur, ecart};
    couleur = 't-alerte'; avance = false;
    T.textContent = 'Duel · à ' + suiv;
    U.textContent = 'même cible, même départ · ' + fmt(ecart) + ' à battre';
  }
  else if(S.evt === 'duel' && S.duel){
    const a = S.duel, gagne = ecart < a.ecart;
    const perdant = gagne ? a.nom : joueur;
    couleur = 't-signal';
    const n = peine(perdant, 3*mult);
    T.textContent = perdant + (n ? ' boit ' + gorg(n) : ' : bouclier consommé');
    U.textContent = a.nom + ' ±' + fmt(a.ecart) + ' · ' + joueur + ' ±' + fmt(ecart);
    valeur = gagne ? a.val : valeur;
    S.duel = null;
  }
  else if(S.contre > 0){
    if(ecart === 0){
      S.contre++; couleur = 't-s100';
      T.textContent = 'Contré';
      U.textContent = suiv + ' doit ' + culs(S.contre) + ' — ou riposte à son tour';
      vibrer([0,60,50,60,50,180]);
    } else {
      couleur = 't-signal';
      T.textContent = joueur + ' : ' + culs(S.contre);
      U.textContent = 'riposte manquée · il fallait pile';
      st.culs += S.contre; S.contre = 0;
    }
  }
  /* ─── aventure : marcher (zone fixe, sans usure), affronter gardien ou
         monstre lambda selon A.typeCible — combat en parade/riposte ─── */
  else if(AVT()){
    const A = S.avt, arme = monArme();
    const z = zone();
    // ±0,03 s : la fenêtre de parade. En deçà, l'ennemi ne rend rien. Au-delà,
    // dans la garde élargie z, les dégâts encaissés montent avec l'écart.
    const PARADE = 3;
    if(A.enCombat){
      /* ── combat, générique : gardien ou monstre lambda ── */
      // on est fixé sur place pendant un combat : cet échange ne doit jamais
      // compter comme un tour de marche, y compris s'il se termine ici même
      A.dernierEchangeEtaitCombat = true;
      if(ecart <= z){
        const critique = ecart === 0;
        const d = Math.round(arme.degats * (critique ? 2 : 1));
        A.pvBoss = Math.max(0, A.pvBoss - d);
        A.coups++;
        if(A.typeCible === 'gardien') A.xp += Math.round((critique ? 8 : 4) * arme.xp);
        // parade partielle : hors de la fenêtre de 0,03 mais dans la garde,
        // on touche quand même, mais l'ennemi rend des coups proportionnels
        let encaisse = 0;
        if(ecart > PARADE){
          const portee = Math.min(1, (ecart - PARADE) / Math.max(1, z - PARADE));
          encaisse = Math.round(A.degatsCible * portee);
          A.pvJoueur = Math.max(0, A.pvJoueur - encaisse);
        }
        couleur = critique ? 't-s100' : encaisse ? 't-s20' : 't-s50';
        T.textContent = critique ? 'Parade et coup critique · −' + d
          : encaisse ? 'Touché, mais entamé · −' + d + ' / vous −' + encaisse
          : 'Paré et touché · −' + d;
        U.textContent = A.pvBoss > 0
          ? nomCibleCombat() + ' · ' + A.pvBoss + ' points de vie · ' + arme.n.toLowerCase()
          : nomCibleCombat() + ' tombe';
        if(A.pvBoss <= 0){
          A.recemmentRencontre = true;   // jamais deux rencontres d'affilée
          const nomVaincu = nomCibleCombat();   // capturé avant toute mutation
          let biomeAvant = null;
          if(A.typeCible === 'gardien'){
            biomeAvant = biomeAvtCourant().id;
            const rangAvant = rangBiomeAvt(biomeAvant);
            const prime = 40 + 30 * rangAvant;
            A.xp += Math.round(prime * arme.xp);
            A.gardiens++; A.pas = 0;   // simple compteur de statistique désormais
            // détermine les biomes accessibles depuis ici, en tenant compte
            // de la règle spéciale d'Enfer (sortie différente si on y est
            // entré par le chemin secret de Grotte)
            const noeud = PARCOURS_AVT[biomeAvant] || {suivants:[]};
            let suivants = noeud.suivants || [];
            if(biomeAvant === 'enfer' && A.enferViaGrotte){
              suivants = [noeud.sortieDepuisGrotte];
              A.enferViaGrotte = false;
            }
            if(suivants.length === 1){
              A.biomeId = suivants[0];
              if(!A.visites.includes(A.biomeId)) A.visites.push(A.biomeId);
              if(A.biomeId !== biomeAvant) A.biomeTransitionEnAttente = A.biomeId;
            } else if(suivants.length > 1){
              // embranchement : la transition attend le choix du joueur
              A.decisionEnAttente = suivants;
            }
            // un souffle, pas une remise à neuf : le terrain ne se regagne pas
            A.zone = Math.min(A.zoneDepart, A.zone + 3);
            couleur = 't-s100';
            T.textContent = 'Gardien abattu en ' + A.coups + ' coup'
              + (A.coups > 1 ? 's' : '');
            U.innerHTML = '<b class="t-or">+' + Math.round(prime * arme.xp) + ' xp</b> · le chemin '
              + 'reprend · zone ± ' + fmt(A.zone);
          } else {
            const r = A.recompenseCible;
            const gx = Math.round(r.xp * arme.xp);
            A.xp += gx; A.or += r.or;
            couleur = 't-s100';
            T.textContent = nomVaincu + ' vaincu en ' + A.coups + ' coup'
              + (A.coups > 1 ? 's' : '');
            U.innerHTML = '<b class="t-or">+' + gx + ' xp · +' + r.or + ' or</b> · le chemin reprend';
          }
          // le gardien reçoit son propre écran de transition (récit de départ) ;
          // un monstre lambda reste sur le petit popup existant
          if(A.typeCible === 'gardien') afficherVictoireBoss(nomVaincu, biomeAvant);
          else annoncerMonstre(nomVaincu, true);
          A.enCombat = false; A.coups = 0; A.typeCible = null;
        } else if(A.pvJoueur <= 0){
          S.mort = true;
          couleur = 't-signal';
          T.textContent = nomCibleCombat() + ' vous met à terre';
          U.textContent = 'plus un point de vie · l\'expédition s\'arrête';
        }
      } else {
        /* hors de la garde : rien porté, coup plein encaissé */
        A.pvJoueur = Math.max(0, A.pvJoueur - A.degatsCible);
        couleur = 't-signal';
        if(A.pvJoueur <= 0){
          S.mort = true;
          T.textContent = nomCibleCombat() + ' vous met à terre';
          U.textContent = 'plus un point de vie · l\'expédition s\'arrête';
        } else {
          T.textContent = 'Coup manqué';
          U.textContent = '−' + A.degatsCible + ' encaissés · ' + A.pvJoueur
            + ' pv restants · garde ± ' + fmt(z);
        }
      }
    }
    else if(ecart > z){
      /* ── sortie de zone : fin de l'expédition ── */
      S.mort = true;
      couleur = 't-signal';
      T.textContent = 'Le terrain se dérobe';
      U.textContent = 'écart ± ' + fmt(ecart) + ' pour une zone de ± ' + fmt(z)
        + ' · ' + A.xp + ' xp ramenés';
    }
    else {
      /* ── marche : zone fixe, pas d'usure, un peu d'xp et d'or ── */
      const gain = ecart === 0 ? 12 : ecart <= 3 ? 6 : 2;
      const g = Math.round(gain * arme.xp);
      A.xp += g;
      const gainOr = ecart === 0 ? 5 : ecart <= 3 ? 2 : 1;
      A.or += gainOr;
      A.pas++;
      couleur = ecart === 0 ? 't-s100' : ecart <= 3 ? 't-s50' : 't-s20';
      T.textContent = 'le terrain tient · zone ± ' + fmt(A.zone);
      U.innerHTML = '<b class="t-or">+' + g + ' xp · ' + A.xp + ' xp · ' + A.or + ' or</b>';
      // Le popup (annoncerMonstre) suffit à signaler l'arrivée d'un adversaire :
      // le verdict de CE tour de marche — sa couleur, son texte — reste celui
      // qu'il aurait eu de toute façon. Un pile reste un pile, même si un
      // monstre surgit dans la foulée.
      if(A.pas >= TOURS_AVT){
        entrerCombat();
        A.totalAvantCombat = valeur;   // pour reprendre la marche exactement ici
      }
      // rencontre aléatoire, jamais deux tours d'affilée (voir A.recemmentRencontre)
      else if(A.recemmentRencontre){
        A.recemmentRencontre = false;   // le prochain tour pourra tirer à nouveau
      }
      else if(Math.random() < TAUX_RENCONTRE_AVT){
        const type = Math.random() < 0.65 ? 'faible' : 'moyen';
        entrerCombatMonstre(type);
        A.totalAvantCombat = valeur;   // pour reprendre la marche exactement ici
      }
      // chemin secret : un événement rare, propre au biome courant
      else if((PARCOURS_AVT[A.biomeId] || {}).secrets
              && Math.random() < TAUX_SECRET_AVT){
        const secrets = PARCOURS_AVT[A.biomeId].secrets;
        const cible = secrets[Math.floor(Math.random() * secrets.length)];
        if(cible === 'station') afficherStationHub();
        else afficherEvenementSecret(cible);
      }
    }
    S.points = A.xp;
  }
  /* ─── laboratoire : chaque mode écrit lui-même son verdict ─── */
  else if(LAB()){
    const r = LAB().tour({ecart, delta, valeur, ms:S.msBrut || (valeur - S.total) * 10});
    S.points += (r.pts || 0);
    couleur = r.couleur;
    T.textContent = r.titre;
    U.textContent = r.sous;
  }
  /* ─── entraînement solo : aucune gorgée, un score ─── */
  else if(CFG.mode === 'survie'){
    // Station : un tour sur cinq, la zone est amputée de moitié pour ce tour
    const alerte = !!S.alerteTour;
    const v = evaluer(alerte ? Math.max(1, Math.round(ecart * 2)) : ecart);
    // le va-tout se joue avant tout le reste : il tranche le tour
    if(S.vaTout){
      S.vaTout = false;
      if(ecart <= 3 || (CFG.sv && CFG.sv.triche)){
        S.zoneSurvie = Math.min(plafondSurvie(S.tour), 30);
        S.gainSurvie = null; couleur = 't-s100';
        T.textContent = 'Va-tout gagné';
        U.textContent = 'zone ramenée à ± ' + fmt(S.zoneSurvie);
        S.points = S.tour; S.courbe.push(S.zoneSurvie);
        sonSurvie('vie'); vibrerSv(60);
      } else {
        S.mort = true; couleur = 't-s0'; S.gainSurvie = null;
        T.textContent = 'Va-tout perdu';
        U.textContent = 'écart ±' + fmt(ecart) + ' · il fallait trois centièmes';
        sonSurvie('mort'); vibrerSv(180);
      }
    }
    else if(v.code === 'rate'){
      if(CFG.sv && CFG.sv.triche){
        // banc d'essai : on encaisse la sortie de zone sans mourir
        S.zoneSurvie = Math.max(Math.max(2, plancherZone()), S.zoneSurvie - 2);
        S.chaineSurvie = 0; S.gainSurvie = null;
        couleur = 't-s20';
        T.textContent = 'Sortie encaissée';
        U.textContent = 'mode test · zone ± ' + fmt(S.zoneSurvie);
      }
      else if(S.vies > 0){
        // seconde chance : on survit, mais la zone est amputée de moitié
        S.vies--;
        S.zoneSurvie = Math.max(Math.max(2, plancherZone()),
                                Math.round(S.zoneSurvie / 2));
        S.chaineSurvie = 0; S.gainSurvie = null;
        couleur = 't-s20';
        T.textContent = 'Rattrapé de justesse';
        U.textContent = 'une vie consommée · zone ± ' + fmt(S.zoneSurvie);
        sonSurvie('vie');
        vibrerSv(60);
      } 
      // NOUVEAU BLOC : LE CLOUD DU RÉSEAU
      else if(effB('cloud') && !S.cloudUtilise){
        S.cloudUtilise = true;
        S.rejouerBiome = true; // Déclenchera le retour dans le temps
        S.zoneSurvie = 20; // On redonne une zone viable pour retenter
        S.chaineSurvie = 0; S.gainSurvie = null;
        couleur = 't-s100'; // Violet/Bleu pour marquer la réussite de l'événement
        T.textContent = 'Sauvegarde Cloud chargée';
        U.textContent = 'Restauration au début du réseau... La prochaine erreur sera fatale.';
        sonSurvie('vie');
        vibrerSv(60);
      } 
      else {
        S.mort = true; couleur = 't-s0'; S.gainSurvie = null;
        T.textContent = 'Éliminé au tour ' + S.tour;
        U.textContent = 'la zone était à ± ' + fmt(zone()) + ' · écart ±' + fmt(ecart);
        sonSurvie('mort');
        vibrerSv(180);
      }
    }
    else if(effB('boucle') && S.tour % effB('boucle') === 0 && !S.boucleFaite){
      // Faille : le tour est purement et simplement annulé. Le chrono revient
      // à son point de départ, le compteur ne bouge pas, et rien de ce qui
      // vient d'être joué n'est comptabilisé — bon comme mauvais.
      S.boucleFaite = true;
      S.rejouerTour = true;
      couleur = 't-s20'; S.gainSurvie = null;
      T.textContent = 'La faille rejoue ce tour';
      U.textContent = 'écart ±' + fmt(ecart) + ' · seul le second essai comptera';
    }
    else {
      S.boucleFaite = false;
      S.points = S.tour;
      let bonus = 0;
      const seuilB = effB('seuil') || 3;            // Horlogerie élargit le frôlé
      // Enfer : le pile est puni au lieu d'être récompensé
      const punir = effB('enfer') && ecart === 0;
      if(punir)                bonus = 0;
      else if(ecart === 0)     bonus = effB('pile') || 4;
      else if(ecart <= seuilB) bonus = effB('frole') || 3;   // Cité engloutie
      if(bonus && alerte) bonus = Math.max(bonus, 8);       // Station : tour d'alerte
      if(bonus && effB('majGain')) bonus = Math.round(bonus * 1.5);   // Ruines
      // Spatial : un tour joué à l'aveugle et réussi vaut double
      if(bonus && S.aveugleTour && effB('doubleAveugle')) bonus *= 2;
      const doublePari = S.pariSurvie;
      S.chaineSurvie = bonus ? (S.chaineSurvie || 0) + 1 : 0;
      if(S.chaineSurvie >= 3)       bonus = Math.round(bonus * 2);
      else if(S.chaineSurvie === 2) bonus = Math.round(bonus * 1.5);
      if(doublePari && bonus) bonus *= 2;      // le pari tenu double le gain

      // une vie de rab au troisième pile, ou au deuxième pile d'affilée
      let vieGagnee = false;
      if(ecart === 0){
        S.pilesSurvie++;
        S.pilesEnchaines = (S.pilesEnchaines || 0) + 1;
        if(!effB('sansVie') && S.vies < viesMax()
           && (S.pilesSurvie % (effB('vieRapide') ? 2 : 3) === 0
               || S.pilesEnchaines >= 2)){
          S.vies++; vieGagnee = true; S.pilesEnchaines = 0;
        }
      } else S.pilesEnchaines = 0;

      let usureBase = Math.max(1,
        (S.tour < 10 ? 1 : S.tour < 20 ? 2 : 3) + effB('usure'));
      if(effB('demiUsure')) usureBase = Math.max(1, Math.round(usureBase / 2));
      // Banquise : quoi qu'il arrive, le terrain ne fond jamais plus vite
      if(effB('usureMax')) usureBase = Math.min(usureBase, effB('usureMax'));
      if(punir) usureBase += 4;      // Enfer : le pile coûte quatre de plus
      // Ruines : l'usure ne s'annule jamais, même sur un bon coup
      const usure = (bonus && !effB('effritement')) ? 0 : usureBase;
      const avant = S.zoneSurvie;

      // palier tous les dix tours : cinq centièmes rendus. Actif d'office, sauf
      // en difficulté hard où la partie doit rester tranchante.
      let palier = 0;
      if(CFG.diff !== 'hard' && S.tour % PALIER_SURVIE === 0) palier = 5;

      const plaf = plafondSurvie(S.tour);
      // Chantier : l'échafaudage tient, la zone ne descend pas sous son plancher
      S.zoneSurvie = Math.max(plancherZone(),
                              Math.min(plaf, S.zoneSurvie - usure + bonus + palier));

      const delta = S.zoneSurvie - avant;
      S.gainSurvie = delta;
      couleur = ecart === 0 ? 't-s100' : bonus ? 't-s50' : 't-s20';
      // Paradis : un pile fait sauter un tour
      let saut = false;
      if(effB('paradis') && ecart === 0){ saut = true; S.sautTour = true; }
      T.textContent = punir ? 'Pile · châtié'
        : saut ? 'Pile · tour offert'
        : vieGagnee ? 'Pile · une vie gagnée'
        : alerte && bonus ? 'Alerte tenue'
        : ecart === 0 ? 'Pile'
        : bonus ? (doublePari ? 'Pari tenu · gain doublé' : 'Dans les 3 centièmes')
        : 'Zone tenue';
      U.textContent = 'zone ± ' + fmt(S.zoneSurvie)
        + (bonus ? ' · usure annulée' : ' · usure ' + fmt(usureBase))
        + (palier ? ' · palier +0,05' : '')
        + (effB('effritement') && bonus ? ' · le sol s\'effrite quand même' : '')
        + (punir ? ' · rien n\'est pardonné' : '')
        + (saut ? ' · tu passes au ' + (S.tour + 2) : '')
        + (S.chaineSurvie >= 2 ? ' · série de ' + S.chaineSurvie : '');
      sonSurvie(ecart === 0 ? 'pile' : bonus ? 'bon' : 'passe');
      vibrerSv(bonus ? 25 : 12);

      // défi de série en cours : trois coups dans les trois centièmes
      if(S.defiSerie){
        if(ecart <= 3){
          S.defiSerie.faits++; S.defiSerie.reste--;
          if(S.defiSerie.reste <= 0){
            S.zoneSurvie = plafondSurvie(S.tour);
            S.defiSerie = null;
            T.textContent = 'Défi réussi'; couleur = 't-s100';
            U.textContent = 'zone remise au maximum · ± ' + fmt(S.zoneSurvie);
            sonSurvie('vie');
          } else U.textContent += ' · défi : ' + S.defiSerie.reste + ' à faire';
        } else {
          S.defiSerie = null;
          if(S.vies > 0){ S.vies--; U.textContent += ' · défi manqué, une vie perdue'; }
          else { S.zoneSurvie = Math.max(1, S.zoneSurvie - 5);
                 U.textContent += ' · défi manqué, −0,05'; }
        }
      }

      // on retient la meilleure remontée de la partie, pour la raconter à la fin
      if(bonus){
        const s = S.serieCourante = S.serieCourante || {n:0, de:avant, tour:S.tour};
        s.n++; s.a = S.zoneSurvie;
        if(s.n > S.meilleureSerie.n) S.meilleureSerie = {...s};
      } else S.serieCourante = null;
    }
    // le pari ne vaut que pour le tour suivant celui où il est pris
    if(!S.mort){ S.pariSurvie = false; S.courbe.push(S.zoneSurvie); }
  }
  else if(CFG.mode === 'escalier'){
    const v = evaluer(ecart);
    const duree = m => fmt(100 + (m - 1) * 50);
    if(v.code === 'rate' && !(CFG.sv && CFG.sv.triche)){
      S.chutes++;
      if(S.marche > 1) S.marche--;
      couleur = 't-s0';
      T.textContent = 'Chute · ' + (3 - S.chutes) + ' vie'
        + (3 - S.chutes > 1 ? 's' : '') + ' restante' + (3 - S.chutes > 1 ? 's' : '');
      U.textContent = 'retour à ' + duree(S.marche) + ' s · record ' + duree(S.points || 1) + ' s';
    } else {
      S.points = Math.max(S.points, S.marche);
      // un pile fait sauter une marche : la montée devient nerveuse
      const saut = ecart === 0 ? 2 : 1;
      S.marche += saut;
      couleur = ecart === 0 ? 't-s100' : 't-s50';
      T.textContent = ecart === 0 ? 'Pile · deux marches d\'un coup'
                                  : 'Marche ' + duree(S.marche - 1) + ' s franchie';
      U.textContent = 'prochaine : ' + duree(S.marche) + ' s · zone ± '
        + fmt(Math.max(8, 34 - (S.marche - 1) * 2));
    }
  }
  else if(CFG.mode === 'sprint'){
    const pts = ecart === 0 ? 100 : ecart <= PRES ? 50 : ecart <= zone() ? 20 : 0;
    S.points += pts; S.reussites += pts ? 1 : 0;
    couleur = pts === 100 ? 't-s100' : pts === 50 ? 't-s50'
      : pts === 20 ? 't-s20' : 't-s0';
    const reste = Math.max(0, 30 - (performance.now() - S.debutSprint) / 1000);
    T.textContent = pts ? '+' + pts + ' points' : 'Aucun point';
    U.textContent = reste.toFixed(0).replace('.', ',') + ' s restantes · '
      + S.tour + ' cible' + (S.tour > 1 ? 's' : '') + ' · total ' + S.points;
  }
  else if(CFG.mode === 'defi'){
    const d = S.defi;
    if(d.mesure === 'piles'){
      if(ecart === 0){ S.reussites++; S.points = S.reussites; }
      couleur = ecart === 0 ? 't-s100' : 't-s20';
      T.textContent = ecart === 0 ? 'Pile !' : 'Manqué de ' + fmt(ecart);
      U.textContent = S.reussites + ' pile' + (S.reussites > 1 ? 's' : '')
        + ' sur ' + d.but + ' · essai ' + S.tour + ' sur ' + d.essais;
    } else if(d.mesure === 'suite'){
      if(ecart <= zone()){
        S.reussites++; S.points = S.reussites;
        couleur = 't-s50';
        T.textContent = 'Réussi · ' + S.reussites + ' sur ' + d.essais;
        U.textContent = 'écart ±' + fmt(ecart) + ' · ne rate pas la suivante';
      } else {
        S.mort = true; couleur = 't-s0';
        T.textContent = 'Série interrompue';
        U.textContent = S.reussites + ' réussite' + (S.reussites > 1 ? 's' : '')
          + ' avant l\'erreur';
      }
    } else {
      // mesure d'écart : le score est la précision, plus bas vaut mieux
      S.ecartsDefi = (S.ecartsDefi || []).concat(ecart);
      const moyD = Math.round(S.ecartsDefi.reduce((a,b) => a+b, 0) / S.ecartsDefi.length);
      S.points = moyD;
      couleur = ecart === 0 ? 't-s100' : ecart <= PRES ? 't-s50'
        : ecart <= zone() ? 't-s20' : 't-s0';
      T.textContent = 'Écart ±' + fmt(ecart);
      U.textContent = d.essais > 1
        ? 'essai ' + S.tour + ' sur ' + d.essais + ' · moyenne ±' + fmt(moyD)
        : 'résultat définitif · une seule tentative';
    }
  }
  else if(CFG.mode === 'combat'){
    const b = bossCourant();
    if(ecart <= zone()){
      // au centre exact de la garde, le coup compte double
      const crit = ecart <= PRES;
      const deg = Math.max(4, Math.round((30 - ecart) * (crit ? 2 : 1)));
      S.pvBoss = Math.max(0, S.pvBoss - deg);
      if(crit) S.critiques++; else S.critiques = 0;
      // trois coups critiques d'affilée forcent une ouverture
      if(S.critiques >= 3){ S.gardeBoss += 6; S.critiques = 0; }
      couleur = crit ? 't-s100' : 't-s50';
      T.textContent = crit ? 'Critique · −' + deg : 'Touché · −' + deg;
      U.textContent = '';   // les barres de vie disent déjà tout
    } else {
      S.pvMoi = Math.max(0, S.pvMoi - b.degats);
      S.touches++; S.critiques = 0;
      // il apprend : après trois coups portés, sa garde se resserre
      if(S.touches % 3 === 0) S.gardeBoss = Math.max(3, S.gardeBoss - 3);
      couleur = 't-s0';
      T.textContent = 'Manqué · −' + b.degats;
      U.textContent = '';
    }
    S.points = Math.max(0, S.pvBoss <= 0 ? 500 + S.pvMoi * 5 : 0);
  }
  else if(CFG.mode === 'reflexe'){
    const ms = Math.round((valeur - S.total) * 10);   // centièmes → ms
    S.reflexes.push(ms);
    // Barème calé sur la réalité du tactile : l'écran ajoute 30 à 60 ms au temps
    // neurologique. Sous 300 ms sur téléphone, c'est déjà exceptionnel.
    const pts = Math.max(0, Math.round((800 - ms)));
    S.points += pts;
    couleur = ms < 300 ? 't-s100' : ms < 400 ? 't-s50' : ms < 550 ? 't-s20' : 't-s0';
    const moy = Math.round(S.reflexes.reduce((a,b) => a+b, 0) / S.reflexes.length);
    T.textContent = ms + ' ms';
    U.textContent = (ms < 250 ? 'exceptionnel' : ms < 300 ? 'excellent'
                   : ms < 400 ? 'bon' : ms < 550 ? 'correct' : 'lent')
      + ' · +' + pts + ' pts · moyenne ' + moy + ' ms';
    S.dernierMs = ms;
  }
  else if(estSolo(CFG.mode)){
    const doubles = CFG.mode === 'nues' ? 2 : 1;
    let pts;
    if(ecart === 0){
      S.chaine++;
      S.meilleureChaine = Math.max(S.meilleureChaine, S.chaine);
      const m = Math.min(MULT_MAX, S.chaine);
      S.chaineFrole = 0;          // un pile n'entretient pas la chaîne de frôlements
      pts = PTS.pile * m * doubles; couleur = 't-s100';
      T.textContent = '+' + pts + ' points' + (m > 1 ? '  ×' + m : '');
      U.textContent = 'pile · série de ' + S.chaine
        + (S.chaine >= MULT_MAX ? ' · multiplicateur au plafond' : '');
    } else {
      if(S.chaine > 1) vibrer(30);
      S.chaine = 0;
      if(ecart <= PRES){
        // variante enchaînée : chaque frôlement consécutif ajoute 10 points
        if(CFG.mode === 'solo2'){
          S.chaineFrole = (S.chaineFrole || 0) + 1;
          pts = (PTS.frole + (S.chaineFrole - 1) * 10) * doubles;
        } else pts = PTS.frole * doubles;
        couleur = 't-s50';
      }
      else if(ecart <= zone()){ pts = PTS.zone * doubles;  couleur = 't-s20';
                                S.chaineFrole = 0; }   // la chaîne casse aussi ici
      else {                    pts = PTS.rate;            couleur = 't-s0';
                                S.chaineFrole = 0; }
      T.textContent = pts ? '+' + pts + ' points' : 'Aucun point';
      U.textContent = 'écart ±' + fmt(ecart) + ' · zone ± ' + fmt(zone())
        + (CFG.mode === 'solo2' && S.chaineFrole > 1
           ? ' · ' + S.chaineFrole + ' frôlements d\'affilée' : '');
    }
    S.points += pts;
    U.textContent += ' · total ' + S.points;
    // on ne révèle qui l'on dépasse qu'au tout dernier tour : l'annoncer avant
    // gâche le suspense et parasite la lecture du score
    if(S.tour >= (CFG.maxTours || 10)){
      const dep = depassements();
      if(dep) U.textContent += ' — ' + dep;
    }
  }
  /* ─── coopératif : trois vies partagées, cap sur 30,00 s ─── */
  else if(CFG.mode === 'coop'){
    const v = evaluer(ecart);
    couleur = v.couleur;
    if(v.code === 'rate'){
      S.vies--;
      S.joueurs.forEach(n => S.stats[n].gorgees += 1);
      couleur = 't-signal';
      T.textContent = 'Une vie en moins';
      U.textContent = S.vies + ' vie' + (S.vies>1?'s':'') + ' restante'
        + (S.vies>1?'s':'') + ' · toute la table boit une gorgée';
    } else {
      T.textContent = 'Chrono à ' + fmt(valeur);
      U.textContent = 'objectif 30,00 · ' + fmt(Math.max(0, 3000 - valeur)) + ' s à parcourir';
    }
  }

  /* ─── enchère : le joueur a annoncé sa précision ─── */
  else if(CFG.mode === 'enchere' && S.enchere){
        const e = ENCHERES.find(x => x.seuil === S.enchere);
        if(ecart === 0){
          S.contre = 1; couleur = 't-s100';
          T.textContent = suiv + ' : ' + nomCulSec();
          U.textContent = 'pile — sauf si ' + suiv + ' fait pile aussi';
          vibrer([0,60,50,60,50,140]);
        } else if(ecart <= e.seuil){
          couleur = 't-vert';
          const n = peine(suiv, e.n * mult, true, joueur);
          T.textContent = suiv + ' boit ' + gorg(n);
          U.textContent = 'enchère tenue à ±' + fmt(e.seuil) + ' · écart ±' + fmt(ecart);
        } else { 
      couleur = 't-signal';
      const n = peine(joueur, e.n * 2 * mult);
      T.textContent = n ? joueur + ' boit ' + gorg(n) : joueur + ' : bouclier consommé';
      U.textContent = 'enchère manquée · annoncé ±' + fmt(e.seuil)
        + ', réalisé ±' + fmt(ecart);
    }
  }
  else {
        const v = evaluer(ecart);
        couleur = v.couleur;

        // --- LOGIQUE GORGÉES BLIND & PARIS ---
        let nbCulsSecs = 1;
        let gorgeesBase = RATE[CFG.gor];
        let gorgeesFrole = v.n;
        let gorgeesPresque = 0;

        if(CFG.mode === 'blind') {
          const dSec = Math.round(dureeVoulue / 100);
          
          // 1. PILE
          nbCulsSecs = dSec < 6 ? 1 : 2; 
          
          // 2. RATÉ (Gorgées bues)
          // Les deux tranches courtes (1-6s, les plus dures à viser) sont
          // unifiées à 3 gorgées : avant, une cible de 2s punissait plus
          // fort (5) qu'une cible de 8s (3), alors que la première est
          // nettement plus difficile à honorer. Les tranches longues
          // (7-10s) restent inchangées côté gorgées — c'est la zone sûre
          // ci-dessous qui se charge de les rééquilibrer.
          if(dSec <= 6) gorgeesBase = 3;
          else if(dSec <= 9) gorgeesBase = 3;
          else gorgeesBase = 2;

          if(CFG.gor === 'gros') gorgeesBase += 1;
          
          // 3. FRÔLÉ ET PRESQUE (Gorgées distribuées)
          gorgeesFrole = Math.round(3 + (dSec - 1) * (5 / 9));
          gorgeesPresque = Math.round(1 + (dSec - 1) * (4 / 9));

          // 4. ZONE PRESQUE DYNAMIQUE
          const limitePresque = CFG.diff === 'hard' 
            ? Math.round(10 + (dSec - 1) * (25 / 9))
            : Math.round(8 + (dSec - 1) * (22 / 9));

          if (v.code === 'sauf' && ecart <= limitePresque) {
            v.code = 'presque';
            couleur = 't-s50';
          }

          // 5. APPLICATION DES ENJEUX DU PARI
          // Un pari actif rend le tour strictement binaire : dans la zone
          // annoncée au moment du pari, ou hors d'elle. Le "presque" (zone
          // élargie de l'étape 4 ci-dessus) n'existe plus pour ce tour-là,
          // quel que soit le v.code que l'évaluation normale avait posé :
          // soit on réussit et l'adversaire boit, soit on rate et c'est pour
          // nous, jamais un résultat intermédiaire.
          if(S.pariActif) {
            const { deltaSec, type } = S.pariActif;
            const nouvelleDureeSec = Math.round(dureeVoulue / 100);
            // Précision exigée par le pari : 0.15s (1s) à 0.30s (10s) -> convertie en centièmes (15 à 30)
            const precisionViseeCentièmes = Math.round(15 + (nouvelleDureeSec - 1) * (15 / 9));
            const pariReussi = ecart <= precisionViseeCentièmes;

            if (type === 'hausse') {
              if (pariReussi) {
                // Pari réussi à la hausse : gorgées distribuées majorées du bonus
                const bon = Math.abs(deltaSec);
                gorgeesFrole += bon;
              }
              // raté : gorgeesBase (déjà calculé plus haut) reste la pénalité
            } else if (type === 'baisse') {
              if (!pariReussi) {
                // Pari raté à la baisse : il échoue malgré la facilité -> il boit fort
                const pen = Math.abs(deltaSec);
                gorgeesBase += pen;
              }
            }
            v.code = pariReussi ? 'frole' : 'rate';
            couleur = pariReussi ? 't-s50' : 't-signal';
            S.pariActif = null;
          }
        }
        //--------
   
        if(CFG.mode === 'elimination' && v.code === 'rate'){
          S.fautes[joueur] = (S.fautes[joueur] || 0) + 1;
          if(S.fautes[joueur] >= 3 && !S.elimines.includes(joueur)) S.elimines.push(joueur);
        }
        
        if(v.code === 'pile'){
          S.contre = nbCulsSecs * mult;
          T.textContent = (S.evt === 'choix' ? suiv : suiv) + ' : ' + culs(S.contre);
          U.textContent = (S.evt === 'choix' ? joueur + ' a fait pile et désigné ' + suiv : 'pile — sauf si ' + suiv + ' fait pile aussi');
          vibrer([0,60,50,60,50,140]);
        }
        else if(v.code === 'frole'){
          const victime = suiv;
          const n = peine(victime, gorgeesFrole * mult, true, joueur);
          if(S.evt === 'bouclier'){
            S.jetons[joueur] = (S.jetons[joueur]||0) + 1;
            couleur = 't-alerte';
            T.textContent = 'Bouclier pour ' + joueur;
            U.textContent = victime + ' boit ' + gorg(n) + (mult>1 ? ' (doublé)' : '');
          } else {
            T.textContent = victime + ' boit ' + gorg(n);
            U.textContent = (S.evt === 'choix' ? joueur + ' a frôlé et désigné ' + victime : 'à ' + ecart + ' centième' + (ecart>1?'s':'') + ' du pile' + (mult>1 ? ' · doublé' : ''));
          }
        }
        else if(v.code === 'presque'){
          const victime = suiv;
          const n = peine(victime, gorgeesPresque * mult, true, joueur);
          if(S.evt === 'bouclier'){
            S.jetons[joueur] = (S.jetons[joueur]||0) + 1;
            couleur = 't-alerte';
            T.textContent = 'Bouclier pour ' + joueur;
            U.textContent = victime + ' boit ' + gorg(n) + (mult>1 ? ' (doublé)' : '');
          } else {
            T.textContent = victime + ' boit ' + gorg(n);
            U.textContent = (S.evt === 'choix' ? joueur + ' a fait un bon score et désigné ' + victime : 'joli tir à ±' + fmt(ecart) + ' !' + (mult>1 ? ' · doublé' : ''));
          }
        }
        else if(v.code === 'sauf'){
          T.textContent = 'Personne ne boit';
          U.textContent = (S.evt === 'choix' ? joueur + ' passe la main à ' + suiv : 'dans la marge');
        }
        else {
          if(S.evt === 'bord'){
            S.joueurs.forEach(n => S.stats[n].gorgees += gorgeesBase * mult);
            T.textContent = 'Toute la table boit ' + gorg(gorgeesBase * mult);
            U.textContent = joueur + ' est sorti de la zone';
          } else {
            const n = peine(joueur, gorgeesBase * mult);
            T.textContent = n ? joueur + ' boit ' + gorg(n) : joueur + ' : bouclier consommé';
            U.textContent = (S.evt === 'choix' ? 'hors marge · ' + joueur + ' passe la main à ' + suiv : 'hors marge · écart ±' + fmt(ecart)) + (mult>1 ? ' · doublé' : '');
          }
        }
      } // Fin du bloc d'évaluation
 
      if(CFG.mode === 'elimination' && S.elimines.includes(joueur)){
        couleur = 't-signal';
        T.textContent = joueur + ' est éliminé';
        U.textContent = 'trois sorties de zone · il reste ' + actifs().length
          + ' joueur' + (actifs().length>1?'s':'') + ' en lice';
      }
  T.className = 'titre ' + couleur;
  T.parentElement.className = 'carte-verdict ' + couleur;
  $('res-score').className = 'score ' + couleur;
  S.historique.unshift({nom:joueur, cible:S.cible, val:valeur, couleur, tour:S.tour});
  dessinerFilm();

  // cibles nues : chaque tour est indépendant, le chrono ne cumule pas
  // aventure : à la sortie d'un combat gagné, on reprend la marche exactement
  // là où elle en était avant l'affrontement, pas sur la dernière frappe
  const repriseMarcheAvt = AVT() && S.avt && !S.avt.enCombat && S.avt.totalAvantCombat != null;
  if(avance){
    if(repriseMarcheAvt){ S.total = S.avt.totalAvantCombat; S.avt.totalAvantCombat = null; }
    else S.total = remiseAZero() ? 0 : valeur;
    S.enAttente = cibleSuivante(S.total);
  }
  else       { S.enAttente = S.cible; }
  S.finDeTour = {avance};
  const pioche = L => L[Math.floor(Math.random() * L.length)];
  let mot;
  if(CFG.mode === 'defi' || CFG.mode === 'reflexe')  mot = '';
  else if(minutePile)                               mot = pioche(sansJean(MOTS_MINUTE, 'La minute pile.'));
  else if(estSolo(CFG.mode) && S.chaine >= 2)     mot = motSerie(S.chaine);
  else                                              mot = blague(ecart);
  if(estSolo(CFG.mode) && S.chaine >= 2) S.derniereBlague = 'serie';
  $('ver-blague').textContent = mot;
  S.dernier = {titre:T.textContent, sous:U.textContent, couleur, valeur, delta, ecart,
               dureeVoulue, dureeTenue, blague:mot};
  $('res-duree').innerHTML = 'à tenir <b>' + fmt(dureeVoulue) + '</b>'
    + ' · tenu <b class="' + couleur + '">' + fmt(dureeTenue) + '</b>';
  fluideResultat();
}

/* ════════ INTERFACE FLUIDE ════════ */
// un seul écran : le grand chiffre au centre est le chrono, puis le résultat.
// Les statistiques passent derrière un bouton « Détails ».
function bandeaux(pfx){
  const r = $(pfx+'riposte');
  r.classList.toggle('on', S.contre > 0);
  if(S.contre > 0){
    $(pfx+'rip-titre').textContent = 'Riposte · ' + culs(S.contre);
    $(pfx+'rip-sous').textContent = 'Fais pile pour renvoyer la mise à '
      + culs(S.contre+1) + '. Tout le reste : tu bois.';
  }
  const e = $(pfx+'evt');
  e.classList.toggle('on', !!S.evt);
  if(S.evt){
    const d = EVT(S.evt);
    $(pfx+'evt-titre').textContent = S.duel ? d.n + ' · manche 2' : d.n;
    $(pfx+'evt-sous').textContent = d.d;
  }
}

// Le pari n'est plus un bouton permanent : il surgit de temps en temps, avec
// une phrase qui résume la situation. Une proposition, pas une option.
const PARIS = [
  {q:s => s.z >= 30, t:"Tu respires. C'est le moment de prendre un risque ?",
   s:s => 'Zone à ± ' + fmt(s.z) + ', tour ' + s.tour + '. Tu as de la marge.'},
  {q:s => s.z < 30 && s.z >= 18, t:"La zone se referme doucement. Un coup d'accélérateur ?",
   s:s => 'Zone à ± ' + fmt(s.z) + '. Un bon coup te rendrait le double.'},
  {q:s => s.z < 18, t:"Ça devient serré. Tu tentes le tout pour le tout ?",
   s:s => 'Zone à ± ' + fmt(s.z) + ' seulement. Risqué, mais tu n\'as plus grand-chose à perdre.'},
  {q:s => s.chaine >= 2, t:"Tu es en forme. On double la mise ?",
   s:s => s.chaine + ' bons coups d\'affilée. La série paie déjà, le pari la ferait exploser.'},
  {q:s => s.vies > 0, t:"Tu as un filet. Autant s'en servir.",
   s:s => 'Une vie en réserve et ' + fmt(s.z) + ' de zone. Le moment ou jamais.'},
  {q:s => s.tour >= 20, t:"Tour " + '', s:s => ''}
];
function phrasePari(){
  const st = {z:S.zoneSurvie, tour:S.tour, chaine:S.chaineSurvie || 0, vies:S.vies || 0};
  const c = PARIS.filter(p => p.q(st) && p.t);
  const p = c[Math.floor(Math.random() * c.length)] || PARIS[0];
  return {titre:p.t, sous:p.s(st)};
}
// Plafond global : au-delà de trois interruptions, la partie devient une
// conversation. On compte tout ensemble, pari inclus.
const MAX_INTERRUPTIONS = 3;
// Espacement minimal entre deux rendez-vous, croissant avec l'avancée.
// « Minimum » : au-delà, le tirage peut laisser jusqu'à vingt tours de calme.
const ecartMini = tour => tour >= 100 ? 6 : tour >= 50 ? 5 : 4;
function tirerProchainRdv(tour){
  const mini = ecartMini(tour);
  // loi géométrique bornée : souvent proche du minimum, parfois très loin
  const r = S.alea ? S.alea() : Math.random();
  return tour + mini + Math.floor(Math.pow(r, 1.7) * (20 - mini + 1));
}
function peutInterrompre(){
  // jamais deux tours de suite, quoi qu'il arrive
  if(S.dernierRdv !== undefined && S.tour - S.dernierRdv < ecartMini(S.tour)) return false;
  // ni au premier tour d'un biome : la bascule occupe déjà l'écran
  if(CFG.sv && CFG.sv.biomes && (S.tour - 1) % TOURS_BIOME === 0) return false;
  // Un chrono lancé ne doit jamais être interrompu : le joueur a déjà commencé
  // à compter, et une modale lui ferait perdre le tour.
  return (S.interruptions || 0) < MAX_INTERRUPTIONS
      && CFG.mode === 'survie' && S.partie && !S.mort
      && !S.encours && S.fPhase === 'repos'
      && !$('modale').classList.contains('on')
      && CFG.sv && CFG.sv.evenements !== false;
}
function noterInterruption(){
  S.interruptions = (S.interruptions || 0) + 1;
  S.dernierRdv = S.tour;
  S.prochainRdv = tirerProchainRdv(S.tour);
}

// Le troc : une vie contre du terrain. Ne se propose que si l'on a les deux
// ressources et que l'une manque cruellement.
async function proposerTroc(){
  if(!peutInterrompre() || S.trocPropose) return false;
  if(S.vies < 1 || S.zoneSurvie >= 15 || S.tour < 8) return false;
  S.trocPropose = true; noterInterruption();
  const oui = await choisir('Tu as un filet, mais plus de terrain.',
    'Zone à ± ' + fmt(S.zoneSurvie) + ' et une vie en réserve. '
    + 'Tu peux échanger ta vie contre 12 centièmes de zone, tout de suite.',
    [{label:'J\'échange', val:true}, {label:'Je garde ma vie', val:false}]);
  if(!oui) return false;
  S.vies--;
  S.zoneSurvie = Math.min(plafondSurvie(S.tour), S.zoneSurvie + 12);
  majAnneau(); compteursMode('f-'); vibrerSv(30); sonSurvie('vie');
  return true;
}

// Le va-tout : proposé au bord de la mort, quand refuser n'est plus évident.
async function proposerVaTout(){
  if(!peutInterrompre() || S.vaToutPropose) return false;
  if(S.zoneSurvie > 9 || S.tour < 10) return false;
  S.vaToutPropose = true; noterInterruption();
  const oui = await choisir('Tout ou rien ?',
    'Il te reste ± ' + fmt(S.zoneSurvie) + '. Le prochain coup dans les trois '
    + 'centièmes te ramène à ± 0,30. Sinon, c\'est fini immédiatement.',
    [{label:'Je tente', val:true}, {label:'Je continue', val:false}]);
  if(!oui) return false;
  S.vaTout = true;
  compteursMode('f-');
  vibrerSv(40);
  return true;
}

// La série demandée : une contrainte qui court sur trois tours.
async function proposerSerie(){
  if(!peutInterrompre() || S.seriePropose) return false;
  if(S.tour < 15 || S.zoneSurvie <= 10) return false;
  S.seriePropose = true; noterInterruption();
  const oui = await choisir('Trois d\'affilée dans les trois centièmes ?',
    'Réussi, la zone revient au maximum. Raté, tu perds ta vie — '
    + 'ou cinq centièmes si tu n\'en as pas.',
    [{label:'Je tente', val:true}, {label:'Pas maintenant', val:false}]);
  if(!oui) return false;
  S.defiSerie = {reste:3, faits:0};
  compteursMode('f-');
  vibrerSv(30);
  return true;
}

// Un seul rendez-vous par tour, choisi selon la situation.
async function proposerRendezVous(){
  if(!peutInterrompre() || S.defiSerie || S.vaTout) return;
  if(S.prochainRdv !== undefined && S.tour < S.prochainRdv) return;
  // filet : on note l'état pour pouvoir le restituer à l'identique
  const avant = {total:S.total, cible:S.cible, tour:S.tour, zone:S.zoneSurvie};
  const rendre = () => {
    if(S.encours){                       // un chrono a démarré pendant la modale
      S.encours = false; purgerMinuteries();
      S.total = avant.total; S.cible = avant.cible;
      S.tour = avant.tour; S.zoneSurvie = avant.zone;
      fluidePhase('repos'); fluidePret();
    }
  };
  if(await proposerVaTout()){ rendre(); return; }   // la survie immédiate d'abord
  if(await proposerTroc()){   rendre(); return; }
  if(await proposerSerie()){  rendre(); return; }
  await proposerPari();
  rendre();
}

async function proposerPari(){
  if(CFG.mode !== 'survie' || !S.partie || S.pariSurvie) return;
  if(!CFG.sv || !CFG.sv.pari) return;
  if(!peutInterrompre()) return;
  if(S.zoneSurvie <= 8) return;
  // rendez-vous rare : un pari tous les 30 à 40 tours, jamais plus souvent
  noterInterruption();
  const p = phrasePari();
  const oui = await choisir(p.titre, p.sous + ' Le pari coûte '
    + fmt(effB('pari') || 5) + ' de zone '
    + 'et double le gain si le prochain coup est bon.',
    [{label:'Je parie', val:true}, {label:'Pas cette fois', val:false}]);
  if(!oui) return;
  S.pariSurvie = true;
  S.zoneSurvie = Math.max(1, S.zoneSurvie - (effB('pari') || 5));
  majAnneau(); compteursMode('f-');
  vibrerSv(20);
}
/* Quitte ou double : le bouton n'apparaît qu'entre deux tours, quand une
   cagnotte est réellement en jeu. Il est masqué pendant la mesure — comme
   tout le reste, rien ne doit bouger pendant qu'on chronomètre. */
function majEncaisser(){
  const b = $('f-encaisser');
  if(!b) return;
  const actif = CFG.mode === 'quitte' && S.partie && !S.encours
             && S.lab && S.lab.cagnotte > 0 && !S.lab.encaisse && !S.mort;
  b.classList.toggle('on', !!actif);
  if(actif) b.textContent = 'Encaisser ' + S.lab.cagnotte;
}
if($('f-encaisser')) $('f-encaisser').onclick = () => {
  if(!S.lab || !S.lab.cagnotte || S.lab.encaisse) return;
  S.lab.encaisse = true;
  majEncaisser();
  /* fini() renvoie désormais true : afficherFin() lira le bilan du mode */
  afficherFin();
};

function majPari(){
  const b = $('f-pari');
  b.classList.toggle('on', CFG.mode === 'survie' && S.partie && !!S.pariSurvie);
  b.classList.toggle('pris', !!S.pariSurvie);
  if(S.pariSurvie) b.textContent = 'Pari en cours · gain doublé';
}


// Applique le nom et le tour mis en attente par fluidePret() quand un
// verdict était encore affiché en mode blind (voir fluidePret). Appelée au
// moment réel où l'on passe au joueur suivant : le tap "Suivant".
function appliquerBadgeEnAttente(){
  if(!S.badgeEnAttente) return;
  $('f-nom').textContent = S.badgeEnAttente.nom;
  surligner($('f-nom'), coulNom(S.badgeEnAttente.nom));
  $('f-tour').textContent = S.badgeEnAttente.tourTxt;
  S.badgeEnAttente = null;
  // le bouton Parier était masqué tant que le verdict précédent était
  // affiché (voir fluidePret) ; il redevient pertinent maintenant qu'on est
  // réellement sur l'écran prêt du joueur suivant
  const btnPariBlind = $('f-pari-blind');
  if(btnPariBlind && CFG.mode === 'blind' && CFG.pariBlind){
    btnPariBlind.style.display = 'flex';
    if(!S.pariActif){
      btnPariBlind.textContent = 'Parier';
      btnPariBlind.classList.remove('pris');
    }
  }
}

function fluidePret(){
  const nom = S.joueurs[S.idx];
  // capturé avant toute réécriture : sert à restaurer l'affichage si la mise
  // à jour doit être reportée (voir plus bas, mode blind + verdict affiché)
  const tourTxtAvant = $('f-tour').textContent;
  S.dureeTour = Math.max(1, Math.abs(S.cible - S.total));
  calerChrono();
  if(AVT() && S.avt){
    const pv = Math.max(0, S.avt.pvJoueur || 0), max = S.avt.pvJoueurMax || PV_JOUEUR_BASE;
    $('avt-pv-marche-n').textContent = pv;
    $('avt-pv-marche-barre').style.width = Math.max(0, Math.min(100, (pv / max) * 100)) + '%';
  }
  // la nappe se remet en route toute seule si elle s'est arrêtée
  if(CFG.mode === 'survie' && S.partie && CFG.sv && CFG.sv.son && CFG.sv.musique
     && !musique) lancerMusique();
  // Spatial : un tour sur trois se joue sans chrono
  S.aveugleTour = !!(effB('aveugle') && S.tour % effB('aveugle') === 0)
                  || !!(LAB() && LAB().aveugle)
                  || CFG.mode === 'blind';
  // Chantier : un tour sur cinq, la poutrelle passe devant les dixièmes
  S.dixiemesTour = !!(effB('dixiemes') && S.tour % effB('dixiemes') === 0);
  majNoirMine();
  // Station : un tour sur cinq passe en alerte, annoncé avant le départ
  S.alerteTour = !!(effB('alerte') && S.tour % effB('alerte') === 0);
  $('fluide').classList.toggle('alerte-tour', !!S.alerteTour);
  majPari();
  majEncaisser();

  if(CFG.mode === 'survie'){
    if(S.tRdv) clearTimeout(S.tRdv);
    S.tRdv = setTimeout(() => { S.tRdv = null; proposerRendezVous(); }, 700);
    appliquerEffetsBiome();
    // Incendie : passé quatre secondes, le tour part tout seul
    const urg = effB('urgence');
    if(urg) attendre(urg, () => {
      if(S.fPhase === 'repos' && S.partie && !$('modale').classList.contains('on'))
        demarrer(null);
    });
  }
  S.zoneTour = zoneDe(nom);   // recalculée à chaque tour : survie et handicap en dépendent
  // chaque mode a son propre compteur : « tour 3 / 10 » n'a pas de sens en survie
  const m = CFG.mode;
  if(m === 'survie') $('f-tour').textContent = S.essaiBiome
    ? 'Essai · tour ' + (S.tour - S.essaiBiome.debut + 1) + ' / ' + TOURS_BIOME
    : 'Tour ' + S.tour;
  else if(m === 'escalier') $('f-tour').textContent = 'Marche ' + fmt(100 + (S.marche-1)*50)
                                                    + ' s · ' + (3 - S.chutes) + ' vies';
  else if(m === 'sprint')   $('f-tour').textContent = S.debutSprint ? '' : 'Prêt ?';
  else if(m === 'defi' && S.defi){
    const util = MAX_ESSAIS_DEFI - essaisRestants();
    $('f-tour').textContent = util + ' / ' + MAX_ESSAIS_DEFI + ' tentatives'
      + (S.defi.essais > 1 ? ' · essai ' + S.tour + '/' + S.defi.essais : '');
  }
  else if(m === 'reflexe')  $('f-tour').textContent = 'Manche ' + S.tour + ' / 10';
  else if(AVT()){
    $('f-tour').textContent = S.avt && S.avt.enCombat
      ? biomeAvtCourant().n
      : 'Tour ' + S.tour + ' · ' + Math.max(0, TOURS_AVT - (S.avt ? S.avt.pas : 0))
        + ' pas avant le gardien';
  }
  else if(LAB()){
    const lb = LAB();
    $('f-tour').textContent =
        lb.id === 'braquage' ? 'Cadran ' + Math.min(3, S.lab.cadran + 1) + ' / 3'
                               + ' · alarme ' + S.lab.alarme + ' / ' + ALARME_MAX
      : lb.id === 'ricochet' ? 'Ricochet ' + S.lab.ricochets
      : lb.id === 'vertige'  ? 'Palier ' + (S.lab.palier + 1)
      : lb.id === 'origami'  ? S.lab.plis + ' pli' + (S.lab.plis>1?'s':'') + ' sur 8'
      : lb.id === 'duelf'    ? S.lab.mesPoints + ' – ' + S.lab.sesPoints
      : ENCHAINES[lb.id]     ? 'Appui ' + S.tour + ' / ' + ENCHAINES[lb.id].n
      : 'Tour ' + S.tour + ' / ' + (lb.tours || '∞');
  }
  else if(m === 'combat')   $('f-tour').textContent = bossCourant().n;
  else $('f-tour').textContent = CFG.maxTours ? `Tour ${S.tour} / ${CFG.maxTours}`
                                              : 'Tour ' + S.tour;
  // En mode blind, si un verdict est encore affiché (S.dernier), le nom et
  // le tour affichés ne doivent PAS changer tout de suite : ça donnait
  // l'impression que c'était déjà au joueur suivant de boire. La mise à jour
  // réelle est appliquée par appliquerBadgeEnAttente(), au moment du tap
  // "Suivant" (interception blind), pas ici.
  if(CFG.mode === 'blind' && S.dernier){
    // le texte de tour a déjà été réécrit par la chaîne ci-dessus : on le
    // met de côté pour plus tard, et on restaure l'ancien à l'écran
    S.badgeEnAttente = {nom, tourTxt: $('f-tour').textContent};
    $('f-tour').textContent = tourTxtAvant;
  } else {
    $('f-nom').textContent = nom;
    surligner($('f-nom'), coulNom(nom));
  }
  $('f-nom').closest('.f-nom-l').style.display = AVT() ? 'none' : '';
  
  if (CFG.mode === 'blind' && !S.blindPret && S.cibleBlindJouee) {
    $('f-obj-cible').textContent = fmt(S.cibleBlindJouee);
  } else {
    $('f-obj-cible').textContent = fmt(S.cible);
  }

  if(AVT() && $('avt-cible')) $('avt-cible').textContent = fmt(S.cible);
  // à l'escalier, c'est la durée à tenir qui compte, pas la cible cumulée
  const esc = CFG.mode === 'escalier';
  $('f-obj-cible').classList.toggle('geant', esc);
  if(esc){
    $('f-obj-cible').textContent = fmt(S.cible - S.total);
    $('f-obj-tenir').textContent = 'secondes à tenir · marche '
      + fmt(100 + (S.marche - 1) * 50) + ' s';
  }
  else if(CFG.mode === 'combat'){
    // en combat, seul le prochain nombre compte : la garde et les PV sont ailleurs
    $('f-obj-cible').textContent = fmt(S.cible);
    $('f-obj-tenir').textContent = 'garde ouverte à ± ' + fmt(zone());
  }
  // en survie, la cible suffit : la durée à tenir encombre pour rien
  else if(CFG.mode === 'survie'){
    if(rebours()) $('f-obj-tenir').textContent = 'le chrono descend';
    else $('f-obj-tenir').textContent = '';
  }
  else if(AVT()){
    // l'info combat vit dans le HUD visuel (barres, popup) : ce texte ferait
    // doublon et encombre l'écran, déjà chargé pendant un combat — en
    // marche, seul l'indice de sens inversé (Horlogerie) mérite d'apparaître
    $('f-obj-tenir').textContent
      = (!S.avt || !S.avt.enCombat) && rebours() ? 'le chrono descend' : '';
  }
  else if(LAB()){
    const lb = LAB();
    $('f-obj-tenir').textContent =
        lb.id === 'cascade'  ? 'dix appuis, le chrono ne s\'arrête pas'
      : lb.id === 'braquage' ? BRAQUAGE[cadranCourant()].n + ' · ± '
                               + fmtMs(BRAQUAGE[cadranCourant()].tol) + ' s'
      : lb.id === 'sniper'   ? 'un seul tir, à l\'aveugle, au millième'
      : lb.id === 'duelf'    ? 'fantôme à ± ' + fmt(S.lab.fantome[S.tour-1] || 0)
                               + ' sur ce tour'
      : fmt(S.cible - S.total) + ' s à tenir · zone ± ' + fmt(zone());
    if(ENCHAINES[lb.id]) $('f-obj-cible').textContent = fmt(ENCHAINES[lb.id].pas);
  }
  else $('f-obj-tenir').textContent = CFG.mode === 'reflexe'
    ? 'touche le bouton dès qu\'il apparaît'
    : fmt(S.cible - S.total) + ' s à tenir'
      + (CFG.mode === 'compte' ? ' · viser 20,00 au bout' : '');
  if(CFG.mode === 'reflexe'){ $('f-obj-cible').textContent = 'STOP'; }
  const jc = S.jetons[nom] || 0;
  $('f-bouclier').style.display = jc > 0 ? 'inline-block' : 'none';
  $('f-bouclier').textContent = jc > 1 ? '🛡️ ×' + jc : '🛡️';
  compteursMode('f-');
  bandeaux('f-');
  fluidePhase('repos');

  // Affichage du bouton Pari Blind : ce bloc doit s'exécuter APRÈS la remise
  // de S.fPhase à 'repos' ci-dessus, sinon il regarde la phase du tour
  // précédent (encore 'course') et le bouton ne s'affiche jamais. Comme
  // fluidePret() prépare justement l'écran pour le prochain tour, à chaque
  // joueur, ce bloc se ré-exécute naturellement à chaque tour.
  // Pendant l'écran de résultat (verdict encore affiché, badge du joueur
  // suivant pas encore appliqué — voir S.badgeEnAttente ci-dessus), le
  // bouton reste masqué : parier ne concerne que le tour qui s'apprête à
  // être joué, pas le verdict du tour qu'on est en train de lire. Il
  // réapparaît quand appliquerBadgeEnAttente() tourne, au tap "Suivant".
  const btnPariBlind = $('f-pari-blind');
  if(btnPariBlind) {
    const actifBlindPari = CFG.mode === 'blind' && CFG.pariBlind;
    const verdictEnAttente = CFG.mode === 'blind' && !!S.badgeEnAttente;
    if (actifBlindPari && S.fPhase === 'repos' && !verdictEnAttente) {
      btnPariBlind.style.display = 'flex';
      if (!S.pariActif) {
        btnPariBlind.textContent = 'Parier';
        btnPariBlind.classList.remove('pris');
      }
    } else {
      btnPariBlind.style.display = 'none';
    }
  }

  montrer('fluide');
}

// l'anneau donne à voir la zone : un cercle qui se referme sur le chiffre
function majAnneau(){
  const A = $('f-anneau'), C = $('f-anneau-c');
  const on = CFG.mode === 'survie' && S.partie;
  A.classList.toggle('on', on);
  if(!on){   // hors survie, aucun résidu d'alerte ne doit subsister
    $('fluide').classList.remove('zone-critique');
    $('f-critique').classList.remove('on');
    $('f-critique').textContent = '';
    A.classList.remove('critique');
  }
  // combat : deux barres de vie sous le chiffre, exclusives au mode Combat
  // autonome — l'Aventure a son propre HUD séparé, juste en dessous
  const cb = CFG.mode === 'combat' && S.partie;
  $('f-pv').classList.toggle('on', cb);
  if(cb){
    const b = bossCourant();
    $('pv-b').style.width = Math.round(S.pvBoss / b.pv * 100) + '%';
    $('pv-m').style.width = Math.max(0, S.pvMoi) + '%';
    $('pv-b-n').textContent = S.pvBoss;
    $('pv-m-n').textContent = S.pvMoi;
  }
  // le HUD d'Aventure : nom + barre + PV pour la cible, puis pour le joueur
  const avtCombat = AVT() && S.avt && S.avt.enCombat;
  $('avt-hud').classList.toggle('on', !!(avtCombat && S.partie));
  // le nom du biome vit désormais à côté du nom du monstre, dans le HUD : le
  // tag générique du décor ferait doublon pendant un combat
  $('f-biome').classList.toggle('cache-combat', !!avtCombat);
  if(avtCombat && S.partie){
    const A = S.avt, max = A.pvMax || A.pvBoss || 1;
    const maxJoueur = A.pvJoueurMax || 100;
    $('avt-nom-cible').textContent = nomCibleCombat();
    $('avt-pv-cible-barre').style.width = Math.max(0, Math.round(A.pvBoss / max * 100)) + '%';
    $('avt-pv-cible-n').textContent = A.pvBoss + ' pv';
    // la vie du joueur vit désormais en bas, au même endroit qu'en marche
    const pv = Math.max(0, A.pvJoueur || 0);
    $('avt-pv-marche-n').textContent = pv;
    $('avt-pv-marche-barre').style.width = Math.max(0, Math.min(100, (pv / maxJoueur) * 100)) + '%';
    ajusterChronoSousHud();
  } else {
    // Dans tous les autres cas (hors combat Aventure), on laisse le Flexbox centrer le chrono tout seul
    $('fluide').style.removeProperty('--chr-y');
  }
  if(!on) return;
  const z = Math.max(1, S.zoneSurvie);
  // l'anneau reste loin du centre : il encadre, il ne gêne pas la lecture
  C.style.transition = (CFG.sv && CFG.sv.anim)
    ? 'r .45s cubic-bezier(.16,1.1,.3,1), stroke .3s' : 'none';
  // le ratio est plafonné à 1 : ZONE_MAX_SURVIE n'est qu'une valeur de
  // référence, pas un plafond de jeu réel — S.zoneSurvie peut légitimement
  // la dépasser via certains bonus. Sans ce plafond, le rayon dépassait
  // les limites du viewBox SVG (200×200) et l'anneau se retrouvait
  // rogné en haut et en bas, comme s'il manquait des tronçons.
  C.setAttribute('r', String(Math.round(48 + Math.min(1, z / ZONE_MAX_SURVIE) * 48)));
  C.setAttribute('stroke', z > 22 ? '#3E8E68' : z > 11 ? '#E6C544' : '#DC3B2A');
  const crit = CFG.mode === 'survie' && S.partie && z <= ZONE_CRITIQUE;
  A.classList.toggle('critique', crit && (CFG.sv ? CFG.sv.anim : true));
  $('fluide').classList.toggle('zone-critique', crit);
  $('f-critique').classList.toggle('on', crit);
  $('f-critique').textContent = crit
    ? 'Zone critique · ± ' + fmt(z) + (S.vies ? ' · ' + S.vies + ' vie' : '') : '';
}

// Chantier : la poutrelle ne cache qu'un chiffre, celui des dixièmes. Le reste
// du nombre continue de défiler — c'est ce qui rend le masque supportable.
function masquerDixiemes(txt){
  const i = txt.indexOf(',');
  if(i < 0 || i + 1 >= txt.length) return txt;
  return txt.slice(0, i + 1) + '▮' + txt.slice(i + 2);
}

// Mine : le grisou souffle la lampe à intervalle irrégulier, entre trois et
// huit tours. Le tirage se fait à l'avance pour que le tour noir soit annoncé
// par l'écran lui-même, pas découvert au milieu de la mesure.
function prochainNoir(tour){ return tour + 3 + Math.floor(Math.random() * 6); }
function majNoirMine(){
  const actif = !!effB('noirMine') && S.partie;
  if(!actif){
    S.noirTour = false;
    $('fluide').classList.remove('noir-mine');
    $('f-voile-noir').classList.remove('on');
    S.prochainNoirTour = undefined;
    return;
  }
  if(S.prochainNoirTour === undefined) S.prochainNoirTour = prochainNoir(S.tour - 1);
  if(S.tour >= S.prochainNoirTour){
    S.noirTour = true;
    S.prochainNoirTour = prochainNoir(S.tour);
  } else S.noirTour = false;
  $('fluide').classList.toggle('noir-mine', S.noirTour);
  $('f-voile-noir').classList.toggle('on', S.noirTour);
}

// Horlogerie : le chiffre montré n'est plus le temps écoulé mais le temps qui
// reste avant la cible. Il descend vers zéro, et c'est sur zéro qu'on appuie.
// La mesure interne, elle, ne change pas d'un iota.
const rebours = () =>
  (CFG.mode === 'survie' || (CFG.mode === 'aventure' && !(S.avt && S.avt.enCombat)))
  && effB('rebours');
// En rebours, la valeur atteinte se calcule en soustrayant : le total descend.
const valeurAtteinte = ecoule => rebours() ? S.total - ecoule : S.total + ecoule;
function affChrono(cs){ return fmt(Math.max(0, cs)); }

// La police du chiffre s'adapte à sa longueur. Le bloc, lui, garde sa hauteur.
// La taille est calculée une seule fois par tour, sur la valeur d'arrivée
// prévue. Elle ne bouge donc jamais pendant que le chrono défile.
function ajusterChrono(txt){
  const C = $('f-chrono');
  const n = String(txt !== undefined ? txt : C.textContent).replace(/\s/g, '').length;
  C.classList.toggle('long6', n === 6);
  C.classList.toggle('long7', n === 7);
  C.classList.toggle('long8', n >= 8);
}
// la plus longue écriture que le tour produira : celle de la cible
function calerChrono(){
  const cible = CFG.mode === 'survie' ? S.cible : S.cible;
  ajusterChrono(affChrono(Math.max(S.total, cible)));
}

function fluidePhase(ph){
  S.fPhase = ph; S.fPhaseAt = performance.now();
  // le saut de tour n'a de sens qu'à l'arrêt : un chrono lancé doit aller au bout
  if($('f-saut') && ph !== 'repos'){
    $('f-saut').classList.remove('on'); $('f-tour-choix').classList.remove('on');
  }
  // Station : le cadre rouge est un avertissement, il a été lu au moment du
  // départ. Le laisser pulser pendant la mesure parasitait la lecture du
  // chiffre et donnait l'impression qu'il ne partait plus.
  if(ph === 'course') $('fluide').classList.remove('alerte-tour');
  montrer('fluide');
  // chaque mode a sa propre géométrie de texte : Survie seul reçoit la
  // classe qui déplace le chiffre, l'objectif et le bloc verdict
  // une classe par mode : la géométrie du texte est déclarée en CSS, une
  // ligne par mode, sans qu'aucun mode n'en impacte un autre
  const F = $('fluide');
  ['survie','reflexe','combat','cascade','aventure'].forEach(m =>
    F.classList.toggle('mode-' + m, CFG.mode === m));
  // un combat d'aventure (gardien ou monstre) emprunte la même mise en page
  // que le mode Combat autonome, sans jamais changer CFG.mode
  if(AVT()) F.classList.toggle('mode-combat', !!(S.avt && S.avt.enCombat));
  majBiome();
  majAnneau();
  // Cascade a son propre décor : une chute d'eau, hors du système de biomes.
  // On le pose APRÈS majBiome, qui efface data-biome pour tout mode hors survie.
  if(CFG.mode === 'cascade'){
    F.setAttribute('data-biome', 'cascade');
    $('f-fond').classList.add('on');
  } else if(CFG.mode !== 'survie' && CFG.mode !== 'aventure'){
    $('f-fond').classList.remove('on');
  }
  // le décompte du sprint ne doit jamais survivre à un changement de mode ;
  // les modes enchaînés (Cascade) gardent le leur, posé au départ pour éviter
  // la saccade, et nettoyé par preparerPartie au début de chaque partie
  if(CFG.mode !== 'sprint' && !ENCHAINES[CFG.mode]) $('f-sprint').classList.remove('on');
  if(CFG.mode !== 'survie'){ $('f-gain').classList.remove('on'); $('f-gain').textContent = ''; }
  const C = $('f-chrono'), G = $('f-gauche'), D = $('f-droite'), R = $('f-realise');
  // On retire les classes d'état sans toucher aux classes de biome : sinon
  // chaque clic redémarre les animations de fond depuis leur première image.
  ['repos','attente','t-s100','t-s50','t-s20','t-s0','t-signal','t-alerte',
   't-vert','t-laiton','long6','long7','long8']
    .forEach(x => C.classList.remove(x));
  // appliquerEffetsBiome() est un système entièrement visuel — aucune zone,
  // vie ou score n'y est touché — donc partageable tel quel entre les deux
  // modes, sans dupliquer le code
  if(CFG.mode === 'survie' || CFG.mode === 'aventure') appliquerEffetsBiome();
  G.className = 'rond'; D.className = 'rond';
  G.disabled = false; D.disabled = false;
  R.classList.remove('on');
  $('f-blague').classList.remove('on');
  $('f-quitter').style.visibility
    = (AVT() && $('fluide').classList.contains('avt-popup-actif')) ? 'hidden' : 'visible';

  if(ph === 'course'){
    if(CFG.mode === 'reflexe'){ C.classList.add('attente'); C.textContent = '— ms'; }
    else if(S.aveugleTour){ C.classList.add('attente'); C.textContent = '—,——'; }
    else if(CFG.aff === 'visible' && S.evt !== 'yeux'){ C.textContent = affChrono(S.total); }
    else { C.classList.add('attente'); C.textContent = '—,——'; }
    $('f-ecart').textContent = '';
    $('f-verdict').style.visibility = 'hidden';
    G.disabled = true;
    G.querySelector('span').textContent = 'Détails';
    D.classList.add('rouge');
    D.querySelector('span').textContent = 'Arrêter';
    $('f-quitter').style.visibility = 'hidden';
    $('f-solo-actions').classList.remove('on');   // rien ne distrait pendant le chrono
    return;
  }

  // repos : le tour précédent est encore lisible, le suivant est déjà prêt.
  // Un seul appui sur Démarrer relance — plus besoin de passer par un écran.
  const d = S.dernier;
  // Réseau : le chiffre atteint reste masqué jusqu'au lancer suivant.
  // Le verdict, lui, s'affiche normalement : on sait si c'est bon, pas de combien.
  const masque = CFG.mode === 'survie' && effB('masque');
  if(d){
    C.classList.add(d.couleur);
    // en réflexe, le grand chiffre est un temps de réaction, pas un chrono
    C.textContent = masque ? '—,——'
      : CFG.mode === 'reflexe' && S.dernierMs !== undefined
      ? S.dernierMs + ' ms' : affChrono(d.valeur);
    if(masque) C.classList.add('attente');
    // Réseau : le sous-titre donnerait la réponse, on le brouille aussi
    if(masque){
      $('f-ver-sous').textContent = 'signal perdu';
      $('f-gain').classList.remove('on');
    }
    R.className = 'f-realise on ' + d.couleur;
    const sansDuree = CFG.mode === 'reflexe' || CFG.mode === 'combat'
                    || CFG.mode === 'survie' || AVT();
    R.textContent = sansDuree ? '' : 'tenu ' + fmt(d.dureeTenue) + ' s';
    if(sansDuree) R.classList.remove('on');
    // en survie et en aventure, la punchline n'apporte rien : elle prend la
    // place d'informations plus utiles (survie) ou n'a pas sa place (aventure)
    const avecBlague = !!d.blague && CFG.mode !== 'survie' && !AVT();
    $('f-blague').textContent = avecBlague ? d.blague : '';
    $('f-blague').classList.toggle('on', avecBlague);
    // survie : le terrain gagné ou perdu, en toutes lettres sous le chiffre
    const G = $('f-gain');
    if(CFG.mode === 'survie' && !masque
       && S.gainSurvie !== null && S.gainSurvie !== undefined){
      G.textContent = phraseGain(S.gainSurvie);
      G.className = 'f-gain on ' + (S.gainSurvie >= 3 ? 't-s100' : S.gainSurvie > 0
                  ? 't-s50' : S.gainSurvie === 0 ? 't-s20' : 't-s0');
    } else G.classList.remove('on');
    $('f-ecart').textContent = CFG.mode === 'reflexe' ? ''
      : masque ? '' : CFG.mode === 'combat' ? 'écart ±' + fmt(d.ecart)
      : (d.delta>0?'+':d.delta<0?'−':'±') + fmt(d.ecart);
    $('f-ver-titre').textContent = d.titre;
    $('f-ver-titre').className = 'titre ' + d.couleur;
    $('f-ver-sous').textContent = masque ? 'signal perdu' : d.sous;
    $('f-verdict').style.visibility
      = (AVT() && $('fluide').classList.contains('avt-popup-actif')) ? 'hidden' : 'visible';
  } else {
    C.classList.add('repos');
    // Spatial : le tour se joue sans chrono, dès l'écran de repos
    C.textContent = CFG.mode === 'reflexe' ? '— ms'
      : S.aveugleTour ? '—,——' : affChrono(S.total);
    S.dernierMs = undefined;
    $('f-ecart').textContent = '';
    $('f-verdict').style.visibility = 'hidden';
  }
  const sansDetail = CFG.mode === 'survie' && effB('masque');
  G.disabled = !d || sansDetail;
  G.querySelector('span').textContent = sansDetail ? 'Coupé' : 'Détails';
  if(ph === 'fin'){
    D.classList.add('clair');
    D.querySelector('span').textContent = 'Classement';
  } else if (CFG.mode === 'blind' && ph === 'repos' && !S.blindPret) {
    D.classList.add('vert');
    D.querySelector('span').textContent = 'Suivant';
  } else {
    D.classList.add('vert');
    D.querySelector('span').textContent = 'Démarrer';
  }
}

/* ─── mode réflexe : la cible surgit à un endroit imprévisible ─── */
function lancerReflexe(){
  const z = $('fluide'), b = $('f-reflexe');
  z.classList.add('attente-reflexe');
  b.classList.remove('on');
  $('f-chrono').textContent = '—,——';
  $('f-chrono').className = 'f-chrono attente';
  // entre 0,25 et 2 s : impossible d'anticiper
  attendre(250 + Math.random() * 1750, () => {
    const r = z.getBoundingClientRect();
    const marge = 118;
    const x = 14 + Math.random() * Math.max(10, r.width  - marge);
    const y = 132 + Math.random() * Math.max(10, r.height - marge - 250);
    b.style.left = Math.round(x) + 'px';
    b.style.top  = Math.round(y) + 'px';
    b.classList.add('on');
    S.t0 = performance.now();
    S.encours = true;
    vibrer(20);
  });
}
$('f-reflexe').addEventListener('pointerdown', ev => {
  if(!S.encours || CFG.mode !== 'reflexe') return;
  ev.preventDefault(); ev.stopPropagation();
  const t = tempsEvt(ev);
  S.encours = false;
  purgerMinuteries();
  $('fluide').classList.remove('attente-reflexe');
  $('f-reflexe').classList.remove('on');
  vibrer(18);
  afficherResultat(valeurAtteinte(enCentiemes(t - S.t0)));
});

// prépare le tour suivant sans rien afficher
function avancerTour(){
  const ft = S.finDeTour || {avance:true};
  S.idx = idxSuivant();
  S.prochain = null;
  const futCombat = AVT() && S.avt && S.avt.dernierEchangeEtaitCombat;
  if(S.avt) S.avt.dernierEchangeEtaitCombat = false;
  if(ft.avance){
    if(!futCombat) S.tour++;   // un échange de combat ne fait pas avancer le compteur de tours
    S.cible = S.cibleBase = S.enAttente;
    tirerEvenement();
  }
}

function fluideResultat(){
  const ft = S.finDeTour || {avance:true};
  // sprint : le temps écoulé pendant le tour clôt la partie sans écran de repos
  if(CFG.mode === 'sprint' && S.sprintFini){ afficherFin(); return; }
  if(partieFinie() && S.contre === 0 && ft.avance){
    bandeaux('f-');
    fluidePhase('fin');
    return;
  }
  if(S.rejouerTour){
    // Faille : on remet le chrono là où il était avant ce tour, avec la même
    // cible. Le tour n'a pas eu lieu.
    S.rejouerTour = false;
    S.total = S.totalAvantTour;
    S.cible = S.cibleAvantTour;
    fluidePret();
    return;
  }
   if(S.rejouerBiome){
    S.rejouerBiome = false;
    // Calcule quel était le tour 1 de ce biome (ex: 451 pour le Réseau)
    const debutBiome = Math.floor((S.tour - 1) / TOURS_BIOME) * TOURS_BIOME + 1;
    allerAuTour(debutBiome); // Utilise ta fonction existante de saut dans le temps !
    return;
  }
  avancerTour();
  //if(S.sautTour){ S.sautTour = false; avancerTour(); }  // Paradis : un tour offert
  fluidePret();          // affiche le résultat ET l'objectif suivant
}

// Seuls départ et arrêt passent par pointerdown : la précision du chrono en
// dépend. Les autres actions attendent le clic, sinon le doigt qui déclenche
// traverse la modale qui vient d'apparaître et la referme aussitôt.
$('fluide').addEventListener('pointerdown', ev => {
  if(S.fPhase === 'course'){
    if(CFG.mode === 'reflexe') return;   // seul le bouton compte
    arreter(ev); return;
  }
  const b = ev.target.closest && ev.target.closest('.rond');
  if(!b || b.disabled || b.id !== 'f-droite' || S.fPhase !== 'repos') return;
  if(performance.now() - S.fPhaseAt < 220) return;
  
  // --- Interception 2 temps pour le Blind ---
  // avancerTour() n'est PAS rappelé ici : il a déjà été exécuté une fois,
  // automatiquement, dès l'appui sur Arrêter (via resoudre -> fluideResultat).
  // L'appeler une seconde fois ici sautait le joueur suivant à chaque tour
  // (son tour n'était jamais joué, et le tour d'après lui était attribué).
  if(CFG.mode === 'blind' && !S.blindPret) {
    S.blindPret = true;
    $('f-obj-cible').textContent = fmt(S.cible);

    // Le nom et le numéro de tour, mis en attente par fluidePret() pendant
    // que le verdict précédent restait affiché, ne s'appliquent qu'ici :
    // c'est le moment réel où l'on passe au joueur suivant.
    appliquerBadgeEnAttente();

    S.fPhase = 'repos';
   
    // On masque tout pour le joueur suivant
    $('f-chrono').className = 'f-chrono repos';
    $('f-chrono').textContent = '0,00';
    $('f-realise').classList.remove('on');
    $('f-verdict').style.visibility = 'hidden';
    $('f-gain').classList.remove('on');
    $('f-blague').classList.remove('on');
    b.querySelector('span').textContent = 'Démarrer';
    
    // On cache aussi le bandeau éventuel s'il y en a un
    const evtBandeau = $('f-evt');
    if(evtBandeau) evtBandeau.classList.remove('on');
    
    return; // On stoppe l'exécution ici, on attend le vrai clic de départ
  }
  // ----------------------------------------------------

  demarrer(ev);
});
$('fluide').addEventListener('click', ev => {
  if(performance.now() - S.fPhaseAt < 220) return;    // anti double-appui
  if(ev.target.closest && ev.target.closest('#f-quitter')){ quitterPartie(); return; }
  const b = ev.target.closest && ev.target.closest('.rond');
  if(!b || b.disabled) return;
  // Réseau : l'écran de détails donnerait le chiffre que le biome cache
  if(b.id === 'f-gauche' && S.dernier
     && !(CFG.mode === 'survie' && effB('masque'))){
    S.retourDetail = true;
    majDetailBiome(); montrer('resultat');
  }
  else if(b.id === 'f-droite' && S.fPhase === 'fin') afficherFin();
});
const fermerDetails = () => {
  // on revient exactement dans l'état où l'on était : pas de réannonce
  S.retourDetail = false;
  montrer('fluide');
};
$('fermer').onclick = fermerDetails;
$('det-retour').onclick = fermerDetails;
// Fonction pour créer la modale personnalisée avec menu déroulant
function demarrerModalPariBlind(cibleSec) {
  return new Promise(res => {
    const M = $('modale'), ouvertA = performance.now();
    $('mod-titre').textContent = 'PARI TACTIQUE';
    $('mod-sous').textContent = 'Cible initiale : ' + cibleSec + 's';
    
    $('mod-saisie').style.display = 'none';
    $('mod-noms').style.display = 'none';

    const b = $('mod-b');
    b.innerHTML = `
      <div style="width:100%; margin: 8px 0 12px 0; text-align:left;">
        <label style="font-family:var(--mono); font-size:10.5px; color:var(--gris); letter-spacing:.12em; text-transform:uppercase; display:block; margin-bottom:6px;">
          Nouvelle cible désirée :
        </label>
        <select id="pari-select" style="width:100%; background:var(--nuit); color:var(--ivoire); border:1px solid var(--bordDoux); border-radius:10px; padding:10px 12px; font-family:var(--cond); font-size:15px; font-weight:600; outline:none;">
          ${Array.from({length: 10}, (_, i) => {
            const s = i + 1;
            const delta = s - cibleSec;
            let txt = s + 's';
            if (delta > 0) txt += ` (+${delta}s)`;
            else if (delta < 0) txt += ` (${delta}s)`;
            else txt += ' (Cible actuelle)';
            return `<option value="${s * 100}" ${s === cibleSec ? 'selected' : ''}>${txt}</option>`;
          }).join('')}
        </select>
        <div id="pari-enjeu-box" style="margin-top:12px; padding:14px 16px; border-radius:10px; background:var(--ardoise); border:1px solid transparent; font-family:var(--mono); font-size:11px; line-height:1.45; text-align:left;">
          —
        </div>
      </div>
    `;

    const selectEl = $('pari-select');
    const enjeuBox = $('pari-enjeu-box');

    const majEnjeu = () => {
      const val = parseInt(selectEl.value, 10) / 100;
      const delta = val - cibleSec;
      
      // Calcul des gorgées de base du barème normal pour ce temps
      let penBase = val <= 3 ? 5 : val <= 6 ? 4 : val <= 9 ? 3 : 2;
      if (CFG.gor === 'gros') penBase += 1;

      // Calcul de la précision exigée : 0.15s pour 1s, jusqu'à 0.30s pour 10s
      const ecartVise = (0.15 + (val - 1) * (0.15 / 9)).toFixed(2);

      if (delta > 0) {
        enjeuBox.style.color = '#6BE39A';
        enjeuBox.style.borderColor = '#6BE39A';
        enjeuBox.innerHTML = `
          <strong style="font-size:13px; color:#6BE39A; letter-spacing:0.05em; display:block; text-align:center;">HAUSSE (+${delta}s) · Objectif : ±${ecartVise}s</strong>
          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--ivoire);">🎁 Si réussi (écart ≤ ±${ecartVise}s) :</span> 
            <b style="color:#6BE39A; text-align:right;">Donne +${delta} gorgée${delta > 1 ? 's' : ''} de plus</b>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--ivoire);">❌ Si raté :</span> 
            <span style="color:#DC3B2A; text-align:right;">Tu bois ${penBase} gorgées</span>
          </div>`;
      } else if (delta < 0) {
        const abs = Math.abs(delta);
        const penTotale = penBase + abs;
        enjeuBox.style.color = '#DC3B2A';
        enjeuBox.style.borderColor = '#DC3B2A';
        enjeuBox.innerHTML = `
          <strong style="font-size:13px; color:#DC3B2A; letter-spacing:0.05em; display:block; text-align:center;">BAISSE (${delta}s) · Objectif : ±${ecartVise}s</strong>
          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--ivoire);">🎁 Si réussi (écart ≤ ±${ecartVise}s) :</span> 
            <span style="color:var(--gris); text-align:right;">Barème normal</span>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--ivoire);">❌ Si raté :</span> 
            <b style="color:#DC3B2A; text-align:right;">Tu bois ${penTotale} gorgées<br><span style="font-size:9.5px; opacity:0.8;">(barème ${penBase} + ${abs} de pénalité)</span></b>
          </div>`;
      } else {
        enjeuBox.style.color = 'var(--gris)';
        enjeuBox.style.borderColor = 'var(--trait)';
        enjeuBox.innerHTML = `
          <strong style="font-size:13px; letter-spacing:0.05em; display:block; text-align:center;">CIBLE INCHANGÉE · Objectif : ±${ecartVise}s</strong>
          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--ivoire);">🎁 Si réussi :</span> 
            <span style="color:var(--gris); text-align:right;">Barème normal (${penBase} gorgées distribuées)</span>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--ivoire);">❌ Si raté :</span> 
            <span style="color:#DC3B2A; text-align:right;">Tu bois ${penBase} gorgées</span>
          </div>`;
      }
    };

    selectEl.onchange = majEnjeu;
    majEnjeu();

    let clos = false;
    const tropTot = () => performance.now() - ouvertA < 260;
    const fin = v => {
      if (clos) return;
      clos = true;
      M.classList.remove('on');
      M.onclick = null;
      b.innerHTML = '';
      res(v);
    };

    const btnValider = document.createElement('button');
    btnValider.className = 'bouton';
    btnValider.textContent = 'Valider le pari';
    btnValider.style.fontSize = '15px';
    btnValider.style.padding = '12px';
    btnValider.onclick = () => { if (!tropTot()) fin(parseInt(selectEl.value, 10)); };

    const btnAnnuler = document.createElement('button');
    btnAnnuler.className = 'bouton fantome';
    btnAnnuler.textContent = 'Annuler';
    btnAnnuler.style.fontSize = '12.5px';
    btnAnnuler.style.padding = '9px';
    btnAnnuler.style.marginTop = '6px';
    btnAnnuler.onclick = () => { if (!tropTot()) fin(null); };

    b.appendChild(btnValider);
    b.appendChild(btnAnnuler);
    M.onclick = e => { if (e.target === M && !tropTot()) fin(null); };
    M.classList.add('on');
  });
}

// Clic sur le bouton de Pari
const btnPariBlindClick = $('f-pari-blind');
if (btnPariBlindClick) {
  btnPariBlindClick.onclick = async (ev) => {
    ev.stopPropagation(); 
    if(S.encours || S.fPhase !== 'repos') return;
    
    const cibleSec = Math.round((S.cible - S.total) / 100);
    const choixSec = await demarrerModalPariBlind(cibleSec);
    if(choixSec === null) return;

    const nouvelleCibleSec = choixSec / 100;
    const deltaSec = nouvelleCibleSec - cibleSec;

    if (deltaSec === 0) return;

    const nom = S.joueurs[S.idx];
    S.dernierPari = S.dernierPari || {};
    S.dernierPari[nom] = S.tour;

    S.cible = S.total + choixSec;
    S.cibleBase = S.cible;
    S.zoneTour = zoneDe(nom);
    
    S.pariActif = { deltaSec, type: deltaSec > 0 ? 'hausse' : 'baisse' }; // <--- AJOUTE }; ICI
    
    // À intégrer dans btnPariBlindClick.onclick, juste après avoir défini S.pariActif
    trackEvent('spend_virtual_currency', {
     item_name: 'pari_tactique',
     virtual_currency_name: 'zone_securite',
     value: deltaSec, // Le temps misé (+ ou -)
     pari_type: deltaSec > 0 ? 'hausse' : 'baisse'
    });          
    
    $('f-obj-cible').textContent = fmt(S.cible);
    btnPariBlindClick.textContent = deltaSec > 0 ? '+' + deltaSec + 's' : deltaSec + 's';
    btnPariBlindClick.classList.add('pris');
  };
}
//-----------------------------------------
function dessinerFilm(){
  const f = $('film'); f.innerHTML = '';
  const bord = 50 - zone();
  S.historique.slice(0,30).forEach(h => {
    const pos = Math.max(0, Math.min(100, 50 + ((h.val - h.cible)/RANGE)*50));
    const d = document.createElement('div');
    d.className = 'frame';
    d.innerHTML = `<span class="no">${h.tour||''}</span>
      <span class="nom" style="color:${coulNom(h.nom)}">${esc(h.nom)}</span>
      <span class="mini"><span class="z z-vert" style="left:${bord}%;right:${bord}%"></span>
      <span class="z z-laiton"></span><span class="m" style="left:${pos}%"></span></span>
      <span class="val ${h.couleur}">${fmt(h.val)}</span>`;
    f.appendChild(d);
  });
}

$('stop').onclick = async () => {
  if(estSolo(CFG.mode)){ await quitterPartie(); return; }
  afficherFin();
};

/* ════════ FIN ════════ */
// Bannière « nouveau meilleur score ». Le record personnel se décide tout de
// suite, avec l'ancien meilleur capturé avant d'être écrasé. Le record de
// ligue demande une requête : on affiche d'abord le personnel, puis on
// enrichit si le score dépasse le meilleur des autres membres.
async function detecterRecord(){
  const B = $('fin-record');
  if(!B) return;
  B.style.display = 'none'; B.className = 'record-banniere';
  // seuls les modes solo à score cumulé ont un « meilleur score » comparable
  // — l'Aventure a sa propre progression (niveau, xp cumulée), pas un score
  // qu'on cherche à battre partie après partie
  if(!estSolo(CFG.mode) || S.abandon || S.essaiBiome || AVT()) return;
  if(CFG.mode === 'combat' || CFG.mode === 'reflexe') return;
  const score = S.points || 0;
  if(score <= 0) return;
  const ancien = S.ancienRecord || 0;
  const battuPerso = score > ancien && ancien > 0;   // pas la toute 1re partie
  if(battuPerso){
    B.className = 'record-banniere perso';
    B.innerHTML = '<div class="r-t">🥇 Nouveau record personnel</div>'
      + score + ' points, ton meilleur à ce jour (ancien : ' + ancien + ').';
    B.style.display = 'block';
  }
  // record de ligue : le meilleur score des AUTRES membres, sur ce mode —
  // et le sien propre, tous deux lus depuis le serveur (jamais depuis
  // MEM.profils, un souvenir local à cet appareil qui peut être périmé,
  // absent après une réinstallation, ou simplement faux sur un autre appareil)
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  if(!s) return;
  let ligues = [];
  try{ ligues = await mesLigues(); }catch(e){ return; }
  if(!ligues.length) return;
  try{
    for(const lg of ligues){
      const membres = await apiAuth('membres?ligue=eq.' + lg.ligue
        + '&select=joueur') || [];
      const tousIds = membres.map(m => m.joueur);
      if(tousIds.length < 2) continue;   // seul dans la ligue, rien à dépasser
      const perfs = await apiAuth('perfs?mode=eq.' + CFG.mode
        + '&joueur=in.(' + tousIds.join(',') + ')&select=score,joueur') || [];
      const meilleurAutre = perfs.filter(p => p.joueur !== s.id)
        .reduce((m, p) => Math.max(m, p.score || 0), 0);
      const monMeilleurAvant = perfs.filter(p => p.joueur === s.id)
        .reduce((m, p) => Math.max(m, p.score || 0), 0);
      if(!meilleurAutre) continue;   // personne d'autre n'a encore de score
      // « tu prends la tête » n'a de sens que si ce n'était pas déjà le cas :
      // sinon, battre son propre record ne fait que le creuser, pas le prendre
      const prendLaTete = score > meilleurAutre && monMeilleurAvant <= meilleurAutre;
      if(prendLaTete){
        const nom = (lg.ligues && lg.ligues.nom) || lg.ligue;
        B.className = 'record-banniere ligue';
        B.innerHTML = '<div class="r-t">👑 Meilleur score de la ligue</div>'
          + 'Tu prends la tête de « ' + esc(nom) +' » sur ' + MODE().n
          + ' avec ' + score + ' points.';
        B.style.display = 'block';
        return;   // le record de ligue prime sur le personnel
      }
    }
  }catch(e){ /* silencieux : la bannière personnelle reste affichée */ }
}

/* ═══════════════════════════════════════════════════════════════
   TITRES DE FIN DE SOIRÉE
   ───────────────────────────────────────────────────────────────
   Neuf titres, chacun croisant deux ou trois mesures — jamais une
   seule. C'est volontaire : la précision, les piles et les gorgées
   distribuées se ressemblent trop pour être jugées séparément, sinon
   le même joueur rafle tout. On les évalue dans un ordre de priorité
   (le plus exigeant d'abord) et on n'attribue jamais deux titres au
   même joueur — dès qu'il en a un, il sort de la liste des candidats
   pour les suivants.
   ═══════════════════════════════════════════════════════════════ */

function rangDe(liste, valeur, sens){
  // sens 'max' : le plus grand est 1er.  sens 'min' : le plus petit est 1er.
  const tri = [...liste].sort((a,b) =>
    sens === 'max' ? valeur(b) - valeur(a) : valeur(a) - valeur(b));
  const m = new Map();
  tri.forEach((p,i) => m.set(p.n, i + 1));
  return m;
}
function mediane(vals){
  const t = [...vals].sort((a,b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m-1] + t[m]) / 2;
}

/* Construit, pour chaque joueur ayant joué au moins un tour, l'ensemble
   des mesures dérivées dont les titres ont besoin. Ne dépend que de
   S.stats — donc réutilisable aussi bien en fin de partie qu'en test. */
function statsJoueurs(){
  const J = S.joueurs
    .map(n => ({n, ...S.stats[n]}))
    .filter(p => p.tours > 0);
  if(J.length < 2) return [];   // pas assez de monde pour comparer qui que ce soit

  J.forEach(p => {
    p.precision = p.ecart / p.tours;
    p.biaisMoy = p.biais / p.tours;
    p.disp = Math.sqrt(Math.max(0, p.carres / p.tours - p.biaisMoy * p.biaisMoy));
  });

  const rP  = rangDe(J, p => p.precision, 'min');   // 1 = le plus précis
  const rPi = rangDe(J, p => p.piles, 'max');        // 1 = le plus de piles
  const rD  = rangDe(J, p => p.donnees || 0, 'max'); // 1 = a le plus fait boire
  const rG  = rangDe(J, p => p.gorgees, 'max');      // 1 = a le plus bu
  const rDisp    = rangDe(J, p => p.disp, 'min');    // 1 = le plus régulier
  const rDispInv = rangDe(J, p => p.disp, 'max');    // 1 = le plus dispersé
  const rBiaisL  = rangDe(J, p => p.biaisMoy, 'max');// 1 = le plus en retard
  const rBiaisP  = rangDe(J, p => p.biaisMoy, 'min');// 1 = le plus en avance
  const medPiles = mediane(J.map(p => p.piles));
  const medDisp  = mediane(J.map(p => p.disp));
  const n = J.length;

  J.forEach(p => {
    p.rP = rP.get(p.n); p.rPi = rPi.get(p.n); p.rD = rD.get(p.n);
    p.rG = rG.get(p.n); p.rDisp = rDisp.get(p.n); p.rDispInv = rDispInv.get(p.n);
    p.rBiaisL = rBiaisL.get(p.n); p.rBiaisP = rBiaisP.get(p.n);
    p.classement = p.rP;             // le classement général reste la précision
    p.medianePiles = medPiles; p.medianeDisp = medDisp; p.nbJoueurs = n;
  });
  return J;
}

/* Chaque phrase est tirée au hasard à l'affichage — quelques variantes
   suffisent pour qu'une soirée ne ressemble jamais tout à fait à la
   précédente. Elles visent le rôle, jamais la personne. */
const PHRASES_TITRE = {
  inevitable: ["On a vérifié, il n'a pas de montre dans la main.",
    "Il n'a rien laissé aux autres. Ni le classement, ni le silence.",
    "À ce stade, ce n'est plus un joueur, c'est un étalon."],
  bourreau: ["Il ne vise pas bien. Il vise fort.",
    "Il rate neuf fois et démolit la dixième.",
    "La table entière a payé pour ses piles."],
  chirurgien: ["Il n'a jamais visé le centre. Il n'en a pas eu besoin.",
    "Précis et prudent : la combinaison qui gagne sur la durée.",
    "Aucun éclat. Juste jamais d'erreur non plus."],
  funambule: ["Entre deux piles, il y a eu des moments difficiles.",
    "Le meilleur et le pire de la soirée, dans la même personne.",
    "On ne sait jamais lequel va se présenter."],
  stoique: ["Il boit plus que tout le monde et gagne quand même. C'est vexant.",
    "Il encaisse et il vise juste. C'est agaçant.",
    "Rien ne semble jamais le déranger. Ni le chrono, ni le verre."],
  eponge: ["Statistiquement, le vrai vainqueur de la soirée.",
    "Il a tout encaissé sans jamais se plaindre. Respect.",
    "Le chrono ne l'aime pas. Le bar, si."],
  ombre: ["A-t-il vraiment joué ce soir ? Les archives sont formelles.",
    "Ni brillant ni catastrophique. Juste... présent.",
    "Personne ne se souvient de son premier tour. Ni du dernier."],
  joker: ["Personne ne comprend comment il est si bien classé. Lui non plus.",
    "Le chaos, ce soir, a choisi son camp.",
    "Statistiquement improbable. Et pourtant, le voilà."],
  lent: ["Il arrive toujours. Un peu après tout le monde.",
    "Fiable dans son retard, au moins.",
    "On l'attend. On l'attend encore."],
  presse: ["Personne ne lui a dit qu'il fallait attendre.",
    "Toujours le premier à partir. Rarement au bon moment.",
    "Une seconde d'avance, systématiquement offerte au chrono."],
  grimpeur: ["Il a compris le jeu vers la moitié de la partie.",
    "Débuts hésitants, fin qui n'a plus rien à voir.",
    "Il a mis du temps à se chauffer. Mais alors."],
  essouffle: ["Il partait bien. On ne sait pas ce qui s'est passé.",
    "Excellent début. Le reste s'est un peu perdu en route.",
    "La forme du premier tour n'a pas tenu jusqu'au dernier."],
  regulier: ["Il n'a rien gagné, rien perdu. Une performance.",
    "Jamais en tête, jamais en fond. Le centre de gravité de la table.",
    "Ni héros ni victime. Le socle sur lequel la soirée a tenu."]
};
function phraseTitre(id){
  const L = PHRASES_TITRE[id] || [''];
  return L[Math.floor(Math.random() * L.length)];
}

/* Chaque définition renvoie un joueur ou null. L'ordre de la liste EST
   la priorité : les titres les plus exigeants sont tranchés en premier,
   pendant que tous les candidats sont encore disponibles. */
const DEFS_TITRES = [
  {id:'inevitable', ic:'👑', nom:"L'inévitable", coul:'#C9A227',
   test(J){
     const strict = J.filter(p => p.rP===1 && p.rPi===1 && p.rD===1);
     if(strict.length) return strict[0];
     const paires = J.filter(p =>
       [p.rP===1, p.rPi===1, p.rD===1].filter(Boolean).length >= 2);
     if(!paires.length) return null;
     paires.sort((a,b) => (a.rP+a.rPi+a.rD) - (b.rP+b.rPi+b.rD));
     return paires[0];
   }},
  {id:'bourreau', ic:'🩸', nom:'Le bourreau', coul:'#B98CFF',
   test(J){
     const c = J.filter(p => p.rPi<=2 && p.rD<=2 && p.rP!==1);
     if(!c.length) return null;
     c.sort((a,b) => (a.rPi+a.rD) - (b.rPi+b.rD));
     return c[0];
   }},
  {id:'chirurgien', ic:'🧊', nom:'Le chirurgien', coul:'#5AD2DC',
   test(J){
     const c = J.filter(p => p.rP<=2 && p.rDisp<=2 && p.piles<=p.medianePiles);
     if(!c.length) return null;
     c.sort((a,b) => (a.rP+a.rDisp) - (b.rP+b.rDisp));
     return c[0];
   }},
  {id:'funambule', ic:'🎢', nom:'Le funambule', coul:'#FF8A5B',
   test(J){
     const c = J.filter(p => p.rPi<=2 && p.rDispInv===1);
     return c[0] || null;
   }},
  {id:'joker', ic:'🎲', nom:'Le joker', coul:'#B98CFF',
   test(J){
     const c = J.filter(p => p.classement<=2 && p.rDispInv===1);
     return c[0] || null;
   }},
  /* stoïque et éponge partagent le même candidat de départ — celui qui a
     le plus bu — et se séparent seulement sur son classement final */
  {id:'stoique', ic:'🗿', nom:'Le stoïque', coul:'#FF7BC8',
   test(J){
     const c = J.find(p => p.rG===1);
     return (c && c.classement<=3) ? c : null;
   }},
  {id:'eponge', ic:'🧽', nom:"L'éponge", coul:'#FF7BC8',
   test(J){
     const c = J.find(p => p.rG===1);
     return (c && c.classement>3) ? c : null;
   }},
  {id:'ombre', ic:'👻', nom:"L'ombre", coul:'#7C8797',
   test(J){
     const n = J.length, bas = Math.floor(n/3), haut = n - Math.floor(n/3);
     const c = J.filter(p => p.piles===0 && (p.donnees||0)===0
       && p.classement>bas && p.classement<=haut);
     return c[0] || null;
   }},
  {id:'lent', ic:'🐌', nom:'Le lent', coul:'#FF7BC8',
   test(J){
     const c = J.find(p => p.rBiaisL===1 && p.biaisMoy>0);
     return c || null;
   }},
  {id:'presse', ic:'⚡', nom:'Le pressé', coul:'#FF8A5B',
   test(J){
     const c = J.find(p => p.rBiaisP===1 && p.biaisMoy<0);
     return c || null;
   }},
  {id:'grimpeur', ic:'📈', nom:'Le grimpeur', coul:'#35C46B',
   test(J){
     const c = J.filter(p => (p.hist||[]).length >= 6).map(p => {
       const h = p.hist, m = Math.floor(h.length/2);
       const m1 = h.slice(0,m).reduce((a,b)=>a+b,0)/m;
       const m2 = h.slice(-m).reduce((a,b)=>a+b,0)/m;
       return {...p, m1, m2};
     }).filter(p => p.m1>0 && p.m2*2<=p.m1);
     if(!c.length) return null;
     c.sort((a,b) => (b.m1/b.m2) - (a.m1/a.m2));   // le progrès le plus net
     return c[0];
   }},
  {id:'essouffle', ic:'📉', nom:"L'essoufflé", coul:'#DC3B2A',
   test(J){
     const c = J.filter(p => (p.hist||[]).length >= 6).map(p => {
       const h = p.hist, m = Math.floor(h.length/2);
       const m1 = h.slice(0,m).reduce((a,b)=>a+b,0)/m;
       const m2 = h.slice(-m).reduce((a,b)=>a+b,0)/m;
       return {...p, m1, m2};
     }).filter(p => p.m2>0 && p.m1*2<=p.m2);
     if(!c.length) return null;
     c.sort((a,b) => (b.m2/b.m1) - (a.m2/a.m1));
     return c[0];
   }},
  {id:'regulier', ic:'🎭', nom:'Le régulier', coul:'#5AD2DC',
   test(J){
     const c = J.filter(p => p.classement>1 && p.classement<p.nbJoueurs
       && p.disp<=p.medianeDisp);
     return c[0] || null;
   }}
];

/* Calcule jusqu'à QUATRE titres, jamais deux fois le même joueur. On
   parcourt les définitions dans leur ordre de priorité en retirant à
   chaque fois le joueur retenu de la liste des candidats — donc les
   titres évalués tôt (L'inévitable) ont accès à tout le monde, ceux
   évalués tard (Le régulier) composent avec ce qu'il reste. */
function calculerTitres(){
  let J = statsJoueurs();
  if(!J.length) return [];
  const resultat = [];
  for(const def of DEFS_TITRES){
    if(resultat.length >= 4) break;
    const gagnant = def.test(J);
    if(!gagnant) continue;
    resultat.push({...def, joueur:gagnant, phrase:phraseTitre(def.id)});
    J = J.filter(p => p.n !== gagnant.n);
  }
  return resultat;
}

/* Révèle le calcul ligne par ligne, puis fait défiler le total.
 le calcul ligne par ligne, puis fait défiler le total.
   Les minuteries passent par S.minuteries : quitter l'écran avant la fin
   de l'animation les purge, sinon un décompte fantôme continuerait de
   tourner sur l'écran suivant. */
/* Décompte générique, pour tous les modes solo qui n'en produisent pas
   eux-mêmes. Il ne réinvente aucun calcul : il met en forme ce que la
   partie a déjà mesuré (piles, série, précision moyenne, biais) et se
   contente de présenter le score final. Aucune prime n'est ajoutée. */
function decompteSolo(){
  const st = S.stats[S.joueurs[0]];
  if(!st || !st.tours) return null;
  const moy = Math.round(st.ecart / st.tours);
  const biais = Math.round(st.biais / st.tours);
  const lignes = [
    {lb:'Tours joués', vl:String(st.tours)},
    {lb:'Piles', vl:st.piles ? '+' + st.piles : '—',
     cls:st.piles ? 'prime' : ''},
    {lb:'Meilleure série', vl:(S.meilleureChaine || 0) + ' tours'},
    {lb:'Précision moyenne', vl:'± ' + fmt(moy), cls:'bonus'},
    {lb:'Biais moyen · ' + (biais > 0 ? 'plutôt trop tard'
        : biais < 0 ? 'plutôt trop tôt' : 'centré'),
     vl:(biais > 0 ? '+' : '') + fmt(biais)}
  ];
  return {lignes, total:S.points || 0,
    note:'précision moyenne sur ' + st.tours + ' tour'
       + (st.tours > 1 ? 's' : '')};
}

function afficherDecompte(d){
  const M = $('fin-decompte');
  if(!M) return;
  S.decompte = d || null;
  if(!d || !d.lignes || !d.lignes.length){
    M.style.display = 'none'; M.innerHTML = ''; return;
  }
  M.innerHTML = '';
  M.style.display = 'block';
  const PAS = 260;      // délai entre deux lignes

  d.lignes.forEach((l, i) => {
    const el = document.createElement('div');
    el.className = 'dc-l' + (l.cls ? ' ' + l.cls : '');
    el.style.animationDelay = (i * PAS) + 'ms';
    el.innerHTML = '<span class="lb"></span><span class="vl"></span>';
    el.querySelector('.lb').textContent = l.lb;
    el.querySelector('.vl').textContent = l.vl;
    M.appendChild(el);
  });

  const tot = document.createElement('div');
  tot.className = 'dc-tot';
  tot.style.animationDelay = (d.lignes.length * PAS) + 'ms';
  tot.innerHTML = '<span class="lb">Total</span><span class="vl">0</span>';
  M.appendChild(tot);

  if(d.note){
    const n = document.createElement('div');
    n.className = 'dc-note';
    n.style.animationDelay = ((d.lignes.length + 1) * PAS) + 'ms';
    n.textContent = d.note;
    M.appendChild(n);
  }

  /* le total défile de 0 à sa valeur, en sortie douce */
  const cible = d.total || 0;
  const V = tot.querySelector('.vl');
  const bouge = !window.matchMedia
    || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!bouge){ V.textContent = cible; return; }

  S.minuteries.push(setTimeout(() => {
    const DUREE = 900, t0 = performance.now();
    const pas = () => {
      const p = Math.min(1, (performance.now() - t0) / DUREE);
      // interpolation en sortie douce : rapide au début, freine à l'arrivée
      V.textContent = Math.round(cible * (1 - Math.pow(1 - p, 3)));
      if(p < 1) requestAnimationFrame(pas);
      else { V.textContent = cible; vibrer(20); }
    };
    requestAnimationFrame(pas);
  }, d.lignes.length * PAS + 120));
}

/* Fait vivre le carrousel de titres : une carte à la fois, tapée pour
   avancer, avec les cartes déjà vues empilées derrière comme repère
   visuel de progression. « Tout voir » saute directement au classement
   complet — jamais plus de quatre appuis imposés. */
let TC_ETAT = {liste:[], idx:0};
function tcRendreCarte(){
  const t = TC_ETAT.liste[TC_ETAT.idx];
  if(!t) return;
  $('tc-ic').textContent = t.ic;
  $('tc-lb').textContent = t.nom;
  $('tc-lb').style.color = t.coul;
  $('tc-nm').textContent = t.joueur.n;
  $('tc-nm').style.color = t.coul;
  $('tc-ch').textContent = tcChiffres(t);
  $('tc-ph').textContent = '« ' + t.phrase + ' »';
  $('tc-compte').textContent = (TC_ETAT.idx + 1) + ' / ' + TC_ETAT.liste.length;
  $('tc-halo').style.background =
    'radial-gradient(circle,' + hexA(t.coul, .22) + ',transparent 70%)';
  $('tc-points').innerHTML = TC_ETAT.liste.map((_,i) =>
    '<span class="' + (i === TC_ETAT.idx ? 'on' : '') + '"'
    + (i === TC_ETAT.idx ? ' style="background:' + t.coul + '"' : '') + '></span>'
  ).join('');
  // le carrousel boucle : le bouton garde toujours le même libellé
  const suiv = $('tc-suivant');
  suiv.textContent = 'Suivant';
  suiv.style.background = t.coul;
  // relance l'animation d'entrée à chaque carte
  const F = $('tc-flot');
  F.style.animation = 'none'; void F.offsetWidth; F.style.animation = '';
}
function tcChiffres(t){
  const p = t.joueur;
  const moy = p.tours ? Math.round(p.ecart / p.tours) : 0;
  switch(t.id){
    case 'inevitable':
    case 'chirurgien':
      return 'précision ± ' + fmt(moy) + ' · ' + p.piles + ' pile' + (p.piles>1?'s':'');
    case 'bourreau':
      return p.piles + ' pile' + (p.piles>1?'s':'') + ' · '
           + (p.donnees||0) + ' gorgées distribuées';
    case 'funambule':
    case 'joker':
      return 'régularité ± ' + fmt(Math.round(p.disp)) + ' · classement '
           + p.classement + 'e';
    case 'stoique':
    case 'eponge':
      return p.gorgees + ' gorgée' + (p.gorgees>1?'s':'') + ' bue'
           + (p.gorgees>1?'s':'');
    case 'lent':
    case 'presse':
      return 'biais ' + (p.biaisMoy>0?'+':'') + fmt(Math.round(p.biaisMoy));
    case 'grimpeur':
    case 'essouffle':
      return 'précision ± ' + fmt(moy) + ' sur ' + p.tours + ' tours';
    default:
      return p.tours + ' tours · précision ± ' + fmt(moy);
  }
}
function afficherTitresCarrousel(titres){
  const bloc = $('titres-c');
  if(!bloc) return;
  if(!titres || !titres.length){ bloc.style.display = 'none'; return; }
  TC_ETAT = {liste:titres, idx:0, vue:'carrousel'};
  bloc.style.display = 'block';
  tcAfficherCarrousel();
}
/* le classement en dessous reste toujours visible, quelle que soit la
   vue choisie ici : « suivant » ne fait donc jamais qu'avancer une
   carte, en boucle — jamais fermer ni révéler quoi que ce soit d'autre. */
function tcAvancer(sens){
  const n = TC_ETAT.liste.length;
  TC_ETAT.idx = (TC_ETAT.idx + sens + n) % n;
  tcRendreCarte();
}
function tcAfficherCarrousel(){
  TC_ETAT.vue = 'carrousel';
  $('tc-flot').style.display = '';
  $('tc-p1').style.display = '';
  $('tc-p2').style.display = '';
  $('tc-points').style.display = '';
  $('tc-colonne').style.display = 'none';
  $('tc-suivant').style.display = '';
  $('tc-tout').textContent = 'Tout voir';
  tcRendreCarte();
}
function tcAfficherColonne(){
  TC_ETAT.vue = 'colonne';
  $('tc-flot').style.display = 'none';
  $('tc-p1').style.display = 'none';
  $('tc-p2').style.display = 'none';
  $('tc-points').style.display = 'none';
  $('tc-suivant').style.display = 'none';
  $('tc-tout').textContent = 'Une carte à la fois';
  const col = $('tc-colonne');
  col.style.display = 'flex';
  col.innerHTML = TC_ETAT.liste.map((t,i) => `
    <div class="tc-col-item" style="animation-delay:${i*70}ms;
      border-color:${hexA(t.coul,.35)};background:${hexA(t.coul,.07)}">
      <span class="tc-col-ic">${t.ic}</span>
      <div class="tc-col-cx">
        <div class="tc-col-lb" style="color:${t.coul}">${esc(t.nom)}</div>
        <div class="tc-col-nm">${esc(t.joueur.n)}</div>
        <div class="tc-col-ch">${esc(tcChiffres(t))}</div>
        <div class="tc-col-ph">« ${esc(t.phrase)} »</div>
      </div>
    </div>`).join('');
}
if($('tc-suivant')) $('tc-suivant').onclick = () => tcAvancer(1);
if($('tc-tout')) $('tc-tout').onclick = () =>
  (TC_ETAT.vue === 'colonne') ? tcAfficherCarrousel() : tcAfficherColonne();

/* balayer la carte pour naviguer, en plus du bouton — seulement en vue
   carrousel, une seule liaison suffit puisque tcRendreCarte() ne fait
   que réécrire le contenu d'un élément qui reste le même dans le DOM */
(function(){
  const el = $('tc-flot');
  if(!el) return;
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive:true});
  el.addEventListener('touchend', e => {
    if(x0 === null || TC_ETAT.vue !== 'carrousel') return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if(Math.abs(dx) < 40) return;   // pas assez ample pour être un vrai geste
    tcAvancer(dx < 0 ? 1 : -1);
  }, {passive:true});
})();

function afficherFin(){
  purgerMinuteries();
  S.partie = false; S.encours = false;
  arreterBattement(); arreterMusique(); arreterAmbiance(); purgerBiome();
  const abandonSolo = estSolo(CFG.mode) && S.abandon;
  if(!S.enregistre && !abandonSolo && !S.essaiBiome){
    S.enregistre = true;
    
    // NOUVEAU BLOC : Sauvegarde de l'historique Soirée
    if (!estSolo(CFG.mode)) {
      MEM.historiqueSoirees = MEM.historiqueSoirees || [];
      const statsSoiree = S.joueurs.map(n => ({
        nom: n, gorgees: S.stats[n].gorgees, donnees: S.stats[n].donnees || 0,
        culs: S.stats[n].culs, ecart: S.stats[n].ecart, tours: S.stats[n].tours,
        piles: S.stats[n].piles
      })).filter(p => p.tours > 0);
      
      if (statsSoiree.length > 0) {
        MEM.historiqueSoirees.unshift({ date: Date.now(), mode: CFG.mode, stats: statsSoiree });
        if (MEM.historiqueSoirees.length > 10) MEM.historiqueSoirees.pop();
      }
    }
    // FIN DU NOUVEAU BLOC

    S.joueurs.forEach(n => {
      const s = S.stats[n];
      if(!s || !s.tours) return;
      const p = MEM.profils[n] || (MEM.profils[n] = profilVide());
      p.tours += s.tours;   p.somme  += s.ecart;  p.biais   += s.biais;
      p.carres += s.carres; p.piles  += s.piles;  p.gorgees += s.gorgees;
      p.culs += s.culs;     p.parties++;
      p.configs = p.configs || {};
      const kc = CFG.aff + '·' + CFG.diff;
      p.configs[kc] = (p.configs[kc] || 0) + 1;
      p.minutes = (p.minutes || 0) + (s.minutes || 0);
      if(estSolo(CFG.mode) && n === S.joueurs[0]){
        // on retient l'ancien record avant de l'écraser, pour la bannière
        S.ancienRecord = p.meilleurScore || 0;
        p.serie = Math.max(p.serie || 0, S.meilleureChaine);
        p.meilleurScore = Math.max(p.meilleurScore || 0, S.points);
      }
    });
    ecrireMem(); majMem();
    publierPartie();// envoi au salon, sans bloquer l'affichage
    // À intégrer dans afficherFin()
  trackEvent('level_end', {
    level_name: CFG.mode,
    success: S.mort ? 'false' : 'true'
  });

  // Si c'est un mode solo avec des points, on envoie le score
  if (estSolo(CFG.mode) && S.points > 0) {
    trackEvent('post_score', {
      level: CFG.mode,
      character: S.joueurs[0], // Identifie si c'est un habitué
      score: S.points
    });
  }
    publierPerf();            // et au compte, si l'on est connecté
  }
  // l'usage compte TOUTES les parties, abandons compris : c'est le taux
  // d'abandon qui est intéressant
  if(!S.usageNote && !S.essaiBiome){
    S.usageNote = true;
    noterUsage(CFG.mode, !abandonSolo);
    if(CFG.mode === 'defi' && S.defi && !abandonSolo)
      noterDefi(S.points, S.defi.mesure);
    if(CFG.mode === 'reflexe' && S.reflexes.length)
      noterReflexe(Math.round(S.reflexes.reduce((a,b) => a+b, 0) / S.reflexes.length));
    ecrireMem();
  }
  const R = $('fin-resume'), TI = $('fin-titre');
  TI.textContent = 'Le plus précis'; R.textContent = MODE().n;
  const DC = $('fin-decompte');
  if(DC){ DC.style.display = 'none'; DC.innerHTML = ''; }
  detecterRecord();
  if(CFG.mode === 'elimination'){
    const v = actifs();
    TI.textContent = v.length === 1 ? v[0] + ' survit' : 'Élimination';
    R.textContent = 'Élimination · ' + S.elimines.length + ' joueur'
      + (S.elimines.length>1?'s':'') + ' hors jeu';
  }
  if(CFG.mode === 'coop'){
    const gagne = S.total >= 3000;
    TI.textContent = gagne ? 'Objectif atteint' : 'Plus de vies';
    R.textContent = 'Coopératif · chrono ' + fmt(S.total) + ' / 30,00 · '
      + S.vies + ' vie' + (S.vies>1?'s':'') + ' restante' + (S.vies>1?'s':'');
  }
  if(CFG.mode === 'combat'){
    const b = bossCourant();
    const gagne = S.pvBoss <= 0;
    TI.textContent = gagne ? b.n + ' est tombé' : 'Vaincu par ' + b.n;
    const rang = !gagne ? null : S.pvMoi >= 100 ? 'or' : S.pvMoi > 50 ? 'argent' : 'bronze';
    R.textContent = gagne
      ? 'Combat · rang ' + rang + ' · ' + S.pvMoi + ' PV restants'
        + (S.bossIdx < BOSS.length - 1 ? ' · ' + BOSS[S.bossIdx+1].n + ' débloqué' : '')
      : 'Combat · il lui restait ' + S.pvBoss + ' PV';
    if(gagne){
      MEM.boss = MEM.boss || {};
      const anc = MEM.boss[b.id];
      const ordre = {bronze:1, argent:2, or:3};
      if(!anc || ordre[rang] > ordre[anc]) MEM.boss[b.id] = rang;
      S.bossIdx = Math.min(BOSS.length - 1, S.bossIdx + 1);
      ecrireMem();
    }
  }
  if(CFG.mode === 'compte'){
    const d = Math.abs(S.total - 2000);
    TI.textContent = d === 0 ? 'Le compte est bon' : 'À ' + fmt(d) + ' du compte';
    R.textContent = 'Le compte est bon · arrivé à ' + fmt(S.total) + ' pour 20,00 visé';
  }
  const gagnes = [];
  S.joueurs.forEach(n => {
    const avant = S.tropheesAvant[n] || [];
    trophees(n).forEach(({tr, e}) => {
      const cle = tr.id + ':' + e.rang;
      if(!avant.includes(cle)) gagnes.push({n, nom:tr.n, rang:RANGS[e.rang]});
    });
  });
  S.gagnes = gagnes;

  // un essai de biome ramène là d'où il vient
  $('fin-test').style.display = S.essaiBiome ? 'block' : 'none';
  // essai en test (point 3) : partage du résultat en image
  if($('fin-partager-img'))
    $('fin-partager-img').style.display = compteTestAutorise() ? 'block' : 'none';
  $('fin-bo').style.display = AVT() ? 'flex' : 'none';
  $('fin-menu-avt-bloc').style.display = AVT() ? 'flex' : 'none';
  $('recap-fermer').textContent = AVT() ? 'Retour au menu principal' : 'Retour au menu';
  majInvitationCompte();
  const rev0 = $('revelation');
  if(CFG.mode === 'survie'){
    const tout = S.courbe || [];
    const c = tout.slice(-20);   // au-delà, les barres deviennent illisibles
    TI.textContent = S.points + ' tour' + (S.points > 1 ? 's' : '');
    const plaf = plafondSurvie(S.points || 1);
    R.innerHTML = 'Survie · zone finale ± ' + fmt(Math.max(1, S.zoneSurvie))
      + ' · ' + S.pilesSurvie + ' pile' + (S.pilesSurvie > 1 ? 's' : '')
      + (c.length > 1 ? '<span class="courbe-sv">' + c.map((z, i) =>
          `<i style="height:${Math.max(4, Math.round(z / 50 * 100))}%${
            i === c.length - 1 ? ';background:var(--signal)' : ''}"></i>`).join('')
        + '</span><span class="courbe-lb">largeur de zone · '
        + (tout.length > 20 ? '20 derniers tours' : 'tour par tour') + '</span>' : '');
    const m = S.meilleureSerie || {n:0};
    rev0.style.display = 'block';
    rev0.querySelector('.t').textContent = 'Le moment clé';
    $('rev-texte').textContent = m.n >= 2
      ? 'Ta meilleure série : ' + m.n + ' bons coups d\'affilée au tour ' + m.tour
        + ', la zone est remontée de ' + fmt(m.de) + ' à ' + fmt(m.a) + '.'
      : S.points <= 3
        ? "Partie très courte. La zone part à ± 0,30 : les premiers tours sont les plus faciles."
        : 'Aucune série cette fois. Deux bons coups d\'affilée majorent le gain de moitié, trois le doublent.';
  }
  if(AVT() && S.avt){
    effacerRepriseAvt();
    const A = S.avt, M = avtMem();
    const meilleurAvant = M.meilleur || 0;
    M.xp += A.xp;
    M.or = (M.or || 0) + A.or;
    M.parties = (M.parties || 0) + 1;
    M.gardiens = (M.gardiens || 0) + A.gardiens;
    M.meilleur = Math.max(meilleurAvant, S.tour);
    ecrireMem();
    sauvegarderAvtCompte();
    // « vous n'étiez jamais allé aussi loin » : uniquement si un tour a déjà
    // été dépassé auparavant (pas la toute première expédition), et
    // seulement si on va réellement plus loin que jamais
    const B = $('fin-record');
    if(B){
      if(meilleurAvant > 0 && S.tour > meilleurAvant){
        B.className = 'record-banniere perso';
        B.innerHTML = '<div class="r-t">🗺️ Vous n\'étiez jamais allé aussi loin</div>'
          + 'Tour ' + S.tour + ' atteint, votre record précédent était le tour ' + meilleurAvant + '.';
        B.style.display = 'block';
      } else {
        B.style.display = 'none';
      }
    }
    TI.textContent = A.xp + ' xp ramenés';
    const b = BIOMES[Math.min(BIOMES.length - 1, A.gardiens)];
    R.textContent = 'Aventure · ' + S.tour + ' tour' + (S.tour > 1 ? 's' : '')
      + ' · ' + A.gardiens + ' gardien' + (A.gardiens > 1 ? 's' : '') + ' abattu'
      + (A.gardiens > 1 ? 's' : '') + ' · arrêté dans ' + b.n.toLowerCase()
      + ' · réserve ' + M.xp + ' xp · ' + M.or + ' or';
    rev0.style.display = 'block';
    rev0.querySelector('.t').textContent = 'La boutique';
    $('rev-texte').textContent = A.gardiens === 0
      ? "Aucun gardien cette fois. Il en faut dix-huit pas pour en croiser un : "
        + "une armure plus large est le moyen le plus court d'y arriver."
      : "Rien n'est perdu : l'expérience reste acquise. Une arme plus lourde "
        + "abat le gardien en moins de coups, ce qui coûte moins d'erreurs.";
  }
  if(LAB()){
    S.decompte = null;
    const f = LAB().fin();
    TI.textContent = f.t;
    R.innerHTML = f.r;
    /* un mode de laboratoire qui ne produit pas son propre décompte
       reçoit quand même le décompte générique : tous les modes solo
       affichent leur bilan chiffré, sans exception */
    afficherDecompte(S.decompte || decompteSolo());
    if(f.rev){
      rev0.style.display = 'block';
      rev0.querySelector('.t').textContent = f.rev.t;
      $('rev-texte').textContent = f.rev.s;
    } else rev0.style.display = 'none';
  }
  if(CFG.mode === 'reflexe' && S.reflexes.length){
    const L = S.reflexes;
    const moy  = Math.round(L.reduce((a,b) => a+b, 0) / L.length);
    const best = Math.min(...L), pire = Math.max(...L);
    TI.textContent = S.points + ' points';
    R.textContent = 'Réflexe · ' + moy + ' ms de moyenne · meilleure ' + best
      + ' ms · plus lente ' + pire + ' ms';
    rev0.style.display = 'block';
    rev0.querySelector('.t').textContent = 'Ce que ça vaut';
    $('rev-texte').textContent = moy < 250
      ? "Exceptionnel. Un très bon départ de Formule 1 tourne autour de 200 ms, sans le délai d'un écran tactile."
      : moy < 300 ? "Excellent. Vous êtes au niveau d'un bon pilote, écran compris."
      : moy < 400 ? "Bon. La moyenne d'un adulte sur écran tactile tourne autour de 350 ms."
      : moy < 550 ? "Correct. La fatigue et l'attention comptent beaucoup sur ce genre de test."
      : "Lent pour l'instant. Réessayez au calme, sans rien autour.";
  }
  if(abandonSolo){
    TI.textContent = 'Partie abandonnée';
    R.textContent = (SOLO() || {n:'Solo'}).n + ' · rien n\'a été enregistré. '
      + 'Une partie solo ne compte que si elle va jusqu\'au bout.';
    rev0.style.display = 'none';
    $('classement').innerHTML = '<div class="vide">Aucun score retenu.<br>'
      + 'Relancez une partie et terminez les ' + (CFG.maxTours || 10) + ' cibles.</div>';
    montrer('fin');
    return;
  }

  const c = $('classement'); c.innerHTML = '';
  if(CFG.mode === 'reflexe' || CFG.mode === 'combat' || AVT()
     || (LAB() && ['braquage','sniper','cascade'].includes(CFG.mode))){
    c.innerHTML = '';   // une précision au centième ne veut rien dire ici
    montrer('fin');
    return;
  }
  /* les titres se calculent AVANT le tri du classement classique, mais ne
     s'affichent que s'il y a bien matière à comparer : statsJoueurs() se
     charge lui-même de renvoyer une liste vide en solo. */
  const titresSoiree = calculerTitres();
  afficherTitresCarrousel(titresSoiree);
  // « Le plus précis » n'a plus de sens dès qu'un palmarès à quatre
  // entrées existe déjà en dessous — un intitulé neutre laisse le
  // carrousel porter le message, sans le doublonner ni le contredire
  if(titresSoiree.length) TI.textContent = 'Fin de partie';
  const rangs = S.joueurs.map(n => ({n, ...S.stats[n]}))
    .filter(p => p.tours > 0)
    .sort((a,b) => a.ecart/a.tours - b.ecart/b.tours);
  if(!rangs.length){
    TI.textContent = 'Partie quittée';
    c.innerHTML = '<div class="vide">Aucun tour joué, rien à classer.<br>'
      + 'Relancez une partie quand vous voulez.</div>';
  }

  rangs.forEach((p,i) => {
    const tot = analyse(MEM.profils[p.n]) ||
                analyse({tours:p.tours, somme:p.ecart, biais:p.biais, carres:p.carres});
    const bu = [ p.piles ? p.piles + ' pile' + (p.piles>1?'s':'') : null,
                 p.culs ? culs(p.culs) : null,
                 p.gorgees ? gorg(p.gorgees) + ' bues' : null,
                 p.donnees ? gorg(p.donnees) + ' données' : null ]
               .filter(Boolean).join(' · ') || 'rien bu';
    const d = document.createElement('div');
    d.className = 'ligne' + (i === 0 ? ' premier' : '');
    d.innerHTML = `<span class="pos">${i+1}</span>
      <span class="qui" style="color:${coulNom(p.n)}">${esc(p.n)}</span>
      <span class="moy ${i===0?'t-laiton':''}">±${fmt(Math.round(p.ecart/p.tours))}</span>
      <span class="bu">${bu}</span>
      <span class="detail">${jaugeHTML(tot)}
        <span class="conseil">${tot.tours} tours cumulés · ${phraseBiais(tot)}
          · régularité ±${fmt(Math.round(tot.disp))}</span></span>`;
    c.appendChild(d);
  });

  const cible = rangs.map(p => ({n:p.n, a:analyse(MEM.profils[p.n])}))
    .filter(x => x.a && x.a.tours >= 6 && Math.abs(x.a.moy) >= 3
                 && x.a.disp < x.a.precision - 1)
    .sort((a,b) => Math.abs(b.a.moy) - Math.abs(a.a.moy))[0];
  const rev = $('revelation');
  if(estSolo(CFG.mode)){
    // score enregistré, place au classement, et le mot de la fin
    const nom = S.joueurs[0], sig = sigCourante();
    const avant = scoresDe(sig);
    const meilleurAvant = avant.length ? avant[0].p : null;
    const doubles = avant.filter(e => e.p < S.points);
    MEM.scores = MEM.scores || [];
    MEM.scores.push({n:nom, p:S.points, aff:CFG.aff, diff:CFG.diff,
                     tours:CFG.maxTours || 10, bareme:CFG.mode,
                     serie:S.meilleureChaine,
                     prec:Math.round((S.stats[nom] ? S.stats[nom].ecart : 0) /
                          Math.max(1, S.stats[nom] ? S.stats[nom].tours : 1)),
                     d:Date.now()});
    elaguerScores();
    ecrireMem();
    const apres = scoresDe(sig);
    const rang = apres.findIndex(e => e.p === S.points && e.n === nom) + 1;
    /* tous les modes solo affichent désormais leur décompte de fin ; les
       modes qui en produisent un eux-mêmes (banc d'essai de score) l'ont
       déjà posé plus haut et ne sont pas écrasés ici */
    if(!S.decompte && CFG.mode !== 'combat') afficherDecompte(decompteSolo());
    // réflexe et combat ont déjà écrit leur propre résumé
    const propre = CFG.mode === 'reflexe' || CFG.mode === 'combat';
    /* le banc d'essai de score révèle son total par le décompte animé :
       l'écrire dans le titre ici le divulguerait avant l'animation */
    if(CFG.mode !== 'survie' && CFG.mode !== 'scoring')
      TI.textContent = S.points + ' points';
    let l = libelleSig(sig) + ' · '
          + rang + (rang === 1 ? 're' : 'e') + ' place sur ' + apres.length;
    if(meilleurAvant !== null && S.points > meilleurAvant) l += ' — record battu';
    else if(doubles.length) l += ' — devant ' + doubles.slice(0,2).map(e => e.n).join(', ')
      + (doubles.length > 2 ? ' et ' + (doubles.length-2) + ' autre'
         + (doubles.length > 3 ? 's' : '') : '');
    if(S.meilleureChaine > 1) l += ' · meilleure série ' + S.meilleureChaine + ' piles';
    if(propre || CFG.mode === 'survie') l = null;
    if(l !== null) R.textContent = l;
    if(!propre && CFG.mode !== 'survie'){
      rev.style.display = 'block';
      rev.querySelector('.t').textContent = 'Le mot de la fin';
      $('rev-texte').textContent = bilan(S.points);
    }
  }
  else if(cible){
    rev.querySelector('.t').textContent = 'Ce que dit le chrono';
    rev.style.display = 'block';
    $('rev-texte').textContent = cible.n + ' ' + phraseBiais(cible.a)
      + ', presque à chaque tour. En corrigeant ce décalage, sa précision passerait de ±'
      + fmt(Math.round(cible.a.precision)) + ' à ±' + fmt(Math.round(cible.a.disp)) + '.';
  } else rev.style.display = 'none';

  // Les trophées sont liés au compte du propriétaire du téléphone, pas
  // aux noms tapés pour les autres joueurs d'une soirée : afficher
  // « Charles · Baptême or » n'aurait aucun sens, Charles n'ayant pas de
  // compte. Le calcul de S.gagnes reste inchangé (rien ne dépend de son
  // affichage), seule cette ligne de résumé est réservée au solo.
  if(estSolo(CFG.mode) && S.gagnes && S.gagnes.length){
    const t = S.gagnes.slice(0, 4)
      .map(g => g.n + ' · ' + g.nom + ' ' + g.rang).join('  —  ');
    // textContent écraserait la courbe : on complète le HTML
    R.innerHTML += (R.innerHTML ? ' · ' : '') + 'Trophées : ' + esc(t)
      + (S.gagnes.length > 4 ? ' et ' + (S.gagnes.length-4) + ' autre'
         + (S.gagnes.length > 5 ? 's' : '') : '');
  }

  // toutes les sorties de partie ramènent ici, sur un écran connu
  montrer('fin');
}
$('rejouer').onclick = () => demarrerPartie();

/* ════════ PANTHÉON ════════ */
// Les profils cumulent tous les réglages : on ne peut filtrer que sur ce que
// le joueur a réellement pratiqué, d'où les compteurs par configuration.
let paAff = 'tout', paDiff = 'tout';
segmente('seg-pa', v => { paAff = v; construirePantheon(); });
segmente('seg-pd', v => { paDiff = v; construirePantheon(); });
function filtrePanth(a){
  if(paAff === 'tout' && paDiff === 'tout') return true;
  const c = a.configs || {};
  return Object.keys(c).some(k => {
    const [aff, diff] = k.split('·');
    return (paAff === 'tout' || aff === paAff) && (paDiff === 'tout' || diff === paDiff);
  });
}

function construirePantheon(){
  const noms = Object.keys(MEM.profils);
  const P = $('palmares'), R = $('records');
  P.innerHTML = ''; R.innerHTML = '';
  if(!noms.length){
    $('panth-note').textContent = '';
    P.innerHTML = '<div class="vide">Aucune performance enregistrée.<br>'
      + 'Terminez une partie et les profils apparaîtront ici.</div>';
    return;
  }
  const MIN_PARTIES = 5;   // sous ce seuil, une précision moyenne ne veut rien dire
  const tous = noms.map(n => ({n, a:analyse(MEM.profils[n])}))
    .filter(x => x.a).filter(x => filtrePanth(x.a));
  const fiables = tous.filter(x => x.a.parties >= MIN_PARTIES);
  const base = fiables.length ? fiables : tous;
  const min = (arr,f) => arr.slice().sort((a,b) => f(a)-f(b))[0];
  const max = (arr,f) => arr.slice().sort((a,b) => f(b)-f(a))[0];
  const recs = [
    ['Le plus précis',   min(base, x => x.a.precision), x => '±' + fmt(Math.round(x.a.precision))],
    ['Le plus régulier', min(base, x => x.a.disp),      x => '±' + fmt(Math.round(x.a.disp))],
    ['Le plus de piles', max(tous, x => x.a.piles),     x => x.a.piles + ' pile' + (x.a.piles>1?'s':'')],
    ['Le plus arrosé',   max(tous, x => x.a.gorgees + x.a.culs*8), x => gorg(x.a.gorgees)]
  ];
  R.innerHTML = recs.map(([k,x,f]) => x
    ? `<div class="rec"><div class="k">${k}</div><div class="v">${esc(x.n)}</div>
       <div class="d">${f(x)}</div></div>` : '').join('');

  const MIN_P = 5;
  tous.sort((a,b) => {
    const fa = a.a.parties >= MIN_P, fb = b.a.parties >= MIN_P;
    if(fa !== fb) return fa ? -1 : 1;         // les non fiables passent en bas
    return a.a.precision - b.a.precision;
  }).forEach((x,i) => {
    const a = x.a;
    const fiable = a.parties >= MIN_P;
    const bu = [ a.piles ? a.piles + ' pile' + (a.piles>1?'s':'') : null,
                 a.culs ? culs(a.culs) : null,
                 a.gorgees ? gorg(a.gorgees) : null ].filter(Boolean).join(' · ') || 'rien bu';
    const d = document.createElement('div');
    d.className = 'ligne';
    d.innerHTML = `<span class="pos">${fiable ? i+1 : '—'}</span>
      <span class="qui">${esc(x.n)}</span>
      <span class="moy ${i===0&&fiable?'t-laiton':''}">${fiable
        ? '±' + fmt(Math.round(a.precision))
        : '<span class="attente">' + a.parties + '/' + MIN_P + '</span>'}</span>
      <span class="bu">${a.parties} partie${a.parties>1?'s':''} · ${a.tours} tours · ${bu}</span>
      ${fiable ? `<span class="detail">${jaugeHTML(a)}
        <span class="conseil">${phraseBiais(a)} · régularité ±${fmt(Math.round(a.disp))}</span></span>`
      : `<span class="detail"><span class="conseil">précision affichée après
         ${MIN_P} parties terminées</span></span>`}`;
    P.appendChild(d);
  });
  $('panth-note').textContent = "Profils de ce téléphone · précision affichée après "
    + MIN_PARTIES + " parties terminées. "
    + "Les tours à événement qui faussent la mesure (cible déplacée, écran masqué, "
    + "duel) sont exclus du calcul.";
}

/* ════════ TROPHÉES ════════ */
let trQui = null;

// Agrège toutes les performances solo publiées sous un compte, dans la même
// forme que le profil local (MEM.profils[nom]) attendu par etatTrophee() —
// c'est ce qui permet de réutiliser la table TROPHEES telle quelle.
// « minutes » et « gorgees » restent à zéro : ce sont des concepts de soirée,
// qu'un compte solo ne peut structurellement jamais alimenter — le trophée
// « La minute » et « Bon public » resteront donc toujours verrouillés ici,
// ce qui est cohérent avec la règle du jeu, pas un manque.
async function agregerPerfs(uid){
  const lignes = await apiAuth('perfs?joueur=eq.' + uid
    + '&select=score,tours,somme,biais,carres,piles,serie') || [];
  if(!lignes.length) return null;
  const p = {parties:lignes.length, tours:0, somme:0, biais:0, carres:0,
             piles:0, serie:0, meilleurScore:0, minutes:0, gorgees:0, culs:0, configs:{}};
  lignes.forEach(r => {
    p.tours  += r.tours  || 0; p.somme += r.somme || 0;
    p.biais  += r.biais  || 0; p.carres += r.carres || 0;
    p.piles  += r.piles  || 0;
    p.serie = Math.max(p.serie, r.serie || 0);
    p.meilleurScore = Math.max(p.meilleurScore, r.score || 0);
  });
  return p;
}

async function construireTrophees(){
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  $('tr-hors').style.display = s ? 'none' : 'block';
  $('tr-dans').style.display = s ? 'block' : 'none';
  if(!s) return;
  // un compte est une seule identité : plus besoin de choisir entre plusieurs
  // profils locaux, l'ancien sélecteur disparaît
  $('seg-tr').innerHTML = '';
  const L = $('tr-liste'); L.innerHTML = '<div class="vide">Chargement…</div>';
  let pseudo = null;
  try{ const pr = await monProfil(); pseudo = pr && pr.pseudo; }catch(e){}
  $('tr-qui').textContent = pseudo || emailVersIdent(s.email);
  let p = null;
  try{ p = await agregerPerfs(s.id); }
  catch(e){
    L.innerHTML = '';
    $('tr-note').textContent = messageCompte(e);
    return;
  }
  L.innerHTML = '';
  if(!p){
    L.innerHTML = '<div class="vide">Aucune partie solo publiée sous ce compte pour l\'instant.<br>'
      + 'Terminez une partie solo pour débloquer vos premiers trophées.</div>';
    $('tr-note').textContent = '';
    return;
  }
  let acquis = 0, or = 0;

  TROPHEES.forEach(tr => {
    const e = etatTrophee(tr, p);
    if(e){ acquis++; if(e.rang === 2) or++; }
    const d = document.createElement('div');
    d.className = 'tro' + (e ? '' : ' verrou');
    const med = e ? RANGS[e.rang] : '';
    const chiffre = e ? (e.valeur !== null ? e.valeur : '✓') : '?';
    // Verrouillé : on montre le nom et une phrase d'ambiance, jamais la condition.
    // Le chemin ne se révèle qu'une fois le premier palier atteint.
    let prog = '', barre = '', texte;
    if(!e){
      texte = `<span class="d myst">${tr.m}</span>`;
    } else {
      texte = `<span class="d">${tr.d}</span>`;
      if(e.suivant !== undefined && tr.seuils){
        const but = e.suivant;
        prog = tr.inverse ? 'prochain palier sous ' + but : but + ' pour le palier suivant';
        const pc = tr.inverse
          ? Math.min(100, Math.round(but / Math.max(but, e.valeur) * 100))
          : Math.min(100, Math.round(e.valeur / but * 100));
        barre = `<span class="barre"><i style="width:${pc}%"></i></span>`;
      } else if(tr.seuils){
        prog = 'palier maximal atteint';
      }
    }
    d.innerHTML = `<span class="medaille ${med}">${chiffre}</span>
      <span class="txt"><span class="n">${tr.n}</span>
      ${texte}${prog ? `<span class="prog">${prog}</span>` : ''}${barre}</span>`;
    L.appendChild(d);
  });

  $('tr-note').innerHTML = `<span class="compte">
    <span>${acquis} / ${TROPHEES.length} débloqués</span>
    <span>${or} en or</span>
    <span>${p.tours} tours · ${p.parties} partie${p.parties>1?'s':''}</span></span>`;
}

/* ════════ COMPTES ════════ */
// Authentification par code à six chiffres. Le lien magique ouvrirait Safari
// au lieu de l'application installée : le code se recopie et marche partout.
const CLE_SESSION = 'krono.session';

function lireSession(){
  try{ return JSON.parse(localStorage.getItem(CLE_SESSION) || 'null'); }catch(e){ return null; }
}
function ecrireSession(s){
  try{ s ? localStorage.setItem(CLE_SESSION, JSON.stringify(s))
         : localStorage.removeItem(CLE_SESSION); }catch(e){}
  SESSION = s;
}
let SESSION = null;

// Après un aller-retour Google, l'URL porte les jetons dans le fragment
// (#access_token=...) et le localStorage porte l'intention qu'on avait avant
// de partir. On reconstitue la session, on nettoie l'URL, puis on rejoue la
// suite comme si le formulaire venait de répondre.
async function reprendreApresGoogle(){
  const frag = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = frag.get('access_token');
  if(!token) return;
  const s = {token, refresh:frag.get('refresh_token'),
             expire:Date.now() + (Number(frag.get('expires_in')) || 3600) * 1000};
  history.replaceState(null, '', location.pathname);   // retire le fragment
  try{
    const u = await fetch(SUPABASE_URL + '/auth/v1/user',
      {headers:{apikey:SUPABASE_KEY, Authorization:'Bearer ' + token}});
    const d = await u.json();
    if(!d || !d.id) return;
    s.id = d.id; s.email = d.email;
  }catch(e){ return; }
  ecrireSession(s);
  let reprise = null;
  try{ reprise = JSON.parse(localStorage.getItem(CLE_REPRISE) || 'null'); }catch(e){}
  try{ localStorage.removeItem(CLE_REPRISE); }catch(e){}
  AUTH_RETOUR = (reprise && reprise.retour) || 'profil';
  if(reprise && reprise.invitation) INVITATION = reprise.invitation;
  // laisse le temps au reste de l'amorçage (peupler, construireTest…) de finir
  setTimeout(() => apresConnexion(), 50);
}

async function auth(chemin, corps){
  const r = await fetch(SUPABASE_URL + '/auth/v1/' + chemin, {
    method:'POST',
    headers:{apikey:SUPABASE_KEY, 'Content-Type':'application/json'},
    body:JSON.stringify(corps)
  });
  const txt = await r.text();
  if(!r.ok) throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 160));
  return txt ? JSON.parse(txt) : null;
}

// Le domaine est fictif : Supabase Auth exige un e-mail, mais personne ne le
// voit jamais et aucun message n'est envoyé. Le joueur retient un identifiant
// et un mot de passe, point.
const DOMAINE_FICTIF = '@krono.local';
const identVersEmail = id => id.toLowerCase().replace(/[^a-z0-9._-]/g, '') + DOMAINE_FICTIF;
const emailVersIdent = e => e ? e.replace(DOMAINE_FICTIF, '') : '';

// 1 — créer un compte
async function creerCompte(ident, pass){
  const d = await auth('signup', {email:identVersEmail(ident), password:pass});
  if(!d || !d.access_token) throw new Error('Réponse inattendue du serveur.');
  return sessionDepuis(d);
}

// 2 — se connecter
async function connecterCompte(ident, pass){
  const d = await auth('token?grant_type=password',
    {email:identVersEmail(ident), password:pass});
  if(!d || !d.access_token) throw new Error('Réponse inattendue du serveur.');
  return sessionDepuis(d);
}

function sessionDepuis(d){
  const s = {token:d.access_token, refresh:d.refresh_token,
             id:d.user.id, email:d.user.email,
             expire:Date.now() + (d.expires_in || 3600) * 1000};
  ecrireSession(s);
  return s;
}

// 3 — renouveler un jeton expiré
async function rafraichirSession(){
  const s = lireSession();
  if(!s) return null;
  if(Date.now() < s.expire - 60000){ SESSION = s; return s; }
  try{
    const d = await auth('token?grant_type=refresh_token', {refresh_token:s.refresh});
    const n = {...s, token:d.access_token, refresh:d.refresh_token,
               expire:Date.now() + (d.expires_in || 3600) * 1000};
    ecrireSession(n);
    return n;
  }catch(e){ ecrireSession(null); return null; }
}

// appel authentifié : le jeton du joueur remplace la clé anonyme
async function apiAuth(chemin, options){
  const s = await rafraichirSession();
  if(!s) throw new Error('Aucune session.');
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + chemin, {
    ...options,
    headers:{apikey:SUPABASE_KEY, Authorization:'Bearer ' + s.token,
             'Content-Type':'application/json', Prefer:'return=representation',
             ...(options && options.headers)}
  });
  if(!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function monProfil(){
  const s = await rafraichirSession();
  if(!s) return null;
  const r = await apiAuth('profils?id=eq.' + s.id + '&select=pseudo,tag');
  return r && r[0] ? r[0] : null;
}
async function mesLigues(){
  const s = await rafraichirSession();
  if(!s) return [];
  return await apiAuth('membres?joueur=eq.' + s.id
    + '&select=ligue,ligues(nom,embleme)') || [];
}
// Sauvegarde silencieuse de la progression Aventure sur le compte : même
// principe que publierPerf, un échec réseau n'interrompt jamais le jeu
// (la partie locale, dans MEM.avt, reste la source de vérité immédiate).
async function sauvegarderAvtCompte(){
  const s = await rafraichirSession();
  if(!s) return;
  const M = avtMem();
  try{
    await apiAuth('aventure_progres?on_conflict=joueur', {
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({
        joueur:s.id, xp:M.xp, or_:M.or || 0, arme:M.arme, armure:M.armure,
        meilleur:M.meilleur || 0, gardiens:M.gardiens || 0, parties:M.parties || 0,
        achats:M.achats || [], competences:M.competences || []
      })
    });
  }catch(e){ /* silencieux : la progression locale compte de toute façon */ }
}

// Au chargement, le compte fait autorité s'il a une progression enregistrée :
// on la copie dans MEM.avt pour que l'appareil reparte avec le même état,
// même après une réinstallation ou depuis un autre appareil.
async function chargerAvtCompte(){
  const s = await rafraichirSession();
  if(!s) return;
  try{
    const r = await apiAuth('aventure_progres?joueur=eq.' + s.id + '&select=*');
    const d = r && r[0];
    if(!d) { sauvegarderAvtCompte(); return; }   // rien côté serveur : on y publie l'état local
    MEM.avt = {
      xp:d.xp || 0, or:d.or_ || 0, arme:d.arme || 'baton', armure:d.armure || 'tunique',
      meilleur:d.meilleur || 0, gardiens:d.gardiens || 0, parties:d.parties || 0,
      achats:d.achats || [], competences:d.competences || []
    };
    ecrireMem();
  }catch(e){ /* silencieux : MEM.avt local reste utilisé tel quel */ }
}

async function publierPerf(){
  const s = await rafraichirSession();
  if(!s || !estSolo(CFG.mode)) return;
  const st = S.stats[S.joueurs[0]];
  if(!st || !st.tours) return;
  try{
    await apiAuth('perfs', {method:'POST', body:JSON.stringify({
      joueur:s.id, mode:CFG.mode, config:sigCourante(), score:S.points,
      tours:st.tours, somme:st.ecart, biais:st.biais, carres:st.carres, piles:st.piles,
      serie:S.meilleureChaine || 0
    })});
  }catch(e){ /* silencieux : la partie locale compte de toute façon */ }
}

/* ════════ PROFIL ════════ */
// Le profil est local par défaut. Il se synchronise avec le compte dès qu'une
// session existe, sans jamais bloquer le jeu s'il n'y en a pas.
const PROFIL_VIDE = () => ({pseudo:null, photo:null, couleur:null});
const monPro = () => (MEM.profil = MEM.profil || PROFIL_VIDE());

let BOUTIQUE_RETOUR = 'test';
$('bo-retour').onclick = () => montrer(S.partie ? ecranJeu() : BOUTIQUE_RETOUR);

$('av-retour').onclick = () => montrer('reglages');
$('av-competences').onclick = () => { construireCompetences(); montrer('aventure-competences'); };
$('acp-retour').onclick = () => montrer('aventure-accueil');
$('av-boutique').onclick = () => {
  BOUTIQUE_RETOUR = 'aventure-accueil';
  construireBoutique(); montrer('boutique');
};
$('av-personnaliser').onclick = () => montrer('aventure-apparence');
$('apr-retour').onclick = () => montrer('aventure-accueil');
$('avt-bv-continuer').onclick = () => {
  $('avt-boss-vaincu').classList.remove('on');
  const decision = S.avt ? S.avt.decisionEnAttente : null;
  const bio = S.avt ? S.avt.biomeTransitionEnAttente : null;
  if(decision){
    afficherDecisionBiome(S.avt.biomeId, decision);
  } else if(bio){
    S.avt.biomeTransitionEnAttente = null;
    afficherTransitionBiome(bio);
  } else {
    const fl = $('fluide');
    if(fl) fl.classList.remove('avt-popup-actif');
    fluidePhase('repos'); fluidePret();
  }
};
$('avt-trans-continuer').onclick = () => {
  $('avt-transition').classList.remove('on');
  const fl = $('fluide');
  if(fl) fl.classList.remove('avt-popup-actif');
  fluidePhase('repos'); fluidePret();
};
$('av-lancer').onclick = async () => {
  if(await reprendrePartieAvt()) return;   // une expédition en attente reprend directement
  CFG.mode = 'aventure'; MEM.joueurs = MEM.joueurs && MEM.joueurs[0] ? MEM.joueurs : ['Joueur'];
  peupler();
  await demarrerPartie();
};
$('av-nouvelle-histoire').onclick = async () => {
  const ok = await demander('Nouvelle histoire ?',
    'Cela effacera votre sauvegarde actuelle : niveau, or, équipement et '
    + 'compétences repartiront à zéro. Cette action est irréversible.',
    'Effacer et recommencer');
  if(!ok) return;
  MEM.avt = {xp:0, or:0, arme:'baton', armure:'tunique',
             meilleur:0, gardiens:0, parties:0, competences:[], achats:[]};
  effacerRepriseAvt();
  ecrireMem();
  sauvegarderAvtCompte();
  CFG.mode = 'aventure'; MEM.joueurs = MEM.joueurs && MEM.joueurs[0] ? MEM.joueurs : ['Joueur'];
  peupler();
  await demarrerPartie();
  afficherTransitionBiome('jungle');
};
$('fin-boutique').onclick = () => { BOUTIQUE_RETOUR = 'aventure-accueil'; construireBoutique(); montrer('boutique'); };
$('go-boutique').onclick = () => { BOUTIQUE_RETOUR = 'test'; construireBoutique(); montrer('boutique'); };
$('bo-partir').onclick = () => { CFG.mode = 'aventure'; MEM.cfg = {...CFG};
  ecrireMem(); demarrerPartie(); };
$('pr-retour').onclick = () => montrer('reglages');
// Navigation vers l'historique
$('pr-voir-histo').onclick = () => { 
  construireHistoriqueSoirees(); 
  montrer('historique-soirees'); 
};
$('hs-retour').onclick = () => montrer('profil');

function construireHistoriqueSoirees() {
  const cont = $('hs-liste'); // On cible la nouvelle page
  if(!cont) return;
  const H = MEM.historiqueSoirees || [];
  if(!H.length) {
    cont.innerHTML = '<div class="vide">Aucune partie soirée enregistrée sur ce téléphone.</div>';
    return;
  }
  
  cont.innerHTML = H.map((h, idx) => {
    const d = new Date(h.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
    const modeObj = MODES.find(m => m.id === h.mode) || {n: h.mode};
    const topBuveur = [...h.stats].sort((a,b) => (b.gorgees + b.culs*4) - (a.gorgees + a.culs*4))[0];
    const topPrecis = [...h.stats].sort((a,b) => (a.ecart/a.tours) - (b.ecart/b.tours))[0];
    
    return `<div class="evt" data-idx="${idx}" style="cursor:pointer; border-color:var(--trait); margin-top:10px; padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px;">
        <div style="font-size:18px; font-weight:700; color:var(--laiton); letter-spacing:0.04em; text-transform:uppercase;">${modeObj.n}</div>
        <div style="font-family:var(--mono); font-size:10px; color:var(--gris);">${d}</div>
      </div>
      <div style="font-size:14px; line-height:1.6;">
        <span style="opacity:0.7">Plus arrosé :</span> <b style="color:var(--signal); font-size:15px;">${esc(topBuveur.nom)}</b> <span style="font-family:var(--mono); font-size:10px; color:var(--gris); margin-left:4px;">${topBuveur.gorgees}g, ${topBuveur.culs}c</span><br>
        <span style="opacity:0.7">Plus précis :</span> <b style="color:var(--vertVif); font-size:15px;">${esc(topPrecis.nom)}</b> <span style="font-family:var(--mono); font-size:10px; color:var(--gris); margin-left:4px;">±${fmt(Math.round(topPrecis.ecart/topPrecis.tours))}</span>
      </div>
    </div>`;
  }).join('');

  cont.querySelectorAll('.evt').forEach(el => {
    el.onclick = () => {
      const h = H[el.dataset.idx];
      const d = new Date(h.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
      const modeObj = MODES.find(m => m.id === h.mode) || {n: h.mode};
      const tri = [...h.stats].sort((a,b) => (a.ecart/a.tours) - (b.ecart/b.tours));
      
      const lignesHTML = tri.map((p, i) => {
        const bu = [ p.piles ? p.piles + ' pile' + (p.piles>1?'s':'') : null,
                     p.culs ? culs(p.culs) : null,
                     p.gorgees ? gorg(p.gorgees) + ' bues' : null,
                     p.donnees ? gorg(p.donnees) + ' données' : null
                   ].filter(Boolean).join(' · ') || 'rien bu';
                     
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--trait); text-align:left;">
          <div style="flex:1; min-width:0; padding-right:12px;">
            <div style="font-size:17px; font-weight:700; color:${coulHash(p.nom)}; text-transform:uppercase; letter-spacing:0.03em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${i+1}. ${esc(p.nom)}</div>
            <div style="font-family:var(--mono); font-size:10.5px; color:var(--gris); margin-top:4px;">${bu}</div>
          </div>
          <div style="color:var(--laiton); font-family:var(--mono); font-size:15px; flex-shrink:0;">±${fmt(Math.round(p.ecart/p.tours))}</div>
        </div>`;
      }).join('');

      const tableauHTML = `<div style="max-height: 50vh; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding-right: 6px;">${lignesHTML}</div>`;
      choisir(modeObj.n.toUpperCase() + ' · ' + d, '', [{label:'Fermer', val:true}]);
      $('mod-sous').innerHTML = tableauHTML;
    };
  });
}

/* ════════ INSTALLATION PWA ════════
   beforeinstallprompt ne se déclenche que sur les navigateurs Chromium
   (Chrome/Edge/Samsung Internet — desktop et Android) : Safari et Firefox
   ne l'exposent jamais, et Chrome ne le redéclenche qu'après un moment
   d'usage réel, jamais au tout premier chargement. iOS n'a d'ailleurs
   AUCUN moyen programmatique d'installer : seul « Partager → Sur l'écran
   d'accueil » existe, d'où l'encart d'instructions dédié ci-dessous plutôt
   qu'un simple bouton. Tout le reste de l'app est pensé pour un usage
   installé (verrouillage de portrait, plein écran, safe-area) : ce nudge
   est la seule chose qui manquait pour vraiment y amener les joueurs. */
let INSTALL_PROMPT = null;
let installCardShown = false;   // pour ne tracker « affiché » qu'une fois par session
const CLE_INSTALL = 'krono.install';
const estIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
// navigator.standalone n'existe que sur iOS Safari ; display-mode:standalone
// couvre Android/desktop une fois l'app effectivement lancée en autonome
const dejaInstalle = () => navigator.standalone === true
  || matchMedia('(display-mode: standalone)').matches;

function lireInstallMem(){
  try{ return JSON.parse(localStorage.getItem(CLE_INSTALL) || '{}'); }catch(e){ return {}; }
}
function ecrireInstallMem(m){ try{ localStorage.setItem(CLE_INSTALL, JSON.stringify(m)); }catch(e){} }

addEventListener('beforeinstallprompt', ev => {
  ev.preventDefault();   // on choisit nous-mêmes quand le proposer, pas le navigateur
  INSTALL_PROMPT = ev;
  majEncartInstall();
});
addEventListener('appinstalled', () => {
  INSTALL_PROMPT = null;
  ecrireInstallMem({...lireInstallMem(), installe:true});
  majEncartInstall();
});

// appelée à l'ouverture de Profil (où vit l'encart) et une fois au
// lancement pour couvrir le cas iOS, qui n'a pas d'événement à écouter
function majEncartInstall(){
  const bloc = $('pr-install');
  if(!bloc) return;
  const m = lireInstallMem();
  const refuseRecemment = m.refuseLe && (Date.now() - m.refuseLe) < 30 * 86400000;
  const visible = !dejaInstalle() && !m.installe && !refuseRecemment && (INSTALL_PROMPT || estIOS());
  bloc.style.display = visible ? 'block' : 'none';
  if(!visible) return;
  if(!installCardShown){
    installCardShown = true;
    trackEvent('pwa_install_prompt_shown', {platform: estIOS() ? 'ios' : 'android'});
  }
  $('pr-install-texte').textContent = (estIOS() && !INSTALL_PROMPT)
    ? 'Ouvrez le menu Partager (⬆️) puis « Sur l\'écran d\'accueil ».'
    : 'Lancement plus rapide, plein écran, icône sur votre accueil.';
  $('pr-install-action').style.display = INSTALL_PROMPT ? 'block' : 'none';
}
$('pr-install-action').onclick = async () => {
  if(!INSTALL_PROMPT) return;
  const prompt = INSTALL_PROMPT;
  INSTALL_PROMPT = null;   // un seul essai par invite : Chrome ne la redonne pas tout de suite
  prompt.prompt();
  const choix = await prompt.userChoice;
  trackEvent('pwa_install_prompt_result', {outcome:choix.outcome, platform:'android'});
  if(choix.outcome === 'accepted') ecrireInstallMem({...lireInstallMem(), installe:true});
  majEncartInstall();
};
$('pr-install-fermer').onclick = () => {
  ecrireInstallMem({...lireInstallMem(), refuseLe:Date.now()});
  trackEvent('pwa_install_prompt_result', {outcome:'dismissed', platform: estIOS() ? 'ios' : 'android'});
  majEncartInstall();
};

/* ════════ NOTIFICATIONS PUSH ════════
   Web Push : demandes d'ami, réponses, défis de duel — les seuls signaux
   qui ont vraiment besoin d'atteindre un joueur app fermée (voir la section
   AMIS et DUEL À DISTANCE, qui reposaient jusqu'ici sur « repensez à
   rouvrir l'app »). Clé VAPID publique seulement : la privée ne vit que
   dans l'edge function notifier-push, jamais côté client.
   Sur iOS, aucune notification n'est possible tant que l'app n'est pas
   installée sur l'écran d'accueil (voir dejaInstalle()) : l'encart
   l'explique plutôt que d'afficher un bouton qui échouerait silencieusement. */
const VAPID_PUBLIC_KEY = 'BBgfptYyGLEhU_TdZ4MrbhhZAFJD4JFv7bgo4KKcpVdwLpXQDRv-TPUBMpxKYm4yg-cGN8Sze1MFbUfAJoASDO0';
const estNotifCompatible = () => 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';

// applicationServerKey attend un Uint8Array, pas la chaîne base64url brute
function b64VersUint8(base64){
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(b64);
  const tampon = new Uint8Array(brut.length);
  for(let i = 0; i < brut.length; i++) tampon[i] = brut.charCodeAt(i);
  return tampon;
}
async function estAbonneNotifs(){
  try{
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  }catch(e){ return false; }
}
async function majEncartNotifs(){
  const bloc = $('pr-notifs');
  if(!bloc) return;
  if(!estNotifCompatible()){ bloc.style.display = 'none'; return; }
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  if(!s){ bloc.style.display = 'none'; return; }   // l'abonnement se rattache à un compte
  bloc.style.display = 'block';
  const B = $('pr-notifs-action');
  if(estIOS() && !dejaInstalle()){
    $('pr-notifs-texte').textContent = "Installez d'abord l'app (ci-dessus) : iOS n'autorise les "
      + 'notifications qu\'une fois ajoutée à l\'écran d\'accueil.';
    B.style.display = 'none';
    return;
  }
  if(Notification.permission === 'denied'){
    $('pr-notifs-texte').textContent = 'Bloquées au niveau du navigateur — à réactiver dans ses réglages.';
    B.style.display = 'none';
    return;
  }
  const abonne = Notification.permission === 'granted' && await estAbonneNotifs();
  B.style.display = 'block';
  if(abonne){
    $('pr-notifs-texte').textContent = "Activées : défis, demandes d'ami et réponses vous alertent même app fermée.";
    B.textContent = 'Désactiver'; B.className = 'bouton fantome';
    B.onclick = () => desabonnerNotifs();
  } else {
    $('pr-notifs-texte').textContent = "Recevez une alerte quand un ami vous défie ou répond à votre demande.";
    B.textContent = 'Activer'; B.className = 'bouton';
    B.onclick = () => abonnerNotifs();
  }
}
async function abonnerNotifs(){
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted') return majEncartNotifs();
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:true, applicationServerKey:b64VersUint8(VAPID_PUBLIC_KEY)
    });
    const s = await rafraichirSession();
    if(!s) return;
    const cle = sub.toJSON().keys;
    await apiAuth('push_abonnements?on_conflict=endpoint', {method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({endpoint:sub.endpoint, joueur:s.id, p256dh:cle.p256dh, auth_cle:cle.auth})});
    trackEvent('push_subscribed');
  }catch(e){ choisir('Notifications indisponibles', messageCompte(e), [{label:'Fermer', val:true}]); }
  majEncartNotifs();
}
async function desabonnerNotifs(){
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){
      await apiAuth('push_abonnements?endpoint=eq.' + encodeURIComponent(sub.endpoint), {method:'DELETE'}).catch(() => {});
      await sub.unsubscribe();
    }
    trackEvent('push_unsubscribed');
  }catch(e){ /* silencieux : au pire l'abonnement serveur reste, il sera purgé au premier envoi raté */ }
  majEncartNotifs();
}
// best-effort, jamais bloquant : un échec d'envoi ne doit jamais faire
// échouer l'action elle-même (créer le duel, envoyer la demande d'ami…)
async function notifierPush(cible, titre, texte, url){
  try{
    const s = await rafraichirSession();
    if(!s) return;
    await fetch(SUPABASE_URL + '/functions/v1/notifier-push', {
      method:'POST',
      headers:{apikey:SUPABASE_KEY, Authorization:'Bearer ' + s.token, 'Content-Type':'application/json'},
      body:JSON.stringify({cible, titre, texte, url})
    });
  }catch(e){ /* silencieux */ }
}

async function construireProfil(){
  majEncartInstall();
  majEncartNotifs();
  const p = monPro();
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  let distant = null;
  if(s){
    try{ 
      distant = await monProfil(); 
      if(distant && distant.photo && !p.photo) p.photo = distant.photo;
    }catch(e){} 
  }
  const nom = p.pseudo || (distant && distant.pseudo)
    || (MEM.joueurs && MEM.joueurs[0]) || 'Invité';

  $('pr-pseudo').textContent = nom;
  $('pr-pseudo').style.color = p.couleur || coulHash(nom);
  $('pr-mail').textContent = s ? s.email : 'Profil local · aucun compte';
  $('pr-etat').textContent = s ? 'connecté' : 'local';
  $('pr-init').textContent = nom.slice(0, 1).toUpperCase();
  $('pr-init').style.color = p.couleur || coulHash(nom);
  $('pr-img').style.display = p.photo ? 'block' : 'none';
  $('pr-init').style.display = p.photo ? 'none' : 'block';
  if(p.photo) $('pr-img').src = p.photo;
  $('pr-photo').classList.toggle('a-photo', !!p.photo);

  $('pr-coul').innerHTML = COULEURS.map(c =>
    `<button data-c="${c}" style="background:${c}"
       aria-pressed="${(p.couleur || coulHash(nom)) === c}"
       aria-label="Couleur ${c}"></button>`).join('');
  $('pr-coul').querySelectorAll('button').forEach(b => b.onclick = async () => {
    monPro().couleur = b.dataset.c;
    await ecrireMem(); construireProfil();
  });

  // connecté, un seul bouton suffit ; sans compte, on montre les deux chemins
  $('pr-creer-compte').style.display = s ? 'none' : 'block';
  $('pr-connexion').textContent = s ? 'Gérer le compte' : "J'ai déjà un compte";
  $('pr-compte-note').textContent = s
    ? 'Vos performances solo sont publiées sous ce compte.'
    : EN_LIGNE()
      ? 'Sans compte, tout reste sur ce téléphone. Un compte permet de retrouver ses scores ailleurs et de rejoindre des ligues.'
      : 'Le mode en ligne n\'est pas configuré sur cette installation.';
  $('pr-ligue').style.display = S.salon ? 'block' : 'none';
  // visible uniquement pour un compte Google explicitement autorisé —
  // même liste que celle qui déverrouille l'onglet Test directement
  $('pr-test').style.display = compteTestAutorise() ? 'block' : 'none';
}

// photo : redimensionnée à 256 px avant tout envoi, synchronisée au compte
$('pr-photo').onclick = () => $('pr-fichier').click();
$('pr-fichier').onchange = async ev => {
  const f = ev.target.files && ev.target.files[0];
  if(!f) return;
  try{
    const url = await redimensionner(f, 256);
    monPro().photo = url;
    await ecrireMem(); construireProfil();
    // si un compte existe, la photo suit le pseudo vers le serveur — c'est ce
    // qui permet à la photo d'apparaître dans le panthéon d'une ligue
    const s = EN_LIGNE() ? await rafraichirSession() : null;
    if(s){ try{ await apiAuth('profils?id=eq.' + s.id,
      {method:'PATCH', body:JSON.stringify({photo:url})}); }catch(e){} }
  }catch(e){
    choisir('Image illisible', "Ce fichier n'a pas pu être lu.", [{label:'Fermer', val:true}]);
  }
  ev.target.value = '';
};
function redimensionner(fichier, taille){
  return new Promise((ok, ko) => {
    const fr = new FileReader();
    fr.onerror = ko;
    fr.onload = () => {
      const im = new Image();
      im.onerror = ko;
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = taille;
        const x = c.getContext('2d');
        // recadrage centré, sans déformer
        const m = Math.min(im.width, im.height);
        x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, taille, taille);
        ok(c.toDataURL('image/jpeg', .82));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(fichier);
  });
}
$('pr-effacer-photo').onclick = async () => {
  monPro().photo = null; await ecrireMem(); construireProfil();
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  if(s){ try{ await apiAuth('profils?id=eq.' + s.id,
    {method:'PATCH', body:JSON.stringify({photo:null})}); }catch(e){} }
};

$('pr-nom').onclick = async () => {
  const n = await demanderNom('Votre pseudo',
    'Il vous identifie dans les classements et les ligues.', []);
  if(!n) return;
  monPro().pseudo = n;
  memoriser(n);
  await ecrireMem();
  // si un compte existe, on aligne le profil distant
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  if(s){ try{ await apiAuth('profils?id=eq.' + s.id,
    {method:'PATCH', body:JSON.stringify({pseudo:n})}); }catch(e){} }
  construireProfil();
};

const gardeEnLigne = () => EN_LIGNE() ? true : (choisir('Mode en ligne indisponible',
  "Aucune clé n'est configurée sur cette installation.",
  [{label:'Fermer', val:true}]), false);
$('pr-connexion').onclick = async () => {
  if(!gardeEnLigne()) return;
  ouvrirAuth('connexion', 'profil');
};
$('pr-creer-compte').onclick = async () => {
  if(!gardeEnLigne()) return;
  ouvrirAuth('creer', 'profil');
};

/* ─── partage ─── */
function lienJeu(params){
  const base = location.origin + location.pathname;
  const q = Object.entries(params || {}).filter(([,v]) => v)
    .map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
  return base + (q ? '?' + q : '');
}
async function partager(titre, texte, url){
  try{
    if(navigator.share){ await navigator.share({title:titre, text:texte, url}); return 'partagé'; }
  }catch(e){ if(e && e.name === 'AbortError') return null; }
  try{ await navigator.clipboard.writeText(texte + ' ' + url); return 'copié'; }
  catch(e){ return url; }
}

/* ESSAI EN TEST — partage du résultat en image (point 3, non déployé à
   tout le monde : voir la visibilité de #fin-partager-img). Une image se
   partage mieux qu'un lien sur les réseaux ; elle reprend simplement ce
   que #fin affiche déjà, pas de recalcul par mode. Police système plutôt
   que celles, encodées en base64, de la feuille de style : les rendre
   disponibles à un <canvas> demanderait de les charger une seconde fois
   via la Font Loading API, superflu pour un essai. */
function enroulerTexte(ctx, texte, x, y, maxLargeur, interligne){
  const mots = String(texte || '').split(' ');
  let ligne = '', yy = y;
  for(const mot of mots){
    const essai = ligne ? ligne + ' ' + mot : mot;
    if(ligne && ctx.measureText(essai).width > maxLargeur){
      ctx.fillText(ligne, x, yy); ligne = mot; yy += interligne;
    } else ligne = essai;
  }
  if(ligne) ctx.fillText(ligne, x, yy);
  return yy;
}
async function partagerResultatImage(){
  try{
    const cv = document.createElement('canvas');
    cv.width = 720; cv.height = 1280;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0E1116'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#C9A227'; ctx.font = '700 44px sans-serif';
    ctx.fillText('KRONO', cv.width / 2, 150);
    ctx.fillStyle = '#7C8797'; ctx.font = '400 22px sans-serif';
    ctx.fillText('AU CENTIÈME', cv.width / 2, 190);
    ctx.fillStyle = '#EDE6D6'; ctx.font = '700 52px sans-serif';
    const yTitre = enroulerTexte(ctx, $('fin-titre').textContent, cv.width / 2, 600, 640, 62);
    ctx.fillStyle = '#7C8797'; ctx.font = '400 28px sans-serif';
    enroulerTexte(ctx, $('fin-resume').textContent, cv.width / 2, yTitre + 70, 640, 38);
    ctx.fillStyle = '#3D4756'; ctx.font = '400 20px sans-serif';
    ctx.fillText(new Date().toLocaleDateString('fr-FR'), cv.width / 2, 1220);

    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    if(!blob) return;
    const fichier = new File([blob], 'krono.png', {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[fichier]})){
      await navigator.share({files:[fichier], title:'Krono', text:'Mon résultat sur Krono'});
      return;
    }
    // repli : partage de fichier indisponible ici (ordinateur, navigateur
    // ancien) — l'image reste consultable et enregistrable dans un onglet
    window.open(URL.createObjectURL(blob), '_blank');
  }catch(e){ if(!e || e.name !== 'AbortError') console.warn('partage image', e); }
}
if($('fin-partager-img')) $('fin-partager-img').onclick = () => partagerResultatImage();
$('pr-inviter').onclick = async () => {
  const nom = $('pr-pseudo').textContent;
  const r = await partager('Krono',
    nom + ' t\'invite à jouer à Krono. Viens jouer avec moi !',
    lienJeu({de:nom}));
  if(r === 'copié') $('pr-part-note').textContent = 'Lien copié dans le presse-papier.';
};
$('pr-ligue').onclick = async () => {
  if(!S.salon) return;
  const nom = $('pr-pseudo').textContent;
  const r = await partager('Krono · ' + S.salon,
    nom + ' t\'invite dans sa ligue Krono. Code : ' + S.salon + '. Je te joins ma ligue !',
    lienJeu({ligue:S.salon}));
  if(r === 'copié') $('pr-part-note').textContent = 'Invitation copiée · code ' + S.salon;
};


/* ════════ COMPTE ET LIGUES · ÉCRAN DU JOUEUR ════════ */
// Le banc d'essai de l'onglet Test valide la configuration ; cet écran-ci est
// celui du joueur. Il ne montre jamais de code HTTP : chaque échec est traduit
// en une phrase et en une action possible.

let INVITATION = null;          // code reçu par lien, à rejoindre après connexion
let LG_COURANTE = null;          // ligue ouverte dans l'écran de classement
let LG_MODE = 'scoring';         // mode affiché dans son classement
let LG_DIFF = 'tout';            // difficulté affichée dans son classement
let GLOBAL_MODE = 'scoring';     // mode affiché dans le classement global
let GLOBAL_DIFF = 'tout';        // difficulté affichée dans le classement global

function messageCompte(e){
  const m = String(e && e.message || e);
  if(/hors ligne|Failed to fetch|NetworkError/i.test(m))
    return "Pas de réseau. Le jeu reste jouable, réessayez plus tard.";
  if(/429/.test(m))
    return "Trop de demandes d'affilée. Attendez une minute avant de redemander un code.";
  if(/otp_expired|403/.test(m))
    return "Ce code n'est plus valable. Demandez-en un nouveau.";
  if(/invalid|400/.test(m))
    return "Requête refusée par le serveur. Si ça persiste, un réglage côté Supabase manque probablement (voir OPERATIONS-SQL-MANUELLES.md).";
  if(/422/.test(m))
    return "Adresse refusée par le serveur. Vérifiez qu'elle est bien écrite.";
  if(/401/.test(m))
    return "Cette installation n'est pas configurée pour les comptes.";
  return "Le serveur n'a pas répondu. Réessayez dans un moment.";
}

// L'invitation à créer un compte n'apparaît jamais avant d'avoir joué : un mur
// d'inscription à l'entrée fait perdre la moitié des gens. Trois parties solo
// terminées, c'est le moment où l'on a une raison d'en vouloir un.
const PARTIES_AVANT_INVITATION = 3;
function majInvitationCompte(){
  const B = $('fin-cn');
  if(!B) return;
  const assez = ((MEM.usage && MEM.usage.parties) || 0) >= PARTIES_AVANT_INVITATION;
  B.style.display = EN_LIGNE() && !SESSION && estSolo(CFG.mode) && assez
                    && !S.abandon ? 'flex' : 'none';
}
$('fin-compte').onclick = () => ouvrirCompte();

async function ouvrirCompte(){
  montrer('compte');
  // le discours change selon l'intention, le formulaire est le même
  const creer = AUTH_INTENTION === 'creer';
  const T = $('cn-t-1'), D = $('cn-d-1');
  if(T) T.textContent = creer ? 'Créer un compte' : 'Se connecter';
  if(D) D.textContent = creer
    ? "Un identifiant unique et un mot de passe, c'est tout. Aucun e-mail n'est envoyé."
    : 'Retrouvez vos scores et vos ligues avec votre identifiant et votre mot de passe.';
  await majCompte();
}

async function majCompte(){
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  $('cn-etat').textContent = !EN_LIGNE() ? 'indisponible' : s ? 'connecté' : 'sans compte';
  $('cn-hors').style.display = s ? 'none' : 'block';
  $('cn-dans').style.display = s ? 'block' : 'none';
  if(!s) return;
  $('cn-ident-vu').textContent = emailVersIdent(s.email);
  let profilServeur = null;
  try{ profilServeur = await monProfil(); }catch(e){}
  const nomAff = (profilServeur && profilServeur.pseudo) || monPro().pseudo || 'Sans pseudo';
  $('cn-pseudo').textContent = nomAff
    + (profilServeur && profilServeur.tag ? ' #' + profilServeur.tag : '');
  if(INVITATION){
    const code = INVITATION; INVITATION = null;
    const deja = (await mesLigues().catch(() => [])).some(x => x.ligue === code);
    if(!deja && await demander('Une invitation vous attend',
        'Le lien que vous avez ouvert mène à la ligue ' + code
        + '. Voulez-vous la rejoindre ?', 'Rejoindre')){
      try{
        await apiAuth('membres', {method:'POST',
          body:JSON.stringify({ligue:code, joueur:s.id})});
      }catch(e){
        choisir('Impossible de rejoindre', messageCompte(e), [{label:'Fermer', val:true}]);
      }
    }
  }
  if(INVITATION_DUEL){
    const code = INVITATION_DUEL; INVITATION_DUEL = null;
    if(await demander('Un duel vous attend',
        'Le lien que vous avez ouvert mène à un duel Krono. Voulez-vous le rejoindre ?', 'Rejoindre'))
      await rejoindreDuelSalle(code, s);
  }
}

/* ─── connexion ─── */
$('cn-retour').onclick = () => {
  if(AUTH_RETOUR === 'ligues') return ouvrirLigues();
  if(AUTH_RETOUR === 'amis') return ouvrirAmis();
  if(AUTH_RETOUR === 'duel'){ montrer('duel'); return construireEcranDuel(); }
  construireProfil(); montrer('profil');
};
async function apresConnexion(){
  const n = await remonterScoresLocaux();
  await majCompte();
  if(INVITATION && AUTH_RETOUR === 'ligues'){
    const code = INVITATION; INVITATION = null;
    const s2 = await rafraichirSession();
    if(s2) await rejoindreLigue(code, s2);
    await ouvrirLigues();
  } else if(AUTH_RETOUR === 'ligues') await ouvrirLigues();
  else if(AUTH_RETOUR === 'amis') await ouvrirAmis();
  else if(AUTH_RETOUR === 'trophees'){ await construireTrophees(); montrer('trophees'); }
  else if(INVITATION_DUEL && AUTH_RETOUR === 'duel'){
    const code = INVITATION_DUEL; INVITATION_DUEL = null;
    const s2 = await rafraichirSession();
    if(s2) await rejoindreDuelSalle(code, s2);
  } else if(AUTH_RETOUR === 'duel'){ montrer('duel'); await construireEcranDuel(); }
  if(n) choisir('Scores retrouvés',
    n + ' partie' + (n > 1 ? 's' : '') + ' locale'
    + (n > 1 ? 's' : '') + ' rattachée' + (n > 1 ? 's' : '')
    + ' au compte.', [{label:'Parfait', val:true}]);
}

function validerChamps(){
  const ident = ($('cn-ident') || {}).value || '';
  const pass  = ($('cn-pass')  || {}).value || '';
  if(!ident.trim()){ $('cn-msg').textContent = 'Choisissez un identifiant.'; return null; }
  if(ident.trim().length < 3){ $('cn-msg').textContent = 'Au moins 3 caractères.'; return null; }
  if(pass.length < 8){ $('cn-msg').textContent = '8 caractères minimum pour le mot de passe.'; return null; }
  return {ident:ident.trim(), pass};
}

// Google exige une vraie navigation hors de l'app : la mémoire JS est perdue
// au retour. AUTH_RETOUR et une éventuelle invitation en attente sont donc
// mis de côté dans localStorage avant de partir, pour être repris au démarrage.
const CLE_REPRISE = 'krono.reprise_auth';
// Séparée de l'appel pour rester testable sans provoquer une vraie navigation.
const urlAuthGoogle = () => SUPABASE_URL
  + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(siteUrl());
$('cn-google-btn').onclick = () => {
  try{ localStorage.setItem(CLE_REPRISE,
    JSON.stringify({retour:AUTH_RETOUR, invitation:INVITATION})); }catch(e){}
  location.href = urlAuthGoogle();
};

$('cn-creer-btn').onclick = async () => {
  const v = validerChamps(); if(!v) return;
  $('cn-creer-btn').disabled = true;
  $('cn-msg').textContent = 'Création…';
  try{
    await creerCompte(v.ident, v.pass);
    $('cn-msg').textContent = '';
    await apresConnexion();
  }catch(e){
    const msg = String(e.message || e);
    if(/already registered|User already registered/i.test(msg))
      $('cn-msg').textContent = 'Cet identifiant est déjà pris. Essayez « Se connecter ».';
    else $('cn-msg').textContent = messageCompte(e);
  }
  $('cn-creer-btn').disabled = false;
};

$('cn-login-btn').onclick = async () => {
  const v = validerChamps(); if(!v) return;
  $('cn-login-btn').disabled = true;
  $('cn-msg').textContent = 'Connexion…';
  try{
    await connecterCompte(v.ident, v.pass);
    $('cn-msg').textContent = '';
    await apresConnexion();
  }catch(e){
    const msg = String(e.message || e);
    if(/Invalid login/i.test(msg))
      $('cn-msg').textContent = 'Identifiant ou mot de passe incorrect.';
    else $('cn-msg').textContent = messageCompte(e);
  }
  $('cn-login-btn').disabled = false;
};
$('cn-sortir').onclick = async () => {
  if(!await demander('Se déconnecter ?',
    'Vos scores restent sur le serveur et sur ce téléphone. '
    + 'Il suffira de votre identifiant et mot de passe pour revenir.', 'Se déconnecter')) return;
  ecrireSession(null);
  await majCompte();
};
$('cn-nom').onclick = async () => {
  const nom = await demanderNom('Votre pseudo',
    'Il vous identifie dans toutes vos ligues.', []);
  if(!nom) return;
  monPro().pseudo = nom; memoriser(nom); await ecrireMem();
  try{
    const s = await rafraichirSession();
    if(s) await apiAuth('profils?id=eq.' + s.id,
      {method:'PATCH', body:JSON.stringify({pseudo:nom})});
  }catch(e){}
  await majCompte();
};
$('cn-supprimer').onclick = async () => {
  if(!await demander('Supprimer le compte ?',
    'Le compte, le pseudo et toutes les performances publiées seront effacés. '
    + 'Les scores enregistrés sur ce téléphone, eux, restent.', 'Supprimer')) return;
  await choisir('À faire depuis le site',
    "La suppression définitive passe par une demande écrite : elle ne peut pas "
    + "être déclenchée depuis l'application sans risque d'effacement accidentel. "
    + "Écrivez à l'adresse de contact indiquée sur le site ; le compte est "
    + "supprimé sous quelques jours. En attendant, déconnectez-vous : plus rien "
    + "ne sera publié.", [{label:'Compris', val:true}]);
};

/* ─── ligues ─── */
async function creerLigue(nom, embleme){
  const s = await rafraichirSession();
  if(!s) throw new Error('Aucune session.');
  for(let essai = 0; essai < 5; essai++){
    const code = nouveauCode();
    try{
      await apiAuth('ligues', {method:'POST',
        body:JSON.stringify({code, nom, embleme:embleme || null, createur:s.id})});
      await apiAuth('membres', {method:'POST',
        body:JSON.stringify({ligue:code, joueur:s.id})});
      return code;
    }catch(e){
      if(!/409|duplicate/i.test(String(e.message))) throw e;
    }
  }
  throw new Error('impossible de générer un code');
}

/* ════════ MES LIGUES · ÉCRAN À ONGLET ════════ */
// Le blason d'une ligue est déterministe : même code, même emblème et même
// couleur sur tous les téléphones, sans rien téléverser. Le créateur peut le
// changer ; le choix est stocké dans la colonne « embleme » de la table.
const EMBLEMES = ['🏆','⚡','🔥','🎯','⏱','🐐','🦊','🐺','🦅','🦁','🐉','🦈',
                  '🌊','🌋','❄️','🌙','⭐','💎','🎲','🃏','👑','🛡','⚔️','🚀'];
const emblemeDe = l => (l && l.embleme) || EMBLEMES[hachage(l && l.code || '') % EMBLEMES.length];
function hachage(s){
  let x = 0;
  for(const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return x;
}
const coulLigue = code => coul(hachage(code) % 8);
function blasonHTML(l, cls){
  const c = coulLigue(l && l.code || '');
  return `<span class="blason ${cls || ''}" style="color:${c};background:${c}1E">`
       + esc(emblemeDe(l)) + '</span>';
}

// Les deux chemins d'entrée, partagés par l'écran Ligues et l'écran Profil.
// « creer » et « connexion » mènent au même formulaire : techniquement, un code
// à six chiffres crée le compte s'il n'existe pas. Seul le discours change, et
// c'est ce qui rassure quelqu'un qui n'a jamais eu de compte.
function ouvrirAuth(intention, retour){
  AUTH_INTENTION = intention === 'creer' ? 'creer' : 'connexion';
  AUTH_RETOUR = retour || 'profil';
  ouvrirCompte();
}
let AUTH_INTENTION = 'connexion';
let AUTH_RETOUR = 'profil';

async function ouvrirLigues(){
  montrer('ligues');
  await majLigues();
}

/* ─── classement global ─────────────────────────────────────────────
   Même principe qu'une ligue (meilleur score par compte, un mode à la
   fois), mais sans notion d'adhésion : tous les comptes y figurent
   d'office. Contrairement au classement de ligue — qui télécharge les
   perfs des quelques membres puis réduit côté client — l'agrégation se
   fait ici côté base (fonction classement_global), le nombre de
   comptes n'étant pas borné. */
async function ouvrirGlobal(){
  $('seg-clg').innerHTML = modesLigue().map(id => {
    const m = SOLOS.find(s => s.id === id) || {n:id};
    return `<button data-v="${id}" aria-pressed="${id === GLOBAL_MODE}">${esc(m.n)}</button>`;
  }).join('');
  $('seg-clg').querySelectorAll('button').forEach(b => b.onclick = () => {
    GLOBAL_MODE = b.dataset.v;
    $('seg-clg').querySelectorAll('button').forEach(x =>
      x.setAttribute('aria-pressed', x === b));
    chargerClassementGlobal();
  });
  $('seg-clg-diff').querySelectorAll('button').forEach(b => b.onclick = () => {
    GLOBAL_DIFF = b.dataset.v;
    $('seg-clg-diff').querySelectorAll('button').forEach(x =>
      x.setAttribute('aria-pressed', x === b));
    chargerClassementGlobal();
  });
  montrer('classement-global');
  await chargerClassementGlobal();
}
/* état vide/erreur, réutilisé par le classement de ligue et le classement
   global : une carte plutôt qu'une ligne de texte perdue dans le vide. */
function carteVide(icone, texte, reessayer){
  return `<div class="cl-vide">
    <div class="ic">${icone}</div>
    <div class="tt">${esc(texte)}</div>
    ${reessayer ? '<button class="bouton fantome bt" id="cl-vide-retry">Réessayer</button>' : ''}
  </div>`;
}
async function chargerClassementGlobal(){
  const C = $('clg-classement');
  C.innerHTML = '';
  $('clg-note').textContent = 'Chargement…';
  try{
    const s = await rafraichirSession();
    // p_diff n'est envoyé que si un filtre est choisi, pour rester
    // compatible avec un appel sans filtre (paramètre par défaut NULL).
    const params = 'p_mode=' + GLOBAL_MODE + '&p_limite=40'
      + (GLOBAL_DIFF !== 'tout' ? '&p_diff=' + GLOBAL_DIFF : '');
    const rangs = await apiAuth('rpc/classement_global?' + params) || [];
    const mode = SOLOS.find(x => x.id === GLOBAL_MODE) || {n:GLOBAL_MODE};
    $('clg-note').textContent = !rangs.length
      ? mode.n + ' · personne n\'a encore publié de score sur ce mode.'
      : mode.n + ' · meilleure partie de chacun · ' + rangs.length
        + ' compte' + (rangs.length > 1 ? 's' : '') + (rangs.length >= 40 ? ' (les 40 premiers)' : '');
    if(!rangs.length){
      C.innerHTML = carteVide('🌍', 'Personne n\'a encore publié de score sur ' + mode.n + '.');
      return;
    }
    C.innerHTML = rangs.map((r, i) => {
      const prec = r.tours ? fmt(Math.round(r.somme / r.tours)) : null;
      const st = r.parties + ' partie' + (r.parties > 1 ? 's' : '')
        + (prec ? ' · précision ± ' + prec : '');
      const coul = coulHash(r.pseudo || '?');
      const av = r.photo ? `<img src="${r.photo}">`
        : `<span style="color:${coul}">${esc((r.pseudo || '?')[0].toUpperCase())}</span>`;
      const nomAff = `<span style="color:${coul}">${esc(r.pseudo || 'Sans pseudo')}</span>`
        + (r.tag ? `<span class="st" style="display:inline">#${esc(r.tag)}</span>` : '');
      return `<div class="lg-rang${s && r.joueur === s.id ? ' moi' : ''}">
        <span class="p">${i + 1}</span>
        <span class="lg-av" style="border-color:${coul}66">${av}</span>
        <span class="n">${nomAff}</span>
        <span class="s">${r.score}</span>
        <span class="st">${st}</span>
      </div>`;
    }).join('');
  }catch(e){
    $('clg-note').textContent = messageCompte(e);
    C.innerHTML = carteVide('⚠️', messageCompte(e), true);
    const r = $('cl-vide-retry');
    if(r) r.onclick = () => chargerClassementGlobal();
  }
}
$('lgs-global').onclick = () => ouvrirGlobal();
$('clg-retour').onclick = () => ouvrirLigues();

async function majLigues(){
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  $('lgs-etat').textContent = !EN_LIGNE() ? 'indisponible' : s ? 'connecté' : 'sans compte';
  $('lgs-hors').style.display = s ? 'none' : 'block';
  $('lgs-dans').style.display = s ? 'block' : 'none';
  if(!s) return;
  await listerLiguesCartes();
}

// Une carte par ligue : blason, nom, nombre de membres.
async function listerLiguesCartes(){
  const L = $('lgs-liste');
  L.innerHTML = '<div class="note">Chargement…</div>';
  let lignes = [];
  try{ lignes = await mesLigues(); }
  catch(e){
    L.innerHTML = '';
    $('lgs-note').textContent = messageCompte(e);
    return;
  }
  if(!lignes.length){
    L.innerHTML = '<div class="lg-vide">Aucune ligue pour l\'instant.<br>'
      + 'Créez-en une et donnez le code à vos amis, ou saisissez celui qu\'on '
      + 'vous a donné.</div>';
    $('lgs-note').textContent = '';
    return;
  }
  // le nombre de membres, en une seule requête pour toutes les ligues
  const codes = lignes.map(x => x.ligue);
  let effectifs = {};
  try{
    const m = await apiAuth('membres?ligue=in.(' + codes.join(',') + ')&select=ligue') || [];
    m.forEach(x => effectifs[x.ligue] = (effectifs[x.ligue] || 0) + 1);
  }catch(e){ /* sans le compte exact, on affiche la ligue quand même */ }
  $('lgs-note').textContent = lignes.length + ' ligue'
    + (lignes.length > 1 ? 's' : '') + ' · chaque partie solo terminée '
    + (lignes.length > 1 ? 'les' : 'l\'') + 'alimente.';
  L.innerHTML = lignes.map(x => {
    const l = {code:x.ligue, nom:(x.ligues && x.ligues.nom) || x.ligue,
               embleme:x.ligues && x.ligues.embleme};
    const nb = effectifs[x.ligue];
    return `<button class="lg-carte" data-code="${esc(x.ligue)}">
      ${blasonHTML(l)}
      <span class="info"><span class="nm">${esc(l.nom)}</span>
      <span class="mb">${nb ? nb + ' membre' + (nb > 1 ? 's' : '') : '—'} · ${esc(x.ligue)}</span></span>
      <span class="fl">›</span></button>`;
  }).join('');
  L.querySelectorAll('.lg-carte').forEach(d => d.onclick = () => {
    const x = lignes.find(y => y.ligue === d.dataset.code);
    ouvrirLigue(d.dataset.code, (x && x.ligues && x.ligues.nom) || d.dataset.code,
                x && x.ligues && x.ligues.embleme);
  });
}

/* ─── créer une ligue : nom, puis blason, puis le code ─── */
async function parcoursCreerLigue(){
  const nom = await demanderNom('Nom de la ligue',
    'Le nom que verront vos amis. « Les collègues », « la coloc »…', []);
  if(!nom) return;
  const embleme = await choisirEmbleme(nom);
  if(embleme === null) return;          // annulé
  try{
    const code = await creerLigue(nom, embleme);
    await majLigues();
    const r = await choisir('Ligue créée · ' + code,
      'Donnez ce code à vos amis. Ils le saisissent une fois dans « Rejoindre '
      + 'avec un code » et vos parties solo alimentent le même classement.',
      [{label:'Partager le code', val:'part'}, {label:'Plus tard', val:'non'}]);
    if(r === 'part') await partager('Krono · ' + nom,
      'Rejoins ma ligue Krono « ' + nom + ' ». Code : ' + code + '.',
      lienJeu({ligue:code}));
  }catch(e){
    choisir('Création impossible', messageCompte(e), [{label:'Fermer', val:true}]);
  }
}

// Petite modale de choix du blason, montée sur la modale générique.
function choisirEmbleme(nom){
  return new Promise(res => {
    const M = $('modale'), ouvertA = performance.now();
    $('mod-titre').textContent = 'Blason de la ligue';
    $('mod-sous').textContent = 'Il identifie « ' + nom + ' » dans votre liste.';
    $('mod-champ').parentElement.style.display = 'none';
    $('mod-noms').innerHTML = '';
    const b = $('mod-b');
    let choix = EMBLEMES[0];
    b.innerHTML = `<div class="embl-grille" id="embl-g"></div>`;
    const G = $('embl-g');
    G.innerHTML = EMBLEMES.map((e, i) =>
      `<button data-e="${e}" aria-pressed="${i === 0}">${e}</button>`).join('');
    G.querySelectorAll('button').forEach(x => x.onclick = () => {
      choix = x.dataset.e;
      G.querySelectorAll('button').forEach(y =>
        y.setAttribute('aria-pressed', y === x));
    });
    const fin = v => { M.classList.remove('on'); $('mod-champ').parentElement.style.display = '';
                       b.innerHTML = ''; res(v); };
    const ok = document.createElement('button');
    ok.className = 'bouton'; ok.textContent = 'Poursuivre';
    ok.style.marginTop = '12px';
    ok.onclick = () => fin(choix);
    b.appendChild(ok);
    const annuler = document.createElement('button');
    annuler.className = 'bouton fantome'; annuler.textContent = 'Annuler';
    annuler.style.marginTop = '8px';
    annuler.onclick = () => fin(null);
    b.appendChild(annuler);
    M.classList.add('on');
    M.onclick = ev => {
      if(ev.target !== M) return;
      if(performance.now() - ouvertA < 260) return;
      fin(null);
    };
  });
}

/* ─── rejoindre : le code d'abord, le compte ensuite si besoin ─── */
async function parcoursRejoindreLigue(){
  const code = (await demanderNom('Rejoindre une ligue',
    'Saisissez le code à cinq lettres qu\'on vous a donné.', [], true) || '')
    .toUpperCase().trim();
  if(!code) return;
  if(!/^[A-Z]{5}$/.test(code))
    return choisir('Code invalide', 'Un code de ligue fait cinq lettres.',
      [{label:'Fermer', val:true}]);
  // pas de compte : on garde le code sous le coude et on propose les deux chemins
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  if(!s){
    INVITATION = code;
    const r = await choisir('Un compte est nécessaire',
      'Une ligue compare vos scores avec ceux de vos amis : il faut un compte '
      + 'pour qu\'ils vous suivent. Le code ' + code + ' est gardé, vous '
      + 'rejoindrez la ligue juste après.',
      [{label:'Créer un compte', val:'creer'},
       {label:"J'ai déjà un compte", val:'connexion'},
       {label:'Plus tard', val:null}]);
    if(r) ouvrirAuth(r, 'ligues');
    return;
  }
  await rejoindreLigue(code, s);
}

async function rejoindreLigue(code, s){
  try{
    const r = await apiAuth('ligues?code=eq.' + code + '&select=code,nom,embleme');
    if(!r || !r.length)
      return choisir('Ligue introuvable',
        'Aucune ligue ne porte ce code. Vérifiez la saisie.',
        [{label:'Fermer', val:true}]);
    try{
      await apiAuth('membres', {method:'POST',
        body:JSON.stringify({ligue:code, joueur:s.id})});
    }catch(e){ if(!/409|duplicate/i.test(String(e.message))) throw e; }
    await majLigues();
    choisir('Bienvenue', 'Vous êtes dans « ' + (r[0].nom || code)
      + ' ». Vos parties solo l\'alimentent à partir de maintenant.',
      [{label:'Parfait', val:true}]);
  }catch(e){
    choisir('Impossible de rejoindre', messageCompte(e), [{label:'Fermer', val:true}]);
  }
}

/* ─── classement d'une ligue ─── */
// Tous les modes solo qui publient un score. Le laboratoire et l'Aventure ont
// leurs propres économies de points, hors classement — sauf un mode « labo »
// qui aurait été promu au menu principal (Cascade, depuis la v64) : il reste
// alors dans le classement, puisque les joueurs le pratiquent normalement.
// En fonction plutôt qu'en const : SOLO_MENU est déclarée plus loin dans ce
// fichier, l'appeler ici avant son initialisation ferait planter le script.
const modesLigue = () => SOLOS
  .filter(s => (!s.labo || SOLO_MENU.includes(s.id))
            && s.id !== 'aventure' && s.id !== 'defi'
            && s.id !== 'combat' && !s.desactive
            // Solo classique (et les autres modes redescendus en essai)
            // ne s'affichent plus ici : Scoring l'a remplacé, garder les
            // deux ferait doublon dans le sélecteur.
            && !ESSAIS.includes(s.id))
  .map(s => s.id);

async function ouvrirLigue(code, nom, embleme){
  LG_COURANTE = {code, nom, embleme, createur:null, moi:null};
  $('lg-titre').textContent = 'LIGUE';
  $('lg-code').textContent = code;
  $('lg-nom').textContent = nom || code;
  $('lg-blason').textContent = emblemeDe({code, embleme});
  const c = coulLigue(code);
  $('lg-blason').style.color = c;
  $('lg-blason').style.background = c + '1E';
  $('lg-sous').textContent = 'code ' + code;
  $('lg-renommer').style.display = 'none';
  // l'effectif, affiché sous le nom
  apiAuth('membres?ligue=eq.' + code + '&select=joueur').then(m => {
    if(!m || LG_COURANTE.code !== code) return;
    $('lg-sous').textContent = m.length + ' membre' + (m.length > 1 ? 's' : '')
      + ' · code ' + code;
  }).catch(() => {});
  // seul le créateur voit le bouton de renommage
  try{
    const s = await rafraichirSession();
    const r = await apiAuth('ligues?code=eq.' + code + '&select=createur');
    LG_COURANTE.moi = s && s.id;
    LG_COURANTE.createur = r && r[0] && r[0].createur;
    if(s && r && r[0] && r[0].createur === s.id){
      $('lg-renommer').style.display = 'block';
      $('lg-supprimer').style.display = 'block';
    }
  }catch(e){ /* sans réseau, pas de renommage : le reste marche */ }
  $('seg-lg').innerHTML = modesLigue().map(id => {
    const m = SOLOS.find(s => s.id === id) || {n:id};
    return `<button data-v="${id}" aria-pressed="${id === LG_MODE}">${esc(m.n)}</button>`;
  }).join('');
  $('seg-lg').querySelectorAll('button').forEach(b => b.onclick = () => {
    LG_MODE = b.dataset.v;
    $('seg-lg').querySelectorAll('button').forEach(x =>
      x.setAttribute('aria-pressed', x === b));
    chargerClassement();
  });
  $('seg-lg-diff').querySelectorAll('button').forEach(b => b.onclick = () => {
    LG_DIFF = b.dataset.v;
    $('seg-lg-diff').querySelectorAll('button').forEach(x =>
      x.setAttribute('aria-pressed', x === b));
    chargerClassement();
  });
  montrer('ligue');
  await chargerClassement();
}

async function chargerClassement(){
  const C = $('lg-classement');
  C.innerHTML = '';
  $('lg-note').textContent = 'Chargement…';
  try{
    const s = await rafraichirSession();
    const membres = await apiAuth('membres?ligue=eq.' + LG_COURANTE.code
      + '&select=joueur,profils(pseudo,photo,tag)') || [];
    if(!membres.length){
      $('lg-note').textContent = 'Personne dans cette ligue pour le moment.';
      C.innerHTML = carteVide('👥', 'Invitez des joueurs pour lancer le classement de cette ligue.');
      return;
    }
    const ids = membres.map(m => m.joueur);
    let perfs = await apiAuth('perfs?mode=eq.' + LG_MODE
      + '&joueur=in.(' + ids.join(',') + ')&select=joueur,score,tours,somme,config') || [];
    // filtre Simple/Hard : la difficulté est le 2e segment de config
    // ("aff·diff·…"), sur le même principe que le Panthéon local
    if(LG_DIFF !== 'tout')
      perfs = perfs.filter(p => (p.config || '').split('·')[1] === LG_DIFF);
    // meilleur score par joueur, et non moyenne : une ligue se gagne sur un coup
    const par = {};
    perfs.forEach(p => {
      const e = par[p.joueur] = par[p.joueur] || {score:0, parties:0, somme:0, tours:0};
      e.score = Math.max(e.score, p.score || 0);
      e.parties++; e.somme += (p.somme || 0); e.tours += (p.tours || 0);
    });
    const rangs = membres.map(m => ({
      id:m.joueur,
      nom:(m.profils && m.profils.pseudo) || 'Sans pseudo',
      tag:m.profils && m.profils.tag,
      photo:m.profils && m.profils.photo,
      ...(par[m.joueur] || {score:0, parties:0, somme:0, tours:0})
    })).sort((a, b) => b.score - a.score);
    const mode = SOLOS.find(x => x.id === LG_MODE) || {n:LG_MODE};
    const joues = rangs.filter(r => r.parties).length;
    $('lg-note').textContent = mode.n + ' · meilleure partie de chacun · '
      + joues + ' membre' + (joues > 1 ? 's' : '') + ' sur ' + rangs.length
      + ' ' + (joues > 1 ? 'ont' : 'a') + ' joué ce mode.';
    // sous chaque nom, ce qui explique le score : combien de parties, quelle
    // précision moyenne. Un classement sans ça ne dit pas qui progresse.
    C.innerHTML = rangs.map((r, i) => {
      const prec = r.tours ? fmt(Math.round(r.somme / r.tours)) : null;
      const st = r.parties
        ? r.parties + ' partie' + (r.parties > 1 ? 's' : '')
          + (prec ? ' · précision ± ' + prec : '')
        : "n'a pas encore joué ce mode";
      const coul = coulHash(r.nom || '?');
      const av = r.photo ? `<img src="${r.photo}">`
        : `<span style="color:${coul}">${esc((r.nom || '?')[0].toUpperCase())}</span>`;
      const nomAff = `<span style="color:${coul}">${esc(r.nom)}</span>`
        + (r.tag ? `<span class="st" style="display:inline">#${esc(r.tag)}</span>` : '');
      const moi = s && r.id === s.id;
      return `<div class="lg-rang${moi ? ' moi' : ' cliquable'}">
        <span class="p">${r.parties ? i + 1 : '—'}</span>
        <span class="lg-av" style="border-color:${coul}66">${av}</span>
        <span class="n">${nomAff}</span>
        <span class="s">${r.parties ? r.score : '·'}</span>
        <span class="st">${st}</span>
      </div>`;
    }).join('');
    // fiche comparée : jamais sur sa propre ligne, inutile de se comparer à
    // soi-même (voir #profil-vs, partagé avec l'onglet Amis)
    [...C.children].forEach((el, i) => {
      const r = rangs[i];
      if(s && r.id === s.id) return;
      el.onclick = () => ouvrirProfilVs({id:r.id, pseudo:r.nom, tag:r.tag, photo:r.photo}, 'ligue');
    });
  }catch(e){
    $('lg-note').textContent = messageCompte(e);
    C.innerHTML = carteVide('⚠️', messageCompte(e), true);
    const r = $('cl-vide-retry');
    if(r) r.onclick = () => chargerClassement();
  }
}

$('lg-retour').onclick = () => ouvrirLigues();
$('cn-ligues-aller').onclick  = () => ouvrirLigues();
$('lgs-creer').onclick        = () => parcoursCreerLigue();
$('lgs-rejoindre').onclick    = () => parcoursRejoindreLigue();
$('lgs-creer-compte').onclick = () => ouvrirAuth('creer', 'ligues');
$('lgs-connexion').onclick    = () => ouvrirAuth('connexion', 'ligues');

// la barre du bas
$('bb-jouer').onclick  = () => { construireModes(); montrer('reglages'); };
$('bb-ligues').onclick = () => ouvrirLigues();
$('bb-panth').onclick  = () => ouvrirPantheon();
$('bb-trophees').onclick = () => { construireTrophees(); montrer('trophees'); };
$('tr-creer-compte').onclick = () => ouvrirAuth('creer', 'trophees');
$('tr-connexion').onclick    = () => ouvrirAuth('connexion', 'trophees');
$('bb-profil').onclick = () => { construireProfil(); montrer('profil'); };

$('lg-renommer').onclick = async () => {
  if(!LG_COURANTE) return;
  const nom = await demanderNom('Nouveau nom de la ligue',
    'Il remplacera « ' + LG_COURANTE.nom + ' » pour tous les membres.', []);
  if(!nom || nom === LG_COURANTE.nom) return;
  try{
    await apiAuth('ligues?code=eq.' + LG_COURANTE.code,
      {method:'PATCH', body:JSON.stringify({nom})});
    LG_COURANTE.nom = nom;
    $('lg-titre').textContent = nom.toUpperCase().slice(0, 14);
    $('lg-note').textContent = 'Ligue renommée · « ' + nom + ' »';
  }catch(e){
    // 403/404 : le plus souvent la règle serveur n'autorise pas encore l'UPDATE
    choisir('Renommage impossible', messageCompte(e)
      + ' (le renommage exige une règle serveur autorisant le créateur à modifier la ligue).',
      [{label:'Fermer', val:true}]);
  }
};
$('lg-partager').onclick = async () => {
  if(!LG_COURANTE) return;
  const r = await partager('Krono · ' + LG_COURANTE.nom,
    'Rejoins ma ligue Krono « ' + LG_COURANTE.nom + ' ». Code : '
    + LG_COURANTE.code + '.', lienJeu({ligue:LG_COURANTE.code}));
  if(r === 'copié') $('lg-note').textContent = 'Invitation copiée · code '
    + LG_COURANTE.code;
};
$('lg-supprimer').onclick = async () => {
  if(!LG_COURANTE) return;
  if(!await demander('Supprimer « ' + LG_COURANTE.nom + ' » ?',
    'Définitif : la ligue disparaît pour tous ses membres, avec son classement. '
    + 'Leurs parties solo restent sur leur compte, seule la ligue est effacée.',
    'Supprimer')) return;
  try{
    await apiAuth('ligues?code=eq.' + LG_COURANTE.code, {method:'DELETE'});
    await ouvrirLigues();
  }catch(e){
    choisir('Suppression impossible', messageCompte(e), [{label:'Fermer', val:true}]);
  }
};
$('lg-quitter').onclick = async () => {
  if(!LG_COURANTE) return;
  if(!await demander('Quitter « ' + LG_COURANTE.nom + ' » ?',
    'Vos parties passées restent au classement des autres ligues. '
    + 'Vous pourrez revenir avec le même code.', 'Quitter')) return;
  try{
    const s = await rafraichirSession();
    await apiAuth('membres?ligue=eq.' + LG_COURANTE.code + '&joueur=eq.' + s.id,
      {method:'DELETE'});
  }catch(e){}
  await ouvrirLigues();
};

// à la première connexion, ce qui a été joué avant remonte d'un coup
async function remonterScoresLocaux(){
  const s = await rafraichirSession();
  if(!s) return 0;
  const L = (MEM.scores || []).filter(x => !x.remonte);
  if(!L.length) return 0;
  let n = 0;
  for(const x of L){
    try{
      await apiAuth('perfs', {method:'POST', body:JSON.stringify({
        joueur:s.id, mode:x.bareme || 'solo',
        config:(x.aff || '') + '·' + (x.diff || ''), score:x.p || 0,
        tours:x.tours || 0,
        // l'écart cumulé n'est pas stocké tel quel : on le reconstruit
        somme:Math.round((x.prec || 0) * (x.tours || 0)),
        biais:0, carres:0, piles:0})});
      x.remonte = true; n++;
    }catch(e){ break; }   // inutile d'insister si le serveur refuse
  }
  await ecrireMem();
  return n;
}

// un lien d'invitation pré-remplit le salon (et, séparément, un duel)
function lireInvitation(){
  const q = new URLSearchParams(location.search);
  const l = (q.get('ligue') || '').toUpperCase();
  if(/^[A-Z]{5}$/.test(l)) INVITATION = l;
  const d = (q.get('duel') || '').toUpperCase();
  if(/^[A-Z]{5}$/.test(d)) INVITATION_DUEL = d;
  if(/^[A-Z]{5}$/.test(l) && !S.salon){
    S.salon = l; MEM.salon = l; ecrireMem(); majEtatSalon();
    return l;
  }
  return null;
}

/* ════════ DUEL À DISTANCE ════════
   Deux comptes, un code de salle à cinq lettres — même alphabet, même geste
   de partage que les ligues (lienJeu/partager). La précision ne doit jamais
   dépendre du réseau : chaque manche se joue en LOCAL sur chaque téléphone,
   exactement comme en solo (tempsEvt gère déjà la compensation de latence),
   et seul l'écart obtenu transite. Le réseau ne sert qu'à mettre les deux
   joueurs d'accord sur la cible et à comparer les écarts une fois les deux
   tours joués — un sondage toutes les 1,2 s pendant que l'écran est ouvert,
   à l'image de ce que fait déjà majEtatSalon, rien de plus.

   « duels » porte l'état vivant de la salle pendant la partie, et devient
   l'historique dès que statut passe à 'termine' : pas besoin d'une table
   séparée pour « qui a gagné les derniers duels contre X », une lecture
   filtrée sur cette même table suffit. duel_manches n'est qu'une boîte aux
   lettres, une ligne par joueur et par manche, jamais modifiée après coup. */
let INVITATION_DUEL = null;      // code de duel reçu par lien, avant connexion
const MANCHES_DUEL = [3, 5, 7];
const DUEL = {
  code:null, moi:null, hote:false, poll:null,
  vue:null,            // dernière vue affichée, pour ne pas interrompre un tour en cours
  manche:0,            // dernière manche dont j'ai déjà envoyé mon écart
  traitee:0,           // dernière manche dont l'hôte a déjà compté le résultat
  demarrage:false,     // garde-fou : la manche 1 n'est lancée qu'une fois par l'hôte
  enJeu:false, t0:undefined
};
const monPseudo = () => monPro().pseudo || (MEM.joueurs && MEM.joueurs[0]) || 'Invité';
const nouvelleCibleDuel = () => (Math.floor(Math.random() * 10) + 1) * 100;

function ouvrirDuel(){ montrer('duel'); construireEcranDuel(); }

async function construireEcranDuel(){
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  $('duel-connexion').style.display = s ? 'none' : 'block';
  if(!s){ $('duel-accueil').style.display = 'none'; $('duel-salle').style.display = 'none'; return; }
  // reprise silencieuse : un duel laissé en cours (navigation, actualisation)
  if(!DUEL.code && MEM.duel && MEM.duel.code){
    DUEL.code = MEM.duel.code; DUEL.hote = MEM.duel.hote; DUEL.moi = s.id;
    DUEL.manche = 0; DUEL.traitee = 0; DUEL.demarrage = true; DUEL.vue = null;
  }
  $('duel-accueil').style.display = DUEL.code ? 'none' : 'block';
  $('duel-salle').style.display = DUEL.code ? 'block' : 'none';
  if(DUEL.code) demarrerSondageDuel();
  else await chargerDefisDuel(s.id);
}

// vers duo-joueurs, pas duo-mode : le Duel peut désormais s'ouvrir directement
// depuis là (voir #duoj-distance) sans être passé par le choix du jeu local,
// donc c'est le seul retour valable dans tous les cas
$('duel-retour').onclick = () => { arreterSondageDuel(); montrer('duo-joueurs'); };
$('duel-connexion-creer').onclick    = () => ouvrirAuth('creer', 'duel');
$('duel-connexion-existant').onclick = () => ouvrirAuth('connexion', 'duel');
$('duel-defier').onclick = () => parcoursDefierQuelquun();
$('duel-rejoindre-btn').onclick = () => parcoursRejoindreDuel();
$('duel-historique-btn').onclick = () => { construireHistoriqueDuels(); montrer('duel-historique'); };
$('duelh-retour').onclick = () => montrer('duel');
$('duel-abandonner').onclick = async () => {
  if(await demander('Abandonner ce duel ?', 'La partie s\'arrête pour les deux joueurs.', 'Abandonner'))
    abandonnerDuel();
};

async function parcoursDefierQuelquun(){
  const r = await choisir('Combien de manches ?',
    'La partie se joue en manches fixes — la plus proche de la cible en gagne une.',
    MANCHES_DUEL.map(n => ({label:n + ' manches', val:n})));
  if(!r) return;
  try{ await creerDuelSalle(r); }
  catch(e){ choisir('Création impossible', messageCompte(e), [{label:'Fermer', val:true}]); }
}
// même parcours, mais l'adversaire est déjà connu (fiche d'un ami ou d'un
// membre de ligue) : voir #profil-vs et le paramètre `cible` de creerDuelSalle
async function parcoursDefierAmi(cible){
  const r = await choisir('Combien de manches ?',
    'La partie se joue en manches fixes — la plus proche de la cible en gagne une.',
    MANCHES_DUEL.map(n => ({label:n + ' manches', val:n})));
  if(!r) return;
  try{ await creerDuelSalle(r, cible); montrer('duel'); }
  catch(e){ choisir('Défi impossible', messageCompte(e), [{label:'Fermer', val:true}]); }
}
// « Vos défis » sur l'accueil du Duel : les duels où l'adversaire est déjà
// connu (défi direct, pas un code à partager) et pas encore commencés —
// ceux qu'on a lancés soi-même (en attente que l'adversaire les découvre)
// et ceux qu'on nous a lancés (à découvrir, justement, faute de notification).
async function chargerDefisDuel(moi){
  const B = $('duel-defis'), L = $('duel-defis-liste');
  let lignes = [];
  try{
    lignes = await apiAuth('duels?statut=eq.attente&adversaire=not.is.null'
      + '&or=(hote.eq.' + moi + ',adversaire.eq.' + moi + ')&order=cree_le.desc&select=*') || [];
  }catch(e){ B.style.display = 'none'; return; }
  if(!lignes.length){ B.style.display = 'none'; L.innerHTML = ''; return; }
  B.style.display = 'block';
  L.innerHTML = lignes.map(d => {
    const jeSuisHote = d.hote === moi, autre = jeSuisHote ? d.adversaire_pseudo : d.hote_pseudo;
    return '<button class="nav-carte" style="margin-top:8px"><span class="ic">⚔️</span>'
      + '<span class="txt"><span class="n">' + esc(autre || '—') + '</span>'
      + '<span class="d">' + (jeSuisHote ? 'Défi envoyé · reprendre' : 'Vous a défié · jouer') + '</span></span>'
      + '<span class="fl">›</span></button>';
  }).join('');
  [...L.children].forEach((el, i) => {
    const d = lignes[i], jeSuisHote = d.hote === moi;
    el.onclick = () => {
      if(!jeSuisHote) trackEvent('duel_joined', {source:'direct'});
      demarrerDuel(d.code, jeSuisHote, moi);
    };
  });
}

// cible optionnelle {id, pseudo} : défi direct depuis la fiche d'un ami ou
// d'un membre de ligue (voir parcoursDefierAmi()) — l'adversaire est déjà
// connu à la création, la ligne n'attend donc plus qu'un partage de code.
async function creerDuelSalle(manches, cible){
  const s = await rafraichirSession();
  if(!s) throw new Error('Aucune session.');
  const pseudo = monPseudo();
  for(let essai = 0; essai < 5; essai++){
    const code = nouveauCode();
    try{
      const corps = {code, hote:s.id, hote_pseudo:pseudo, manches_visees:manches};
      if(cible){ corps.adversaire = cible.id; corps.adversaire_pseudo = cible.pseudo; }
      await apiAuth('duels', {method:'POST', body:JSON.stringify(corps)});
      trackEvent('duel_challenge_created', {source:cible ? 'direct' : 'code', manches});
      // l'adversaire n'est notifié que sur un défi direct : sur un code
      // partagé, on ne connaît encore personne à prévenir
      if(cible) notifierPush(cible.id, 'Défi reçu', pseudo + ' vous défie en duel.', './?duel=' + code);
      demarrerDuel(code, true, s.id);
      return code;
    }catch(e){
      if(!/409|duplicate/i.test(String(e.message))) throw e;   // sinon on retire un autre code
    }
  }
  throw new Error('impossible de générer un code');
}

async function parcoursRejoindreDuel(codeDepart){
  const code = (codeDepart || await demanderNom('Rejoindre un duel',
    'Saisissez le code à cinq lettres qu\'on vous a donné.', [], true) || '')
    .toUpperCase().trim();
  if(!code) return;
  if(!/^[A-Z]{5}$/.test(code))
    return choisir('Code invalide', 'Un code de duel fait cinq lettres.', [{label:'Fermer', val:true}]);
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  if(!s){
    INVITATION_DUEL = code;
    const r = await choisir('Un compte est nécessaire',
      'Un duel compare vos manches avec celles d\'un adversaire précis : il faut '
      + 'un compte pour vous reconnaître tous les deux. Le code ' + code + ' est '
      + 'gardé, vous rejoindrez le duel juste après.',
      [{label:'Créer un compte', val:'creer'},
       {label:"J'ai déjà un compte", val:'connexion'},
       {label:'Plus tard', val:null}]);
    if(r) ouvrirAuth(r, 'duel');
    return;
  }
  await rejoindreDuelSalle(code, s);
}

async function rejoindreDuelSalle(code, s){
  try{
    const r = await apiAuth('duels?code=eq.' + code + '&adversaire=is.null&statut=eq.attente',
      {method:'PATCH', body:JSON.stringify({adversaire:s.id, adversaire_pseudo:monPseudo()})});
    if(!r || !r.length){
      const existe = await apiAuth('duels?code=eq.' + code + '&select=code').catch(() => []);
      return choisir(existe && existe.length ? 'Duel déjà complet' : 'Duel introuvable',
        existe && existe.length ? 'Quelqu\'un a déjà rejoint cette salle.'
                                 : 'Aucun duel ne porte ce code. Vérifiez la saisie.',
        [{label:'Fermer', val:true}]);
    }
    trackEvent('duel_joined', {source:'code'});
    demarrerDuel(code, false, s.id);   // gère déjà la navigation et le sondage
  }catch(e){
    choisir('Impossible de rejoindre', messageCompte(e), [{label:'Fermer', val:true}]);
  }
}

function demarrerDuel(code, hote, moi){
  DUEL.code = code; DUEL.hote = hote; DUEL.moi = moi;
  DUEL.manche = 0; DUEL.traitee = 0; DUEL.demarrage = false; DUEL.vue = null;
  MEM.duel = {code, hote}; ecrireMem();
  montrer('duel'); $('duel-accueil').style.display = 'none'; $('duel-salle').style.display = 'block';
  demarrerSondageDuel();
}
function oublierDuel(){
  DUEL.code = null; MEM.duel = null; ecrireMem();
  $('duel-accueil').style.display = 'block'; $('duel-salle').style.display = 'none';
}

function arreterSondageDuel(){ if(DUEL.poll){ clearInterval(DUEL.poll); DUEL.poll = null; } }
function demarrerSondageDuel(){ arreterSondageDuel(); sondageDuel(); DUEL.poll = setInterval(sondageDuel, 1200); }

async function sondageDuel(){
  if(!DUEL.code) return;
  let d;
  try{ d = (await apiAuth('duels?code=eq.' + DUEL.code + '&select=*'))[0]; }
  catch(e){ return; }   // panne réseau passagère : on retentera au prochain sondage
  if(!d){ arreterSondageDuel(); return; }
  await traiterEtatDuel(d);
}

function afficherVueDuel(cle, fn){ if(DUEL.vue === cle) return; DUEL.vue = cle; fn(); }

async function traiterEtatDuel(d){
  const adversairePseudo = DUEL.hote ? d.adversaire_pseudo : d.hote_pseudo;
  majEnteteDuel(d, adversairePseudo);
  // le bouton d'abandon n'a plus de sens une fois le duel clos : seuls les
  // deux branches ci-dessous le masquent, il reste visible partout ailleurs
  $('duel-abandonner').style.display = 'block';

  if(d.statut === 'abandonne'){
    arreterSondageDuel(); MEM.duel = null; ecrireMem();
    $('duel-abandonner').style.display = 'none';
    return afficherVueDuel('abandonne', renduAbandonDuel);
  }
  if(d.statut === 'termine'){
    arreterSondageDuel(); MEM.duel = null; ecrireMem();
    $('duel-abandonner').style.display = 'none';
    return afficherVueDuel('termine', () => renduFinDuel(d));
  }
  if(d.statut === 'attente'){
    if(!d.adversaire) return afficherVueDuel('attente-adversaire', () => renduAttenteAdversaire(d));
    if(DUEL.hote && !DUEL.demarrage){ DUEL.demarrage = true; lancerManche(d, 1); }
    return afficherVueDuel('preparation', renduPreparation);
  }
  // statut === 'en_cours'
  if(DUEL.manche < d.manche_actuelle)
    return afficherVueDuel('jeu:' + d.manche_actuelle, () => renduZoneJeu(d));

  const lignes = await apiAuth('duel_manches?duel=eq.' + DUEL.code
    + '&manche=eq.' + d.manche_actuelle + '&select=joueur,ecart').catch(() => []);
  if(!lignes || lignes.length < 2)
    return afficherVueDuel('attente-manche:' + d.manche_actuelle, renduAttenteManche);

  afficherVueDuel('resultat:' + d.manche_actuelle, () => renduResultatManche(lignes));
  if(DUEL.hote && DUEL.traitee < d.manche_actuelle){
    DUEL.traitee = d.manche_actuelle;   // marqué tout de suite : un seul avancement programmé
    setTimeout(() => avancerDuel(d, lignes), 1800);
  }
}

async function lancerManche(d, n){
  try{
    await apiAuth('duels?code=eq.' + d.code, {method:'PATCH', body:JSON.stringify({
      statut:'en_cours', manche_actuelle:n, cible:nouvelleCibleDuel()})});
  }catch(e){ DUEL.demarrage = false; }   // on retentera au sondage suivant
}

async function avancerDuel(d, lignes){
  const lHote = lignes.find(l => l.joueur === d.hote), lAdv = lignes.find(l => l.joueur === d.adversaire);
  if(!lHote || !lAdv) return;
  const egalite = Math.abs(lHote.ecart) === Math.abs(lAdv.ecart);
  const hoteGagne = !egalite && Math.abs(lHote.ecart) < Math.abs(lAdv.ecart);
  const manches_j1 = d.manches_j1 + (hoteGagne ? 1 : 0);
  const manches_j2 = d.manches_j2 + (!egalite && !hoteGagne ? 1 : 0);
  const fini = d.manche_actuelle >= d.manches_visees;
  const patch = fini ? {manches_j1, manches_j2, statut:'termine'}
    : {manches_j1, manches_j2, manche_actuelle:d.manche_actuelle + 1, cible:nouvelleCibleDuel()};
  try{ await apiAuth('duels?code=eq.' + d.code, {method:'PATCH', body:JSON.stringify(patch)}); }
  catch(e){ DUEL.traitee = d.manche_actuelle - 1; }   // on retentera au prochain sondage
}

async function abandonnerDuel(){
  if(!DUEL.code) return;
  try{ await apiAuth('duels?code=eq.' + DUEL.code, {method:'PATCH', body:JSON.stringify({statut:'abandonne'})}); }
  catch(e){}
  arreterSondageDuel(); oublierDuel(); afficherVueDuel(null, () => {});
  construireEcranDuel();
}

function majEnteteDuel(d, adversairePseudo){
  const T = $('duel-titre'); if(T) T.textContent = 'Duel · ' + d.code;
  const E = $('duel-score-tete');
  if(E) E.textContent = d.adversaire
    ? (DUEL.hote ? d.manches_j1 : d.manches_j2) + ' – ' + (DUEL.hote ? d.manches_j2 : d.manches_j1)
      + '  ·  ' + (adversairePseudo || '—')
    : 'en attente d\'un adversaire…';
}
function renduAttenteAdversaire(d){
  $('duel-jeu').innerHTML =
    '<div class="duel-code">' + esc(d.code) + '</div>'
    + '<div class="note">Partagez ce code — la partie démarre dès que quelqu\'un rejoint.</div>'
    + '<div class="recap-b">'
    + '<button class="bouton fantome" id="duel-partager">Partager le lien</button></div>';
  $('duel-partager').onclick = () => partager('Krono · duel',
    monPseudo() + ' vous défie à Krono. Code : ' + d.code + '.', lienJeu({duel:d.code}));
}
function renduPreparation(){
  $('duel-jeu').innerHTML = '<div class="duel-attente">L\'adversaire est là. Ça commence…</div>';
}
function renduZoneJeu(d){
  DUEL.enJeu = false; DUEL.t0 = undefined;
  $('duel-jeu').innerHTML =
    '<div class="duel-cible">' + fmt(d.cible) + '</div>'
    + '<button class="rond vert" id="duel-tap"><span>Démarrer</span></button>';
  const b = $('duel-tap');
  let verrou = 0;   // même garde-fou que le jeu principal : 120 ms anti-rebond
  b.onpointerdown = ev => {
    ev.preventDefault();
    const t = tempsEvt(ev);
    if(t - verrou < 120) return;
    verrou = t;
    if(!DUEL.enJeu){
      DUEL.enJeu = true; DUEL.t0 = t; vibrer(10);
      b.querySelector('span').textContent = 'Stop'; b.classList.replace('vert', 'rouge');
    } else {
      const ecart = enCentiemes(t - DUEL.t0) - d.cible;
      vibrer(10); envoyerManche(d, ecart);
    }
  };
}
async function envoyerManche(d, ecart){
  DUEL.manche = d.manche_actuelle;
  try{
    await apiAuth('duel_manches', {method:'POST', body:JSON.stringify({
      duel:d.code, manche:d.manche_actuelle, joueur:DUEL.moi, ecart})});
  }catch(e){ DUEL.manche = d.manche_actuelle - 1; }   // on retentera au prochain sondage
  DUEL.vue = null; sondageDuel();
}
function renduAttenteManche(){
  $('duel-jeu').innerHTML = '<div class="duel-attente">Manche jouée · en attente de l\'adversaire…</div>';
}
function renduResultatManche(lignes){
  const mien = lignes.find(l => l.joueur === DUEL.moi), sien = lignes.find(l => l.joueur !== DUEL.moi);
  const egalite = Math.abs(mien.ecart) === Math.abs(sien.ecart);
  const jGagne = !egalite && Math.abs(mien.ecart) < Math.abs(sien.ecart);
  $('duel-jeu').innerHTML =
    '<div class="duel-verdict ' + (egalite ? '' : (jGagne ? 't-vert' : 't-signal')) + '">'
    + (egalite ? 'Égalité' : (jGagne ? 'Manche gagnée' : 'Manche perdue')) + '</div>'
    + '<div class="duel-compare">'
    + '<div><b>Vous</b><span>' + signe(mien.ecart) + fmt(Math.abs(mien.ecart)) + '</span></div>'
    + '<div><b>Adversaire</b><span>' + signe(sien.ecart) + fmt(Math.abs(sien.ecart)) + '</span></div>'
    + '</div><div class="note">La manche suivante démarre dans un instant…</div>';
}
function renduFinDuel(d){
  const mesManches = DUEL.hote ? d.manches_j1 : d.manches_j2, sesManches = DUEL.hote ? d.manches_j2 : d.manches_j1;
  const nul = mesManches === sesManches, gagne = !nul && mesManches > sesManches;
  // afficherVueDuel() ne rappelle cette fonction qu'une fois par duel (dédoublonné
  // sur DUEL.vue), pas à chaque tick de sondage — un trackEvent ici ne se répète pas
  trackEvent('duel_finished', {result: nul ? 'draw' : (gagne ? 'win' : 'lose')});
  $('duel-jeu').innerHTML =
    '<div class="duel-verdict ' + (nul ? '' : (gagne ? 't-vert' : 't-signal')) + '">'
    + (nul ? 'Match nul' : (gagne ? 'Duel gagné' : 'Duel perdu')) + '</div>'
    + '<div class="duel-score">' + mesManches + ' — ' + sesManches + '</div>'
    + '<div class="recap-b"><button class="bouton" id="duel-revanche">Revanche</button>'
    + '<button class="bouton fantome" id="duel-fin-menu">Terminer</button></div>';
  $('duel-revanche').onclick = () => { oublierDuel(); parcoursDefierQuelquun(); };
  $('duel-fin-menu').onclick = () => oublierDuel();
}
function renduAbandonDuel(){
  $('duel-jeu').innerHTML = '<div class="note">Le duel a été abandonné.</div>'
    + '<div class="recap-b"><button class="bouton fantome" id="duel-fin-menu2">Retour</button></div>';
  $('duel-fin-menu2').onclick = () => oublierDuel();
}

async function construireHistoriqueDuels(){
  const s = await rafraichirSession();
  const L = $('duelh-liste');
  if(!s){ L.innerHTML = '<div class="note">Aucun compte connecté.</div>'; return; }
  let lignes = [];
  try{
    lignes = await apiAuth('duels?statut=eq.termine&or=(hote.eq.' + s.id + ',adversaire.eq.' + s.id
      + ')&order=maj_le.desc&limit=30&select=*');
  }catch(e){ L.innerHTML = '<div class="note">' + esc(messageCompte(e)) + '</div>'; return; }
  if(!lignes.length){ L.innerHTML = '<div class="note">Aucun duel terminé pour l\'instant.</div>'; return; }
  L.innerHTML = lignes.map(d => {
    const jeSuisHote = d.hote === s.id;
    const adv = jeSuisHote ? d.adversaire_pseudo : d.hote_pseudo;
    const mes = jeSuisHote ? d.manches_j1 : d.manches_j2, ses = jeSuisHote ? d.manches_j2 : d.manches_j1;
    const nul = mes === ses, gagne = !nul && mes > ses;
    return '<div class="ligne"><span class="qui">' + esc(adv || '—') + '</span>'
      + '<span class="moy ' + (nul ? '' : (gagne ? 't-vert' : 't-signal')) + '">'
      + mes + ' – ' + ses + '</span></div>';
  }).join('');
}

/* ════════ AMIS ════════
   Table `amis` : demandeur, destinataire, statut 'attente'|'accepte'. Pas de
   statut 'refuse' — refuser une demande ou se désamiser supprime simplement
   la ligne, la RLS l'autorise aux deux parties. profils_demandeur/
   profils_destinataire viennent de deux FK distinctes vers profils
   (fk_amis_demandeur_profils / fk_amis_destinataire_profils), d'où le hint
   après « ! » dans le select : sans lui PostgREST ne saurait pas laquelle
   des deux utiliser. Sert aussi de socle à « défier ce joueur » depuis la
   fiche d'un membre de ligue : voir #profil-vs, partagé entre Amis et Ligue.
*/
$('bb-amis').onclick = () => ouvrirAmis();
async function ouvrirAmis(){ montrer('amis'); await majAmis(); }
async function majAmis(){
  const s = EN_LIGNE() ? await rafraichirSession() : null;
  $('am-etat').textContent = !EN_LIGNE() ? 'indisponible' : s ? 'connecté' : 'sans compte';
  $('am-hors').style.display = s ? 'none' : 'block';
  $('am-dans').style.display = s ? 'block' : 'none';
  $('am-recherche').style.display = 'none';
  if(!s) return;
  await chargerAmis();
}
$('am-creer-compte').onclick = () => ouvrirAuth('creer', 'amis');
$('am-connexion').onclick    = () => ouvrirAuth('connexion', 'amis');

$('am-ajouter').onclick = () => {
  const R = $('am-recherche'), ouvert = R.style.display !== 'none';
  R.style.display = ouvert ? 'none' : 'block';
  if(!ouvert){
    $('am-recherche-champ').value = ''; $('am-recherche-resultats').innerHTML = '';
    $('am-recherche-champ').focus();
  }
};
$('am-recherche-go').onclick = () => rechercherAmis();
$('am-recherche-champ').addEventListener('keydown', ev => { if(ev.key === 'Enter') rechercherAmis(); });

// une ligne « joueur » générique — résultat de recherche, demande reçue ou
// ami déjà accepté, seule la zone d'actions change d'un appel à l'autre
function ligneJoueur(p, actionsHtml, cliquable){
  const coul = coulHash(p.pseudo || '?');
  const av = p.photo ? '<img src="' + esc(p.photo) + '">'
    : '<span style="color:' + coul + '">' + esc((p.pseudo || '?')[0].toUpperCase()) + '</span>';
  const nomAff = '<span style="color:' + coul + '">' + esc(p.pseudo || 'Sans pseudo') + '</span>'
    + (p.tag ? '<span class="st" style="display:inline">#' + esc(p.tag) + '</span>' : '');
  return '<div class="lg-rang' + (cliquable ? ' cliquable' : '') + '">'
    + '<span class="lg-av" style="border-color:' + coul + '66">' + av + '</span>'
    + '<span class="n">' + nomAff + '</span>'
    + '<span class="lr-actions">' + actionsHtml + '</span></div>';
}

async function rechercherAmis(){
  const q = ($('am-recherche-champ').value || '').trim();
  const R = $('am-recherche-resultats');
  if(q.length < 2){ R.innerHTML = '<div class="note">Trois lettres minimum.</div>'; return; }
  R.innerHTML = '<div class="note">Recherche…</div>';
  try{
    const s = await rafraichirSession();
    if(!s) throw new Error('Aucune session.');
    const r = await apiAuth('profils?pseudo=ilike.*' + encodeURIComponent(q) + '*'
      + '&id=neq.' + s.id + '&select=id,pseudo,tag,photo&limit=8') || [];
    if(!r.length){ R.innerHTML = '<div class="note">Aucun pseudo ne correspond.</div>'; return; }
    R.innerHTML = r.map(p => ligneJoueur(p, '<button class="principal">Ajouter</button>', true)).join('');
    [...R.children].forEach((el, i) => {
      const p = r[i], bouton = el.querySelector('button');
      el.onclick = () => ouvrirProfilVs(p, 'amis');
      bouton.onclick = ev => { ev.stopPropagation(); envoyerDemandeAmi(p, s.id, bouton); };
    });
  }catch(e){ R.innerHTML = '<div class="note">' + esc(messageCompte(e)) + '</div>'; }
}

async function chargerAmis(){
  const s = await rafraichirSession();
  if(!s) return;
  const DB = $('am-demandes-bloc'), D = $('am-demandes'), L = $('am-liste');
  L.innerHTML = '<div class="note">Chargement…</div>';
  let rows = [];
  try{
    rows = await apiAuth('amis?or=(demandeur.eq.' + s.id + ',destinataire.eq.' + s.id + ')'
      + '&select=demandeur,destinataire,statut,'
      + 'profils_demandeur:profils!fk_amis_demandeur_profils(id,pseudo,tag,photo),'
      + 'profils_destinataire:profils!fk_amis_destinataire_profils(id,pseudo,tag,photo)') || [];
  }catch(e){
    DB.style.display = 'none';
    L.innerHTML = '<div class="note">' + esc(messageCompte(e)) + '</div>';
    return;
  }
  const recues = rows.filter(r => r.statut === 'attente' && r.destinataire === s.id);
  const acceptes = rows.filter(r => r.statut === 'accepte');

  DB.style.display = recues.length ? 'block' : 'none';
  D.innerHTML = recues.map(r => ligneJoueur(r.profils_demandeur,
    '<button class="principal">Accepter</button><button>Refuser</button>')).join('');
  [...D.children].forEach((el, i) => {
    const r = recues[i], boutons = el.querySelectorAll('button');
    boutons[0].onclick = () => accepterAmi(r.demandeur, s.id);
    boutons[1].onclick = () => refuserAmi(r.demandeur, s.id);
  });

  if(!acceptes.length){
    $('am-note').textContent = 'Aucun ami pour l\'instant.';
    L.innerHTML = '<div class="lg-vide">Ajoutez un ami par son pseudo pour comparer vos scores et le défier.</div>';
    return;
  }
  $('am-note').textContent = acceptes.length + ' ami' + (acceptes.length > 1 ? 's' : '');
  L.innerHTML = acceptes.map(r => {
    const p = r.demandeur === s.id ? r.profils_destinataire : r.profils_demandeur;
    return ligneJoueur(p, '<button>Retirer</button>', true);
  }).join('');
  [...L.children].forEach((el, i) => {
    const r = acceptes[i], p = r.demandeur === s.id ? r.profils_destinataire : r.profils_demandeur;
    el.onclick = () => ouvrirProfilVs(p, 'amis');
    el.querySelector('button').onclick = async ev => {
      ev.stopPropagation();
      if(await demander('Retirer ' + (p.pseudo || 'cet ami') + ' ?', 'Vous pourrez le rajouter plus tard.', 'Retirer'))
        supprimerAmi(r.demandeur, r.destinataire);
    };
  });
}

async function envoyerDemandeAmi(p, moi, bouton){
  try{
    await apiAuth('amis', {method:'POST', body:JSON.stringify({demandeur:moi, destinataire:p.id})});
    vibrer(10);
    trackEvent('friend_request_sent');
    notifierPush(p.id, 'Nouvelle demande d\'ami', monPseudo() + ' veut vous ajouter en ami.', './');
    if(bouton){ bouton.disabled = true; bouton.textContent = 'Envoyée'; }
    if(PROFIL_VS_CIBLE && PROFIL_VS_CIBLE.id === p.id) majBoutonAmi(p.id, moi);
  }catch(e){ choisir('Impossible d\'ajouter', messageCompte(e), [{label:'Fermer', val:true}]); }
}
async function accepterAmi(demandeurId, moi){
  try{
    await apiAuth('amis?demandeur=eq.' + demandeurId + '&destinataire=eq.' + moi,
      {method:'PATCH', body:JSON.stringify({statut:'accepte'})});
    vibrer(10);
    trackEvent('friend_request_accepted');
    notifierPush(demandeurId, 'Demande acceptée', monPseudo() + ' a accepté votre demande d\'ami.', './');
    if($('amis').classList.contains('actif')) chargerAmis();
    if(PROFIL_VS_CIBLE && PROFIL_VS_CIBLE.id === demandeurId) majBoutonAmi(demandeurId, moi);
  }catch(e){ choisir('Impossible d\'accepter', messageCompte(e), [{label:'Fermer', val:true}]); }
}
async function refuserAmi(demandeurId, moi){
  try{
    await apiAuth('amis?demandeur=eq.' + demandeurId + '&destinataire=eq.' + moi, {method:'DELETE'});
    chargerAmis();
  }catch(e){ choisir('Impossible de refuser', messageCompte(e), [{label:'Fermer', val:true}]); }
}
async function supprimerAmi(demandeurId, destinataireId){
  try{
    await apiAuth('amis?demandeur=eq.' + demandeurId + '&destinataire=eq.' + destinataireId, {method:'DELETE'});
    trackEvent('friend_removed');
    chargerAmis();
  }catch(e){ choisir('Impossible de retirer', messageCompte(e), [{label:'Fermer', val:true}]); }
}

/* ════════ CLASSEMENT ENTRE AMIS ════════
   Même principe que le classement d'une ligue (chargerClassement) — meilleur
   score par compte, un mode à la fois — mais la liste d'amis tient lieu
   d'effectif : pas de code, pas d'adhésion à gérer. Chaque ligne (hors la
   sienne) ouvre la même fiche comparée que Ligue et Amis. */
let AMC_MODE = 'scoring', AMC_DIFF = 'tout';
$('am-classement-btn').onclick = () => ouvrirClassementAmis();
$('amc-retour').onclick = () => montrer('amis');
async function ouvrirClassementAmis(){
  $('seg-amc').innerHTML = modesLigue().map(id => {
    const m = SOLOS.find(s => s.id === id) || {n:id};
    return `<button data-v="${id}" aria-pressed="${id === AMC_MODE}">${esc(m.n)}</button>`;
  }).join('');
  $('seg-amc').querySelectorAll('button').forEach(b => b.onclick = () => {
    AMC_MODE = b.dataset.v;
    $('seg-amc').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    chargerClassementAmis();
  });
  $('seg-amc-diff').querySelectorAll('button').forEach(b => b.onclick = () => {
    AMC_DIFF = b.dataset.v;
    $('seg-amc-diff').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    chargerClassementAmis();
  });
  montrer('amis-classement');
  trackEvent('friends_leaderboard_view');
  await chargerClassementAmis();
}
async function chargerClassementAmis(){
  const C = $('amc-classement');
  C.innerHTML = '';
  $('amc-note').textContent = 'Chargement…';
  try{
    const s = await rafraichirSession();
    if(!s) throw new Error('Aucune session.');
    const rows = await apiAuth('amis?statut=eq.accepte&or=(demandeur.eq.' + s.id + ',destinataire.eq.' + s.id + ')'
      + '&select=demandeur,destinataire,'
      + 'profils_demandeur:profils!fk_amis_demandeur_profils(id,pseudo,tag,photo),'
      + 'profils_destinataire:profils!fk_amis_destinataire_profils(id,pseudo,tag,photo)') || [];
    const amis = rows.map(r => r.demandeur === s.id ? r.profils_destinataire : r.profils_demandeur);
    const moi = {id:s.id, pseudo:monPseudo(), tag:null, photo:monPro().photo || null};
    const membres = [moi, ...amis];
    if(!amis.length){
      $('amc-note').textContent = 'Aucun ami pour l\'instant.';
      C.innerHTML = carteVide('👥', 'Ajoutez des amis pour lancer ce classement.');
      return;
    }
    const ids = membres.map(m => m.id);
    let perfs = await apiAuth('perfs?mode=eq.' + AMC_MODE
      + '&joueur=in.(' + ids.join(',') + ')&select=joueur,score,tours,somme,config') || [];
    if(AMC_DIFF !== 'tout')
      perfs = perfs.filter(p => (p.config || '').split('·')[1] === AMC_DIFF);
    const par = {};
    perfs.forEach(p => {
      const e = par[p.joueur] = par[p.joueur] || {score:0, parties:0, somme:0, tours:0};
      e.score = Math.max(e.score, p.score || 0);
      e.parties++; e.somme += (p.somme || 0); e.tours += (p.tours || 0);
    });
    const rangs = membres.map(m => ({
      id:m.id, nom:m.pseudo || 'Sans pseudo', tag:m.tag, photo:m.photo,
      ...(par[m.id] || {score:0, parties:0, somme:0, tours:0})
    })).sort((a, b) => b.score - a.score);
    const mode = SOLOS.find(x => x.id === AMC_MODE) || {n:AMC_MODE};
    // « joues » compte tout le monde affiché, vous compris — donc le
    // dénominateur doit être membres.length (vous + amis), pas amis.length
    // seul, sinon le compte ne correspond plus (ex. "2 sur 1")
    const joues = rangs.filter(r => r.parties).length;
    $('amc-note').textContent = mode.n + ' · meilleure partie de chacun · '
      + joues + ' membre' + (joues > 1 ? 's' : '') + ' sur ' + membres.length
      + ' ' + (joues > 1 ? 'ont' : 'a') + ' joué ce mode.';
    C.innerHTML = rangs.map((r, i) => {
      const prec = r.tours ? fmt(Math.round(r.somme / r.tours)) : null;
      const st = r.parties
        ? r.parties + ' partie' + (r.parties > 1 ? 's' : '') + (prec ? ' · précision ± ' + prec : '')
        : "n'a pas encore joué ce mode";
      const coul = coulHash(r.nom || '?');
      const av = r.photo ? `<img src="${r.photo}">`
        : `<span style="color:${coul}">${esc((r.nom || '?')[0].toUpperCase())}</span>`;
      const nomAff = `<span style="color:${coul}">${esc(r.nom)}</span>`
        + (r.tag ? `<span class="st" style="display:inline">#${esc(r.tag)}</span>` : '');
      const moiCette = r.id === s.id;
      return `<div class="lg-rang${moiCette ? ' moi' : ' cliquable'}">
        <span class="p">${r.parties ? i + 1 : '—'}</span>
        <span class="lg-av" style="border-color:${coul}66">${av}</span>
        <span class="n">${nomAff}</span>
        <span class="s">${r.parties ? r.score : '·'}</span>
        <span class="st">${st}</span>
      </div>`;
    }).join('');
    [...C.children].forEach((el, i) => {
      const r = rangs[i];
      if(r.id === s.id) return;
      el.onclick = () => ouvrirProfilVs({id:r.id, pseudo:r.nom, tag:r.tag, photo:r.photo}, 'amis-classement');
    });
  }catch(e){
    $('amc-note').textContent = messageCompte(e);
    C.innerHTML = carteVide('⚠️', messageCompte(e), true);
    const r = $('cl-vide-retry');
    if(r) r.onclick = () => chargerClassementAmis();
  }
}

/* ════════ PROFIL COMPARÉ ════════
   Un seul écran (#profil-vs) pour deux points d'entrée — une ligne de
   classement de ligue, ou un ami dans l'onglet Amis — chacun renvoyant vers
   son écran d'origine (PROFIL_VS_RETOUR) plutôt qu'un retour générique. */
let PROFIL_VS_RETOUR = 'ligue';   // où revenir : 'ligue', 'amis' ou 'amis-classement'
let PROFIL_VS_CIBLE = null;       // {id, pseudo, tag, photo} actuellement affiché

async function ouvrirProfilVs(p, retour){
  PROFIL_VS_RETOUR = retour; PROFIL_VS_CIBLE = p;
  trackEvent('player_profile_view', {source:retour});
  const coul = coulHash(p.pseudo || '?');
  $('pv-titre').textContent = (p.pseudo || 'JOUEUR').toUpperCase();
  $('pv-tag').textContent = p.tag ? '#' + p.tag : '—';
  $('pv-avatar').innerHTML = p.photo
    ? '<img src="' + esc(p.photo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : '<span style="color:' + coul + '">' + esc((p.pseudo || '?')[0].toUpperCase()) + '</span>';
  $('pv-nom').textContent = p.pseudo || 'Sans pseudo';
  $('pv-nom').style.color = coul;
  $('pv-sous').textContent = 'Comparaison des scores';
  $('pv-comparaison').innerHTML = '<div class="note">Chargement…</div>';
  $('pv-ami').style.display = 'none';
  montrer('profil-vs');
  const s = await rafraichirSession();
  if(!s) return;
  await Promise.all([majBoutonAmi(p.id, s.id), chargerComparaison(p, s.id)]);
}
$('pv-retour').onclick = () => {
  if(PROFIL_VS_RETOUR === 'amis') ouvrirAmis();
  // amis-classement et ligue gardent tous deux leur liste déjà construite :
  // un simple montrer() suffit, pas besoin de tout recharger
  else montrer(PROFIL_VS_RETOUR === 'amis-classement' ? 'amis-classement' : 'ligue');
};
$('pv-defier').onclick = () => {
  if(PROFIL_VS_CIBLE) parcoursDefierAmi({id:PROFIL_VS_CIBLE.id, pseudo:PROFIL_VS_CIBLE.pseudo});
};

async function majBoutonAmi(autreId, moi){
  const B = $('pv-ami');
  B.style.display = 'block'; B.disabled = false; B.textContent = '+ ajouter en ami';
  B.onclick = () => envoyerDemandeAmi({id:autreId, pseudo:PROFIL_VS_CIBLE && PROFIL_VS_CIBLE.pseudo}, moi, B);
  try{
    const rows = await apiAuth('amis?or=(and(demandeur.eq.' + moi + ',destinataire.eq.' + autreId
      + '),and(demandeur.eq.' + autreId + ',destinataire.eq.' + moi
      + '))&select=demandeur,destinataire,statut') || [];
    if(!rows.length) return;
    const r = rows[0], envoyeParMoi = r.demandeur === moi;
    if(r.statut === 'accepte'){ B.textContent = 'Ami'; B.disabled = true; B.onclick = null; }
    else if(envoyeParMoi){ B.textContent = 'Demande envoyée'; B.disabled = true; B.onclick = null; }
    else{ B.textContent = 'Accepter sa demande'; B.onclick = () => accepterAmi(autreId, moi); }
  }catch(e){ /* silencieux : le bouton « ajouter » par défaut reste utilisable */ }
}

async function chargerComparaison(p, moi){
  const C = $('pv-comparaison');
  try{
    const modes = modesLigue();
    const perfs = await apiAuth('perfs?joueur=in.(' + moi + ',' + p.id + ')&select=joueur,mode,score') || [];
    const meilleur = {};   // meilleur[joueur][mode] = meilleur score
    perfs.forEach(x => {
      meilleur[x.joueur] = meilleur[x.joueur] || {};
      meilleur[x.joueur][x.mode] = Math.max(meilleur[x.joueur][x.mode] || 0, x.score || 0);
    });
    const mien = meilleur[moi] || {}, sien = meilleur[p.id] || {};
    $('pv-note').textContent = 'Meilleure partie de chacun, mode par mode.';
    C.innerHTML = modes.map(id => {
      const m = SOLOS.find(x => x.id === id) || {n:id};
      const aJoue = mien[id] !== undefined, bJoue = sien[id] !== undefined;
      const a = mien[id] || 0, b = sien[id] || 0;
      const aGagne = aJoue && (!bJoue || a > b), bGagne = bJoue && (!aJoue || b > a);
      return '<div class="pv-ligne"><div class="pv-mode">' + esc(m.n) + '</div>'
        + '<div class="pv-scores">'
        + '<div class="pv-col' + (aGagne ? ' gagne' : '') + '">'
        + '<span class="pv-val">' + (aJoue ? a : '—') + '</span><span class="pv-qui">vous</span></div>'
        + '<div class="pv-col' + (bGagne ? ' gagne' : '') + '">'
        + '<span class="pv-val">' + (bJoue ? b : '—') + '</span>'
        + '<span class="pv-qui">' + esc(p.pseudo || 'lui') + '</span></div>'
        + '</div></div>';
    }).join('');
  }catch(e){
    $('pv-note').textContent = messageCompte(e);
    C.innerHTML = carteVide('⚠️', messageCompte(e), true);
    const r = $('cl-vide-retry');
    if(r) r.onclick = () => chargerComparaison(p, moi);
  }
}

/* ════════ DUO LOCAL · ÉCRAN MIROIR ════════
   Deux joueurs, un seul téléphone posé à plat sur la table : la moitié
   du HAUT est retournée à 180°, pour que le joueur assis de l'autre côté
   — au-delà du bord haut de l'appareil, tourné vers celui du bas — la
   lise à l'endroit depuis son propre siège. Celui du bas, en position de
   lecture normale, n'a besoin d'aucune rotation : c'est cette moitié-là
   qui doit rester lisible tête droite pour qui regarde le téléphone sans
   le retourner. (D'où le nom des classes, .duo-haut / .duo-bas : elles
   décrivent la position physique à l'écran, pas l'orientation du texte.)

   La sélection des deux joueurs reprend la liste du mode Soirée — puce
   colorée, ▲ pour réordonner, ▾ pour reprendre un prénom déjà utilisé —
   plutôt qu'un couple de champs isolés : rangDuo() est une copie de
   rang(), posée sur sa propre liste (#duoj-liste) et plafonnée à deux
   entrées, pour ne pas se brancher sur celle, partagée, du mode soirée.
   L'ORDRE de la liste fixe la position à l'écran : premier en haut,
   second en bas.

   Deux jeux, chacun avec son propre menu de réglages (duo-mode puis
   duo-reglages, sur le même schéma que la fiche d'un mode solo) :

   • Classique · bar — reprend Classique tel quel : UN chrono, UNE cible,
     affichés IDENTIQUES sur les deux moitiés (mirroir compris) pour que
     chacun les lise sans se pencher, mais chacun joue son tour — comme
     à une vraie table, sans avoir à faire circuler le téléphone. Barème
     de Classique (evaluerClassiqueDuo, calqué sur evaluer) : pile fait
     boire l'adversaire cul sec, un frôlé lui fait boire quelques
     gorgées, un raté vous en fait boire vous-même.
   • Duel · à l'aveugle — même cible, mais jamais affichée pendant que le
     chrono tourne (comme le mode Blind) : chaque moitié montre le
     repère « —,—— » à la place du chiffre. Contrairement à Classique,
     les deux joueurs jouent en parallèle, chacun lançant et arrêtant
     son propre chrono à son rythme ; la manche va à qui tombe le plus
     près une fois les deux arrêtés.

   Dans les deux cas, aucun réseau ne s'interpose : chaque écart est
   mesuré par l'horloge de CE téléphone. evaluerClassiqueDuo() reste
   volontairement indépendante de S/CFG (elle lit DUO.reglages, jamais
   S.zoneTour ni CFG.gor) : le Duo est un écran isolé, sans état partagé
   avec le moteur solo/soirée. */
const DUO_MODES = [
  {id:'classique', n:'Classique · bar',
   d:"Le vrai mode soirée : un chrono qui ne s'arrête jamais, la cible tombe toujours sur la seconde pleine. Chacun joue son tour ; pile fait boire l'autre (riposte possible), un raté vous fait boire.",
   regle:"Un seul chrono continu, jamais remis à zéro : chaque manche vise la prochaine seconde pleine à partir de là où il s'est arrêté la fois d'avant "
     + "— exactement comme au vrai Classique soirée, ça avance de seconde en seconde. Les joueurs jouent chacun leur tour, en alternance. Pile fait "
     + "boire l'adversaire (cul sec ou shot) — sauf s'il fait pile à son tour : le défi rebondit et double, c'est la riposte, et ça peut s'enchaîner "
     + "plusieurs fois de suite. Un frôlé (≤ 3 centièmes) fait boire l'adversaire quelques gorgées, un raté vous en fait boire vous-même. Zone sûre : "
     + "personne ne boit."},
  {id:'duel', n:"Duel · à l'aveugle",
   d:"Même cible cachée pour les deux : le chrono ne s'affiche pas pendant la manche, seul l'écart révélé à l'arrêt compte.",
   regle:"Une cible tirée au sort, jamais affichée pendant que le chrono tourne — comme le mode Blind. Chacun lance et arrête son propre chrono, "
     + "à son rythme. Qui tombe le plus près de la cible gagne la manche ; en cas d'égalité, personne ne marque."}
];
const DUO = {
  mode:'classique',
  reglages:{
    classique:{manches:20, diff:'simple', gor:'bar'},   // même défaut que le vrai Classique solo (CFG.maxTours)
    duel:{manches:5, diff:'simple'}
  },
  noms:['',''], manchesVisees:20, manche:0, scores:[0, 0],
  gorgees:[0, 0], culs:[0, 0],   // classique uniquement : cumul à boire sur toute la partie
  tourActif:0,   // classique uniquement : qui joue le tour en cours
  total:0,       // classique uniquement : référence cumulée du chrono continu (centièmes),
                 // ne repart jamais à zéro sauf reinitialiserMatchDuo() — « de seconde en seconde »
  contre:0,      // classique uniquement : culs secs en jeu si une riposte est en cours (0 = aucune)
  dernierVerdict:null,   // classique uniquement : verdict structuré de la dernière manche (voir verifierFinMancheDuo)
  cible:0, pret:[false, false], t0:[undefined, undefined],
  ecarts:[null, null], verrou:[0, 0],   // même garde-fou que le jeu principal : 120 ms anti-rebond
  phase:'attente'   // attente → jeu → resultat → (jeu…) → fin — pas de compte à rebours,
                     // le chrono part au tap du joueur actif (voir gererTapDuo)
};

// nomCulSecDuo/calcFroleDuo/culsDuo reprennent les formules réelles
// (nomCulSec, calcFrole, culs) mais paramétrées par le réglage du Duo
// plutôt que lues sur CFG.gor : changer les gorgées d'une partie de Duo ne
// doit jamais changer en douce le réglage global du joueur. gorg()/RATE
// restent réutilisés tels quels : gorg() ne dépend que de son nombre,
// RATE n'est qu'une table.
const nomCulSecDuo = gor => gor === 'bar' ? 'shot' : 'cul sec';
const calcFroleDuo = (n, gor) => gor === 'appart' ? 3 : (gor === 'gros' ? n * 2 : n);
const culsDuo = (n, gor) => gor === 'bar' ? n + (n > 1 ? ' shots' : ' shot') : n + (n > 1 ? ' culs secs' : ' cul sec');

// même trajectoire que cibleSuivante()/prochaineCible() du vrai mode
// Classique soirée : toujours la prochaine seconde pleine, avec au moins
// une demi-seconde de marge — jamais un tirage aléatoire indépendant.
function cibleSuivanteDuo(total){
  let c = (Math.floor(total / 100) + 1) * 100;
  while(c - total <= 50) c += 100;
  return c;
}

// Barème de Classique (pile, frôlé ≤ 3 centièmes, zone sûre, hors zone), lu
// sur les réglages du Duo — jamais sur S.zoneTour, qui varie tour après
// tour dans le jeu principal et n'a aucune raison de s'y appliquer. Pas de
// points : comme au vrai Classique soirée, seul compte qui boit quoi (voir
// verifierFinMancheDuo, qui gère aussi la riposte sur un pile).
function evaluerClassiqueDuo(ecart){
  const r = DUO.reglages.classique, a = Math.abs(ecart);
  if(a === 0) return {code:'pile', libelle:'Pile !', couleur:'t-s100'};
  if(a <= PRES) return {code:'frole', libelle:'Frôlé !', couleur:'t-s50',
    gorgees:calcFroleDuo(PRES + 1 - a, r.gor)};
  if(a <= (r.diff === 'hard' ? SAUF.visible.hard : SAUF.visible.simple))
    return {code:'sauf', libelle:'Zone sûre', couleur:'t-s20'};
  return {code:'rate', libelle:'Hors zone', couleur:'t-signal', gorgees:RATE[r.gor]};
}
// cible : secondes rondes en simple, décimales en hard — comme le mode Blind
const nouvelleCibleDuo = diffHard => diffHard ? (100 + Math.floor(Math.random() * 901))
                                               : (Math.floor(Math.random() * 10) + 1) * 100;

/* ─── sélection des deux joueurs : la liste du mode Soirée, dupliquée
   sur sa propre cible (#duoj-liste) et plafonnée à deux ─── */
function rangDuo(v, n){
  const d = document.createElement('div');
  d.className = 'rang';
  d.innerHTML = '<span class="puce" style="background:' + coul(n - 1) + '"></span><b>' + n + '</b>'
    + '<input maxlength="14" placeholder="Prénom" list="prenoms" autocomplete="off" autocapitalize="words">'
    + '<button class="monter" aria-label="Remonter ce joueur">▲</button>'
    + '<button class="derouler" aria-label="Choisir un prénom déjà utilisé">▾</button>'
    + '<button class="retirer" aria-label="Retirer">×</button>';
  const inp = d.querySelector('input');
  inp.value = v || ''; inp.style.color = coul(n - 1);
  d.querySelector('.monter').onclick = () => {
    const l = $('duoj-liste'), i = [...l.children].indexOf(d);
    if(i <= 0) return;
    l.insertBefore(d, l.children[i - 1]); renumeroterDuoj();
  };
  d.querySelector('.derouler').onclick = async () => {
    const autres = [...$('duoj-liste').querySelectorAll('input')].filter(x => x !== inp).map(x => x.value.trim());
    const n2 = await demanderNom('Qui joue ?',
      'Reprenez un prénom déjà utilisé, ou saisissez-en un nouveau.', autres);
    if(n2) inp.value = n2;
  };
  d.querySelector('.retirer').onclick = () => { d.remove(); renumeroterDuoj(); };
  return d;
}
function renumeroterDuoj(){
  const rangs = [...$('duoj-liste').children];
  rangs.forEach((r, i) => {
    r.querySelector('.puce').style.background = coul(i);
    r.querySelector('input').style.color = coul(i);
    r.querySelector('b').textContent = i + 1;
    r.querySelector('.monter').disabled = (i === 0);
    r.querySelector('.retirer').style.visibility = rangs.length <= 1 ? 'hidden' : 'visible';
  });
  // deux joueurs, jamais plus : Duo n'a que deux moitiés d'écran à remplir
  $('duoj-ajouter').style.display = rangs.length >= 2 ? 'none' : 'block';
}
$('duoj-ajouter').onclick = () => {
  if($('duoj-liste').children.length >= 2) return;
  $('duoj-liste').appendChild(rangDuo('', $('duoj-liste').children.length + 1));
  renumeroterDuoj();
};

function ouvrirDuo(){
  const recents = (MEM.joueurs || []).filter(Boolean);
  $('duoj-liste').innerHTML = '';
  $('duoj-liste').appendChild(rangDuo(recents[0] || '', 1));
  $('duoj-liste').appendChild(rangDuo(recents[1] || '', 2));
  renumeroterDuoj();
  montrer('duo-joueurs');
}
$('duoj-retour').onclick = () => montrer('reglages');
$('duoj-distance').onclick = () => ouvrirDuel();
$('duoj-commencer').onclick = () => {
  const noms = [...$('duoj-liste').querySelectorAll('input')].map(i => (i.value || '').trim()).filter(Boolean);
  if(noms.length < 2){
    demander('Il faut deux joueurs', 'Ajoutez un second prénom pour continuer.', 'Compris');
    return;
  }
  DUO.noms = [noms[0].slice(0, 14), noms[1].slice(0, 14)];
  construireDuoModes();
  montrer('duo-mode');
};

/* ─── choix du jeu, puis ses réglages : un vrai menu par mode, pas une
   simple modale ─── */
$('duom-retour').onclick = () => montrer('duo-joueurs');
function construireDuoModes(){
  const L = $('duom-liste'); L.innerHTML = '';
  DUO_MODES.forEach(m => {
    const d = document.createElement('div');
    d.className = 'evt choisir' + (DUO.mode === m.id ? ' actif' : '');
    d.innerHTML = '<span class="coche">choisi</span><div class="n">' + esc(m.n) + '</div>'
      + '<div class="d">' + esc(m.d) + '</div>';
    d.onclick = () => {
      DUO.mode = m.id; construireDuoReglages(); montrer('duo-reglages');
      trackEvent('duo_mode_selected', {mode:m.id});
    };
    L.appendChild(d);
  });
  // Duel à distance : déplacé ici depuis Profil, sur le même écran de choix
  // que les jeux locaux — mais mène directement au compte/duel en ligne,
  // pas à un réglage local, donc pas de "choisi" à cocher (ce n'est pas
  // une valeur de DUO.mode).
  const dist = document.createElement('div');
  dist.className = 'evt choisir';
  dist.innerHTML = '<div class="n">Duel · à distance</div>'
    + '<div class="d">Un compte de chaque côté, une manche à la fois, où que vous soyez.</div>';
  dist.onclick = () => ouvrirDuel();
  L.appendChild(dist);
}

$('duor-retour').onclick = () => { construireDuoModes(); montrer('duo-mode'); };
// Classique reprend les mêmes paliers que le vrai mode soirée (10/20/40/∞,
// voir #fi-fin) — cohérent avec un chrono qui, lui aussi, tourne désormais
// comme en soirée. Duel garde ses propres manches, plus courtes, pensées
// pour un duel rapide au bar plutôt qu'une partie complète.
const DUO_MANCHES = {classique:[10, 20, 40, 0], duel:[3, 5, 7]};
function construireDuoReglages(){
  const m = DUO_MODES.find(x => x.id === DUO.mode), r = DUO.reglages[DUO.mode];
  $('duor-titre').textContent = m.n.toUpperCase();
  $('duor-sous').textContent = DUO.noms.join(' · ');
  $('duor-regle').textContent = m.regle;
  $('duor-bloc-gor').style.display = DUO.mode === 'classique' ? 'block' : 'none';
  const majSeg = (id, val) => $(id).querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.v === String(val))));
  // reconstruit à chaque fois : les valeurs (et leurs boutons) changent avec
  // le mode, pas seulement l'état "pressed" d'un jeu de boutons fixe
  $('duor-manches').innerHTML = DUO_MANCHES[DUO.mode].map(n =>
    '<button data-v="' + n + '">' + (n === 0 ? '∞' : n + ' manches') + '</button>').join('');
  $('duor-manches').querySelectorAll('button').forEach(b => b.onclick = () => {
    DUO.reglages[DUO.mode].manches = Number(b.dataset.v); construireDuoReglages();
  });
  majSeg('duor-manches', r.manches);
  majSeg('duor-diff', r.diff);
  if(DUO.mode === 'classique') majSeg('duor-gor', r.gor);
  $('duor-note-diff').textContent = DUO.mode === 'duel'
    ? (r.diff === 'hard' ? 'Cible avec décimales, entre 1,00 et 10,00 s.' : 'Cible en secondes rondes, de 1 à 10 s.')
    : (r.diff === 'hard' ? 'Zone sûre resserrée à ± 0,20 s.' : 'Zone sûre à ± 0,35 s.');
}
$('duor-diff').querySelectorAll('button').forEach(b => b.onclick = () => {
  DUO.reglages[DUO.mode].diff = b.dataset.v; construireDuoReglages();
});
$('duor-gor').querySelectorAll('button').forEach(b => b.onclick = () => {
  DUO.reglages.classique.gor = b.dataset.v; construireDuoReglages();
});
$('duor-commencer').onclick = () => {
  DUO.manchesVisees = DUO.reglages[DUO.mode].manches;
  reinitialiserMatchDuo();
  montrer('duo');
  construireDuo();
  trackEvent('duo_match_start', {mode:DUO.mode, manches:DUO.manchesVisees});
};
// remise à zéro d'un match : au premier lancement comme à chaque revanche —
// les réglages en cours (mode compris) restent tels quels, eux
function reinitialiserMatchDuo(){
  DUO.manche = 0; DUO.scores = [0, 0]; DUO.gorgees = [0, 0]; DUO.culs = [0, 0];
  DUO.pret = [false, false]; DUO.phase = 'attente';
  DUO.total = 0; DUO.contre = 0; DUO.dernierVerdict = null;   // chrono continu et riposte repartent de zéro
}

[0, 1].forEach(i => $('duo-moitie-' + i).addEventListener('pointerdown', ev => gererTapDuo(i, ev)));
$('duo-quitter').onclick = async () => {
  if(DUO.phase === 'jeu') return;   // jamais en pleine manche
  if(await demander('Quitter le Duo ?', 'La partie en cours sera perdue.', 'Quitter'))
    montrer('reglages');
};

// Classique et Duel réagissent au tap de la même façon, à qui joue près :
// premier tap = lancer SON chrono, second = l'arrêter — jamais de départ
// automatique, exactement comme en solo (demarrer()/arreter()).
// - Classique joue à tour de rôle sur UN chrono commun : seul le tap du
//   joueur actif (DUO.tourActif) compte, à la fois pour lancer et arrêter ;
// - Duel reste indépendant et à l'aveugle : chacun lance et arrête SON
//   propre chrono, à son rythme, sans notion de tour.
function gererTapDuo(i, ev){
  const t = tempsEvt(ev);
  if(t - DUO.verrou[i] < 120) return;
  DUO.verrou[i] = t;
  if(DUO.phase === 'attente'){
    if(DUO.pret[i]) return;
    DUO.pret[i] = true; vibrer(10); renduMoitieDuo(i);
    if(DUO.pret[0] && DUO.pret[1]) lancerMancheDuo();
    return;
  }
  if(DUO.phase !== 'jeu') return;
  if(DUO.mode === 'classique'){
    if(i !== DUO.tourActif || DUO.ecarts[i] !== null) return;   // pas son tour, ou déjà joué
    if(DUO.t0[i] === undefined){   // premier tap du joueur actif : lance le chrono commun
      DUO.t0[i] = t; vibrer(10); construireDuo(); boucleChronoClassique();
      return;
    }
    // la valeur atteinte reprend là où le chrono continu en était (DUO.total),
    // jamais depuis zéro : voir boucleChronoClassique() et lancerMancheDuo()
    DUO.ecarts[i] = DUO.total + enCentiemes(t - DUO.t0[i]) - DUO.cible;
    vibrer(10); verifierFinMancheDuo();
    return;
  }
  // duel : premier tap = lancer son propre chrono, second = l'arrêter
  if(DUO.ecarts[i] !== null) return;   // déjà joué
  if(DUO.t0[i] === undefined){ DUO.t0[i] = t; vibrer(10); renduMoitieDuo(i); return; }
  DUO.ecarts[i] = enCentiemes(t - DUO.t0[i]) - DUO.cible;
  vibrer(10); renduMoitieDuo(i);
  if(DUO.ecarts[0] !== null && DUO.ecarts[1] !== null) verifierFinMancheDuo();
}

// défilement en direct du chrono commun de Classique — calqué sur
// boucleChiffres(), mais lu sur DUO.t0[DUO.tourActif] (posé par le premier
// tap du joueur actif, voir gererTapDuo — jamais de départ automatique) et
// RÉÉCRIT SUR LES DEUX moitiés (duo-chrono-0 et duo-chrono-1) puisque les
// deux joueurs doivent voir la même valeur, en miroir. Duel n'affiche
// jamais le chiffre qui tourne (aveugle, voir corpsJeuDuelDuo) et n'a donc
// pas besoin de boucle : rien à réécrire en direct. S'arrête d'elle-même
// dès que l'appui est joué (ecarts[tourActif] posé) ou que la manche change.
function boucleChronoClassique(){
  if(DUO.mode !== 'classique' || DUO.phase !== 'jeu' || DUO.ecarts[DUO.tourActif] !== null) return;
  // le chiffre affiché repart de DUO.total, jamais de 0,00 — le chrono ne
  // s'arrête jamais vraiment, il ne fait que s'interrompre entre deux tours
  const val = fmt(DUO.total + enCentiemes(performance.now() - DUO.t0[DUO.tourActif]));
  const c0 = document.getElementById('duo-chrono-0'), c1 = document.getElementById('duo-chrono-1');
  if(c0) c0.textContent = val;
  if(c1) c1.textContent = val;
  requestAnimationFrame(boucleChronoClassique);
}

// Pas de 3-2-1 avant chaque manche : le chrono ne part plus tout seul
// (voir gererTapDuo), c'est déjà le tap du joueur actif qui donne le
// départ — un compte à rebours devant ça ne ferait que doubler l'attente.
function lancerMancheDuo(){
  DUO.manche++;
  DUO.ecarts = [null, null];
  if(DUO.mode === 'classique'){
    // à tour de rôle : une manche sur deux pour chacun, chrono unique que
    // le joueur actif lance lui-même d'un tap (comme en solo), l'autre ne
    // fait que voir. La cible ne se tire jamais au sort ici : elle suit le
    // chrono continu, toujours la prochaine seconde pleine à partir de DUO.total.
    DUO.tourActif = DUO.manche % 2 === 1 ? 0 : 1;
    DUO.cible = cibleSuivanteDuo(DUO.total);
    DUO.t0 = [undefined, undefined];   // attend le tap du joueur actif pour démarrer
    DUO.phase = 'jeu'; construireDuo();
  } else {
    // duel : cible tirée au sort à chaque manche, personne ne part tout
    // seul, chacun lance son propre chrono
    DUO.cible = nouvelleCibleDuo(DUO.reglages.duel.diff === 'hard');
    DUO.t0 = [undefined, undefined];
    DUO.phase = 'jeu'; construireDuo();
  }
}
function verifierFinMancheDuo(){
  if(DUO.mode === 'classique'){
    const j = DUO.tourActif, autre = 1 - j, gor = DUO.reglages.classique.gor;
    // le cumul avance TOUJOURS sur la valeur réellement atteinte, riposte ou
    // pas — comme S.total dans le jeu principal, jamais remis à zéro ici
    DUO.total = DUO.ecarts[j] + DUO.cible;
    if(DUO.contre > 0){
      // ce joueur ripostait : un nouveau pile fait rebondir (et grossir) le
      // défi vers l'autre, tout le reste le lui fait perdre — il boit le
      // cumul de culs secs et la riposte retombe à zéro
      if(DUO.ecarts[j] === 0){
        DUO.contre++;
        DUO.dernierVerdict = {code:'contre', libelle:'Contré !', couleur:'t-s100',
          cible:autre, montant:DUO.contre, unite:'culs', pendant:true};
      } else {
        DUO.culs[j] += DUO.contre;
        DUO.dernierVerdict = {code:'rate-riposte', libelle:'Riposte manquée', couleur:'t-signal',
          cible:j, montant:DUO.contre, unite:'culs', pendant:false};
        DUO.contre = 0;
      }
    } else {
      const v = evaluerClassiqueDuo(DUO.ecarts[j]);
      if(v.code === 'pile'){
        DUO.contre = 1;
        DUO.dernierVerdict = {code:'pile', libelle:v.libelle, couleur:v.couleur,
          cible:autre, montant:1, unite:'culs', pendant:true};
      } else if(v.code === 'frole'){
        DUO.gorgees[autre] += v.gorgees;
        DUO.dernierVerdict = {code:'frole', libelle:v.libelle, couleur:v.couleur,
          cible:autre, montant:v.gorgees, unite:'gorgees', pendant:false};
      } else if(v.code === 'sauf'){
        DUO.dernierVerdict = {code:'sauf', libelle:v.libelle, couleur:v.couleur,
          cible:null, montant:0, unite:'gorgees', pendant:false};
      } else {
        DUO.gorgees[j] += v.gorgees;
        DUO.dernierVerdict = {code:'rate', libelle:v.libelle, couleur:v.couleur,
          cible:j, montant:v.gorgees, unite:'gorgees', pendant:false};
      }
    }
  } else {   // duel : la manche va au plus proche des deux ; égalité = personne ne marque
    const egalite = Math.abs(DUO.ecarts[0]) === Math.abs(DUO.ecarts[1]);
    if(!egalite) DUO.scores[Math.abs(DUO.ecarts[0]) < Math.abs(DUO.ecarts[1]) ? 0 : 1]++;
  }
  DUO.phase = 'resultat'; construireDuo();
  setTimeout(() => {
    // manchesVisees=0 = ∞ (comme CFG.maxTours=0 en solo) : jamais de fin
    // automatique, seul « Quitter » y met un terme
    if(DUO.manchesVisees && DUO.manche >= DUO.manchesVisees){
      DUO.phase = 'fin'; construireDuo();
      trackEvent('duo_match_end', {mode:DUO.mode, manches:DUO.manche});
    }
    else lancerMancheDuo();
  }, 1800);
}

// ce qu'une moitié doit boire sur l'ensemble de la partie, en une ligne —
// séparé de renduMoitieDuo pour ne pas afficher « 0 gorgée » quand il n'y a
// simplement rien à boire.
function resumeGorgeesDuo(i){
  const gor = DUO.reglages.classique.gor, parts = [];
  if(DUO.gorgees[i] > 0) parts.push(gorg(DUO.gorgees[i]));
  if(DUO.culs[i] > 0) parts.push(DUO.culs[i] + ' ' + nomCulSecDuo(gor) + (DUO.culs[i] > 1 ? 's' : ''));
  return parts.length ? parts.join(' · ') : 'Aucune gorgée';
}

// corps de la phase 'jeu' en Classique : chrono UNIQUE, affiché à l'identique
// des deux côtés (voir boucleChronoClassique) — seul l'état diffère : le
// joueur actif doit toucher pour lancer puis pour arrêter, l'autre ne fait
// que regarder (comme en Duel, mais à tour de rôle sur un chrono commun).
function corpsJeuClassiqueDuo(i){
  const actif = i === DUO.tourActif, gor = DUO.reglages.classique.gor;
  const lance = DUO.t0[DUO.tourActif] !== undefined;
  // le chiffre part de DUO.total, pas de 0,00 (voir boucleChronoClassique) ;
  // une riposte en cours s'affiche en plus, des deux côtés, pour que
  // l'enjeu du tour soit clair avant même que le résultat tombe
  const defi = DUO.contre > 0
    ? '<div class="duo-boit">Riposte · ' + culsDuo(DUO.contre, gor) + ' en jeu</div>' : '';
  return '<div class="duo-cible">' + fmt(DUO.cible) + '</div>'
    + '<div class="f-chrono duo-chrono" id="duo-chrono-' + i + '">' + fmt(DUO.total) + '</div>'
    + '<div class="duo-etat">' + (actif
        ? (lance ? 'Touchez pour arrêter' : 'Touchez pour lancer')
        : (esc(DUO.noms[DUO.tourActif] || 'L\'autre') + (lance ? ' joue…' : ' va jouer…'))) + '</div>'
    + defi;
}
// corps de la phase 'jeu' en Duel : chaque moitié suit son propre état —
// pas encore lancé (à l'aveugle mais chiffre pas encore parti), lancé
// (aveugle, chrono masqué derrière « —,—— »), ou déjà joué.
function corpsJeuDuelDuo(i){
  const lance = DUO.t0[i] !== undefined, fini = DUO.ecarts[i] !== null;
  return '<div class="duo-cible">' + fmt(DUO.cible) + '</div>'
    + '<div class="f-chrono duo-chrono' + (fini ? ' repos' : (lance ? ' attente' : '')) + '" id="duo-chrono-' + i + '">'
    + (fini ? fmt(DUO.ecarts[i] + DUO.cible) : '—,——') + '</div>'
    + '<div class="duo-etat">' + (fini ? 'Joué · en attente…' : (lance ? 'Touchez pour arrêter' : 'Touchez pour lancer votre chrono')) + '</div>';
}
// corps de la phase 'resultat' en Classique : un seul joueur a joué cette
// manche (DUO.tourActif) — le verdict structuré posé par verifierFinMancheDuo
// (DUO.dernierVerdict) dit qui doit boire quoi, riposte en cours comprise ;
// seule la formulation (« vous » ou le prénom de l'autre) change selon la
// moitié qui l'affiche.
function corpsResultatClassiqueDuo(i){
  const j = DUO.tourActif, v = DUO.dernierVerdict, gor = DUO.reglages.classique.gor;
  const montant = v.unite === 'culs' ? culsDuo(v.montant, gor) : gorg(v.montant);
  const valeurAtteinte = DUO.ecarts[j] + DUO.cible;   // le chiffre réellement affiché, pas seulement l'écart
  let texte;
  if(v.cible === null) texte = 'Personne ne boit';
  else if(v.cible === i) texte = v.pendant ? 'Vous devez ' + montant + ' — ou riposte' : 'Vous buvez ' + montant;
  else texte = esc(DUO.noms[v.cible] || 'L\'autre')
    + (v.pendant ? ' doit ' + montant + ' — ou riposte' : ' boit ' + montant);
  return '<div class="duo-verdict ' + v.couleur + '">' + esc(v.libelle) + '</div>'
    + '<div class="duo-ecart">' + signe(DUO.ecarts[j]) + fmt(Math.abs(DUO.ecarts[j])) + '</div>'
    + '<div class="duo-duree">à tenir <b>' + fmt(DUO.cible) + '</b> · tenu <b>' + fmt(valeurAtteinte) + '</b></div>'
    + '<div class="duo-etat">' + (i === j ? 'vous avez joué' : esc(DUO.noms[j] || 'l\'autre') + ' a joué') + '</div>'
    + '<div class="duo-boit">' + texte + '</div>';
}

function construireDuo(){ renduMoitieDuo(0); renduMoitieDuo(1); }
function renduMoitieDuo(i){
  const nom = DUO.noms[i] || ('Joueur ' + (i + 1)), autre = 1 - i;
  // Classique n'a pas de points (comme le vrai mode soirée : on ne compte
  // que qui boit quoi) — l'en-tête n'affiche donc que la manche en cours.
  // Duel reste un score classique, le plus proche l'emporte.
  const numero = DUO.manche + (DUO.phase === 'attente' ? 1 : 0);
  // manchesVisees=0 = ∞ : rien à borner ni à diviser, juste le numéro en cours
  const manche = DUO.manchesVisees ? Math.min(numero, DUO.manchesVisees) + '/' + DUO.manchesVisees
                                    : String(numero);
  const enteteMini = '<div class="duo-nom" style="color:' + coulHash(nom) + '">' + esc(nom) + '</div>'
    + '<div class="duo-score-mini">' + (DUO.mode === 'classique'
        ? 'Manche ' + manche
        : DUO.scores[0] + ' – ' + DUO.scores[1] + ' · manche ' + manche) + '</div>';
  let corps;
  if(DUO.phase === 'attente'){
    corps = '<div class="duo-etat">' + (DUO.pret[i] ? 'Prêt ! En attente de l\'autre…' : 'Touchez pour dire prêt') + '</div>';
  } else if(DUO.phase === 'jeu'){
    corps = DUO.mode === 'classique' ? corpsJeuClassiqueDuo(i) : corpsJeuDuelDuo(i);
  } else if(DUO.phase === 'resultat'){
    if(DUO.mode === 'classique'){
      corps = corpsResultatClassiqueDuo(i);
    } else {
      const egalite = Math.abs(DUO.ecarts[i]) === Math.abs(DUO.ecarts[autre]);
      const gagne = !egalite && Math.abs(DUO.ecarts[i]) < Math.abs(DUO.ecarts[autre]);
      // le chrono restait caché pendant la manche (à l'aveugle) : la révélation
      // montre maintenant ce que chacun a réellement arrêté, pas seulement l'écart
      const mienne = DUO.ecarts[i] + DUO.cible, sienne = DUO.ecarts[autre] + DUO.cible;
      corps = '<div class="duo-verdict ' + (egalite ? '' : (gagne ? 't-vert' : 't-signal')) + '">'
        + (egalite ? 'Égalité' : (gagne ? 'Manche gagnée' : 'Manche perdue')) + '</div>'
        + '<div class="duo-ecart">' + signe(DUO.ecarts[i]) + fmt(Math.abs(DUO.ecarts[i])) + '</div>'
        + '<div class="duo-duree">cible <b>' + fmt(DUO.cible) + '</b> · vous <b>' + fmt(mienne)
        + '</b> · ' + esc(DUO.noms[autre] || 'l\'autre') + ' <b>' + fmt(sienne) + '</b></div>';
    }
  } else if(DUO.mode === 'classique'){
    // pas de vainqueur en Classique — comme au vrai mode soirée, la partie
    // se solde par ce que chacun a bu, pas par un score à comparer
    corps = '<div class="duo-verdict">Fin de la partie</div>'
      + '<div class="duo-etat">' + esc(resumeGorgeesDuo(i)) + '</div>'
      + '<div class="recap-b"><button class="bouton duo-revanche">Revanche</button>'
      + '<button class="bouton fantome duo-menu">Menu</button></div>';
  } else {   // fin, duel : le plus proche de la cible l'emporte, score classique
    const nul = DUO.scores[i] === DUO.scores[autre], gagne = !nul && DUO.scores[i] > DUO.scores[autre];
    corps = '<div class="duo-verdict ' + (nul ? '' : (gagne ? 't-vert' : 't-signal')) + '">'
      + (nul ? 'Match nul' : (gagne ? 'Victoire' : 'Défaite')) + '</div>'
      + '<div class="duo-score">' + DUO.scores[i] + ' – ' + DUO.scores[autre] + '</div>'
      + '<div class="recap-b"><button class="bouton duo-revanche">Revanche</button>'
      + '<button class="bouton fantome duo-menu">Menu</button></div>';
  }
  const el = $('duo-moitie-' + i);
  el.innerHTML = enteteMini + '<div class="duo-corps">' + corps + '</div>';
  if(DUO.phase === 'fin'){
    // le tap sur la moitié ne fait rien en phase 'fin' (gererTapDuo ne gère
    // que 'attente' et 'jeu') : ces deux boutons n'ont donc rien à bloquer
    el.querySelector('.duo-revanche').onclick = () => { reinitialiserMatchDuo(); construireDuo(); };
    el.querySelector('.duo-menu').onclick = () => montrer('reglages');
  }
}

/* ════════ BANC D'ESSAI COMPTES ET LIGUES ════════ */
// Rien n'est branché sur le jeu : cet écran sert à valider la configuration
// Supabase avant d'écrire la moindre ligne d'authentification réelle.

function log(txt, cls){
  const J = $('cp-log');
  const h = new Date().toTimeString().slice(0, 8);
  J.insertAdjacentHTML('afterbegin',
    `<div class="${cls || ''}">${h}  ${esc(txt)}</div>`);
}
$('go-comptes').onclick = () => { majComptes(); montrer('comptes'); };
$('cp-retour').onclick  = () => montrer('test');

async function majComptes(){
  $('cp-etat').textContent = EN_LIGNE() ? (SESSION ? 'connecté' : 'clés présentes') : 'aucune clé';
  $('cp-serveur').textContent = EN_LIGNE()
    ? 'URL configurée : ' + SUPABASE_URL.replace(/^https:\/\//, '')
    : "Aucune clé Supabase dans index.html. Rien ne peut être testé.";
  const s = await rafraichirSession();
  $('cp-deconnecte').style.display = s ? 'none' : 'block';
  $('cp-connecte').style.display   = s ? 'block' : 'none';
  if(s){
    let p = null;
    try{ p = await monProfil(); }catch(e){}
    $('cp-compte').textContent = 'Connecté : ' + emailVersIdent(s.email)
      + (p && p.pseudo ? ' · pseudo ' + p.pseudo + (p.tag ? ' #' + p.tag : '') : '');
    listerMesLigues();
  } else {
    $('cp-compte').textContent = 'Aucun compte connecté sur cet appareil.';
  }
}

// 1 — le serveur répond-il ?
$('cp-ping').onclick = async () => {
  if(!EN_LIGNE()) return log('Aucune clé configurée.', 'ko');
  log('Appel de salons…', 'info');
  try{
    const t0 = performance.now();
    await api('salons?select=code&limit=1');
    log('Serveur joignable en ' + Math.round(performance.now() - t0) + ' ms.', 'ok');
  }catch(e){ log('Échec : ' + e.message, 'ko'); }
};

// 2 — les tables d'authentification existent-elles ?
$('cp-verif').onclick = async () => {
  if(!EN_LIGNE()) return log('Aucune clé configurée.', 'ko');
  const tables = ['profils', 'ligues', 'membres', 'perfs'];
  const etat = [];
  for(const t of tables){
    try{ await api(t + '?select=*&limit=1'); etat.push(t + ' ✓'); log('Table ' + t + ' : présente.', 'ok'); }
    catch(e){
      const abs = /does not exist|PGRST205|42P01/i.test(e.message);
      etat.push(t + (abs ? ' ✗' : ' ?'));
      log('Table ' + t + ' : ' + (abs ? 'absente' : e.message.slice(0, 60)), 'ko');
    }
  }
  $('cp-tables').textContent = etat.join(' · ')
    + (etat.some(x => x.includes('✗')) ? ' — exécutez le SQL du guide.' : ' — tout est en place.');
};

// 3 — créer un compte / se connecter
$('cp-cr-btn').onclick = async () => {
  const ident = ($('cp-ident').value || '').trim();
  const pass  = ($('cp-pass').value || '');
  if(!ident) return log('Saisissez un identifiant.', 'ko');
  if(pass.length < 8) return log('8 caractères minimum.', 'ko');
  if(!EN_LIGNE()) return log('Aucune clé configurée.', 'ko');
  log('Création du compte « ' + ident + ' »…', 'info');
  try{
    await creerCompte(ident, pass);
    log('Compte créé et connecté.', 'ok');
    majComptes();
    remonterScoresBanc();
  }catch(e){
    log('Échec : ' + e.message, 'ko');
    if(/already registered/i.test(e.message))
      log('Cet identifiant est déjà pris. Essayez « Connecter ».', 'info');
  }
};

$('cp-lg-btn').onclick = async () => {
  const ident = ($('cp-ident').value || '').trim();
  const pass  = ($('cp-pass').value || '');
  if(!ident || pass.length < 8) return log('Identifiant + 8 caractères.', 'ko');
  if(!EN_LIGNE()) return log('Aucune clé configurée.', 'ko');
  log('Connexion…', 'info');
  try{
    const s = await connecterCompte(ident, pass);
    log('Connecté : ' + emailVersIdent(s.email), 'ok');
    majComptes();
    remonterScoresBanc();
  }catch(e){
    log('Échec : ' + e.message, 'ko');
    if(/Invalid login/i.test(e.message))
      log('Identifiant ou mot de passe incorrect.', 'info');
  }
};

$('cp-sortir').onclick = () => {
  ecrireSession(null);
  log('Déconnecté.', 'info'); majComptes();

};

$('cp-pseudo').onclick = async () => {
  const s = await rafraichirSession();
  if(!s) return;
  const p = await demanderNom('Votre pseudo',
    'Visible par les membres de vos ligues.', [], true);
  if(!p) return;
  try{
    await apiAuth('profils?id=eq.' + s.id,
      {method:'PATCH', body:JSON.stringify({pseudo:p})});
    log('Pseudo changé : ' + p, 'ok'); majComptes();
  }catch(e){ log('Échec : ' + e.message, 'ko'); }
};

// à la première connexion, les scores déjà enregistrés remontent
// version du banc d'essai : elle journalise, l'autre parle au joueur
async function remonterScoresBanc(){
  const s = await rafraichirSession();
  if(!s) return;
  const L = (MEM.scores || []).filter(e => !e.remonte);
  if(!L.length) return log('Aucun score local à remonter.', 'info');
  log('Remontée de ' + L.length + ' score(s)…', 'info');
  let n = 0;
  for(const e of L){
    try{
      await apiAuth('perfs', {method:'POST', body:JSON.stringify({
        joueur:s.id, mode:e.bareme || 'solo', config:signature(e), score:e.p,
        tours:e.tours || 0, somme:0, biais:0, carres:0, piles:0
      })});
      e.remonte = true; n++;
    }catch(err){ break; }
  }
  ecrireMem();
  log(n + ' score(s) remonté(s).', n ? 'ok' : 'ko');
}

async function listerMesLigues(){
  try{
    const r = await mesLigues();
    $('cp-ligues').textContent = r.length
      ? r.map(m => ((m.ligues && m.ligues.nom) || '—') + ' · ' + m.ligue).join('   |   ')
      : "Vous n'appartenez à aucune ligue.";
  }catch(e){ $('cp-ligues').textContent = 'Impossible de lister : ' + e.message.slice(0, 70); }
}

// 4 — ligues
$('cp-creer').onclick = async () => {
  if(!EN_LIGNE()) return log('Aucune clé configurée.', 'ko');
  const nom = await demanderNom('Nom de la ligue',
    'Un nom court, visible par tous les membres.', [], true);
  if(!nom) return;
  const s = await rafraichirSession();
  if(!s) return log("Connectez-vous d'abord.", 'ko');
  const code = nouveauCode();
  try{
    await apiAuth('ligues', {method:'POST',
      body:JSON.stringify({code, nom, createur:s.id})});
    await apiAuth('membres', {method:'POST',
      body:JSON.stringify({ligue:code, joueur:s.id})});
    log('Ligue « ' + nom + ' » créée · code ' + code, 'ok');
    listerMesLigues();
  }catch(e){
    log('Échec : ' + e.message.slice(0, 140), 'ko');
    if(/row-level security|42501/i.test(e.message))
      log("Cause probable : la politique d'insertion exige un compte connecté.", 'info');
  }
};
$('cp-rejoindre').onclick = async () => {
  if(!EN_LIGNE()) return log('Aucune clé configurée.', 'ko');
  const code = ((await demanderNom('Rejoindre une ligue',
    'Code à cinq lettres.', [], true)) || '').toUpperCase().trim();
  if(!/^[A-Z]{5}$/.test(code)) return log('Code invalide.', 'ko');
  try{
    const r = await api('ligues?code=eq.' + encodeURIComponent(code) + '&select=code,nom');
    if(!r || !r.length) return log('Aucune ligue avec ce code.', 'ko');
    const s = await rafraichirSession();
    if(!s) return log("Connectez-vous d'abord.", 'ko');
    await apiAuth('membres', {method:'POST',
      body:JSON.stringify({ligue:code, joueur:s.id})});
    log('Vous avez rejoint « ' + (r[0].nom || code) + ' ».', 'ok');
    listerMesLigues();
  }catch(e){ log('Échec : ' + e.message.slice(0, 140), 'ko'); }
};


/* ════════ FICHE D'UN MODE ════════ */
// Ouvrir un mode montre d'abord sa règle : on ne lance pas une partie sans
// savoir ce qu'on va devoir faire.
let ficheId = null;
let ecranAvantFiche = 'reglages';
function ouvrirFiche(id){
  ficheId = id;
  /* d'où vient-on ? le bouton « Retour » doit ramener sur la liste qu'on
     consultait, pas systématiquement à la racine du menu */
  const actuel = document.querySelector('.ecran.actif');
  ecranAvantFiche = (actuel && ['menu-solo','menu-soiree'].includes(actuel.id))
    ? actuel.id : 'reglages';
  const s = SOLOS.find(x => x.id === id) || MODES.find(x => x.id === id);
  if(!s) return;
  const solo = estSolo(id);
  const f = (SOLOS.find(x => x.id === id) || {}).fam;
  $('fi-nom').textContent = s.n.toUpperCase();
  $('fi-fam').textContent = solo ? 'mode solo' : 'mode soirée';
  $('fi-titre').textContent = 'Comment ça marche';
  $('fi-regle').textContent = s.regle || s.d;
  $('fi-bloc-astuce').style.display = s.astuce ? 'block' : 'none';
  if(s.astuce) $('fi-astuce').textContent = s.astuce;

  // Chaque réglage n'apparaît que s'il change quelque chose pour ce mode.
  const imposeAff = id === 'defi';                       // le défi fixe l'affichage
  const sansAff   = id === 'reflexe' || id === 'blind';
  const avecDiff  = !['reflexe','survie','escalier','defi','cascade'].includes(id);
  const avecGor   = !solo;                               // l'alcool ne concerne que la soirée
  const avecEvt   = id === 'classique';                  // les événements ne touchent que le classique
  const avecFin   = !solo && !['elimination','coop','compte'].includes(id);

  const aff = (bloc, on) => { const e = $(bloc); if(e) e.style.display = on ? 'block' : 'none'; };
  aff('fi-bloc-aff',  !sansAff);
  aff('fi-bloc-diff', avecDiff);
  aff('fi-bloc-pari', id === 'blind');
  aff('fi-bloc-gor',  avecGor);
  aff('fi-bloc-evt',  avecEvt);
  aff('fi-bloc-fin',  avecFin);
  aff('fi-bloc-figures', id === 'scoring');
  if(id === 'scoring'){
    const P = paramsScore();
    const pct = m => { let s = m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      return '×' + s.replace('.', ','); };
    const FIGURES = [
      ['Chaîne de piles', 'Piles d\'affilée : 100, 200, 300… jusqu\'à 500.'],
      ['Série', 'Tour ≤ ' + P.seuil + ' cts : multiplie les points, jusqu\'à ' + pct(P.plafond) + '.'],
      ...(P.double > 0 ? [['Doublé', 'Deux piles d\'affilée. +' + P.double + '.']] : []),
      ['Remontée', 'Pile juste après une rupture. +' + P.remontee + '.'],
      ['Métronome', '3 tours du même côté, écarts proches. +' + P.metronome + '.'],
      ['Verrou', '5 tours à ' + P.verrouSeuil + ' ct' + (P.verrouSeuil>1?'s':'') + ' max. +' + P.verrou + '.'],
      ['Crescendo', '4 écarts qui diminuent d\'affilée. +' + P.crescendo + '.'],
      ['Le dernier mot', 'Pile au 10ᵉ tour. +' + P.dernierMot + '.'],
      ['Coup double', '2 figures le même tour. +' + P.coupDouble + '.'],
      ['Symétrie', 'Biais final proche de zéro. +' + P.symetriePrime + '.'],
      ['Main sûre', P.mainSure + ' tours tenus sur 10, en vrac. +' + P.mainSurePrime + '.'],
      ['Montée en régime', '2ᵉ moitié ' + P.montee + '× meilleure. +' + P.monteePrime + '.'],
      ['Sans filet', 'Jamais hors zone. ' + pct(P.sansFilet) + '.'],
      ['Précision globale', 'Palier selon la moyenne, jusqu\'à ' + pct(PALIERS_PRECISION[0].mult) + '.'],
      [P.eclipse ? 'Éclipse' : 'Sans-faute', '10/10 dans le seuil. ' + pct(P.sansFaute)
        + (P.eclipse ? ', remplace Sans filet et Main sûre.' : '.')]
    ];
    $('fi-figures').innerHTML = FIGURES.map(([n,d]) =>
      `<div class="rang-evt" style="cursor:default"><div class="txt">
        <div class="n">${esc(n)}</div><div class="d">${esc(d)}</div>
      </div></div>`).join('');
  }

   

  $('fi-aff').style.opacity = imposeAff ? .35 : 1;
  $('fi-aff').style.pointerEvents = imposeAff ? 'none' : 'auto';

  const m = {'fi-aff':CFG.aff, 'fi-diff':CFG.diff, 'fi-gor':CFG.gor,
             'fi-evt':CFG.evts, 'fi-fin':String(CFG.maxTours),
             'fi-pari': CFG.pariBlind ? 'oui' : 'non'};
  for(const k in m){ const e = $(k); if(e) e.querySelectorAll('button')
    .forEach(b => b.setAttribute('aria-pressed', b.dataset.v === m[k])); }

  if(id === 'blind') {
    $('fi-note-diff').textContent = CFG.diff === 'hard'
      ? "Hard : Cibles décimales (ex: 4,37s). Zone de tolérance large (±0,35 à ±0,95) qui croît avec la durée."
      : "Simple : Cibles rondes (ex: 4,00s). Zone de tolérance standard (±0,30 à ±0,90).";
  } else if(avecDiff) {
    $('fi-note-diff').textContent = 'Zone sûre ± ' + fmt(zoneBase())
      + ' s.' + (avecGor ? ' Hors zone : ' + gorg(RATE[CFG.gor]) + '.' : '');
  }
  if(avecGor)  $('fi-note-gor').textContent = CFG.gor === 'gros'
    ? "En retard pour sortir ? Pas envie de te rappeler de la date du jour ? Envie de perdre ton téléphone dans un taxi ? T'es au bon endroit."
    : CFG.gor === 'appart'
    ? "Au chaud on peut y aller franco, un pile c'est un " + nomCulSec() + "."
    : "A la cool, entres potes. On va pas gâcher cette biere quand même, un pile c'est un " + nomCulSec() + ".";
  if(avecEvt)  $('fi-note-evt').textContent = {
    aucun:'Aucun événement. Le jeu se joue au barème seul.',
    rares:'Environ un tour sur huit. Jamais deux fois de suite.',
    frequents:'Environ un tour sur trois. La partie devient franchement bordélique.'}[CFG.evts];

 // NOUVEAU : Générer la liste des événements interactive dans le dépliant
  const detailEvt = $('fi-liste-evts-detail');
  if(detailEvt) {
    const rendreEvts = () => {
      CFG.evtExclus = CFG.evtExclus || [];
      detailEvt.innerHTML = EVTS.map(e => {
        const actif = !CFG.evtExclus.includes(e.id);
        return `<div class="rang-evt ${actif ? '' : 'off'}" data-id="${e.id}">
          <button class="toggle-evt">${actif ? 'ON' : 'OFF'}</button>
          <div class="txt">
            <div class="n">${e.n}</div>
            <div class="d">${e.d}</div>
          </div>
        </div>`;
      }).join('');
      
      // On rend chaque ligne cliquable pour activer/désactiver
      detailEvt.querySelectorAll('.rang-evt').forEach(el => {
        el.onclick = () => {
          const id = el.dataset.id;
          if(CFG.evtExclus.includes(id)) {
            CFG.evtExclus = CFG.evtExclus.filter(x => x !== id); // On le retire des exclus (ON)
          } else {
            CFG.evtExclus.push(id); // On l'ajoute aux exclus (OFF)
          }
          MEM.cfg = {...CFG}; ecrireMem();
          rendreEvts(); // Met à jour l'affichage dynamiquement
        };
      });
    };
    rendreEvts();
  }
  if(avecGor) tableau();
  if(avecFin){
    // ~11 s par tour en soirée : lancer, jouer, lire le verdict, passer le téléphone
    const t = CFG.maxTours;
    $('fi-note-duree').textContent = t
      ? 'Environ ' + Math.max(2, Math.round(t * 11 / 60)) + ' minutes de jeu.'
      : 'Partie sans fin : vous arrêtez quand vous voulez.';
  }

  const B = $('fi-biomes');
  if(B){
    $('fi-biomes-bloc').style.display = id === 'survie' ? 'block' : 'none';
    if(id === 'survie') B.innerHTML = BIOMES.map((b, i) =>
      `<div class="bl" style="border-color:${b.accent}44">
        <span class="bl-n" style="color:${b.accent}">${esc(b.n)}</span>
        <span class="bl-t">${i * TOURS_BIOME + 1}${i === BIOMES.length-1 ? '+' : '–' + (i+1)*TOURS_BIOME}</span>
        <span class="bl-e">${b.malus ? '−&nbsp;' + esc(b.malus) : ''}${b.malus && b.bonus ? '<br>' : ''}${b.bonus ? '+&nbsp;' + esc(b.bonus) : ''}${!b.malus && !b.bonus ? 'aucun effet' : ''}</span>
      </div>`).join('');
  }
  const rep = id === 'survie' ? repriseDispo() : null;
  $('fi-reprendre').style.display = rep ? 'block' : 'none';
  if(rep) $('fi-reprendre').textContent = 'Reprendre · tour ' + rep.tour
    + ' · zone ± ' + fmt(rep.zone);
  $('fi-bloc-defi').style.display = id === 'defi' ? 'block' : 'none';
  if(id === 'defi') construirePantheonDefi();
  if(imposeAff){
    const d = defiDuJour();
    const rest = essaisRestants();
    $('fi-note').textContent = 'Défi du jour : ' + d.consigne + '. ' + d.detail
      + ' · ' + (MAX_ESSAIS_DEFI - rest) + ' / ' + MAX_ESSAIS_DEFI
      + ' tentatives utilisées'
      + (rest > 0 ? ' · il en reste ' + rest : ' · revenez demain');
    $('fi-jouer').disabled = rest <= 0;
    $('fi-jouer').textContent = rest > 0 ? 'Jouer' : 'Revenez demain';
  } else {
    $('fi-jouer').disabled = false;
    $('fi-jouer').textContent = 'Jouer';
    $('fi-note').textContent = solo
      ? 'Un seul joueur, un score, un progrès à mesurer.'
      : 'Mode de soirée : plusieurs joueurs, un seul téléphone qui tourne.';
  }
  montrer('fiche');
}
const majFiche = () => { MEM.cfg = {...CFG}; ecrireMem(); appliquerCfg(); ouvrirFiche(ficheId); };
segmente('fi-aff',  v => { CFG.aff = v;  majFiche(); });
segmente('fi-diff', v => { CFG.diff = v; majFiche(); });
segmente('fi-gor',  v => { CFG.gor = v;  majFiche(); });
segmente('fi-evt',  v => { CFG.evts = v; majFiche(); });
segmente('fi-fin',  v => { CFG.maxTours = +v; majFiche(); });
segmente('fi-pari', v => { CFG.pariBlind = (v === 'oui'); majFiche(); });
$('fi-retour').onclick = () => montrer(ecranAvantFiche || 'reglages');
$('fi-reprendre').onclick = () => reprendrePartie();
$('fi-jouer').onclick = () => {
  if(ficheId === 'survie') effacerReprise();
  if(!ficheId) return;
  CFG.mode = ficheId;
  if(estSolo(ficheId)) peupler();
  MEM.cfg = {...CFG}; ecrireMem();
  construireModes(); construireTest(); rafraichir();
  demarrerPartie();
};

/* ════════ REPRISE DE PARTIE ════════ */
// Seul Survie est concerné : c'est le seul mode dont une partie peut durer
// assez longtemps pour qu'on veuille la mettre de côté.
function etatReprenable(){
  return {mode:'survie', tour:S.tour, total:S.total, cible:S.cible,
          zone:S.zoneSurvie, vies:S.vies, piles:S.pilesSurvie,
          chaine:S.chaineSurvie, pilesEnchaines:S.pilesEnchaines || 0,
          courbe:(S.courbe || []).slice(-40), points:S.points,
          graine:S.graine, dernierRdv:S.dernierRdv, prochainRdv:S.prochainRdv,
          interruptions:S.interruptions || 0,
          trocPropose:S.trocPropose, vaToutPropose:S.vaToutPropose,
          seriePropose:S.seriePropose,
          serie:S.meilleureSerie, aff:CFG.aff, joueur:S.joueurs[0],
          date:Date.now()};
}
function sauverPartie(){
  MEM.reprise = etatReprenable();
  ecrireMem();
}
function effacerReprise(){ if(MEM.reprise){ MEM.reprise = null; ecrireMem(); } }
function repriseDispo(){
  const r = MEM.reprise;
  // au-delà de sept jours, la reprise n'a plus de sens
  return r && r.mode === 'survie' && Date.now() - r.date < 7*24*3600*1000 ? r : null;
}
async function reprendrePartie(){
  const r = repriseDispo();
  if(!r) return false;
  CFG.mode = 'survie'; CFG.aff = r.aff || CFG.aff;
  MEM.joueurs = [r.joueur || (MEM.joueurs && MEM.joueurs[0]) || 'Joueur'];
  peupler();
  await demarrerPartie();
  S.tour = r.tour; S.total = r.total; S.cible = r.cible; S.cibleBase = r.cible;
  S.zoneSurvie = r.zone; S.vies = r.vies; S.pilesSurvie = r.piles;
  S.chaineSurvie = r.chaine; S.pilesEnchaines = r.pilesEnchaines;
  S.courbe = r.courbe || []; S.points = r.points;
  S.graine = r.graine; S.alea = graine(r.graine || 1);
  S.dernierRdv = r.dernierRdv; S.prochainRdv = r.prochainRdv;
  S.interruptions = r.interruptions || 0;
  S.trocPropose = !!r.trocPropose; S.vaToutPropose = !!r.vaToutPropose;
  S.seriePropose = !!r.seriePropose;
  S.meilleureSerie = r.serie || {n:0};
  S.zoneTour = zoneDe(S.joueurs[0]);
  effacerReprise();
  fluidePret();
  return true;
}

/* ════════ REPRISE D'EXPÉDITION — AVENTURE UNIQUEMENT ════════ */
// Système jumeau de celui de Survie ci-dessus, mais entièrement séparé :
// clé de stockage différente (MEM.repriseAvt), fonctions différentes. Aucune
// des deux ne lit ni n'écrit l'état de l'autre.
function etatReprenableAvt(){
  const A = S.avt;
  return {tour:S.tour, total:S.total, cible:S.cible,
          xp:A.xp, or:A.or, zoneDepart:A.zoneDepart, zone:A.zone,
          gardiens:A.gardiens, pas:A.pas, pvJoueur:A.pvJoueur, pvJoueurMax:A.pvJoueurMax,
          biomeId:A.biomeId, visites:A.visites,
          joueur:S.joueurs[0], date:Date.now()};
}
function sauverPartieAvt(){
  MEM.repriseAvt = etatReprenableAvt();
  ecrireMem();
}
function effacerRepriseAvt(){ if(MEM.repriseAvt){ MEM.repriseAvt = null; ecrireMem(); } }
function repriseAvtDispo(){
  const r = MEM.repriseAvt;
  // au-delà de sept jours, la reprise n'a plus de sens (même règle que Survie)
  return r && Date.now() - r.date < 7*24*3600*1000 ? r : null;
}
async function reprendrePartieAvt(){
  const r = repriseAvtDispo();
  if(!r) return false;
  CFG.mode = 'aventure';
  MEM.joueurs = [r.joueur || (MEM.joueurs && MEM.joueurs[0]) || 'Joueur'];
  peupler();
  await demarrerPartie();
  S.tour = r.tour; S.total = r.total; S.cible = r.cible; S.cibleBase = r.cible;
  S.avt.xp = r.xp; S.avt.or = r.or; S.avt.zoneDepart = r.zoneDepart;
  S.avt.zone = r.zone; S.avt.gardiens = r.gardiens; S.avt.pas = r.pas;
  // repli sûr pour une sauvegarde antérieure à ce champ
  S.avt.pvJoueur = r.pvJoueur != null ? r.pvJoueur : PV_JOUEUR_BASE;
  S.avt.pvJoueurMax = r.pvJoueurMax != null ? r.pvJoueurMax : PV_JOUEUR_BASE;
  // repli sûr pour une sauvegarde antérieure au système de graphe
  S.avt.biomeId = r.biomeId || BIOME_DEPART_AVT;
  S.avt.visites = Array.isArray(r.visites) && r.visites.length ? r.visites : [S.avt.biomeId];
  S.zoneTour = zoneDe(S.joueurs[0]);
  effacerRepriseAvt();
  fluidePret();
  return true;
}

/* ════════ PANTHÉON DU DÉFI ════════ */
// Le défi ne rejoint pas le panthéon général : son barème change chaque jour.
// Il garde son propre historique, sur sa page.
function noterDefi(score, mesure){
  const j = jourCourant();
  MEM.defis = MEM.defis || {};
  const e = MEM.defis[j] || (MEM.defis[j] = {jour:j, essais:0, best:null,
                                             mesure, nom:defiDuJour().n});
  e.essais++;
  // pour un écart, plus bas vaut mieux ; pour un compte, plus haut
  const mieux = e.best === null ? true
    : (mesure === 'ecart' || mesure === 'moyenne') ? score < e.best : score > e.best;
  if(mieux) e.best = score;
  // on ne garde que trente jours
  const cles = Object.keys(MEM.defis).sort();
  while(cles.length > 30) delete MEM.defis[cles.shift()];
  ecrireMem();
}
function construirePantheonDefi(){
  const L = $('fi-defi-liste');
  const tout = MEM.defis || {};
  const jours = Object.keys(tout).sort().reverse().slice(0, 10);
  if(!jours.length){
    L.innerHTML = '<div class="vide">Aucun défi joué pour l\'instant.</div>';
    $('fi-defi-note').textContent = '';
    return;
  }
  const dateFr = j => {
    const s = String(j);
    return s.slice(6,8) + '/' + s.slice(4,6);
  };
  L.innerHTML = jours.map((j,i) => {
    const e = tout[j];
    // on n'affiche que le meilleur résultat du jour, jamais une moyenne
    const val = e.best === null ? '—'
      : (e.mesure === 'ecart' || e.mesure === 'moyenne') ? '±' + fmt(e.best) : String(e.best);
    return `<div class="l-defi">
      <span class="d-date">${dateFr(j)}</span>
      <span class="d-nom">${esc(e.nom || 'Défi')}</span>
      <span class="d-val ${i===0?'t-laiton':''}">${val}</span>
      <span class="d-ess">${e.essais}/${MAX_ESSAIS_DEFI}</span></div>`;
  }).join('');
  const faits = Object.keys(tout).length;
  // série de jours consécutifs, en partant d'aujourd'hui
  let serie = 0, cur = jourCourant();
  while(tout[cur]){ serie++; const d = new Date(String(cur).slice(0,4),
    +String(cur).slice(4,6)-1, +String(cur).slice(6,8) - 1);
    cur = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); }
  $('fi-defi-note').textContent = 'Meilleur résultat de chaque jour · '
    + faits + ' défi' + (faits>1?'s':'') + ' joué' + (faits>1?'s':'')
    + (serie > 1 ? ' · ' + serie + ' jours d\'affilée' : '');
}

/* ════════ SALON ════════ */
function majEtatSalon(){
  if(!S.salon && MEM.salon) S.salon = MEM.salon;   // filet de rattrapage
  const dispo = EN_LIGNE();
  $('bloc-salon').style.display = dispo ? 'block' : 'none';
  $('b-global').style.display = dispo && S.salon ? 'flex' : 'none';
  if(!dispo) return;
  const enAttente = lireFile().length;
  $('salon-etat').textContent = S.salon
    ? 'Salon ' + S.salon + ' · les résultats sont publiés à la fin de chaque partie.'
      + (enAttente ? ' ' + enAttente + ' en attente de réseau.' : '')
    : "Aucun salon. Créez-en un et donnez le code aux autres téléphones "
      + "pour partager un classement commun.";
  $('salon-creer').textContent = S.salon ? 'Quitter le salon' : 'Créer un salon';
}

$('salon-creer').onclick = async () => {
  if(S.salon){
    if(!await demander('Quitter le salon ?',
        'Les prochaines parties ne seront plus publiées.', 'Quitter')) return;
    S.salon = null; MEM.salon = null; await ecrireMem(); majEtatSalon(); return;
  }
  $('salon-creer').disabled = true;
  try{
    const code = await creerSalon();
    S.salon = code; MEM.salon = code; await ecrireMem();
    majEtatSalon();
    await choisir('Salon créé',
      'Donnez ce code aux autres téléphones. Ils le saisissent une fois dans '
      + '« Rejoindre » et partagent le même classement.',
      [{label:'Compris', val:true}]);
    $('mod-titre').textContent = 'Salon ' + code;
  }catch(e){
    choisir('Création impossible',
      "Le serveur n'a pas répondu. Vérifiez la connexion et les clés Supabase.",
      [{label:'Fermer', val:true}]);
  }
  $('salon-creer').disabled = false;
};

$('salon-rejoindre').onclick = async () => {
  const code = (await demanderNom('Rejoindre un salon',
    'Saisissez le code à cinq lettres affiché sur le téléphone qui a créé le salon.',
    [], true) || '').toUpperCase().trim();
  if(!code) return;
  if(!/^[A-Z]{5}$/.test(code))
    return choisir('Code invalide', 'Un code de salon fait cinq lettres.',
      [{label:'Fermer', val:true}]);
  try{
    if(!await salonExiste(code))
      return choisir('Salon introuvable',
        'Aucun salon ne porte ce code. Vérifiez la saisie.', [{label:'Fermer', val:true}]);
    S.salon = code; MEM.salon = code; await ecrireMem();
    majEtatSalon();
    choisir('Salon rejoint',
      'Les parties jouées sur ce téléphone alimentent maintenant le classement de '
      + code + '.', [{label:'Parfait', val:true}]);
  }catch(e){
    choisir('Connexion impossible',
      "Le serveur n'a pas répondu.", [{label:'Fermer', val:true}]);
  }
};

/* ════════ PANTHÉON GLOBAL ════════ */
let glFiltre = 'solo';
let glMode = 'scoring', glAff = 'tout', glDiff = 'tout';
const HORS_PANTHEON = ['defi'];   // le défi a son propre tableau
$('go-global').onclick = () => { construireGlobal(); montrer('classement-global'); };
// le panneau de filtres se replie à chaque ouverture de l'écran
function replierFiltres(){
  $('gl-panneau').classList.remove('on');
  $('gl-filtres').setAttribute('aria-expanded', 'false');
}
$('gl-retour').onclick = () => montrer('reglages');
segmente('seg-gl', v => { glFiltre = v; construireGlobal(true); });
segmente('gl-aff',  v => { glAff = v;  construireGlobal(true); });
segmente('gl-diff', v => { glDiff = v; construireGlobal(true); });
$('gl-filtres').onclick = () => {
  const on = !$('gl-panneau').classList.contains('on');
  $('gl-panneau').classList.toggle('on', on);
  $('gl-filtres').setAttribute('aria-expanded', on);
};
// une performance porte sa configuration dans « config » : aff·diff·tours·mode
function passeFiltres(r){
  if(glAff === 'tout' && glDiff === 'tout') return true;
  const [a, d] = String(r.config || '').split('·');
  return (glAff === 'tout' || a === glAff) && (glDiff === 'tout' || d === glDiff);
}
function majBadgeFiltres(){
  const n = (glAff !== 'tout' ? 1 : 0) + (glDiff !== 'tout' ? 1 : 0);
  $('gl-filtre-n').textContent = n ? String(n) : '';
  $('gl-filtres').classList.toggle('actif', n > 0);
}

async function construireGlobal(depuisFiltre){
  if(!depuisFiltre) replierFiltres();
  $('gl-code').textContent = S.salon || '';
  const L = $('gl-liste');
  L.innerHTML = '<div class="vide">Chargement…</div>';
  $('gl-note').textContent = '';
  if(!S.salon || !EN_LIGNE()){
    L.innerHTML = '<div class="vide">Aucun salon rejoint.</div>';
    return;
  }
  let lignes;
  try{
    lignes = await api('resultats?salon=eq.' + encodeURIComponent(S.salon)
      + '&select=pseudo,mode,config,tours,somme,biais,carres,piles,gorgees,culs,points'
      + '&limit=4000');
  }catch(e){
    L.innerHTML = '<div class="vide">Impossible de joindre le serveur.<br>'
      + 'Réessayez quand la connexion revient.</div>';
    return;
  }
  L.innerHTML = '';
  // un sélecteur de mode n'a de sens que pour les scores
  $('gl-modes').style.display = glFiltre === 'solo' ? 'flex' : 'none';
  if(glFiltre === 'solo'){ construireOngletsModes(lignes); return classementSolo(L, lignes); }
  return classementCollectif(L, lignes);
}

// Précision : toutes les parties, tous les modes, tous les réglages.
// Un joueur régulier doit remonter quel que soit le contexte de jeu.
function classementCollectif(L, lignes){
  majBadgeFiltres();
  const par = {};
  (lignes || []).filter(passeFiltres).forEach(r => {
    const p = par[r.pseudo] || (par[r.pseudo] = profilVide());
    ['tours','somme','biais','carres','piles','gorgees','culs']
      .forEach(k => p[k] += (r[k] || 0));
    p.parties++;
  });
  const tous = Object.keys(par).map(n => ({n, a:analyse(par[n])}))
    .filter(x => x.a).sort((a,b) => a.a.precision - b.a.precision).slice(0, 30);
  if(!tous.length){
    L.innerHTML = '<div class="vide">Aucune partie publiée dans ce salon.</div>';
    return;
  }
  tous.forEach((x,i) => {
    const a = x.a;
    const d = document.createElement('div');
    d.className = 'ligne';
    d.innerHTML = `<span class="pos">${i+1}</span>
      <span class="qui" style="color:${coulHash(x.n)}">${esc(x.n)}</span>
      <span class="moy ${i===0?'t-laiton':''}">±${fmt(Math.round(a.precision))}</span>
      <span class="bu">${a.parties} partie${a.parties>1?'s':''} · ${a.tours} tours ·
        ${a.piles} pile${a.piles>1?'s':''} · ${gorg(a.gorgees)}</span>
      <span class="detail">${jaugeHTML(a)}
        <span class="conseil">${phraseBiais(a)} · régularité ±${fmt(Math.round(a.disp))}</span></span>`;
    L.appendChild(d);
  });
  $('gl-note').textContent = tous.length + ' joueur' + (tous.length>1?'s':'')
    + ' · précision moyenne sur toutes les parties, tous modes et réglages confondus.';
}

// Les modes réellement joués dans ce salon, avec leur nombre de performances
function construireOngletsModes(lignes){
  // pas de « tous les modes » : les échelles de score ne sont pas comparables
  const cpt = {};
  (lignes || []).filter(r => r.points > 0 && !HORS_PANTHEON.includes(r.mode))
    .forEach(r => cpt[r.mode] = (cpt[r.mode] || 0) + 1);
  const ordre = SOLOS.map(s => s.id).filter(id => !HORS_PANTHEON.includes(id));
  const ids = ordre.filter(id => cpt[id]);
  if(!ids.length) ids.push('scoring');
  if(!ids.includes(glMode)) glMode = ids[0];
  const nom = id => (SOLOS.find(s => s.id === id) || {n:id}).n;
  $('gl-modes').innerHTML = ids
    .map(v => `<button data-v="${v}" aria-pressed="${v === glMode}">${esc(nom(v))}`
      + ' · ' + (cpt[v] || 0) + '</button>').join('');
  $('gl-modes').querySelectorAll('button').forEach(b => b.onclick = () => {
    glMode = b.dataset.v; construireGlobal(true);
  });
}

// Scores solo : une ligne par performance, pas une moyenne. Dix meilleures.
function classementSolo(L, lignes){
  majBadgeFiltres();
  const perfs = (lignes || []).filter(r => r.points > 0 && r.mode === glMode)
    .filter(passeFiltres)
    .sort((a,b) => b.points - a.points).slice(0, 10);
  if(!perfs.length){
    L.innerHTML = '<div class="vide">Aucun score pour ce mode'
      + (glAff !== 'tout' || glDiff !== 'tout' ? ' avec ces filtres' : '') + '.</div>';
    return;
  }
  perfs.forEach((r,i) => {
    const prec = r.tours ? Math.round(r.somme / r.tours) : 0;
    const d = document.createElement('div');
    d.className = 'ligne';
    d.innerHTML = `<span class="pos">${i+1}</span>
      <span class="qui" style="color:${coulHash(r.pseudo)}">${esc(r.pseudo)}</span>
      <span class="moy ${i===0?'t-laiton':''}">${r.points} pts</span>
      <span class="bu">${(SOLOS.find(s => s.id === r.mode) || {n:r.mode}).n}
        · précision ±${fmt(prec)} · ${r.piles} pile${r.piles>1?'s':''}</span>`;
    L.appendChild(d);
  });
  const nomM = (SOLOS.find(s => s.id === glMode) || {n:glMode}).n;
  const detail = [glAff !== 'tout' ? (glAff === 'aveugle' ? "à l'aveugle" : 'visible') : null,
                  glDiff !== 'tout' ? glDiff : null].filter(Boolean).join(' · ');
  $('gl-note').textContent = 'Dix meilleures performances · ' + nomM
    + (detail ? ' · ' + detail : '') + ' · chaque ligne est une partie.';
}

/* ════════ SCORES D'ENTRAÎNEMENT ════════ */
let scFiltre = 'config';
$('go-scores').onclick = () => { construireScores(); montrer('scores'); };
$('sc-retour').onclick = () => { construirePantheon(); montrer('pantheon'); };
$('gl-local').onclick  = () => { construirePantheon(); montrer('pantheon'); };
segmente('seg-sc', v => { scFiltre = v; construireScores(); });

function construireScores(){
  // le défi a son propre tableau, sur sa page
  const sig = sigCourante();
  $('sc-config').textContent = libelleSig(sig);
  const L = $('sc-liste'); L.innerHTML = '';
  const tous = (MEM.scores || []).slice();
  const liste = (scFiltre === 'config' ? tous.filter(e => signature(e) === sig) : tous)
                .sort((a,b) => b.p - a.p);

  if(!liste.length){
    L.innerHTML = '<div class="vide">Aucun score enregistré'
      + (scFiltre === 'config' ? ' pour ces réglages.' : '.') + '<br>'
      + 'Jouez une partie en Mode Solo.</div>';
    $('sc-note').textContent = "Les scores ne se comparent qu'à réglages identiques : "
      + "l'affichage et la difficulté changent complètement la donne.";
    return;
  }
  liste.slice(0, 60).forEach((e,i) => {
    const d = new Date(e.d);
    const jour = d.toLocaleDateString('fr-FR', {day:'2-digit', month:'short'});
    const el = document.createElement('div');
    el.className = 'ligne';
    el.innerHTML = `<span class="pos">${i+1}</span>
      <span class="qui" style="color:${coulHash(e.n)}">${esc(e.n)}</span>
      <span class="moy ${i===0?'t-laiton':''}">${e.p} pts</span>
      <span class="bu">précision ±${fmt(e.prec)} · ${jour}</span>
      ${scFiltre === 'tous' ? `<span class="sc-conf">${libelleSig(signature(e))}</span>` : ''}`;
    L.appendChild(el);
  });
  $('sc-note').textContent = liste.length + ' score' + (liste.length>1?'s':'')
    + (scFiltre === 'config' ? ' pour ces réglages. ' : ' au total. ')
    + "Un score n'est comparable qu'à réglages identiques.";
}

/* ════════ ONGLET TEST ════════ */
// les modes sont des réglages à part entière : on les choisit, on ne les lance pas
// Les modes solo mis en avant dans le menu : les autres restent en test
// tant qu'ils n'ont pas fait leurs preuves.
const SOLO_MENU = ['defi', 'scoring', 'survie', 'cascade', 'reflexe', 'nues'];
/* le défi du jour a sa place en tête du menu principal : l'afficher une
   seconde fois dans la liste Solo ferait doublon */
const SOLO_LISTE = SOLO_MENU.filter(id => id !== 'defi');

function carteMode(m){
  const d = document.createElement('div');
  d.className = 'evt choisir' + (CFG.mode === m.id ? ' actif' : '');
  d.dataset.mode = m.id;
  d.innerHTML = `<span class="coche">choisi</span>
    <div class="n">${m.n}</div><div class="d">${m.d}</div>`;
  if(m.id === 'survie' && repriseDispo()){
    const r = repriseDispo();
    d.innerHTML += '<div class="b"><span class="tag vif">partie en cours · tour '
      + r.tour + '</span></div>';
  }
  if(m.id === 'defi'){
    d.classList.add('defi-carte');
    const rest = essaisRestants();
    d.innerHTML += `<div class="b"><span class="tag${rest ? ' vif' : ''}">`
      + (rest ? (MAX_ESSAIS_DEFI - rest) + ' / ' + MAX_ESSAIS_DEFI + ' tentatives · '
                + rest + ' restante' + (rest > 1 ? 's' : '')
              : 'épuisé · revenez demain') + '</span></div>';
    if(!rest) d.classList.add('epuise');
    // essai en test (point 3, non déployé à tout le monde) : la série ne
    // s'affiche que si la dernière tentative remonte à hier au plus tard,
    // sinon le nombre stocké serait déjà périmé
    const streak = MEM.defiStreak;
    if(compteTestAutorise() && streak && streak.n > 1 && streak.jour >= jourEpoque() - 1)
      d.innerHTML += '<div class="b"><span class="tag">🔥 ' + streak.n + ' jours de suite</span></div>';
  }
  d.onclick = () => { MEM.joueurs = lireListe(); ouvrirFiche(m.id); };
  return d;
}
/* Le menu ne présente plus que trois entrées : le rendez-vous du jour, et
   deux portes vers les listes complètes. Les listes elles-mêmes n'ont pas
   bougé — elles vivent maintenant sur leur propre écran. */
function carteNav(ic, nom, desc, action){
  const b = document.createElement('button');
  b.className = 'nav-carte';
  b.innerHTML = `<span class="ic">${ic}</span>
    <span class="txt"><span class="n">${nom}</span><span class="d">${desc}</span></span>
    <span class="fl">›</span>`;
  b.onclick = action;
  return b;
}
function construireMenuPrincipal(){
  const M = $('menu-principal');
  if(!M) return;
  M.innerHTML = '';
  const defi = SOLOS.find(x => x.id === 'defi');
  if(defi) M.appendChild(carteMode(defi));
  M.appendChild(carteNav('🎯', 'Solo',
    'Un joueur, un score, une progression.',
    () => { MEM.joueurs = lireListe(); construireModes(); montrer('menu-solo'); }));
  M.appendChild(carteNav('↕️', 'Duo',
    "Face à face, un seul téléphone posé sur la table.", () => ouvrirDuo()));
  M.appendChild(carteNav('🍻', 'Soirée',
    "Plusieurs joueurs autour d'un seul téléphone.",
    () => { MEM.joueurs = lireListe(); construireModes(); montrer('menu-soiree'); }));
}
if($('ms-retour'))  $('ms-retour').onclick  = () => montrer('reglages');
if($('mso-retour')) $('mso-retour').onclick = () => montrer('reglages');

function construireModes(){
  construireMenuPrincipal();
  const S1 = $('modes-solo');
  if(S1){
    S1.innerHTML = '';
    SOLO_LISTE.map(id => SOLOS.find(s => s.id === id)).filter(Boolean)
      .forEach(m => S1.appendChild(carteMode(m)));
    // Aventure reste grisée pour tout le monde, sauf les comptes Google déjà
    // autorisés sur l'onglet Test — même liste, même logique.
    const av = document.createElement('div');
    if(compteTestAutorise()){
      av.className = 'evt choisir';
      av.innerHTML = `<div class="n">Aventure</div>
        <div class="d">Le même chemin que la Survie, une autre économie.</div>`;
      av.onclick = async () => {
        await chargerAvtCompte();
        construireAventureAccueil(); montrer('aventure-accueil');
      };
    } else {
      av.className = 'evt epuise';
      av.innerHTML = `<div class="n">Aventure</div>
        <div class="d">Le même chemin que la Survie, une autre économie.</div>
        <div class="b"><span class="tag">bientôt disponible</span></div>`;
    }
    S1.appendChild(av);
  }
  const M = $('modes-menu'); M.innerHTML = '';
  MODES.filter(m => !m.test).forEach(m => M.appendChild(carteMode(m)));
}

function construireTest(){
  construireModes();
  const T = $('liste-soirees');
  if(T){
    T.innerHTML = '';
    MODES.filter(m => m.test).forEach(m => {
      const d = document.createElement('div');
      d.className = 'evt choisir' + (CFG.mode === m.id ? ' actif' : '');
      d.innerHTML = `<span class="coche">choisi</span>
        <div class="n">${m.n}</div><div class="d">${m.d}</div>
        <div class="b"><button>Lancer</button></div>`;
      d.querySelector('button').onclick = () => { CFG.mode = m.id;
        MEM.cfg = {...CFG}; ecrireMem(); demarrerPartie(); };
      d.querySelector('.n').onclick = () => ouvrirFiche(m.id);
      T.appendChild(d);
    });
  }
  const cartesSolo = (cible, liste) => {
    const M = $(cible);
    if(!M) return;
    M.innerHTML = '';
    liste.forEach(s => {
      const d = document.createElement('div');
      d.className = 'evt choisir' + (CFG.mode === s.id ? ' actif' : '');
      d.innerHTML = `<span class="coche">choisi</span>
        <div class="n">${s.n}</div><div class="d">${s.d}</div>
        <div class="b"><button>Lancer</button></div>`;
      d.querySelector('button').onclick = () => {
        CFG.mode = s.id;
        MEM.cfg = {...CFG}; ecrireMem();
        construireModes(); construireTest(); appliquerCfg(); rafraichir();
        peupler();
        demarrerPartie();
      };
      d.querySelector('.n').onclick = () => ouvrirFiche(s.id);
      M.appendChild(d);
    });
  };
  /* les listes « modes solo » et « laboratoire » ont été retirées de l'onglet
     Test : les modes solo retenus sont dans le menu, et les modes de
     laboratoire ont fini leur office. Seuls restent ici les modes en essai,
     pas encore jugés bons pour le menu. */
  cartesSolo('liste-essai', SOLOS.filter(s => ESSAIS.includes(s.id)));
  construireParamsScore();
  const L = $('liste-evts'); L.innerHTML = '';
  EVTS.forEach(e => {
    const d = document.createElement('div');
    d.className = 'evt';
    d.innerHTML = `<div class="n"><span class="badge"><i>!</i></span>${e.n}</div>
      <div class="d">${e.d}</div>
      <div class="b"><button>Lancer</button>
      ${e.fausse ? '<span class="tag">hors stats</span>' : ''}</div>`;
    d.querySelector('button').onclick = () => {
      if(!S.partie && !demarrerPartie()) return;
      S.force = e.id; S.duel = null; S.prochain = null;
      tirerEvenement();
      afficherPret();
    };
    L.appendChild(d);
  });
}
const MDP_TEST = 'TEST12';
let testOuvert = false;

const COMPTES_TEST_AUTORISES = ['allongueville1@gmail.com', 'lecoustrehugo@gmail.com'];
// true si la session courante est un compte Google et figure dans la liste.
// Un compte identifiant/mot de passe a une adresse @krono.local fictive, donc
// il ne peut jamais matcher ici — seule une vraie connexion Google le peut.
const compteTestAutorise = () => !!(SESSION && SESSION.email
  && COMPTES_TEST_AUTORISES.includes(SESSION.email.toLowerCase()));

function verrouTest(){
  // le mot de passe reste une porte de secours ; un compte Google autorisé
  // déverrouille directement, sans rien taper
  if(compteTestAutorise()) testOuvert = true;
  $('test-verrou').style.display = testOuvert ? 'none' : 'block';
  $('test-contenu').style.display = testOuvert ? 'block' : 'none';
  if(!testOuvert){ $('test-mdp').value = ''; $('test-err').textContent = ''; }
}
function tenterMdp(){
  if($('test-mdp').value.trim().toUpperCase() === MDP_TEST){
    testOuvert = true; verrouTest(); majLatence(); construireUsage();
    construireSvOpts(); construireBioEssai(); construireBioTest(); construireTest();
  } else {
    $('test-err').textContent = 'Mot de passe incorrect.';
    $('test-mdp').value = '';
  }
}
$('test-ok').onclick = tenterMdp;
$('test-mdp').addEventListener('keydown', e => { if(e.key === 'Enter') tenterMdp(); });

// moyenne sur les dix derniers appuis : une mesure isolée ne dit rien
function noterLatence(ms){
  S.latences.push(ms);
  if(S.latences.length > 10) S.latences.shift();
}
// Journal détaillé des appuis, pour le tableau de l'onglet Test.
//   clic   : horodatage matériel de l'événement (ms depuis le chargement)
//   delai  : temps que la boucle JavaScript a mis à traiter l'appui
//   retire : ce qui a été effectivement retranché au chrono, selon le mode
function noterDelai(clic, delai){
  let retire;
  if(CFG.lat === 'brut')       retire = 0;              // aucune compensation
  else if(CFG.lat === 'fixe')  retire = LAT_FIXE;       // −24 ms forfaitaires
  else                         retire = CFG.horo ? delai : 0;  // horodatage matériel
  S.delais.push({clic:Math.round(clic), delai, retire});
  if(S.delais.length > 10) S.delais.shift();
}
const SV_OPTS = [
  {c:'flouOcean', n:'Océan flou', d:"À l'essai. Dans le biome Océan, le chiffre du chrono devient flou, comme lu à travers l'eau."},
  {c:'son',     n:'Son',     d:"Battement qui s'accélère quand la zone se resserre, et retours sonores."},
  {c:'vibr',    n:'Vibration', d:"Retour haptique court sur un gain, long sur une perte."},
  {c:'anim',    n:'Anneau animé', d:"Transition douce de l'anneau et pulsation en zone critique."},
  {c:'musique', n:'Musique', d:"Nappe synthwave synthétisée : basse tenue et arpège, dont le tempo monte quand la zone se resserre."},
  {c:'ambiance', n:'Ambiances', d:"Vent, pluie, tonnerre, grondements : un son propre à chaque décor, toutes les cinq à onze secondes."},
  {c:'bloquer', n:'Bascule bloquante', d:"Au changement de décor, le bouton Démarrer reste inactif le temps de l'animation, puis les règles s'affichent."},
  {c:'fonds',   n:'Fonds animés', d:"Feuillage qui oscille, pluie en biais, rails qui défilent : une animation de fond propre à chaque décor."},
  {c:'biomes',  n:'Biomes',  d:"Douze décors, un tous les trente tours, chacun avec son malus et son bonus."},
  {c:'triche',  n:'Invincible', d:"Banc d'essai : une sortie de zone ne tue plus, elle coûte 2 centièmes. Permet d'atteindre les derniers biomes."}
];
function construireBioEssai(){
  const B = $('bio-essai');
  if(!B) return;
  B.innerHTML = '';
  BIOMES.forEach((b, i) => {
    const d = document.createElement('button');
    d.style.color = b.accent;
    d.style.borderColor = b.accent + '55';
    d.innerHTML = `<span style="position:relative">${esc(b.n)}</span>
      <b>tour ${i * TOURS_BIOME + 1}</b>`;
    d.querySelector('span').insertAdjacentHTML('beforebegin',
      `<i style="position:absolute;inset:0;background:${b.accent};opacity:.1"></i>`);
    d.onclick = () => essayerBiome(i);
    B.appendChild(d);
  });
}
async function essayerBiome(i){
  // on solde entièrement la partie précédente : minuteries, cartes, musique
  purgerMinuteries(); purgerBiome();
  if(S.tEffet){ clearTimeout(S.tEffet); S.tEffet = null; }
  if(S.tCine){ clearTimeout(S.tCine); S.tCine = null; }
  $('f-effet').classList.remove('on', 'bloquant');
  arreterBattement(); arreterMusique(); arreterAmbiance();
  CFG.mode = 'survie';
  CFG.sv.biomes = true; CFG.sv.triche = true;
  MEM.cfg = {...CFG}; await ecrireMem();
  peupler();
  await demarrerPartie();
  // on se place au premier tour du biome demandé
  S.tour = i * TOURS_BIOME + 1;
  S.essaiBiome = {debut:S.tour, fin:S.tour + TOURS_BIOME - 1};
  // un décor qui décompte doit partir de haut, sinon il n'y a rien à descendre
  S.total = biomeDe(S.tour).eff.rebours ? 3000 : 0;
  S.cible = cibleSuivante(S.total); S.cibleBase = S.cible;
  S.zoneSurvie = ZONE_DEPART_SURVIE + effB('zoneDep');
  S.biome = null;
  fluidePret();
  // les règles du décor s'affichent et attendent un appui
  const b = biomeDe(S.tour);
  S.biome = b.id;
  $('fluide').setAttribute('data-biome', b.id);
  $('fluide').style.setProperty('--bio-accent', b.accent);
  $('fluide').style.setProperty('--bio-halo', b.halo);
  $('fluide').style.setProperty('--bio-fond', b.fond);
  $('f-biome').textContent = b.n; $('f-biome').classList.add('on');
  appliquerEffetsBiome();
  construireSvOpts();
  // On annonce après que tout le démarrage asynchrone est retombé : sinon une
  // carte issue de la partie précédente écraserait celle-ci.
  setTimeout(() => {
    if(!S.essaiBiome || !S.partie) return;
    annoncerEffet(biomeDe(S.tour), true);
  }, 40);
}

function construireBioTest(){
  const B = $('bio-test');
  if(!B) return;
  B.innerHTML = '';
  BIOMES_TEST.forEach(b => {
    const d = document.createElement('button');
    d.style.color = b.accent;
    d.style.borderColor = b.accent + '55';
    d.innerHTML = `<span style="position:relative">${esc(b.n)}</span>
      <b>essai</b>`;
    d.querySelector('span').insertAdjacentHTML('beforebegin',
      `<i style="position:absolute;inset:0;background:${b.accent};opacity:.1"></i>`);
    d.onclick = () => essayerBiomeTest(b.id);
    B.appendChild(d);
  });
}

// Comme essayerBiome, mais le décor n'appartient à aucun palier : on le force.
async function essayerBiomeTest(id){
  const b = BIOMES_TEST.find(x => x.id === id);
  if(!b) return;
  purgerMinuteries(); purgerBiome();
  if(S.tEffet){ clearTimeout(S.tEffet); S.tEffet = null; }
  if(S.tCine){ clearTimeout(S.tCine); S.tCine = null; }
  $('f-effet').classList.remove('on', 'bloquant');
  arreterBattement(); arreterMusique(); arreterAmbiance();
  CFG.mode = 'survie';
  CFG.sv.biomes = true; CFG.sv.triche = true;
  MEM.cfg = {...CFG}; await ecrireMem();
  peupler();
  await demarrerPartie();
  S.biomeForce = id;
  S.tour = 1;
  S.essaiBiome = {debut:1, fin:TOURS_BIOME};
  S.total = b.eff.rebours ? 3000 : 0;
  S.cible = cibleSuivante(S.total); S.cibleBase = S.cible;
  S.zoneSurvie = (b.eff.reset || ZONE_DEPART_SURVIE) + (b.eff.zoneDep || 0);
  S.biome = null;
  fluidePret();
  S.biome = b.id;
  $('fluide').setAttribute('data-biome', b.id);
  $('fluide').style.setProperty('--bio-accent', b.accent);
  $('fluide').style.setProperty('--bio-halo', b.halo);
  $('fluide').style.setProperty('--bio-fond', b.fond);
  $('f-biome').textContent = b.n; $('f-biome').classList.add('on');
  appliquerEffetsBiome();
  construireSvOpts();
  setTimeout(() => {
    if(!S.essaiBiome || !S.partie) return;
    annoncerEffet(b, true);
  }, 40);
}

function construireSvOpts(){
  const B = $('sv-opts');
  if(!B) return;
  CFG.sv = Object.assign({paliers:true, pari:false, son:true, vibr:true,
                          anim:true, evenements:false, musique:true, biomes:true,
                          triche:false, intro:'cine', ambiance:true, bloquer:true,
                          fonds:true, flouOcean:false},
                         CFG.sv || {});
  B.innerHTML = '';
  SV_OPTS.forEach(o => {
    const d = document.createElement('div');
    d.className = 'evt' + (CFG.sv[o.c] ? ' actif' : '');
    d.innerHTML = `<span class="coche">actif</span>
      <div class="n">${o.n}</div><div class="d">${o.d}</div>
      <div class="b"><button>${CFG.sv[o.c] ? 'Couper' : 'Activer'}</button></div>`;
    d.querySelector('button').onclick = () => {
      CFG.sv[o.c] = !CFG.sv[o.c];
      MEM.cfg = {...CFG}; ecrireMem();
      if(!CFG.sv.son || !CFG.sv.musique){ arreterBattement(); arreterMusique(); }
      else if(CFG.mode === 'survie' && S.partie) lancerMusique();
      construireSvOpts();
    };
    B.appendChild(d);
  });
}

function construireUsage(){
  const U = $('usage-bloc');
  if(!U) return;
  const u = MEM.usage || {heures:{}, modes:{}, reflexes:[], parties:0};
  if(!u.parties){
    U.innerHTML = '<div class="note">Aucune partie enregistrée pour l\'instant.</div>';
    return;
  }
  // répartition horaire, sur 24 barres
  const maxH = Math.max(1, ...Object.values(u.heures));
  const heures = [...Array(24)].map((_, i) => {
    const n = u.heures[String(i)] || 0;
    return `<span class="h-b" title="${i} h · ${n}">
      <i style="height:${Math.round(n / maxH * 100)}%"></i></span>`;
  }).join('');
  const pointe = Object.entries(u.heures).sort((a,b) => b[1] - a[1])[0];

  const modes = Object.entries(u.modes).sort((a,b) => b[1].parties - a[1].parties)
    .map(([id, m]) => {
      const nom = (SOLOS.find(s => s.id === id) || MODES.find(x => x.id === id) || {n:id}).n;
      const taux = Math.round(m.finies / m.parties * 100);
      return `<div class="u-l"><span class="u-n">${esc(nom)}</span>
        <span class="u-bar"><i style="width:${Math.round(m.parties / u.parties * 100)}%"></i></span>
        <span class="u-v">${m.parties}</span>
        <span class="u-t">${taux}% finies</span></div>`;
    }).join('');

  const R = u.reflexes || [];
  const moyR = R.length ? Math.round(R.reduce((a,b) => a+b, 0) / R.length) : null;

  U.innerHTML = `
    <div class="carte-verdict" style="margin-top:10px">
      <div class="titre">${u.parties} partie${u.parties>1?'s':''}</div>
      <div class="sous">${pointe ? 'heure de pointe : ' + pointe[0] + ' h' : ''}
        ${moyR ? ' · réflexe moyen ' + moyR + ' ms sur ' + R.length + ' parties' : ''}</div>
    </div>
    <div class="titre-sec" style="margin-top:14px">Heures de jeu</div>
    <div class="h-graph">${heures}</div>
    <div class="h-ech"><span>0 h</span><span>12 h</span><span>23 h</span></div>
    <div class="titre-sec" style="margin-top:14px">Modes joués</div>
    ${modes}
    <div style="margin-top:12px">
      <button class="bouton fantome" id="usage-raz">Effacer ces statistiques</button>
    </div>`;
  const b = $('usage-raz');
  if(b) b.onclick = async () => {
    MEM.usage = {heures:{}, modes:{}, reflexes:[], parties:0};
    await ecrireMem(); construireUsage();
  };
}

function majDelais(){
  const T = $('test-delais');
  if(!T) return;
  const D = S.delais || [];
  if(!D.length){ T.innerHTML = '<div class="note">Aucun appui mesuré pour l\'instant.</div>'; return; }
  const lignes = D.slice().reverse().map((d, i) => {
    const s = (d.clic / 1000);
    const clic = s >= 60 ? Math.floor(s/60) + ':' + (s%60).toFixed(2).padStart(5,'0')
                         : s.toFixed(2) + ' s';
    return `<tr class="${i===0?'recent':''}">
      <td>${clic}</td>
      <td>${d.delai}<span class="u">ms</span></td>
      <td>${d.retire ? '−' + d.retire : '0'}<span class="u">ms</span></td></tr>`;
  }).join('');
  T.innerHTML = `<table class="dtab"><tr>
      <th>Heure au clic</th><th>Délai de traitement</th><th>Retranché</th></tr>
      ${lignes}</table>`;
}
function majLatence(){
  majDelais();
  const L = S.latences;
  if(!L.length){
    $('lat-moy').textContent = '—';
    $('test-lat').textContent = '';
    $('lat-txt').textContent = "Aucune mesure pour l'instant. Jouez quelques tours et revenez.";
    $('lat-liste').innerHTML = '';
    return;
  }
  const moy = Math.round(L.reduce((a,b) => a+b, 0) / L.length);
  const mini = Math.min(...L), maxi = Math.max(...L);
  $('lat-moy').textContent = moy + ' ms';
  $('test-lat').textContent = moy + ' ms retranchés';
  $('lat-txt').textContent = 'Moyenne retranchée sur les ' + L.length + ' derniers lancers'
    + ' · de ' + mini + ' à ' + maxi + ' ms.'
    + (CFG.horo ? ' Ce délai est retranché du chrono.'
                : ' Ce délai n\'est PAS retranché : mode heure de traitement.');
  // le détail compte autant que la moyenne : c'est la dispersion qui gêne le joueur
  const ech = Math.max(maxi, 1);
  $('lat-liste').innerHTML = L.slice().reverse().map((v,i) =>
    `<span class="lat-l${i===0?' recent':''}"><span class="no">${L.length-i}</span>
     <span class="bar"><i style="width:${Math.round(v/ech*100)}%"></i></span>
     <span class="ms">${v} ms</span></span>`).join('');
}

/* ════════ CONFORT MOBILE ════════ */
function vibrer(m){ if(navigator.vibrate) try{ navigator.vibrate(m); }catch(e){} }
async function garderEcranAllume(){
  try{ if('wakeLock' in navigator) await navigator.wakeLock.request('screen'); }catch(e){}
}
document.addEventListener('gesturestart', e => e.preventDefault());
addEventListener('error', () => {
  S.encours = false;
  if(!document.querySelector('.ecran.actif'))
    montrer(S.partie ? ecranJeu() : 'reglages');
});
// service worker : rend l'app utilisable hors ligne une fois installée
if('serviceWorker' in navigator && location.protocol.startsWith('http'))
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* ════════ DÉMARRAGE ════════ */
(async function init(){
  const m = await lireMem();
  if(m){
    MEM = Object.assign(NEUF(), m);
    if(m.cfg){ Object.assign(CFG, m.cfg); }
  }
  appliquerCfg();   // toujours, pour poser le thème dès le premier lancement
  memoriser([...(MEM.joueurs || []), ...Object.keys(MEM.profils || {})]);
  majDatalist();
  S.salon = MEM.salon || null;
  SESSION = lireSession();
  lireInvitation();
  await reprendreApresGoogle();
  peupler(); majMem(); construireTest(); rafraichir(); majEtatSalon();
  viderFile();
  // Le HTML fige « reglages » comme écran actif par défaut, mais sans passer
  // par montrer() la barre du bas ne reçoit jamais sa classe .on ni l'écran
  // sa classe .avec-barre (qui réserve la place en bas) : elle restait
  // invisible au lancement, puis chevauchait le contenu dès qu'elle
  // apparaissait ailleurs faute de ce padding.
  injecterRetours();
  montrer(S.partie ? ecranJeu() : 'reglages', true);
  // un lien de duel ouvert directement propose de rejoindre tout de suite ;
  // sans compte, parcoursRejoindreDuel garde le code de côté pour après
  if(INVITATION_DUEL){
    const code = INVITATION_DUEL;
    choisir('Duel reçu', 'On vous invite à un duel Krono. Code : ' + code + '.',
      [{label:'Rejoindre', val:true}, {label:'Plus tard', val:false}])
      .then(ok => { if(ok){ ouvrirDuel(); parcoursRejoindreDuel(code); } });
  }
})();
