// ─────────────────────────────────────────────────────────────
// SCÈNE
// ─────────────────────────────────────────────────────────────
class Combat extends Phaser.Scene {
  constructor(){ super('combat'); }

  create(){
    this.def = NIVEAUX[Math.min(PARTIE.niveau, NIVEAUX.length - 1)];
    this.largeur = this.def.largeur;
    // graine dérivée de l'étage : chaque étage a sa propre disposition,
    // et mourir ne la redessine pas
    this.alea = generateur(GRAINE + PARTIE.niveau * 7919);

    this.phase = 0; this.squash = 0; this.sens = 1;
    this.coyote = 0; this.buffer = 0; this.sautsAir = 0;
    this.attaque = null;
    this.pv = PARTIE.pv; this.invuln = CFG.invulnRenais;
    this.vaincus = PARTIE.vaincus; this.morts = PARTIE.morts;
    this.arme = PARTIE.arme; this.munitions = PARTIE.munitions;
    this.etat = 'jeu'; this.accroupi = false;
    this.astuceBas = false; this.astuceHaut = false;
    this.eclats = []; this.objets = []; this.caisses = [];
    this.tirs = []; this.tirsEnnemis = [];
    this.msg = null; this.transition = 0;
    this.sAvant = 0;
    majBoutonArme(this.arme, this.munitions);

    this.fond = this.add.graphics().setScrollFactor(0).setDepth(-10);
    this.gSortie = this.add.graphics().setDepth(-2);
    this.sols = this.add.group();
    this.plateformes = this.add.group();
    this.grCaisses = this.add.group();
    this.monstres = [];

    this.joueur = this.add.rectangle(120, SOL_Y - 60, 28, 40, 0xffffff, 0);
    this.physics.add.existing(this.joueur);
    this.joueur.body.setCollideWorldBounds(true);
    this.checkpoint = { x:120, y:SOL_Y - 60 };
    this.piedsAvant = SOL_Y - 40;

    this.gCaisses  = this.add.graphics().setDepth(3);
    this.gMonstres = this.add.graphics().setDepth(4);
    this.gObjets   = this.add.graphics().setDepth(4.5);
    this.perso     = this.add.graphics().setDepth(5);
    this.gEclats   = this.add.graphics().setDepth(6);
    this.gTirs     = this.add.graphics().setDepth(7);

    this.construireNiveau();
    // Les limites sont posées APRÈS la construction : la sortie tombe où
    // le tirage l'a mise, et si le monde s'arrêtait à la largeur nominale
    // elle pouvait se retrouver derrière le mur invisible, donc
    // inatteignable, et hors du champ que la caméra sait atteindre.
    this.physics.world.setBounds(0, -400, this.largeur, H + 900);
    // Pas de mur en bas : setCollideWorldBounds sert à empêcher de sortir
    // par les côtés, mais s'il bloque aussi le bas, on ne tombe jamais
    // vraiment et le test de chute ne se déclenche pas.
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setBounds(0, 0, this.largeur, H);

    this.physics.add.collider(this.joueur, this.sols);
    this.physics.add.collider(this.joueur, this.plateformes);
    this.physics.add.collider(this.joueur, this.grCaisses);
    this.cameras.main.startFollow(this.joueur, true, 0.12, 0.1, 0, 60);

    this.hud = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.hudTexte = this.add.text(22, 60, '',
      { fontFamily:'ui-monospace, Menlo, monospace', fontSize:'12px', color:'#8d9ac4' })
      .setScrollFactor(0).setDepth(10);
    this.hudMsg = this.add.text(L/2, 96, '',
      { fontFamily:'ui-monospace, Menlo, monospace', fontSize:'13px', color:'#ffd98a' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(11).setAlpha(0);
    this.hudBoss = this.add.text(L/2, H - 48, '',
      { fontFamily:'ui-monospace, Menlo, monospace', fontSize:'11px', color:'#ffb0a8' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(11).setAlpha(0);
    this.hudFin = this.add.text(L/2, H/2 - 30, '',
      { fontFamily:'ui-monospace, Menlo, monospace', fontSize:'18px', color:'#cbd5f0', align:'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(11);

    this.message(this.def.nom + '  —  ' + this.def.sous);
  }

  // ── couleurs ────────────────────────────────────────────────
  urbain(x){ return Phaser.Math.Clamp((x / this.largeur - 0.42) / 0.26, 0, 1); }
  melange(a, b, t){
    const ar=(a>>16)&255, ag=(a>>8)&255, ab=a&255;
    const br=(b>>16)&255, bg=(b>>8)&255, bb=b&255;
    return (((ar+(br-ar)*t)|0)<<16) | (((ag+(bg-ag)*t)|0)<<8) | ((ab+(bb-ab)*t)|0);
  }
  couleurSol(x){
    const t = this.def.teinte;
    if (this.def.decor === 'interieur') return t ? [t.sol, t.solBord] : [COUL.solDedans, COUL.solBordDedans];
    if (this.def.decor === 'toit')      return [COUL.solToit, COUL.solBordToit];
    const u = this.urbain(x);
    return [this.melange(COUL.sol, COUL.solVille, u), this.melange(COUL.solBord, COUL.solBordVille, u)];
  }

  // ── construction ────────────────────────────────────────────
  creerSol(x, w){
    // un seul corps physique, mais le visuel est tranché en lamelles dans
    // la zone de transition : sinon la couleur saute d'un bloc à l'autre
    const r = this.add.rectangle(x + w/2, SOL_Y + (H - SOL_Y)/2, w, H - SOL_Y, 0, 0);
    this.physics.add.existing(r, true);
    this.sols.add(r);

    const degrade = this.def.decor === 'exterieur' && this.urbain(x) !== this.urbain(x + w);
    const pas = degrade ? 40 : w;
    for (let sx = x; sx < x + w; sx += pas){
      const lw = Math.min(pas, x + w - sx);
      const [c, cb] = this.couleurSol(sx + lw/2);
      this.add.rectangle(sx + lw/2, SOL_Y + (H - SOL_Y)/2, lw + 1, H - SOL_Y, c).setDepth(-5);
      this.add.rectangle(sx + lw/2, SOL_Y + 2, lw + 1, 4, cb).setDepth(-4);
    }
  }
  creerPlateforme(x, y, w){
    const t = this.def.teinte;
    const dedans = this.def.decor !== 'exterieur';
    const p = this.add.rectangle(x + w/2, y + 7, w, 14, t ? t.plat : dedans ? 0x2a3152 : COUL.plat)
      .setStrokeStyle(2, t ? t.platBord : dedans ? 0x7f8cc4 : COUL.platBord);
    this.physics.add.existing(p, true);
    p.body.checkCollision.down = false;
    p.body.checkCollision.left = false;
    p.body.checkCollision.right = false;
    this.plateformes.add(p);
  }
  creerMonstre(type, x, minX, maxX){
    const d = MONSTRES[type];
    const y = SOL_Y - d.taille[1]/2 - d.vol;
    const go = this.add.rectangle(x, y, d.taille[0], d.taille[1], 0xffffff, 0);
    this.physics.add.existing(go);
    go.body.setCollideWorldBounds(true);
    if (d.vole || d.fixe){
      go.body.setAllowGravity(false);
      if (d.fixe) go.body.setImmovable(true);
    } else {
      this.physics.add.collider(go, this.sols);
      this.physics.add.collider(go, this.plateformes);
      this.physics.add.collider(go, this.grCaisses);
    }
    const m = {
      go, type, def:d, pv:d.pv, pvMax:d.pv, assomme:0, flash:0, blinde:0,
      dir:-1, minX, maxX, baseY:y, phase:this.alea()*6,
      prepare:0, repos:0, vise:0,
    };
    this.monstres.push(m);
    return m;
  }
  creerCaisse(x){
    const c = this.add.rectangle(x, SOL_Y - 15, 30, 30, 0xffffff, 0);
    this.physics.add.existing(c, true);
    this.grCaisses.add(c);
    this.caisses.push({ go:c, pv:2, flash:0 });
  }
  tirerType(x){
    const p = this.def.peuple;
    if (this.def.decor === 'exterieur'){
      // dehors, le violet cède la place au drone à mesure qu'on entre en ville
      const u = this.urbain(x), r = this.alea();
      if (r < 0.14) return 'colosse';
      return r < 0.14 + (1 - u) * 0.86 ? 'baveux' : 'drone';
    }
    return p[Math.floor(this.alea() * p.length)];
  }
  construireNiveau(){
    const larg = this.largeur;
    this.creerSol(-200, 900);
    let x = 700;
    // dedans le sol est plus continu que dans la rue : on est dans un
    // bâtiment, pas sur un terrain vague
    const dedans = this.def.decor !== 'exterieur';
    while (x < larg - 700){
      const long = (dedans ? 480 : 380) + this.alea() * 420;
      this.creerSol(x, long);
      if (this.alea() < (dedans ? 0.6 : 0.4))
        this.creerPlateforme(x + long*0.35, SOL_Y - 100 - this.alea()*40, 110 + this.alea()*80);
      const nb = 1 + (this.alea() < 0.45 ? 1 : 0);
      for (let i = 0; i < nb; i++){
        const mx = x + 80 + this.alea()*(long - 160);
        this.creerMonstre(this.tirerType(mx), mx, x + 30, x + long - 30);
      }
      if (this.alea() < 0.45) this.creerCaisse(x + 60 + this.alea()*(long - 120));
      x += long;
      // moins de trous à l'intérieur, et jamais sur le toit près du bord
      if (this.alea() < (dedans ? 0.35 : 0.55)) x += 70 + this.alea()*40;
    }
    this.sortieX = x + 620;
    // le monde doit englober la sortie, sinon elle est hors d'atteinte
    this.largeur = Math.max(this.largeur, this.sortieX + 300);
    // et le dernier sol court jusqu'au mur : il s'arrêtait 120 px avant,
    // dépasser l'ascenseur en courant faisait tomber dans le vide
    this.creerSol(x, this.largeur - x + 60);

    // le boss garde la sortie : elle reste verrouillée tant qu'il tient
    this.boss = this.creerMonstre(this.def.boss, this.sortieX - 190, x + 60, this.sortieX - 40);
    this.bossVivant = true;
  }

  // ── combat ──────────────────────────────────────────────────
  lancerAttaque(type){
    if (this.attaque) return;
    const c = COUPS[type];
    this.attaque = { type, t:0, bas:this.accroupi, touches:new Set() };
    SON.jouer(c.son);
    if (c.secousse) this.cameras.main.shake(90, c.secousse);
    if (c.tir) this.tirer(c);
    if (c.elan && this.joueur.body.blocked.down && !this.accroupi)
      this.joueur.body.setVelocityX(this.sens * c.elan);
  }
  utiliserArme(){
    if (!this.arme){ SON.jouer('vide'); return; }
    if (this.attaque) return;
    this.munitions--;
    this.lancerAttaque(this.arme);
    if (this.munitions <= 0){
      this.arme = null; this.munitions = 0;
      this.message('ARME VIDE');
    }
    majBoutonArme(this.arme, this.munitions);
  }
  tirer(c){
    const y = this.joueur.y + PIEDS + c.dy + (this.accroupi ? DECALAGE_ACCROUPI : 0);
    for (let i = 0; i < c.tir.nb; i++){
      const ec = (c.tir.nb === 1) ? 0 : (i - (c.tir.nb-1)/2) * c.tir.dispersion;
      this.tirs.push({
        x: this.joueur.x + this.sens*16, y,
        vx: this.sens * c.tir.vitesse * Math.cos(ec),
        vy: c.tir.vitesse * Math.sin(ec),
        degats: c.degats, recul: c.recul, bas: this.attaque.bas,
        couleur: ARMES[this.arme] ? ARMES[this.arme].couleur : 0xffd166,
        vie: 1.1,
      });
    }
  }
  zonesAttaque(){
    const c = COUPS[this.attaque.type];
    if (!c.portee) return [];
    const dirs = c.bilateral ? [1, -1] : [this.sens];
    const y = this.joueur.y + PIEDS + c.dy + (this.attaque.bas ? DECALAGE_ACCROUPI : 0);
    return dirs.map(d => {
      const cx = this.joueur.x + d * (14 + c.portee/2);
      return new Phaser.Geom.Rectangle(cx - c.portee/2, y - c.hauteur/2, c.portee, c.hauteur);
    });
  }
  vulnerable(m, bas){
    if (m.def.faible === 'bas')  return bas;
    if (m.def.faible === 'haut') return !bas;
    return true;
  }
  frapper(m, degats, recul, bas, sourceX, ecrase){
    // l'écrasement vient du dessus : la règle des hauteurs ne s'applique
    // qu'aux coups horizontaux, on retombe sur n'importe quelle bestiole
    if (!ecrase && !this.vulnerable(m, bas)){
      m.blinde = 0.18;
      SON.jouer('blinde');
      this.eclat(m.go.x, m.go.y, 0, 3, COUL.blinde);
      if (m.def.faible === 'bas' && !this.astuceBas){
        this.astuceBas = true;
        this.message("ACCROUPIS-TOI POUR TOUCHER LE VIOLET");
      } else if (m.def.faible === 'haut' && !this.astuceHaut){
        this.astuceHaut = true;
        this.message('LE DRONE VOLE TROP HAUT, RELÈVE-TOI');
      }
      return;
    }
    const dir = Math.sign(m.go.x - sourceX) || this.sens;
    m.pv -= degats; m.flash = 0.14;
    if (!m.def.fixe){
      m.assomme = 0.22; m.prepare = 0;
      m.go.body.setVelocity(dir * recul * (m.def.boss ? 0.35 : 1), m.def.vole ? 0 : -160);
    }
    SON.jouer('touche');
    this.eclat(m.go.x, m.go.y, dir);
    if (m.pv <= 0){
      m.mort = true; this.vaincus++;
      SON.jouer('vaincu');
      this.eclat(m.go.x, m.go.y, dir, m.def.boss ? 34 : 14);
      if (this.alea() < CFG.chanceCoeur || m.def.boss) this.creerObjet(m.go.x, m.go.y - 8, 'coeur');
      m.go.destroy();
      if (m.def.boss){
        this.bossVivant = false;
        if (m.def.final) this.gagnerPartie();
        else this.message(m.def.nom + ' EST À TERRE  —  LA SORTIE S\'OUVRE');
      }
    }
  }
  casser(k, degats){
    k.pv -= degats; k.flash = 0.12;
    SON.jouer('caisse');
    this.eclat(k.go.x, k.go.y - 4, this.sens, 5);
    if (k.pv <= 0){
      k.casse = true;
      this.eclat(k.go.x, k.go.y - 4, this.sens, 16);
      this.creerObjet(k.go.x, k.go.y - 8, this.butin());
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
      this.eclats.push({ x, y:y-6, couleur: couleur || 0xffb347,
        vx: sens*(60 + this.alea()*190) + (this.alea()-0.5)*90,
        vy: -110 + (this.alea()-0.5)*220,
        vie: 0.28 + this.alea()*0.22, max: 0.5 });
  }
  poussiere(vx){
    // petits nuages sous les pieds quand on court vite : c'est ce qui
    // donne le sentiment de vitesse, plus que l'animation elle-même
    const s = Math.sign(vx) || 1;
    for (let i = 0; i < 3; i++)
      this.eclats.push({ x: this.joueur.x - s*8, y: this.joueur.y + PIEDS - 1,
        couleur: COUL.poussiere,
        vx: -s*(40 + this.alea()*90), vy: -15 - this.alea()*55,
        vie: 0.2 + this.alea()*0.18, max: 0.38 });
  }
  blesser(source, degats){
    if (this.invuln > 0 || this.etat !== 'jeu') return;
    this.pv -= degats;
    this.invuln = CFG.invincibilite;
    const dir = this.joueur.x < source ? -1 : 1;
    this.joueur.body.setVelocity(dir * 240, -280);
    this.cameras.main.shake(140, 0.008);
    SON.jouer('degat');
    if (this.pv <= 0){ this.pv = 0; this.terminer('Tu es hors de combat'); }
  }

  // ── objets ──────────────────────────────────────────────────
  creerObjet(x, y, type){
    const o = this.add.rectangle(x, y, 18, 18, 0xffffff, 0);
    this.physics.add.existing(o);
    o.body.setVelocity((this.alea()-0.5)*140, -230);
    o.body.setBounce(0.35);
    o.body.setDragX(160);
    this.physics.add.collider(o, this.sols);
    this.physics.add.collider(o, this.plateformes);
    this.physics.add.collider(o, this.grCaisses);
    this.objets.push({ go:o, type, phase:this.alea()*6 });
  }
  ramasser(o){
    if (o.type === 'coeur'){
      if (this.pv >= CFG.pvJoueur) return;   // on laisse le cœur au sol pour plus tard
      this.pv++;
      SON.jouer('coeur');
      this.message('+1 ♥');
    } else {
      const a = ARMES[o.type];
      this.munitions = (this.arme === o.type ? this.munitions : 0) + a.munitions;
      this.arme = o.type;
      majBoutonArme(this.arme, this.munitions);
      SON.jouer('arme');
      this.message(a.nom + '  —  □ POUR TIRER  ×' + this.munitions);
    }
    o.pris = true;
    o.go.destroy();
  }
  message(txt){ this.msg = { t:0 }; this.hudMsg.setText(txt).setAlpha(1); }

  // ── étages, mort, victoire ──────────────────────────────────
  sauvegarder(){
    PARTIE.pv = this.pv; PARTIE.arme = this.arme; PARTIE.munitions = this.munitions;
    PARTIE.vaincus = this.vaincus; PARTIE.morts = this.morts;
  }
  majRecord(){
    const r = lireRecord();
    const n = { monstres: Math.max(r.monstres, this.vaincus), etage: Math.max(r.etage, PARTIE.niveau) };
    if (n.monstres !== r.monstres || n.etage !== r.etage) ecrireRecord(n);
    return n;
  }
  monterEtage(){
    if (this.etat !== 'jeu') return;
    this.etat = 'monte';
    this.transition = 0;
    // on entre VRAIMENT dans la cabine : pendant la transition plus rien
    // ne pilotait le corps, il gardait sa vitesse, glissait au-delà du
    // bord et tombait. On le pose au centre, on coupe la gravité, et il
    // s'élève doucement — vite sur l'échelle, à peine dans l'ascenseur.
    this.attaque = null;
    this.accroupi = false;
    this.joueur.body.reset(this.sortieX, this.joueur.y);
    this.joueur.body.setAllowGravity(false);
    this.joueur.body.setVelocity(0, this.def.sortie === 'echelle' ? -70 : -22);
    this.sauvegarder();
    this.majRecord();
    SON.jouer('ascenseur');
    const suivant = NIVEAUX[PARTIE.niveau + 1];
    this.hudFin.setText((this.def.sortie === 'echelle' ? 'Tu grimpes' : 'L\'ascenseur monte')
      + '\n\n' + suivant.nom + '\n' + suivant.sous);
  }
  gagnerPartie(){
    this.etat = 'fini';
    this.sauvegarder();
    const r = this.majRecord();
    SON.jouer('final');
    this.hudFin.setText('LE TOIT EST À TOI\n' + this.vaincus + ' monstres vaincus'
      + '\nrecord ' + r.monstres + '\n\n↑ ou un bouton pour rejouer');
  }
  terminer(titre){
    this.morts++;
    PARTIE.vies--;
    SON.jouer('mort');
    this.sauvegarder();
    const r = this.majRecord();
    if (PARTIE.vies <= 0){
      // plus de vie : game over, et retour à l'écran d'accueil
      this.etat = 'gameover';
      this.hudFin.setText('GAME OVER\n' + this.vaincus + ' monstres vaincus'
        + '\nrecord ' + r.monstres + '\n\nun bouton pour l\'écran d\'accueil');
      return;
    }
    this.etat = 'perdu';
    this.hudFin.setText(titre + '\n'
      + (PARTIE.vies === 1 ? 'dernière vie' : PARTIE.vies + ' vies restantes')
      + '\n\n↑ ou un bouton pour repartir d\'ici');
  }
  // On ne relance pas la scène : le monde, les monstres déjà vaincus et
  // les caisses ouvertes restent en l'état. On repose seulement le joueur
  // au dernier endroit où il avait les pieds sur quelque chose de solide.
  reapparaitre(){
    this.etat = 'jeu';
    this.hudFin.setText('');
    this.pv = CFG.pvJoueur;
    this.invuln = CFG.invulnRenais;
    this.attaque = null;
    this.squash = 0;
    this.joueur.body.reset(this.checkpoint.x, this.checkpoint.y);
    this.piedsAvant = this.checkpoint.y + PIEDS;
    this.cameras.main.centerOn(this.checkpoint.x, this.checkpoint.y);
    for (const m of this.monstres){
      if (!m.def.fixe && Math.abs(m.go.x - this.checkpoint.x) < 160){
        const d = Math.sign(m.go.x - this.checkpoint.x) || 1;
        m.go.body.setVelocity(d * 280, m.def.vole ? 0 : -220);
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
    const b = this.joueur.body;

    if (this.etat === 'monte'){
      // l'ascenseur prend son temps, puis l'étage suivant se construit
      this.transition += dt;
      if (this.transition > 1.9){
        PARTIE.niveau++;
        this.scene.restart();
        return;
      }
      ENTREE.validePresse = false; ENTREE.coupPresse = null; ENTREE.hautPresse = false;
      this.majEclats(dt); this.dessinerTout(b);
      return;
    }

    if (this.etat !== 'jeu'){
      if (ENTREE.validePresse){
        ENTREE.validePresse = false; ENTREE.sautPresse = false; ENTREE.coupPresse = null;
        ENTREE.hautPresse = false;
        if (this.etat === 'perdu') this.reapparaitre();
        // le retour au titre détruit la partie : hors de la boucle de jeu,
        // sinon Phaser se fait couper l'herbe sous le pied en plein update
        else if (this.etat === 'gameover') setTimeout(retourAuTitre, 0);
        else this.recommencer();
        return;
      }
      ENTREE.coupPresse = null; ENTREE.hautPresse = false; ENTREE.sautPresse = false;
      this.majEclats(dt); this.dessinerTout(b);
      return;
    }
    ENTREE.validePresse = false;

    const auSol = b.blocked.down || b.touching.down;
    this.accroupi = ENTREE.accroupi && auSol;

    // Les appuis d'attaque restent en réserve un court instant au lieu
    // d'être avalés : taper pendant un coup en cours lançait... rien, et
    // en rampant vers un monstre un appui sur deux disparaissait. Le
    // coup suivant part dès que le bras est libre, comme pour le saut.
    // l'expiration doit couvrir le plus long des coups (retourné, 620 ms),
    // sinon presser au début d'un coup expirait avant la fin de celui-ci
    if (ENTREE.hautPresse && performance.now() - ENTREE.hautT > 700) ENTREE.hautPresse = false;
    if (ENTREE.coupPresse && performance.now() - ENTREE.coupT > 700) ENTREE.coupPresse = null;
    if (!this.attaque){
      if (ENTREE.hautPresse){ ENTREE.hautPresse = false; this.lancerAttaque('crochet'); }
      else if (ENTREE.coupPresse){
        const coup = ENTREE.coupPresse;
        ENTREE.coupPresse = null;
        if (coup === 'poing' && this.arme) this.utiliserArme();
        else this.lancerAttaque(coup);
      }
    }

    if (this.attaque){
      const c = COUPS[this.attaque.type];
      this.attaque.t += dt;
      if (this.attaque.t >= c.debut && this.attaque.t <= c.fin){
        const zones = this.zonesAttaque();
        if (zones.length){
          for (const m of this.monstres){
            if (m.mort || this.attaque.touches.has(m)) continue;
            if (zones.some(z => Phaser.Geom.Intersects.RectangleToRectangle(z, m.go.getBounds()))){
              this.attaque.touches.add(m);
              this.frapper(m, c.degats, c.recul, this.attaque.bas, this.joueur.x);
            }
          }
          for (const k of this.caisses){
            if (k.casse || this.attaque.touches.has(k)) continue;
            if (zones.some(z => Phaser.Geom.Intersects.RectangleToRectangle(z, k.go.getBounds()))){
              this.attaque.touches.add(k);
              this.casser(k, c.degats);
            }
          }
        }
      }
      if (this.attaque.t >= c.duree) this.attaque = null;
    }

    // déplacement : le joystick est analogique, la vitesse suit son inclinaison
    const bloque = this.attaque && auSol && !COUPS[this.attaque.type].tir;
    const vMax = this.accroupi ? CFG.vitesseAccroupi : CFG.vitesseCourse;
    const cible = bloque ? 0 : ENTREE.axeX * vMax;
    if (Math.abs(ENTREE.axeX) > 0.05 && !bloque) this.sens = Math.sign(ENTREE.axeX);

    const a = (cible !== 0 ? CFG.accel : CFG.frein) * (auSol ? 1 : CFG.controleAir) * dt;
    const vx = b.velocity.x;
    b.setVelocityX(Math.abs(cible - vx) <= a ? cible : vx + Math.sign(cible - vx) * a);

    // sauts : un au sol, un en l'air
    if (auSol) this.sautsAir = 1;
    this.coyote = auSol ? CFG.coyote : Math.max(0, this.coyote - dt);
    if (ENTREE.sautPresse){ ENTREE.sautPresse = false; this.buffer = CFG.bufferSaut; }
    this.buffer = Math.max(0, this.buffer - dt);
    if (this.buffer > 0 && this.coyote > 0){
      b.setVelocityY(-CFG.vitesseSaut);
      this.coyote = 0; this.buffer = 0; this.squash = -1;
      SON.jouer('saut');
    } else if (this.buffer > 0 && this.sautsAir > 0){
      b.setVelocityY(-CFG.sautAerien);
      this.sautsAir--; this.buffer = 0; this.squash = -1;
      SON.jouer('saut2');
      this.eclat(this.joueur.x, this.joueur.y + PIEDS, 0, 6, 0x9fb4ff);
    }
    if (!ENTREE.saut && b.velocity.y < -CFG.coupureSaut) b.setVelocityY(-CFG.coupureSaut);

    if (auSol && !this.auSolAvant && this.vyAvant > 300) this.squash = 1;
    this.auSolAvant = auSol; this.vyAvant = b.velocity.y;
    this.squash += (0 - this.squash) * Math.min(1, dt * 12);
    if (auSol) this.phase += (Math.abs(b.velocity.x) * dt) / 27;
    this.invuln = Math.max(0, this.invuln - dt);

    // poussière à chaque appui de pied quand on court vite
    const sPhase = Math.sin(this.phase);
    if (auSol && Math.abs(b.velocity.x) > CFG.vitesseCourse * 0.55 && this.sAvant * sPhase <= 0 && !this.accroupi)
      this.poussiere(b.velocity.x);
    this.sAvant = sPhase;

    if (auSol && Math.abs(b.velocity.y) < 40){
      this.checkpoint.x = this.joueur.x;
      this.checkpoint.y = this.joueur.y;
    }

    this.majMonstres(dt);
    this.majTirs(dt);

    for (const k of this.caisses) k.flash = Math.max(0, k.flash - dt);
    this.caisses = this.caisses.filter(k => !k.casse);

    for (const o of this.objets){
      o.phase += dt * 4;
      if (o.go.y > H + 200){ o.pris = true; o.go.destroy(); continue; }
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.joueur.getBounds(), o.go.getBounds()))
        this.ramasser(o);
    }
    this.objets = this.objets.filter(o => !o.pris);

    if (this.msg){
      this.msg.t += dt;
      this.hudMsg.setAlpha(Math.max(0, 1 - this.msg.t / 2.2));
      if (this.msg.t > 2.2) this.msg = null;
    }

    if (this.joueur.y > H + 40) this.terminer('Tombé dans le vide');
    // la sortie : porte, ascenseur ou échelle, mais seulement une fois
    // le boss de l'étage à terre
    if (this.def.sortie !== 'patron' && Math.abs(this.joueur.x - this.sortieX) < 34){
      if (this.bossVivant){
        if (!this.avertiBoss){
          this.avertiBoss = true;
          this.message(MONSTRES[this.def.boss].nom + ' GARDE LA SORTIE');
        }
      } else this.monterEtage();
    }

    this.piedsAvant = this.joueur.y + PIEDS;
    this.vyChute = this.joueur.body.velocity.y;
    this.majEclats(dt);
    this.dessinerTout(b);
  }

  majMonstres(dt){
    this.monstres = this.monstres.filter(m => !m.mort);
    for (const m of this.monstres){
      m.flash  = Math.max(0, m.flash - dt);
      m.blinde = Math.max(0, m.blinde - dt);
      m.phase += dt * 5;
      const dx = this.joueur.x - m.go.x;
      const memeNiveau = Math.abs(this.joueur.y - m.go.y) < 110;

      if (m.def.fixe){
        this.majTourelle(m, dt, dx, memeNiveau);
      } else if (m.assomme > 0){
        m.assomme -= dt;
      } else if (m.prepare > 0){
        // le gardien s'est ramassé : il ne bouge plus, puis se détend
        m.prepare -= dt;
        m.go.body.setVelocityX(0);
        if (m.prepare <= 0){
          m.go.body.setVelocity(Math.sign(dx || 1) * m.def.charge.elan, -180);
          m.assomme = 0.45;
        }
      } else {
        m.repos = Math.max(0, m.repos - dt);
        const ch = m.def.charge;
        if (ch && m.repos <= 0 && Math.abs(dx) < ch.portee && memeNiveau){
          m.prepare = ch.preparation; m.repos = ch.repos;
          m.go.body.setVelocityX(0);
          SON.jouer('charge');
        } else {
          let v;
          if (Math.abs(dx) < 340 && memeNiveau) v = Math.sign(dx) * m.def.vitesse;
          else {
            if (m.go.x < m.minX) m.dir = 1;
            if (m.go.x > m.maxX) m.dir = -1;
            v = m.dir * m.def.patrouille;
          }
          if ((m.go.x <= m.minX && v < 0) || (m.go.x >= m.maxX && v > 0)) v = 0;
          m.go.body.setVelocityX(v);
          if (m.def.vole){
            const vise = m.baseY + Math.sin(m.phase * 0.7) * 7;
            m.go.body.setVelocityY((vise - m.go.y) * 4);
          }
        }
      }

      // Retomber SUR une bestiole l'écrase au lieu de nous blesser.
      // Le test est un BALAYAGE du sommet, pas un chevauchement : en
      // pleine chute le corps avance de 50 px et plus par image, il peut
      // traverser un monstre entier entre deux vérifications.
      const hautM = m.go.y - m.def.taille[1]/2;
      const surLui = Math.abs(this.joueur.x - m.go.x) < 14 + m.def.taille[0]/2;
      const piedsIci = this.joueur.y + PIEDS;
      // vyChute : la vitesse d'il y a une image. Si le franchissement et
      // l'atterrissage tombent dans la même image, le sol a déjà remis la
      // vitesse à zéro quand on arrive ici — on jugerait « pas en chute »
      if ((this.joueur.body.velocity.y > 140 || this.vyChute > 140) && surLui
          && this.piedsAvant <= hautM + 2 && piedsIci >= hautM){
        const vx0 = this.joueur.body.velocity.x;
        this.joueur.body.reset(this.joueur.x, hautM - PIEDS);  // reposé sur la bestiole
        this.joueur.body.setVelocity(vx0, -CFG.rebondEcrase);
        this.sautsAir = Math.max(this.sautsAir, 1);   // le rebond rend le saut aérien
        this.squash = -1;
        this.invuln = Math.max(this.invuln, 0.3);     // le temps de ressortir du rebond
        this.frapper(m, 1, 130, false, this.joueur.x, true);
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(this.joueur.getBounds(), m.go.getBounds())){
        this.blesser(m.go.x, m.def.degats);
      }
      if (m.go.y > H + 200){ m.mort = true; m.go.destroy(); }
    }
  }
  majTourelle(m, dt, dx, memeNiveau){
    const c = m.def.canon;
    m.repos = Math.max(0, m.repos - dt);
    if (m.vise > 0){
      m.vise -= dt;
      if (m.vise <= 0){
        const dy = (this.joueur.y - 10) - (m.go.y - 6);
        const d = Math.hypot(dx, dy) || 1;
        this.tirsEnnemis.push({
          x:m.go.x + Math.sign(dx || 1)*12, y:m.go.y - 6,
          vx: dx/d * c.vitesse, vy: dy/d * c.vitesse, vie:2.2,
        });
        SON.jouer('tirEnnemi');
      }
    } else if (m.repos <= 0 && Math.abs(dx) < c.portee && memeNiveau){
      m.vise = c.visee; m.repos = c.repos;
      SON.jouer('visee');
    }
  }

  majTirs(dt){
    for (const t of this.tirs){
      t.vie -= dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.vie <= 0){ t.fini = true; continue; }
      const boite = new Phaser.Geom.Rectangle(t.x - 5, t.y - 3, 10, 6);
      for (const m of this.monstres){
        if (m.mort) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(boite, m.go.getBounds())){
          this.frapper(m, t.degats, t.recul, t.bas, t.x - t.vx * 0.01);
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

    for (const t of this.tirsEnnemis){
      t.vie -= dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.vie <= 0){ t.fini = true; continue; }
      const boite = new Phaser.Geom.Rectangle(t.x - 5, t.y - 5, 10, 10);
      if (Phaser.Geom.Intersects.RectangleToRectangle(boite, this.joueur.getBounds())){
        this.blesser(t.x, 1);
        t.fini = true;
      }
    }
    this.tirsEnnemis = this.tirsEnnemis.filter(t => !t.fini);
  }

  majEclats(dt){
    for (const e of this.eclats){ e.vie -= dt; e.vy += 900*dt; e.x += e.vx*dt; e.y += e.vy*dt; }
    this.eclats = this.eclats.filter(e => e.vie > 0);
  }
}
