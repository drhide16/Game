// ─────────────────────────────────────────────────────────────
// SCÈNE — vue de dessus
// L'île est un rectangle de terre cerné d'eau ; la caméra suit sur les
// deux axes. L'état du joueur vit dans UN objet (this.joueurs[0]) :
// c'est la fondation du multijoueur à venir.
// ─────────────────────────────────────────────────────────────
const MARGE_EAU = 260;   // l'eau visible autour de l'île

// ─────────────────────────────────────────────────────────────
// PROJECTION ISOMÉTRIQUE
// La simulation vit en coordonnées MONDE (un rectangle plat : physique,
// collisions, aimantation inchangées). Seul le rendu projette en losange :
// px = (x − y)·0.707, py = (x + y)·0.354 — soit rotation 45° + écrasement
// vertical de moitié. Le sol se dessine à travers cette transformation ;
// les personnages restent debout (billboards) aux positions projetées.
// ─────────────────────────────────────────────────────────────
const ISO_C = 0.7071, ISO_S = 0.3536;

class Aquad extends Phaser.Scene {
  constructor(){ super('aquad'); }

  iso(x, y){ return { x: (x - y) * ISO_C, y: (x + y) * ISO_S }; }
  // l'inverse : d'un vecteur écran vers un vecteur monde (pour le joystick)
  isoInv(px, py){ return { x: px / (2*ISO_C) + py / (2*ISO_S), y: -px / (2*ISO_C) + py / (2*ISO_S) }; }

  create(){
    this.def = NIVEAUX[Math.min(PARTIE.niveau, NIVEAUX.length - 1)];
    this.D = DIFFICULTES[PARTIE.difficulte] || DIFFICULTES.moyen;
    this.alea = generateur(GRAINE + PARTIE.niveau * 7919);

    // l'île va de (MARGE_EAU, MARGE_EAU) à (MARGE_EAU+largeur, MARGE_EAU+hauteur)
    this.ileX = MARGE_EAU; this.ileY = MARGE_EAU;
    this.ileL = this.def.largeur; this.ileH = this.def.hauteur;
    const mondeL = this.ileL + MARGE_EAU*2, mondeH = this.ileH + MARGE_EAU*2;

    this.etat = 'jeu';
    this.vaincus = PARTIE.vaincus; this.morts = PARTIE.morts;
    this.eclats = []; this.objets = []; this.caisses = [];
    this.tirs = []; this.tirsEnnemis = [];
    this.bulles = []; this.bulleSuiv = 0;
    this.msg = null; this.transition = 0;
    this.monstres = []; this.decors = []; this.pierres = [];

    // le joueur ne sort pas de la terre : les limites physiques SONT l'île
    this.physics.world.setBounds(this.ileX, this.ileY, this.ileL, this.ileH);
    // la caméra vit en espace ÉCRAN : les bornes sont le losange projeté
    this.cameras.main.setBounds(-mondeH * ISO_C, 0, (mondeL + mondeH) * ISO_C, (mondeL + mondeH) * ISO_S);

    this.gSol    = this.add.graphics().setDepth(-10);   // eau et terre, en coordonnées monde
    this.gSortie = this.add.graphics().setDepth(-4);
    this.gVisee  = this.add.graphics().setDepth(-3);    // arc de visée et anneau de cible, au sol
    this.cibleVisee = null;
    this.grObstacles = this.add.group();

    // ── l'entité joueur ──
    const j = {
      go: this.add.rectangle(this.ileX + 130, this.ileY + this.ileH/2, 26, 24, 0xffffff, 0),
      fx: 1, fy: 0,                 // direction regardée (normalisée)
      phase: 0,
      pv: PARTIE.pv, invuln: CFG.invulnRenais,
      arme: PARTIE.arme, munitions: PARTIE.munitions, segments: PARTIE.segments | 0,
      endurance: CFG.enduranceMax,
      attaque: null, charge: null, chargeAIgnorer: null,
      porte: null,                  // la pierre ou la caisse au-dessus de la tête
      g: this.add.graphics(),       // son calque de dessin, trié par y
    };
    this.physics.add.existing(j.go);
    j.go.body.setCollideWorldBounds(true);
    this.joueurs = [j];
    this.checkpoint = { x: j.go.x, y: j.go.y };
    this.astuceEndurance = false;
    majBoutonArme(j.arme, j.munitions, j.segments);
    majBoutonAction(false);

    this.construireZone();
    this.physics.add.collider(j.go, this.grObstacles);

    this.gObjets = this.add.graphics().setDepth(4000);
    this.gEclats = this.add.graphics().setDepth(4100);
    this.gTirs   = this.add.graphics().setDepth(4200);
    this.gCoup   = this.add.graphics().setDepth(4050);

    for (let i = 0; i < 8; i++){
      const t = this.add.text(0, 0, '', { fontFamily:'Arcade, ui-monospace, monospace', fontSize:'18px', color:'#ffffff' })
        .setStroke('#0d1120', 6).setOrigin(0.5).setDepth(5000).setVisible(false);
      this.bulles.push({ t, vie:0, max:1, vy:0 });
    }

    // la caméra suit un fantôme placé à la PROJECTION du joueur
    const p0 = this.iso(j.go.x, j.go.y);
    this.suiveur = this.add.rectangle(p0.x, p0.y, 1, 1, 0xffffff, 0);
    this.cameras.main.startFollow(this.suiveur, true, 0.12, 0.12);

    this.hud = this.add.graphics().setScrollFactor(0).setDepth(9000);
    const style = f => ({ fontFamily:'ui-monospace, Menlo, monospace', fontSize:f, color:'#eaf4f0' });
    this.hudTexte = this.add.text(22, 60, '', style('12px'))
      .setStroke('#0d3040', 3).setScrollFactor(0).setDepth(9000);
    this.hudMsg = this.add.text(L/2, 96, '', { ...style('13px'), color:'#ffd98a' })
      .setStroke('#0d3040', 4).setOrigin(0.5).setScrollFactor(0).setDepth(9001).setAlpha(0);
    this.hudBoss = this.add.text(L/2, H - 48, '', { ...style('11px'), color:'#ffb0a8' })
      .setStroke('#0d3040', 3).setOrigin(0.5).setScrollFactor(0).setDepth(9001).setAlpha(0);
    this.hudFin = this.add.text(L/2, H/2 - 30, '', { ...style('18px'), align:'center' })
      .setStroke('#0d3040', 5).setOrigin(0.5).setScrollFactor(0).setDepth(9001);

    this.message(this.def.nom + '  —  ' + this.def.sous);
  }

  // ── construction de l'île ───────────────────────────────────
  poseLibre(marge){
    // une position sur la terre, pas trop près du bord ni du départ
    for (let e = 0; e < 40; e++){
      const x = this.ileX + marge + this.alea() * (this.ileL - marge*2);
      const y = this.ileY + marge + this.alea() * (this.ileH - marge*2);
      if (Math.hypot(x - (this.ileX + 130), y - (this.ileY + this.ileH/2)) < 220) continue;
      if (this.decors.every(d => Math.hypot(x - d.x, y - d.y) > 90)) return { x, y };
    }
    return { x: this.ileX + this.ileL/2, y: this.ileY + this.ileH/2 };
  }
  creerObstacle(type){
    const p = this.poseLibre(90);
    // le corps ne couvre que le pied : on passe DERRIÈRE la tête du
    // palmier, et le tri par y fait le reste
    const larg = type === 'palmier' ? 18 : 42;
    const haut = type === 'palmier' ? 14 : 30;
    const c = this.add.rectangle(p.x, p.y, larg, haut, 0xffffff, 0);
    this.physics.add.existing(c, true);
    this.grObstacles.add(c);
    const d = { type, x: p.x, y: p.y, g: this.add.graphics().setDepth(this.iso(p.x, p.y).y), phase: this.alea()*6 };
    this.decors.push(d);
    this.dessinerDecor(d);
  }
  creerCaisse(){
    const p = this.poseLibre(70);
    const c = this.add.rectangle(p.x, p.y, 28, 24, 0xffffff, 0);
    this.physics.add.existing(c, true);
    this.grObstacles.add(c);
    this.caisses.push({ go:c, pv:2, flash:0, g: this.add.graphics().setDepth(this.iso(p.x, p.y).y) });
  }
  creerPierre(){
    const p = this.poseLibre(60);
    const c = this.add.rectangle(p.x, p.y, 16, 14, 0xffffff, 0);
    this.physics.add.existing(c, true);
    this.grObstacles.add(c);
    this.pierres.push({ go:c, g: this.add.graphics().setDepth(this.iso(p.x, p.y).y) });
  }
  creerMonstre(type, x, y){
    const d = MONSTRES[type];
    const go = this.add.rectangle(x, y, d.taille[0], d.taille[1], 0xffffff, 0);
    this.physics.add.existing(go);
    go.body.setCollideWorldBounds(true);
    if (!d.flotte) this.physics.add.collider(go, this.grObstacles);
    const pv = Math.max(1, Math.round(d.pv * this.D.pv));
    const m = {
      go, type, def:d, pv, pvMax:pv, assomme:0, flash:0,
      maison:{ x, y }, cible:null, prepare:0, repos:0,
      phase: this.alea()*6, g: this.add.graphics(),
    };
    this.monstres.push(m);
    return m;
  }
  construireZone(){
    let nRochers = 5 + Math.floor(this.alea()*3);
    let nPalmiers = 7 + Math.floor(this.alea()*4);
    for (let i = 0; i < nRochers; i++) this.creerObstacle('rocher');
    for (let i = 0; i < nPalmiers; i++) this.creerObstacle('palmier');
    for (let i = 0; i < this.def.caisses; i++) this.creerCaisse();
    for (let i = 0; i < (this.def.pierres || 0); i++) this.creerPierre();

    let n = Math.round(this.def.monstres * this.D.monstres);
    for (let i = 0; i < n; i++){
      const p = this.poseLibre(80);
      const type = this.def.peuple[Math.floor(this.alea() * this.def.peuple.length)];
      this.creerMonstre(type, p.x, p.y);
    }
    // le boss garde le ponton, à l'est de l'île
    this.pontonY = this.ileY + this.ileH/2;
    this.boss = this.creerMonstre(this.def.boss,
      this.ileX + this.ileL - 220, this.pontonY);
    this.bossVivant = true;
  }

  // ── combat ──────────────────────────────────────────────────
  // la boîte AU SOL d'une entité : son corps réduit au facteur k. C'est
  // sur elle que se jugent les contacts — elle colle à l'ombre dessinée.
  boiteSol(go, k){
    const b = go.getBounds();
    const rx = b.width * (1 - k) / 2, ry = b.height * (1 - k) / 2;
    return new Phaser.Geom.Rectangle(b.x + rx, b.y + ry, b.width * k, b.height * k);
  }
  // l'ennemi vivant le plus proche à portée ET dans le cône du regard :
  // c'est lui que les coups aimantés iront chercher
  chercherCible(j, portee, cone){
    let cible = null, mieux = portee;
    for (const m of this.monstres){
      if (m.mort) continue;
      const dx = m.go.x - j.go.x, dy = m.go.y - j.go.y;
      const d = Math.hypot(dx, dy);
      if (d >= mieux || d < 1) continue;
      const ecart = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - Math.atan2(j.fy, j.fx)));
      if (ecart > cone) continue;
      cible = m; mieux = d;
    }
    return cible;
  }
  aimanter(j, portee, cone){
    const c = this.chercherCible(j, portee, cone);
    if (!c) return;
    const d = Math.hypot(c.go.x - j.go.x, c.go.y - j.go.y) || 1;
    j.fx = (c.go.x - j.go.x) / d;
    j.fy = (c.go.y - j.go.y) / d;
  }
  lancerAttaque(j, type, elastique){
    if (j.attaque) return;
    const c = COUPS[type];
    // aimantation : le coup pivote vers l'ennemi le plus proche du regard.
    // Au corps à corps on retient la cible : la fente (plus bas) fera
    // glisser le corps jusqu'à elle pour que le coup porte vraiment.
    let cible = null;
    if (c.portee && !c.faisceau){
      cible = this.chercherCible(j, CFG.aimantPortee, CFG.aimantCone);
      if (cible){
        const d = Math.hypot(cible.go.x - j.go.x, cible.go.y - j.go.y) || 1;
        j.fx = (cible.go.x - j.go.x) / d;
        j.fy = (cible.go.y - j.go.y) / d;
      }
    } else this.aimanter(j, CFG.aimantPorteeTir, CFG.aimantCone * 0.55);
    // la direction du coup est figée au départ : le faisceau et les
    // balles partent là où on regardait en appuyant
    j.attaque = { type, t:0, fx:j.fx, fy:j.fy, cible,
      elastique: !!elastique && !!c.portee, touches:new Set() };
    if (j.attaque.elastique) this.crier(j.go.x, j.go.y - 40, CRIS.kiai, '#ffd166', 15);
    SON.jouer(c.son);
    if (c.secousse) this.cameras.main.shake(90, c.secousse);
    if (c.tir) this.tirer(j, c);
    if (c.jet) this.ejecterSegment(j, c);
    if (c.elan) j.go.body.setVelocity(j.fx * c.elan, j.fy * c.elan);
  }
  utiliserArme(j){
    if (!j.arme){
      SON.jouer('vide');
      this.message('PAS D\'ARME — CASSE DES CAISSES');
      return;
    }
    if (j.attaque) return;
    if (j.munitions <= 0){ this.lancerAttaque(j, 'jet'); return; }
    j.munitions--;
    this.lancerAttaque(j, j.arme);
    majBoutonArme(j.arme, j.munitions, j.segments);
  }
  ejecterSegment(j, c){
    const a = ARMES[j.arme];
    this.tirs.push({ x:j.go.x + j.fx*16, y:j.go.y + j.fy*16 - 10,
      vx:j.fx*430, vy:j.fy*430,
      degats:c.degats, recul:c.recul,
      couleur:a.couleur, clair:a.clair, jet:true, vie:1.1 });
    if (j.segments > 0){
      j.segments--;
      j.munitions = a.munitions;
      SON.jouer('recharge');
      this.message('SEGMENT NEUF  —  ' + a.nom + ' ×' + j.munitions);
    } else {
      j.arme = null; j.munitions = 0;
      this.message('BRACELET ÉPUISÉ');
    }
    majBoutonArme(j.arme, j.munitions, j.segments);
  }
  tirer(j, c){
    const ang0 = Math.atan2(j.fy, j.fx);
    for (let i = 0; i < c.tir.nb; i++){
      const ang = ang0 + ((c.tir.nb === 1) ? 0 : (i - (c.tir.nb-1)/2) * c.tir.dispersion);
      this.tirs.push({
        x: j.go.x + j.fx*16, y: j.go.y + j.fy*16 - 10,
        vx: Math.cos(ang) * c.tir.vitesse,
        vy: Math.sin(ang) * c.tir.vitesse,
        degats: c.degats, recul: c.recul,
        couleur: ARMES[j.arme] ? ARMES[j.arme].couleur : 0xffd166,
        vie: 1.1,
      });
    }
  }
  zoneAttaque(j){
    const c = COUPS[j.attaque.type];
    if (!c.portee) return null;
    const portee = c.portee * (j.attaque.elastique ? CFG.porteeElastique : 1);
    const cx = j.go.x + j.attaque.fx * (12 + portee/2);
    const cy = j.go.y + j.attaque.fy * (12 + portee/2) - 8;
    return { rect: new Phaser.Geom.Rectangle(cx - portee/2, cy - portee/2, portee, portee) };
  }
  toucheZone(z, limites){
    if (!z) return false;
    return Phaser.Geom.Intersects.RectangleToRectangle(z.rect, limites);
  }
  frapper(m, degats, recul, sourceX, sourceY){
    const d = Math.hypot(m.go.x - sourceX, m.go.y - sourceY) || 1;
    const rx = (m.go.x - sourceX) / d, ry = (m.go.y - sourceY) / d;
    const hautCri = m.go.y - m.def.taille[1]/2 - 18;
    m.pv -= degats; m.flash = 0.14; m.assomme = 0.22; m.prepare = 0;
    m.go.body.setVelocity(rx * recul, ry * recul);
    SON.jouer('touche');
    this.eclat(m.go.x, m.go.y - 10, rx);
    if (m.pv > 0) this.crier(m.go.x, hautCri, CRIS.coup);
    if (m.pv <= 0){
      m.mort = true; this.vaincus++;
      SON.jouer('vaincu');
      this.eclat(m.go.x, m.go.y - 10, rx, m.def.boss ? 34 : 14);
      this.crier(m.go.x, hautCri, m.def.boss ? CRIS.boss : CRIS.vaincu, '#ffd166', m.def.boss ? 26 : 20);
      if (this.alea() < CFG.chanceCoeur || m.def.boss) this.creerObjet(m.go.x - 12, m.go.y, 'coeur');
      if (m.def.boss) this.creerObjet(m.go.x + 14, m.go.y, 'vie');
      m.g.destroy();
      m.go.destroy();
      if (m.def.boss) this.bossVivant = false;
      if (m.def.boss) this.message(m.def.nom + ' EST À TERRE  —  LE PONTON S\'OUVRE');
    }
  }
  casser(k, degats){
    k.pv -= degats; k.flash = 0.12;
    SON.jouer('caisse');
    this.eclat(k.go.x, k.go.y - 6, 1, 5);
    if (k.pv <= 0){
      k.casse = true;
      this.eclat(k.go.x, k.go.y - 6, 1, 16);
      this.crier(k.go.x, k.go.y - 26, CRIS.caisse, '#e8b06a', 15);
      this.creerObjet(k.go.x, k.go.y, this.butin());
      k.g.destroy();
      k.go.destroy();
    }
  }
  butin(){
    const r = this.alea();
    if (r < 0.20) return 'laser';
    if (r < 0.38) return 'pistolet';
    if (r < 0.50) return 'fusil';
    return 'coeur';
  }
  poussiere(x, y){
    for (let i = 0; i < 3; i++)
      this.eclats.push({ x: x + (this.alea()-0.5)*12, y,
        couleur: 0xd8c9a4,
        vx: (this.alea()-0.5)*60, vy: -8 - this.alea()*16,
        vie: 0.32 + this.alea()*0.13, max: 0.45 });
  }
  eclat(x, y, sens, n, couleur){
    n = n || 7;
    for (let i = 0; i < n; i++)
      this.eclats.push({ x, y, couleur: couleur || 0xffb347,
        vx: sens*(60 + this.alea()*160) + (this.alea()-0.5)*140,
        vy: (this.alea()-0.5)*220,
        vie: 0.26 + this.alea()*0.2, max: 0.46 });
  }
  blesser(j, sx, sy, degats){
    if (j.invuln > 0 || this.etat !== 'jeu') return;
    j.pv -= degats;
    j.invuln = CFG.invincibilite;
    // le choc fait lâcher ce qu'on portait : ça se brise à nos pieds
    if (j.porte){
      this.eclat(j.go.x, j.go.y - 20, 1, 10, j.porte.type === 'caisse' ? 0xb07a3e : 0x8a8f9c);
      if (j.porte.type === 'caisse'){
        SON.jouer('caisse');
        this.crier(j.go.x, j.go.y - 44, CRIS.caisse, '#e8b06a', 15);
        this.creerObjet(j.go.x, j.go.y, this.butin());
      }
      j.porte = null;
      majBoutonAction(false);
    }
    const d = Math.hypot(j.go.x - sx, j.go.y - sy) || 1;
    j.go.body.setVelocity((j.go.x - sx)/d * 280, (j.go.y - sy)/d * 280);
    this.cameras.main.shake(140, 0.008);
    SON.jouer('degat');
    this.crier(j.go.x, j.go.y - 34, CRIS.aie, '#ff9d94');
    if (j.pv <= 0){ j.pv = 0; this.terminer('Tu es hors de combat'); }
  }

  // ── objets ──────────────────────────────────────────────────
  creerObjet(x, y, type){
    const o = this.add.rectangle(x, y, 18, 18, 0xffffff, 0);
    this.physics.add.existing(o);
    o.body.setVelocity((this.alea()-0.5)*180, (this.alea()-0.5)*180);
    o.body.setDrag(220, 220);
    o.body.setCollideWorldBounds(true);
    this.objets.push({ go:o, type, phase:this.alea()*6 });
  }
  ramasser(j, o){
    if (o.type === 'vie'){
      if (PARTIE.vies >= 5) return;
      PARTIE.vies++;
      SON.jouer('unevie');
      this.message('+1 VIE');
    } else if (o.type === 'coeur'){
      if (j.pv >= CFG.pvJoueur) return;
      j.pv++;
      SON.jouer('coeur');
      this.message('+1 ♥');
    } else {
      const a = ARMES[o.type];
      if (j.arme === o.type){
        j.segments = Math.min(CFG.segmentsMax, j.segments + CFG.segmentsParBracelet);
        this.message(a.nom + '  —  +' + CFG.segmentsParBracelet + ' SEGMENTS');
      } else {
        j.arme = o.type;
        j.munitions = a.munitions;
        j.segments = CFG.segmentsParBracelet - 1;
        this.message(a.nom + '  —  □ POUR TIRER  ×' + j.munitions);
      }
      majBoutonArme(j.arme, j.munitions, j.segments);
      SON.jouer('arme');
    }
    o.pris = true;
    o.go.destroy();
  }
  message(txt){ this.msg = { t:0 }; this.hudMsg.setText(txt).setAlpha(1); }
  crier(x, y, mots, couleur, taille){
    const b = this.bulles[this.bulleSuiv = (this.bulleSuiv + 1) % this.bulles.length];
    const P = this.iso(x, y);
    b.t.setText(mots[Math.floor(this.alea() * mots.length)])
      .setColor(couleur || '#ffffff').setFontSize(taille || 18)
      .setPosition(P.x, P.y - 20).setAngle((this.alea() * 2 - 1) * 14).setVisible(true);
    b.vie = b.max = 0.55;
    b.vy = -46;
  }

  // ── zones, mort, victoire ───────────────────────────────────
  sauvegarder(){
    const j = this.joueurs[0];
    PARTIE.pv = j.pv; PARTIE.arme = j.arme; PARTIE.munitions = j.munitions;
    PARTIE.segments = j.segments;
    PARTIE.vaincus = this.vaincus; PARTIE.morts = this.morts;
  }
  majRecord(){
    const r = lireRecord();
    const n = { monstres: Math.max(r.monstres, this.vaincus), etage: Math.max(r.etage, PARTIE.niveau) };
    if (n.monstres !== r.monstres || n.etage !== r.etage) ecrireRecord(n);
    return n;
  }
  traverser(){
    if (this.etat !== 'jeu') return;
    const j = this.joueurs[0];
    this.sauvegarder();
    const r = this.majRecord();
    if (PARTIE.niveau >= NIVEAUX.length - 1){
      this.etat = 'fini';
      SON.jouer('final');
      this.hudFin.setText('LE LAGON EST CALME\n' + this.vaincus + ' monstres vaincus'
        + '\nrecord ' + r.monstres + '\n\nun bouton pour rejouer');
      return;
    }
    this.etat = 'traversee';
    this.transition = 0;
    j.attaque = null; j.charge = null; j.porte = null;
    majBoutonAction(false);
    j.go.body.setCollideWorldBounds(false);
    j.go.body.setVelocity(160, 0);        // il s'éloigne sur le ponton
    SON.jouer('ascenseur');
    const suivant = NIVEAUX[PARTIE.niveau + 1];
    this.hudFin.setText('Tu embarques\n\n' + suivant.nom + '\n' + suivant.sous);
  }
  terminer(titre){
    this.morts++;
    PARTIE.vies--;
    SON.jouer('mort');
    this.sauvegarder();
    const r = this.majRecord();
    if (PARTIE.vies <= 0){
      this.etat = 'gameover';
      this.hudFin.setText('GAME OVER\n' + this.vaincus + ' monstres vaincus'
        + '\nrecord ' + r.monstres + '\n\nun bouton pour l\'écran d\'accueil');
      return;
    }
    this.etat = 'perdu';
    this.hudFin.setText(titre + '\n'
      + (PARTIE.vies === 1 ? 'dernière vie' : PARTIE.vies + ' vies restantes')
      + '\n\nun bouton pour repartir d\'ici');
  }
  reapparaitre(){
    const j = this.joueurs[0];
    this.etat = 'jeu';
    this.hudFin.setText('');
    j.pv = CFG.pvJoueur;
    j.invuln = CFG.invulnRenais;
    j.attaque = null; j.charge = null; j.porte = null;
    majBoutonAction(false);
    j.endurance = CFG.enduranceMax;
    j.go.body.reset(this.checkpoint.x, this.checkpoint.y);
    const P = this.iso(this.checkpoint.x, this.checkpoint.y);
    this.suiveur.setPosition(P.x, P.y);
    this.cameras.main.centerOn(P.x, P.y);
    for (const m of this.monstres){
      const d = Math.hypot(m.go.x - this.checkpoint.x, m.go.y - this.checkpoint.y);
      if (d < 180){
        const k = 280 / (d || 1);
        m.go.body.setVelocity((m.go.x - this.checkpoint.x) * k, (m.go.y - this.checkpoint.y) * k);
        m.assomme = 0.6; m.prepare = 0;
      }
    }
  }
  recommencer(){
    GRAINE = (Math.random() * 1e9) | 0;
    PARTIE = nouvellePartieEtat();
    afficherRecord();
    this.scene.restart();
  }

  // ── boucle ──────────────────────────────────────────────────
  update(temps, deltaMs){
    const dt = Math.min(0.033, deltaMs / 1000);
    const j = this.joueurs[0];

    if (this.etat === 'traversee'){
      this.transition += dt;
      if (this.transition > 1.9){
        PARTIE.niveau++;
        this.scene.restart();
        return;
      }
      ENTREE.validePresse = false; ENTREE.relache = null; ENTREE.actionPresse = false; ENTREE.armePresse = false;
      this.majEclats(dt); this.dessinerTout();
      return;
    }
    if (this.etat !== 'jeu'){
      if (ENTREE.validePresse){
        ENTREE.validePresse = false; ENTREE.relache = null; ENTREE.actionPresse = false; ENTREE.armePresse = false;
        if (this.etat === 'perdu') this.reapparaitre();
        else if (this.etat === 'gameover') setTimeout(retourAuTitre, 0);
        else this.recommencer();
        return;
      }
      ENTREE.relache = null; ENTREE.actionPresse = false; ENTREE.armePresse = false;
      this.majEclats(dt); this.dessinerTout();
      return;
    }
    ENTREE.validePresse = false;

    this.majJoueur(j, dt);
    this.majMonstres(dt);
    this.majTirs(dt);
    // l'anneau au sol dit qui serait touché si on frappait maintenant —
    // la même recherche que l'aimantation, donc il dit toujours vrai
    this.cibleVisee = this.chercherCible(j, CFG.aimantPortee, CFG.aimantCone);
    for (const k of this.caisses) k.flash = Math.max(0, k.flash - dt);
    this.caisses = this.caisses.filter(k => !k.casse);
    for (const o of this.objets){
      o.phase += dt * 4;
      if (Phaser.Geom.Intersects.RectangleToRectangle(j.go.getBounds(), o.go.getBounds()))
        this.ramasser(j, o);
    }
    this.objets = this.objets.filter(o => !o.pris);

    if (this.msg){
      this.msg.t += dt;
      this.hudMsg.setAlpha(Math.max(0, 1 - this.msg.t / 2.2));
      if (this.msg.t > 2.2) this.msg = null;
    }

    // le ponton : à l'est, une fois le boss à terre
    if (j.go.x > this.ileX + this.ileL - 24 && Math.abs(j.go.y - this.pontonY) < 56){
      if (this.bossVivant){
        if (!this.avertiBoss){
          this.avertiBoss = true;
          this.message(MONSTRES[this.def.boss].nom + ' GARDE LE PONTON');
        }
      } else this.traverser();
    }

    this.majEclats(dt);
    this.dessinerTout();
  }

  majJoueur(j, dt){
    j.invuln = Math.max(0, j.invuln - dt);
    j.endurance = Math.min(CFG.enduranceMax, j.endurance + CFG.enduranceRegen * dt);

    // ── ✕ : soulever ce qui est à portée, ou lancer ce qu'on porte ──
    if (ENTREE.actionPresse){
      ENTREE.actionPresse = false;
      if (!j.attaque){
        if (j.porte) this.lancer(j);
        else this.soulever(j);
      }
    }
    // ── △ : l'arme en cours, dans la direction regardée ──
    if (ENTREE.armePresse){
      ENTREE.armePresse = false;
      if (!j.porte) this.utiliserArme(j);
    }

    // ── coups : appui bref = normal, tenu = élastique ──
    if (ENTREE.relache && performance.now() - ENTREE.relache.quand > 700) ENTREE.relache = null;
    if (j.chargeAIgnorer && ENTREE.relache && ENTREE.relache.action === j.chargeAIgnorer){
      ENTREE.relache = null; j.chargeAIgnorer = null;
    } else if (j.chargeAIgnorer && ENTREE.chargeAction !== j.chargeAIgnorer){
      j.chargeAIgnorer = null;
    }
    if (j.porte){
      // les mains sont prises : pas de coup tant qu'on porte
      ENTREE.relache = null; j.charge = null;
    } else if (!j.attaque){
      if (j.charge){
        j.charge.t = (performance.now() - j.charge.depuis) / 1000;
        const tenu = ENTREE.chargeAction === j.charge.action;
        if (!tenu || j.charge.t >= CFG.chargeMax){
          const action = j.charge.action;
          const veutElast = j.charge.t >= CFG.seuilElastique;
          const elast = veutElast && j.endurance >= 1;
          if (elast) j.endurance -= 1;
          else if (veutElast && !this.astuceEndurance){
            this.astuceEndurance = true;
            this.message("PLUS D'ENDURANCE — LA JAUGE REVIENT TOUTE SEULE");
          }
          if (tenu) j.chargeAIgnorer = action;
          ENTREE.relache = null;
          j.charge = null;
          this.lancerAttaque(j, action, elast);
        } else if (!j.charge.pret && j.charge.t >= CFG.seuilElastique && j.endurance >= 1){
          j.charge.pret = true;
          SON.jouer('tendu');
        }
      } else if (ENTREE.chargeAction && ENTREE.chargeAction !== j.chargeAIgnorer){
        j.charge = { action: ENTREE.chargeAction, depuis: ENTREE.chargeDebut,
          t: (performance.now() - ENTREE.chargeDebut)/1000, pret:false };
      } else if (ENTREE.relache){
        const r = ENTREE.relache; ENTREE.relache = null;
        const elast = r.duree >= CFG.seuilElastique && j.endurance >= 1;
        if (elast) j.endurance -= 1;
        this.lancerAttaque(j, r.action, elast);
      }
    }

    // ── l'attaque en cours frappe dans sa fenêtre ──
    if (j.attaque){
      const c = COUPS[j.attaque.type];
      j.attaque.t += dt;
      // la fente : le corps glisse vers la cible aimantée tant qu'elle est
      // hors de portée — l'anneau doré tient sa promesse
      const f = j.attaque.cible;
      if (f && !f.mort && j.attaque.t <= c.fin){
        const dx = f.go.x - j.go.x, dy = f.go.y - j.go.y;
        const d = Math.hypot(dx, dy);
        if (d > c.portee + 6) j.go.body.setVelocity(dx/d * 380, dy/d * 380);
      }
      if (j.attaque.t >= c.debut && j.attaque.t <= c.fin){
        const z = this.zoneAttaque(j);
        if (z){
          const degats = c.degats + (j.attaque.elastique ? 1 : 0);
          for (const m of this.monstres){
            if (m.mort || j.attaque.touches.has(m)) continue;
            if (this.toucheZone(z, m.go.getBounds())){
              j.attaque.touches.add(m);
              this.frapper(m, degats, c.recul, j.go.x, j.go.y);
            }
          }
          for (const k of this.caisses){
            if (k.casse || j.attaque.touches.has(k)) continue;
            if (this.toucheZone(z, k.go.getBounds())){
              j.attaque.touches.add(k);
              this.casser(k, degats);
            }
          }
        }
      }
      if (j.attaque.t >= c.duree) j.attaque = null;
    }

    // ── déplacement : deux axes analogiques ──
    // le joystick parle en directions ÉCRAN ; on les convertit en monde
    // pour que pousser vers le haut fasse monter le perso à l'écran
    const nS = Math.hypot(ENTREE.axeX, ENTREE.axeY);
    let axeMX = 0, axeMY = 0;
    if (nS > 0.001){
      const w = this.isoInv(ENTREE.axeX, ENTREE.axeY);
      const nW = Math.hypot(w.x, w.y) || 1;
      axeMX = w.x / nW * nS;
      axeMY = w.y / nW * nS;
    }
    const bloque = j.attaque && !COUPS[j.attaque.type].tir;
    const lest = j.porte ? CFG.porteVitesse : 1;   // chargé, on avance moins vite
    const cx = bloque ? 0 : axeMX * CFG.vitesse * lest;
    const cy = bloque ? 0 : axeMY * CFG.vitesse * lest;
    if (nS > 0.05 && !bloque){ j.fx = axeMX / nS; j.fy = axeMY / nS; }

    const b = j.go.body;
    const ax = (cx !== 0 ? CFG.accel : CFG.frein) * dt;
    const ay = (cy !== 0 ? CFG.accel : CFG.frein) * dt;
    b.setVelocityX(Math.abs(cx - b.velocity.x) <= ax ? cx : b.velocity.x + Math.sign(cx - b.velocity.x) * ax);
    b.setVelocityY(Math.abs(cy - b.velocity.y) <= ay ? cy : b.velocity.y + Math.sign(cy - b.velocity.y) * ay);
    j.phase += Math.hypot(b.velocity.x, b.velocity.y) * dt / 27;

    // chaque pas posé soulève un peu de poussière : c'est elle qui dit
    // que les pieds touchent le sol
    const signe = Math.sign(Math.sin(j.phase));
    if (Math.hypot(b.velocity.x, b.velocity.y) > 60 && signe !== j.pasSigne){
      j.pasSigne = signe;
      this.poussiere(j.go.x, j.go.y + 10);
    } else if (signe !== j.pasSigne) j.pasSigne = signe;

    // point de retour : là où on marchait sain et sauf
    if (j.invuln <= 0){
      this.checkpoint.x = j.go.x;
      this.checkpoint.y = j.go.y;
    }
  }

  // ── soulever et lancer, façon île aux trésors ───────────────
  soulever(j){
    let pris = null, prisD = 48, type = null;
    for (const p of this.pierres){
      const d = Math.hypot(p.go.x - j.go.x, p.go.y - j.go.y);
      if (d < prisD){ prisD = d; pris = p; type = 'pierre'; }
    }
    for (const k of this.caisses){
      const d = Math.hypot(k.go.x - j.go.x, k.go.y - j.go.y);
      if (d < prisD){ prisD = d; pris = k; type = 'caisse'; }
    }
    if (!pris) return;
    if (type === 'pierre') this.pierres = this.pierres.filter(p => p !== pris);
    else this.caisses = this.caisses.filter(k => k !== pris);
    pris.g.destroy();
    pris.go.destroy();
    j.porte = { type };
    majBoutonAction(true);
    SON.jouer('saut2');
    this.crier(j.go.x, j.go.y - 44, CRIS.souleve, '#ffd166', 14);
  }
  lancer(j){
    const type = j.porte.type;
    j.porte = null;
    majBoutonAction(false);
    this.aimanter(j, CFG.aimantPorteeTir, CFG.aimantCone * 0.55);
    SON.jouer('ejecte');
    this.crier(j.go.x, j.go.y - 44, CRIS.lancer, '#ffd166', 15);
    this.cameras.main.shake(70, 0.003);
    // le projectile vole à hauteur de corps (les monstres sont testés là) ;
    // c'est le rendu qui le dessine plus haut, au-dessus de la tête
    this.tirs.push({ lance:true, type,
      x: j.go.x + j.fx * 18, y: j.go.y - 6 + j.fy * 18,
      vx: j.fx * CFG.lancerVitesse, vy: j.fy * CFG.lancerVitesse,
      degats: CFG.lancerDegats, recul: 320, vie: 0.9 });
  }
  impactLance(t){
    this.eclat(t.x, t.y - 6, Math.sign(t.vx || 1), t.type === 'caisse' ? 14 : 8,
               t.type === 'caisse' ? 0xb07a3e : 0x8a8f9c);
    if (t.type === 'caisse'){
      SON.jouer('caisse');
      this.crier(t.x, t.y - 24, CRIS.caisse, '#e8b06a', 15);
      this.creerObjet(t.x, t.y, this.butin());
    }
  }

  majMonstres(dt){
    const j = this.joueurs[0];
    this.monstres = this.monstres.filter(m => !m.mort);
    for (const m of this.monstres){
      m.flash = Math.max(0, m.flash - dt);
      m.phase += dt * 5;
      const dx = j.go.x - m.go.x, dy = j.go.y - m.go.y;
      const dist = Math.hypot(dx, dy);

      if (m.assomme > 0){
        m.assomme -= dt;
      } else if (m.prepare > 0){
        // le boss se ramasse : il ne bouge plus, puis il fonce
        m.prepare -= dt;
        m.go.body.setVelocity(0, 0);
        if (m.prepare <= 0){
          const d = dist || 1;
          m.go.body.setVelocity(dx/d * m.def.charge.elan, dy/d * m.def.charge.elan);
          m.assomme = 0.45;
        }
      } else {
        m.repos = Math.max(0, m.repos - dt);
        const ch = m.def.charge;
        if (ch && m.repos <= 0 && dist < ch.portee){
          m.prepare = ch.preparation; m.repos = ch.repos;
          m.go.body.setVelocity(0, 0);
          SON.jouer('charge');
        } else if (dist < 240){
          const d = dist || 1;
          const v = m.def.vitesse * this.D.vitesse;
          m.go.body.setVelocity(dx/d * v, dy/d * v);
          // les coureurs au sol soulèvent aussi leur poussière
          if (!m.def.flotte && Math.sin(m.phase) > 0.95 && Math.sin(m.phase - dt*5) <= 0.95)
            this.poussiere(m.go.x, m.go.y + m.def.taille[1]/2);
        } else {
          // patrouille : un point au hasard autour de la maison
          if (!m.cible || Math.hypot(m.cible.x - m.go.x, m.cible.y - m.go.y) < 20){
            m.cible = {
              x: m.maison.x + (this.alea()*2 - 1) * 130,
              y: m.maison.y + (this.alea()*2 - 1) * 130,
            };
          }
          const cd = Math.hypot(m.cible.x - m.go.x, m.cible.y - m.go.y) || 1;
          const v = m.def.patrouille * this.D.vitesse;
          m.go.body.setVelocity((m.cible.x - m.go.x)/cd * v, (m.cible.y - m.go.y)/cd * v);
        }
      }
      // le contact se juge sur les boîtes AU SOL, pas les corps dessinés :
      // la hurtbox du héros pardonne les frôlements
      if (Phaser.Geom.Intersects.RectangleToRectangle(
            this.boiteSol(j.go, CFG.hurtbox), this.boiteSol(m.go, CFG.contactMonstre)))
        this.blesser(j, m.go.x, m.go.y, m.def.degats);
    }
  }

  majTirs(dt){
    for (const t of this.tirs){
      t.vie -= dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.vie <= 0){
        t.fini = true;
        if (t.lance) this.impactLance(t);   // l'objet retombe et se brise
        continue;
      }
      const boite = new Phaser.Geom.Rectangle(t.x - 5, t.y - 5, 10, 10);
      for (const m of this.monstres){
        if (m.mort) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(boite, m.go.getBounds())){
          this.frapper(m, t.degats, t.recul, t.x - t.vx * 0.01, t.y - t.vy * 0.01);
          t.fini = true; break;
        }
      }
      if (t.fini){ if (t.lance) this.impactLance(t); continue; }
      for (const k of this.caisses){
        if (k.casse) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(boite, k.go.getBounds())){
          this.casser(k, t.degats);
          t.fini = true; break;
        }
      }
      if (t.fini && t.lance) this.impactLance(t);
    }
    this.tirs = this.tirs.filter(t => !t.fini);
  }

  majEclats(dt){
    for (const e of this.eclats){ e.vie -= dt; e.x += e.vx*dt; e.y += e.vy*dt; }
    this.eclats = this.eclats.filter(e => e.vie > 0);
    for (const b of this.bulles){
      if (b.vie <= 0) continue;
      b.vie -= dt;
      if (b.vie <= 0){ b.t.setVisible(false); continue; }
      const k = 1 - b.vie / b.max;
      b.t.y += b.vy * dt;
      b.t.setScale(k < 0.25 ? 0.4 + (k / 0.25) * 0.8 : Math.max(1, 1.2 - (k - 0.25) * 0.3));
      b.t.setAlpha(b.vie < 0.16 ? b.vie / 0.16 : 1);
    }
  }
}
