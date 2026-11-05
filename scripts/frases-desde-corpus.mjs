// Genera src/data/frases.json desde ../Corpus/Pulidas/NN-slug.md.
// Cada archivo trae las frases pulidas de una carta: el texto que se muestra
// (traduccion del habla a escritura, sin inventar nada) y, debajo, la "Cita:"
// textual de la transcripcion. Aqui solo se toma el texto y el minuto; la cita
// se queda en el corpus y la comprueba _transcribir/verificar-pulidas.py.
import fs from 'node:fs';
import path from 'node:path';

const corpus = path.resolve('..', 'Corpus', 'Pulidas');
const salida = path.resolve('src/data/frases.json');
const out = {};
let total = 0;

for (const f of fs.readdirSync(corpus).sort()) {
  const m = f.match(/^(\d\d)-([a-z]+)\.md$/);
  if (!m) continue;
  const slug = m[2];
  const texto = fs.readFileSync(path.join(corpus, f), 'utf8').replace(/\r/g, '');
  const cap = Number((texto.match(/Capítulo (\d+)/) || [])[1]);
  if (Number.isNaN(cap)) throw new Error(`${f}: no declara capitulo`);
  const lista = [];
  for (const bloque of texto.split(/^### /m).slice(1)) {
    const [cab, ...resto] = bloque.split('\n');
    const marca = cab.match(/\[([0-9:]+)\]/);
    if (!marca) throw new Error(`${f}: frase sin minuto: ${cab}`);
    const cuerpo = [];
    for (const l of resto) {
      if (l.startsWith('Cita:')) break;
      if (l.trim()) cuerpo.push(l.trim());
    }
    const t = cuerpo.join(' ');
    if (!t) throw new Error(`${f}: frase vacia: ${cab}`);
    lista.push({ t, min: marca[1] });
  }
  out[slug] = { cap, frases: lista };
  total += lista.length;
}
fs.writeFileSync(salida, JSON.stringify(out, null, 1) + '\n', { encoding: 'utf8' });
console.log(`${Object.keys(out).length} cartas, ${total} frases pulidas -> ${salida}`);
