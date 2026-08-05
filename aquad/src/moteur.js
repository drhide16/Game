// ─────────────────────────────────────────────────────────────
// SCÈNE — vue de dessus
// L'île est un rectangle de terre cerné d'eau ; la caméra suit sur les
// deux axes. L'état du joueur vit dans UN objet (this.joueurs[0]) :
// c'est la fondation du multijoueur à venir.
// ─────────────────────────────────────────────────────────────
const MARGE_EAU = 260;   // l'eau visible autour de l'île

class Aquad extends Phaser.Scene {
  constructor(){ super('aquad'); }

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
    this.monstres = []; this.decors = [];

    // le joueur ne sort pas de la terre : les limites physiques SONT l'île
    this.physics.world.setBounds(this.ileX, this.ileY, this.ileL, this.ileH);
    this.cameras.main.setBounds(0, 0, mondeL, mondeH);

    this.gSol    = this.add.graphics().setDepth(-10);   // eau et terre, en coordonnées monde
    this.gSortie = this.add.graphics().setDepth(-4);
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
      roulade: null,
      g: this.add.graphics(),       // son calque de dessin, trié par y
    };
    this.physics.add.existing(j.go);
    j.go.body.setCollideWorldBounds(true);
    this.joueurs = [j];
    this.checkpoint = { x: j.go.x, y: j.go.y };
    this.astuceEndurance = false;
    majBoutonArme(j.arme, j.munitions, j.segments);

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

    this.cameras.main.startFollow(j.go, true, 0.12, 0.12);

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
    const d = { type, x: p.x, y: p.y, g: this.add.graphics().setDepth(p.y), phase: this.alea()*6 };
    this.decors.push(d);
    this.dessinerDecor(d);
  }
  creerCaisse(){
    const p = this.poseLibre(70);
    const c = this.add.rectangle(p.x, p.y, 28, 24, 0xffffff, 0);
    this.physics.add.existing(c, true);
    this.grObstacles.add(c);
    this.caisses.push({ go:c, pv:2, flash:0, g: this.add.graphics().setDepth(p.y) });
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
  lancerAttaque(j, type, elastique){
    if (j.attaque) return;
    const c = COUPS[type];
    // la direction du coup est figée au départ : le faisceau et les
    // balles partent là où on regardait en appuyant
    j.attaque = { type, t:0, fx:j.fx, fy:j.fy,
      elastique: !!elastique && !!c.portee, touches:new Set() };
    if (j.attaque.elastique) this.crier(j.go.x, j.go.y - 40, CRIS.kiai, '#ffd166', 15);
    SON.jouer(c.son);
    if (c.secousse) this.cameras.main.shake(90, c.secousse);
    if (c.tir) this.tirer(j, c);
    if (c.jet) this.ejecterSegment(j, c);
    if (c.elan) j.go.body.setVelocity(j.fx * c.elan, j.fy * c.elan);
  }
  utiliserArme(j){
    if (!j.arme){ SON.jouer('vide'); return; }
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
    if (c.tourbillon)
      return { cercle: new Phaser.Geom.Circle(j.go.x, j.go.y - 8, portee) };
    const cx = j.go.x + j.attaque.fx * (12 + portee/2);
    const cy = j.go.y + j.attaque.fy * (12 + portee/2) - 8;
    return { rect: new Phaser.Geom.Rectangle(cx - portee/2, cy - portee/2, portee, portee) };
  }
  toucheZone(z, limites){
    if (!z) return false;
    if (z.cercle) return Phaser.Geom.Intersects.CircleToRectangle(z.cercle, limites);
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
  eclat(x, y, sens, n, couleur){
    n = n || 7;
    for (let i = 0; i < n; i++)
      this.eclats.push({ x, y, couleur: couleur || 0xffb347,
        vx: sens*(60 + this.alea()*160) + (this.alea()-0.5)*140,
        vy: (this.alea()-0.5)*220,
        vie: 0.26 + this.alea()*0.2, max: 0.46 });
  }
  blesser(j, sx, sy, degats){
    if (j.invuln > 0 || j.roulade || this.etat !== 'jeu') return;
    j.pv -= degats;
    j.invuln = CFG.invincibilite;
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
    b.t.setText(mots[Math.floor(this.alea() * mots.length)])
      .setColor(couleur || '#ffffff').setFontSize(taille || 18)
      .setPosition(x, y).setAngle((this.alea() * 2 - 1) * 14).setVisible(true);
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
    j.attaque = null; j.charge = null;
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
    j.attaque = null; j.charge = null; j.roulade = null;
    j.endurance = CFG.enduranceMax;
    j.go.body.reset(this.checkpoint.x, this.checkpoint.y);
    this.cameras.main.centerOn(this.checkpoint.x, this.checkpoint.y);
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
      ENTREE.validePresse = false; ENTREE.relache = null; ENTREE.roulPresse = false;
      this.majEclats(dt); this.dessinerTout();
      return;
    }
    if (this.etat !== 'jeu'){
      if (ENTREE.validePresse){
        ENTREE.validePresse = false; ENTREE.relache = null; ENTREE.roulPresse = false;
        if (this.etat === 'perdu') this.reapparaitre();
        else if (this.etat === 'gameover') setTimeout(retourAuTitre, 0);
        else this.recommencer();
        return;
      }
      ENTREE.relache = null; ENTREE.roulPresse = false;
      this.majEclats(dt); this.dessinerTout();
      return;
    }
    ENTREE.validePresse = false;

    this.majJoueur(j, dt);
    this.majMonstres(dt);
    this.majTirs(dt);
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

    // ── roulade : élan bref, intouchable pendant ──
    if (j.roulade){
      j.roulade.t += dt;
      if (j.roulade.t >= CFG.rouladeDuree){ j.roulade = null; }
      else {
        j.go.body.setVelocity(j.roulade.dx * CFG.rouladeVitesse, j.roulade.dy * CFG.rouladeVitesse);
        return;   // pendant la roulade, rien d'autre ne pilote
      }
    }
    if (ENTREE.roulPresse){
      ENTREE.roulPresse = false;
      if (!j.attaque && !j.roulade){
        if (j.endurance >= 1){
          j.endurance -= 1;
          const n = Math.hypot(ENTREE.axeX, ENTREE.axeY);
          const dx = n > 0.05 ? ENTREE.axeX / n : j.fx;
          const dy = n > 0.05 ? ENTREE.axeY / n : j.fy;
          j.roulade = { t: 0, dx, dy };
          j.fx = dx; j.fy = dy;
          SON.jouer('saut2');
          this.crier(j.go.x, j.go.y - 34, CRIS.roulade, '#9fe8e0', 13);
        } else if (!this.astuceEndurance){
          this.astuceEndurance = true;
          this.message("PLUS D'ENDURANCE — LA JAUGE REVIENT TOUTE SEULE");
        }
      }
    }

    // ── coups : appui bref = normal, tenu = élastique ──
    if (ENTREE.relache && performance.now() - ENTREE.relache.quand > 700) ENTREE.relache = null;
    if (j.chargeAIgnorer && ENTREE.relache && ENTREE.relache.action === j.chargeAIgnorer){
      ENTREE.relache = null; j.chargeAIgnorer = null;
    } else if (j.chargeAIgnorer && ENTREE.chargeAction !== j.chargeAIgnorer){
      j.chargeAIgnorer = null;
    }
    if (!j.attaque){
      if (ENTREE.chargeAction === 'poing' && j.arme && j.chargeAIgnorer !== 'poing'){
        j.chargeAIgnorer = 'poing';
        this.utiliserArme(j);
      } else if (j.charge){
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
        if (r.action === 'poing' && j.arme) this.utiliserArme(j);
        else this.lancerAttaque(j, r.action, elast);
      }
    }

    // ── l'attaque en cours frappe dans sa fenêtre ──
    if (j.attaque){
      const c = COUPS[j.attaque.type];
      j.attaque.t += dt;
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
    const bloque = j.attaque && !COUPS[j.attaque.type].tir;
    const cx = bloque ? 0 : ENTREE.axeX * CFG.vitesse;
    const cy = bloque ? 0 : ENTREE.axeY * CFG.vitesse;
    const n = Math.hypot(ENTREE.axeX, ENTREE.axeY);
    if (n > 0.05 && !bloque){ j.fx = ENTREE.axeX / n; j.fy = ENTREE.axeY / n; }

    const b = j.go.body;
    const ax = (cx !== 0 ? CFG.accel : CFG.frein) * dt;
    const ay = (cy !== 0 ? CFG.accel : CFG.frein) * dt;
    b.setVelocityX(Math.abs(cx - b.velocity.x) <= ax ? cx : b.velocity.x + Math.sign(cx - b.velocity.x) * ax);
    b.setVelocityY(Math.abs(cy - b.velocity.y) <= ay ? cy : b.velocity.y + Math.sign(cy - b.velocity.y) * ay);
    j.phase += Math.hypot(b.velocity.x, b.velocity.y) * dt / 27;

    // point de retour : là où on marchait sain et sauf
    if (j.invuln <= 0 && !j.roulade){
      this.checkpoint.x = j.go.x;
      this.checkpoint.y = j.go.y;
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
        } else if (dist < 300){
          const d = dist || 1;
          const v = m.def.vitesse * this.D.vitesse;
          m.go.body.setVelocity(dx/d * v, dy/d * v);
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
      if (Phaser.Geom.Intersects.RectangleToRectangle(j.go.getBounds(), m.go.getBounds()))
        this.blesser(j, m.go.x, m.go.y, m.def.degats);
    }
  }

  majTirs(dt){
    for (const t of this.tirs){
      t.vie -= dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.vie <= 0){ t.fini = true; continue; }
      const boite = new Phaser.Geom.Rectangle(t.x - 5, t.y - 5, 10, 10);
      for (const m of this.monstres){
        if (m.mort) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(boite, m.go.getBounds())){
          this.frapper(m, t.degats, t.recul, t.x - t.vx * 0.01, t.y - t.vy * 0.01);
          t.fini = true; break;
        }
      }
      if (t.fini) continue;
      for (const k of this.caisses){
        if (k.casse) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(boite, k.go.getBounds())){
          this.casser(k, t.degats);
          t.fini = true; break;
        }
      }
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
