// Le niveau est tiré au sort, mais toujours à partir de cette graine :
// mourir et réapparaître ne doit pas redessiner le monde sous nos pieds.
let GRAINE = (Math.random() * 1e9) | 0;
function generateur(s){
  return function(){
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Ce qu'on emporte d'un étage à l'autre. Vit en dehors de la scène,
// puisque changer d'étage relance la scène.
let PARTIE = null;
function nouvellePartieEtat(){
  const D = DIFFICULTES[DIFFICULTE_CHOISIE] || DIFFICULTES.moyen;
  return { niveau:0, pv:CFG.pvJoueur, vies:D.vies, difficulte:DIFFICULTE_CHOISIE,
           arme:null, munitions:0, segments:0, vaincus:0, morts:0 };
}
PARTIE = nouvellePartieEtat();

// ─────────────────────────────────────────────────────────────
// RECORD
// ─────────────────────────────────────────────────────────────
const CLE_RECORD = 'martin-games-combat';
function lireRecord(){
  try {
    const r = JSON.parse(localStorage.getItem(CLE_RECORD));
    if (r && typeof r.monstres === 'number') return { monstres:r.monstres|0, etage:r.etage|0 };
  } catch (e) { /* navigation privée : on joue sans record */ }
  return { monstres:0, etage:0 };
}
function ecrireRecord(r){
  try { localStorage.setItem(CLE_RECORD, JSON.stringify(r)); } catch (e) {}
}
function afficherRecord(){
  const r = lireRecord(), el = document.getElementById('record');
  if (el) el.textContent = (r.monstres || r.etage)
    ? 'RECORD  ' + r.monstres + ' MONSTRES  ·  ' + NIVEAUX[Math.min(r.etage, NIVEAUX.length-1)].nom : '';
}
afficherRecord();
