// ─────────────────────────────────────────────────────────────
// ZOOM
// iOS ignore user-scalable=no depuis iOS 10, et touch-action n'a été
// suivi qu'à partir de Safari 13. On coupe donc aussi à la main les
// deux gestes qui zooment : le double-tap et le pincement.
// ─────────────────────────────────────────────────────────────
for (const ev of ['gesturestart','gesturechange','gestureend'])
  addEventListener(ev, e => e.preventDefault(), { passive:false });

let dernierTap = 0;
addEventListener('touchend', e => {
  if (e.timeStamp - dernierTap < 350) e.preventDefault();
  dernierTap = e.timeStamp;
}, { passive:false });

addEventListener('dblclick', e => e.preventDefault(), { passive:false });

// ─────────────────────────────────────────────────────────────
// MANETTE TACTILE
// Vue de dessus : le joystick pilote les DEUX axes. ✕ est la roulade.
// Un coup se CHARGE tant que son bouton est tenu, et part au relâché :
// bref = coup normal, tenu = coup élastique (s'il reste de l'endurance).
// ─────────────────────────────────────────────────────────────
const ENTREE = {
  axeX:0, axeY:0,
  roulPresse:false,
  chargeAction:null, chargeDebut:0, relache:null,
  validePresse:false,
};

const socle = document.getElementById('socle');
const pouce = document.getElementById('pouce');
let pointeurJoystick = null;

function majJoystick(e){
  const r = socle.getBoundingClientRect();
  const rayon = r.width / 2;
  let dx = e.clientX - (r.left + rayon);
  let dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  const limite = rayon - 12;
  if (d > limite){ dx *= limite / d; dy *= limite / d; }
  pouce.style.transform = `translate(${dx}px, ${dy}px)`;

  // zone morte RADIALE, puis on réétale [zoneMorte, 1] sur [0, 1] : la
  // vitesse part de zéro dans toutes les directions, sans saut
  const nx = dx / limite, ny = dy / limite;
  const n = Math.hypot(nx, ny);
  if (n < CFG.zoneMorte){ ENTREE.axeX = 0; ENTREE.axeY = 0; return; }
  const k = Math.min(1, (n - CFG.zoneMorte) / (1 - CFG.zoneMorte)) / n;
  ENTREE.axeX = nx * k;
  ENTREE.axeY = ny * k;
}
function relacherJoystick(){
  pointeurJoystick = null;
  ENTREE.axeX = 0; ENTREE.axeY = 0;
  pouce.style.transform = 'translate(0,0)';
  socle.classList.remove('actif');
}

// la capture de pointeur est un confort, pas une condition : si elle
// échoue, il ne faut surtout pas que l'appui soit perdu avec elle
function capturer(el, id){ try { el.setPointerCapture(id); } catch (e) {} }

socle.addEventListener('pointerdown', e => {
  e.preventDefault();
  pointeurJoystick = e.pointerId;
  capturer(socle, e.pointerId);
  socle.classList.add('actif');
  majJoystick(e);
});
socle.addEventListener('pointermove', e => { if (e.pointerId === pointeurJoystick) majJoystick(e); });
for (const ev of ['pointerup','pointercancel','lostpointercapture'])
  socle.addEventListener(ev, e => { if (e.pointerId === pointeurJoystick) relacherJoystick(); });

for (const b of document.querySelectorAll('.pad button')){
  const a = b.dataset.action;
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    capturer(b, e.pointerId);
    if (a === 'roulade') ENTREE.roulPresse = true;
    else { ENTREE.chargeAction = a; ENTREE.chargeDebut = performance.now(); }
    ENTREE.validePresse = true;   // n'importe quel bouton relance après une mort
  });
  const fin = () => {
    if (a === 'roulade') return;
    if (ENTREE.chargeAction === a){
      ENTREE.relache = { action:a, duree:(performance.now() - ENTREE.chargeDebut)/1000, quand:performance.now() };
      ENTREE.chargeAction = null;
    }
  };
  for (const ev of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(ev, fin);
  b.addEventListener('contextmenu', e => e.preventDefault());
}

// le bouton poing affiche l'arme en cours et ses munitions
const boutonArme = document.querySelector('.b-carre');
function majBoutonArme(arme, munitions, segments){
  const signe = boutonArme.querySelector('.signe');
  const nom   = boutonArme.querySelector('.nom');
  boutonArme.classList.toggle('armee', !!arme);
  boutonArme.classList.toggle('vide', !!arme && munitions <= 0);
  if (arme && munitions <= 0){
    signe.textContent = '↻';
    nom.textContent = 'RECHARGE';
  } else if (arme){
    signe.textContent = '✦';
    nom.textContent = ARMES[arme].nom + ' ' + munitions + (segments > 0 ? '·' + segments : '');
  } else {
    signe.textContent = '□';
    nom.textContent = 'POING';
  }
}

const boutonSon = document.getElementById('son');
boutonSon.addEventListener('pointerdown', e => {
  e.preventDefault();
  SON.actif = !SON.actif;
  boutonSon.classList.toggle('coupe', !SON.actif);
  boutonSon.textContent = SON.actif ? '♪' : '✕';
  if (SON.actif) SON.jouer('coeur');
});

// clavier de secours pour tester sur un ordinateur
addEventListener('keydown', e => {
  if (e.code === 'ArrowLeft')  { ENTREE.axeX = -1; e.preventDefault(); }
  if (e.code === 'ArrowRight') { ENTREE.axeX =  1; e.preventDefault(); }
  if (e.code === 'ArrowUp')    { ENTREE.axeY = -1; e.preventDefault(); }
  if (e.code === 'ArrowDown')  { ENTREE.axeY =  1; e.preventDefault(); }
  if (e.code === 'Space' && !e.repeat){
    ENTREE.roulPresse = true; ENTREE.validePresse = true; e.preventDefault();
  }
  const touches = { KeyA:'poing', KeyZ:'pied', KeyE:'retourne' };
  if (touches[e.code] && !e.repeat){
    ENTREE.chargeAction = touches[e.code]; ENTREE.chargeDebut = performance.now();
    ENTREE.validePresse = true;
  }
});
addEventListener('keyup', e => {
  if ((e.code === 'ArrowLeft' && ENTREE.axeX < 0) || (e.code === 'ArrowRight' && ENTREE.axeX > 0)) ENTREE.axeX = 0;
  if ((e.code === 'ArrowUp' && ENTREE.axeY < 0) || (e.code === 'ArrowDown' && ENTREE.axeY > 0)) ENTREE.axeY = 0;
  const touches = { KeyA:'poing', KeyZ:'pied', KeyE:'retourne' };
  if (touches[e.code] && ENTREE.chargeAction === touches[e.code]){
    ENTREE.relache = { action:touches[e.code], duree:(performance.now() - ENTREE.chargeDebut)/1000, quand:performance.now() };
    ENTREE.chargeAction = null;
  }
});
