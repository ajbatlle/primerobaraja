// La mesa de Primero Baraja.
//
// 22 cartas que viven siempre en la pantalla y se reordenan en el sitio. Cada
// escena (mesa, capitulos, carta, sobre) decide un objetivo para cada carta;
// un bucle por frame las acerca con amortiguacion exponencial (sin rebote).
// Los objetivos salen de rectangulos de la reticula (los "huecos" del HTML),
// asi que las cartas asientan siempre sobre columnas, nunca a ojo.
//
// Regla de movimiento (Antonio): nada se desvanece. Lo que no esta, esta
// aparcado fuera o recogido tras una cortina; lo que sale gira de canto.

import { amortiguar, bucle } from './movimiento.js';

const RAZON = 420 / 716; // carta Rider recortada a su rectangulo real
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const movil = () => matchMedia('(max-width: 760px)').matches;

const ROMANOS = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

// Azar con semilla para el desorden fijo de la pila (siempre el mismo).
function semilla(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function iniciar() {
  const D = JSON.parse(document.getElementById('datos').textContent);
  const raiz = document.documentElement;
  const $ = (id) => document.getElementById(id);

  // ---------- cartas ----------
  const nodos = [...document.querySelectorAll('.carta')];
  const cartas = nodos.map((nodo, i) => {
    const info = D.cartas.find((c) => c.slug === nodo.dataset.slug);
    return {
      nodo, giro: nodo.querySelector('.giro'), i, ...info,
      jx: (semilla(i) - 0.5) * 8, jy: (semilla(i + 40) - 0.5) * 6, jr: (semilla(i + 80) - 0.5) * 4.5,
      x: 0, y: 0, r: 0, s: 1, g: 0, z: 10 + i,
      tx: 0, ty: 0, tr: 0, ts: 1, tg: 0,
      sucio: true, timer: 0,
    };
  });
  const porSlug = Object.fromEntries(cartas.map((c) => [c.slug, c]));
  let mazo = cartas.map((c) => c.i); // de abajo a arriba

  // ---------- medidas de la reticula ----------
  let huecos = {};
  const base = { w: 300, h: 300 / RAZON };
  const rect = (n) => document.querySelector(`[data-hueco="${n}"]`).getBoundingClientRect();
  function ajustar(r, modo) {
    let w, h;
    if (r.width / r.height < RAZON) { w = r.width; h = w / RAZON; } else { h = r.height; w = h * RAZON; }
    const x = modo === 'izq' ? r.left : r.left + (r.width - w) / 2;
    const y = modo === 'izq' ? r.top : r.top + (r.height - h) / 2;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }
  function medir() {
    huecos = {
      pila: ajustar(rect('pila')),
      carta: ajustar(rect('carta'), 'izq'),
      lista: ajustar(rect('lista')),
      aparcada: ajustar(rect('aparcada')),
    };
    base.w = Math.max(...Object.values(huecos).map((h) => h.w));
    base.h = base.w / RAZON;
    for (const c of cartas) { c.nodo.style.width = base.w + 'px'; c.nodo.style.height = base.h + 'px'; }
  }

  // ---------- objetivos y bucle ----------
  function objetivo(c, o, espera = 0) {
    const aplicar = () => {
      if (o.x !== undefined) c.tx = o.x;
      if (o.y !== undefined) c.ty = o.y;
      if (o.r !== undefined) c.tr = o.r;
      if (o.s !== undefined) c.ts = o.s;
      if (o.g !== undefined) c.tg = o.g;
      if (o.z !== undefined) { c.z = o.z; c.nodo.style.zIndex = o.z; }
    };
    clearTimeout(c.timer);
    if (espera && !reducido) c.timer = setTimeout(aplicar, espera); else aplicar();
  }
  function encajar() { for (const c of cartas) { c.x = c.tx; c.y = c.ty; c.r = c.tr; c.s = c.ts; c.g = c.tg; c.sucio = true; } }

  const F_POS = 6.5, F_ROT = 6, F_ESC = 6, F_GIRO = 5;
  function paso(dt) {
    for (const c of cartas) {
      const x = reducido ? c.tx : amortiguar(c.x, c.tx, F_POS, dt);
      const y = reducido ? c.ty : amortiguar(c.y, c.ty, F_POS, dt);
      const r = reducido ? c.tr : amortiguar(c.r, c.tr, F_ROT, dt);
      const s = reducido ? c.ts : amortiguar(c.s, c.ts, F_ESC, dt);
      const g = reducido ? c.tg : amortiguar(c.g, c.tg, F_GIRO, dt);
      if (!c.sucio && Math.abs(x - c.x) < 0.02 && Math.abs(y - c.y) < 0.02 && Math.abs(r - c.r) < 0.01 && Math.abs(s - c.s) < 0.0002 && Math.abs(g - c.g) < 0.05) continue;
      c.x = x; c.y = y; c.r = r; c.s = s; c.g = g; c.sucio = false;
      c.nodo.style.transform = `perspective(1800px) translate3d(${(x - base.w / 2).toFixed(2)}px, ${(y - base.h / 2).toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;
      c.giro.style.transform = `rotateY(${g.toFixed(2)}deg)`;
    }
  }

  // ---------- pilas ----------
  // Pone todo el mazo en un hueco, con su desorden fijo. `cada` escalona la entrada.
  function apilar(hueco, factor = 1, opciones = {}) {
    const { jitter = 1, abanico = 0, giroPila = 0, cada = 0 } = opciones;
    const s = (hueco.w / base.w) * factor;
    mazo.forEach((ci, p) => {
      const c = cartas[ci];
      const k = p - (mazo.length - 1) / 2;
      objetivo(c, {
        x: hueco.cx + (c.jx * jitter + k * 3.2 * abanico) * s + giroPila * 0,
        y: hueco.cy - p * 0.4 + c.jy * jitter * s,
        r: c.jr * jitter + k * 0.55 * abanico + giroPila,
        s, g: 0, z: 10 + p,
      }, cada * p);
    });
  }

  // ---------- texto: revelado por cortina, al tamaño final ----------
  function revelar(el, texto) {
    const viejas = el.querySelectorAll('.pal');
    viejas.forEach((p) => { p.classList.remove('in'); p.classList.add('sale'); });
    clearTimeout(el._t);
    const espera = reducido || !viejas.length ? 0 : 360;
    el._t = setTimeout(() => {
      el.textContent = '';
      texto.split(/\s+/).filter(Boolean).forEach((w, i, arr) => {
        const p = document.createElement('span');
        p.className = 'pal';
        p.style.setProperty('--i', i);
        const s = document.createElement('span');
        s.textContent = w;
        p.appendChild(s);
        el.appendChild(p);
        if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
      });
      void el.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll('.pal').forEach((p) => p.classList.add('in'))));
    }, espera);
  }

  // ---------- la hoja de carta ----------
  const hojaCarta = { rotulo: $('carta-rotulo'), titulo: $('carta-titulo'), frase: $('carta-frase'), fuente: $('carta-fuente'), player: $('carta-player') };
  let cartaActual = null;
  let fraseActual = -1;

  function nuevaFrase(c) {
    const lista = (D.frases[c.slug] || { frases: [] }).frases;
    if (!lista.length) return null;
    let i = Math.floor(Math.random() * lista.length);
    if (lista.length > 1 && i === fraseActual) i = (i + 1 + Math.floor(Math.random() * (lista.length - 1))) % lista.length;
    fraseActual = i;
    return lista[i];
  }
  // Elige el tamaño más grande de la escala (t4 a t0) en que la frase cabe en su caja.
  const ESCALA = [['f1', 2.441, 3], ['f2', 1.953, 2], ['f3', 1.5625, 2], ['f4', 1.25, 1.5], ['f5', 1, 1]];
  function tamanoFrase(t) {
    const caja = hojaCarta.frase;
    const u = parseFloat(getComputedStyle(document.body).lineHeight) || 24;
    const rem = parseFloat(getComputedStyle(raiz).fontSize) || 16;
    const ancho = caja.clientWidth || 400;
    const alto = caja.clientHeight || 300;
    for (const [cls, r, k] of ESCALA) {
      const lineas = Math.ceil((t.length * 0.5 * r * rem * 1.04) / ancho);
      if (lineas * k * u <= alto) return cls;
    }
    return 'f5';
  }
  function pintarFrase(c, f) {
    const t = f ? f.t : '';
    hojaCarta.frase.className = 'frase ' + tamanoFrase(t);
    revelar(hojaCarta.frase, t);
    revelar(hojaCarta.fuente, f ? `Capítulo ${c.orden}, minuto ${f.min}` : '');
    $('anuncio').textContent = `${c.nombre}. ${t}`;
  }
  function mostrarCarta(c) {
    const cambia = cartaActual !== c;
    cartaActual = c;
    revelar(hojaCarta.rotulo, `Capítulo ${c.orden}`);
    revelar(hojaCarta.titulo, `${c.nombre} · ${ROMANOS[Number(c.numero)]}`);
    pintarFrase(c, nuevaFrase(c));
    if (cambia) {
      const url = c.spotify || D.show;
      hojaCarta.player.innerHTML = '';
      const f = document.createElement('iframe');
      f.src = url;
      f.title = c.spotify ? `Reproductor de Spotify: capítulo ${c.orden}, ${c.nombre}` : 'Reproductor de Spotify: Primero Baraja';
      f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      f.loading = 'lazy';
      hojaCarta.player.appendChild(f);
    }
    document.title = `${c.nombre} · Primero Baraja`;
  }

  // ---------- escenas ----------
  let escena = '';
  let ocupado = false;
  let token = 0;
  const hojas = { carta: $('hoja-carta'), capitulos: $('hoja-capitulos'), sobre: $('hoja-sobre') };

  function marcar(nombre) {
    escena = nombre;
    raiz.dataset.escena = nombre;
    for (const [k, h] of Object.entries(hojas)) h.inert = k !== nombre;
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.getAttribute('href') === `#/${nombre}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('pila').tabIndex = nombre === 'mesa' ? 0 : -1;
    $('barajar').tabIndex = nombre === 'mesa' ? 0 : -1;
    if (nombre !== 'carta') document.title = nombre === 'capitulos' ? 'Capítulos · Primero Baraja' : nombre === 'sobre' ? 'De qué se trata · Primero Baraja' : 'Primero Baraja';
  }

  function ir(ruta, inicial = false, silencioso = false) {
    token++; ocupado = false;
    medir();
    if (ruta.e === 'carta') {
      const c = porSlug[ruta.slug];
      marcar('carta');
      mazo = mazo.filter((ci) => ci !== c.i).concat(c.i);
      apilar(huecos.carta, 1, { jitter: 0.5 });
      objetivo(c, { x: huecos.carta.cx, y: huecos.carta.cy, r: 0, s: huecos.carta.w / base.w, g: 180, z: 10 + mazo.length + 5 });
      if (!silencioso) mostrarCarta(c);
    } else if (ruta.e === 'capitulos') {
      marcar('capitulos');
      apilar(huecos.lista, 0.92);
    } else if (ruta.e === 'sobre') {
      marcar('sobre');
      apilar(huecos.aparcada, 0.8, { jitter: 1.4, giroPila: -3 });
    } else {
      marcar('mesa');
      if (inicial && !reducido) {
        // Entrada: las cartas llegan por abajo, una tras otra, a la pila.
        for (const c of cartas) { c.x = innerWidth / 2 + c.jx * 6; c.y = innerHeight + base.h; c.r = c.jr * 8; c.s = huecos.pila.w / base.w; c.tx = c.x; c.ty = c.y; c.tr = c.r; c.ts = c.s; c.sucio = true; }
        apilar(huecos.pila, 0.92, { cada: 38 });
      } else {
        apilar(huecos.pila, 0.92);
      }
    }
    if (inicial) encajarSiHaceFalta(ruta);
  }
  function encajarSiHaceFalta(ruta) { if (reducido || ruta.e !== undefined && ruta.e !== 'mesa') encajar(); }

  function leer() {
    const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
    if (a === 'carta' && porSlug[b] && porSlug[b].publicado) return { e: 'carta', slug: b };
    if (a === 'capitulos') return { e: 'capitulos' };
    if (a === 'sobre') return { e: 'sobre' };
    return { e: 'mesa' };
  }

  // ---------- barajar: corte, entrelazado, robo ----------
  const dormir = (ms, tk) => new Promise((res) => setTimeout(() => res(tk === token), reducido ? 0 : ms));
  let ignorarHash = false;

  async function barajar() {
    if (ocupado) return;
    medir();
    const tk = ++token;
    ocupado = true;
    const publicadas = cartas.filter((c) => c.publicado);
    let elegida = publicadas[Math.floor(Math.random() * publicadas.length)];
    if (cartaActual && elegida === cartaActual && publicadas.length > 1) elegida = publicadas[(publicadas.indexOf(elegida) + 1) % publicadas.length];

    marcar('barajando');
    const H = huecos.pila;
    const s = (H.w / base.w) * 0.95;
    apilar(H, 0.95, { jitter: 0.6 });
    if (!(await dormir(560, tk))) return;

    // Corte en dos montones.
    const medio = Math.floor(mazo.length / 2);
    const A = mazo.slice(0, medio);
    const B = mazo.slice(medio);
    const dx = H.w * 0.66;
    A.forEach((ci, p) => objetivo(cartas[ci], { x: H.cx - dx, y: H.cy - p * 0.4, r: -6, s }));
    B.forEach((ci, p) => objetivo(cartas[ci], { x: H.cx + dx, y: H.cy - p * 0.4, r: 6, s }));
    if (!(await dormir(520, tk))) return;

    // Entrelazado: caen de a una, alternando montones. La elegida cae la ultima.
    const a = A.filter((ci) => ci !== elegida.i);
    const b = B.filter((ci) => ci !== elegida.i);
    const nuevo = [];
    while (a.length || b.length) {
      const deA = a.length && (!b.length || Math.random() < 0.5);
      nuevo.push(deA ? a.pop() : b.pop());
    }
    nuevo.push(elegida.i);
    for (let k = 0; k < nuevo.length; k++) {
      const c = cartas[nuevo[k]];
      objetivo(c, { x: H.cx + c.jx * 0.6 * s, y: H.cy - k * 0.4 + c.jy * 0.6 * s, r: c.jr * 0.6, s, z: 10 + k });
      if (!(await dormir(42, tk))) return;
    }
    mazo = nuevo;
    if (!(await dormir(380, tk))) return;

    // Robo: la de arriba gira y viaja a su hueco; la hoja entra.
    ocupado = false;
    const destino = `#/carta/${elegida.slug}`;
    if (location.hash !== destino) { ignorarHash = true; location.hash = destino; }
    ir({ e: 'carta', slug: elegida.slug });
  }

  // ---------- Capítulos: la fila lleva su carta a la vista ----------
  let sobreFila = null;
  function izar(slug) {
    if (escena !== 'capitulos' || movil()) return;
    if (slug === sobreFila) return;
    sobreFila = slug;
    apilar(huecos.lista, 0.92);
    if (slug) {
      const c = porSlug[slug];
      const l = huecos.lista;
      objetivo(c, { x: l.cx, y: l.cy - 24, r: 0, s: (l.w / base.w) * 1.06, g: c.publicado ? 180 : 0, z: 200 });
    }
  }
  const hCap = hojas.capitulos;
  hCap.addEventListener('pointerover', (e) => { const f = e.target.closest('[data-slug]'); if (f) izar(f.dataset.slug); });
  hCap.addEventListener('pointerleave', () => izar(null));
  hCap.addEventListener('focusin', (e) => { const f = e.target.closest('[data-slug]'); if (f) izar(f.dataset.slug); });
  hCap.addEventListener('focusout', () => izar(null));

  // ---------- Mesa: la pila se abre al pasar ----------
  const pila = $('pila');
  pila.addEventListener('pointerenter', () => { if (escena === 'mesa' && !ocupado && !movil()) apilar(huecos.pila, 0.92, { abanico: 1 }); });
  pila.addEventListener('pointerleave', () => { if (escena === 'mesa' && !ocupado) apilar(huecos.pila, 0.92); });
  pila.addEventListener('click', barajar);
  $('barajar').addEventListener('click', barajar);
  $('otra-carta').addEventListener('click', barajar);
  $('otra-frase').addEventListener('click', () => { if (cartaActual) pintarFrase(cartaActual, nuevaFrase(cartaActual)); });

  // ---------- teclado y retícula ----------
  const grilla = $('grilla');
  if (/[?&]grilla/.test(location.search)) grilla.hidden = false;
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'g' || e.key === 'G') { grilla.hidden = !grilla.hidden; return; }
    if (e.target.closest && e.target.closest('input,textarea,iframe')) return;
    if (e.key === 'Escape' && escena !== 'mesa' && escena !== 'barajando') { location.hash = '#/'; return; }
    if ((e.key === 'b' || e.key === 'B') && (escena === 'mesa' || escena === 'carta')) { e.preventDefault(); barajar(); }
  });

  // ---------- arranque ----------
  addEventListener('hashchange', () => { if (ignorarHash) { ignorarHash = false; return; } ir(leer()); });
  let tRedim = 0;
  addEventListener('resize', () => { clearTimeout(tRedim); tRedim = setTimeout(() => { if (escena && escena !== 'barajando') ir(escena === "carta" ? { e: "carta", slug: cartaActual.slug } : { e: escena }, false, true); }, 120); });

  medir();
  bucle(paso);
  const fuenteLista = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fuenteLista.then(() => ir(leer(), true));
}
