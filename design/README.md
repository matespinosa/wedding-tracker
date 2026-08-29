# Diseño de la app

Archivos fuente del canvas de diseño. Cada `.dc.html` es un artboard; `canvas.json`
los acomoda en dos páginas y define las notas.

## Página "Diseño"

Dirección C (terracota, mobile-first) llevada a moderno. Tres lecturas de la misma
pantalla de Resumen para escoger una:

| Archivo | Sabor |
|---|---|
| `Main.dc.html` | Editorial suave — plano, hairlines, numerales de serif grandes (va adelante) |
| `VarianteSuave.dc.html` | Suave con profundidad — superficies elevadas, radio 22, anillo delgado |
| `VarianteContraste.dc.html` | Alto contraste — bloque de tinta arriba, urgente como bloque sólido |

Más las dos pantallas del día a día, en el sabor que va adelante:

| Archivo | Pantalla |
|---|---|
| `Pendientes.dc.html` | Lista de Iglesia; lo hecho baja al fondo bajo su propia división |
| `Invitados.dc.html` | Lista de RSVP que alimenta el "faltan 34" del Resumen |

**Sistema:** Instrument Serif + Instrument Sans · fondo `#FAF8F5` · tinta `#1C1917` ·
apagado `#78706B` · hairline `#E8E3DD` · acento terracota `#C0563D` (dos usos por
pantalla) · salvia `#6F7F63` para lo hecho.

## Página "Descartadas"

`DireccionC.dc.html` es C tal como estaba antes de modernizarla, útil como antes/después.
`DireccionA` (papelería editorial), `DireccionB` (tablero denso) y `DireccionD`
(nocturno champagne) son las otras opciones de la primera ronda.

## Datos

Todos los números son de ejemplo: 120 invitados, 86 confirmados, 34 por confirmar
(12 iglesia, 22 recepción), tareas 4 de 16, corte 4 de 6, contrato el 7 de septiembre.
La fecha quedó como `[Fecha de la boda]` y la cuenta regresiva marca 187 días de ejemplo;
en la app se calculan desde `fecha_boda` en la pestaña Config. Los nombres de invitados
son inventados para el mockup.
