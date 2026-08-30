# Conectar Wedding Tracker con Google Sheets

Usa **el mismo archivo de la invitación**. Wedding Tracker no reemplaza esas pestañas: solo lee invitados de ahí y escribe en pestañas nuevas que empiezan por `Tracker_`.

Archivo: [Lista de invitados](https://docs.google.com/spreadsheets/d/1ieuTTS32rXfHM07_hSpEZ6xFUszWkU63avGuN_5W994/edit)

## Qué queda intacto

Estas pestañas las sigue usando el proyecto de la invitación. El script **no las crea, no las borra y no escribe en ellas**:

- **Confirmacion** — respuestas del formulario (nombre, teléfono, asistencia, menú).
- **Lista de invitados** — master TRUE / FALSE / X.
- **Hoja de envío** — invitado principal, acompañante, tipo, estado de invitación.

El RSVP y el plato de quien ya llenó el formulario se leen de Confirmacion. Si en la app cambian transporte o agregan a alguien, eso va a `Tracker_InvitadosExtra`, no al formulario.

## Pestañas nuevas (color verde)

| Pestaña | Para qué |
| --- | --- |
| `Tracker_Config` | Fecha, horas y lugares |
| `Tracker_Iglesia` | Hora, lugar, decoración, fotografía, protocolo, carro, música |
| `Tracker_Corte` | Damas de la corte, caballeros de la corte, testigos, pajecitos (incluidas las nuevas personas que agregues desde la app) |
| `Tracker_Recepcion` | Hora, lugar, fotografía, DJ, itinerario, baile, transporte, contrato |
| `Tracker_Tareas` | Checklist de Iglesia / Recepción / General |
| `Tracker_InvitadosExtra` | Transporte, mesa y gente que agreguen desde esta app |
| `Tracker_Version` | Una sola celda con un número que sube en cada cambio. Es lo que la app sondea para enterarse en segundos |

Los invitados de la recepción salen del cruce de Confirmacion + lista + envío. No hay una pestaña `Invitados` aparte, para no chocar con la invitación.

## 1. Crear un Apps Script nuevo (no el de la invitación)

Si el formulario de la invitación ya tiene un proyecto en **Extensiones > Apps Script**, no lo toques: ahí viven `doGet`/`doPost` de ese otro proyecto.

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Pega [`Codigo.gs`](./Codigo.gs). El ID del Sheet ya está en `SPREADSHEET_ID`.
3. Cambia `CAMBIA_ESTE_TOKEN_LARGO_Y_PRIVADO` por un token aleatorio de al menos 32 caracteres.
4. Guarda y ejecuta **una vez** `configurarHojasTracker`.
5. Acepta los permisos (tiene que poder abrir ese Spreadsheet).
6. Ejecuta **una vez** `instalarTriggers` (o usa el menú **Wedding Tracker → Activar avisos en vivo para la app**). Instala un trigger `onChange` que actualiza `Tracker_Version` cada vez que alguien edita la hoja, incluidas las respuestas del formulario de la invitación. Lo único que hace ese trigger es escribir esa celda: no lee ni modifica la pestaña que cambió. Lleva un antirrebote de 2 segundos para no dispararse a sí mismo en bucle; si dos ediciones caen dentro de esa ventana, la segunda puede tardar hasta la relectura completa de los 5 minutos en aparecer.

La función solo inserta pestañas `Tracker_*` si faltan y agrega filas nuevas por `clave` cuando una pestaña ya existe. No sobreescribe información que ya hayas editado. Confirmacion y el resto de la invitación quedan como están.

## 2. Publicar el Web App

1. **Implementar > Nueva implementación** → **Aplicación web**.
2. **Ejecutar como: Yo**.
3. **Quién tiene acceso: Cualquier usuario**.
4. Copia la URL que termina en `/exec`.

Cada cambio de `Codigo.gs` pide una versión nueva en **Administrar implementaciones**.

El GET responde `Config`, `Tareas`, `Corte`, `Iglesia`, `Recepcion` e `Invitados` (estos últimos calculados, no son una pestaña) y **no pide token**: una app estática no puede guardar un secreto, así que la lectura es pública a propósito. El POST sí exige el token y solo escribe pestañas `Tracker_*`.

`?check=1` devuelve únicamente `{ ok: true, version }`. Es el respaldo del sondeo si no publicas el CSV.

## 3. Publicar el latido de versión

1. **Archivo → Compartir → Publicar en la web**.
2. En el desplegable elige **solo la pestaña `Tracker_Version`** y el formato **CSV**. No publiques el documento entero.
3. Copia la URL, del estilo `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=...&single=true&output=csv`.

Eso expone una celda con un número, nada más. La app la consulta cada 12 segundos —es una petición de pocos bytes que sirve la infraestructura estática de Google, sin gastar cuota de Apps Script— y solo pide el JSON completo cuando el número cambió.

## 4. Conectar la app

Nadie tiene que teclear credenciales. Pega la URL `/exec` en `DEFAULT_API_URL` y la URL del CSV en `VERSION_CSV_URL`, ambas al inicio de `src/Prototype.tsx`, y guarda el token como secret `SHEET_TOKEN` del repositorio (el workflow de GitHub Pages lo inyecta en el build). Desde ese momento cualquier dispositivo que abra la app ve los datos reales de inmediato.

Los campos de URL y token del engranaje siguen ahí, dentro de **Avanzado (opcional)**, por si quieres apuntar la app a una hoja de pruebas.

La app lee al abrirse, al volver a enfocar la ventana, al recuperar conexión y cada vez que el número de versión cambia. Además fuerza una lectura completa cada cinco minutos por si el trigger se perdiera un evento. Cada POST usa `Content-Type: text/plain;charset=utf-8`; ordenar filas en las pestañas `Tracker_*` no rompe la sincronización porque busca por `id` o `clave`. Si editas sin conexión, el cambio queda en una cola local y se reintenta al recuperar la conexión.

## Privacidad

Esta configuración cambia la privacidad a propósito: **la lectura es pública**. Cualquiera que descubra la URL `/exec` puede ver los nombres, teléfonos y RSVP de tus invitados. Fue una decisión consciente a cambio de que nadie tenga que configurar credenciales.

El token de escritura queda dentro del JavaScript publicado, así que tampoco es un secreto real; lo que protege es el alcance: `validarHoja_` y `esHojaTracker_` impiden escribir fuera de las pestañas `Tracker_*`, de modo que Confirmacion, Lista de invitados y la hoja de envío no se pueden tocar desde la API.
