// ─────────────────────────────────────────────────────────────
// RENDU
// Greffé sur la scène par le build : moteur.js déclare la classe,
// ce fichier lui ajoute tout le dessin. L'assemblage les met dans le
// même script, donc la même portée.
// ─────────────────────────────────────────────────────────────
Object.assign(Combat.prototype, {

  // ── rendu ───────────────────────────────────────────────────
  dessinerTout(b){
    const sx = this.cameras.main.scrollX;
    if (this.def.decor === 'interieur') this.dessinerInterieur(sx);
    else if (this.def.decor === 'toit') this.dessinerToit(sx);
    else if (this.def.decor === 'foret') this.dessinerForet(sx);
    else if (this.def.decor === 'desert') this.dessinerDesert(sx);
    else if (this.def.decor === 'villeJour') this.dessinerVilleJour(sx);
    else this.dessinerDehors(sx);
    this.dessinerSortie();
    this.dessinerCaisses();
    this.dessinerMonstres();
    this.dessinerObjets();
    this.dessinerPerso(b);
    this.dessinerEclats();
    this.dessinerTirs();
    this.dessinerHud();
  },
  dessinerHud(){
    const g = this.hud; g.clear();
    for (let i = 0; i < CFG.pvJoueur; i++){
      g.fillStyle(i < this.pv ? 0xe2584d : 0x2a3355, 1);
      const x = 26 + i*26, y = 32;
      g.fillCircle(x-5, y-3, 6); g.fillCircle(x+5, y-3, 6);
      g.fillTriangle(x-11, y, x+11, y, x, y+12);
    }
    // jauge d'endurance : coups élastiques et doubles sauts y puisent
    for (let i = 0; i < CFG.enduranceMax; i++){
      const part = Phaser.Math.Clamp(this.endurance - i, 0, 1);
      const x = 15 + i*26;
      g.fillStyle(0x1c2440, 0.9); g.fillRect(x, 47, 22, 5);
      if (part > 0){
        g.fillStyle(part >= 1 ? 0x4dd6c1 : 0x2e7d6e, 1);
        g.fillRect(x, 47, 22*part, 5);
      }
    }

    let t = this.def.nom + '   VIES ' + Math.max(0, PARTIE.vies)
          + '   MONSTRES ' + this.vaincus;
    if (this.arme) t += '   ' + ARMES[this.arme].nom + ' '
      + (this.munitions > 0 ? this.munitions + (this.segments > 0 ? '·' + this.segments : '') : 'RECHARGE');
    this.hudTexte.setText(t);

    // barre du boss, seulement quand il est à portée de vue
    const b = this.boss;
    if (b && !b.mort && Math.abs(b.go.x - this.joueur.x) < 620){
      const w = 300, x = (L - w)/2, y = H - 34;
      g.fillStyle(0x000000, 0.45); g.fillRect(x-4, y-4, w+8, 18);
      g.fillStyle(0x2a3355, 1);    g.fillRect(x, y, w, 10);
      g.fillStyle(0xff5e5e, 1);    g.fillRect(x, y, w * Math.max(0, b.pv/b.pvMax), 10);
      g.fillStyle(0xffffff, 0.18); g.fillRect(x, y, w, 3);
      this.hudBoss.setText(b.def.nom).setAlpha(1);
    } else if (this.hudBoss.alpha) this.hudBoss.setAlpha(0);
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
    if (this.attaque && COUPS[this.attaque.type].faisceau){
      const c = COUPS[this.attaque.type];
      const k = 1 - Phaser.Math.Clamp(this.attaque.t / c.duree, 0, 1);
      const y  = this.joueur.y + PIEDS + c.dy + (this.attaque.bas ? DECALAGE_ACCROUPI : 0);
      const x0 = this.joueur.x + this.sens * 12;
      const x1 = this.joueur.x + this.sens * (14 + c.portee);
      const g0 = Math.min(x0, x1), w = Math.abs(x1 - x0);
      g.fillStyle(0xc46bff, 0.18 * k);  g.fillRect(g0, y - 12*k, w, 24*k);
      g.fillStyle(0xe9b6ff, 0.55 * k);  g.fillRect(g0, y -  5*k, w, 10*k);
      g.fillStyle(0xffffff, 0.9 * k);   g.fillRect(g0, y -  2*k, w,  4*k);
      g.fillStyle(0xffffff, k); g.fillCircle(x0, y, 7*k);
    }
    for (const t of this.tirs){
      if (t.jet){
        // le segment usé tournoie : un trait épais qui tourne suffit à
        // donner la rotation à cette taille
        const a = (1.6 - t.vie) * 14 * Math.sign(t.vx);
        const cx = Math.cos(a)*6, cy = Math.sin(a)*6;
        g.fillStyle(t.couleur, 0.22); g.fillCircle(t.x, t.y, 9);
        g.lineStyle(5, t.couleur, 1);
        g.beginPath(); g.moveTo(t.x - cx, t.y - cy); g.lineTo(t.x + cx, t.y + cy); g.strokePath();
        g.fillStyle(t.clair || 0xffffff, 0.95); g.fillCircle(t.x, t.y, 2.2);
        continue;
      }
      g.fillStyle(t.couleur, 0.25); g.fillCircle(t.x, t.y, 7);
      g.fillStyle(t.couleur, 1);    g.fillRect(t.x - 5, t.y - 2, 10, 4);
      g.fillStyle(0xffffff, 0.9);   g.fillRect(t.x - 2, t.y - 1, 4, 2);
    }
    for (const t of this.tirsEnnemis){
      g.fillStyle(COUL.tirEnnemi, 0.25); g.fillCircle(t.x, t.y, 9);
      g.fillStyle(COUL.tirEnnemi, 1);    g.fillCircle(t.x, t.y, 4.5);
      g.fillStyle(0xffe0d0, 0.95);       g.fillCircle(t.x, t.y, 2);
    }
  },

  // ── décors ──────────────────────────────────────────────────
  dessinerDehors(sx){
    const g = this.fond; g.clear();
    const u = this.urbain(sx + L/2);
    const haut = this.melange(0x0d1120, 0x150d24, u);
    const bas  = this.melange(0x2a2350, 0x5b2a4a, u);
    g.fillGradientStyle(haut, haut, bas, bas, 1);
    g.fillRect(0, 0, L, SOL_Y);
    g.fillStyle(0xffb347, 0.14 - 0.07*u); g.fillCircle(730, 140, 70);
    if (u < 1) this.collines(g, sx*0.12, 0x1d2547, 42, 250, 1 - u);
    this.pylones(g, sx*0.35, this.melange(0x151c38, 0x1a1230, u));
    if (u > 0) this.immeubles(g, sx*0.45, u, 128, 120, 185);
    if (u < 1) this.collines(g, sx*0.55, 0x111730, 26, 320, 1 - u);
  },
  dessinerInterieur(sx){
    const g = this.fond; g.clear();
    const t = this.def.teinte;
    g.fillGradientStyle(t.fondHaut, t.fondHaut, t.fondBas, t.fondBas, 1);
    g.fillRect(0, 0, L, SOL_Y);

    // panneaux muraux
    const pasP = 168, dP = Math.floor(sx*0.3/pasP) - 1;
    for (let i = dP; i < dP + Math.ceil(L/pasP) + 3; i++){
      const x = i*pasP - sx*0.3;
      g.fillStyle(t.mur, 1);     g.fillRect(x, 44, pasP - 6, SOL_Y - 44);
      g.fillStyle(t.murHaut, 1); g.fillRect(x, 44, pasP - 6, 4);
    }
    // fenêtres : c'est par là qu'on voit qu'on est haut perché
    const pasF = 330, dF = Math.floor(sx*0.42/pasF) - 1;
    for (let i = dF; i < dF + Math.ceil(L/pasF) + 3; i++){
      const x = i*pasF - sx*0.42, y = 104, w = 168, h = 128;
      g.fillStyle(0x090c18, 1); g.fillRect(x, y, w, h);
      for (let j = 0; j < 7; j++){
        const bw = 13 + Math.abs(Math.sin((i*7+j)*3.3))*14;
        const bh = 26 + Math.abs(Math.cos((i*5+j)*2.7))*76;
        g.fillStyle(0x1b1430, 1); g.fillRect(x + 5 + j*24, y + h - bh, bw, bh);
        for (let k = 0; k < 4; k++){
          const fy = y + h - bh + 7 + k*15;
          if (fy > y + h - 8) break;
          if (Math.abs(Math.sin((i*3+j*5+k)*4.1)) < 0.55) continue;
          g.fillStyle(0xffd98a, 0.75); g.fillRect(x + 8 + j*24, fy, 5, 6);
        }
      }
      g.lineStyle(5, 0x2b3355, 1); g.strokeRect(x, y, w, h);
      g.lineStyle(3, 0x2b3355, 1);
      g.beginPath(); g.moveTo(x + w/2, y); g.lineTo(x + w/2, y + h); g.strokePath();
    }
    // plafond et néons
    g.fillStyle(t.plafond, 1); g.fillRect(0, 0, L, 44);
    const pasN = 215, dN = Math.floor(sx*0.5/pasN) - 1;
    for (let i = dN; i < dN + Math.ceil(L/pasN) + 3; i++){
      const x = i*pasN - sx*0.5;
      // halo en trois bandes de plus en plus pâles : un seul rectangle
      // translucide donnait une boîte grise, pas une lumière
      g.fillStyle(t.neon, 0.10); g.fillRect(x - 26, 42, 136, 40);
      g.fillStyle(t.neon, 0.06); g.fillRect(x - 40, 42, 164, 78);
      g.fillStyle(t.neon, 0.9);  g.fillRect(x, 36, 84, 6);
    }
  },
  dessinerForet(sx){
    // petit matin : ciel laiteux, soleil bas, trois rangées de sapins
    // du plus pâle (loin) au plus sombre (près)
    const g = this.fond; g.clear();
    g.fillGradientStyle(0xa8d8d0, 0xa8d8d0, 0xe8f0d8, 0xe8f0d8, 1);
    g.fillRect(0, 0, L, SOL_Y);
    g.fillStyle(0xfff2c0, 0.18); g.fillCircle(190, 92, 80);
    g.fillStyle(0xfff2c0, 0.55); g.fillCircle(190, 92, 44);
    this.sapins(g, sx*0.15, 0x9bbf8e, 306, 62, 92);
    this.sapins(g, sx*0.32, 0x6fa06b, 340, 88, 122);
    this.sapins(g, sx*0.55, 0x497a52, 378, 118, 152);
  },
  sapins(g, off, couleur, base, h, pas){
    const debut = Math.floor(off/pas) - 1;
    g.fillStyle(couleur, 1);
    for (let i = debut; i < debut + Math.ceil(L/pas) + 3; i++){
      const x = i*pas - off + (i % 3) * 14;
      const hh = h * (0.75 + Math.abs(Math.sin(i*12.99)) * 0.5);
      g.fillTriangle(x - hh*0.42, base, x + hh*0.42, base, x, base - hh);
      g.fillTriangle(x - hh*0.34, base - hh*0.34, x + hh*0.34, base - hh*0.34, x, base - hh*1.28);
    }
  },
  dessinerDesert(sx){
    const g = this.fond; g.clear();
    g.fillGradientStyle(0x8fd0e8, 0x8fd0e8, 0xf2dfae, 0xf2dfae, 1);
    g.fillRect(0, 0, L, SOL_Y);
    g.fillStyle(0xfff6d0, 0.35); g.fillCircle(700, 86, 62);
    g.fillStyle(0xffffff, 0.9);  g.fillCircle(700, 86, 34);
    this.collines(g, sx*0.2, 0xe3c078, 26, 300, 1);
    this.collines(g, sx*0.45, 0xcda45c, 20, 340, 1);
    // cactus à bras, plantés au premier plan
    const pas = 260, debut = Math.floor(sx*0.6/pas) - 1;
    g.fillStyle(0x4f7d46, 1);
    for (let i = debut; i < debut + Math.ceil(L/pas) + 3; i++){
      const x = i*pas - sx*0.6 + (i % 2) * 40;
      const h = 34 + Math.abs(Math.sin(i*7.7)) * 30;
      g.fillRect(x-5, SOL_Y - h, 10, h);
      g.fillRect(x-16, SOL_Y - h*0.62, 12, 6);
      g.fillRect(x-16, SOL_Y - h*0.62 - 12, 6, 16);
      g.fillRect(x+5,  SOL_Y - h*0.45, 12, 6);
      g.fillRect(x+11, SOL_Y - h*0.45 - 10, 6, 14);
    }
  },
  dessinerVilleJour(sx){
    const g = this.fond; g.clear();
    g.fillGradientStyle(0x9fd3ef, 0x9fd3ef, 0xdcedf7, 0xdcedf7, 1);
    g.fillRect(0, 0, L, SOL_Y);
    const pasN = 300, dN = Math.floor(sx*0.08/pasN) - 1;
    g.fillStyle(0xffffff, 0.8);
    for (let i = dN; i < dN + Math.ceil(L/pasN) + 3; i++){
      const x = i*pasN - sx*0.08, y = 58 + (i % 3) * 34;
      g.fillEllipse(x, y, 90, 22); g.fillEllipse(x+34, y-8, 60, 18);
    }
    this.batimentsClairs(g, sx*0.3, 0xb9c8d8, 0x8fa2b8, 150, 60, 130);
    this.batimentsClairs(g, sx*0.55, 0x94a8bc, 0x6d8098, 120, 100, 170);
  },
  batimentsClairs(g, off, corps, ombre, pas, hMin, hVar){
    const debut = Math.floor(off/pas) - 1;
    for (let i = debut; i < debut + Math.ceil(L/pas) + 3; i++){
      const h = hMin + Math.abs(Math.sin(i*7.13)) * hVar;
      const w = 58 + Math.abs(Math.cos(i*3.71)) * 40;
      const x = i*pas - off, y = SOL_Y - h;
      g.fillStyle(corps, 1); g.fillRect(x, y, w, h);
      g.fillStyle(ombre, 1); g.fillRect(x, y, w, 5);
      g.fillStyle(0x3c4b5c, 0.75);
      for (let fy = y + 12; fy < SOL_Y - 14; fy += 20)
        for (let fx = x + 8; fx < x + w - 11; fx += 17)
          g.fillRect(fx, fy, 7, 9);
    }
  },
  dessinerToit(sx){
    const g = this.fond; g.clear();
    g.fillGradientStyle(0x06080f, 0x06080f, 0x2c1743, 0x2c1743, 1);
    g.fillRect(0, 0, L, SOL_Y);
    // étoiles : positions figées par un hachage, pas de tirage au sort
    for (let i = 0; i < 70; i++){
      const bx = ((i * 149.7 - sx * 0.06) % (L + 60) + L + 60) % (L + 60) - 30;
      const by = 16 + ((i * 83.3) % 210);
      const k = 0.25 + Math.abs(Math.sin(i * 12.9898)) * 0.6;
      g.fillStyle(0xffffff, k); g.fillRect(bx, by, 2, 2);
    }
    g.fillStyle(0xffe9c0, 0.10); g.fillCircle(700, 108, 92);
    g.fillStyle(0xffe9c0, 0.85); g.fillCircle(700, 108, 54);
    g.fillStyle(0x2c1743, 0.30); g.fillCircle(676, 96, 44);
    // les tours voisines : leurs sommets arrivent juste sous nos pieds
    this.immeubles(g, sx*0.22, 1, 150, 40, 120, SOL_Y + 20);
  },
  collines(g, off, couleur, amp, base, alpha){
    const pts = [{x:0,y:H}];
    for (let x = 0; x <= L; x += 8){
      const wx = x + off;
      pts.push({ x, y: base + Math.sin(wx*0.0035)*amp + Math.sin(wx*0.011)*amp*0.35 });
    }
    pts.push({x:L,y:H});
    g.fillStyle(couleur, alpha); g.fillPoints(pts, true);
  },
  pylones(g, off, couleur){
    const pas = 165, debut = Math.floor(off/pas) - 1;
    g.fillStyle(couleur, 1);
    for (let i = debut; i < debut + Math.ceil(L/pas) + 3; i++){
      const h = 70 + Math.abs(Math.sin(i*12.9898))*95;
      const w = 30 + Math.abs(Math.cos(i*4.1414))*24;
      g.fillRect(i*pas - off, SOL_Y - h, w, h);
    }
  },
  // immeubles à fenêtres allumées, servent en ville comme sur le toit
  immeubles(g, off, t, pas, hMin, hVar, base){
    base = base || SOL_Y;
    const debut = Math.floor(off/pas) - 1;
    for (let i = debut; i < debut + Math.ceil(L/pas) + 3; i++){
      const h = hMin + Math.abs(Math.sin(i*7.13))*hVar;
      const w =  62 + Math.abs(Math.cos(i*3.71))*44;
      const x = i*pas - off, y = base - h;
      g.fillStyle(0x1b1430, t); g.fillRect(x, y, w, h);
      g.fillStyle(0x2a1c46, t); g.fillRect(x, y, w, 5);
      for (let fy = y + 14; fy < base - 18; fy += 24){
        for (let fx = x + 10; fx < x + w - 13; fx += 20){
          const r = Math.abs(Math.sin(fx*0.37 + fy*0.71 + i*5.1));
          if (r < 0.45) continue;
          g.fillStyle(r > 0.86 ? 0xffd98a : 0xf2a34a, t * (0.3 + r*0.5));
          g.fillRect(fx, fy, 8, 10);
        }
      }
    }
  },
  dessinerSortie(){
    const g = this.gSortie; g.clear();
    if (this.def.sortie === 'patron') return;
    const x = this.sortieX, sol = SOL_Y;
    // verrouillée tant que le boss tient : elle bat en rouge au lieu de vert
    const bloquee = this.bossVivant;
    const pulse = bloquee ? 0 : 0.55 + 0.45 * Math.sin(this.time.now / 260);

    if (this.def.sortie === 'echelle'){
      g.fillStyle(0x0a0d18, 0.9); g.fillRect(x - 30, sol - 210, 60, 210);
      g.lineStyle(5, 0x8f9ad0, 1);
      g.beginPath(); g.moveTo(x - 14, sol); g.lineTo(x - 14, sol - 200); g.strokePath();
      g.beginPath(); g.moveTo(x + 14, sol); g.lineTo(x + 14, sol - 200); g.strokePath();
      g.lineStyle(4, 0xb7c0ee, 1);
      for (let y = sol - 12; y > sol - 200; y -= 22){
        g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x + 14, y); g.strokePath();
      }
      g.fillStyle(0x4dd6c1, 0.3 + 0.3*pulse); g.fillTriangle(x, sol - 216, x - 13, sol - 200, x + 13, sol - 200);
    } else
    if (this.def.sortie === 'porte'){
      // l'entrée de la tour : un bloc sombre percé d'une porte éclairée
      g.fillStyle(0x120f22, 1); g.fillRect(x - 90, sol - 300, 180, 300);
      g.fillStyle(0x1d1836, 1); g.fillRect(x - 90, sol - 300, 180, 8);
      for (let fy = sol - 280; fy < sol - 120; fy += 30){
        for (let fx = x - 74; fx < x + 62; fx += 34){
          if (Math.abs(Math.sin(fx*0.21 + fy*0.37)) < 0.5) continue;
          g.fillStyle(0xffd98a, 0.6); g.fillRect(fx, fy, 14, 14);
        }
      }
      g.fillStyle(0xffb347, 0.16 + 0.1*pulse); g.fillRect(x - 46, sol - 116, 92, 116);
      g.fillStyle(0x090c16, 1); g.fillRect(x - 34, sol - 96, 68, 96);
      g.fillStyle(0xffd98a, 0.35 + 0.35*pulse); g.fillRect(x - 34, sol - 96, 68, 6);
      g.lineStyle(3, COUL.ceinture, 0.8); g.strokeRect(x - 34, sol - 96, 68, 96);
    } else if (this.def.sortie === 'arche'){
      // arche de pierre : la sortie des niveaux de plein air
      g.fillStyle(0x000000, 0.18); g.fillEllipse(x, sol, 96, 10);
      g.fillStyle(0x5d5040, 1); g.fillRect(x - 46, sol - 120, 18, 120);
      g.fillStyle(0x5d5040, 1); g.fillRect(x + 28, sol - 120, 18, 120);
      g.fillStyle(0x7a6a52, 1); g.fillRect(x - 42, sol - 116, 12, 116);
      g.fillStyle(0x7a6a52, 1); g.fillRect(x + 30, sol - 116, 12, 116);
      g.fillStyle(0x5d5040, 1); g.fillRect(x - 54, sol - 138, 108, 24);
      g.fillStyle(0x7a6a52, 1); g.fillRect(x - 50, sol - 134, 100, 14);
      g.fillStyle(0xffd98a, 0.10 + 0.25*pulse); g.fillRect(x - 28, sol - 114, 56, 114);
      g.fillStyle(0x4dd6c1, 0.35 + 0.5*pulse);
      g.fillTriangle(x, sol - 156, x - 13, sol - 141, x + 13, sol - 141);
    } else {
      g.fillStyle(0x0d1120, 1);  g.fillRect(x - 44, sol - 132, 88, 132);
    g.fillStyle(0x2a3152, 1);  g.fillRect(x - 40, sol - 126, 80, 126);
    g.fillStyle(0x141a30, 1);  g.fillRect(x - 34, sol - 118, 68, 118);
    g.lineStyle(3, 0x7f8cc4, 1); g.strokeRect(x - 40, sol - 126, 80, 126);
    g.lineStyle(2, 0x7f8cc4, 0.8);
    g.beginPath(); g.moveTo(x, sol - 118); g.lineTo(x, sol); g.strokePath();
    // flèche qui monte
      g.fillStyle(bloquee ? 0xe2584d : 0x4dd6c1, bloquee ? 0.5 : 0.35 + 0.5*pulse);
      g.fillTriangle(x, sol - 150, x - 14, sol - 134, x + 14, sol - 134);
      g.fillStyle(bloquee ? 0xe2584d : 0xffd98a, 0.25 + 0.35*pulse); g.fillRect(x - 40, sol - 138, 80, 5);
    }
    // sortie condamnée tant que le boss tient : la croix vaut pour toutes
    if (bloquee){
      g.lineStyle(5, 0xe2584d, 0.75);
      g.beginPath(); g.moveTo(x - 34, sol - 112); g.lineTo(x + 34, sol - 16); g.strokePath();
      g.beginPath(); g.moveTo(x + 34, sol - 112); g.lineTo(x - 34, sol - 16); g.strokePath();
    }
  },

  dessinerCaisses(){
    const g = this.gCaisses; g.clear();
    for (const k of this.caisses){
      const x = k.go.x, y = k.go.y, clair = k.flash > 0;
      g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y+16, 30, 6);
      g.fillStyle(clair ? 0xffffff : COUL.bois, 1);       g.fillRect(x-15, y-15, 30, 30);
      g.fillStyle(clair ? 0xffffff : COUL.boisClair, 1);  g.fillRect(x-11, y-11, 22, 22);
      g.lineStyle(3, clair ? 0xffffff : COUL.boisOmbre, 1);
      g.beginPath(); g.moveTo(x-11, y-11); g.lineTo(x+11, y+11); g.strokePath();
      g.beginPath(); g.moveTo(x+11, y-11); g.lineTo(x-11, y+11); g.strokePath();
    }
  },
  dessinerObjets(){
    const g = this.gObjets; g.clear();
    for (const o of this.objets){
      const x = o.go.x, y = o.go.y + Math.sin(o.phase)*2.5;
      if (o.type === 'vie'){
        // une VIE : cœur doré à petites ailes, halo appuyé — il ne doit
        // pas se confondre avec le cœur de soin rouge
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
      } else {
        const a = ARMES[o.type];
        g.fillStyle(a.couleur, 0.2); g.fillCircle(x, y, 16);
        g.lineStyle(5, a.couleur, 1); g.strokeCircle(x, y, 8);
        g.lineStyle(2, a.clair, 1);   g.strokeCircle(x, y, 8);
        g.fillStyle(0xffffff, 0.9);   g.fillCircle(x, y - 8, 2.6);
      }
    }
  },
  dessinerMonstres(){
    const g = this.gMonstres; g.clear();
    for (const m of this.monstres){
      const s = m.def.silhouette;
      if (s === 'drone') this.dessinerDrone(g, m);
      else if (s === 'gardien') this.dessinerGardien(g, m);
      else if (s === 'tourelle') this.dessinerTourelle(g, m);
      else this.dessinerBrute(g, m);
      if (m.pv < m.pvMax){
        const l = m.def.boss ? m.def.taille[0]*0.6 : 13;
        const x = m.go.x, y = m.go.y - m.def.taille[1]/2 - 12;
        g.fillStyle(0x2a3355, 1); g.fillRect(x-l, y, l*2, 4);
        g.fillStyle(m.def.boss ? 0xff5e5e : 0xe2584d, 1); g.fillRect(x-l, y, l*2 * (m.pv/m.pvMax), 4);
      }
    }
  },
  dessinerBrute(g, m){
    const gros = !!m.def.gros;
    const e = m.def.taille[0] / 26;   // l'échelle découle de la taille déclarée
    const x = m.go.x, y = m.go.y + m.def.taille[1]/2;
    const dandine = Math.sin(m.phase) * 2;
    const eclaire = m.flash > 0 ? 0xffffff : (m.blinde > 0 ? COUL.blinde : null);
    const corps = eclaire || m.def.couleur || (gros ? COUL.colosse : COUL.baveux);
    const ombre = eclaire || m.def.ombre   || (gros ? COUL.colosseOmbre : COUL.baveuxOmbre);
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y+1, 26*e, 6*e);
    g.fillStyle(ombre, 1);
    g.fillEllipse(x-6*e, y-3*e, 8*e, 8*e); g.fillEllipse(x+6*e, y-3*e, 8*e, 8*e);
    g.fillStyle(corps, 1);
    g.fillEllipse(x, y-15*e+dandine, 26*e, 26*e);
    g.fillTriangle(x-11*e, y-22*e+dandine, x-5*e, y-34*e+dandine, x-2*e, y-21*e+dandine);
    g.fillTriangle(x+11*e, y-22*e+dandine, x+5*e, y-34*e+dandine, x+2*e, y-21*e+dandine);
    const vers = Math.sign(this.joueur.x - x) || 1;
    g.fillStyle(m.def.boss ? 0xffd166 : gros ? COUL.colosseOeil : COUL.baveuxOeil, 1);
    g.fillCircle(x + vers*3 - 4*e, y-17*e+dandine, 3*e);
    g.fillCircle(x + vers*3 + 4*e, y-17*e+dandine, 3*e);
    g.fillStyle(0x1a0f22, 1);
    g.fillCircle(x + vers*4 - 4*e, y-17*e+dandine, 1.4*e);
    g.fillCircle(x + vers*4 + 4*e, y-17*e+dandine, 1.4*e);
  },
  dessinerDrone(g, m){
    const x = m.go.x, y = m.go.y;
    const flotte = Math.sin(m.phase) * 2;
    const eclaire = m.flash > 0 ? 0xffffff : (m.blinde > 0 ? COUL.blinde : null);
    g.fillStyle(0x000000, 0.18); g.fillEllipse(x, SOL_Y - 3, 26, 5);
    g.fillStyle(eclaire || COUL.droneOmbre, 1);
    g.fillRoundedRect(x-15, y-4+flotte, 30, 9, 4);
    g.fillStyle(eclaire || COUL.drone, 1);
    g.fillRoundedRect(x-13, y-13+flotte, 26, 20, 7);
    const vers = Math.sign(this.joueur.x - x) || 1;
    g.fillStyle(0x11142a, 1); g.fillRoundedRect(x-9, y-9+flotte, 18, 7, 3);
    g.fillStyle(COUL.droneOeil, 1); g.fillRect(x - 3 + vers*3, y-8+flotte, 7, 3);
    const bat = Math.sin(m.phase * 6) * 5;
    g.lineStyle(2, eclaire || COUL.droneOmbre, 0.9);
    g.beginPath(); g.moveTo(x-16-bat, y-15+flotte); g.lineTo(x-6+bat, y-15+flotte); g.strokePath();
    g.beginPath(); g.moveTo(x+6-bat, y-15+flotte); g.lineTo(x+16+bat, y-15+flotte); g.strokePath();
  },
  dessinerGardien(g, m){
    const e = m.def.taille[0] / 28;
    const x = m.go.x, y = m.go.y + m.def.taille[1]/2;
    const eclaire = m.flash > 0 ? 0xffffff : (m.blinde > 0 ? COUL.blinde : null);
    // quand il se ramasse avant de bondir, il s'accroupit et clignote :
    // c'est le signal qu'il faut sauter ou reculer
    const p = m.prepare > 0 ? 1 - m.prepare / m.def.charge.preparation : 0;
    const tasse = m.prepare > 0 ? (7 * (1 - Math.abs(p - 0.5) * 2) + 5) * e : 0;
    const alerte = m.prepare > 0 && Math.floor(m.prepare * 14) % 2 === 0;
    const corps = eclaire || (alerte ? 0xffe9b0 : (m.def.couleur || COUL.gardien));
    const dandine = Math.sin(m.phase) * 1.5;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y+1, 26*e, 6*e);
    g.fillStyle(eclaire || m.def.ombre || COUL.gardienOmbre, 1);
    g.fillRect(x-11*e, y-9*e+tasse, 8*e, 9*e); g.fillRect(x+3*e, y-9*e+tasse, 8*e, 9*e);
    g.fillStyle(corps, 1);
    g.fillRoundedRect(x-12*e, y-32*e+tasse+dandine, 24*e, 25*e, 5);
    g.fillStyle(eclaire || COUL.gardienOmbre, 1);
    g.fillRect(x-14*e, y-30*e+tasse+dandine, 28*e, 5*e);
    // casque à visière
    const vers = Math.sign(this.joueur.x - x) || 1;
    g.fillStyle(corps, 1); g.fillRoundedRect(x-9*e, y-45*e+tasse+dandine, 18*e, 14*e, 5);
    g.fillStyle(0x0d1120, 1); g.fillRect(x-8*e, y-40*e+tasse+dandine, 16*e, 6*e);
    g.fillStyle(COUL.gardienVisiere, alerte ? 1 : 0.85);
    g.fillRect(x - 5*e + vers*3, y-39*e+tasse+dandine, 8*e, 4*e);
    // matraque
    g.lineStyle(4*e, eclaire || 0x1d2340, 1);
    g.beginPath(); g.moveTo(x + vers*10*e, y-24*e+tasse+dandine);
    g.lineTo(x + vers*(18 + (m.prepare > 0 ? -6 : 0))*e, y-14*e+tasse+dandine); g.strokePath();
  },
  dessinerTourelle(g, m){
    const e = m.def.taille[0] / 30;
    const x = m.go.x, y = m.go.y + m.def.taille[1]/2;
    const eclaire = m.flash > 0 ? 0xffffff : (m.blinde > 0 ? COUL.blinde : null);
    const c = m.def.canon;
    const charge = m.vise > 0 ? 1 - m.vise / c.visee : 0;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y+1, 30*e, 6*e);
    g.fillStyle(eclaire || m.def.ombre || COUL.tourelleOmbre, 1); g.fillRect(x-15*e, y-10*e, 30*e, 10*e);
    g.fillStyle(eclaire || m.def.couleur || COUL.tourelle, 1); g.fillRoundedRect(x-12*e, y-26*e, 24*e, 18*e, 5);
    // le canon suit le joueur : on voit qu'on est visé avant de prendre le tir
    const dx = this.joueur.x - x, dy = (this.joueur.y - 10) - (y - 20*e);
    const ang = Math.atan2(dy, dx);
    const lx = x + Math.cos(ang)*20*e, ly = (y-20*e) + Math.sin(ang)*20*e;
    g.lineStyle(7*e, eclaire || m.def.ombre || COUL.tourelleOmbre, 1);
    g.beginPath(); g.moveTo(x, y-20*e); g.lineTo(lx, ly); g.strokePath();
    if (m.vise > 0){
      g.fillStyle(COUL.tourelleOeil, 0.25 + 0.5*charge); g.fillCircle(lx, ly, 4 + charge*7);
      g.lineStyle(1.5, COUL.tourelleOeil, 0.25 + 0.45*charge);
      g.beginPath(); g.moveTo(lx, ly);
      g.lineTo(lx + Math.cos(ang)*260, ly + Math.sin(ang)*260); g.strokePath();
    }
    g.fillStyle(COUL.tourelleOeil, m.vise > 0 ? 1 : 0.55); g.fillCircle(x, y-20*e, 3.5*e);
  },

  dessinerPerso(b){
    const g = this.perso; g.clear();
    const auSol = b.blocked.down || b.touching.down;
    const t = this.phase;
    const marche = Math.abs(b.velocity.x) > 20;
    let pieds, mains, inclinaison = -0.03;
    let etB = 1, etJ = 1;   // étirement élastique du bras et de la jambe qui frappent
    const allure = Math.min(1, Math.abs(b.velocity.x) / CFG.vitesseCourse);
    const rampe = this.accroupi && marche;
    let tasse = this.accroupi ? (rampe ? 13 : 9) : 0;
    // le corps s'enfonce au milieu de l'appui et se déplie à la poussée :
    // c'est ce rebond, plus que les jambes, qui donne la course
    if (!this.accroupi && auSol && marche) tasse += Math.abs(Math.sin(t)) * allure * 2.6;

    if (this.attaque){
      const c = COUPS[this.attaque.type];
      const p = Phaser.Math.Clamp(this.attaque.t / c.duree, 0, 1);
      const ext = Math.sin(Math.PI * Math.min(1, p * 1.2));
      const ela = this.attaque.elastique ? CFG.porteeElastique : 1;
      if (this.attaque.type === 'poing'){
        etB = ela;
        mains = [[-6 - ext*3, EPAULE + 9], [(4 + ext*22) * ela, EPAULE + 2 - ext*3]];
        pieds = [[-9 - ext*2, 0], [7 + ext*2, 0]];
        inclinaison = -0.05 - ext*0.06;
      } else if (this.attaque.type === 'pied'){
        mains = [[-10 - ext*5, EPAULE + 2], [2 - ext*4, EPAULE + 11]];
        etJ = ela;
        pieds = [[-6, 0], [(6 + ext*26) * ela, -6 - ext*14]];
        inclinaison = 0.04 + ext*0.12;
      } else if (this.attaque.type === 'crochet'){
        // le bras ne peut pas dépasser le sommet du crâne, sa longueur
        // l'en empêche : c'est le corps qui se soulève avec le coup
        etB = ela;
        mains = [[-7 + ext*2, EPAULE + 12], [5 + ext*3, EPAULE - 4 - ext*22*ela]];
        pieds = [[-8, 0], [7, -ext*3]];
        inclinaison = 0.02 - ext*0.10;
        tasse -= ext * 4;
      } else if (c.faisceau || c.tir || c.jet){
        mains = [[-8 + ext*2, EPAULE + 8], [11 + ext*12, EPAULE + 6]];
        pieds = [[-9, 0], [8, 0]];
        inclinaison = -0.04 - ext*0.03;
      } else {
        const balai = -1 + 2*p;
        mains = [[-12*balai, EPAULE + 4], [12*balai, EPAULE + 6]];
        etJ = ela;
        pieds = [[-4, 0], [balai*30*ela, -14 - Math.sin(Math.PI*p)*8]];
        inclinaison = -0.10 + p*0.20;
      }
    } else if (this.charge){
      // le coup s'arme : membre replié, tremblement quand l'élastique est prêt
      const k = Math.min(1, this.charge.t / CFG.seuilElastique);
      const trem = this.charge.pret ? Math.sin(this.time.now / 30) * 1.2 : 0;
      if (this.charge.action === 'pied'){
        mains = [[-9, EPAULE + 4], [6, EPAULE + 10]];
        pieds = [[-7, 0], [-1 - k*4 + trem, -6 - k*4]];
        inclinaison = -0.08;
      } else if (this.charge.action === 'retourne'){
        mains = [[-10 - k*3 + trem, EPAULE + 6], [8, EPAULE + 8]];
        pieds = [[-6, 0], [5, 0]];
        inclinaison = -0.12 - k*0.06;
      } else {
        mains = [[-8, EPAULE + 8], [-2 - k*5 + trem, EPAULE + 4]];
        pieds = [[-9, 0], [7, 0]];
        inclinaison = -0.06 - k*0.04;
      }
    } else if (!auSol){
      pieds = b.velocity.y < 0 ? [[-7,-3],[7,-9]] : [[-8,-7],[9,-1]];
      mains = b.velocity.y < 0 ? [[-6,EPAULE+7],[8,EPAULE-9]] : [[-9,EPAULE-5],[8,EPAULE+5]];
    } else if (rampe){
      pieds = []; mains = [];
      for (const dec of [Math.PI, 0]){
        const p = t * 2.2 + dec;
        pieds.push([-11 + Math.cos(p)*5, 0]);
        mains.push([2 + Math.cos(p)*9, EPAULE + 20 - Math.max(0, Math.sin(p))*3]);
      }
      // même correction de signe que la course : en rampant on bascule
      // vers l'avant, tête vers le sol, pas en arrière
      inclinaison = 0.30;
    } else if (this.accroupi){
      pieds = [[-10, 0], [9, 0]];
      mains = [[-8, EPAULE + 15], [9, EPAULE + 14]];
      inclinaison = -0.10;
    } else if (marche){
      // appui, passage, poussée. Le pied colle au sol tant qu'il pousse,
      // puis se lève d'un coup — d'où l'exposant sur la levée.
      const foulee = 8 + allure * 8;
      const genou  = 5 + allure * 16;
      const bras   = 5 + allure * 8;
      // le cycle des pieds recule avec l'allure : le pied se pose à peine
      // devant les hanches et pousse loin derrière. Centré, il se posait
      // 16 px devant — jambes en avant du corps, l'air de glisser.
      const recul = allure * 6;
      pieds = []; mains = [];
      for (const dec of [Math.PI, 0]){
        const p = t + dec;
        const s = Math.sin(p);
        const leve = Math.max(0, s);
        pieds.push([-Math.cos(p)*foulee - recul, -Math.pow(leve, 0.62) * genou]);
        // bras en opposition, la main passe devant la poitrine à la montée
        mains.push([Math.cos(p)*bras + allure*2,
                    EPAULE + 12 - Math.max(0, s)*(2 + allure*6) - allure*2]);
      }
      // rotation positive = tête vers l'avant (repère écran, y vers le
      // bas) : le buste se penche DANS la course. L'ancien signe négatif
      // le couchait en arrière, jambes devant.
      inclinaison = 0.03 + allure*0.14;
    } else {
      const souffle = Math.sin(this.time.now / 420) * 1.2;
      pieds = [[-6, 0], [6, 0]];
      mains = [[-7, EPAULE + 11 + souffle], [8, EPAULE + 9 + souffle]];
    }

    const EP = EPAULE + tasse, HA = HANCHE + tasse, TE = TETE + tasse;
    const my = i => mains[i][1] + tasse;

    if (auSol){ g.fillStyle(0x000000, 0.28); g.fillEllipse(0, 1, 28, 7); }

    this.membre(g, -1, EP, mains[0][0], my(0), 8, 8, 1, COUL.giOmbre, COUL.peauOmbre, 7, 5);
    this.membre(g, -1, HA, pieds[0][0], pieds[0][1], 9.5, 9.5, -1, COUL.giOmbre, COUL.giOmbre, 8.5, 7);
    g.fillStyle(0x171d33, 1); g.fillEllipse(pieds[0][0]+1, pieds[0][1]-1.5, 10, 6);

    g.fillStyle(COUL.gi, 1);
    g.fillPoints([{x:-7,y:EP},{x:7,y:EP},{x:6,y:HA+1},{x:-6,y:HA+1}], true);
    g.lineStyle(2.4, COUL.col, 1);
    g.beginPath(); g.moveTo(-3, EP-1); g.lineTo(2, EP+8); g.strokePath();
    g.beginPath(); g.moveTo(5, EP-1); g.lineTo(2, EP+8); g.strokePath();
    g.fillStyle(COUL.ceinture, 1);
    g.fillRect(-7, HA-3, 14, 4);
    g.fillRect(-7.5, HA-3, 3, 8);

    this.membre(g, 1, HA, pieds[1][0], pieds[1][1], 9.5*etJ, 9.5*etJ, -1, COUL.gi, COUL.gi, 9, 7.5);
    g.fillStyle(COUL.botte, 1); g.fillEllipse(pieds[1][0]+1, pieds[1][1]-1.5, 11, 6.4);
    this.membre(g, 1, EP, mains[1][0], my(1), 8*etB, 8*etB, 1, COUL.gi, COUL.peau, 7.5, 5.5);
    if (this.arme){
      const a = ARMES[this.arme];
      g.fillStyle(a.couleur, 1); g.fillCircle(mains[1][0], my(1), 4.4);
      g.fillStyle(a.clair, 1);   g.fillCircle(mains[1][0], my(1), 2.2);
    } else {
      g.fillStyle(COUL.ceinture, 1); g.fillCircle(mains[1][0], my(1), 2.6);
    }

    if (this.charge){
      const k = Math.min(1, this.charge.t / CFG.seuilElastique);
      const cx = this.charge.action === 'pied' ? pieds[1][0] : mains[1][0];
      const cy = this.charge.action === 'pied' ? pieds[1][1] : my(1);
      g.fillStyle(this.charge.pret ? 0xffd166 : 0x4dd6c1, 0.28 + 0.25*k);
      g.fillCircle(cx, cy, 4 + k*5);
      if (this.charge.pret){ g.fillStyle(0xffffff, 0.85); g.fillCircle(cx, cy, 2); }
    }

    const hx = 1, hy = TE;
    g.fillStyle(COUL.cheveux, 1);
    const pointes = [[-7,3],[-9,-3],[-13,-7],[-7,-6],[-10,-13],[-3,-8],[0,-15],[3,-7],[9,-11],[6,-3],[10,-4],[7,1]];
    g.fillPoints(pointes.map(p => ({ x: hx + p[0], y: hy + p[1] })), true);
    g.fillStyle(COUL.peau, 1); g.fillCircle(hx+1, hy, 5.6);
    g.fillStyle(COUL.cheveux, 1);
    g.fillEllipse(hx+0.5, hy-4.6, 11.6, 5);
    g.fillRect(hx+2.5, hy-1.6, 2, 2.6);

    g.setPosition(this.joueur.x, this.joueur.y + PIEDS);
    g.setRotation(this.sens * inclinaison);
    g.setScale(this.sens * (1 + this.squash*0.22), 1 - this.squash*0.22);
    g.setAlpha(this.invuln > 0 && Math.floor(this.invuln*20) % 2 === 0 ? 0.35 : 1);
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
});
