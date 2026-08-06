// ─────────────────────────────────────────────────────────────
// LES ZONES
// Chaque zone est une île : un rectangle de terre cerné d'eau. On en
// sort par le ponton, à l'est, une fois le boss à terre.
// largeur/hauteur = la TERRE ; l'eau fait le tour par-dessus.
// ─────────────────────────────────────────────────────────────
// Chaque zone est un CHEMIN de disques de terre qui serpente d'ouest en
// est à travers l'eau : noeuds étroits (le sentier), et quelques nœuds
// larges — les PRAIRIES — où grouillent monstres et caisses. Le boss et
// le ponton attendent au dernier nœud. largeur/hauteur = le couloir dans
// lequel le chemin a le droit de serpenter.
const NIVEAUX = [
  { nom:"L'ÎLE", sous:'un matin dans le lagon', largeur:2400, hauteur:1300,
    noeuds:9, prairies:2,
    peuple:['crabe','crabe','meduse','bernard'], boss:'roiCrabe',
    caisses:5, pierres:6, monstres:9,
    teinte:{ herbe:0x7fb35e, herbeSombre:0x639446, herbeClaire:0x8fc46e, sable:0xe8d49a } },
  { nom:'LE LAGON', sous:'les eaux troubles', largeur:2800, hauteur:1400,
    noeuds:11, prairies:3,
    peuple:['meduse','meduse','crabe','bernard'], boss:'reineMeduse',
    caisses:6, pierres:7, monstres:11,
    teinte:{ herbe:0x5e9c8a, herbeSombre:0x477a6b, herbeClaire:0x6fae9a, sable:0xd8cba0 } },
];
