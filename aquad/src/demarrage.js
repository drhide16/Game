// ─────────────────────────────────────────────────────────────
// ÉCRAN-TITRE
// Le jeu n'est construit qu'au moment où on appuie : rien ne tourne
// derrière le titre, et la première image affichée est déjà jouable.
// Au game over, retourAuTitre() détruit la partie et rend l'écran
// d'accueil ; le prochain appui repart de zéro.
// ─────────────────────────────────────────────────────────────
let partie = null;

function demarrer(){
  if (partie || typeof Phaser === 'undefined') return;
  document.body.classList.add('enjeu');
  SON.demarrer();   // iOS n'ouvre l'audio que dans un geste utilisateur
  ENTREE.axeX = 0; ENTREE.axeY = 0;
  ENTREE.actionPresse = false; ENTREE.armePresse = false;
  ENTREE.chargeAction = null; ENTREE.relache = null; ENTREE.validePresse = false;
  PARTIE = nouvellePartieEtat();

  partie = new Phaser.Game({
    type: Phaser.AUTO,
    width: L, height: H,
    parent: 'conteneur',
    backgroundColor: '#1a6f8e',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // vue de dessus : rien ne tombe, la gravité reste à zéro
    physics: { default:'arcade', arcade: { gravity:{ y: 0 }, debug:false } },
    scene: Aquad,
  });
  // accessible depuis la console du navigateur pour régler le jeu à chaud :
  // jeu.scene.getScene('aquad').joueurs[0].pv = 5
  window.jeu = partie;

  // iOS ne recalcule pas toujours la taille du parent tout de suite après
  // une rotation : on force un rafraîchissement peu après l'événement.
  // La garde sur partie compte : après un retour au titre, l'écouteur
  // survit à la partie détruite.
  const rafraichir = () => setTimeout(() => { if (partie) partie.scale.refresh(); }, 120);
  addEventListener('orientationchange', rafraichir);
  addEventListener('resize', rafraichir);
}

function retourAuTitre(){
  if (!partie) return;
  partie.destroy(true);   // true : retire aussi le canvas de la page
  partie = null;
  window.jeu = null;
  document.body.classList.remove('enjeu');
  afficherRecord();       // la partie perdue vient peut-être de le battre
}

// le choix de difficulté : sélectionne sans lancer la partie, et s'en
// souvient d'une fois sur l'autre
const choixDiff = document.getElementById('choixDiff');
function majChoixDiff(){
  for (const b of choixDiff.querySelectorAll('button'))
    b.classList.toggle('choisi', b.dataset.d === DIFFICULTE_CHOISIE);
}
majChoixDiff();
choixDiff.addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();   // l'écran-titre lance la partie au moindre appui : pas ici
  DIFFICULTE_CHOISIE = b.dataset.d;
  try { localStorage.setItem('aquad-difficulte', DIFFICULTE_CHOISIE); } catch (err) {}
  majChoixDiff();
});

if (typeof Phaser !== 'undefined'){
  document.getElementById('titre').addEventListener('pointerdown', e => {
    e.preventDefault(); demarrer();
  });
  addEventListener('keydown', e => {
    if (!partie && (e.code === 'Space' || e.code === 'Enter')){
      e.preventDefault(); demarrer();
    }
  });
}
