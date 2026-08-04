// ─────────────────────────────────────────────────────────────
// LES ÉTAGES
// On part de la rue, on entre dans l'immeuble, et on monte jusqu'au toit.
// ─────────────────────────────────────────────────────────────
// Chaque étage a sa propre teinte : on doit reconnaître où on est d'un
// coup d'œil, sans lire le bandeau. Le hall est un marbre bleu et froid,
// les bureaux sont ambrés, la machinerie rouille, le toit vire au violet.
const NIVEAUX = [
  { nom:'LA RUE',        sous:'rejoins la tour',        decor:'exterieur', largeur:7000, sortie:'porte',
    peuple:['baveux','baveux','drone','colosse'], boss:'cogneur' },
  { nom:'LE HALL',       sous:'1ᵉʳ étage',              decor:'interieur', largeur:3400, sortie:'ascenseur',
    peuple:['gardien','gardien','colosse','baveux'], boss:'chefSecu',
    teinte:{ fondHaut:0x14202e, fondBas:0x081019, mur:0x1b2f42, murHaut:0x27455f, plafond:0x081119,
             neon:0xcdeeff, sol:0x142230, solBord:0x6fb3d6, plat:0x1d3b4e, platBord:0x8fd8f2 } },
  { nom:'LES BUREAUX',   sous:'14ᵉ étage',              decor:'interieur', largeur:3800, sortie:'ascenseur',
    peuple:['gardien','tourelle','drone','gardien'], boss:'canonnier',
    teinte:{ fondHaut:0x241d14, fondBas:0x120d08, mur:0x35281a, murHaut:0x4a3823, plafond:0x140f09,
             neon:0xffe0a8, sol:0x261d12, solBord:0xd8a45c, plat:0x3c2d1c, platBord:0xf0c780 } },
  { nom:'LA MACHINERIE', sous:'37ᵉ étage',              decor:'interieur', largeur:4000, sortie:'echelle',
    peuple:['tourelle','tourelle','colosse','drone','gardien'], boss:'broyeur',
    teinte:{ fondHaut:0x2a1618, fondBas:0x130a0b, mur:0x3a1e1f, murHaut:0x542b2b, plafond:0x150b0c,
             neon:0xff9d8a, sol:0x2b1718, solBord:0xd4736a, plat:0x402323, platBord:0xf09a8c } },
  { nom:'LE TOIT',       sous:'tout en haut',           decor:'toit',      largeur:3000, sortie:'patron',
    peuple:['drone','drone','gardien'], boss:'patron' },
];
