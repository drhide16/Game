// ─────────────────────────────────────────────────────────────
// VERSION ET CACHE
// Le numéro est affiché sur l'écran-titre : il suffit de le lire pour
// savoir ce qu'on a sous les yeux. Au chargement on redemande la page
// au serveur sans passer par le cache ; si elle annonce une version
// plus récente, on se recharge sur une URL neuve — un simple reload()
// pourrait resservir la copie en cache, une URL jamais vue non.
// ─────────────────────────────────────────────────────────────
const VERSION = '13';

(function verifierVersion(){
  if (location.protocol === 'file:' || typeof fetch !== 'function') return;
  let tentee = null;
  try { tentee = sessionStorage.getItem('mgc-version-tentee'); } catch (e) {}
  fetch(location.pathname + '?cb=' + Date.now(), { cache:'no-store' })
    .then(r => r.ok ? r.text() : null)
    .then(txt => {
      if (!txt) return;
      const m = txt.match(/const VERSION = '([^']+)'/);
      if (!m) return;
      if (m[1] === VERSION){
        try { sessionStorage.removeItem('mgc-version-tentee'); } catch (e) {}
        return;
      }
      if (tentee === m[1]) return;   // déjà tenté pour cette version : on n'insiste pas
      try { sessionStorage.setItem('mgc-version-tentee', m[1]); } catch (e) {}
      location.replace(location.pathname + '?v=' + encodeURIComponent(m[1]));
    })
    .catch(() => {});   // hors ligne ou origine inaccessible : on joue la version en place
})();

(function afficherVersion(){
  const el = document.getElementById('version');
  if (el) el.textContent = 'v' + VERSION;
})();
