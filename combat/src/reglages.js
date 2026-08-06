// ─────────────────────────────────────────────────────────────
// RÉGLAGES
// ─────────────────────────────────────────────────────────────
const CFG = {
  gravite:       2200,
  vitesseSaut:   700,
  sautAerien:    620,   // le second saut, un peu plus court que le premier
  coupureSaut:   220,
  coyote:        0.10,
  bufferSaut:    0.12,
  vitesseCourse: 330,   // joystick à fond ; l'axe étant analogique, tout
  vitesseAccroupi: 78,  // ce qui est en dessous donne une allure plus lente
  accel:         2000,
  frein:         2600,
  controleAir:   0.55,
  pvJoueur:      5,
  invincibilite: 0.9,
  invulnRenais:  1.8,   // le temps de souffler quand on réapparaît
  zoneMorte:     0.24,  // part du rayon du joystick ignorée au centre
  seuilHaut:     0.45,  // au-delà, le joystick vers le haut = uppercut
  seuilBas:      0.45,  // au-delà, le joystick vers le bas = accroupi
  chanceCoeur:   0.35,
  viesDepart:    3,     // au-delà, game over et retour à l'écran d'accueil
  viesMax:       5,     // les vies en cadeau des boss ne s'empilent pas au-delà
  rebondEcrase:  430,   // rebond quand on écrase une bestiole en retombant
  segmentsParBracelet: 3,  // un bracelet ramassé porte 3 segments d'énergie
  segmentsMax:   5,     // réserve maximale de segments de rechange
  porteeElastique: 1.65,// un coup élastique porte 65 % plus loin et fait +1 dégât
  seuilElastique: 0.25, // tenir un coup au moins ce temps le rend élastique
  chargeMax:     0.8,   // au-delà, le coup part tout seul
  enduranceMax:  3,     // coups élastiques et doubles sauts puisent dedans
  enduranceRegen: 0.9,  // et elle revient vite : vide → pleine en ~3 s  // proportion de monstres vaincus qui lâchent un cœur
};

// Les zones de coup sont mesurées depuis les PIEDS du personnage, comme
// son dessin : c'est le seul repère qui reste juste quand il s'accroupit.
const PIEDS = 20;
const DECALAGE_ACCROUPI = 16;

const COUPS = {
  poing:    { duree:0.26, debut:0.05, fin:0.14, portee: 26, hauteur:32, dy:-40, degats:1, recul:210, elan: 40, secousse:0.004, son:'poing' },
  pied:     { duree:0.44, debut:0.13, fin:0.27, portee: 36, hauteur:34, dy:-34, degats:2, recul:360, elan:120, secousse:0.009, son:'pied' },
  crochet:  { duree:0.30, debut:0.07, fin:0.17, portee: 26, hauteur:38, dy:-54, degats:2, recul:260, elan:  0, secousse:0.007, son:'poing' },
  retourne: { duree:0.62, debut:0.20, fin:0.40, portee: 34, hauteur:40, dy:-34, degats:3, recul:430, elan:  0, secousse:0.013, son:'retourne', bilateral:true },
  laser:    { duree:0.34, debut:0.06, fin:0.13, portee:520, hauteur:20, dy:-40, degats:3, recul:300, elan:0, secousse:0.011, son:'laser', faisceau:true },
  pistolet: { duree:0.20, debut:0.05, fin:0.06, portee:  0, hauteur: 0, dy:-40, degats:2, recul:180, elan:0, secousse:0.005, son:'pistolet', tir:{ nb:1, vitesse:820, dispersion:0 } },
  fusil:    { duree:0.52, debut:0.07, fin:0.08, portee:  0, hauteur: 0, dy:-38, degats:2, recul:320, elan:0, secousse:0.014, son:'fusil',    tir:{ nb:3, vitesse:700, dispersion:0.13 } },
  // l'éjection du segment usé : le rechargement est lui-même une attaque
  jet:      { duree:0.30, debut:0, fin:0, portee:  0, hauteur: 0, dy:-40, degats:2, recul:260, elan:0, secousse:0.004, son:'ejecte', jet:true },
};

// nom : dans le HUD et les messages ; court : sur le bouton rond
const ARMES = {
  laser:    { nom:'AQUAMÉHA',     court:'AQUA',   munitions:8,  couleur:0xc46bff, clair:0xe9b6ff },
  pistolet: { nom:'BOULE DE FEU', court:'FEU',    munitions:14, couleur:0xffd166, clair:0xfff0c2 },
  fusil:    { nom:'TRIPLE FEU',   court:'TRIPLE', munitions:6,  couleur:0xff7b54, clair:0xffc2ac },
};

// Chaque bestiole n'est vulnérable qu'à une hauteur : c'est ce qui donne
// son intérêt à l'accroupissement et à l'uppercut.
const MONSTRES = {
  baveux:  { pv:3,  taille:[26,30], vitesse: 85, patrouille:45, degats:0.25, vol:0,  faible:'bas',  silhouette:'brute' },
  drone:   { pv:2,  taille:[26,24], vitesse:110, patrouille:60, degats:1, vol:46, faible:'haut', silhouette:'drone', vole:true },
  colosse: { pv:6,  taille:[38,44], vitesse: 52, patrouille:30, degats:2, vol:0,  faible:null,   silhouette:'brute', gros:true },
  // le gardien annonce son coup : il se ramasse, puis se détend d'un bloc
  gardien: { pv:4,  taille:[28,40], vitesse:120, patrouille:70, degats:1, vol:0,  faible:null,   silhouette:'gardien',
             charge:{ portee:210, preparation:0.45, elan:430, repos:1.9 } },
  // la tourelle ne bouge pas, elle vise et tire — avec un temps de visée
  tourelle:{ pv:3,  taille:[30,28], vitesse:0,   patrouille:0,  degats:1, vol:0,  faible:null,   silhouette:'tourelle',
             fixe:true, canon:{ portee:430, visee:0.75, repos:2.1, vitesse:430 } },
  // Un boss garde la sortie de chaque étage. Ils réutilisent les
  // silhouettes existantes, en plus gros et avec leur propre couleur.
  cogneur:  { pv:14, taille:[46,52], vitesse: 74, patrouille:34, degats:2, vol:0, faible:null, silhouette:'brute',   gros:true, boss:true,
              nom:'LE COGNEUR',              couleur:0x9b5f2f, ombre:0x6b3d1c },
  chefSecu: { pv:16, taille:[34,48], vitesse:150, patrouille:80, degats:2, vol:0, faible:null, silhouette:'gardien', boss:true,
              nom:'LE CHEF DE LA SÉCURITÉ',  couleur:0x2f8f7a, ombre:0x1c5c4d,
              charge:{ portee:280, preparation:0.36, elan:520, repos:1.4 } },
  canonnier:{ pv:14, taille:[44,38], vitesse:  0, patrouille:0,  degats:1, vol:0, faible:null, silhouette:'tourelle', fixe:true, boss:true,
              nom:'LA TOURELLE LOURDE',      couleur:0x6b4a7f, ombre:0x412c4f,
              canon:{ portee:540, visee:0.5, repos:1.1, vitesse:520 } },
  broyeur:  { pv:18, taille:[50,58], vitesse: 92, patrouille:44, degats:2, vol:0, faible:null, silhouette:'brute',   gros:true, boss:true,
              nom:'LE BROYEUR',              couleur:0xb03a3a, ombre:0x762222 },
  grandBaveux:{ pv:10, taille:[44,50], vitesse: 70, patrouille:36, degats:1, vol:0, faible:null, silhouette:'brute',   gros:true, boss:true,
              nom:'LE GRAND BAVEUX',         couleur:0x8f5fae, ombre:0x5d3a78 },
  scorpion: { pv:12, taille:[34,44], vitesse:135, patrouille:70, degats:1, vol:0, faible:null, silhouette:'gardien', boss:true,
              nom:'LE SCORPION DES SABLES',  couleur:0xc2913a, ombre:0x8a6220,
              charge:{ portee:250, preparation:0.40, elan:480, repos:1.6 } },
  sentinelle:{ pv:12, taille:[36,32], vitesse:  0, patrouille:0,  degats:1, vol:0, faible:null, silhouette:'tourelle', fixe:true, boss:true,
              nom:'LA SENTINELLE',           couleur:0x5a7fa8, ombre:0x39536f,
              canon:{ portee:480, visee:0.6, repos:1.5, vitesse:470 } },
  patron:   { pv:26, taille:[58,66], vitesse: 82, patrouille:40, degats:2, vol:0, faible:null, silhouette:'brute',   gros:true, boss:true, final:true,
              nom:'LE PATRON',               couleur:0x9b2f2f, ombre:0x631d1d },
};

const L = 900, H = 480, SOL_Y = 380;

const COUL = {
  sol:0x0a0d1a, solBord:0x39457a, plat:0x16463f, platBord:0x4dd6c1,
  solVille:0x121018, solBordVille:0xe0a44c,
  solDedans:0x1a1f38, solBordDedans:0x5a6ea8,
  solToit:0x23283f,   solBordToit:0x8f9ad0,
  gi:0xf2e6cf, giOmbre:0xd3c0a0, ceinture:0xff9d2e,
  peau:0xf0c090, peauOmbre:0xc9a377, cheveux:0x181d30, col:0x2b7d72, botte:0x232a45,
  baveux:0x7b3f8f, baveuxOmbre:0x552a63, baveuxOeil:0xffe08a,
  drone:0x39406b, droneOmbre:0x252a4a, droneOeil:0xff5e5e,
  colosse:0x8f4a3f, colosseOmbre:0x612f28, colosseOeil:0xffe08a,
  gardien:0x2f6d8f, gardienOmbre:0x1d4560, gardienVisiere:0x8fe6ff,
  tourelle:0x4a4f6b, tourelleOmbre:0x2e3248, tourelleOeil:0xff5e5e,
  patron:0x9b2f2f, patronOmbre:0x631d1d,
  bois:0x8a5a2b, boisClair:0xb07a3e, boisOmbre:0x6d4420,
  blinde:0x6f9bff,
  poussiere:0x6b7399,
  tirEnnemi:0xff6b5e,
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
  const d = localStorage.getItem('mgc-difficulte');
  if (DIFFICULTES[d]) DIFFICULTE_CHOISIE = d;
} catch (e) {}

// Les onomatopées, façon manga. Chaque contexte pioche dans son bocal.
const CRIS = {
  coup:     ['BAM !', 'PAF !', 'BIM !', 'TCHAK !', 'POW !'],
  kiai:     ['HA !', 'YAH !', 'HOP !'],
  vaincu:   ['SPLAF !', 'PAF !', 'OUF !'],
  boss:     ['K.O. !'],
  blinde:   ['TING !', 'CLANG !'],
  aie:      ['AÏE !', 'OUCH !', 'OUILLE !', 'OH !'],
  ecrase:   ['SPROTCH !', 'SPLAT !'],
  caisse:   ['CRAC !'],
};

const HANCHE = -19, EPAULE = -30, TETE = -35;
