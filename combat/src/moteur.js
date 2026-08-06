// ─────────────────────────────────────────────────────────────
// SCÈNE
// ─────────────────────────────────────────────────────────────
class Combat extends Phaser.Scene {
  constructor(){ super('combat'); }

  preload(){
    // l'atlas du héros vient d'une donnée base64 : le Loader sait la
    // charger, et create() n'est appelé qu'une fois la texture prête.
    // Aux étages suivants (scene.restart) elle est déjà là.
    if (!this.textures.exists('persoAtlas'))
      this.load.image('persoAtlas', ATLAS_PERSO);
    if (!this.textures.exists('decorAtlas'))
      this.load.image('decorAtlas', ATLAS_DECOR);
  }

  create(){
    this.def = NIVEAUX[Math.min(PARTIE.niveau, NIVEAUX.length - 1)];
    this.D = DIFFICULTES[PARTIE.difficulte] || DIFFICULTES.moyen;
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
    this.segments = PARTIE.segments | 0;
    this.etat = 'jeu'; this.accroupi = false;
    this.astuceBas = false; this.astuceHaut = false;
    this.eclats = []; this.objets = []; this.caisses = [];
    this.bulles = []; this.bulleSuiv = 0;
    this.tirs = []; this.tirsEnnemis = [];
    this.msg = null; this.transition = 0;
    this.endurance = CFG.enduranceMax;
    this.charge = null; this.chargeAIgnorer = null; this.astuceEndurance = false;
    this.sAvant = 0;
    majBoutonArme(this.arme, this.munitions, this.segments);

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
    // le héros en pixel-art : on déclare chaque frame de l'atlas (une
    // seule fois, la texture survit aux restarts), puis l'image qui les
    // affichera et un petit pool de boules de feu pour les balles
    const texPerso = this.textures.get('persoAtlas');
    texPerso.setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const anim in CADRES_PERSO)
      CADRES_PERSO[anim].forEach((c, i) => {
        if (!texPerso.has(anim + i)) texPerso.add(anim + i, 0, c.x, c.y, c.w, c.h);
      });
    this.persoSpr = this.add.image(0, 0, 'persoAtlas', 'marche0').setDepth(5);
    this.imgTirs = [];
    for (let i = 0; i < 10; i++)
      this.imgTirs.push(this.add.image(0, 0, 'persoAtlas', 'boule0')
        .setDepth(7).setVisible(false).setScale(0.7));
    // les dépouilles des monstres à sprites : un petit pool qui s'efface
    this.cadavres = [];
    this.imgCadavres = [];
    for (let i = 0; i < 6; i++)
      this.imgCadavres.push(this.add.image(0, 0, 'persoAtlas', 'bavMort0')
        .setDepth(3.6).setVisible(false));
    // les décors : frames déclarées, et un pool d'images de FOND en
    // espace écran (la parallaxe est calculée à la main, comme le
    // dessin de this.fond)
    const texDec = this.textures.get('decorAtlas');
    texDec.setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const nomD in CADRES_DECOR){
      const cD = CADRES_DECOR[nomD];
      if (!texDec.has(nomD)) texDec.add(nomD, 0, cD.x, cD.y, cD.w, cD.h);
    }
    this.imgFond = [];
    for (let i = 0; i < 44; i++)
      this.imgFond.push(this.add.image(0, 0, 'decorAtlas', 'sapin1')
        .setScrollFactor(0).setDepth(-9).setVisible(false));
    this.fondN = 0;
    this.imgObjets = [];
    for (let i = 0; i < 10; i++)
      this.imgObjets.push(this.add.image(0, 0, 'decorAtlas', 'coeur')
        .setDepth(4.5).setVisible(false));
    this.gEclats   = this.add.graphics().setDepth(6);
    this.gTirs     = this.add.graphics().setDepth(7);
    // huit textes recycles pour les onomatopees : creer un objet texte a
    // chaque coup coute cher, on fait tourner un petit pool
    for (let i = 0; i < 8; i++){
      const t = this.add.text(0, 0, '', { fontFamily:'Arcade, ui-monospace, monospace', fontSize:'18px', color:'#ffffff' })
        .setStroke('#0d1120', 6).setOrigin(0.5).setDepth(8).setVisible(false);
      this.bulles.push({ t, vie:0, max:1, vy:0 });
    }

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
      { fontFamily:'ui-monospace, Menlo, monospace', fontSize:'12px', color:'#aeb9dd' })
      .setStroke('#0d1120', 3).setScrollFactor(0).setDepth(10);
    this.hudMsg = this.add.text(L/2, 96, '',
      { fontFamily:'ui-monospace, Menlo, monospace', fontSize:'13px', color:'#ffd98a' })
      .setStroke('#0d1120', 4).setOrigin(0.5).setScrollFactor(0).setDepth(11).setAlpha(0);
    this.hudBoss = this.add.text(L/2, H - 48, '',
      { fontFamily:'ui-monospace, Menlo, monospace', fontSize:'11px', color:'#ffb0a8' })
      .setStroke('#0d1120', 3).setOrigin(0.5).setScrollFactor(0).setDepth(11).setAlpha(0);
    this.hudFin = this.add.text(L/2, H/2 - 30, '',
      { fontFamily:'ui-monospace, Menlo, monospace', fontSize:'18px', color:'#cbd5f0', align:'center' })
      .setStroke('#0d1120', 5).setOrigin(0.5).setScrollFactor(0).setDepth(11);

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
    if (t) return [t.sol, t.solBord];   // forêt, désert, ville de jour
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
    this.segmentsSol.push({ x0:x, x1:x + w });

    // la tuile de sol pixel-art, répétée sur la largeur du segment ;
    // les brins d'herbe dépassent un peu au-dessus de la ligne de sol
    const nomSol = this.def.decor === 'interieur' ? 'solMetal'
                 : this.def.decor === 'toit' ? 'solGravier'
                 : (this.def.decor === 'villeJour'
                    || (this.def.decor === 'exterieur' && this.urbain(x + w/2) > 0.5)) ? 'solVille'
                 : 'solHerbe';
    const cs = CADRES_DECOR[nomSol];
    this.add.tileSprite(x + w/2, SOL_Y - 8 + cs.h/2, w, cs.h, 'decorAtlas', nomSol).setDepth(-5);
    // et la nuit sous la tuile, jusqu'en bas du monde
    const yT = SOL_Y - 8 + cs.h;
    this.add.rectangle(x + w/2, yT + 300, w, 600, 0x120d1c).setDepth(-5.1);
  }
  creerPlateforme(x, y, w){
    // le corps physique est invisible : l'habillage est une corniche
    // herbeuse, le haut de la tuile de sol
    const p = this.add.rectangle(x + w/2, y + 7, w, 14, 0, 0);
    this.add.tileSprite(x + w/2, y + 10, w, CADRES_DECOR.plateforme.h, 'decorAtlas', 'plateforme')
      .setDepth(-4);
    this.physics.add.existing(p, true);
    p.body.checkCollision.down = false;
    p.body.checkCollision.left = false;
    p.body.checkCollision.right = false;
    this.plateformes.add(p);
  }
  // y a-t-il du sol sous ce x ? (les trous sont les intervalles laissés
  // entre deux segments par le tirage)
  solSous(x){
    return this.segmentsSol.some(s => x >= s.x0 && x <= s.x1);
  }
  // un monstre quand même tombé dans un trou (recul en cloche, bond de
  // charge...) n'est pas perdu : on le repêche sur le sol le plus proche.
  // Avant, il était détruit en silence — un boss au fond d'un trou
  // laissait la sortie verrouillée à jamais.
  repecher(m){
    let cx = m.go.x, mieux = Infinity;
    for (const s of this.segmentsSol){
      const p = Phaser.Math.Clamp(m.go.x, s.x0 + 40, s.x1 - 40);
      const d = Math.abs(p - m.go.x);
      if (d < mieux){ mieux = d; cx = p; }
    }
    m.go.body.reset(cx, m.baseY);
    m.assomme = 0.6;
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
    const pv = Math.max(1, Math.round(d.pv * this.D.pv));
    const m = {
      go, type, def:d, pv, pvMax:pv, assomme:0, flash:0, blinde:0,
      dir:-1, minX, maxX, baseY:y, phase:this.alea()*6,
      prepare:0, repos:0, vise:0,
    };
    // les monstres qui ont leur planche : une image plutôt qu'un dessin
    const sm = SPRITES_MONSTRES[type];
    if (sm){
      m.sprPref = sm.pref;
      m.sprE = (d.taille[1] * sm.k) / CADRES_PERSO[sm.pref + 'Va'][0].h;
      m.spr = this.add.image(0, 0, 'persoAtlas', sm.pref + 'Va0').setDepth(4).setVisible(false);
    }
    this.monstres.push(m);
    return m;
  }
  creerCaisse(x){
    const c = this.add.rectangle(x, SOL_Y - 15, 30, 30, 0xffffff, 0);
    this.physics.add.existing(c, true);
    this.grCaisses.add(c);
    const img = this.add.image(x, SOL_Y + 1, 'decorAtlas', 'caisseOK')
      .setOrigin(0.5, 1).setScale(36 / CADRES_DECOR.caisseOK.h).setDepth(3);
    this.caisses.push({ go:c, pv:2, flash:0, img, efface:0 });
  }
  // un bloc bonus posé au sol : un coup de poing ou de pied le frappe
  // et sa rune jaillit — le clin d'œil à Mario reste dans le visuel
  creerBloc(x, contenu){
    const y = SOL_Y - 24;
    const img = this.add.image(x, y, 'decorAtlas', 'blocPlein')
      .setScale(46 / CADRES_DECOR.blocPlein.h).setDepth(2.5);
    this.blocs.push({ img, x, y, contenu, plein:true, frappe:0, phase:this.alea()*6 });
  }
  majBlocs(dt){
    for (const bl of this.blocs){
      bl.phase += dt * 2.4;
      bl.frappe = Math.max(0, bl.frappe - dt);
      if (!bl.plein || !this.attaque) continue;
      const c = COUPS[this.attaque.type];
      if (!c.portee || this.attaque.t < c.debut || this.attaque.t > c.fin) continue;
      if (this.attaque.touches.has(bl)) continue;
      const boite = new Phaser.Geom.Rectangle(bl.x - 23, bl.y - 23, 46, 46);
      if (this.zonesAttaque().some(z => Phaser.Geom.Intersects.RectangleToRectangle(z, boite))){
        this.attaque.touches.add(bl);
        bl.plein = false; bl.frappe = 0.3;
        SON.jouer('caisse');
        this.cameras.main.shake(60, 0.003);
        this.crier(bl.x, bl.y - 36, ['!'], '#ffd166', 18);
        this.creerObjet(bl.x, bl.y - 24, bl.contenu);
      }
    }
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
    this.segmentsSol = [];
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
      let nb = 1 + (this.alea() < 0.45 ? 1 : 0);
      if (this.D.monstres > 1 && this.alea() < this.D.monstres - 1) nb++;
      if (this.D.monstres < 1 && this.alea() > this.D.monstres && nb > 1) nb--;
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

    // les blocs bonus : un segment sur deux environ, à hauteur de saut,
    // avec les trois pouvoirs en rotation
    this.blocs = [];
    let nb2 = 0;
    for (let i = 1; i + 1 < this.segmentsSol.length; i++){
      const s = this.segmentsSol[i];
      if (s.x1 - s.x0 < 420) continue;
      if (Math.abs(Math.sin(i * 9.17)) < 0.45) continue;
      this.creerBloc((s.x0 + s.x1) / 2 + 60, ['pistolet','fusil','laser'][nb2++ % 3]);
    }

    // les accessoires de décor posés sur les segments : la forêt a ses
    // feuillus et buissons, la ville son mobilier
    const props = this.def.decor === 'foret' ? ['feuillu','buisson','souche','herbes','buisson']
                : (this.def.decor === 'villeJour' || this.def.decor === 'exterieur')
                  ? ['lampadaire','poubelle','feuTricolore','borne'] : null;
    if (props){
      for (const s of this.segmentsSol){
        for (let px = s.x0 + 150; px < s.x1 - 90; px += 400 + Math.abs(Math.sin(px)) * 260){
          const nomP = props[Math.floor(Math.abs(Math.sin(px * 0.37)) * props.length) % props.length];
          const e = nomP === 'feuillu' ? 0.85 : 0.6;
          this.add.image(px, SOL_Y + 2, 'decorAtlas', nomP)
            .setOrigin(0.5, 1).setScale(e).setDepth(1.5);
        }
      }
    }
    // la sortie en image quand la planche l'a (échelle, ascenseur)
    if (this.def.sortie === 'echelle'){
      this.imgSortie = this.add.image(this.sortieX, SOL_Y + 2, 'decorAtlas', 'echelle')
        .setOrigin(0.5, 1).setScale(210 / CADRES_DECOR.echelle.h).setDepth(-3);
    } else if (this.def.sortie === 'ascenseur'){
      this.imgSortie = this.add.image(this.sortieX, SOL_Y + 2, 'decorAtlas', 'ascenseur')
        .setOrigin(0.5, 1).setScale(150 / CADRES_DECOR.ascenseur.h).setDepth(-3);
    } else this.imgSortie = null;
  }

  // ── combat ──────────────────────────────────────────────────
  lancerAttaque(type, elastique){
    if (this.attaque) return;
    const c = COUPS[type];
    this.attaque = { type, t:0, bas:this.accroupi, elastique: !!elastique && !!c.portee, touches:new Set() };
    if (this.attaque.elastique) this.crier(this.joueur.x, this.joueur.y - 32, CRIS.kiai, '#ffd166', 15);
    SON.jouer(c.son);
    // pas de secousse ici : l'écran ne tremble qu'à l'IMPACT (frapper,
    // casser) — un coup dans le vide ne secoue plus rien
    if (c.tir) this.tirer(c);
    if (c.jet) this.ejecterSegment(c);
    if (c.elan && this.joueur.body.blocked.down && !this.accroupi)
      this.joueur.body.setVelocityX(this.sens * c.elan);
  }
  utiliserArme(){
    if (!this.arme){ SON.jouer('vide'); return; }
    if (this.attaque) return;
    if (this.munitions <= 0){
      // bracelet vide : l'appui éjecte le segment usé — le jet est une
      // arme — et un segment neuf s'enclenche s'il en reste
      this.lancerAttaque('jet');
      return;
    }
    this.munitions--;
    this.lancerAttaque(this.arme);
    majBoutonArme(this.arme, this.munitions, this.segments);
  }
  ejecterSegment(c){
    const a = ARMES[this.arme];
    const y = this.joueur.y + PIEDS + c.dy + (this.attaque.bas ? DECALAGE_ACCROUPI : 0);
    // le segment usé part en cloche et tournoie : gravité propre, il se
    // brise au sol
    this.tirs.push({ x:this.joueur.x + this.sens*14, y,
      vx:this.sens*430, vy:-190, g:1400,
      degats:c.degats, recul:c.recul, bas:this.attaque.bas,
      couleur:a.couleur, clair:a.clair, jet:true, vie:1.6 });
    if (this.segments > 0){
      this.segments--;
      this.munitions = a.munitions;
      SON.jouer('recharge');
      this.message('SEGMENT NEUF  —  ' + a.nom + ' ×' + this.munitions);
    } else {
      // c'était la dernière pièce du bracelet, elle vient d'être jetée
      this.arme = null; this.munitions = 0;
      this.message('BRACELET ÉPUISÉ');
    }
    majBoutonArme(this.arme, this.munitions, this.segments);
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
    let portee = c.portee * (this.attaque.elastique ? CFG.porteeElastique : 1);
    // accroupi, la frappe balaie plus large et plus haut au ras du sol :
    // toucher les rampants ne doit pas demander une précision d'orfèvre
    const haut = this.attaque.bas ? c.hauteur * 1.5 : c.hauteur;
    if (this.attaque.bas) portee += 8;
    const dirs = c.bilateral ? [1, -1] : [this.sens];
    const y = this.joueur.y + PIEDS + c.dy + (this.attaque.bas ? DECALAGE_ACCROUPI : 0);
    return dirs.map(d => {
      const cx = this.joueur.x + d * (14 + portee/2);
      return new Phaser.Geom.Rectangle(cx - portee/2, y - haut/2, portee, haut);
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
      // coup bloqué : l'éclat et le son suffisent — pas d'onomatopée
      // pour un coup qui ne touche pas
      m.blinde = 0.18;
      SON.jouer('blinde');
      this.eclat(m.go.x, m.go.y, 0, 3, COUL.blinde);
      // et tant qu'on insiste debout, l'astuce revient (toutes les 4 s)
      if (m.def.faible === 'bas'
          && (this.astuceBasT === undefined || this.time.now > this.astuceBasT + 4000)){
        this.astuceBasT = this.time.now;
        this.message('ACCROUPIS-TOI (↓) POUR TOUCHER LE VIOLET');
      } else if (m.def.faible === 'haut'
          && (this.astuceHautT === undefined || this.time.now > this.astuceHautT + 4000)){
        this.astuceHautT = this.time.now;
        this.message('LE DRONE VOLE TROP HAUT, RELÈVE-TOI');
      }
      return;
    }
    const dir = Math.sign(m.go.x - sourceX) || this.sens;
    const hautCri = m.go.y - m.def.taille[1]/2 - 16;
    m.pv -= degats; m.flash = 0.14;
    if (!m.def.fixe){
      m.assomme = 0.22; m.prepare = 0;
      m.go.body.setVelocity(dir * recul * (m.def.boss ? 0.35 : 1), m.def.vole ? 0 : -160);
    }
    SON.jouer('touche');
    this.cameras.main.shake(90, ecrase ? 0.006 : 0.0045);
    this.eclat(m.go.x, m.go.y, dir);
    if (m.pv > 0) this.crier(m.go.x, hautCri, ecrase ? CRIS.ecrase : CRIS.coup);
    if (m.pv <= 0){
      m.mort = true; this.vaincus++;
      SON.jouer('vaincu');
      this.eclat(m.go.x, m.go.y, dir, m.def.boss ? 34 : 14);
      this.crier(m.go.x, hautCri, m.def.boss ? CRIS.boss : CRIS.vaincu, '#ffd166', m.def.boss ? 26 : 20);
      if (this.alea() < CFG.chanceCoeur || m.def.boss) this.creerObjet(m.go.x - 12, m.go.y - 8, 'coeur');
      // le boss offre aussi une vie : elle part de l'autre côté pour que
      // les deux cadeaux ne se confondent pas
      if (m.def.boss) this.creerObjet(m.go.x + 14, m.go.y - 12, 'vie');
      if (m.spr){
        // la dépouille reste un instant : le K.O. se joue, puis s'efface
        this.cadavres.push({ x:m.go.x, y:m.go.y + m.def.taille[1]/2 + 2,
                             e:m.sprE, sens:dir, pref:m.sprPref, t:0 });
        m.spr.destroy(); m.spr = null;
      }
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
    this.cameras.main.shake(70, 0.003);
    this.eclat(k.go.x, k.go.y - 4, this.sens, 5);
    if (k.pv <= 0){
      k.casse = true;
      this.eclat(k.go.x, k.go.y - 4, this.sens, 16);
      this.crier(k.go.x, k.go.y - 24, CRIS.caisse, '#e8b06a', 15);
      this.creerObjet(k.go.x, k.go.y - 8, this.butin());
      k.img.setTexture('decorAtlas', 'caisseCassee');
      k.efface = 1.1;   // les débris restent un instant puis s'effacent
      k.go.destroy();
    }
  }
  butin(){
    // les pouvoirs ne tombent plus des caisses : ils vivent dans les
    // blocs bonus. Les caisses soignent, et parfois offrent une vie.
    const r = this.alea();
    if (r < 0.10) return 'vie';
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
    this.crier(this.joueur.x, this.joueur.y - 28, CRIS.aie, '#ff9d94');
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
    if (o.type === 'vie'){
      if (PARTIE.vies >= CFG.viesMax) return;   // au plafond, elle reste au sol
      PARTIE.vies++;
      SON.jouer('unevie');
      this.message('+1 VIE');
    } else if (o.type === 'coeur'){
      if (this.pv >= CFG.pvJoueur) return;   // on laisse le cœur au sol pour plus tard
      this.pv++;
      SON.jouer('coeur');
      this.message('+1 ♥');
    } else {
      const a = ARMES[o.type];
      if (this.arme === o.type){
        this.segments = Math.min(CFG.segmentsMax, this.segments + CFG.segmentsParBracelet);
        this.message(a.nom + '  —  +' + CFG.segmentsParBracelet + ' SEGMENTS');
      } else {
        this.arme = o.type;
        this.munitions = a.munitions;
        this.segments = CFG.segmentsParBracelet - 1;
        this.message(a.nom + '  —  □ POUR TIRER  ×' + this.munitions);
      }
      majBoutonArme(this.arme, this.munitions, this.segments);
      SON.jouer('arme');
    }
    o.pris = true;
    o.go.destroy();
  }
  message(txt){ this.msg = { t:0 }; this.hudMsg.setText(txt).setAlpha(1); }

  // ── étages, mort, victoire ──────────────────────────────────
  sauvegarder(){
    PARTIE.pv = this.pv; PARTIE.arme = this.arme; PARTIE.munitions = this.munitions;
    PARTIE.segments = this.segments;
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
    this.mortDebut = this.time.now;   // le sprite joue la chute une fois
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
    this.charge = null;
    this.endurance = CFG.enduranceMax;
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
      ENTREE.validePresse = false; ENTREE.relache = null; ENTREE.hautPresse = false;
      this.majEclats(dt); this.dessinerTout(b);
      return;
    }

    if (this.etat !== 'jeu'){
      if (ENTREE.validePresse){
        ENTREE.validePresse = false; ENTREE.sautPresse = false; ENTREE.relache = null;
        ENTREE.hautPresse = false;
        if (this.etat === 'perdu') this.reapparaitre();
        // le retour au titre détruit la partie : hors de la boucle de jeu,
        // sinon Phaser se fait couper l'herbe sous le pied en plein update
        else if (this.etat === 'gameover') setTimeout(retourAuTitre, 0);
        else this.recommencer();
        return;
      }
      ENTREE.relache = null; ENTREE.hautPresse = false; ENTREE.sautPresse = false;
      this.majEclats(dt); this.dessinerTout(b);
      return;
    }
    ENTREE.validePresse = false;

    const auSol = b.blocked.down || b.touching.down;
    this.accroupi = ENTREE.accroupi && auSol;

    // ── coups : un appui bref donne le coup normal ; TENIR le bouton
    // charge le coup, qui part élastique au relâché s'il reste de
    // l'endurance. Un appui-relâché pendant un coup en cours reste en
    // réserve, le suivant part dès que le bras est libre.
    if (ENTREE.hautPresse && performance.now() - ENTREE.hautT > 700) ENTREE.hautPresse = false;
    if (ENTREE.relache && performance.now() - ENTREE.relache.quand > 700) ENTREE.relache = null;
    if (this.chargeAIgnorer && ENTREE.relache && ENTREE.relache.action === this.chargeAIgnorer){
      // le relâché d'un coup déjà parti tout seul (ou d'un tir d'arme)
      ENTREE.relache = null; this.chargeAIgnorer = null;
    } else if (this.chargeAIgnorer && ENTREE.chargeAction !== this.chargeAIgnorer){
      // le bouton à ignorer n'est plus tenu et son relâché est passé
      this.chargeAIgnorer = null;
    }
    if (!this.attaque){
      if (ENTREE.hautPresse){
        ENTREE.hautPresse = false; this.charge = null;
        this.lancerAttaque('crochet');
      } else if (ENTREE.chargeAction === 'poing' && this.arme && this.chargeAIgnorer !== 'poing'){
        // une arme au poing tire dès l'appui — pas de charge, et tant que
        // le bouton reste tenu son relâché est à ignorer
        this.chargeAIgnorer = 'poing';
        this.utiliserArme();
      } else if (this.charge){
        // la charge se mesure en temps RÉEL d'appui : le temps de la
        // simulation se dilate quand la cadence d'images chute, et le
        // seuil deviendrait faux exactement quand le jeu rame
        this.charge.t = (performance.now() - this.charge.depuis) / 1000;
        const tenu = ENTREE.chargeAction === this.charge.action;
        if (!tenu || this.charge.t >= CFG.chargeMax){
          // relâché — ou tenu jusqu'au maximum : le coup part tout seul
          const action = this.charge.action;
          const veutElast = this.charge.t >= CFG.seuilElastique;
          const elast = veutElast && this.endurance >= 1;
          if (elast) this.endurance -= 1;
          else if (veutElast && !this.astuceEndurance){
            this.astuceEndurance = true;
            this.message("PLUS D'ENDURANCE — LA JAUGE REVIENT TOUTE SEULE");
          }
          if (tenu) this.chargeAIgnorer = action;   // son relâché est déjà consommé
          ENTREE.relache = null;
          this.charge = null;
          this.lancerAttaque(action, elast);
        } else if (!this.charge.pret && this.charge.t >= CFG.seuilElastique && this.endurance >= 1){
          this.charge.pret = true;
          SON.jouer('tendu');
        }
      } else if (ENTREE.chargeAction && ENTREE.chargeAction !== this.chargeAIgnorer){
        // bouton tenu, éventuellement depuis le coup précédent : la
        // charge reprend la durée réelle de l'appui
        this.charge = { action: ENTREE.chargeAction, depuis: ENTREE.chargeDebut,
          t: (performance.now() - ENTREE.chargeDebut)/1000, pret:false };
      } else if (ENTREE.relache){
        const r = ENTREE.relache; ENTREE.relache = null;
        const elast = r.duree >= CFG.seuilElastique && this.endurance >= 1;
        if (elast) this.endurance -= 1;
        if (r.action === 'poing' && this.arme) this.utiliserArme();
        else this.lancerAttaque(r.action, elast);
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
              this.frapper(m, c.degats + (this.attaque.elastique ? 1 : 0),
                c.recul, this.attaque.bas, this.joueur.x, false);
            }
          }
          for (const k of this.caisses){
            if (k.casse || this.attaque.touches.has(k)) continue;
            if (zones.some(z => Phaser.Geom.Intersects.RectangleToRectangle(z, k.go.getBounds()))){
              this.attaque.touches.add(k);
              this.casser(k, c.degats);
            }
          }
          // BLOQUER un tir de tourelle au corps : un coup qui croise le
          // pruneau le renvoie à l'expéditeur, comme la boule de feu
          for (const e of this.tirsEnnemis){
            if (e.fini || this.attaque.touches.has(e)) continue;
            const be = new Phaser.Geom.Rectangle(e.x - 10, e.y - 10, 20, 20);
            if (zones.some(z => Phaser.Geom.Intersects.RectangleToRectangle(z, be))){
              this.attaque.touches.add(e);
              e.fini = true;
              this.tirs.push({ x:e.x, y:e.y, vx:-e.vx*1.35, vy:-e.vy*0.5,
                               degats:2, recul:170, bas:false, vie:1.6 });
              SON.jouer('touche');
              this.eclat(e.x, e.y, Math.sign(-e.vx) || 1, 10, 0xffd166);
              this.crier(e.x, e.y - 16, ['CONTRÉ !'], '#ffd166', 14);
              this.cameras.main.shake(70, 0.004);
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
      if (this.endurance >= 1){
        this.endurance -= 1;
        b.setVelocityY(-CFG.sautAerien);
        this.sautsAir--; this.buffer = 0; this.squash = -1;
        SON.jouer('saut2');
        this.eclat(this.joueur.x, this.joueur.y + PIEDS, 0, 6, 0x9fb4ff);
      } else {
        this.buffer = 0;
        if (!this.astuceEndurance){
          this.astuceEndurance = true;
          this.message("PLUS D'ENDURANCE — LA JAUGE REVIENT TOUTE SEULE");
        }
      }
    }
    if (!ENTREE.saut && b.velocity.y < -CFG.coupureSaut) b.setVelocityY(-CFG.coupureSaut);

    if (auSol && !this.auSolAvant && this.vyAvant > 300) this.squash = 1;
    this.auSolAvant = auSol; this.vyAvant = b.velocity.y;
    this.squash += (0 - this.squash) * Math.min(1, dt * 12);
    if (auSol) this.phase += (Math.abs(b.velocity.x) * dt) / 27;
    this.invuln = Math.max(0, this.invuln - dt);
    this.endurance = Math.min(CFG.enduranceMax, this.endurance + CFG.enduranceRegen * dt);

    // poussière à chaque appui de pied quand on court vite
    const sPhase = Math.sin(this.phase);
    if (auSol && Math.abs(b.velocity.x) > CFG.vitesseCourse * 0.55 && this.sAvant * sPhase <= 0 && !this.accroupi)
      this.poussiere(b.velocity.x);
    this.sAvant = sPhase;

    if (auSol && Math.abs(b.velocity.y) < 40){
      this.checkpoint.x = this.joueur.x;
      this.checkpoint.y = this.joueur.y;
    }

    this.majBlocs(dt);
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
          if (Math.abs(dx) < 340 && memeNiveau) v = Math.sign(dx) * m.def.vitesse * this.D.vitesse;
          else {
            if (m.go.x < m.minX) m.dir = 1;
            if (m.go.x > m.maxX) m.dir = -1;
            v = m.dir * m.def.patrouille * this.D.vitesse;
          }
          if ((m.go.x <= m.minX && v < 0) || (m.go.x >= m.maxX && v > 0)) v = 0;
          m.go.body.setVelocityX(v);
          if (m.def.vole){
            const vise = m.baseY + Math.sin(m.phase * 0.7) * 7;
            m.go.body.setVelocityY((vise - m.go.y) * 4);
          }
        }
      }

      // personne ne marche dans le vide : un marcheur au bord d'un trou
      // s'arrête net et repart dans l'autre sens — poursuite, patrouille
      // et glissade de recul comprises
      if (!m.def.vole && !m.def.fixe && m.go.body.blocked.down){
        const vx = m.go.body.velocity.x;
        if (vx !== 0 && !this.solSous(m.go.x + Math.sign(vx) * (m.def.taille[0]/2 + 8))){
          m.go.body.setVelocityX(0);
          m.dir = -m.dir;
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
      if (m.go.y > H + 200) this.repecher(m);
    }
  }
  majTourelle(m, dt, dx, memeNiveau){
    const c = m.def.canon;
    m.repos = Math.max(0, m.repos - dt);
    m.tira = Math.max(0, (m.tira || 0) - dt);   // le flash du canon
    if (m.vise > 0){
      m.vise -= dt;
      if (m.vise <= 0){
        m.tira = 0.22;
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
      if (t.g){
        t.vy += t.g * dt;
        // le segment jeté se brise en touchant le sol
        if (t.y > SOL_Y - 3){ this.eclat(t.x, SOL_Y - 4, Math.sign(t.vx), 6, t.couleur); t.fini = true; continue; }
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.vie <= 0){ t.fini = true; continue; }
      // le CONTRE : une boule de feu qui croise un tir ennemi le renvoie
      // à l'expéditeur — il devient une boule du joueur, plus rapide, et
      // c'est la tourelle qui encaisse son propre pruneau
      if (!t.jet) for (const e of this.tirsEnnemis){
        if (e.fini) continue;
        if (Math.abs(t.x - e.x) < 24 && Math.abs(t.y - e.y) < 24){
          e.fini = true;
          this.tirs.push({ x:e.x, y:e.y, vx:-e.vx*1.35, vy:-e.vy*0.5,
                           degats:2, recul:170, bas:false, vie:1.6 });
          SON.jouer('touche');
          this.eclat(e.x, e.y, Math.sign(-e.vx) || 1, 10, 0xffd166);
          this.crier(e.x, e.y - 16, ['CONTRÉ !'], '#ffd166', 14);
          this.cameras.main.shake(70, 0.004);
          break;
        }
      }
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

  // une onomatopee de manga : surgit, penche, monte un peu et s'efface
  crier(x, y, mots, couleur, taille){
    const b = this.bulles[this.bulleSuiv = (this.bulleSuiv + 1) % this.bulles.length];
    b.t.setText(mots[Math.floor(this.alea() * mots.length)])
      .setColor(couleur || '#ffffff')
      .setFontSize(taille || 18)
      .setPosition(x, y)
      .setAngle((this.alea() * 2 - 1) * 14)
      .setVisible(true);
    b.vie = b.max = 0.55;
    b.vy = -46;
  }
  majEclats(dt){
    for (const cd of this.cadavres) cd.t += dt;
    this.cadavres = this.cadavres.filter(cd => cd.t < 1.5);
    for (const e of this.eclats){ e.vie -= dt; e.vy += 900*dt; e.x += e.vx*dt; e.y += e.vy*dt; }
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
