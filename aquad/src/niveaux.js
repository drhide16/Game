// ─────────────────────────────────────────────────────────────
// LES ZONES
// Chaque zone est une île : un rectangle de terre cerné d'eau. On en
// sort par le ponton, à l'est, une fois le boss à terre.
// largeur/hauteur = la TERRE ; l'eau fait le tour par-dessus.
// ─────────────────────────────────────────────────────────────
const NIVEAUX = [
  { nom:"L'ÎLE", sous:'un matin dans le lagon', largeur:2000, hauteur:1100,
    peuple:['crabe','crabe','meduse','bernard'], boss:'roiCrabe',
    caisses:5, pierres:6, monstres:9,
    teinte:{ herbe:0x7fb35e, herbeSombre:0x639446, sable:0xe8d49a } },
  { nom:'LE LAGON', sous:'les eaux troubles', largeur:2300, hauteur:1200,
    peuple:['meduse','meduse','crabe','bernard'], boss:'reineMeduse',
    caisses:6, pierres:7, monstres:11,
    teinte:{ herbe:0x5e9c8a, herbeSombre:0x477a6b, sable:0xd8cba0 } },
];
