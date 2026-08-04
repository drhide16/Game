// Assemble combat/src/ en un seul combat/index.html.
//
//   node combat/outils/build.mjs
//
// Pourquoi un fichier unique en sortie : la page doit marcher ouverte en
// file:// (fichier téléchargé, écran d'accueil iOS) où les modules ES sont
// interdits, et le cache-buster ne sait comparer qu'une seule version à la
// fois — six fichiers pourraient se retrouver en cache à des versions
// différentes. On édite donc src/, jamais index.html.
//
// L'ordre est celui des dépendances au chargement :
// rendu.js greffe le dessin sur la classe déclarée par moteur.js, et
// partie.js appelle afficherRecord() qui lit NIVEAUX.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const src = join(ici, '..', 'src');

const ORDRE = [
  'version.js',    // numéro de version + rechargement si le serveur a plus récent
  'reglages.js',   // CFG, COUPS, ARMES, MONSTRES, couleurs : l'équilibrage
  'niveaux.js',    // les étages, du trottoir au toit
  'partie.js',     // graine, état porté d'un étage à l'autre, record
  'son.js',        // tout l'audio, synthétisé
  'entrees.js',    // joystick, boutons, clavier, anti-zoom
  'moteur.js',     // la scène : physique, combat, monstres, progression
  'rendu.js',      // décors et silhouettes, greffés sur la scène
  'demarrage.js',  // écran-titre et lancement
];

const jeu = ORDRE
  .map(f => `// ═══════════════ src/${f} ═══════════════\n`
          + readFileSync(join(src, f), 'utf8').trim())
  .join('\n\n');

const gabarit = readFileSync(join(src, 'gabarit.html'), 'utf8');
const MARQUE = '// @JEU@';
if (gabarit.split(MARQUE).length !== 2)
  throw new Error('gabarit.html doit contenir exactement un ' + MARQUE);
// split/join et non replace : le jeu contient des ${...} et des $ que
// replace() interpréterait comme des motifs de substitution
const page = gabarit.split(MARQUE).join(jeu);

const m = page.match(/const VERSION = '([^']+)'/);
if (!m) throw new Error('VERSION introuvable dans la page assemblée');

const sortie = join(ici, '..', 'index.html');
writeFileSync(sortie, page);
console.log(`index.html assemblé : ${page.length} caractères, version ${m[1]}`);
