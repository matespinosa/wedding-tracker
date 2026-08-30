# Wedding Tracker

Aplicación móvil en React para seguir tareas de Iglesia, Recepción y General, además del RSVP y transporte de invitados.

## Incluye

- Resumen con personas pendientes, confirmadas y progreso por sección.
- Tareas filtrables por responsable, con cambios optimistas y persistencia local.
- Invitados filtrables y buscables, con edición rápida de RSVP y transporte.
- Formularios para agregar tareas y grupos de invitados.
- Configuración de fecha, URL y token del Google Apps Script; la fecha también se sincroniza en `Config`.
- Cola local de cambios que intenta sincronizar de nuevo al recuperar conexión.
- Backend de Google Sheets en [`apps-script/Codigo.gs`](./apps-script/Codigo.gs).

## Desarrollo

```bash
npm install
npm run dev
```

La interfaz usa datos de ejemplo hasta que se configure el Web App desde el engranaje de Resumen. Los cambios se conservan en `localStorage` incluso sin conexión.

## Verificación

```bash
npm run check:runtime
npm run build
npm run test:sites
```

La guía de Google Sheets está en [`apps-script/README.md`](./apps-script/README.md).

## Próximo paso: conectar y publicar

1. En Google Sheets, abre **Extensiones → Apps Script**, pega [`apps-script/Codigo.gs`](./apps-script/Codigo.gs), cambia `TOKEN` por un valor largo y privado y ejecuta `configurarHojas()` una vez.
2. Despliega el proyecto como **Aplicación web** con acceso para cualquiera que tenga el enlace. Copia la URL que termina en `/exec` y configura ambos valores desde el engranaje de la app.
3. Para GitHub Pages, sube el repositorio y habilita **Settings → Pages → Source: GitHub Actions**. El workflow [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml) calcula automáticamente el subpath del repositorio al construir los assets.

No pongas el token en `README`, `.env` versionado ni en un commit público.
