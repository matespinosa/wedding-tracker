/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL /exec del Web App de Apps Script. La lectura es pública. */
  readonly VITE_SHEET_API_URL?: string;
  /** CSV de la pestaña Tracker_Version publicada en la web. */
  readonly VITE_SHEET_VERSION_URL?: string;
  /** Token de escritura, inyectado en el build desde el secret SHEET_TOKEN. */
  readonly VITE_SHEET_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
