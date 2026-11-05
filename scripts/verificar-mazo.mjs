// Verifica los datos de los que depende la mesa, antes de construir.
//  - 22 arcanos, sin repetir, numerados 0 a 21 en orden Rider.
//  - Cada arcano tiene su carta recortada en src/assets/naipes.
//  - Cada arcano publicado (orden != null) tiene al menos una frase y su capitulo coincide.
//  - Ninguna frase vacia, ni con marcas del corpus.
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(raiz, f), 'utf8'));
const arcanos = leer('src/data/arcanos.json');
const frases = leer('src/data/frases.json');
const fallos = [];
const falla = (m) => fallos.push(m);

if (arcanos.length !== 22) falla(`Se esperaban 22 arcanos y hay ${arcanos.length}`);
const slugs = new Set();
arcanos.forEach((a, i) => {
  if (Number(a.numero) !== i) falla(`${a.slug}: esta en la posicion ${i} pero su numero es ${a.numero}`);
  if (slugs.has(a.slug)) falla(`${a.slug}: repetido`);
  slugs.add(a.slug);
  if (!fs.existsSync(path.join(raiz, 'src/assets/naipes', `${a.slug}.webp`))) falla(`${a.slug}: falta src/assets/naipes/${a.slug}.webp`);
  if (a.orden !== null) {
    const f = frases[a.slug];
    if (!f || !f.frases.length) falla(`${a.slug}: capitulo publicado sin frases (corre scripts/frases-desde-corpus.mjs)`);
    else if (f.cap !== a.orden) falla(`${a.slug}: el corpus dice capitulo ${f.cap} y arcanos.json dice ${a.orden}`);
  }
});
const ordenes = arcanos.filter((a) => a.orden !== null).map((a) => a.orden).sort((x, y) => x - y);
ordenes.forEach((o, i) => { if (o !== i) falla(`Los capitulos publicados no son correlativos: falta el ${i}`); });
for (const [slug, v] of Object.entries(frases)) {
  v.frases.forEach((f, i) => {
    if (!f.t || !f.t.trim()) falla(`${slug} #${i}: frase vacia`);
    if (/[⚠`]/.test(f.t)) falla(`${slug} #${i}: la frase trae marcas del corpus`);
  });
}

if (fallos.length) {
  console.error(fallos.map((m) => '  ✗ ' + m).join('\n'));
  process.exit(1);
}
const total = Object.values(frases).reduce((n, v) => n + v.frases.length, 0);
console.log(`Mazo en orden: 22 arcanos, ${ordenes.length} capitulos publicados, ${total} frases candidatas.`);
