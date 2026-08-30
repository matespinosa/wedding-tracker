# Wedding Tracker

Aplicación móvil en React para seguir tareas de Iglesia, Recepción y General, además del RSVP y transporte de invitados.

## Incluye

- Resumen con personas pendientes, confirmadas y progreso por sección.
- Tareas filtrables por responsable, con cambios optimistas y persistencia local.
- Estados de tarea claramente diferenciados: Pendiente, En progreso y Listo; la etiqueta permite avanzar el estado con un toque.
- Invitados filtrables y buscables, con edición rápida de RSVP y transporte.
- Formularios para agregar tareas, grupos de invitados y personas de la corte ceremonial.
- Conexión a Google Sheets sin configurar nada: la URL viene horneada en el build y la lectura del Web App es pública.
- Actualización casi en vivo: cada 12 s se consulta un número de versión en la hoja y solo se descarga el JSON completo cuando algo cambió.
- Configuración de la fecha de la boda (se sincroniza en `Config`) y override opcional de URL y token para apuntar a otra hoja.
- Cola local de cambios que intenta sincronizar de nuevo al recuperar conexión.
- PWA instalable con favicon de la marca, iconos para iOS/Android y caché del app shell para abrirla sin señal después de la primera visita.
- Backend de Google Sheets en [`apps-script/Codigo.gs`](./apps-script/Codigo.gs), pensado para el archivo de la invitación: lee Confirmacion y escribe solo pestañas `Tracker_*`.

## Desarrollo

```bash
npm install
npm run dev
```

La conexión sale de tres constantes al inicio de [`src/Prototype.tsx`](./src/Prototype.tsx) (`DEFAULT_API_URL`, `VERSION_CSV_URL`, `DEFAULT_TOKEN`), cada una con override por variable de entorno. Para desarrollo local crea un `.env.local` (ya ignorado por git):

```
VITE_SHEET_API_URL=https://script.google.com/macros/s/.../exec
VITE_SHEET_VERSION_URL=https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&single=true&output=csv
VITE_SHEET_TOKEN=el-token-del-apps-script
```

Sin esos valores la interfaz usa datos de ejemplo. Los cambios se conservan en `localStorage` incluso sin conexión.

## Instalar en el teléfono

La app se puede instalar desde la URL publicada usando el menú del navegador. En iPhone: **Compartir → Añadir a pantalla de inicio**. En Android: **menú ⋮ → Instalar app** o **Añadir a pantalla de inicio**. También puedes abrir Configuración dentro de la app para consultar la opción de instalación cuando el navegador la ofrezca.

## Verificación

```bash
npm run check:runtime
npm run build
npm run test:sites
```

La guía de Google Sheets está en [`apps-script/README.md`](./apps-script/README.md).

## Próximo paso: conectar y publicar

1. Crea un proyecto nuevo en [script.google.com](https://script.google.com) (no abras el Apps Script del formulario de la invitación). Pega [`apps-script/Codigo.gs`](./apps-script/Codigo.gs), cambia `TOKEN` y ejecuta `configurarHojasTracker()` una vez.
2. Despliega el proyecto como **Aplicación web** con acceso para cualquiera que tenga el enlace, y ejecuta **Wedding Tracker → Activar avisos en vivo para la app** desde el menú de la hoja.
3. Publica en la web **solo** la pestaña `Tracker_Version` en formato CSV y copia esa URL.
4. Pega la URL `/exec` y la URL del CSV en `DEFAULT_API_URL` y `VERSION_CSV_URL` de [`src/Prototype.tsx`](./src/Prototype.tsx) —no son secretos, la lectura es pública— o, si prefieres no versionarlas, créalas como variables del repositorio `SHEET_API_URL` y `SHEET_VERSION_URL`. Guarda el token como secret `SHEET_TOKEN`; el workflow inyecta los tres en el build.
5. Para GitHub Pages, sube el repositorio y habilita **Settings → Pages → Source: GitHub Actions**. El workflow [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml) calcula automáticamente el subpath del repositorio al construir los assets.

El detalle completo está en [`apps-script/README.md`](./apps-script/README.md).

No pongas el token en `README`, `.env` versionado ni en un commit público. Ten en cuenta que, al hornearse en el bundle, queda legible para quien inspeccione el JavaScript publicado: solo permite escribir en pestañas `Tracker_*`, nunca en las hojas de la invitación.
