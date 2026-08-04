// ─────────────────────────────────────────────────────────────
// SON
// Tout est synthétisé à la volée : aucun fichier à charger, donc le
// jeu tient toujours en un seul fichier. iOS n'autorise l'audio qu'après
// un geste — d'où le démarrage au moment où on lance la partie.
// ─────────────────────────────────────────────────────────────
const SON = {
  ctx:null, sortie:null, actif:true,
  demarrer(){
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.sortie = this.ctx.createGain();
    this.sortie.gain.value = 0.26;
    this.sortie.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  note(forme, f0, f1, duree, vol, delai){
    if (!this.ctx || !this.actif) return;
    const t = this.ctx.currentTime + (delai || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = forme;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duree);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g); g.connect(this.sortie);
    o.start(t); o.stop(t + duree + 0.03);
  },
  souffle(duree, vol, freq, q){
    if (!this.ctx || !this.actif) return;
    const t = this.ctx.currentTime;
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * duree));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random()*2 - 1) * (1 - i/n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.sortie);
    s.start(t);
  },
  jouer(nom){
    if (!this.ctx || !this.actif) return;
    switch (nom){
      case 'poing':    this.souffle(0.09, 0.45, 900, 1.2); this.note('sine', 180, 90, 0.09, 0.22); break;
      case 'pied':     this.souffle(0.16, 0.5, 520, 1.0);  this.note('sine', 150, 60, 0.16, 0.26); break;
      case 'retourne': this.souffle(0.28, 0.4, 380, 0.8);  this.note('triangle', 230, 70, 0.3, 0.24); break;
      case 'laser':    this.note('sawtooth', 1500, 190, 0.3, 0.3); this.note('square', 720, 95, 0.3, 0.14); break;
      case 'pistolet': this.souffle(0.07, 0.55, 1800, 1.4); this.note('square', 620, 160, 0.08, 0.22); break;
      case 'fusil':    this.souffle(0.22, 0.7, 700, 0.6);   this.note('sawtooth', 260, 70, 0.22, 0.3); break;
      case 'touche':   this.souffle(0.11, 0.5, 1500, 0.9);  this.note('square', 330, 130, 0.09, 0.2); break;
      case 'blinde':   this.note('square', 1200, 900, 0.11, 0.22); this.souffle(0.09, 0.3, 2600, 2); break;
      case 'vaincu':   this.note('square', 420, 80, 0.34, 0.24); this.souffle(0.3, 0.32, 700, 0.6); break;
      case 'saut':     this.note('sine', 320, 640, 0.12, 0.2); break;
      case 'saut2':    this.note('triangle', 520, 880, 0.14, 0.2); this.souffle(0.1, 0.2, 1400, 1); break;
      case 'caisse':   this.souffle(0.2, 0.55, 300, 0.5); this.note('triangle', 150, 60, 0.18, 0.2); break;
      case 'coeur':    this.note('sine', 660, 660, 0.1, 0.24); this.note('sine', 990, 990, 0.14, 0.24, 0.09); break;
      case 'arme':     [440,660,880,1320].forEach((f,i) => this.note('square', f, f, 0.1, 0.16, i*0.06)); break;
      case 'degat':    this.note('sawtooth', 300, 70, 0.3, 0.28); this.souffle(0.2, 0.32, 400, 0.7); break;
      case 'mort':     [440,330,262,196].forEach((f,i) => this.note('triangle', f, f, 0.26, 0.22, i*0.16)); break;
      case 'gagne':    [523,659,784,1047].forEach((f,i) => this.note('square', f, f, 0.2, 0.2, i*0.11)); break;
      case 'vide':     this.note('square', 160, 120, 0.06, 0.12); break;
      case 'visee':    this.note('square', 900, 1500, 0.5, 0.09); break;
      case 'tirEnnemi':this.note('sawtooth', 500, 200, 0.14, 0.18); break;
      case 'charge':   this.note('sawtooth', 120, 300, 0.4, 0.14); break;
      case 'ascenseur':[392,523,659].forEach((f,i) => this.note('sine', f, f, 0.5, 0.22, i*0.13));
                       this.souffle(0.6, 0.12, 200, 0.5); break;
      case 'final':    [523,659,784,1047,1319].forEach((f,i) => this.note('square', f, f, 0.28, 0.22, i*0.16)); break;
    }
  },
};
