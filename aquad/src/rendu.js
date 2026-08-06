// ─────────────────────────────────────────────────────────────
// RENDU — vue de dessus
// Greffé sur la scène par le build. Chaque entité dessine dans SON
// calque, et son depth = son y : passer derrière un palmier le masque,
// passer devant le recouvre. Le sol se redessine sur la zone visible.
// ─────────────────────────────────────────────────────────────
Object.assign(Aquad.prototype, {

  dessinerTout(){
    // le fantôme que suit la caméra colle à la projection du joueur
    const jp = this.iso(this.joueurs[0].go.x, this.joueurs[0].go.y);
    this.suiveur.setPosition(jp.x, jp.y);
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

  // ── le sol : l'eau et le chemin de disques de terre ─────────
  dessinerSol(){
    const g = this.gSol; g.clear();
    const cam = this.cameras.main;
    const vx = cam.scrollX - 40, vy = cam.scrollY - 40;
    const vl = L + 80, vh = H + 80;
    const t = this.def.teinte;
    // le culling se fait en coordonnées MONDE : on rétro-projette les
    // quatre coins de l'écran et on prend leur boîte englobante
    const c1 = this.isoInv(vx, vy), c2 = this.isoInv(vx + vl, vy),
          c3 = this.isoInv(vx, vy + vh), c4 = this.isoInv(vx + vl, vy + vh);
    const wx0 = Math.min(c1.x, c2.x, c3.x, c4.x), wx1 = Math.max(c1.x, c2.x, c3.x, c4.x);
    const wy0 = Math.min(c1.y, c2.y, c3.y, c4.y), wy1 = Math.max(c1.y, c2.y, c3.y, c4.y);
    const visible = (x, y) => x > wx0 && x < wx1 && y > wy0 && y < wy1;
    const noeudVisible = nd =>
      nd.x + nd.r + 140 > wx0 && nd.x - nd.r - 140 < wx1 &&
      nd.y + nd.r + 140 > wy0 && nd.y - nd.r - 140 < wy1;
    const vus = this.noeuds.filter(noeudVisible);

    // l'eau profonde remplit l'écran, puis tout se dessine en projection
    g.fillStyle(COUL.eauProfonde, 1); g.fillRect(vx, vy, vl, vh);
    g.save();
    g.scaleCanvas(1, 0.5);
    g.rotateCanvas(Math.PI / 4);

    // le halo d'eau claire autour de chaque disque de terre
    for (const nd of vus){
      g.fillStyle(COUL.eau, 1); g.fillCircle(nd.x, nd.y, nd.r + 90);
    }
    // TOUTES les écumes d'abord : leurs traits qui traversent la terre
    // seront recouverts par les remplissages des disques voisins
    const resp = Math.sin(this.time.now / 600) * 4;
    for (const nd of vus){
      g.lineStyle(2, COUL.ecume, 0.22); g.strokeCircle(nd.x, nd.y, nd.r + 52 + resp * 1.5);
      g.lineStyle(4, COUL.eauClaire, 0.7); g.strokeCircle(nd.x, nd.y, nd.r + 38 + resp);
      g.lineStyle(3, COUL.ecume, 0.5); g.strokeCircle(nd.x, nd.y, nd.r + 26 + resp * 0.5);
    }
    // des reflets qui dérivent lentement autour des nœuds
    const tEau = this.time.now / 4000;
    g.lineStyle(2.5, 0xffffff, 0.22);
    for (const nd of vus){
      for (let k = 0; k < 4; k++){
        const a0 = Math.abs(Math.sin(nd.x * 0.01 + k * 12.3));
        const a = a0 * Math.PI * 2 + tEau * (0.3 + a0 * 0.4);
        const dist = nd.r + 70 + a0 * 60;
        const gx = nd.x + Math.cos(a) * dist, gy = nd.y + Math.sin(a) * dist;
        if (this.surTerre(gx, gy, -30) || !visible(gx, gy)) continue;
        g.beginPath(); g.moveTo(gx - 6, gy); g.lineTo(gx + 6, gy); g.strokePath();
      }
    }
    // puis les remplissages, couche par couche sur TOUS les disques :
    // sable mouillé, sable, herbe — les cercles fusionnent en serpentin
    for (const nd of vus){ g.fillStyle(COUL.sableMouille, 1); g.fillCircle(nd.x, nd.y, nd.r + 18); }
    for (const nd of vus){ g.fillStyle(t.sable || COUL.sable, 1); g.fillCircle(nd.x, nd.y, nd.r + 8); }
    for (const nd of vus){ g.fillStyle(t.herbe, 1); g.fillCircle(nd.x, nd.y, Math.max(30, nd.r - 28)); }

    // le sol vivant : détails hachés par nœud, plus fournis en prairie
    for (let i = 0; i < this.noeuds.length; i++){
      const nd = this.noeuds[i];
      if (!noeudVisible(nd)) continue;
      const nDet = Math.round(nd.r / 14);
      for (let k = 0; k < nDet; k++){
        const h1 = Math.abs(Math.sin(i * 37.7 + k * 12.99));
        const h2 = Math.abs(Math.sin(i * 53.1 + k * 78.23));
        const a = h1 * Math.PI * 2;
        const dist = h2 * Math.max(10, nd.r - 60);
        const hx = nd.x + Math.cos(a) * dist, hy = nd.y + Math.sin(a) * dist;
        if (!visible(hx, hy)) continue;
        const genre = (i * 7 + k) % 5;
        if (genre === 0){
          g.fillStyle(t.herbeClaire || COUL.herbeClaire, 1);
          g.fillEllipse(hx, hy, 32, 14);
          g.fillEllipse(hx + Math.sin(k * 5.7) * 9, hy + 4, 22, 10);
        } else if (genre === 1){
          g.fillStyle(t.herbeSombre, 1);
          g.fillEllipse(hx, hy, 22, 10);
          g.fillEllipse(hx + Math.sin(k * 7.3) * 7, hy + 3, 15, 7);
        } else if (genre === 2){
          g.lineStyle(2, COUL.brin, 0.9);
          const dxb = Math.sin(k * 3.3) * 2.5;
          g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + dxb, hy - 6); g.strokePath();
          g.beginPath(); g.moveTo(hx + 3, hy + 1); g.lineTo(hx + 3 - dxb, hy - 5); g.strokePath();
        } else if (genre === 3){
          g.fillStyle(k % 3 ? COUL.fleur : COUL.fleur2, 1);
          g.fillCircle(hx, hy, 2.2); g.fillCircle(hx + 4, hy + 2, 1.6);
        }
        // genre 4 : rien — le vide aussi fait respirer le sol
      }
      // coquillages et galets sur l'anneau de plage du disque
      for (let k = 0; k < 5; k++){
        const h1 = Math.abs(Math.sin(i * 91.3 + k * 17.89));
        const a = h1 * Math.PI * 2;
        const dist = nd.r - 18 + Math.sin(i + k * 2.7) * 8;
        const hx = nd.x + Math.cos(a) * dist, hy = nd.y + Math.sin(a) * dist;
        if (!visible(hx, hy)) continue;
        if (k % 2){
          g.fillStyle(COUL.coquillage, 1); g.fillEllipse(hx, hy, 5, 4);
          g.fillStyle(COUL.sableOmbre, 1); g.fillCircle(hx, hy + 1, 1);
        } else {
          g.fillStyle(COUL.galet, 1); g.fillEllipse(hx, hy, 6, 4);
        }
      }
    }
    g.restore();
  },

  // ── le ponton de sortie, au dernier nœud du chemin ──────────
  dessinerSortie(){
    const g = this.gSortie; g.clear();
    g.save();
    g.scaleCanvas(1, 0.5);
    g.rotateCanvas(Math.PI / 4);
    const x0 = this.arrivee.x + this.arrivee.r - 12, y = this.arrivee.y;
    const bloquee = this.bossVivant;
    const pulse = bloquee ? 0 : 0.55 + 0.45 * Math.sin(this.time.now / 260);
    // planches au-dessus de l'eau
    for (let i = 0; i < 6; i++){
      g.fillStyle(i % 2 ? COUL.ponton : COUL.pontonOmbre, 1);
      g.fillRect(x0 + i * 34, y - 42, 32, 84);
    }
    g.fillStyle(COUL.ombrePortee, 0.18); g.fillRect(x0, y + 40, 6 * 34, 8);
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
    g.restore();
  },

  // ── la visée : ce que dirait un coup donné maintenant ───────
  dessinerVisee(){
    const g = this.gVisee; g.clear();
    if (this.etat !== 'jeu') return;
    g.save();
    g.scaleCanvas(1, 0.5);
    g.rotateCanvas(Math.PI / 4);
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
    g.restore();
  },

  // ── décors : dessinés une fois, animés doucement ────────────
  // billboards : le PIED est projeté, le corps reste dessiné debout
  dessinerDecor(d){
    const g = d.g; g.clear();
    const P = this.iso(d.x, d.y);
    if (d.type === 'rocher'){
      // un rocher en volume : assise large, dôme principal, seconde
      // bosse, calottes éclairées côté soleil
      g.fillStyle(COUL.ombrePortee, 0.22); g.fillEllipse(P.x + SOLEIL.x*1.5, P.y + 12 + SOLEIL.y*0.5, 48, 14);
      g.fillStyle(COUL.rocherOmbre, 1); g.fillEllipse(P.x, P.y + 4, 46, 20);
      g.fillStyle(COUL.rocher, 1); g.fillEllipse(P.x - 2, P.y - 8, 40, 28);
      g.fillStyle(COUL.rocher, 1); g.fillEllipse(P.x + 14, P.y - 2, 20, 16);
      g.fillStyle(0xb8bcc8, 0.75); g.fillEllipse(P.x - 10, P.y - 14, 16, 9);
      g.fillStyle(0xb8bcc8, 0.5); g.fillEllipse(P.x + 12, P.y - 7, 8, 5);
      return;
    }
    // palmier : le pied au corps physique, la tête bien plus haut —
    // c'est le tri par profondeur projetée qui fait passer derrière/devant
    const bal = Math.sin(d.phase) * 3;
    g.fillStyle(COUL.ombrePortee, 0.22); g.fillEllipse(P.x + SOLEIL.x*3, P.y + 8 + SOLEIL.y, 52, 12);
    // l'occlusion au pied du tronc
    g.fillStyle(COUL.ombrePortee, 0.17); g.fillEllipse(P.x, P.y + 5, 16, 6);
    g.lineStyle(9, COUL.tronc, 1);
    g.beginPath(); g.moveTo(P.x, P.y + 4);
    g.lineTo(P.x + 6 + bal * 0.4, P.y - 46); g.strokePath();
    // les anneaux de croissance du tronc
    g.lineStyle(2, 0x6d4420, 0.5);
    for (const k of [0.3, 0.55, 0.8]){
      const rx = P.x + (6 + bal*0.4) * k, ry = P.y + 4 - 50 * k;
      g.beginPath(); g.moveTo(rx - 4, ry); g.lineTo(rx + 4, ry); g.strokePath();
    }
    // la couronne : 6 palmes RADIALES, chacune dans son repère tourné —
    // celles du bas (face au joueur) sont plus claires, la lumière vient
    // d'en haut
    const tx = P.x + 7 + bal * 0.5, ty = P.y - 52;
    for (let a = 0; a < 6; a++){
      const ang = a * Math.PI / 3 + 0.26 + bal * 0.02;
      const bas = Math.sin(ang) > 0.15;
      g.save();
      g.translateCanvas(tx, ty);
      g.rotateCanvas(ang);
      g.fillStyle(bas ? COUL.palmeClaire : COUL.palme, 1);
      g.fillEllipse(13, 0, 24, 9);
      g.fillEllipse(23, 2.5, 12, 6);   // le bout de la palme retombe
      g.restore();
    }
    g.fillStyle(COUL.palme, 1); g.fillEllipse(tx, ty, 14, 10);
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

  // un cube isométrique posé au sol : dessus en losange, deux faces.
  // (x, y) est le centre de la base, l le côté, h la hauteur.
  cube(g, x, y, l, h, dessus, gauche, droite){
    const w = l/2, r = l/4, ty = y - h;
    g.fillStyle(gauche, 1);
    g.fillPoints([{x:x-w,y:ty},{x:x,y:ty+r},{x:x,y:ty+r+h},{x:x-w,y:ty+h}], true);
    g.fillStyle(droite, 1);
    g.fillPoints([{x:x,y:ty+r},{x:x+w,y:ty},{x:x+w,y:ty+h},{x:x,y:ty+r+h}], true);
    g.fillStyle(dessus, 1);
    g.fillPoints([{x:x,y:ty-r},{x:x+w,y:ty},{x:x,y:ty+r},{x:x-w,y:ty}], true);
  },

  dessinerPierres(){
    for (const p of this.pierres){
      const g = p.g; g.clear();
      const P = this.iso(p.go.x, p.go.y);
      g.setDepth(P.y);
      const x = P.x, y = P.y;
      // un galet en volume : l'assise, le dôme, la calotte éclairée
      g.fillStyle(COUL.ombrePortee, 0.22); g.fillEllipse(x + SOLEIL.x, y + 7 + SOLEIL.y*0.5, 20, 6);
      g.fillStyle(COUL.rocherOmbre, 1); g.fillEllipse(x, y + 2, 18, 9);
      g.fillStyle(COUL.rocher, 1); g.fillEllipse(x, y - 3, 16, 12);
      g.fillStyle(0xb8bcc8, 0.8); g.fillEllipse(x - 3, y - 6, 9, 5);
    }
  },

  dessinerCaisses(){
    for (const k of this.caisses){
      const g = k.g; g.clear();
      const P = this.iso(k.go.x, k.go.y);
      g.setDepth(P.y);
      const x = P.x, y = P.y + 6, clair = k.flash > 0;
      g.fillStyle(COUL.ombrePortee, 0.24); g.fillEllipse(x + SOLEIL.x, y + 2 + SOLEIL.y*0.5, 36, 11);
      // l'occlusion de contact : la base assombrit le sol qu'elle touche
      g.fillStyle(COUL.ombrePortee, 0.17); g.fillEllipse(x, y + 3, 28, 8);
      // un vrai cube posé sur le sol isométrique
      this.cube(g, x, y, 30, 20,
        clair ? 0xffffff : COUL.boisClair,
        clair ? 0xffffff : COUL.bois,
        clair ? 0xffffff : COUL.boisOmbre);
      // les planches croisées du couvercle
      g.lineStyle(2.5, clair ? 0xffffff : COUL.boisOmbre, 1);
      const ty = y - 20;
      g.beginPath(); g.moveTo(x - 15, ty); g.lineTo(x + 15, ty); g.strokePath();
      g.beginPath(); g.moveTo(x, ty - 7.5); g.lineTo(x, ty + 7.5); g.strokePath();
      // l'arête nord-ouest du couvercle attrape le soleil
      g.lineStyle(2, 0xf7e9c8, 0.75);
      g.beginPath(); g.moveTo(x - 15, ty); g.lineTo(x, ty - 7.5); g.strokePath();
    }
  },

  // ── la faune ────────────────────────────────────────────────
  dessinerMonstres(){
    const j = this.joueurs[0];
    for (const m of this.monstres){
      const g = m.g; g.clear();
      const P = this.iso(m.go.x, m.go.y);
      g.setDepth(P.y);
      if (m.def.silhouette === 'drone') this.dessinerMeduse(g, m);
      else this.dessinerCrabe(g, m);
      if (m.pv < m.pvMax){
        const l = m.def.boss ? m.def.taille[0]*0.6 : 13;
        const x = P.x, y = P.y - m.def.taille[1]/2 - 16;
        g.fillStyle(0x2a3355, 1); g.fillRect(x-l, y, l*2, 4);
        g.fillStyle(m.def.boss ? 0xff5e5e : 0xe2584d, 1); g.fillRect(x-l, y, l*2 * (m.pv/m.pvMax), 4);
      }
    }
  },
  dessinerCrabe(g, m){
    const e = m.def.taille[0] / 30;
    const P = this.iso(m.go.x, m.go.y);
    const x = P.x, y = P.y;
    const dandine = Math.sin(m.phase) * 2;
    const alerte = m.prepare > 0 && Math.floor(m.prepare * 14) % 2 === 0;
    const eclaire = m.flash > 0 ? 0xffffff : (alerte ? 0xffe9b0 : null);
    const corps = eclaire || m.def.couleur;
    const ombre = eclaire || m.def.ombre;
    // l'ombre = la boîte au sol du monstre, penchée comme toutes les autres
    g.fillStyle(COUL.ombrePortee, 0.24); g.fillEllipse(x + SOLEIL.x, y + 10*e + SOLEIL.y*0.5, m.def.taille[0], 10*e);
    // pattes qui trottinent
    g.lineStyle(3*e, ombre, 1);
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++){
        const px = x + s * 14*e, py = y - 2 + i * 6*e + (Math.sin(m.phase*2 + i) * 2);
        g.beginPath(); g.moveTo(x + s*8*e, y + (i-1)*4*e); g.lineTo(px, py); g.strokePath();
      }
    // l'occlusion de contact : le corps assombrit le sol juste sous lui
    g.fillStyle(COUL.ombrePortee, 0.15); g.fillEllipse(x, y + 8*e, 22*e, 5*e);
    g.fillStyle(ombre, 1); g.fillEllipse(x, y + 2*e + dandine*0.4, 28*e, 16*e);
    g.fillStyle(corps, 1); g.fillEllipse(x, y - 2*e + dandine*0.4, 26*e, 16*e);
    // le dessus de la carapace attrape la lumière : c'est un dôme
    g.fillStyle(0xffffff, 0.18); g.fillEllipse(x - 3*e, y - 6*e + dandine*0.4, 15*e, 6*e);
    if (m.def.gros){
      // la coquille du bernard-l'ermite : une spirale sur le dôme
      g.lineStyle(2.5*e, m.flash > 0 ? 0xffffff : m.def.ombre, 0.85);
      g.beginPath(); g.arc(x + 2*e, y - 3*e + dandine*0.4, 8*e, -2.6, 0.6); g.strokePath();
      g.beginPath(); g.arc(x + 3*e, y - 2*e + dandine*0.4, 4*e, -2.2, 1.4); g.strokePath();
    }
    // pinces vers le joueur (comparaison à l'écran : positions projetées)
    const vers = Math.sign(this.iso(this.joueurs[0].go.x, this.joueurs[0].go.y).x - x) || 1;
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
    const P = this.iso(m.go.x, m.go.y);
    const bob = Math.sin(m.phase) * 3;
    const x = P.x, y = P.y + bob;
    const eclaire = m.flash > 0 ? 0xffffff : null;
    const corps = eclaire || m.def.couleur;
    // l'ombre fait l'inverse de la cloche : plus la méduse monte, plus
    // l'ombre rétrécit et pâlit — c'est ça, flotter
    g.fillStyle(COUL.ombrePortee, 0.18 + bob*0.014);
    g.fillEllipse(x + SOLEIL.x, P.y + 14*e + SOLEIL.y*0.5, 26*e + bob*2, 8*e + bob*0.6);
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
    // la cloche : un dôme qui attrape la lumière côté soleil
    g.fillStyle(0xffffff, 0.35); g.fillEllipse(x - 4*e, y - 7*e, 12*e, 6*e);
    g.fillStyle(0xffffff, 0.18); g.fillEllipse(x, y - 4*e, 18*e, 8*e);
    const vers = Math.sign(this.iso(this.joueurs[0].go.x, this.joueurs[0].go.y).x - x) || 1;
    g.fillStyle(m.def.oeil, 1);
    g.fillCircle(x + vers*2 - 4*e, y - 2*e, 2*e); g.fillCircle(x + vers*2 + 4*e, y - 2*e, 2*e);
  },

  // ── le héros, repris de Combat en vue 3/4 ───────────────────
  // la position d'un pied sur un cycle [0..1) au taux d'appui donné :
  // pendant l'appui le pied est AU SOL et recule sous le corps (il pousse —
  // et comme la phase avance avec la distance, il ne glisse jamais) ;
  // pendant le vol il revient devant en arc, départ lent, pose douce
  jambe(ph, foulee, lever, appui){
    ph -= Math.floor(ph);
    if (ph < appui){
      const u = ph / appui;
      return [foulee * (1 - 2*u), 1];
    }
    const u = (ph - appui) / (1 - appui);
    const e = u*u*(3 - 2*u);
    return [foulee * (2*e - 1), -lever * Math.sin(Math.PI * u)];
  },

  dessinerPerso(j){
    const g = j.g; g.clear();
    const spr = j.spr;
    const PJ = this.iso(j.go.x, j.go.y);
    g.setDepth(PJ.y); spr.setDepth(PJ.y);
    const b = j.go.body;
    const vitesse = Math.hypot(b.velocity.x, b.velocity.y);
    const marche = vitesse > 20;
    const allure = Math.min(1, vitesse / CFG.vitesse);
    const t = j.phase;
    // la direction DESSINÉE se juge À L'ÉCRAN : on projette le regard
    // (ou le coup) — dos quand il monte à l'écran, profil ailleurs. La
    // vue de face n'a pas encore sa planche : elle retombe sur le profil.
    const dfx = j.attaque ? j.attaque.fx : j.fx;
    const dfy = j.attaque ? j.attaque.fy : j.fy;
    const sfx = (dfx - dfy) * ISO_C, sfy = (dfx + dfy) * ISO_S;
    const vue = (Math.abs(sfy) * 2 > Math.abs(sfx) && sfy < 0) ? 'dos' : 'profil';
    const sens = sfx < -0.05 ? -1 : 1;
    const cadre = (anim, i) => {
      const cs = CADRES_PERSO[anim];
      const k = Phaser.Math.Clamp(i, 0, cs.length - 1);
      return { nom: anim + k, c: cs[k] };
    };
    const courseK = Phaser.Math.Clamp((allure - 0.45) / 0.3, 0, 1);
    let f;
    if (this.etat === 'perdu' || this.etat === 'gameover'){
      // à terre : la chute se joue une fois, puis on reste allongé
      f = cadre('profil-mourir', Math.floor((this.time.now - (this.mortDebut || 0)) / 150));
    } else if (j.porte){
      // l'objet tenu à bout de bras : la pose du soulevé
      f = cadre(vue + '-soulever', 2);
    } else if (j.attaque){
      const c = COUPS[j.attaque.type];
      const p = Phaser.Math.Clamp(j.attaque.t / c.duree, 0, 1);
      const anim = (c.tir || c.faisceau) ? 'profil-tir'   // pas de tir de dos
                 : vue + (j.attaque.type === 'pied' ? '-pied' : '-poing');
      f = cadre(anim, Math.floor(p * CADRES_PERSO[anim].length));
    } else if (j.charge){
      f = cadre(vue + (j.charge.action === 'pied' ? '-pied' : '-poing'), 0);
    } else if (j.invuln > CFG.invincibilite - 0.42 && j.invuln <= CFG.invincibilite){
      // on vient d'encaisser : la grimace prime sur le reste
      f = cadre('profil-recevoir', j.invuln > CFG.invincibilite - 0.2 ? 0 : 1);
    } else if (marche){
      const anim = vue + (courseK > 0.5 ? '-course' : '-marche');
      const n = CADRES_PERSO[anim].length;
      // la phase avance avec la distance parcourue : pas de patinage
      f = cadre(anim, Math.floor(((t / (Math.PI*2)) % 1) * n));
    } else {
      f = vue === 'dos' ? cadre('dos-repos', 0) : cadre('profil-marche', 0);
    }

    // le rebond du corps : deux minima par cycle, PILE sur les contacts
    let lev = 0;
    if (marche && !j.attaque){
      const phR = t / (Math.PI * 2);
      lev = (1.4 + courseK * 2.0) * (0.5 - 0.5 * Math.cos(phR * Math.PI * 4));
    }

    spr.setTexture('persoAtlas', f.nom);
    const flip = sens < 0;   // les planches regardent vers la droite
    spr.setFlipX(flip);
    spr.setOrigin(flip ? 1 - f.c.ox : f.c.ox, f.c.oy);
    // à l'arrêt, un léger transfert de poids ; en marche, l'impact du
    // pas écrase brièvement le corps sur son appui
    const balance = (!marche && !j.attaque && !j.charge && !j.porte) ? Math.sin(this.time.now / 700) * 0.8 : 0;
    let ex = 1, ey = 1;
    if (marche && !j.attaque){
      const c2 = 1 - Math.min(1, lev * 1.2);
      if (c2 > 0){ ex = 1 + c2*0.04; ey = 1 - c2*0.06; }
    }
    spr.setPosition(PJ.x + balance, PJ.y + 14 - lev);
    // léger écrasement vertical : la caméra est au-dessus, pas en face
    spr.setScale(ECHELLE_PERSO * ex, ECHELLE_PERSO * 0.92 * ey);
    spr.setAlpha(j.invuln > 0 && Math.floor(j.invuln*20) % 2 === 0 ? 0.35 : 1);

    // l'ombre fait exactement la largeur de la boîte au sol : c'est elle
    // qu'on regarde pour juger un contact. Elle respire avec le corps :
    // large et sombre à l'appui, plus claire quand il est en l'air.
    g.fillStyle(COUL.ombrePortee, 0.3 - lev*0.035);
    g.fillEllipse(SOLEIL.x, 3 + SOLEIL.y*0.5, 26 - lev*1.5, 8 - lev*0.4);

    // l'objet porté, posé sur les mains levées du sprite
    if (j.porte){
      const oy = TETE - 16 - lev + Math.sin(this.time.now / 300) * 1.2;
      if (j.porte.type === 'caisse'){
        this.cube(g, 0, oy, 24, 15, COUL.boisClair, COUL.bois, COUL.boisOmbre);
        g.lineStyle(2, COUL.boisOmbre, 1);
        g.beginPath(); g.moveTo(-12, oy - 15); g.lineTo(12, oy - 15); g.strokePath();
      } else {
        g.fillStyle(COUL.rocherOmbre, 1); g.fillEllipse(0, oy - 9, 20, 14);
        g.fillStyle(COUL.rocher, 1);      g.fillEllipse(-2, oy - 11, 15, 10);
        g.fillStyle(0xb8bcc8, 0.7);       g.fillEllipse(-5, oy - 13, 6, 4);
      }
    }

    // la lueur du coup qui s'arme, devant le corps
    if (j.charge){
      const k = Math.min(1, j.charge.t / CFG.seuilElastique);
      const cx = sens * 11, cy = j.charge.action === 'pied' ? -8 : -24;
      g.fillStyle(j.charge.pret ? 0xffd166 : 0x4dd6c1, 0.28 + 0.25*k);
      g.fillCircle(cx, cy, 4 + k*5);
      if (j.charge.pret){ g.fillStyle(0xffffff, 0.85); g.fillCircle(cx, cy, 2); }
    }

    g.setPosition(PJ.x, PJ.y + 12);
    // l'ombre ne se retourne PAS avec le regard : le soleil est commun
    g.setScale(1, 0.92);
    g.setRotation(0);
    g.setAlpha(1);
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
      const P = this.iso(o.go.x, o.go.y);
      const bobO = Math.sin(o.phase) * 2.5;
      const x = P.x, y = P.y + bobO;
      // l'ombre respire à l'inverse de l'objet qui danse
      g.fillStyle(COUL.ombrePortee, 0.18 + bobO*0.016);
      g.fillEllipse(x + SOLEIL.x, P.y + 12, 16 + bobO*1.4, 5 + bobO*0.4);
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
      const P = this.iso(e.x, e.y);
      g.fillStyle(e.couleur, k);
      g.fillRect(P.x-2, P.y-2, 3 + k*2, 3 + k*2);
    }
  },
  dessinerTirs(){
    const g = this.gTirs; g.clear();
    const j = this.joueurs[0];
    // le faisceau du laser part dans la direction regardée au tir
    if (j.attaque && COUPS[j.attaque.type].faisceau){
      const c = COUPS[j.attaque.type];
      const k = 1 - Phaser.Math.Clamp(j.attaque.t / c.duree, 0, 1);
      // la géométrie du faisceau vit en monde (les monstres y sont testés),
      // seul son dessin est projeté
      const wx0 = j.go.x + j.attaque.fx * 12, wy0 = j.go.y + j.attaque.fy * 12;
      const wx1 = j.go.x + j.attaque.fx * (14 + c.portee), wy1 = j.go.y + j.attaque.fy * (14 + c.portee);
      const A = this.iso(wx0, wy0), B = this.iso(wx1, wy1);
      const x0 = A.x, y0 = A.y - 10, x1 = B.x, y1 = B.y - 10;
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
          const ligne = new Phaser.Geom.Line(wx0, wy0, wx1, wy1);
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
        // la surface de contact est dessinée SUR le sol, à travers la
        // même projection que lui : un cercle monde, exactement couché
        const z = this.zoneAttaque(j);
        gC.save();
        gC.scaleCanvas(1, 0.5);
        gC.rotateCanvas(Math.PI / 4);
        gC.lineStyle(4, 0xffffff, 0.5);
        gC.strokeCircle(z.rect.centerX, z.rect.centerY, z.rect.width * 0.45);
        gC.restore();
      }
    }
    let bi = 0;
    for (const t of this.tirs){
      if (t.lance){
        // la pierre ou la caisse en vol, qui tournoie — dessinée plus
        // haut que sa position logique, comme jetée par-dessus la tête
        const P = this.iso(t.x, t.y);
        g.fillStyle(COUL.ombrePortee, 0.18); g.fillEllipse(P.x + SOLEIL.x, P.y + 10 + SOLEIL.y*0.5, 22, 6);
        g.save();
        g.translateCanvas(P.x, P.y - 16);
        g.rotateCanvas((0.9 - t.vie) * 9 * Math.sign(t.vx || 1));
        if (t.type === 'caisse'){
          // le cube qui tournoie en vol
          this.cube(g, 0, 8, 22, 14, COUL.boisClair, COUL.bois, COUL.boisOmbre);
        } else {
          g.fillStyle(COUL.rocherOmbre, 1); g.fillEllipse(0, 0, 17, 12);
          g.fillStyle(COUL.rocher, 1);      g.fillEllipse(-2, -2, 13, 8);
        }
        g.restore();
        continue;
      }
      const P = this.iso(t.x, t.y);
      if (t.jet){
        const a = (1.1 - t.vie) * 14 * Math.sign(t.vx || 1);
        const cx = Math.cos(a)*6, cy = Math.sin(a)*6;
        g.fillStyle(t.couleur, 0.22); g.fillCircle(P.x, P.y, 9);
        g.lineStyle(5, t.couleur, 1);
        g.beginPath(); g.moveTo(P.x - cx, P.y - cy); g.lineTo(P.x + cx, P.y + cy); g.strokePath();
        g.fillStyle(t.clair || 0xffffff, 0.95); g.fillCircle(P.x, P.y, 2.2);
        continue;
      }
      // la balle est la boule de feu de la planche ; le miroir suit la
      // direction À L'ÉCRAN du vol
      const img = this.imgTirs[bi++];
      if (img) img.setVisible(true).setPosition(P.x, P.y - 8)
                  .setFlipX((t.vx - t.vy) * ISO_C < 0);
    }
    for (let i = bi; i < this.imgTirs.length; i++) this.imgTirs[i].setVisible(false);
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
