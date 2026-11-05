// La mesa de Primero Baraja.
//
// 22 cartas que viven siempre en pantalla, dentro del panel de la mesa, y se
// reordenan en el sitio. Cada escena decide un objetivo para cada carta; un
// bucle por frame las acerca con amortiguacion exponencial (sin rebote).
//
// Regla de movimiento (Antonio): nada se desvanece. Lo que no esta, esta
// recogido tras una cortina o aparcado; lo que sale gira de canto.

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
  const cartas = [...document.querySelectorAll('.carta')].map((nodo, i) => {
    const info = D.cartas.find((c) => c.slug === nodo.dataset.slug);
    return {
      nodo, giro: nodo.querySelector('.giro'), i, ...info,
      jx: (semilla(i) - 0.5) * 10, jy: (semilla(i + 40) - 0.5) * 8, jr: (semilla(i + 80) - 0.5) * 5,
      x: 0, y: 0, r: 0, s: 1, g: 0, z: 10 + i,
      tx: 0, ty: 0, tr: 0, ts: 1, tg: 0, sucio: true, timer: 0,
    };
  });
  const porSlug = Object.fromEntries(cartas.map((c) => [c.slug, c]));
  let mazo = cartas.map((c) => c.i); // de abajo a arriba

  // ---------- medidas: todo sale del rectangulo del panel ----------
  const base = { w: 300, h: 300 / RAZON };
  let huecos = {};
  function medir() {
    const unidad = (parseFloat(getComputedStyle($('mesa')).borderTopLeftRadius) || 28) / 1.4;
    const p = $('mesa').getBoundingClientRect();
    const pad = unidad * 2;
    const ix = p.left + pad, iy = p.top + pad, iw = p.width - 2 * pad, ih = p.height - 2 * pad;
    let w, h;
    if (iw / ih < RAZON) { w = iw; h = w / RAZON; } else { h = ih; w = h * RAZON; }
    base.w = w; base.h = h;
    const centro = { cx: ix + iw / 2, cy: iy + ih / 2, w, h };
    const s = movil() ? 0.45 : 0.5;
    huecos = {
      pila: centro,
      aparcada: { cx: ix + iw - (w * s) / 2, cy: iy + ih - (h * s) / 2, w: w * s, h: h * s },
    };
    for (const c of cartas) { c.nodo.style.width = base.w + 'px'; c.nodo.style.height = base.h + 'px'; }
    $('cartas').style.setProperty('--rc', base.w * 0.045 + 'px');
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

  // Pone todo el mazo en un hueco, con su desorden fijo.
  function apilar(hueco, factor = 1, o = {}) {
    const { jitter = 1, abanico = 0, giroPila = 0, cada = 0 } = o;
    const s = (hueco.w / base.w) * factor;
    mazo.forEach((ci, p) => {
      const c = cartas[ci];
      const k = p - (mazo.length - 1) / 2;
      objetivo(c, {
        x: hueco.cx + (c.jx * jitter + k * 3.4 * abanico) * s,
        y: hueco.cy - p * 0.4 + c.jy * jitter * s,
        r: c.jr * jitter + k * 0.6 * abanico + giroPila,
        s, g: 0, z: 10 + p,
      }, cada * p);
    });
  }

  // ---------- texto: revelado por cortina, al tamano final ----------
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

  // ---------- escena de carta ----------
  const E = { rotulo: $('carta-rotulo'), titulo: $('carta-titulo'), frase: $('carta-frase'), fuente: $('carta-fuente'), player: $('carta-player') };
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
  // La frase toma el tamaño más grande que le cabe en su caja.
  const TAMANOS = [2.441, 1.953, 1.5625, 1.25, 1];
  function tamanoFrase(t) {
    const caja = E.frase;
    const px = parseFloat(getComputedStyle(raiz).fontSize) || 16;
    const ancho = caja.clientWidth || 500;
    const alto = movil() ? 176 : (caja.clientHeight || 300);
    for (const rem of TAMANOS) {
      const fs = rem * px;
      const lineas = Math.ceil((t.length * 0.47 * fs * 1.05) / ancho);
      if (lineas * fs * 1.25 <= alto) return rem;
    }
    return TAMANOS[TAMANOS.length - 1];
  }
  function pintarFrase(c, f) {
    const t = f ? f.t : '';
    const rem = tamanoFrase(t);
    E.frase.style.fontSize = rem + 'rem';
    E.frase.style.lineHeight = rem >= 1.5 ? '1.25' : '1.5';
    revelar(E.frase, t);
    revelar(E.fuente, f ? `Capítulo ${c.orden}, minuto ${f.min}` : '');
    $('anuncio').textContent = `${c.nombre}. ${t}`;
  }
  function mostrarCarta(c) {
    const cambia = cartaActual !== c;
    cartaActual = c;
    revelar(E.rotulo, `Capítulo ${c.orden}`);
    revelar(E.titulo, `${c.nombre} · ${ROMANOS[Number(c.numero)]}`);
    pintarFrase(c, nuevaFrase(c));
    if (cambia) {
      E.player.innerHTML = '';
      const f = document.createElement('iframe');
      f.src = c.spotify || D.show;
      f.title = c.spotify ? `Reproductor de Spotify: capítulo ${c.orden}, ${c.nombre}` : 'Reproductor de Spotify: Primero Baraja';
      f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      f.loading = 'lazy';
      E.player.appendChild(f);
    }
    document.title = `${c.nombre} · Primero Baraja`;
  }

  // ---------- escenas ----------
  let escena = '';
  let ocupado = false;
  let token = 0;
  const escenas = { mesa: $('esc-mesa'), carta: $('esc-carta'), capitulos: $('esc-capitulos'), sobre: $('esc-sobre') };

  function marcar(nombre) {
    escena = nombre;
    raiz.dataset.escena = nombre;
    for (const [k, e] of Object.entries(escenas)) e.inert = k !== nombre;
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.dataset.ruta === nombre) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('pila').tabIndex = nombre === 'mesa' ? 0 : -1;
    if (nombre !== 'carta') document.title = nombre === 'capitulos' ? 'Capítulos · Primero Baraja' : nombre === 'sobre' ? 'De qué se trata · Primero Baraja' : 'Primero Baraja';
  }

  function ir(ruta, inicial = false, silencioso = false) {
    token++; ocupado = false; sobreFila = null;
    medir();
    if (ruta.e === 'carta') {
      const c = porSlug[ruta.slug];
      marcar('carta');
      mazo = mazo.filter((ci) => ci !== c.i).concat(c.i);
      apilar(huecos.pila, 0.94, { jitter: 0.5 });
      objetivo(c, { x: huecos.pila.cx, y: huecos.pila.cy, r: 0, s: 1, g: 180, z: 10 + mazo.length + 5 });
      if (!silencioso) mostrarCarta(c);
    } else if (ruta.e === 'capitulos') {
      marcar('capitulos');
      apilar(huecos.pila, 0.94);
    } else if (ruta.e === 'sobre') {
      marcar('sobre');
      apilar(huecos.aparcada, 1, { jitter: 1.2, giroPila: -4 });
    } else {
      marcar('mesa');
      if (inicial && !reducido) {
        // Entrada: las cartas llegan por abajo, una tras otra, a la pila.
        for (const c of cartas) { c.x = innerWidth * 0.75 + c.jx * 6; c.y = innerHeight + base.h; c.r = c.jr * 8; c.s = 0.94; c.tx = c.x; c.ty = c.y; c.tr = c.r; c.ts = c.s; c.sucio = true; }
        apilar(huecos.pila, 0.94, { cada: 38 });
      } else {
        apilar(huecos.pila, 0.94);
      }
    }
    if (inicial && (reducido || ruta.e !== 'mesa')) encajar();
  }

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

    marcar('mesa');
    const H = huecos.pila;
    const s = (H.w / base.w) * 0.94;
    apilar(H, 0.94, { jitter: 0.6 });
    if (!(await dormir(560, tk))) return;

    // Corte en dos montones.
    const medio = Math.floor(mazo.length / 2);
    const A = mazo.slice(0, medio);
    const B = mazo.slice(medio);
    const dx = Math.min(H.w * 0.62, (H.cx - $('mesa').getBoundingClientRect().left) - H.w * s * 0.5 - 8);
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

    // Robo: la de arriba gira y se queda; la escena de carta se abre.
    ocupado = false;
    const destino = `#/carta/${elegida.slug}`;
    if (location.hash !== destino) { ignorarHash = true; location.hash = destino; }
    ir({ e: 'carta', slug: elegida.slug });
  }

  // ---------- Capitulos: la fila lleva su carta a la vista ----------
  let sobreFila = null;
  function izar(slug) {
    if (escena !== 'capitulos' || movil()) return;
    if (slug === sobreFila) return;
    sobreFila = slug;
    apilar(huecos.pila, 0.94);
    if (slug) {
      const c = porSlug[slug];
      objetivo(c, { x: huecos.pila.cx, y: huecos.pila.cy - 10, r: 0, s: 1.04, g: c.publicado ? 180 : 0, z: 200 });
    }
  }
  const cap = escenas.capitulos;
  cap.addEventListener('pointerover', (e) => { const f = e.target.closest('[data-slug]'); if (f) izar(f.dataset.slug); });
  cap.addEventListener('pointerleave', () => izar(null));
  cap.addEventListener('focusin', (e) => { const f = e.target.closest('[data-slug]'); if (f) izar(f.dataset.slug); });
  cap.addEventListener('focusout', () => izar(null));

  // ---------- Mesa: la pila se abre al pasar ----------
  const pila = $('pila');
  pila.addEventListener('pointerenter', () => { if (escena === 'mesa' && !ocupado && !movil()) apilar(huecos.pila, 0.94, { abanico: 1 }); });
  pila.addEventListener('pointerleave', () => { if (escena === 'mesa' && !ocupado) apilar(huecos.pila, 0.94); });
  pila.addEventListener('click', barajar);
  $('barajar').addEventListener('click', barajar);
  $('nav-barajar').addEventListener('click', barajar);
  $('otra-carta').addEventListener('click', barajar);
  $('otra-frase').addEventListener('click', () => { if (cartaActual) pintarFrase(cartaActual, nuevaFrase(cartaActual)); });

  // ---------- teclado y reticula ----------
  const grilla = $('grilla');
  if (/[?&]grilla/.test(location.search)) grilla.hidden = false;
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'g' || e.key === 'G') { grilla.hidden = !grilla.hidden; return; }
    if (e.target.closest && e.target.closest('input,textarea,iframe')) return;
    if (e.key === 'Escape' && escena !== 'mesa') { location.hash = '#/'; return; }
    if ((e.key === 'b' || e.key === 'B') && (escena === 'mesa' || escena === 'carta')) { e.preventDefault(); barajar(); }
  });

  // ---------- arranque ----------
  addEventListener('hashchange', () => { if (ignorarHash) { ignorarHash = false; return; } ir(leer()); });
  let tRedim = 0;
  addEventListener('resize', () => { clearTimeout(tRedim); tRedim = setTimeout(() => { if (escena) ir(escena === 'carta' ? { e: 'carta', slug: cartaActual.slug } : { e: escena }, false, true); }, 120); });

  medir();
  bucle(paso);
  const fuentes = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fuentes.then(() => ir(leer(), true));
}
