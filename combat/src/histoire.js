// ─────────────────────────────────────────────────────────────
// L'HISTOIRE
// Le récit s'écrit lettre à lettre, comme dans les vieux jeux de rôle.
// Un appui : tout le texte s'affiche d'un coup. Un second appui : on
// continue. On n'entre JAMAIS dans un niveau sans un appui du joueur.
// L'intro se joue avant la forêt, un interlude ouvre chaque étage
// suivant (une seule fois par partie), et la conclusion suit le Patron.
// ─────────────────────────────────────────────────────────────
const HISTOIRE = {
  intro: [
    'Voici MARTIN.',
    'Martin n\'a peur de rien. Ni du noir, ni des orages, ni des grosses bêtes.',
    'Il habite une petite maison, tout près de la grande forêt.',
    'Un matin, des monstres baveux sortent d\'entre les arbres et attaquent le village !',
    'Tout le monde s\'enfuit en courant... sauf Martin.',
    '« D\'où viennent ces monstres ? » se demande-t-il.',
    '« Il n\'y a qu\'un seul moyen de le savoir : aller voir plus loin. »',
    'Et Martin entre dans la forêt.',
  ],
  // un texte par étage — l'index 0 (la forêt) est couvert par l'intro
  niveaux: [
    null,
    [ 'Le Grand Baveux est vaincu ! Derrière la forêt, Martin découvre un désert brûlant.',
      'Sur le sable, d\'étranges traces de pas... et des morceaux de métal qui brillent au soleil.',
      '« Des machines ? En plein désert ? » Martin fronce les sourcils. « Continuons. »' ],
    [ 'Le Scorpion des Sables mord la poussière. Au loin, Martin aperçoit une ville.',
      'Ici aussi les monstres sont passés : les rues sont vides, et des drones volent entre les immeubles.',
      'Sur une caisse cassée, Martin remarque un logo : une TOUR NOIRE.',
      '« Voilà ma piste ! »' ],
    [ 'La Sentinelle est en morceaux, et la nuit tombe sur la ville.',
      'Tout au bout de la rue se dresse une tour immense... la même que sur le logo !',
      'C\'est de là que viennent les monstres, Martin en est sûr.',
      'Il serre les poings : « J\'arrive. »' ],
    [ 'Le Cogneur gardait l\'entrée : mal joué pour lui.',
      'Martin pousse la porte de la tour. Le hall est plein de chevaliers en armure.',
      'Quelqu\'un paie tous ces gardes... quelqu\'un qui cache un gros secret, tout là-haut.' ],
    [ 'Le Chef de la Sécurité est au tapis. Au 14ᵉ étage, des papiers traînent partout.',
      'Martin lit : « EXPÉRIENCE N°8 : transformer les animaux en monstres. Signé : LE PATRON. »',
      'Alors c\'est lui ! Un savant fou qui FABRIQUE les monstres dans sa tour !' ],
    [ 'Au 37ᵉ étage, ça gronde et ça fume : voici les machines qui fabriquent les monstres !',
      'Si Martin les casse toutes, plus un seul monstre ne sortira de la tour.',
      'Et tout en haut, quelqu\'un l\'attend...' ],
    [ 'Les machines sont détruites ! Il ne reste qu\'un endroit : le toit.',
      'Le Patron est là, en costume-cravate, avec son sourire de méchant.',
      '« Personne n\'arrêtera mes expériences ! » crie-t-il.',
      '« Moi, si », répond Martin.' ],
  ],
  fin: [
    'Le Patron est tombé — et avec lui, toutes ses machines.',
    'Peu à peu, les monstres disparaissent. La ville se rallume, le désert se calme, et la forêt redevient tranquille.',
    'Martin rentre chez lui. Le village entier l\'accueille en héros.',
    'Car être courageux, ce n\'est pas ne jamais avoir peur...',
    'C\'est avancer quand même, pour protéger ceux qu\'on aime.',
    'BRAVO, MARTIN !',
  ],
};

// Affiche un récit lettre à lettre, en PAGES de deux phrases — de
// grosses lettres, plusieurs écrans. Un appui : toute la page. Un
// second : la page suivante, ou la suite si c'était la dernière.
// apres() n'est jamais appelé sans un appui du joueur.
function montrerHistoire(lignes, apres){
  const el = document.getElementById('histoire');
  const zone = document.getElementById('histoireTexte');
  const suite = document.getElementById('histoireSuite');
  const PAR_ECRAN = 2;
  const pages = [];
  for (let n = 0; n < lignes.length; n += PAR_ECRAN) pages.push(lignes.slice(n, n + PAR_ECRAN));
  let page = -1, paras = [], i = 0, pause = 0, fini = false, minuterie = null;
  el.hidden = false;

  const toutAfficher = () => {
    for (const c of paras){ c.p.textContent = c.texte; c.n = c.texte.length; }
    fini = true;
    suite.style.visibility = 'visible';
    clearInterval(minuterie);
  };
  // 70 ms par lettre : le rythme d'un enfant qui lit (CE1-CE2), avec une
  // respiration au bout de chaque phrase — un appui accélère de toute façon
  const tic = () => {
    if (pause > 0){ pause--; return; }
    const c = paras[i];
    if (!c){ toutAfficher(); return; }
    c.p.textContent = c.texte.slice(0, ++c.n);
    // le petit tac-tac de machine à écrire, discret
    if (c.n % 3 === 0 && SON.ctx && SON.actif) SON.note('square', 1400, 1400, 0.012, 0.018);
    if (c.n >= c.texte.length){ i++; pause = 12; }
  };
  const lancerPage = () => {
    page++;
    zone.innerHTML = '';
    suite.style.visibility = 'hidden';
    suite.textContent = page < pages.length - 1 ? '▼ APPUIE POUR LA SUITE' : '▼ APPUIE POUR CONTINUER';
    fini = false; i = 0; pause = 0;
    paras = pages[page].map(texte => {
      const p = document.createElement('p');
      zone.appendChild(p);
      return { p, texte, n:0 };
    });
    clearInterval(minuterie);
    minuterie = setInterval(tic, 70);
  };

  const avancer = (e) => {
    if (e) e.preventDefault();
    if (!fini){ toutAfficher(); return; }          // 1ᵉʳ appui : toute la page
    if (page < pages.length - 1){ lancerPage(); return; }   // page suivante
    el.hidden = true;                               // dernière page : on continue
    clearInterval(minuterie);
    el.removeEventListener('pointerdown', avancer);
    removeEventListener('keydown', surTouche);
    montrerHistoire.passer = null;
    // la touche qui a fermé le récit ne doit pas faire sauter le héros
    ENTREE.saut = false; ENTREE.sautPresse = false; ENTREE.validePresse = false;
    if (apres) apres();
  };
  const surTouche = (e) => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp'){
      e.preventDefault(); avancer();
    }
  };
  el.addEventListener('pointerdown', avancer);
  addEventListener('keydown', surTouche);
  montrerHistoire.passer = avancer;   // pour les tests : sauter le récit
  lancerPage();
}
// saute tout le récit en cours (appuis simulés) — utilisé par les tests
function passerHistoire(){
  let garde = 40;
  while (montrerHistoire.passer && garde--) montrerHistoire.passer();
}
