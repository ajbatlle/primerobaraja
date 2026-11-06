"""Trata los 22 arcanos Rider-Waite al rojo de la marca y arma el reverso.

Fuente: IMG/RIDER/RIDER_2..23.png (cartas a color sobre nube gris, 2250x2813).
Salida: src/assets/naipes/<slug>.webp y src/assets/dorso.webp
Uso: python scripts/tratar-cartas.py
"""
import json, pathlib
import numpy as np
from PIL import Image, ImageFilter

RAIZ = pathlib.Path(__file__).resolve().parent.parent
IMG = RAIZ.parent / 'IMG'
SAL = RAIZ / 'src' / 'assets'
M = 40                       # margen de papel alrededor del marco de la lamina
AW = 840 - 2 * M
W, H = 840, 1305            # lamina sin rotulo + margen
PAPEL = np.array([228, 226, 225], float)
ROJO = np.array([212, 58, 62], float)
rng = np.random.default_rng(7)


def grano(h, w, escala=1.0, fuerza=1.0):
    """Ruido de papel: grano fino + fibras de media frecuencia."""
    fino = rng.normal(0, 1, (h, w))
    medio = np.array(Image.fromarray(((rng.normal(0, 1, (h // 3, w // 3)) * 40 + 128).clip(0, 255)).astype('uint8')).resize((w, h), Image.BICUBIC), float) / 40 - 3.2
    nube = np.array(Image.fromarray(((rng.normal(0, 1, (h // 40, w // 40)) * 40 + 128).clip(0, 255)).astype('uint8')).resize((w, h), Image.BICUBIC), float) / 40 - 3.2
    return (fino * 0.55 + medio * 0.8 + nube * 1.2) * fuerza * escala


def marco(g):
    d = g < 70
    filas = np.where(d.sum(1) > 900)[0]
    cols = np.where(d.sum(0) > 700)[0]
    top, fin = filas.min(), filas.max() + 1          # marco exterior completo (con rotulo)
    return cols.min(), top, cols.max() + 1, top + round((fin - top) * 0.926)   # sin el rotulo


def tratar(i, slug):
    src = Image.open(IMG / 'RIDER' / f'RIDER_{i + 2}.png').convert('RGB')
    g = np.array(src.convert('L'))
    x0, y0, x1, y1 = marco(g)
    corte = src.crop((x0 - 3, y0 - 3, x1 + 3, y1 + 3))
    AH = round(AW * corte.height / corte.width)
    corte = corte.resize((AW, AH), Image.LANCZOS)
    L = np.array(corte.convert('L'), float)
    # tinta: lo oscuro pesa, el color medio queda en rosa pálido
    t = np.clip((200 - L) / 200, 0, 1) ** 1.25
    # un toque de la saturación original para que los rellenos se lean
    c = np.array(corte, float)
    sat = (c.max(2) - c.min(2)) / 255
    t = np.clip(t * 1.05 + sat * 0.03, 0, 1)
    t = np.array(Image.fromarray((t * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.5)), float) / 255
    tt = np.zeros((H, W)); oy = (H - AH) // 2
    tt[oy:oy + AH, M:M + AW] = t[:H - oy if AH > H - oy else AH]
    t = tt
    papel = PAPEL[None, None] + grano(H, W, 1.0, 3.2)[..., None]
    rojo = ROJO[None, None] + grano(H, W, 1.0, 5)[..., None] * np.array([1, 0.6, 0.6])
    # la tinta no cubre del todo: granulosidad de impresión
    cobertura = np.clip(t * 0.88 + grano(H, W, 1.0, 0.05) * t, 0, 1)[..., None]
    out = papel * (1 - cobertura) + rojo * cobertura
    # borde: velo del papel gastado
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy]) / 18
    out *= (0.93 + 0.07 * np.clip(d, 0, 1))[..., None]
    Image.fromarray(out.clip(0, 255).astype('uint8')).save(SAL / 'naipes' / f'{slug}.webp', quality=88, method=6)


def dorso():
    papel = PAPEL[None, None] + grano(H, W, 1.0, 3.2)[..., None]
    tinta = np.zeros((H, W))
    # isotipo: mascara roja del identificador
    ident = np.array(Image.open(IMG / 'Identificador_Primero baraja-06.png').convert('RGB'), int)
    m = ((ident[..., 0] > 140) & (ident[..., 1] < 100) & (ident[..., 2] < 100)).astype('uint8') * 255
    ys, xs = np.where(m > 0)
    m = Image.fromarray(m).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    lado = int(W * 0.46)
    m = m.resize((lado, int(lado * m.height / m.width)), Image.LANCZOS)
    iso = np.zeros((H, W)); mm = np.array(m, float) / 255
    oy, ox = (H - mm.shape[0]) // 2, (W - mm.shape[1]) // 2
    iso[oy:oy + mm.shape[0], ox:ox + mm.shape[1]] = mm
    tinta = np.maximum(tinta, iso)
    # marco doble tipo naipe antiguo
    def rect(a, b, ancho):
        r = np.zeros((H, W))
        r[a:H - a, a:W - a] = 1
        r[a + ancho:H - a - ancho, a + ancho:W - a - ancho] = 0
        return r
    tinta = np.maximum(tinta, rect(44, 44, 5))
    tinta = np.maximum(tinta, rect(62, 62, 2))
    # trama de rombos fina en la banda interior, para dar textura de grabado
    yy, xx = np.mgrid[0:H, 0:W]
    u = (xx + yy) % 22; v = (xx - yy) % 22
    rombos = ((u < 2) | (v < 2)).astype(float)
    interior = np.zeros((H, W)); interior[78:H - 78, 78:W - 78] = 1
    # aire alrededor del isotipo
    aire = np.array(Image.fromarray((iso * 255).astype('uint8')).filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(6)), float) / 255
    tinta = np.maximum(tinta, rombos * interior * (1 - aire) * 0.55)
    tinta = np.array(Image.fromarray((tinta * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.7)), float) / 255
    cobertura = np.clip(tinta * (0.9 + grano(H, W, 1.0, 0.08)), 0, 1)[..., None]
    rojo = ROJO[None, None] + grano(H, W, 1.0, 5)[..., None] * np.array([1, 0.6, 0.6])
    out = papel * (1 - cobertura) + rojo * cobertura
    d = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy]) / 18
    out *= (0.93 + 0.07 * np.clip(d, 0, 1))[..., None]
    Image.fromarray(out.clip(0, 255).astype('uint8')).save(SAL / 'dorso.webp', quality=88, method=6)


if __name__ == '__main__':
    arcanos = json.load(open(RAIZ / 'src' / 'data' / 'arcanos.json', encoding='utf8'))
    for i, a in enumerate(arcanos):
        tratar(i, a['slug'])
    dorso()
    print('listo', len(arcanos), 'cartas + dorso')
