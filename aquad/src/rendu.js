// ─────────────────────────────────────────────────────────────
// RENDU — vue de dessus
// Greffé sur la scène par le build. Chaque entité dessine dans SON
// calque, et son depth = son y : passer derrière un palmier le masque,
// passer devant le recouvre. Le sol se redessine sur la zone visible.
// ─────────────────────────────────────────────────────────────
Object.assign(Aquad.prototype, {

  dessinerTout(){
    this.dessinerSol();
    this.dessinerSortie();
    this.dessinerVisee();
    for (const d of this.decors) this.animerDecor(d);
    this.dessinerCaisses();
    this.dessinerPierres();
    this.dessinerMonstres();
    this.dessinerPerso(this.joueurs[0]);
    this.dessinerObjets();
    this.dessinerEclats();
    this.dessinerTirs();
    this.dessinerHud();
  },

  // ── le sol : l'eau, la plage, l'herbe ───────────────────────
  // le contour de l'île à une marge donnée, ondulé par deux sinus figés
  // (fonction de la position monde, jamais du temps : la côte ne grouille
  // pas) — un polygone organique à la place d'un rectangle de carte
  contourIle(marge){
    const iX = this.ileX - marge, iY = this.ileY - marge;
    const iL = this.ileL + marge*2, iH = this.ileH + marge*2;
    const ond = k => Math.sin(k * 0.017) * 7 + Math.sin(k * 0.031) * 4;
    const pas = 56, pts = [];
    for (let x = iX; x < iX + iL; x += pas) pts.push({ x, y: iY + ond(x) });
    for (let y = iY; y < iY + iH; y += pas) pts.push({ x: iX + iL + ond(y), y });
    for (let x = iX + iL; x > iX; x -= pas) pts.push({ x, y: iY + iH + ond(x + 999) });
    for (let y = iY + iH; y > iY; y -= pas) pts.push({ x: iX + ond(y + 999), y });
    return pts;
  },
  dessinerSol(){
    const g = this.gSol; g.clear();
    const cam = this.cameras.main;
    const vx = cam.scrollX - 40, vy = cam.scrollY - 40;
    const vl = L + 80, vh = H + 80;
    const t = this.def.teinte;
    const visible = (x, y) => x > vx && x < vx + vl && y > vy && y < vy + vh;

    // l'eau partout, en deux profondeurs
    g.fillStyle(COUL.eauProfonde, 1); g.fillRect(vx, vy, vl, vh);
    const iX = this.ileX, iY = this.ileY, iL = this.ileL, iH = this.ileH;
    g.fillStyle(COUL.eau, 1); g.fillRect(iX - 90, iY - 90, iL + 180, iH + 180);

    // vaguelettes d'écume qui respirent le long de la côte (des TRAITS :
    // pas de triangulation, donc pas de polygone géant qui rate)
    const resp = Math.sin(this.time.now / 600) * 4;
    g.lineStyle(4, COUL.eauClaire, 0.7);
    g.strokePoints(this.contourIle(38 + resp), true);
    g.lineStyle(3, COUL.ecume, 0.5);
    g.strokePoints(this.contourIle(26 + resp * 0.5), true);

    // la côte en FESTONS : des rangées d'ellipses qui mordent le long des
    // bords — organique, cullable, et fiable là où le remplissage WebGL
    // d'un polygone de 120 sommets ne l'est pas
    const feston = (marge, couleur, lx, ly) => {
      g.fillStyle(couleur, 1);
      const x0 = iX - marge, y0 = iY - marge;
      const x1 = iX + iL + marge, y1 = iY + iH + marge;
      const ond = k => Math.sin(k * 0.017) * 6 + Math.sin(k * 0.031) * 3;
      for (let x = x0; x <= x1; x += 48){
        if (visible(x, y0)) g.fillEllipse(x, y0 + ond(x), lx, ly);
        if (visible(x, y1)) g.fillEllipse(x, y1 + ond(x + 999), lx, ly);
      }
      for (let y = y0; y <= y1; y += 48){
        if (visible(x0, y)) g.fillEllipse(x0 + ond(y), y, ly, lx);
        if (visible(x1, y)) g.fillEllipse(x1 + ond(y + 777), y, ly, lx);
      }
    };
    // sable mouillé qui lèche l'eau, sable par-dessus, cœur de plage en aplat
    feston(18, COUL.sableMouille, 58, 30);
    feston(10, t.sable || COUL.sable, 60, 34);
    g.fillStyle(t.sable || COUL.sable, 1);
    g.fillRect(iX - 10, iY - 10, iL + 20, iH + 20);
    // l'herbe mord sur le sable, son cœur en aplat
    feston(-46, t.herbe, 56, 30);
    g.fillStyle(t.herbe, 1);
    g.fillRect(iX + 46, iY + 46, iL - 92, iH - 92);

    // le sol vivant, à plusieurs échelles, figé par des hachages.
    // D'abord les taches d'herbe claire, larges, SOUS le reste
    g.fillStyle(t.herbeClaire || COUL.herbeClaire, 1);
    for (let i = 0; i < 50; i++){
      const hx = iX + 70 + (Math.abs(Math.sin(i * 47.13)) * (iL - 140));
      const hy = iY + 70 + (Math.abs(Math.sin(i * 23.71)) * (iH - 140));
      if (visible(hx, hy)) g.fillEllipse(hx, hy, 40, 18);
    }
    // les touffes sombres
    g.fillStyle(t.herbeSombre, 1);
    for (let i = 0; i < 60; i++){
      const hx = iX + 60 + (Math.abs(Math.sin(i * 12.99)) * (iL - 120));
      const hy = iY + 60 + (Math.abs(Math.sin(i * 78.23)) * (iH - 120));
      if (visible(hx, hy)) g.fillEllipse(hx, hy, 26, 12);
    }
    // quelques fleurs
    for (let i = 0; i < 24; i++){
      const hx = iX + 80 + (Math.abs(Math.sin(i * 91.7)) * (iL - 160));
      const hy = iY + 80 + (Math.abs(Math.sin(i * 37.3)) * (iH - 160));
      if (!visible(hx, hy)) continue;
      g.fillStyle(i % 3 ? COUL.fleur : COUL.fleur2, 1);
      g.fillCircle(hx, hy, 2.2); g.fillCircle(hx + 4, hy + 2, 1.6);
    }
    // coquillages et galets sur l'anneau de plage
    for (let i = 0; i < 22; i++){
      const hx = iX + 8 + (Math.abs(Math.sin(i * 63.29)) * (iL - 16));
      const hy = iY + 8 + (Math.abs(Math.sin(i * 17.89)) * (iH - 16));
      const bord = Math.min(hx - iX, iX + iL - hx, hy - iY, iY + iH - hy);
      if (bord > 40 || !visible(hx, hy)) continue;
      if (i % 2){
        g.fillStyle(COUL.coquillage, 1);
        g.fillEllipse(hx, hy, 5, 4);
        g.fillStyle(COUL.sableOmbre, 1); g.fillCircle(hx, hy + 1, 1);
      } else {
        g.fillStyle(COUL.galet, 1); g.fillEllipse(hx, hy, 6, 4);
      }
    }
  },

  // ── le ponton de sortie, à l'est ────────────────────────────
  dessinerSortie(){
    const g = this.gSortie; g.clear();
    const x0 = this.ileX + this.ileL - 6, y = this.pontonY;
    const bloquee = this.bossVivant;
    const pulse = bloquee ? 0 : 0.55 + 0.45 * Math.sin(this.time.now / 260);
    // planches au-dessus de l'eau
    for (let i = 0; i < 6; i++){
      g.fillStyle(i % 2 ? COUL.ponton : COUL.pontonOmbre, 1);
      g.fillRect(x0 + i * 34, y - 42, 32, 84);
    }
    g.fillStyle(0x000000, 0.15); g.fillRect(x0, y + 40, 6 * 34, 8);
    // la barque au bout
    g.fillStyle(0x8a5a2b, 1); g.fillEllipse(x0 + 232, y, 64, 34);
    g.fillStyle(0xb07a3e, 1); g.fillEllipse(x0 + 232, y, 48, 22);
    g.fillStyle(bloquee ? 0xe2584d : 0x4dd6c1, 0.4 + 0.4*pulse);
    g.fillTriangle(x0 + 100, y - 52, x0 + 86, y - 38, x0 + 114, y - 38);
    if (bloquee){
      g.lineStyle(5, 0xe2584d, 0.8);
      g.beginPath(); g.moveTo(x0 + 8, y - 40); g.lineTo(x0 + 196, y + 40); g.strokePath();
      g.beginPath(); g.moveTo(x0 + 196, y - 40); g.lineTo(x0 + 8, y + 40); g.strokePath();
    }
  },

  // ── la visée : ce que dirait un coup donné maintenant ───────
  dessinerVisee(){
    const g = this.gVisee; g.clear();
    if (this.etat !== 'jeu') return;
    const j = this.joueurs[0];
    // l'arc au sol devant le héros : là où porterait le coup. Masqué
    // pendant une frappe — le cercle blanc de l'impact prend le relais.
    if (!j.attaque && !j.porte){
      const ang = Math.atan2(j.fy, j.fx);
      g.lineStyle(3, 0xffffff, 0.22);
      g.beginPath();
      g.arc(j.go.x, j.go.y + 2, 42, ang - 0.6, ang + 0.6);
      g.strokePath();
    }
    // l'anneau pulsant sous l'ennemi qui serait touché
    const c = this.cibleVisee;
    if (c && !c.mort){
      const bs = this.boiteSol(c.go, 1);
      const pulse = 0.32 + 0.16 * Math.sin(this.time.now / 160);
      g.lineStyle(3.5, 0xffd166, pulse + 0.2);
      g.strokeEllipse(c.go.x, c.go.y + bs.height/2, bs.width + 14, (bs.width + 14) * 0.42);
      g.fillStyle(0xffd166, pulse * 0.4);
      g.fillEllipse(c.go.x, c.go.y + bs.height/2, bs.width + 14, (bs.width + 14) * 0.42);
    }
  },

  // ── décors : dessinés une fois, animés doucement ────────────
  dessinerDecor(d){
    const g = d.g; g.clear();
    if (d.type === 'rocher'){
      g.fillStyle(0x000000, 0.18); g.fillEllipse(d.x + SOLEIL.x*1.5, d.y + 12 + SOLEIL.y*0.5, 48, 14);
      g.fillStyle(COUL.rocherOmbre, 1); g.fillEllipse(d.x, d.y, 46, 34);
      g.fillStyle(COUL.rocher, 1); g.fillEllipse(d.x - 4, d.y - 6, 36, 24);
      g.fillStyle(0xb8bcc8, 0.7); g.fillEllipse(d.x - 10, d.y - 10, 14, 8);
      return;
    }
    // palmier : le pied au corps physique, la tête bien plus haut —
    // c'est le tri par y qui fait passer derrière ou devant
    const bal = Math.sin(d.phase) * 3;
    g.fillStyle(0x000000, 0.18); g.fillEllipse(d.x + SOLEIL.x*3, d.y + 8 + SOLEIL.y, 52, 12);
    g.lineStyle(9, COUL.tronc, 1);
    g.beginPath(); g.moveTo(d.x, d.y + 4);
    g.lineTo(d.x + 6 + bal * 0.4, d.y - 46); g.strokePath();
    const tx = d.x + 7 + bal * 0.5, ty = d.y - 52;
    g.fillStyle(COUL.palme, 1);
    for (let a = 0; a < 6; a++){
      const ang = a * Math.PI / 3 + bal * 0.02;
      g.fillEllipse(tx + Math.cos(ang) * 20, ty + Math.sin(ang) * 11, 34, 12);
    }
    g.fillStyle(COUL.palmeClaire, 1); g.fillEllipse(tx, ty, 18, 12);
    g.fillStyle(0x6d4420, 1);
    g.fillCircle(tx - 6, ty + 7, 4); g.fillCircle(tx + 5, ty + 8, 4);
  },
  animerDecor(d){
    if (d.type !== 'palmier') return;
    d.phase += 0.016;
    // redessiner chaque frame coûterait cher pour rien : une palme sur
    // trois frames suffit à donner le vent
    if ((this.time.now / 120 | 0) % 3 === 0) this.dessinerDecor(d);
  },

  dessinerPierres(){
    for (const p of this.pierres){
      const g = p.g; g.clear();
      g.setDepth(p.go.y);
      const x = p.go.x, y = p.go.y;
      g.fillStyle(0x000000, 0.18); g.fillEllipse(x + SOLEIL.x, y + 7 + SOLEIL.y*0.5, 20, 6);
      g.fillStyle(COUL.rocherOmbre, 1); g.fillEllipse(x, y, 18, 13);
      g.fillStyle(COUL.rocher, 1); g.fillEllipse(x - 2, y - 2, 14, 9);
      g.fillStyle(0xb8bcc8, 0.7); g.fillEllipse(x - 4, y - 4, 6, 3);
    }
  },

  dessinerCaisses(){
    for (const k of this.caisses){
      const g = k.g; g.clear();
      g.setDepth(k.go.y);
      const x = k.go.x, y = k.go.y, clair = k.flash > 0;
      g.fillStyle(0x000000, 0.2); g.fillEllipse(x + SOLEIL.x, y + 12 + SOLEIL.y*0.5, 34, 10);
      g.fillStyle(clair ? 0xffffff : COUL.bois, 1);      g.fillRect(x-15, y-16, 30, 28);
      g.fillStyle(clair ? 0xffffff : COUL.boisClair, 1); g.fillRect(x-11, y-12, 22, 20);
      g.lineStyle(3, clair ? 0xffffff : COUL.boisOmbre, 1);
      g.beginPath(); g.moveTo(x-11, y-12); g.lineTo(x+11, y+8); g.strokePath();
      g.beginPath(); g.moveTo(x+11, y-12); g.lineTo(x-11, y+8); g.strokePath();
    }
  },

  // ── la faune ────────────────────────────────────────────────
  dessinerMonstres(){
    const j = this.joueurs[0];
    for (const m of this.monstres){
      const g = m.g; g.clear();
      g.setDepth(m.go.y);
      if (m.def.silhouette === 'drone') this.dessinerMeduse(g, m);
      else this.dessinerCrabe(g, m);
      if (m.pv < m.pvMax){
        const l = m.def.boss ? m.def.taille[0]*0.6 : 13;
        const x = m.go.x, y = m.go.y - m.def.taille[1]/2 - 16;
        g.fillStyle(0x2a3355, 1); g.fillRect(x-l, y, l*2, 4);
        g.fillStyle(m.def.boss ? 0xff5e5e : 0xe2584d, 1); g.fillRect(x-l, y, l*2 * (m.pv/m.pvMax), 4);
      }
    }
  },
  dessinerCrabe(g, m){
    const e = m.def.taille[0] / 30;
    const x = m.go.x, y = m.go.y;
    const dandine = Math.sin(m.phase) * 2;
    const alerte = m.prepare > 0 && Math.floor(m.prepare * 14) % 2 === 0;
    const eclaire = m.flash > 0 ? 0xffffff : (alerte ? 0xffe9b0 : null);
    const corps = eclaire || m.def.couleur;
    const ombre = eclaire || m.def.ombre;
    // l'ombre = la boîte au sol du monstre, penchée comme toutes les autres
    g.fillStyle(0x000000, 0.2); g.fillEllipse(x + SOLEIL.x, y + 10*e + SOLEIL.y*0.5, m.def.taille[0], 10*e);
    // pattes qui trottinent
    g.lineStyle(3*e, ombre, 1);
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++){
        const px = x + s * 14*e, py = y - 2 + i * 6*e + (Math.sin(m.phase*2 + i) * 2);
        g.beginPath(); g.moveTo(x + s*8*e, y + (i-1)*4*e); g.lineTo(px, py); g.strokePath();
      }
    g.fillStyle(ombre, 1); g.fillEllipse(x, y + 2*e + dandine*0.4, 28*e, 18*e);
    g.fillStyle(corps, 1); g.fillEllipse(x, y - 2*e + dandine*0.4, 26*e, 18*e);
    // pinces vers le joueur
    const vers = Math.sign(this.joueurs[0].go.x - x) || 1;
    g.fillStyle(corps, 1);
    g.fillEllipse(x + vers*16*e, y - 6*e + dandine, 12*e, 9*e);
    g.fillEllipse(x - vers*14*e, y - 4*e - dandine, 9*e, 7*e);
    g.fillStyle(m.def.oeil, 1);
    g.fillCircle(x - 4*e, y - 8*e, 2.6*e); g.fillCircle(x + 4*e, y - 8*e, 2.6*e);
    g.fillStyle(0x1a0f22, 1);
    g.fillCircle(x - 4*e + vers, y - 8*e, 1.2*e); g.fillCircle(x + 4*e + vers, y - 8*e, 1.2*e);
  },
  dessinerMeduse(g, m){
    const e = m.def.taille[0] / 26;
    const x = m.go.x, y = m.go.y + Math.sin(m.phase) * 3;
    const eclaire = m.flash > 0 ? 0xffffff : null;
    const corps = eclaire || m.def.couleur;
    g.fillStyle(0x000000, 0.15); g.fillEllipse(x + SOLEIL.x, m.go.y + 14*e + SOLEIL.y*0.5, 26*e, 8*e);
    // tentacules qui ondulent dessous
    g.lineStyle(2.5*e, eclaire || m.def.ombre, 0.9);
    for (let i = -2; i <= 2; i++){
      const ph = m.phase * 2 + i;
      g.beginPath(); g.moveTo(x + i*4*e, y + 4*e);
      g.lineTo(x + i*5*e + Math.sin(ph)*4, y + 16*e + Math.cos(ph)*2);
      g.strokePath();
    }
    g.fillStyle(eclaire || m.def.ombre, 1); g.fillEllipse(x, y, 24*e, 18*e);
    g.fillStyle(corps, 0.92); g.fillEllipse(x, y - 3*e, 22*e, 14*e);
    g.fillStyle(0xffffff, 0.35); g.fillEllipse(x - 5*e, y - 6*e, 8*e, 5*e);
    const vers = Math.sign(this.joueurs[0].go.x - x) || 1;
    g.fillStyle(m.def.oeil, 1);
    g.fillCircle(x + vers*2 - 4*e, y - 2*e, 2*e); g.fillCircle(x + vers*2 + 4*e, y - 2*e, 2*e);
  },

  // ── le héros, repris de Combat en vue 3/4 ───────────────────
  dessinerPerso(j){
    const g = j.g; g.clear();
    g.setDepth(j.go.y);
    const b = j.go.body;
    const vitesse = Math.hypot(b.velocity.x, b.velocity.y);
    const marche = vitesse > 20;
    const allure = Math.min(1, vitesse / CFG.vitesse);
    const t = j.phase;
    // la direction DESSINÉE : le dos quand il monte, la face quand il
    // descend, le profil sur les côtés — c'est elle qui donne le volume.
    // Pendant un coup, c'est la direction du coup qui commande.
    const dfx = j.attaque ? j.attaque.fx : j.fx;
    const dfy = j.attaque ? j.attaque.fy : j.fy;
    const vue = j.attaque ? 'profil'
      : (Math.abs(dfy) > Math.abs(dfx) ? (dfy < 0 ? 'dos' : 'face') : 'profil');
    const sens = (vue === 'profil' && dfx < -0.05) ? -1 : 1;
    let pieds, mains, inclinaison = 0;

    if (j.porte){
      // les deux mains au-dessus de la tête, l'objet posé dessus
      mains = [[-7, TETE - 7], [8, TETE - 7]];
      if (marche){
        const foulee = 5 + allure * 5;
        pieds = [];
        for (const dec of [Math.PI, 0]){
          const p = t + dec, s = Math.sin(p);
          pieds.push([-Math.cos(p)*foulee, Math.max(0, s) * -6]);
        }
      } else pieds = [[-6, 0], [6, 0]];
    } else if (j.attaque){
      const c = COUPS[j.attaque.type];
      const p = Phaser.Math.Clamp(j.attaque.t / c.duree, 0, 1);
      const ext = Math.sin(Math.PI * Math.min(1, p * 1.2));
      const ela = j.attaque.elastique ? CFG.porteeElastique : 1;
      if (j.attaque.type === 'poing'){
        mains = [[-6 - ext*3, EPAULE + 9], [(4 + ext*22) * ela, EPAULE + 2 - ext*3]];
        pieds = [[-9, 0], [7, 0]];
      } else if (j.attaque.type === 'pied'){
        mains = [[-10 - ext*5, EPAULE + 2], [2 - ext*4, EPAULE + 11]];
        pieds = [[-6, 0], [(6 + ext*26) * ela, -6 - ext*10]];
      } else {
        // arme : le bras tendu vers la cible
        mains = [[-8 + ext*2, EPAULE + 8], [11 + ext*12, EPAULE + 6]];
        pieds = [[-9, 0], [8, 0]];
      }
    } else if (j.charge){
      const k = Math.min(1, j.charge.t / CFG.seuilElastique);
      const trem = j.charge.pret ? Math.sin(this.time.now / 30) * 1.2 : 0;
      if (j.charge.action === 'pied'){
        mains = [[-9, EPAULE + 4], [6, EPAULE + 10]];
        pieds = [[-7, 0], [-1 - k*4 + trem, -6 - k*4]];
      } else {
        mains = [[-8, EPAULE + 8], [-2 - k*5 + trem, EPAULE + 4]];
        pieds = [[-9, 0], [7, 0]];
      }
      inclinaison = -0.05;
    } else if (marche){
      const foulee = 7 + allure * 7;
      const genou  = 5 + allure * 12;
      pieds = []; mains = [];
      for (const dec of [Math.PI, 0]){
        const p = t + dec;
        const s = Math.sin(p);
        pieds.push([-Math.cos(p)*foulee, Math.max(0, s) * -genou * 0.6]);
        mains.push([Math.cos(p)*(5 + allure*6), EPAULE + 12 - Math.max(0, s)*(2 + allure*5)]);
      }
      inclinaison = 0.04 + allure*0.06;
    } else {
      const souffle = Math.sin(this.time.now / 420) * 1.2;
      pieds = [[-6, 0], [6, 0]];
      mains = [[-7, EPAULE + 11 + souffle], [8, EPAULE + 9 + souffle]];
    }

    // l'ombre fait exactement la largeur de la boîte au sol : c'est elle
    // qu'on regarde pour juger un contact. Elle reste collée au sol pendant
    // que le corps rebondit sur ses pas — le volume le moins cher du monde.
    g.fillStyle(0x000000, 0.22); g.fillEllipse(SOLEIL.x, 3 + SOLEIL.y*0.5, 26, 8);
    const lev = (marche && !j.attaque) ? Math.abs(Math.sin(t)) * 2 : 0;
    g.save();
    g.translateCanvas(0, -lev);
    // pendant un coup, tout le corps se fend vers la direction du coup
    if (j.attaque) g.rotateCanvas(sens === 1 ? Math.atan2(dfy, dfx) : Math.atan2(dfy, -dfx));

    this.membre(g, -1, EPAULE, mains[0][0], mains[0][1], 8, 8, 1, COUL.giOmbre, COUL.peauOmbre, 7, 5);
    this.membre(g, -1, HANCHE, pieds[0][0], pieds[0][1], 9.5, 9.5, -1, COUL.giOmbre, COUL.giOmbre, 8.5, 7);
    g.fillStyle(0x171d33, 1); g.fillEllipse(pieds[0][0]+1, pieds[0][1]-1.5, 10, 6);

    // le torse est plus étroit vu de profil
    const larg = vue === 'profil' ? 5 : 7;
    g.fillStyle(COUL.gi, 1);
    g.fillPoints([{x:-larg,y:EPAULE},{x:larg,y:EPAULE},{x:larg-1,y:HANCHE+1},{x:-(larg-1),y:HANCHE+1}], true);
    g.lineStyle(2.4, COUL.col, 1);
    if (vue === 'face'){
      g.beginPath(); g.moveTo(-3, EPAULE-1); g.lineTo(2, EPAULE+8); g.strokePath();
      g.beginPath(); g.moveTo(5, EPAULE-1); g.lineTo(2, EPAULE+8); g.strokePath();
    } else if (vue === 'dos'){
      g.beginPath(); g.moveTo(-4, EPAULE); g.lineTo(4, EPAULE); g.strokePath();
    } else {
      g.beginPath(); g.moveTo(1, EPAULE-1); g.lineTo(3.5, EPAULE+7); g.strokePath();
    }
    g.fillStyle(COUL.ceinture, 1);
    g.fillRect(-larg, HANCHE-3, larg*2, 4);
    if (vue === 'dos') g.fillRect(-2, HANCHE-5, 4, 8);   // le nœud, dans le dos

    const bras2 = j.attaque && j.attaque.type === 'poing' && j.attaque.elastique ? CFG.porteeElastique : 1;
    const jambe2 = j.attaque && j.attaque.type === 'pied' && j.attaque.elastique ? CFG.porteeElastique : 1;
    this.membre(g, 1, HANCHE, pieds[1][0], pieds[1][1], 9.5*jambe2, 9.5*jambe2, -1, COUL.gi, COUL.gi, 9, 7.5);
    g.fillStyle(COUL.botte, 1); g.fillEllipse(pieds[1][0]+1, pieds[1][1]-1.5, 11, 6.4);
    this.membre(g, 1, EPAULE, mains[1][0], mains[1][1], 8*bras2, 8*bras2, 1, COUL.gi, COUL.peau, 7.5, 5.5);
    if (j.arme){
      const a = ARMES[j.arme];
      g.fillStyle(a.couleur, 1); g.fillCircle(mains[1][0], mains[1][1], 4.4);
      g.fillStyle(a.clair, 1);   g.fillCircle(mains[1][0], mains[1][1], 2.2);
    } else {
      g.fillStyle(COUL.ceinture, 1); g.fillCircle(mains[1][0], mains[1][1], 2.6);
    }

    if (j.charge){
      const k = Math.min(1, j.charge.t / CFG.seuilElastique);
      const cx = j.charge.action === 'pied' ? pieds[1][0] : mains[1][0];
      const cy = j.charge.action === 'pied' ? pieds[1][1] : mains[1][1];
      g.fillStyle(j.charge.pret ? 0xffd166 : 0x4dd6c1, 0.28 + 0.25*k);
      g.fillCircle(cx, cy, 4 + k*5);
      if (j.charge.pret){ g.fillStyle(0xffffff, 0.85); g.fillCircle(cx, cy, 2); }
    }

    // la tête, grosse comme il faut vu d'en haut, change avec la vue
    const hx = 1, hy = TETE;
    const pointes = [[-7,3],[-9,-3],[-13,-7],[-7,-6],[-10,-13],[-3,-8],[0,-15],[3,-7],[9,-11],[6,-3],[10,-4],[7,1]];
    const rec = vue === 'profil' ? -2 : 0;   // cheveux balayés vers l'arrière
    g.fillStyle(COUL.cheveux, 1);
    g.fillPoints(pointes.map(p => ({ x: hx + p[0]*1.15 + rec, y: hy + p[1]*1.15 })), true);
    g.fillStyle(COUL.peau, 1); g.fillCircle(hx+1, hy, 6.6);
    g.fillStyle(COUL.cheveux, 1);
    if (vue === 'dos'){
      // de dos : la chevelure couvre toute la tête, la nuque dépasse en bas
      g.fillCircle(hx+1, hy-1.4, 6.6);
      g.fillEllipse(hx+1, hy-5, 13.4, 6.4);
    } else if (vue === 'face'){
      g.fillEllipse(hx+0.5, hy-5.2, 13.4, 5.8);
      g.fillStyle(0x1a0f22, 1);
      g.fillRect(hx-4.2, hy-1.4, 2, 2.6);
      g.fillRect(hx+2.6, hy-1.4, 2, 2.6);
    } else {
      g.fillEllipse(hx-1, hy-5.2, 13.4, 5.8);
      g.fillStyle(0x1a0f22, 1);
      g.fillRect(hx+3.4, hy-1.4, 2, 2.6);   // un seul œil, tourné vers l'avant
    }

    // l'objet porté, posé sur les mains levées
    if (j.porte){
      const oy = TETE - 12 + Math.sin(this.time.now / 300) * 1.2;
      if (j.porte.type === 'caisse'){
        g.fillStyle(COUL.bois, 1);      g.fillRect(-12, oy - 20, 24, 20);
        g.fillStyle(COUL.boisClair, 1); g.fillRect(-9, oy - 17, 18, 14);
        g.lineStyle(2.5, COUL.boisOmbre, 1);
        g.beginPath(); g.moveTo(-9, oy - 17); g.lineTo(9, oy - 3); g.strokePath();
        g.beginPath(); g.moveTo(9, oy - 17); g.lineTo(-9, oy - 3); g.strokePath();
      } else {
        g.fillStyle(COUL.rocherOmbre, 1); g.fillEllipse(0, oy - 9, 20, 14);
        g.fillStyle(COUL.rocher, 1);      g.fillEllipse(-2, oy - 11, 15, 10);
        g.fillStyle(0xb8bcc8, 0.7);       g.fillEllipse(-5, oy - 13, 6, 4);
      }
    }

    g.restore();
    g.setPosition(j.go.x, j.go.y + 12);
    g.setRotation(sens * inclinaison);
    // léger écrasement vertical : la caméra est au-dessus, pas en face
    g.setScale(sens, 0.92);
    g.setAlpha(j.invuln > 0 && Math.floor(j.invuln*20) % 2 === 0 ? 0.35 : 1);
  },
  membre(g, hx, hy, tx, ty, l1, l2, sens, c1, c2, e1, e2){
    const dx = tx-hx, dy = ty-hy;
    const d = Math.min(Math.hypot(dx, dy), l1+l2-0.001) || 0.001;
    const a = Math.atan2(dy, dx);
    const c = (d*d + l1*l1 - l2*l2) / (2*d*l1);
    const ang = a + sens*Math.acos(Math.max(-1, Math.min(1, c)));
    const kx = hx + Math.cos(ang)*l1, ky = hy + Math.sin(ang)*l1;
    g.lineStyle(e1, c1, 1);
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.strokePath();
    g.lineStyle(e2, c2, 1);
    g.beginPath(); g.moveTo(kx, ky); g.lineTo(tx, ty); g.strokePath();
    g.fillStyle(c1, 1); g.fillCircle(hx, hy, e1/2); g.fillCircle(kx, ky, e1/2);
    g.fillStyle(c2, 1); g.fillCircle(tx, ty, e2/2);
  },

  dessinerObjets(){
    const g = this.gObjets; g.clear();
    for (const o of this.objets){
      const x = o.go.x, y = o.go.y + Math.sin(o.phase)*2.5;
      // même les objets qui flottent projettent leur ombre au sol
      g.fillStyle(0x000000, 0.15); g.fillEllipse(x + SOLEIL.x, o.go.y + 12, 16, 5);
      if (o.type === 'vie'){
        const bat = Math.sin(o.phase * 2) * 2;
        g.fillStyle(0xffd166, 0.22); g.fillCircle(x, y, 17);
        g.fillStyle(0xfff0c2, 0.9);
        g.fillTriangle(x-8, y-4, x-16, y-9+bat, x-8, y+2);
        g.fillTriangle(x+8, y-4, x+16, y-9+bat, x+8, y+2);
        g.fillStyle(0xffd166, 1);
        g.fillCircle(x-4, y-3, 5); g.fillCircle(x+4, y-3, 5);
        g.fillTriangle(x-9, y, x+9, y, x, y+10);
        g.fillStyle(0xffffff, 0.9); g.fillCircle(x-4, y-5, 1.8);
        continue;
      }
      if (o.type === 'coeur'){
        g.fillStyle(0xe2584d, 0.18); g.fillCircle(x, y, 15);
        g.fillStyle(0xe2584d, 1);
        g.fillCircle(x-4, y-3, 5); g.fillCircle(x+4, y-3, 5);
        g.fillTriangle(x-9, y, x+9, y, x, y+10);
        g.fillStyle(0xff9d9d, 0.85); g.fillCircle(x-4, y-5, 1.8);
        continue;
      }
      const a = ARMES[o.type];
      g.fillStyle(a.couleur, 0.2); g.fillCircle(x, y, 16);
      g.lineStyle(5, a.couleur, 1); g.strokeCircle(x, y, 8);
      g.lineStyle(2, a.clair, 1);   g.strokeCircle(x, y, 8);
      g.fillStyle(0xffffff, 0.9);   g.fillCircle(x, y - 8, 2.6);
    }
  },
  dessinerEclats(){
    const g = this.gEclats; g.clear();
    for (const e of this.eclats){
      const k = Math.max(0, e.vie / e.max);
      g.fillStyle(e.couleur, k);
      g.fillRect(e.x-2, e.y-2, 3 + k*2, 3 + k*2);
    }
  },
  dessinerTirs(){
    const g = this.gTirs; g.clear();
    const j = this.joueurs[0];
    // le faisceau du laser part dans la direction regardée au tir
    if (j.attaque && COUPS[j.attaque.type].faisceau){
      const c = COUPS[j.attaque.type];
      const k = 1 - Phaser.Math.Clamp(j.attaque.t / c.duree, 0, 1);
      const x0 = j.go.x + j.attaque.fx * 12, y0 = j.go.y + j.attaque.fy * 12 - 10;
      const x1 = j.go.x + j.attaque.fx * (14 + c.portee), y1 = j.go.y + j.attaque.fy * (14 + c.portee) - 10;
      g.lineStyle(22*k, 0xc46bff, 0.2);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokePath();
      g.lineStyle(9*k, 0xe9b6ff, 0.55);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokePath();
      g.lineStyle(4*k, 0xffffff, 0.9);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokePath();
      g.fillStyle(0xffffff, k); g.fillCircle(x0, y0, 7*k);
      // et il blesse sur toute sa ligne
      if (j.attaque.t >= c.debut && j.attaque.t <= c.fin){
        for (const m of this.monstres){
          if (m.mort || j.attaque.touches.has(m)) continue;
          const ligne = new Phaser.Geom.Line(x0, y0, x1, y1);
          if (Phaser.Geom.Intersects.LineToRectangle(ligne, m.go.getBounds())){
            j.attaque.touches.add(m);
            this.frapper(m, c.degats + (j.attaque.elastique ? 1 : 0), c.recul, j.go.x, j.go.y);
          }
        }
      }
    }
    // l'effet de fauche des coups au corps
    const gC = this.gCoup; gC.clear();
    if (j.attaque && COUPS[j.attaque.type].portee && !COUPS[j.attaque.type].faisceau){
      const c = COUPS[j.attaque.type];
      if (j.attaque.t >= c.debut && j.attaque.t <= c.fin + 0.06){
        const z = this.zoneAttaque(j);
        gC.lineStyle(4, 0xffffff, 0.5);
        if (z.cercle) gC.strokeCircle(z.cercle.x, z.cercle.y, z.cercle.radius * 0.85);
        else gC.strokeCircle(z.rect.centerX, z.rect.centerY, z.rect.width * 0.45);
      }
    }
    for (const t of this.tirs){
      if (t.lance){
        // la pierre ou la caisse en vol, qui tournoie — dessinée plus
        // haut que sa position logique, comme jetée par-dessus la tête
        g.fillStyle(0x000000, 0.15); g.fillEllipse(t.x + SOLEIL.x, t.y + 10 + SOLEIL.y*0.5, 22, 6);
        g.save();
        g.translateCanvas(t.x, t.y - 16);
        g.rotateCanvas((0.9 - t.vie) * 9 * Math.sign(t.vx || 1));
        if (t.type === 'caisse'){
          g.fillStyle(COUL.bois, 1);      g.fillRect(-11, -10, 22, 20);
          g.fillStyle(COUL.boisClair, 1); g.fillRect(-8, -7, 16, 14);
          g.lineStyle(2.5, COUL.boisOmbre, 1);
          g.beginPath(); g.moveTo(-8, -7); g.lineTo(8, 7); g.strokePath();
        } else {
          g.fillStyle(COUL.rocherOmbre, 1); g.fillEllipse(0, 0, 17, 12);
          g.fillStyle(COUL.rocher, 1);      g.fillEllipse(-2, -2, 13, 8);
        }
        g.restore();
        continue;
      }
      if (t.jet){
        const a = (1.1 - t.vie) * 14 * Math.sign(t.vx || 1);
        const cx = Math.cos(a)*6, cy = Math.sin(a)*6;
        g.fillStyle(t.couleur, 0.22); g.fillCircle(t.x, t.y, 9);
        g.lineStyle(5, t.couleur, 1);
        g.beginPath(); g.moveTo(t.x - cx, t.y - cy); g.lineTo(t.x + cx, t.y + cy); g.strokePath();
        g.fillStyle(t.clair || 0xffffff, 0.95); g.fillCircle(t.x, t.y, 2.2);
        continue;
      }
      g.fillStyle(t.couleur, 0.25); g.fillCircle(t.x, t.y, 7);
      g.fillStyle(t.couleur, 1);    g.fillCircle(t.x, t.y, 3.5);
      g.fillStyle(0xffffff, 0.9);   g.fillCircle(t.x, t.y, 1.6);
    }
  },

  dessinerHud(){
    const g = this.hud; g.clear();
    const j = this.joueurs[0];
    for (let i = 0; i < CFG.pvJoueur; i++){
      g.fillStyle(i < j.pv ? 0xe2584d : 0x2a3355, 1);
      const x = 26 + i*26, y = 32;
      g.fillCircle(x-5, y-3, 6); g.fillCircle(x+5, y-3, 6);
      g.fillTriangle(x-11, y, x+11, y, x, y+12);
    }
    for (let i = 0; i < CFG.enduranceMax; i++){
      const part = Phaser.Math.Clamp(j.endurance - i, 0, 1);
      const x = 15 + i*26;
      g.fillStyle(0x123644, 0.9); g.fillRect(x, 47, 22, 5);
      if (part > 0){
        g.fillStyle(part >= 1 ? 0x4dd6c1 : 0x2e7d6e, 1);
        g.fillRect(x, 47, 22*part, 5);
      }
    }
    let t = this.def.nom + '   VIES ' + Math.max(0, PARTIE.vies)
          + '   MONSTRES ' + this.vaincus;
    if (j.arme) t += '   ' + ARMES[j.arme].nom + ' '
      + (j.munitions > 0 ? j.munitions + (j.segments > 0 ? '·' + j.segments : '') : 'RECHARGE');
    this.hudTexte.setText(t);

    const bs = this.boss;
    if (bs && !bs.mort && Math.hypot(bs.go.x - j.go.x, bs.go.y - j.go.y) < 560){
      const w = 300, x = (L - w)/2, y = H - 34;
      g.fillStyle(0x000000, 0.45); g.fillRect(x-4, y-4, w+8, 18);
      g.fillStyle(0x2a3355, 1);    g.fillRect(x, y, w, 10);
      g.fillStyle(0xff5e5e, 1);    g.fillRect(x, y, w * Math.max(0, bs.pv/bs.pvMax), 10);
      g.fillStyle(0xffffff, 0.18); g.fillRect(x, y, w, 3);
      this.hudBoss.setText(bs.def.nom).setAlpha(1);
    } else if (this.hudBoss.alpha) this.hudBoss.setAlpha(0);
  },
});
