// Comprueba las propiedades del fondo animado sin abrir un navegador:
// que el bucle cierre exacto, que no haya salto en la costura, que de verdad
// se mueva, que use todo el rango de grises y cuanto cuesta un frame.
//
//   npm run verificar:mar

import { pintarCampo } from '../src/scripts/campo-mar.js';

const W = 256, H = 144, ASP = 16 / 9, T = 24;
const OMEGA = (Math.PI * 2) / T;

const frame = (t) => {
  const d = new Uint8ClampedArray(W * H * 4);
  pintarCampo(d, W, H, ASP, OMEGA * t);
  return d;
};
const difMax = (a, b) => {
  let m = 0;
  for (let i = 0; i < a.length; i += 4) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};

const f0 = frame(0);
let fallos = 0;
const exigir = (ok, msg) => { if (!ok) { fallos++; console.log('   FALLO: ' + msg); } };

console.log('1. BUCLE EXACTO');
const d1 = difMax(f0, frame(T));
const d2 = difMax(f0, frame(T * 2));
const d3 = difMax(frame(3.7), frame(3.7 + T));
console.log('   t=0 vs t=T        diferencia maxima:', d1);
console.log('   t=0 vs t=2T       diferencia maxima:', d2);
console.log('   t=3.7 vs t=3.7+T  diferencia maxima:', d3);
exigir(d1 === 0 && d2 === 0 && d3 === 0, 'el bucle no cierra exacto');

console.log('\n2. SIN CORTE EN LA COSTURA');
const paso = 1 / 30;
const costura = difMax(frame(T - paso), f0);
const tipico = difMax(frame(8), frame(8 + paso));
console.log('   salto en el empalme (t=T-1/30 -> t=0):', costura);
console.log('   salto tipico entre frames contiguos  :', tipico);
exigir(costura <= tipico * 1.5, 'el empalme salta mas que un frame normal');

console.log('\n3. SE MUEVE DE VERDAD');
for (const div of [8, 4, 2]) {
  const d = difMax(f0, frame(T / div));
  console.log(`   t=0 vs t=T/${div}   diferencia maxima:`, d);
  exigir(d > 40, `apenas cambia a T/${div}`);
}

console.log('\n4. RANGO TONAL');
for (const t of [0, T / 3, (2 * T) / 3]) {
  const d = frame(t);
  let min = 255, max = 0, sum = 0, n = 0;
  const hist = new Array(8).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v; n++; hist[v >> 5]++;
  }
  console.log(
    `   t=${t.toFixed(1).padStart(4)}  min=${String(min).padStart(3)} max=${String(max).padStart(3)}` +
    ` medio=${String(Math.round(sum / n)).padStart(3)}  reparto=${hist.map((x) => String(Math.round((100 * x) / n)).padStart(2)).join('|')}%`
  );
  exigir(min < 40 && max > 215, 'no llega a negros o a blancos');
}

console.log('\n5. COSTE POR FRAME');
const buf = new Uint8ClampedArray(W * H * 4);
pintarCampo(buf, W, H, ASP, 0);
const N = 200, ini = performance.now();
for (let i = 0; i < N; i++) pintarCampo(buf, W, H, ASP, OMEGA * (i / 30));
const ms = (performance.now() - ini) / N;
console.log(`   buffer ${W}x${H}: ${ms.toFixed(2)}ms/frame -> ${((ms * 30) / 10).toFixed(1)}% de un nucleo a 30fps`);
exigir(ms < 8, 'un frame cuesta demasiado');

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} COMPROBACION(ES) FALLIDA(S)`);
process.exit(fallos === 0 ? 0 : 1);
