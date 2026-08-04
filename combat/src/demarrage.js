// ─────────────────────────────────────────────────────────────
// ÉCRAN-TITRE
// Le jeu n'est construit qu'au moment où on appuie : rien ne tourne
// derrière le titre, et la première image affichée est déjà jouable.
// ─────────────────────────────────────────────────────────────
let partie = null;

function demarrer(){
  if (partie || typeof Phaser === 'undefined') return;
  document.body.classList.add('enjeu');
  SON.demarrer();   // iOS n'ouvre l'audio que dans un geste utilisateur
  ENTREE.axeX = 0; ENTREE.saut = false; ENTREE.sautPresse = false;
  ENTREE.accroupi = false; ENTREE.coupPresse = null;
  ENTREE.haut = false; ENTREE.hautPresse = false; ENTREE.validePresse = false;
  PARTIE = nouvellePartieEtat();

  partie = new Phaser.Game({
    type: Phaser.AUTO,
    width: L, height: H,
    parent: 'conteneur',
    backgroundColor: '#0d1120',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default:'arcade', arcade: { gravity:{ y: CFG.gravite }, debug:false } },
    scene: Combat,
  });
  // accessible depuis la console du navigateur pour régler le jeu à chaud :
  // jeu.scene.getScene('combat').munitions = 99
  window.jeu = partie;

  // iOS ne recalcule pas toujours la taille du parent tout de suite après
  // une rotation : on force un rafraîchissement peu après l'événement.
  const rafraichir = () => setTimeout(() => partie.scale.refresh(), 120);
  addEventListener('orientationchange', rafraichir);
  addEventListener('resize', rafraichir);
}

if (typeof Phaser !== 'undefined'){
  document.getElementById('titre').addEventListener('pointerdown', e => {
    e.preventDefault(); demarrer();
  });
  addEventListener('keydown', e => {
    if (!partie && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp')){
      e.preventDefault(); demarrer();
    }
  });
}
