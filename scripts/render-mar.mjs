// Renderiza frames del fondo a un PNG de contacto, para revisar el diseño
// sin abrir el navegador. Reproduce lo que hace la pagina: campo en buffer
// pequeño, estirado bilineal y grano encima.
//
//   node scripts/render-mar.mjs [salida.png]

import zlib from 'node:zlib';
import fs from 'node:fs';
import { pintarCampo } from '../src/scripts/campo-mar.js';

const T = 24;
const OMEGA = (Math.PI * 2) / T;
const BW = 256, BH = 144;          // buffer, igual que en pantalla a 1280px
const CW = 640, CH = 360;          // cada celda del contacto
const COLS = 3, FILAS = 2;
// Primer y ultimo frame son t=0 y t=T: deben salir identicos.
const TIEMPOS = [0, T / 5, (2 * T) / 5, (3 * T) / 5, (4 * T) / 5, T];

function campoGris(t) {
  const rgba = new Uint8ClampedArray(BW * BH * 4);
  pintarCampo(rgba, BW, BH, CW / CH, OMEGA * t);
  const g = new Float32Array(BW * BH);
  for (let i = 0; i < g.length; i++) g[i] = rgba[i * 4];
  return g;
}

// Mismo filtrado bilineal que aplica el navegador al estirar el canvas.
function estirar(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1.001, ((y + 0.5) * sh) / dh - 0.5);
    const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(sh - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1.001, ((x + 0.5) * sw) / dw - 0.5);
      const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(sw - 1, x0 + 1), fx = sx - x0;
      const a = src[y0 * sw + x0], b = src[y0 * sw + x1];
      const c = src[y1 * sw + x0], d = src[y1 * sw + x1];
      out[y * dw + x] = (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    }
  }
  return out;
}

function crc32(buf) {
  let c, tabla = crc32.t;
  if (!tabla) {
    tabla = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabla[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = tabla[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}

/** PNG en escala de grises, 8 bits. */
function png(gris, w, h) {
  const bruto = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    bruto[y * (w + 1)] = 0; // filtro none
    for (let x = 0; x < w; x++) bruto[y * (w + 1) + 1 + x] = gris[y * w + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(bruto, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const W = CW * COLS, H = CH * FILAS;
const lienzo = new Uint8Array(W * H);

TIEMPOS.forEach((t, i) => {
  const grande = estirar(campoGris(t), BW, BH, CW, CH);
  const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH;
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      // Grano: misma intensidad que el 8.5% de opacidad de la pagina.
      const ruido = (Math.random() - 0.5) * 255 * 0.085;
      let v = grande[y * CW + x] + ruido;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      // Linea de separacion entre celdas del contacto.
      const borde = x === 0 || y === 0;
      lienzo[(oy + y) * W + (ox + x)] = borde ? 255 : v;
    }
  }
});

const salida = process.argv[2] || 'mar-contacto.png';
fs.writeFileSync(salida, png(lienzo, W, H));
console.log(`${salida}  ${W}x${H}  frames en t = ${TIEMPOS.map((t) => t.toFixed(1)).join(', ')} s de ${T}`);
