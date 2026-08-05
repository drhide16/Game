// ─────────────────────────────────────────────────────────────
// RÉGLAGES
// AquaD se joue vu de dessus : pas de gravité, pas de saut — et ✕
// soulève les pierres et les caisses pour les lancer sur la faune.
// Tout l'équilibrage est ici.
// ─────────────────────────────────────────────────────────────
const CFG = {
  vitesse:       250,   // joystick à fond ; l'axe est analogique
  accel:         2100,
  frein:         2600,
  porteVitesse:  0.75,  // on marche moins vite avec une caisse sur la tête
  lancerVitesse: 520,   // l'objet lancé file à cette vitesse
  lancerDegats:  2,
  pvJoueur:      5,
  invincibilite: 0.9,
  invulnRenais:  1.8,
  // lisibilité du contact : le jeu se joue sur les OMBRES, pas les corps
  hurtbox:       0.7,   // part de la boîte du héros qui encaisse (les frôlements pardonnent)
  contactMonstre:0.85,  // part de la boîte du monstre qui blesse au contact
  aimantCone:    0.7,   // un coup pivote vers l'ennemi à ± ce cône (radians) du regard
  aimantPortee:  90,    // rayon d'aimantation des coups au corps
  aimantPorteeTir: 320, // pour les tirs et objets lancés (cône moitié plus étroit)
  zoneMorte:     0.24,  // part du rayon du joystick ignorée au centre
  chanceCoeur:   0.35,
  porteeElastique: 1.65,// un coup élastique porte 65 % plus loin et fait +1 dégât
  seuilElastique: 0.25, // tenir un coup au moins ce temps le rend élastique
  chargeMax:     0.8,   // au-delà, le coup part tout seul
  enduranceMax:  3,     // les coups élastiques puisent dedans
  enduranceRegen: 0.9,  // vide → pleine en ~3 s
  segmentsParBracelet: 3,
  segmentsMax:   5,
};

// Les zones de coup se placent DEVANT le personnage, dans la direction
// regardée. portee = distance ; la zone est un carré de ce côté-là.
const COUPS = {
  poing:    { duree:0.26, debut:0.05, fin:0.14, portee: 30, degats:1, recul:220, elan:  0, secousse:0.004, son:'poing' },
  pied:     { duree:0.44, debut:0.13, fin:0.27, portee: 40, degats:2, recul:370, elan:150, secousse:0.009, son:'pied' },
  laser:    { duree:0.34, debut:0.06, fin:0.13, portee:520, degats:3, recul:300, elan:0, secousse:0.011, son:'laser', faisceau:true },
  pistolet: { duree:0.20, debut:0.05, fin:0.06, portee:  0, degats:2, recul:180, elan:0, secousse:0.005, son:'pistolet', tir:{ nb:1, vitesse:820, dispersion:0 } },
  fusil:    { duree:0.52, debut:0.07, fin:0.08, portee:  0, degats:2, recul:320, elan:0, secousse:0.014, son:'fusil',    tir:{ nb:3, vitesse:700, dispersion:0.13 } },
  jet:      { duree:0.30, debut:0, fin:0, portee:  0, degats:2, recul:260, elan:0, secousse:0.004, son:'ejecte', jet:true },
};

const ARMES = {
  laser:    { nom:'LASER',    munitions:8,  couleur:0xc46bff, clair:0xe9b6ff },
  pistolet: { nom:'PISTOLET', munitions:14, couleur:0xffd166, clair:0xfff0c2 },
  fusil:    { nom:'FUSIL',    munitions:6,  couleur:0xff7b54, clair:0xffc2ac },
};

// La faune du lagon. Vue de dessus, plus de règle des hauteurs : chaque
// bestiole se joue par sa vitesse, sa masse et son comportement.
const MONSTRES = {
  crabe:   { pv:3,  taille:[30,24], vitesse: 68, patrouille:42, degats:1, silhouette:'brute',
             couleur:0xd86a4a, ombre:0x9c4530, oeil:0xffe08a },
  meduse:  { pv:2,  taille:[26,26], vitesse: 52, patrouille:32, degats:1, silhouette:'drone', flotte:true,
             couleur:0x7fb8e8, ombre:0x4a7fb0, oeil:0xff5e5e },
  bernard: { pv:6,  taille:[40,34], vitesse: 38, patrouille:22, degats:2, silhouette:'brute', gros:true,
             couleur:0x8a6a9c, ombre:0x5d4569, oeil:0xffe08a },
  roiCrabe:{ pv:22, taille:[58,46], vitesse: 66, patrouille:40, degats:2, silhouette:'brute', gros:true, boss:true,
             nom:'LE ROI CRABE', couleur:0xc23a2e, ombre:0x7d211a, oeil:0xffd166,
             // il se ramasse puis fonce en travers, comme un crabe
             charge:{ portee:260, preparation:0.45, elan:520, repos:1.7 } },
  reineMeduse:{ pv:26, taille:[54,54], vitesse: 50, patrouille:35, degats:2, silhouette:'drone', flotte:true, boss:true,
             nom:'LA REINE MÉDUSE', couleur:0x9f7fe8, ombre:0x6a4fb0, oeil:0xff5e5e },
};

// ─────────────────────────────────────────────────────────────
// DIFFICULTÉ — choisie sur l'écran-titre, gardée en localStorage
// ─────────────────────────────────────────────────────────────
const DIFFICULTES = {
  facile:    { nom:'FACILE',    monstres:0.7, pv:0.7,  vitesse:0.9,  vies:4 },
  moyen:     { nom:'MOYEN',     monstres:1.0, pv:1.0,  vitesse:1.0,  vies:3 },
  difficile: { nom:'DIFFICILE', monstres:1.5, pv:1.35, vitesse:1.15, vies:3 },
};
let DIFFICULTE_CHOISIE = 'moyen';
try {
  const d = localStorage.getItem('aquad-difficulte');
  if (DIFFICULTES[d]) DIFFICULTE_CHOISIE = d;
} catch (e) {}

// Les onomatopées, façon manga. Chaque contexte pioche dans son bocal.
const CRIS = {
  coup:     ['BAM !', 'PAF !', 'BIM !', 'TCHAK !', 'POW !'],
  kiai:     ['HA !', 'YAH !', 'HOP !'],
  vaincu:   ['SPLAF !', 'PAF !', 'BLOUP !'],
  boss:     ['K.O. !'],
  aie:      ['AÏE !', 'OUCH !', 'OUILLE !', 'OH !'],
  souleve:  ['HOP !'],
  lancer:   ['HAN !'],
  caisse:   ['CRAC !'],
};

const L = 900, H = 480;

// toutes les ombres portées penchent du même côté : le soleil est UNIQUE,
// au nord-ouest — c'est ce qui colle les personnages au sol
const SOLEIL = { x:3, y:4 };

const COUL = {
  // le lagon
  eauProfonde:0x1a6f8e, eau:0x2e9bb8, eauClaire:0x6fd0d8, ecume:0xd8f4ee,
  sable:0xe8d49a, sableOmbre:0xd0b877, herbe:0x7fb35e, herbeSombre:0x639446,
  herbeClaire:0x8fc46e, fleur:0xf2e6cf, fleur2:0xffd166,
  coquillage:0xf5ead0, sableMouille:0xc9ac6e, galet:0x9aa0ac,
  rocher:0x8a8f9c, rocherOmbre:0x5d6270,
  tronc:0x8a5a2b, palme:0x3f8a4f, palmeClaire:0x5cab68,
  ponton:0xb07a3e, pontonOmbre:0x6d4420,
  // le héros (repris de Combat)
  gi:0xf2e6cf, giOmbre:0xd3c0a0, ceinture:0xff9d2e,
  peau:0xf0c090, peauOmbre:0xc9a377, cheveux:0x181d30, col:0x2b7d72, botte:0x232a45,
  bois:0x8a5a2b, boisClair:0xb07a3e, boisOmbre:0x6d4420,
  tirEnnemi:0xff6b5e,
};
const HANCHE = -19, EPAULE = -30, TETE = -35;

// Le monde est tiré au sort, mais toujours à partir de cette graine :
// mourir et réapparaître ne doit pas redessiner l'île sous nos pieds.
let GRAINE = (Math.random() * 1e9) | 0;
function generateur(s){
  return function(){
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
