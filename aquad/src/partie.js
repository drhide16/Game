// Ce qu'on emporte d'une zone à l'autre. Vit en dehors de la scène,
// puisque changer de zone relance la scène.
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
const CLE_RECORD = 'martin-games-aquad';
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
