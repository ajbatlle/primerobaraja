// Genera src/data/frases.json desde ../Corpus/NN-slug.md.
// Solo toma la seccion "De la carta" (no "Rozan"), descarta los extractos
// marcados con ⚠ (no se entienden solos) y copia el texto TAL CUAL: no cambia
// ni una palabra. Son candidatas provisionales: Antonio elige despues.
import fs from 'node:fs';
import path from 'node:path';

const corpus = path.resolve('..', 'Corpus');
const salida = path.resolve('src/data/frases.json');
const out = {};
let total = 0;

for (const f of fs.readdirSync(corpus).sort()) {
  const m = f.match(/^(\d\d)-([a-z]+)\.md$/);
  if (!m || f.startsWith('00-LEEME') || f.startsWith('00-METODO')) continue;
  const cap = Number(m[1]);
  const slug = m[2];
  const texto = fs.readFileSync(path.join(corpus, f), 'utf8').replace(/\r/g, '');
  // Seccion de la carta: desde el primer "## " de contenido hasta el siguiente "## ".
  const secciones = texto.split(/^## /m).slice(1);
  const propia = secciones.find(s => /^(De |Del )/.test(s));
  if (!propia) continue;
  const lista = [];
  for (const bloque of propia.split(/^### /m).slice(1)) {
    const [cab, ...resto] = bloque.split('\n');
    if (cab.includes('⚠') || resto.some(l => l.startsWith('⚠'))) continue;
    const marca = cab.match(/\[([0-9:]+)\]/);
    if (!marca) continue;
    const cuerpo = [];
    for (const l of resto) {
      if (l.startsWith('`Suprimido')) break;
      if (l.trim()) cuerpo.push(l.trim());
    }
    const t = cuerpo.join(' ');
    if (t.length < 60 || t.length > 380) continue;
    lista.push({ t, min: marca[1] });
  }
  out[slug] = { cap, frases: lista };
  total += lista.length;
}
fs.writeFileSync(salida, JSON.stringify(out, null, 1) + '\n', { encoding: 'utf8' });
console.log(`${Object.keys(out).length} cartas, ${total} frases candidatas -> ${salida}`);
