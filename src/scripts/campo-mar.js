// Campo escalar del mar cenital.
//
// Es una suma de senoides cuyas frecuencias temporales (`n`) son todas
// multiplos enteros de una misma base. Esa es la unica condicion que hace
// falta para que el bucle sea exacto: a los T segundos cada termino ha dado
// un numero entero de vueltas y el campo completo vuelve a su estado inicial,
// sin corte ni crossfade.

/** @typedef {{ a: number, cx: number, cy: number, n: number, fase: number }} Capa */

/** Olas principales. cx/cy = ciclos a lo ancho/alto; a = amplitud relativa.
 *  Las dos primeras hacen las masas grandes; las dos ultimas, el rizo fino
 *  que da lectura de agua sin romper esas masas. @type {Capa[]} */
export const OLAS = [
  { a: 1.0, cx: 0.55, cy: 0.4, n: 1, fase: 0.0 },
  { a: 0.7, cx: -0.8, cy: 0.65, n: 1, fase: 2.1 },
  { a: 0.42, cx: 1.05, cy: -1.15, n: 2, fase: 4.2 },
  { a: 0.2, cx: -1.45, cy: -0.85, n: 2, fase: 0.8 },
  { a: 0.13, cx: 2.4, cy: 2.1, n: 3, fase: 5.5 },
  { a: 0.09, cx: -3.1, cy: 2.7, n: 3, fase: 1.9 },
];

/** Deforman el punto de muestreo: rompen la regularidad y dan lectura de
 *  fluido. Subirlas mucho convierte el mar en papel marmolado. @type {Capa[]} */
export const DEFORMA = [
  { a: 0.13, cx: 0.45, cy: -0.55, n: 1, fase: 1.2 },
  { a: 0.08, cx: -0.7, cy: 0.5, n: 2, fase: 3.7 },
];

/** Divisor de contraste: cuanto menor, mas superficie satura a negro y blanco. */
const CONTRASTE = 0.66;

const TAU = Math.PI * 2;
const AMPLITUD_TOTAL = OLAS.reduce((s, o) => s + o.a, 0);

// Tabla de senos con interpolacion lineal. Son 7 evaluaciones por pixel y
// Math.sin domina el coste del frame; con 4096 entradas el error maximo es
// ~3e-7, tres ordenes por debajo de la cuantizacion a 8 bits del gris.
const TAM = 4096;
const MASCARA = TAM - 1;
const ESCALA = TAM / TAU;
const TABLA = new Float32Array(TAM + 1);
for (let i = 0; i <= TAM; i++) TABLA[i] = Math.sin((i * TAU) / TAM);

// Un cuarto de vuelta de desfase convierte el seno en coseno.
const CUARTO = TAM / 4;

/** seno por tabla. @param {number} a radianes */
function seno(a) {
  const x = a * ESCALA;
  const i = Math.floor(x);
  const j = i & MASCARA;
  return TABLA[j] + (TABLA[j + 1] - TABLA[j]) * (x - i);
}

/** coseno por tabla. @param {number} a radianes */
function coseno(a) {
  const x = a * ESCALA + CUARTO;
  const i = Math.floor(x);
  const j = i & MASCARA;
  return TABLA[j] + (TABLA[j + 1] - TABLA[j]) * (x - i);
}

/**
 * Pinta un frame del campo sobre un buffer RGBA en escala de grises.
 * @param {Uint8ClampedArray} datos  buffer RGBA de ancho*alto*4
 * @param {number} ancho
 * @param {number} alto
 * @param {number} aspecto  vw/vh, para que las olas no salgan estiradas
 * @param {number} faseT    fase temporal en radianes (omega * t)
 */
export function pintarCampo(datos, ancho, alto, aspecto, faseT) {
  // Todo lo que solo depende del tiempo sale del bucle de pixeles.
  const nOlas = OLAS.length;
  const nDef = DEFORMA.length;
  const olaA = new Float64Array(nOlas);
  const olaKx = new Float64Array(nOlas);
  const olaKy = new Float64Array(nOlas);
  const olaFase = new Float64Array(nOlas);
  for (let i = 0; i < nOlas; i++) {
    olaA[i] = OLAS[i].a;
    olaKx[i] = OLAS[i].cx * TAU;
    olaKy[i] = OLAS[i].cy * TAU;
    olaFase[i] = OLAS[i].n * faseT + OLAS[i].fase;
  }
  const defA = new Float64Array(nDef);
  const defKx = new Float64Array(nDef);
  const defKy = new Float64Array(nDef);
  const defFase = new Float64Array(nDef);
  for (let i = 0; i < nDef; i++) {
    defA[i] = DEFORMA[i].a;
    defKx[i] = DEFORMA[i].cx * TAU;
    defKy[i] = DEFORMA[i].cy * TAU;
    defFase[i] = DEFORMA[i].n * faseT + DEFORMA[i].fase;
  }

  const invAncho = aspecto / ancho;
  let p = 0;
  for (let y = 0; y < alto; y++) {
    const v = y / alto;
    for (let x = 0; x < ancho; x++) {
      const u = x * invAncho;

      let dx = 0;
      let dy = 0;
      for (let i = 0; i < nDef; i++) {
        dx += defA[i] * seno(defKx[i] * u + defKy[i] * v + defFase[i]);
        dy += defA[i] * coseno(defKx[i] * v - defKy[i] * u + defFase[i]);
      }

      const uu = u + dx;
      const vv = v + dy;

      let acum = 0;
      for (let i = 0; i < nOlas; i++) {
        acum += olaA[i] * seno(olaKx[i] * uu + olaKy[i] * vv + olaFase[i]);
      }

      // La suma de senoides se reparte como una campana: sin expandir, todo
      // quedaria en grises medios. Se divide por CONTRASTE para que las colas
      // lleguen a los topes, se recorta, y el smoothstep suaviza la entrada
      // en esos topes para que el negro y el blanco no aparezcan de golpe.
      let e = acum / AMPLITUD_TOTAL / CONTRASTE;
      e = e < -1 ? -1 : e > 1 ? 1 : e;
      let g = e * 0.5 + 0.5;
      g = g * g * (3 - 2 * g);

      const tono = (6 + g * 243) | 0;
      datos[p] = tono;
      datos[p + 1] = tono;
      datos[p + 2] = tono;
      datos[p + 3] = 255;
      p += 4;
    }
  }
}
