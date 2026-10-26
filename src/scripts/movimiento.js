// Utilidades del lenguaje de movimiento para lo que se anima por frame.
//
// Las transiciones discretas (aparecer, desplegar, cambiar de estado) las
// hace CSS con las curvas de movimiento.css. Lo continuo -giro del isotipo,
// deriva del mazo- se mueve aqui, y siempre por aproximacion exponencial:
// se acerca al objetivo frenando, nunca lo sobrepasa. De ahi que no haya
// rebotes en ningun sitio.

/**
 * Aproximacion exponencial independiente del frame rate. Con el mismo
 * `factor`, 30fps y 144fps recorren lo mismo en el mismo tiempo real.
 * @param {number} actual
 * @param {number} objetivo
 * @param {number} factor   1/s. Mas alto = llega antes. 1.5 es un frenado largo.
 * @param {number} dt       segundos desde el frame anterior
 */
export function amortiguar(actual, objetivo, factor, dt) {
  return objetivo + (actual - objetivo) * Math.exp(-factor * dt);
}

/**
 * Bucle de animacion con dt acotado y pausa automatica con la pestaña oculta.
 * Devuelve una funcion para detenerlo.
 * @param {(dt: number, t: number) => void} paso
 */
export function bucle(paso) {
  let id = 0;
  let anterior = 0;
  let transcurrido = 0;
  let vivo = true;

  function frame(ahora) {
    id = requestAnimationFrame(frame);
    if (!anterior) anterior = ahora;
    // Acotado: al volver de una pestaña oculta el salto seria de segundos y
    // todo daria un tiron. Con el tope, reanuda como si nada.
    const dt = Math.min(0.05, (ahora - anterior) / 1000);
    anterior = ahora;
    transcurrido += dt;
    paso(dt, transcurrido);
  }

  function arrancar() {
    if (id || !vivo) return;
    anterior = 0;
    id = requestAnimationFrame(frame);
  }
  function parar() {
    cancelAnimationFrame(id);
    id = 0;
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? parar() : arrancar()));
  arrancar();

  return () => {
    vivo = false;
    parar();
  };
}

/** Recorta un valor. */
export const limitar = (v, min, max) => (v < min ? min : v > max ? max : v);

/** Interpolacion suave con derivada nula en los extremos. */
export function suavizar(borde0, borde1, x) {
  const t = limitar((x - borde0) / (borde1 - borde0), 0, 1);
  return t * t * (3 - 2 * t);
}
