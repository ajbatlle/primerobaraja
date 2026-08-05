# Flujo de trabajo entre dos computadores

Este proyecto se edita desde dos computadores distintos. Para evitar perder cambios, sigue esta regla en cada sesión:

## Al empezar a trabajar

```bash
git pull origin main
```

Trae los cambios que hayas subido desde el otro computador.

## Al terminar de trabajar

```bash
git status
```

Revisa qué archivos cambiaron. Si hay cambios:

```bash
git add -A
git commit -m "mensaje descriptivo"
git push origin main
```

**Regla de oro:** nunca cierres la sesión de trabajo con cambios sin subir. Si vas a parar por hoy, ese es el momento de hacer commit + push, aunque el cambio esté a medias.

## Chequeo rápido antes de cerrar

```bash
git status
```

- `nothing to commit, working tree clean` + `up to date with origin/main` → todo bien, puedes cerrar.
- Cualquier otra cosa → falta subir algo.
