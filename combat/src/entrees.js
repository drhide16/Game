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
// Joystick : gauche/droite pour avancer, bas pour s'accroupir et ramper,
// haut pour l'uppercut. Saut sur ✕ (deux fois pour le double saut), et
// le bouton poing cède sa place à l'arme dès qu'on en ramasse une.
// ─────────────────────────────────────────────────────────────
const ENTREE = {
  axeX:0, saut:false, sautPresse:false, accroupi:false,
  haut:false, hautPresse:false,
  coupPresse:null, validePresse:false,
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

  const nx = dx / limite, ny = dy / limite;
  // on réétale [zoneMorte, 1] sur [0, 1] : sans ça la vitesse sautait
  // d'un coup à 24 % dès qu'on quittait le centre, au lieu de partir de zéro
  const a = Math.abs(nx);
  ENTREE.axeX = a < CFG.zoneMorte ? 0
    : Math.sign(nx) * Math.min(1, (a - CFG.zoneMorte) / (1 - CFG.zoneMorte));

  // l'uppercut exige une poussée franchement verticale, sinon courir en
  // diagonale vers le haut le déclencherait sans arrêt
  const versLeHaut = ny < -CFG.seuilHaut && Math.abs(ny) > Math.abs(nx);
  if (versLeHaut && !ENTREE.haut){ ENTREE.hautPresse = true; ENTREE.validePresse = true; }
  ENTREE.haut = versLeHaut;
  // en bas, pas d'exigence de ce genre : bas + côté, c'est ramper
  ENTREE.accroupi = ny > CFG.seuilBas;
}
function relacherJoystick(){
  pointeurJoystick = null;
  ENTREE.axeX = 0; ENTREE.haut = false; ENTREE.accroupi = false;
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
    if (a === 'saut'){ ENTREE.saut = true; ENTREE.sautPresse = true; }
    else ENTREE.coupPresse = a;
    ENTREE.validePresse = true;   // n'importe quel bouton relance après une mort
  });
  // relâcher ✕ écourte le saut : c'est ce qui le rend modulable
  const fin = () => { if (a === 'saut') ENTREE.saut = false; };
  for (const ev of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(ev, fin);
  b.addEventListener('contextmenu', e => e.preventDefault());
}

// le bouton poing affiche l'arme en cours et ses munitions
const boutonArme = document.querySelector('.b-carre');
function majBoutonArme(arme, munitions){
  const signe = boutonArme.querySelector('.signe');
  const nom   = boutonArme.querySelector('.nom');
  if (arme){
    boutonArme.classList.add('armee');
    signe.textContent = '✦';
    nom.textContent = ARMES[arme].nom + ' ' + munitions;
  } else {
    boutonArme.classList.remove('armee');
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
  if (e.code === 'ArrowDown')  { ENTREE.accroupi = true; e.preventDefault(); }
  if (e.code === 'ArrowUp' && !e.repeat){
    ENTREE.hautPresse = true; ENTREE.validePresse = true; e.preventDefault();
  }
  if (e.code === 'Space' && !e.repeat){
    ENTREE.saut = true; ENTREE.sautPresse = true; ENTREE.validePresse = true; e.preventDefault();
  }
  if (e.code === 'KeyA') { ENTREE.coupPresse = 'poing'; ENTREE.validePresse = true; }
  if (e.code === 'KeyZ') { ENTREE.coupPresse = 'pied'; ENTREE.validePresse = true; }
  if (e.code === 'KeyE') { ENTREE.coupPresse = 'retourne'; ENTREE.validePresse = true; }
});
addEventListener('keyup', e => {
  if ((e.code === 'ArrowLeft' && ENTREE.axeX < 0) || (e.code === 'ArrowRight' && ENTREE.axeX > 0)) ENTREE.axeX = 0;
  if (e.code === 'ArrowDown') ENTREE.accroupi = false;
  if (e.code === 'Space') ENTREE.saut = false;
});
