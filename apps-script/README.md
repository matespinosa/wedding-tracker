# Conectar Wedding Tracker con Google Sheets

La hoja es la fuente de verdad. La app guarda una copia local para abrir rápido y enviar cambios aunque la conexión falle temporalmente.

## 1. Crear la hoja

1. Crea un Google Sheet vacío.
2. Abre **Extensiones > Apps Script**.
3. Reemplaza el contenido del editor por [`Codigo.gs`](./Codigo.gs).
4. Cambia `CAMBIA_ESTE_TOKEN_LARGO_Y_PRIVADO` por un token aleatorio de al menos 32 caracteres. No lo publiques ni lo subas a un repositorio público.
5. Guarda y ejecuta `configurarHojas()` una sola vez.
6. Acepta los permisos solicitados por Google.

La función crea las pestañas Config, Tareas, Invitados, Corte y Proveedores, junto con validaciones, formatos y datos iniciales. No vuelve a sembrar una pestaña que ya tenga filas.

## 2. Publicar el Web App

1. En Apps Script selecciona **Implementar > Nueva implementación**.
2. Elige **Aplicación web**.
3. Configura **Ejecutar como: Yo**.
4. Configura **Quién tiene acceso: Cualquier usuario**.
5. Implementa y copia la URL que termina en `/exec`.

Cada cambio posterior de `Codigo.gs` requiere crear una versión nueva desde **Administrar implementaciones**.

## 3. Conectar la app

1. Abre Wedding Tracker.
2. Toca el engranaje en Resumen.
3. Pega la URL del Web App y el mismo token.
4. Toca **Guardar y sincronizar**.

La app envía los POST con `Content-Type: text/plain;charset=utf-8`. Esto evita el preflight CORS que Apps Script no maneja bien. Las actualizaciones de tareas e invitados buscan cada registro por `id`, así que ordenar o filtrar filas en el Sheet no rompe la sincronización. La fecha de la boda se guarda como `clave=fecha_boda` en `Config`.

## Privacidad

La interfaz puede publicarse como sitio estático, pero los nombres permanecen en tu Google Sheet. Cualquier persona que consiga tanto la URL del Web App como el token podría consultar los datos; trata ambos como credenciales privadas.
