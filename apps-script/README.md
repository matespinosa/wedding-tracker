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

Los invitados de la recepción salen del cruce de Confirmacion + lista + envío. No hay una pestaña `Invitados` aparte, para no chocar con la invitación.

## 1. Crear un Apps Script nuevo (no el de la invitación)

Si el formulario de la invitación ya tiene un proyecto en **Extensiones > Apps Script**, no lo toques: ahí viven `doGet`/`doPost` de ese otro proyecto.

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Pega [`Codigo.gs`](./Codigo.gs). El ID del Sheet ya está en `SPREADSHEET_ID`.
3. Cambia `CAMBIA_ESTE_TOKEN_LARGO_Y_PRIVADO` por un token aleatorio de al menos 32 caracteres.
4. Guarda y ejecuta **una vez** `configurarHojasTracker`.
5. Acepta los permisos (tiene que poder abrir ese Spreadsheet).

La función solo inserta pestañas `Tracker_*` si faltan y agrega filas nuevas por `clave` cuando una pestaña ya existe. No sobreescribe información que ya hayas editado. Confirmacion y el resto de la invitación quedan como están.

## 2. Publicar el Web App

1. **Implementar > Nueva implementación** → **Aplicación web**.
2. **Ejecutar como: Yo**.
3. **Quién tiene acceso: Cualquier usuario**.
4. Copia la URL que termina en `/exec`.

Cada cambio de `Codigo.gs` pide una versión nueva en **Administrar implementaciones**.

El GET (`?token=...`) responde `Config`, `Tareas`, `Corte`, `Iglesia`, `Recepcion` e `Invitados` (estos últimos calculados, no son una pestaña). El POST solo escribe pestañas `Tracker_*`.

## 3. Conectar la app

1. Abre Wedding Tracker y toca el engranaje en Resumen.
2. Pega la URL del Web App y el mismo token.
3. Toca **Guardar y sincronizar**.

La app lee el Sheet automáticamente al abrirse cuando las credenciales ya están guardadas, al volver a enfocar la ventana y cada minuto mientras está abierta. También puedes volver a tocar **Guardar y sincronizar** para forzar una lectura. Cada POST usa `Content-Type: text/plain;charset=utf-8`; ordenar filas en las pestañas `Tracker_*` no rompe la sincronización porque busca por `id` o `clave`. Si editas sin conexión, el cambio queda en una cola local y se reintenta al recuperar la conexión.

## Privacidad

La interfaz puede ser un sitio estático; los nombres viven en tu Google Sheet. Quien tenga la URL del Web App y el token puede leer esos datos. Trátalos como credenciales.
