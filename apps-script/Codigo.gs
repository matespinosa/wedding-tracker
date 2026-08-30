/**
 * Wedding Tracker API for Google Sheets.
 * Replace TOKEN before deploying the script as a Web App.
 */
const TOKEN = 'CAMBIA_ESTE_TOKEN_LARGO_Y_PRIVADO';

const SCHEMAS = {
  Config: ['clave', 'valor'],
  Tareas: ['id', 'seccion', 'titulo', 'detalle', 'responsable', 'estado', 'prioridad', 'fecha_limite', 'origen', 'actualizado_en'],
  Invitados: ['id', 'nombre', 'grupo', 'lado', 'telefono', 'invitado_a', 'rsvp', 'acompanantes', 'transporte', 'mesa', 'notas', 'actualizado_en'],
  Corte: ['id', 'nombre', 'rol', 'confirmado', 'vestuario', 'notas'],
  Proveedores: ['id', 'proveedor', 'categoria', 'contacto', 'telefono', 'estado', 'monto_total', 'anticipo', 'saldo', 'fecha_pago', 'fecha_entrega', 'notas'],
};

function doGet(e) {
  try {
    validarToken_(e && e.parameter && e.parameter.token);
    const data = leerTodo_();
    data.ok = true;
    return responder_(data);
  } catch (error) {
    return responder_({ ok: false, error: String(error.message || error) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    validarToken_(request.token);
    validarHoja_(request.hoja);
    lock.waitLock(15000);

    let result;
    switch (request.accion) {
      case 'crear':
        result = crear_(request.hoja, request.payload || {});
        break;
      case 'actualizar':
        result = actualizar_(request.hoja, request.payload || {});
        break;
      case 'borrar':
        result = borrar_(request.hoja, request.payload && request.payload.id);
        break;
      default:
        throw new Error('Acción no soportada. Usa crear, actualizar o borrar.');
    }

    SpreadsheetApp.flush();
    return responder_({ ok: true, data: result });
  } catch (error) {
    return responder_({ ok: false, error: String(error.message || error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function configurarHojas() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SCHEMAS).forEach(function (name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    const headers = SCHEMAS[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1C1917')
      .setFontColor('#FAF8F5')
      .setFontWeight('bold');
    sheet.autoResizeColumns(1, headers.length);
  });

  configurarValidaciones_();
  configurarFormatoCondicional_();
  sembrarSiVacia_('Config', datosConfig_());
  sembrarSiVacia_('Tareas', datosTareas_());
  sembrarSiVacia_('Corte', datosCorte_());
  sembrarSiVacia_('Proveedores', datosProveedores_());

  SpreadsheetApp.getUi().alert('Wedding Tracker listo. Ya puedes desplegar este script como Aplicación web.');
}

function leerTodo_() {
  const result = {};
  Object.keys(SCHEMAS).forEach(function (name) {
    result[name] = leerHoja_(name);
  });
  return result;
}

function leerHoja_(name) {
  const sheet = obtenerHoja_(name);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function (row) {
    return row.some(function (cell) { return cell !== ''; });
  }).map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index] === undefined ? '' : row[index];
    });
    if (name === 'Invitados') item.personas = Math.max(1, Number(item.acompanantes || 0) + 1);
    return item;
  });
}

function crear_(name, payload) {
  const headers = SCHEMAS[name];
  const sheet = obtenerHoja_(name);
  const item = normalizar_(name, payload);
  if (headers.indexOf('id') >= 0) {
    item.id = item.id || Utilities.getUuid();
    if (buscarFilaPorId_(sheet, item.id) > 0) throw new Error('Ya existe un registro con ese id.');
  }
  sheet.appendRow(headers.map(function (header) { return item[header] === undefined ? '' : item[header]; }));
  return item;
}

function actualizar_(name, payload) {
  if (name === 'Config') return actualizarConfig_(payload);
  const headers = SCHEMAS[name];
  if (headers.indexOf('id') < 0) throw new Error('Esta hoja no admite actualización por id.');
  if (!payload.id) throw new Error('Falta el id del registro.');
  const sheet = obtenerHoja_(name);
  const rowNumber = buscarFilaPorId_(sheet, payload.id);
  if (rowNumber < 2) return crear_(name, payload);

  const currentValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const current = {};
  headers.forEach(function (header, index) { current[header] = currentValues[index]; });
  const updated = normalizar_(name, Object.assign({}, current, payload));
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map(function (header) { return updated[header] === undefined ? '' : updated[header]; }),
  ]);
  return updated;
}

function actualizarConfig_(payload) {
  if (!payload.clave) throw new Error('Falta la clave de configuración.');
  const sheet = obtenerHoja_('Config');
  const rowNumber = buscarFilaPorClave_(sheet, payload.clave);
  const value = payload.valor === undefined || payload.valor === null ? '' : String(payload.valor);
  if (rowNumber < 2) {
    sheet.appendRow([String(payload.clave), value]);
    return { clave: String(payload.clave), valor: value };
  }
  sheet.getRange(rowNumber, 2).setValue(value);
  return { clave: String(payload.clave), valor: value };
}

function borrar_(name, id) {
  if (!id) throw new Error('Falta el id del registro.');
  const sheet = obtenerHoja_(name);
  const rowNumber = buscarFilaPorId_(sheet, id);
  if (rowNumber < 2) throw new Error('No encontramos el registro.');
  sheet.deleteRow(rowNumber);
  return { id: id };
}

function normalizar_(name, payload) {
  const item = Object.assign({}, payload);
  if (name === 'Tareas' || name === 'Invitados') item.actualizado_en = new Date().toISOString();
  if (name === 'Invitados' && item.personas !== undefined && item.acompanantes === undefined) {
    item.acompanantes = Math.max(0, Number(item.personas || 1) - 1);
  }
  return item;
}

function buscarFilaPorId_(sheet, id) {
  if (sheet.getLastRow() < 2) return -1;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(id)) return index + 2;
  }
  return -1;
}

function buscarFilaPorClave_(sheet, clave) {
  if (sheet.getLastRow() < 2) return -1;
  const keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let index = 0; index < keys.length; index += 1) {
    if (String(keys[index][0]) === String(clave)) return index + 2;
  }
  return -1;
}

function obtenerHoja_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('La hoja ' + name + ' no existe. Ejecuta configurarHojas().');
  return sheet;
}

function validarToken_(token) {
  if (!TOKEN || TOKEN === 'CAMBIA_ESTE_TOKEN_LARGO_Y_PRIVADO') throw new Error('Configura TOKEN antes de publicar.');
  if (!token || token !== TOKEN) throw new Error('Token inválido.');
}

function validarHoja_(name) {
  if (!name || !SCHEMAS[name]) throw new Error('Hoja no permitida.');
}

function responder_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function sembrarSiVacia_(name, rows) {
  const sheet = obtenerHoja_(name);
  if (sheet.getLastRow() > 1 || !rows.length) return;
  sheet.getRange(2, 1, rows.length, SCHEMAS[name].length).setValues(rows);
}

function configurarValidaciones_() {
  const tareas = obtenerHoja_('Tareas');
  const invitados = obtenerHoja_('Invitados');
  const corte = obtenerHoja_('Corte');
  const proveedores = obtenerHoja_('Proveedores');

  aplicarLista_(tareas, 2, ['Iglesia', 'Recepción', 'General']);
  aplicarLista_(tareas, 5, ['Novio', 'Novia', 'Ambos']);
  aplicarLista_(tareas, 6, ['Pendiente', 'En progreso', 'Bloqueado', 'Listo']);
  aplicarLista_(tareas, 7, ['Alta', 'Media', 'Baja']);
  aplicarLista_(tareas, 9, ['Mía', 'Sugerida']);
  aplicarLista_(invitados, 6, ['Iglesia', 'Recepción', 'Ambas']);
  aplicarLista_(invitados, 7, ['Pendiente', 'Confirmado', 'No asiste']);
  aplicarLista_(invitados, 9, ['Uber', 'Interno', 'Propio', 'Por definir']);
  aplicarLista_(corte, 3, ['Dama', 'Caballero', 'Pajecito', 'Testigo']);
  aplicarLista_(corte, 4, ['Sí', 'No']);
  aplicarLista_(proveedores, 6, ['Por cotizar', 'Contactado', 'Separado', 'Pagado', 'Cancelado']);
}

function aplicarLista_(sheet, column, values) {
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  sheet.getRange(2, column, Math.max(1, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
}

function configurarFormatoCondicional_() {
  const sheet = obtenerHoja_('Tareas');
  const range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), SCHEMAS.Tareas.length);
  const ready = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$F2="Listo"').setBackground('#EAF0E6').setFontColor('#53634A').setRanges([range]).build();
  const overdue = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($H2<TODAY(),$H2<>"",$F2<>"Listo")').setBackground('#FBEFEA').setFontColor('#8F3D28').setRanges([range]).build();
  sheet.setConditionalFormatRules([ready, overdue]);
}

function datosConfig_() {
  return [
    ['nombres', ''],
    ['fecha_boda', ''],
    ['hora_iglesia', ''],
    ['lugar_iglesia', ''],
    ['hora_recepcion', ''],
    ['lugar_recepcion', ''],
  ];
}

function datosTareas_() {
  const now = new Date().toISOString();
  const rows = [
    ['ig-1', 'Iglesia', 'Damas y caballeros de la corte', 'Confirmar las 6 personas', 'Novia', 'Pendiente', 'Alta', '', 'Mía'],
    ['ig-2', 'Iglesia', 'Decoración de la iglesia', 'Confirmar montaje', 'Novia', 'Listo', 'Media', '', 'Mía'],
    ['ig-3', 'Iglesia', 'Testigos', 'Documentos y asistencia', 'Ambos', 'Listo', 'Alta', '', 'Mía'],
    ['ig-4', 'Iglesia', 'Pajecitos', 'Confirmar con los papás', 'Novia', 'Pendiente', 'Media', '', 'Mía'],
    ['ig-5', 'Iglesia', 'Carro de los novios', 'Cotizar y reservar', 'Novio', 'Pendiente', 'Media', '', 'Mía'],
    ['ig-6', 'Iglesia', 'Fotógrafa confirmada', 'Cobertura de ceremonia', 'Ambos', 'Listo', 'Alta', '', 'Mía'],
    ['ig-7', 'Iglesia', 'Protocolo de la iglesia', 'Pedirlo en la parroquia', 'Ambos', 'Pendiente', 'Alta', '', 'Mía'],
    ['ig-8', 'Iglesia', 'Lista de invitados a la iglesia', 'Revisar cupos y confirmaciones', 'Ambos', 'Pendiente', 'Alta', '', 'Mía'],
    ['rec-1', 'Recepción', 'DJ, equipo y staff', 'Confirmar montaje y horarios', 'Novio', 'Pendiente', 'Alta', '', 'Mía'],
    ['rec-2', 'Recepción', 'Fotógrafa de recepción', 'Incluir invitada y staff', 'Ambos', 'Listo', 'Alta', '', 'Mía'],
    ['rec-3', 'Recepción', 'Transporte de invitados', 'Definir Uber o transporte interno', 'Novio', 'Pendiente', 'Media', '', 'Mía'],
    ['rec-4', 'Recepción', 'Confirmación de invitados', 'Completar RSVP', 'Ambos', 'En progreso', 'Alta', '', 'Mía'],
    ['rec-5', 'Recepción', 'Contrato y cotización final', 'Revisar versión definitiva', 'Ambos', 'Pendiente', 'Alta', '2026-09-07', 'Mía'],
    ['gen-1', 'General', 'Fechas del traje del novio', 'Agendar prueba final', 'Novio', 'Pendiente', 'Media', '', 'Mía'],
    ['gen-2', 'General', 'Fechas del vestido de la novia', 'Confirmar última prueba', 'Novia', 'Pendiente', 'Alta', '', 'Mía'],
    ['gen-3', 'General', 'Hotel de noche de bodas', 'Revisar opciones y reservar', 'Ambos', 'Pendiente', 'Media', '', 'Mía'],
    ['sug-1', 'Iglesia', 'Argollas', 'Compra, talla y entrega', 'Ambos', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-2', 'Iglesia', 'Arras, lazo y biblia', 'Definir quién los lleva', 'Ambos', 'Pendiente', 'Media', '', 'Sugerida'],
    ['sug-3', 'Iglesia', 'Música de la ceremonia', 'Canciones y músicos', 'Ambos', 'Pendiente', 'Media', '', 'Sugerida'],
    ['sug-4', 'Iglesia', 'Plática y documentos', 'Confirmar requisitos', 'Ambos', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-5', 'General', 'Matrimonio civil', 'Documentos y fecha', 'Ambos', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-6', 'General', 'Invitaciones', 'Envío y seguimiento', 'Ambos', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-7', 'Recepción', 'Pastel', 'Sabor, tamaño y entrega', 'Novia', 'Pendiente', 'Media', '', 'Sugerida'],
    ['sug-8', 'Recepción', 'Prueba de menú y alergias', 'Cerrar menú final', 'Ambos', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-9', 'Recepción', 'Bar y bebidas', 'Cantidades y servicio', 'Novio', 'Pendiente', 'Media', '', 'Sugerida'],
    ['sug-10', 'General', 'Peinado y maquillaje', 'Prueba y horario del día', 'Novia', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-11', 'Recepción', 'Recuerdos', 'Elegir y encargar', 'Ambos', 'Pendiente', 'Baja', '', 'Sugerida'],
    ['sug-12', 'Recepción', 'Libro de firmas', 'Comprar y ubicar', 'Ambos', 'Pendiente', 'Baja', '', 'Sugerida'],
    ['sug-13', 'Recepción', 'Mesas y acomodo', 'Asignar invitados', 'Ambos', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-14', 'Recepción', 'Primer baile', 'Canción y ensayo', 'Ambos', 'Pendiente', 'Media', '', 'Sugerida'],
    ['sug-15', 'General', 'Luna de miel', 'Reservas y documentos', 'Ambos', 'Pendiente', 'Media', '', 'Sugerida'],
    ['sug-16', 'Recepción', 'Plan B por lluvia', 'Confirmar carpas o salón', 'Ambos', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-17', 'General', 'Timeline del día', 'Horarios y responsables', 'Ambos', 'Pendiente', 'Alta', '', 'Sugerida'],
    ['sug-18', 'Recepción', 'Video', 'Confirmar cobertura', 'Ambos', 'Pendiente', 'Media', '', 'Sugerida'],
    ['sug-19', 'General', 'Mesa de regalos', 'Crear y compartir', 'Ambos', 'Pendiente', 'Baja', '', 'Sugerida'],
    ['sug-20', 'General', 'Hospedaje de invitados', 'Compartir opciones', 'Ambos', 'Pendiente', 'Media', '', 'Sugerida'],
    ['sug-21', 'General', 'Efectivo para propinas', 'Preparar sobres', 'Novio', 'Pendiente', 'Baja', '', 'Sugerida'],
  ];
  return rows.map(function (row) { return row.concat([now]); });
}

function datosCorte_() {
  return [
    ['corte-1', '', 'Dama', 'Sí', '', ''],
    ['corte-2', '', 'Dama', 'Sí', '', ''],
    ['corte-3', '', 'Dama', 'No', '', ''],
    ['corte-4', '', 'Caballero', 'Sí', '', ''],
    ['corte-5', '', 'Caballero', 'No', '', ''],
    ['corte-6', '', 'Caballero', 'Sí', '', ''],
  ];
}

function datosProveedores_() {
  return [
    ['prov-1', '', 'DJ', '', '', 'Contactado', '', '', '', '', '', ''],
    ['prov-2', '', 'Fotografía', '', '', 'Separado', '', '', '', '', '', ''],
    ['prov-3', '', 'Salón', '', '', 'Contactado', '', '', '', '', '2026-09-07', 'Revisar contrato final'],
  ];
}
