// Orquesta la escena: el giro del isotipo, la entrada al mazo y la vuelta.
//
// El giro no es una animacion CSS sino un valor que se integra por frame,
// porque tiene que cambiar de velocidad sin dar un tiron: `animation-duration`
// reinicia la curva y produce un salto visible. Aqui la velocidad se aproxima
// a su objetivo con la misma amortiguacion que usa el mazo, asi que acelerar
// y frenar se sienten igual en toda la pagina.

import { amortiguar, bucle } from './movimiento.js';
import { crearMazo } from './mazo.js';

/** Velocidades de giro en grados por segundo. */
const GIRO = {
  reposo: 15, // una vuelta cada 24 s, igual que el periodo del mar
  rozando: 30,
  pulsado: 78,
};

/** Cuanto tarda la velocidad de giro en acercarse a su objetivo. */
const ACELERACION = 1.9;

const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Compas de la entrada. Corto a proposito: "Entrar" ya esta a la vista antes
 *  de pulsar, asi que el descenso solo necesita el tiempo justo para que se
 *  lea la respuesta al toque. */
const BEAT_VIAJE = quieto ? 0 : 380;

/** Margen antes de guardar los controles, para poder cruzar el hueco entre el
 *  mazo y los botones sin que se escondan por el camino. */
const MARGEN_CONTROLES = 260;

export function iniciarEntrada() {
  const raiz = document.documentElement;
  const glifo = document.querySelector('.glifo');
  const disparador = document.querySelector('.disparador');
  const logotipo = document.querySelector('.logotipo');
  const mazoEl = document.querySelector('.mazo');
  const controles = document.querySelector('.controles');
  if (!glifo || !disparador) return;

  const mazo = mazoEl ? crearMazo(mazoEl, glifo) : null;

  let angulo = 0;
  let velocidad = GIRO.reposo;
  let objetivo = GIRO.reposo;
  let rozando = false;
  let entrando = false;
  let viaje = 0;

  bucle((dt) => {
    velocidad = amortiguar(velocidad, objetivo, ACELERACION, dt);
    angulo = (angulo + velocidad * dt) % 360;
    glifo.style.transform = 'rotate(' + angulo.toFixed(2) + 'deg)';
  });

  // --- Portada: rozar y entrar -------------------------------------------

  function fijarGiro() {
    if (entrando) objetivo = GIRO.reposo;
    else objetivo = rozando ? GIRO.rozando : GIRO.reposo;
  }

  disparador.addEventListener('pointerenter', () => {
    if (entrando) return;
    rozando = true;
    raiz.dataset.escena = 'rozando';
    fijarGiro();
  });

  disparador.addEventListener('pointerleave', () => {
    if (entrando) return;
    rozando = false;
    raiz.dataset.escena = 'portada';
    fijarGiro();
  });

  function entrar() {
    if (entrando) return;
    entrando = true;

    // 1. Responde al toque: crece del todo y acelera.
    raiz.dataset.escena = 'pulsado';
    objetivo = GIRO.pulsado;

    // 2. Encoge, baja, y se despliegan disco, letras y anillo. Todo a la vez.
    clearTimeout(viaje);
    viaje = window.setTimeout(() => {
      raiz.dataset.escena = 'viajando';
      objetivo = GIRO.reposo;
      mazo?.desplegar();

      const t = parseFloat(getComputedStyle(raiz).getPropertyValue('--t-viaje')) || 1700;
      viaje = window.setTimeout(() => {
        raiz.dataset.escena = 'mazo';
      }, t * 0.55);
    }, BEAT_VIAJE);
  }

  disparador.addEventListener('click', entrar);

  // --- Mazo: barajar y volver --------------------------------------------

  function plegar() {
    clearTimeout(viaje);
    entrando = false;
    rozando = false;
    raiz.dataset.controles = 'false';
    raiz.dataset.escena = 'portada';
    objetivo = GIRO.reposo;
    mazo?.plegar();
  }

  let guardar = 0;
  function mostrarControles(si) {
    clearTimeout(guardar);
    if (si) {
      raiz.dataset.controles = 'true';
    } else {
      guardar = window.setTimeout(() => {
        raiz.dataset.controles = 'false';
      }, MARGEN_CONTROLES);
    }
  }

  for (const zona of [mazoEl, logotipo, controles]) {
    if (!zona) continue;
    zona.addEventListener('pointerenter', () => {
      if (raiz.dataset.escena === 'mazo') mostrarControles(true);
    });
    zona.addEventListener('pointerleave', () => mostrarControles(false));
  }

  controles?.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;
    if (boton.dataset.accion === 'barajar') mazo?.barajar();
    else if (boton.dataset.accion === 'plegar') plegar();
  });
}
