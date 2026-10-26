import { defineConfig } from 'astro/config';

// El sitio vive en su propio dominio, servido desde GitHub Pages.
// Sin `base`: con dominio propio las rutas cuelgan de la raiz, no de
// /primerobaraja. El dominio se declara en public/CNAME, que es lo que
// GitHub Pages lee al desplegar.
export default defineConfig({
  site: 'https://primerobaraja.xyz',
});
