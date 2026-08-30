/**
 * Wedding Tracker — API sobre el mismo Google Sheet de la invitación.
 *
 * Este script se pega en un proyecto de Apps Script NUEVO (no en el del
 * formulario de la invitación). Abre el archivo por ID:
 *   https://docs.google.com/spreadsheets/d/1ieuTTS32rXfHM07_hSpEZ6xFUszWkU63avGuN_5W994
 *
 * REGLA DE ORO: nunca crea, borra, renombra ni escribe en pestañas que no
 * empiecen por Tracker_. Confirmacion, Lista de invitados y la hoja de envío
 * siguen siendo exclusivas del proyecto de la invitación.

 *
 * Los invitados se LEEN en vivo de esas pestañas. Transporte, mesa y gente
 * que agreguen desde esta app viven en Tracker_InvitadosExtra.
 */
const TOKEN = 'CAMBIA_ESTE_TOKEN_LARGO_Y_PRIVADO';
const SPREADSHEET_ID = '1ieuTTS32rXfHM07_hSpEZ6xFUszWkU63avGuN_5W994';

const HOJAS_FISICAS = {
  Config: 'Tracker_Config',
  Tareas: 'Tracker_Tareas',
  Corte: 'Tracker_Corte',
  Iglesia: 'Tracker_Iglesia',
  Recepcion: 'Tracker_Recepcion',
  InvitadosExtra: 'Tracker_InvitadosExtra',
};

const SCHEMAS = {
  Config: ['clave', 'valor'],
  Tareas: ['id', 'seccion', 'titulo', 'detalle', 'responsable', 'estado', 'prioridad', 'fecha_limite', 'origen', 'actualizado_en'],
  Corte: ['id', 'nombre', 'rol', 'confirmado', 'telefono', 'notas'],
  Iglesia: ['clave', 'titulo', 'valor', 'estado', 'responsable', 'notas', 'fecha_limite'],
  Recepcion: ['clave', 'titulo', 'valor', 'estado', 'responsable', 'notas', 'fecha_limite'],
  InvitadosExtra: ['id', 'nombre', 'rsvp', 'transporte', 'mesa', 'invitado_a', 'plato', 'acompanantes', 'notas', 'actualizado_en'],
};

const HOJAS_POR_CLAVE = { Config: true, Iglesia: true, Recepcion: true };
const COLOR_PESTANA = '#6F7F63';

function libro_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function avisar_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    Logger.log(message);
  }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Wedding Tracker')
      .addItem('Crear pestañas del tracker (no toca la invitación)', 'configurarHojasTracker')
      .addToUi();
  } catch (error) {
    Logger.log('onOpen solo aplica si el script está vinculado al Sheet.');
  }
}

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
    const hoja = normalizarHojaApi_(request.hoja);
    validarHoja_(hoja);
    lock.waitLock(15000);

    let result;
    switch (request.accion) {
      case 'crear':
        result = crear_(hoja, request.payload || {});
        break;
      case 'actualizar':
        result = actualizar_(hoja, request.payload || {});
        break;
      case 'borrar':
        result = borrar_(hoja, request.payload && request.payload.id);
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
  configurarHojasTracker();
}

function configurarHojasTracker() {
  const spreadsheet = libro_();
  const creadas = [];
  const yaEstaban = [];

  Object.keys(HOJAS_FISICAS).forEach(function (apiName) {
    const physical = HOJAS_FISICAS[apiName];
    let sheet = spreadsheet.getSheetByName(physical);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(physical);
      creadas.push(physical);
    } else {
      yaEstaban.push(physical);
    }
    asegurarEncabezados_(sheet, SCHEMAS[apiName]);
    sheet.setTabColor(COLOR_PESTANA);
  });

  configurarValidaciones_();
  configurarFormatoCondicional_();
  sembrarSiVacia_('Config', datosConfig_());
  sembrarSiVacia_('Tareas', datosTareas_());
  sembrarSiVacia_('Corte', datosCorte_());
  const iglesiaRows = datosIglesia_();
  sembrarSiVacia_('Iglesia', iglesiaRows);
  asegurarFilasPorClave_('Iglesia', iglesiaRows);
  sembrarSiVacia_('Recepcion', datosRecepcion_());

  const protegidas = spreadsheet.getSheets()
    .map(function (sheet) { return sheet.getName(); })
    .filter(function (name) { return !esHojaTracker_(name); });

  const mensaje =
    'Wedding Tracker listo.\n\n' +
    (creadas.length ? 'Pestañas nuevas: ' + creadas.join(', ') + '.\n' : 'No hizo falta crear pestañas nuevas.\n') +
    (yaEstaban.length ? 'Ya existían: ' + yaEstaban.join(', ') + '.\n' : '') +
    'Sin tocar: ' + (protegidas.length ? protegidas.join(', ') : 'ninguna') + '.\n\n' +
    'Los invitados se leen de Confirmacion, Lista de invitados y la hoja de envío. No se reescriben.';
  Logger.log(mensaje);
  avisar_(mensaje);
}

function importarConfirmadosConPlato() {
  avisar_(
    'Ya no hay que importar invitados. El GET de Wedding Tracker los lee en vivo de Confirmacion y de las otras pestañas de la invitación. Transporte y notas del tracker van a Tracker_InvitadosExtra.'
  );
}

function leerTodo_() {
  const result = {
    Config: leerHoja_('Config'),
    Tareas: leerHoja_('Tareas'),
    Corte: leerHoja_('Corte'),
    Iglesia: leerHoja_('Iglesia'),
    Recepcion: leerHoja_('Recepcion'),
    Invitados: leerInvitados_(),
  };
  result['Recepción'] = result.Recepcion;
  return result;
}

function leerHoja_(apiName) {
  const sheet = obtenerHoja_(apiName);
  const headers = SCHEMAS[apiName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
  return values.filter(function (row) {
    return row.some(function (cell) { return cell !== ''; });
  }).map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index] === undefined ? '' : row[index];
    });
    return item;
  });
}

function leerInvitados_() {
  const book = libro_();
  const hojas = encontrarHojasInvitacion_(book);
  const extras = indexarExtras_(leerHoja_('InvitadosExtra'));
  const porNombre = {};
  const orden = [];

  if (hojas.confirmacion) fusionarConfirmacion_(hojas.confirmacion, porNombre, orden);
  if (hojas.lista) fusionarLista_(hojas.lista, porNombre, orden);
  if (hojas.envio) fusionarEnvio_(hojas.envio, porNombre, orden);

  Object.keys(extras).forEach(function (key) {
    const extra = extras[key];
    const match = porNombre[key] || (extra.nombre ? porNombre[normalizarNombre_(extra.nombre)] : null);
    if (match) {
      aplicarExtra_(match, extra);
      return;
    }
    const guest = invitadoBase_(extra.nombre || 'Invitado', extra);
    guest.fuente = 'tracker';
    guest.id = extra.id || guest.id;
    aplicarExtra_(guest, extra);
    porNombre[normalizarNombre_(guest.nombre)] = guest;
    orden.push(guest);
  });

  return orden.map(function (guest) {
    guest.personas = Math.max(1, Number(guest.personas || Number(guest.acompanantes || 0) + 1));
    guest.acompanantes = Math.max(0, guest.personas - 1);
    if (guest.plato !== 'Pollo' && guest.plato !== 'Carne') {
      if (guest.notas === 'Pollo' || guest.notas === 'Carne') guest.plato = guest.notas;
    }
    return guest;
  });
}

function fusionarConfirmacion_(sheet, porNombre, orden) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return;
  const headers = values[0].map(function (header) { return String(header).toLowerCase(); });
  const nameIndex = indiceColumna_(headers, ['nombre']);
  const phoneIndex = indiceColumna_(headers, ['teléfono', 'telefono']);
  const rsvpIndex = indiceColumna_(headers, ['asistencia']);
  const mealIndex = indiceColumna_(headers, ['menú', 'menu']);
  if (nameIndex < 0) return;

  const phoneGroups = {};
  const filas = [];
  values.slice(1).forEach(function (row) {
    const nombre = limpiarNombre_(row[nameIndex]);
    if (!nombre) return;
    const asistencia = String(row[rsvpIndex] || '').trim();
    const plato = mealIndex >= 0 ? String(row[mealIndex] || '').trim() : '';
    const telefono = phoneIndex >= 0 ? String(row[phoneIndex] || '').trim() : '';
    if (!asistencia && !plato) return;
    filas.push({ nombre: nombre, telefono: telefono, asistencia: asistencia, plato: plato });
    const key = claveTelefono_(telefono);
    if (key) {
      if (!phoneGroups[key]) phoneGroups[key] = [];
      if (phoneGroups[key].indexOf(nombre) < 0) phoneGroups[key].push(nombre);
    }
  });

  const groupLabel = {};
  Object.keys(phoneGroups).forEach(function (key) {
    groupLabel[key] = etiquetaGrupo_(phoneGroups[key]);
  });

  filas.forEach(function (item) {
    const key = normalizarNombre_(item.nombre);
    let guest = porNombre[key];
    if (!guest) {
      guest = invitadoBase_(item.nombre, { telefono: item.telefono });
      porNombre[key] = guest;
      orden.push(guest);
    }
    guest.fuente = 'formulario';
    guest.telefono = item.telefono || guest.telefono;
    guest.grupo = groupLabel[claveTelefono_(item.telefono)] || guest.grupo || item.nombre;
    guest.invitado_a = guest.invitado_a || 'Recepción';
    guest.rsvp = rsvpDesdeAsistencia_(item.asistencia);
    if (item.plato === 'Pollo' || item.plato === 'Carne') guest.plato = item.plato;
  });
}

function fusionarLista_(sheet, porNombre, orden) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return;
  const values = sheet.getRange(1, 1, lastRow, Math.max(4, sheet.getLastColumn())).getDisplayValues();
  values.forEach(function (row) {
    const nombre = limpiarNombre_(row[0]);
    const estado = String(row[2] || '').trim().toUpperCase();
    const nota = String(row[3] || '').trim().toUpperCase();
    if (!nombre || !esEstadoLista_(estado)) return;
    const key = normalizarNombre_(nombre);
    if (porNombre[key]) return;
    const guest = invitadoBase_(nombre, {});
    guest.fuente = 'lista';
    guest.invitado_a = 'Recepción';
    if (estado === 'TRUE') guest.rsvp = 'Confirmado';
    else if (estado === 'X') guest.rsvp = 'No asiste';
    else guest.rsvp = nota === 'P' ? 'Pendiente' : 'No asiste';
    porNombre[key] = guest;
    orden.push(guest);
  });
}

function fusionarEnvio_(sheet, porNombre, orden) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return;
  const headers = values[0].map(function (header) { return String(header).toLowerCase(); });
  const principalIndex = indiceColumna_(headers, ['invitado principal / grupo', 'invitado principal', 'grupo']);
  const guestIndex = principalIndex >= 0 ? principalIndex : 1;
  const companionIndex = indiceColumna_(headers, ['acompañante', 'acompanante']);
  const typeIndex = indiceColumna_(headers, ['tipo']);
  const statusIndex = indiceColumna_(headers, ['estado de invitación', 'estado de invitacion']);

  values.slice(1).forEach(function (row) {
    const nombre = limpiarNombre_(row[guestIndex]);
    if (!nombre) return;
    const key = normalizarNombre_(nombre);
    if (porNombre[key]) return;
    const tipo = typeIndex >= 0 ? String(row[typeIndex] || '').trim() : '';
    const acompanante = companionIndex >= 0 ? limpiarNombre_(row[companionIndex]) : '';
    const estadoInvitacion = statusIndex >= 0 ? String(row[statusIndex] || '').trim() : '';
    const guest = invitadoBase_(nombre, {});
    guest.fuente = 'invitacion';
    guest.invitado_a = 'Recepción';
    guest.rsvp = 'Pendiente';
    guest.personas = personasDesdeTipo_(tipo, acompanante);
    guest.notas = [acompanante, estadoInvitacion].filter(Boolean).join(' · ');
    porNombre[key] = guest;
    orden.push(guest);
  });
}

function invitadoBase_(nombre, seed) {
  const item = {
    id: idInvitado_(nombre, seed && seed.telefono),
    nombre: nombre,
    grupo: (seed && seed.grupo) || nombre,
    lado: '',
    telefono: (seed && seed.telefono) || '',
    invitado_a: 'Recepción',
    rsvp: 'Pendiente',
    acompanantes: 0,
    personas: 1,
    transporte: 'Por definir',
    mesa: '',
    notas: '',
    plato: '',
    fuente: 'lista',
    actualizado_en: '',
  };
  return item;
}

function aplicarExtra_(guest, extra) {
  if (extra.id) guest.id = extra.id;
  if (guest.fuente !== 'formulario') {
    if (extra.rsvp) guest.rsvp = extra.rsvp;
    if (extra.plato) guest.plato = extra.plato;
  }
  if (extra.transporte) guest.transporte = extra.transporte;
  if (extra.mesa) guest.mesa = extra.mesa;
  if (extra.invitado_a) guest.invitado_a = extra.invitado_a;
  if (extra.notas) guest.notas = extra.notas;
  if (extra.acompanantes !== undefined && extra.acompanantes !== '') {
    guest.acompanantes = Number(extra.acompanantes || 0);
    guest.personas = Math.max(1, Number(extra.acompanantes || 0) + 1);
  }
  if (extra.actualizado_en) guest.actualizado_en = extra.actualizado_en;
}

function indexarExtras_(rows) {
  const map = {};
  rows.forEach(function (row) {
    const key = row.id ? String(row.id) : normalizarNombre_(row.nombre);
    if (!key) return;
    map[key] = row;
    if (row.nombre) map[normalizarNombre_(row.nombre)] = row;
  });
  return map;
}

function crear_(apiName, payload) {
  const resolved = apiName === 'Invitados' ? 'InvitadosExtra' : apiName;
  const headers = SCHEMAS[resolved];
  const sheet = obtenerHoja_(resolved);
  const item = normalizar_(resolved, payload);
  if (headers.indexOf('id') >= 0) {
    item.id = item.id || Utilities.getUuid();
    if (buscarFilaPorColumna_(sheet, 1, item.id) > 0) throw new Error('Ya existe un registro con ese id.');
  }
  sheet.appendRow(headers.map(function (header) { return item[header] === undefined ? '' : item[header]; }));
  return item;
}

function actualizar_(apiName, payload) {
  if (apiName === 'Invitados') return upsertInvitadoExtra_(payload);
  const resolved = apiName;
  if (HOJAS_POR_CLAVE[resolved]) return actualizarPorClave_(resolved, payload);
  const headers = SCHEMAS[resolved];
  if (headers.indexOf('id') < 0) throw new Error('Esta hoja no admite actualización por id.');
  if (!payload.id) throw new Error('Falta el id del registro.');
  const sheet = obtenerHoja_(resolved);
  const rowNumber = buscarFilaPorColumna_(sheet, 1, payload.id);
  if (rowNumber < 2) return crear_(resolved, payload);

  const currentValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const current = {};
  headers.forEach(function (header, index) { current[header] = currentValues[index]; });
  const updated = normalizar_(resolved, Object.assign({}, current, payload));
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map(function (header) { return updated[header] === undefined ? '' : updated[header]; }),
  ]);
  return updated;
}

function actualizarPorClave_(apiName, payload) {
  if (!payload.clave) throw new Error('Falta la clave.');
  const headers = SCHEMAS[apiName];
  const sheet = obtenerHoja_(apiName);
  const rowNumber = buscarFilaPorColumna_(sheet, 1, payload.clave);
  if (rowNumber < 2) return crear_(apiName, payload);

  const currentValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const current = {};
  headers.forEach(function (header, index) { current[header] = currentValues[index]; });
  const updated = Object.assign({}, current, payload);
  if (apiName === 'Config') updated.valor = payload.valor === undefined || payload.valor === null ? '' : String(payload.valor);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map(function (header) { return updated[header] === undefined ? '' : updated[header]; }),
  ]);
  return updated;
}

function upsertInvitadoExtra_(payload) {
  const headers = SCHEMAS.InvitadosExtra;
  const sheet = obtenerHoja_('InvitadosExtra');
  const item = normalizar_('InvitadosExtra', payload);
  if (!item.id) item.id = idInvitado_(item.nombre, payload.telefono);
  let rowNumber = buscarFilaPorColumna_(sheet, 1, item.id);
  if (rowNumber < 2 && item.nombre) rowNumber = buscarFilaPorColumna_(sheet, 2, item.nombre);
  if (rowNumber < 2) {
    sheet.appendRow(headers.map(function (header) { return item[header] === undefined ? '' : item[header]; }));
    return item;
  }
  const currentValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const current = {};
  headers.forEach(function (header, index) { current[header] = currentValues[index]; });
  const updated = Object.assign({}, current, item);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map(function (header) { return updated[header] === undefined ? '' : updated[header]; }),
  ]);
  return updated;
}

function borrar_(apiName, id) {
  if (apiName === 'Invitados') apiName = 'InvitadosExtra';
  if (!id) throw new Error('Falta el id del registro.');
  const sheet = obtenerHoja_(apiName);
  const rowNumber = buscarFilaPorColumna_(sheet, 1, id);
  if (rowNumber < 2) throw new Error('No encontramos el registro del tracker. Las filas de la invitación no se borran desde aquí.');
  sheet.deleteRow(rowNumber);
  return { id: id };
}

function normalizar_(apiName, payload) {
  const item = Object.assign({}, payload);
  if (apiName === 'Tareas' || apiName === 'InvitadosExtra') item.actualizado_en = new Date().toISOString();
  if (apiName === 'InvitadosExtra') {
    if (item.personas !== undefined && item.acompanantes === undefined) {
      item.acompanantes = Math.max(0, Number(item.personas || 1) - 1);
    }
    if (item.plato && !item.notas) item.notas = item.plato;
  }
  return item;
}

function buscarFilaPorColumna_(sheet, column, value) {
  if (sheet.getLastRow() < 2) return -1;
  const cells = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let index = 0; index < cells.length; index += 1) {
    if (String(cells[index][0]) === String(value)) return index + 2;
  }
  return -1;
}

function obtenerHoja_(apiName) {
  const physical = HOJAS_FISICAS[apiName] || HOJAS_FISICAS[normalizarHojaApi_(apiName)];
  if (!physical) throw new Error('Hoja no permitida.');
  const sheet = libro_().getSheetByName(physical);
  if (!sheet) throw new Error('Falta la pestaña ' + physical + '. Ejecuta configurarHojasTracker() desde el menú Wedding Tracker.');
  return sheet;
}

function asegurarEncabezados_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1C1917')
    .setFontColor('#FAF8F5')
    .setFontWeight('bold');
  sheet.autoResizeColumns(1, headers.length);
}

function validarToken_(token) {
  if (!TOKEN || TOKEN === 'CAMBIA_ESTE_TOKEN_LARGO_Y_PRIVADO') throw new Error('Configura TOKEN antes de publicar.');
  if (!token || token !== TOKEN) throw new Error('Token inválido.');
}

function validarHoja_(name) {
  if (!name) throw new Error('Hoja no permitida.');
  if (HOJAS_FISICAS[name] || name === 'Invitados') return;
  throw new Error('Hoja no permitida.');
}

function normalizarHojaApi_(name) {
  if (name === 'Recepción') return 'Recepcion';
  return name;
}

function esHojaTracker_(name) {
  return String(name || '').indexOf('Tracker_') === 0;
}

function responder_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function sembrarSiVacia_(apiName, rows) {
  const sheet = obtenerHoja_(apiName);
  if (sheet.getLastRow() > 1 || !rows.length) return;
  sheet.getRange(2, 1, rows.length, SCHEMAS[apiName].length).setValues(rows);
}

function asegurarFilasPorClave_(apiName, rows) {
  const sheet = obtenerHoja_(apiName);
  const headers = SCHEMAS[apiName];
  const keyIndex = headers.indexOf('clave');
  if (keyIndex < 0 || !rows.length) return;

  const existing = sheet.getLastRow() < 2
    ? []
    : sheet.getRange(2, keyIndex + 1, sheet.getLastRow() - 1, 1).getDisplayValues().map(function (row) { return String(row[0]); });
  const missing = rows.filter(function (row) { return existing.indexOf(String(row[keyIndex])) < 0; });
  if (missing.length) sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, headers.length).setValues(missing);
}

function configurarValidaciones_() {
  const tareas = obtenerHoja_('Tareas');
  const corte = obtenerHoja_('Corte');
  const iglesia = obtenerHoja_('Iglesia');
  const recepcion = obtenerHoja_('Recepcion');
  const extra = obtenerHoja_('InvitadosExtra');

  aplicarLista_(tareas, 2, ['Iglesia', 'Recepción', 'General']);
  aplicarLista_(tareas, 5, ['Novio', 'Novia', 'Ambos']);
  aplicarLista_(tareas, 6, ['Pendiente', 'En progreso', 'Bloqueado', 'Listo']);
  aplicarLista_(tareas, 7, ['Alta', 'Media', 'Baja']);
  aplicarLista_(tareas, 9, ['Mía', 'Sugerida']);
  aplicarLista_(corte, 3, ['Dama de la corte', 'Caballero de la corte', 'Testigo', 'Pajecito']);
  aplicarLista_(corte, 4, ['Sí', 'No']);
  aplicarLista_(iglesia, 4, ['Pendiente', 'En progreso', 'Bloqueado', 'Listo']);
  aplicarLista_(iglesia, 5, ['Novio', 'Novia', 'Ambos']);
  aplicarLista_(recepcion, 4, ['Pendiente', 'En progreso', 'Bloqueado', 'Listo']);
  aplicarLista_(recepcion, 5, ['Novio', 'Novia', 'Ambos']);
  aplicarLista_(extra, 3, ['Pendiente', 'Confirmado', 'No asiste']);
  aplicarLista_(extra, 4, ['Uber', 'Interno', 'Propio', 'Por definir']);
  aplicarLista_(extra, 6, ['Iglesia', 'Recepción', 'Ambas']);
  aplicarLista_(extra, 7, ['Pollo', 'Carne', '']);
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

function encontrarHojasInvitacion_(book) {
  const found = { confirmacion: null, lista: null, envio: null };
  book.getSheets().forEach(function (sheet) {
    if (esHojaTracker_(sheet.getName())) return;
    const lastColumn = Math.max(1, sheet.getLastColumn());
    const lastRow = Math.max(1, sheet.getLastRow());
    const headerCells = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const joined = headerCells.join(' ').toLowerCase();
    if (joined.indexOf('asistencia') >= 0 && (joined.indexOf('menú') >= 0 || joined.indexOf('menu') >= 0)) {
      found.confirmacion = sheet;
      return;
    }
    if (joined.indexOf('estado de invitación') >= 0 || joined.indexOf('estado de invitacion') >= 0 || joined.indexOf('invitado principal') >= 0) {
      found.envio = sheet;
      return;
    }
    const sample = sheet.getRange(1, 1, Math.min(12, lastRow), Math.min(4, lastColumn)).getDisplayValues();
    if (pareceListaInvitados_(sample)) found.lista = sheet;
  });
  return found;
}

function pareceListaInvitados_(sample) {
  let hits = 0;
  sample.forEach(function (row) {
    const estado = String(row[2] || '').trim().toUpperCase();
    if (limpiarNombre_(row[0]) && esEstadoLista_(estado)) hits += 1;
  });
  return hits >= 3;
}

function esEstadoLista_(estado) {
  return estado === 'TRUE' || estado === 'FALSE' || estado === 'X';
}

function indiceColumna_(headers, names) {
  for (let index = 0; index < headers.length; index += 1) {
    if (names.indexOf(headers[index]) >= 0) return index;
  }
  return -1;
}

function claveTelefono_(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function limpiarNombre_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizarNombre_(name) {
  return limpiarNombre_(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function idInvitado_(nombre, telefono) {
  const slug = normalizarNombre_(nombre).replace(/\s+/g, '-').slice(0, 42);
  const phone = claveTelefono_(telefono);
  return 'g-' + (slug || 'invitado') + (phone ? '-' + phone.slice(-4) : '');
}

function etiquetaGrupo_(names) {
  if (!names || names.length <= 1) return names && names[0] ? names[0] : '';
  const lasts = [];
  names.forEach(function (name) {
    const parts = name.split(' ').filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : name;
    if (lasts.indexOf(last) < 0) lasts.push(last);
  });
  return lasts.length === 1 ? 'Familia ' + lasts[0] : lasts.join(' / ');
}

function rsvpDesdeAsistencia_(asistencia) {
  const value = String(asistencia || '').toLowerCase();
  if (value.indexOf('sí') === 0 || value.indexOf('si ') === 0 || value === 'si' || value.indexOf('asiste') === 0) return 'Confirmado';
  if (value.indexOf('no') === 0) return 'No asiste';
  return 'Pendiente';
}

function personasDesdeTipo_(tipo, acompanante) {
  const value = String(tipo || '').toLowerCase();
  if (value.indexOf('grupo') >= 0) return 4;
  if (value.indexOf('pareja') >= 0 || acompanante) return 2;
  return 1;
}

function datosConfig_() {
  return [
    ['nombres', ''],
    ['fecha_boda', '2026-10-03'],
    ['hora_iglesia', '11:00 a.m. – 12:30 p.m.'],
    ['lugar_iglesia', ''],
    ['hora_recepcion', ''],
    ['lugar_recepcion', ''],
  ];
}

function datosTareas_() {
  const now = new Date().toISOString();
  const rows = [
    ['ig-1', 'Iglesia', 'Damas y caballeros de la corte', 'Confirmar nombres en Tracker_Corte', 'Novia', 'Pendiente', 'Alta', '', 'Mía'],
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
    ['rec-4', 'Recepción', 'Confirmación de invitados', 'Se lee en vivo del formulario', 'Ambos', 'En progreso', 'Alta', '', 'Mía'],
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
    ['corte-dama-1', '', 'Dama de la corte', 'No', '', ''],
    ['corte-dama-2', '', 'Dama de la corte', 'No', '', ''],
    ['corte-dama-3', '', 'Dama de la corte', 'No', '', ''],
    ['corte-dama-4', '', 'Dama de la corte', 'No', '', ''],
    ['corte-cab-1', '', 'Caballero de la corte', 'No', '', ''],
    ['corte-cab-2', '', 'Caballero de la corte', 'No', '', ''],
    ['corte-cab-3', '', 'Caballero de la corte', 'No', '', ''],
    ['corte-cab-4', '', 'Caballero de la corte', 'No', '', ''],
    ['corte-testigo-1', '', 'Testigo', 'Sí', '', 'Documentos entregados'],
    ['corte-testigo-2', '', 'Testigo', 'Sí', '', 'Documentos entregados'],
    ['corte-paje-1', '', 'Pajecito', 'No', '', 'Falta confirmar con los papás'],
    ['corte-paje-2', '', 'Pajecito', 'No', '', 'Falta confirmar con los papás'],
  ];
}

function datosIglesia_() {
  return [
    ['hora_ceremonia', 'Hora de la ceremonia', '11:00 a.m. – 12:30 p.m.', 'Listo', 'Ambos', 'Ceremonia en la iglesia', ''],
    ['oficiante', 'Oficiante', 'Hermano Jairo Cardozo', 'Listo', 'Ambos', 'Encargado de dirigir la ceremonia', ''],
    ['decoracion', 'Decoración', 'Ana Cubillos', 'En progreso', 'Novia', 'A cargo de la decoración con ayuda de mamá', ''],
    ['protocolo', 'Checklist del protocolo', 'Pendiente de completar', 'Pendiente', 'Ambos', 'Revisar el protocolo solicitado por la iglesia', ''],
    ['fotografia', 'Checklist de fotografías', 'Checklist listo', 'Listo', 'Ambos', 'Fotografías clave de la ceremonia en la iglesia', ''],
    ['carro', 'Checklist del carro de los novios', 'Pendiente por definir', 'Pendiente', 'Novio', 'Confirmar carro, conductor, decoración y hora de llegada', ''],
    ['lugar', 'Lugar de la iglesia', '', 'Pendiente', 'Ambos', '', ''],
    ['musica', 'Música de la ceremonia', 'Canciones y músicos', 'Pendiente', 'Ambos', '', ''],
  ];
}

function datosRecepcion_() {
  return [
    ['hora_recepcion', 'Hora de la recepción', '5:00 p.m. – 11:00 p.m.', 'Listo', 'Ambos', 'Ingreso de invitados, cena y celebración.', ''],
    ['lugar', 'Lugar de la recepción', 'Por confirmar', 'Pendiente', 'Ambos', 'Dirección, salón y punto de llegada por cerrar.', ''],
    ['fotografia', 'Fotografía de recepción', 'Invitada y staff incluidos', 'Listo', 'Ambos', 'Cobertura durante la recepción y el baile.', ''],
    ['dj', 'DJ, equipo y staff', 'Montaje y horarios por confirmar', 'Pendiente', 'Novio', 'Confirmar montaje, horas de servicio y requerimientos técnicos.', ''],
    ['itinerario', 'Itinerario', 'Horarios y responsables por definir', 'Pendiente', 'Ambos', 'Recepción 5:00 p.m. · cena · baile · cierre 11:00 p.m.', ''],
    ['baile', 'Información del baile', 'Primer baile por elegir', 'Pendiente', 'Ambos', 'Definir canción, ensayo y momento dentro del itinerario.', ''],
    ['transporte', 'Transporte de invitados', 'Uber o transporte interno', 'Pendiente', 'Novio', 'Definir quién necesita traslado y los horarios de regreso.', ''],
    ['contrato', 'Contrato y cotización final', 'Esperando respuesta del salón', 'Pendiente', 'Ambos', 'Revisar versión final, pagos incluidos y fecha límite.', '2026-09-07'],
  ];
}
