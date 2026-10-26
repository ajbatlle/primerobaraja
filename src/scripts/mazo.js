// Mazo: catalogo espacial de movimiento continuo.
//
// Las 22 piezas viven repartidas en un anillo alrededor de un eje vertical y
// existen desde el primer instante. En la portada el anillo esta plegado: su
// radio es cero y las piezas estan encogidas en un punto, justo detras de la
// marca. Entrar no las hace aparecer, las despliega desde ese punto; plegar
// las devuelve ahi. Ningun estado crea ni destruye nada.
//
// No hay ni una opacidad en todo el archivo. Una pieza sale del campo porque
// gira hasta ponerse de canto -y de canto no se ve, sin necesidad de fundirla-
// y porque la perspectiva la aleja. Es geometria, no un cambio de estado.
//
// El desplazamiento base va de derecha a izquierda y no se detiene nunca. La
// navegacion no fija posiciones: inyecta velocidad, que decae por
// amortiguacion hasta volver a la deriva. De ahi que no haya frenazos.

import { amortiguar, bucle, limitar } from './movimiento.js';

const TAU = Math.PI * 2;

/** rad/s de deriva permanente. Una vuelta completa ronda los 75 s. */
const DERIVA = 0.084;

/** Cuanto se acerca la velocidad a la deriva por segundo. Bajo = inercia larga. */
const FRENADO = 1.15;

/** Tope de velocidad, para que un golpe de rueda fuerte no descontrole. */
const VELOCIDAD_MAX = 3.2;

/** Ritmo del plegado y desplegado del anillo. Sin rebote, por construccion. */
const APERTURA = 1.5;

/** Ritmo con el que cada pieza busca su ranura nueva al barajar. */
const REPARTO = 1.7;

/** Escala de las piezas con el anillo plegado: un punto, no cero. */
const ESCALA_PLEGADA = 0.04;

/** Cuanto se recoge el anillo mientras baraja, y cuanto dura ese recogido. */
const BARAJA_RECOGIDA = 0.3;
const BARAJA_MS = 620;

export function crearMazo(raiz, referencia) {
  const piezas = [...raiz.querySelectorAll('.pieza')];
  if (!piezas.length) return null;

  const n = piezas.length;
  const paso = TAU / n;

  // Ranuras fijas del anillo, y la posicion -animada- de cada pieza dentro.
  const ranuras = piezas.map((_, i) => i * paso);
  const posicion = ranuras.slice();
  const destino = ranuras.slice();

  let radio = 0;
  let desfaseY = 0;

  function medir() {
    // El radio sale del ancho de pieza para que el reparto angular no solape
    // nunca, sea cual sea la pantalla.
    radio = piezas[0].offsetWidth * 3.9;

    // Con el anillo plegado las piezas tienen que quedar exactamente detras
    // de la marca. Se mide la diferencia entre ambos centros y se guarda.
    desfaseY = 0;
    if (referencia) {
      const r = referencia.getBoundingClientRect();
      const a = raiz.getBoundingClientRect();
      desfaseY = r.top + r.height / 2 - (a.top + a.height / 2);
    }
  }

  let angulo = 0;
  let velocidad = DERIVA;
  let apertura = 0;
  let aperturaObjetivo = 0;
  let arrastrando = false;

  let xPrevio = 0;
  let tPrevio = 0;
  let velocidadArrastre = 0;

  function colocar() {
    // Todo -desplegar, plegar, barajar- es interpolacion de radio, escala,
    // altura y angulo. Nunca un cambio de propiedad de golpe.
    const r = radio * apertura;
    const escala = ESCALA_PLEGADA + (1 - ESCALA_PLEGADA) * apertura;
    const y = desfaseY * (1 - apertura);

    for (let i = 0; i < n; i++) {
      const a = posicion[i] - angulo;
      const x = r * Math.sin(a);
      // El frente del anillo queda en z=0: la pieza delantera se ve a tamaño
      // real y las demas solo se alejan, nunca se acercan de mas.
      const z = r * Math.cos(a) - r;

      piezas[i].style.transform =
        'translate3d(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px, ' + z.toFixed(2) + 'px)' +
        ' rotateY(' + a.toFixed(4) + 'rad)' +
        ' scale(' + escala.toFixed(4) + ')';
    }
  }

  function avanzar(dt) {
    apertura = amortiguar(apertura, aperturaObjetivo, APERTURA, dt);
    for (let i = 0; i < n; i++) {
      posicion[i] = amortiguar(posicion[i], destino[i], REPARTO, dt);
    }
    if (!arrastrando) {
      velocidad = amortiguar(velocidad, DERIVA, FRENADO, dt);
      angulo += velocidad * dt;
    }
    colocar();
  }

  // --- Entrada ---------------------------------------------------------

  const navegable = () => aperturaObjetivo > 0;

  function empujar(delta) {
    velocidad = limitar(velocidad + delta, -VELOCIDAD_MAX, VELOCIDAD_MAX);
  }

  raiz.addEventListener(
    'wheel',
    (e) => {
      if (!navegable()) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      empujar(d * 0.0022);
      e.preventDefault();
    },
    { passive: false }
  );

  raiz.addEventListener('pointerdown', (e) => {
    if (!navegable()) return;
    arrastrando = true;
    raiz.setPointerCapture(e.pointerId);
    raiz.classList.add('arrastrando');
    xPrevio = e.clientX;
    tPrevio = performance.now();
    velocidadArrastre = 0;
  });

  raiz.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const ahora = performance.now();
    const dt = Math.max(8, ahora - tPrevio) / 1000;
    const dx = e.clientX - xPrevio;
    // Arrastrar a la izquierda avanza el anillo, igual que la deriva.
    const dAngulo = (-dx / raiz.clientWidth) * 2.2;
    angulo += dAngulo;
    velocidadArrastre = dAngulo / dt;
    xPrevio = e.clientX;
    tPrevio = ahora;
  });

  function soltar(e) {
    if (!arrastrando) return;
    arrastrando = false;
    raiz.classList.remove('arrastrando');
    if (e && e.pointerId !== undefined && raiz.hasPointerCapture(e.pointerId)) {
      raiz.releasePointerCapture(e.pointerId);
    }
    // La inercia del gesto se suma a la deriva y decae sola.
    velocidad = limitar(velocidadArrastre, -VELOCIDAD_MAX, VELOCIDAD_MAX);
  }
  raiz.addEventListener('pointerup', soltar);
  raiz.addEventListener('pointercancel', soltar);

  window.addEventListener('keydown', (e) => {
    if (!navegable()) return;
    if (e.key === 'ArrowRight') empujar(0.9);
    else if (e.key === 'ArrowLeft') empujar(-0.9);
  });

  let reajuste = 0;
  window.addEventListener('resize', () => {
    clearTimeout(reajuste);
    reajuste = window.setTimeout(() => {
      medir();
      colocar();
    }, 150);
  });

  medir();
  colocar();
  bucle(avanzar);

  let recogida = 0;

  /** Lleva cada destino a la vuelta mas cercana, para que ninguna pieza de
   *  un rodeo entero al ir al hueco de al lado. */
  function porElCaminoCorto(objetivos) {
    for (let i = 0; i < n; i++) {
      destino[i] = objetivos[i] + Math.round((posicion[i] - objetivos[i]) / TAU) * TAU;
    }
  }

  return {
    desplegar() {
      // Sin volver a medir: el desfase se capturo al cargar, con la marca aun
      // en el centro. Aqui ya ha empezado a bajar, y remedirlo referenciaria
      // el pliegue a un punto a mitad de vuelo.
      clearTimeout(recogida);
      aperturaObjetivo = 1;
    },

    plegar() {
      clearTimeout(recogida);
      aperturaObjetivo = 0;
      // Al recogerse, las piezas recuperan su orden de mazo.
      porElCaminoCorto(ranuras);
    },

    barajar() {
      const sorteo = ranuras.slice();
      for (let i = sorteo.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = sorteo[i];
        sorteo[i] = sorteo[j];
        sorteo[j] = t;
      }
      porElCaminoCorto(sorteo);

      // El anillo se recoge mientras se reparte y vuelve a abrirse: es el
      // gesto de juntar el mazo, mezclarlo y volver a extenderlo.
      clearTimeout(recogida);
      aperturaObjetivo = BARAJA_RECOGIDA;
      recogida = window.setTimeout(() => {
        aperturaObjetivo = 1;
      }, BARAJA_MS);
    },
  };
}
