// Comprueba la geometria del anillo del mazo en varias pantallas: que las
// piezas no se solapen, que salgan del campo estrechandose por rotacion y no
// de golpe, que la escala por perspectiva quede en un rango util y que el
// anillo no pise el logotipo asentado abajo.
//
//   npm run verificar:mazo

const N = 22;
const FACTOR_RADIO = 3.9;    // radio = ancho de pieza * esto   (mazo.js)
const PROPORCION = 1.25;     // las cartas son 720x900
const TOP_PIEZA = 0.5;       // .pieza { top: 50% }
const MARGEN_PIEZA = 0.625;  // margin-top: -0.625 * ancho (media lamina)
const PIE = 42;              // alto aproximado del pie de la pieza
const MARGEN_LOGO = 0.035;   // --logo-margen: 3.5vh

const limitar = (v, a, b) => Math.min(Math.max(v, a), b);
const anchoPieza = (vw) => limitar(0.19 * vw, 150, 260);
const perspectiva = (vw) => limitar(1.18 * vw, 900, 1700);
const anchoLogotipo = (vw) => limitar(0.21 * vw, 140, 280);

const PANTALLAS = [
  ['movil', 390, 844],
  ['tablet', 834, 1112],
  ['portatil', 1280, 720],
  ['escritorio', 1920, 1080],
  ['ultraancho', 2560, 1080],
];

let fallos = 0;
const exigir = (ok, msg) => {
  if (!ok) {
    fallos++;
    console.log('   FALLO: ' + msg);
  }
};

for (const [nombre, vw, vh] of PANTALLAS) {
  const w = anchoPieza(vw);
  const R = w * FACTOR_RADIO;
  const P = perspectiva(vw);
  const paso = (Math.PI * 2) / N;
  const separacion = R * paso;

  const escala = (a) => P / (P - (R * Math.cos(a) - R));
  // La pieza gira con el anillo, asi que se estrecha por su propio coseno.
  const anchoAparente = (a) => w * escala(a) * Math.abs(Math.cos(a));

  // Piezas legibles: dentro del encuadre y con ancho aparente suficiente. Las
  // que quedan casi de canto proyectan un par de pixeles; estan ahi, pero no
  // cuentan como pieza a la vista.
  const UMBRAL = 0.35;
  let legibles = 0;
  for (let i = 0; i < N; i++) {
    const a = i * paso;
    const aa = a > Math.PI ? a - Math.PI * 2 : a;
    if (Math.abs(aa) >= Math.PI / 2) continue;
    const x = R * Math.sin(aa) * escala(aa);
    const ap = anchoAparente(aa);
    if (Math.abs(x) < vw / 2 + ap / 2 && ap > w * UMBRAL) legibles++;
  }

  // Franja vertical que ocupa el anillo, y borde superior del logotipo.
  const arriba = vh * TOP_PIEZA - w * MARGEN_PIEZA;
  const abajo = arriba + w * PROPORCION + PIE;
  const altoLogo = anchoLogotipo(vw) * 0.30655;
  const topeLogo = vh - MARGEN_LOGO * vh - altoLogo;

  console.log(`${nombre.padEnd(11)} ${String(vw).padStart(4)}x${vh}`);
  console.log(`   pieza ${w.toFixed(0)}px | radio ${R.toFixed(0)}px | perspectiva ${P.toFixed(0)}px`);
  console.log(`   holgura entre piezas contiguas ${(separacion - w).toFixed(0)}px`);
  console.log(`   escala  frente 1.000 | 45deg ${escala(Math.PI / 4).toFixed(3)} | 75deg ${escala(1.309).toFixed(3)}`);
  console.log(`   ancho aparente  45deg ${anchoAparente(Math.PI / 4).toFixed(0)}px | 80deg ${anchoAparente(1.396).toFixed(0)}px | 89deg ${anchoAparente(1.553).toFixed(1)}px`);
  console.log(`   piezas legibles ${legibles}`);
  console.log(`   anillo ${arriba.toFixed(0)}..${abajo.toFixed(0)} | logotipo desde ${topeLogo.toFixed(0)} de ${vh}`);

  exigir(separacion > w, `${nombre}: las piezas se solapan en el frente`);
  exigir(anchoAparente(1.553) < 6, `${nombre}: no se estrecha al salir, se cortaria de golpe`);
  exigir(legibles >= 3 && legibles <= 9, `${nombre}: ${legibles} piezas legibles, fuera de rango util`);
  exigir(arriba > 0, `${nombre}: el anillo se sale por arriba`);
  exigir(abajo < topeLogo, `${nombre}: el anillo pisa el logotipo (${abajo.toFixed(0)} vs ${topeLogo.toFixed(0)})`);
  console.log();
}

console.log(fallos === 0 ? 'TODO OK' : `${fallos} COMPROBACION(ES) FALLIDA(S)`);
process.exit(fallos === 0 ? 0 : 1);
