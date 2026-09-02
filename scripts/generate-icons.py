#!/usr/bin/env python3
"""Genera los iconos de la app a partir de la marca del encabezado.

La marca son dos alianzas entrelazadas con un diamante encima, la misma que
dibuja `BrandMark` en src/Prototype.tsx (viewBox de 24). Aquí se redibuja con
Pillow porque en esta máquina no hay ningún rasterizador de SVG.

    python3 scripts/generate-icons.py
"""
from PIL import Image, ImageDraw

PAPER = (245, 241, 236, 255)   # --paper
ACCENT = (192, 86, 61, 255)    # --accent
INK = (28, 25, 23, 255)        # --ink
CREAM = (255, 250, 244, 255)

SS = 4  # supersampling: se dibuja en grande y se reduce con LANCZOS


def draw_mark(size, pad_ratio, bg, ring_color=CREAM, gem_color=INK, radius_ratio=0.22, stroke_ratio=1.8):
    """Dibuja la marca centrada en un lienzo cuadrado de `size` px."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if bg is not None:
        if radius_ratio:
            d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=bg)
        else:
            d.rectangle([0, 0, s, s], fill=bg)

    # La marca ocupa 24x24 unidades; se escala al cuadro útil tras el padding.
    box = s * (1 - 2 * pad_ratio)
    u = box / 24.0
    ox = (s - box) / 2.0
    oy = (s - box) / 2.0

    def P(x, y):
        return (ox + x * u, oy + y * u)

    stroke = max(1, int(round(stroke_ratio * u)))

    for cx in (9.2, 14.8):
        x0, y0 = P(cx - 6, 14.6 - 6)
        x1, y1 = P(cx + 6, 14.6 + 6)
        d.ellipse([x0, y0, x1, y1], outline=ring_color, width=stroke)

    d.polygon([P(12, 1.9), P(14.1, 5.7), P(12, 8.1), P(9.9, 5.7)], fill=gem_color)

    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    out = f"public/{name}"
    img.save(out)
    print(f"  {out}")


if __name__ == "__main__":
    print("iconos:")
    # La marca usa el terracota de la app como fondo para conservar contraste en
    # una pestaña de navegador y en la pantalla de inicio del teléfono.
    save(draw_mark(192, 0.16, ACCENT, gem_color=INK), "icon-192.png")
    save(draw_mark(512, 0.16, ACCENT, gem_color=INK), "icon-512.png")
    # Maskable: el sistema recorta hasta un 20% por lado, así que va con más aire.
    save(draw_mark(512, 0.28, ACCENT, gem_color=INK, radius_ratio=None, stroke_ratio=1.9), "icon-maskable-512.png")
    # iOS añade su propia máscara: dejamos el fondo lleno y la marca centrada.
    save(draw_mark(180, 0.17, ACCENT, gem_color=INK), "apple-touch-icon.png")
    # Favicon: fondo compacto y alianzas claras incluso a 16 px.
    save(draw_mark(32, 0.08, ACCENT, gem_color=INK, stroke_ratio=2.1), "favicon-32.png")
    save(draw_mark(16, 0.08, ACCENT, gem_color=INK, stroke_ratio=2.2), "favicon-16.png")
    ico = draw_mark(64, 0.08, ACCENT, gem_color=INK, stroke_ratio=2.1)
    ico.save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  public/favicon.ico")
