/**
 * ═══════════════════════════════════════════════════════════════
 *  GOOGLE APPS SCRIPT — TRIVIA SEGURIDAD E HIGIENE (MULTI-TRIVIA)
 *  CD Esteban Echeverría
 *
 *  INSTRUCCIONES DE DEPLOY:
 *  1. Abrí script.google.com y creá un nuevo proyecto
 *  2. Pegá TODO este código reemplazando el contenido existente
 *  3. Guardá (Ctrl+S)
 *  4. Clic en "Implementar" → "Nueva implementación"
 *  5. Tipo: Aplicación web
 *  6. Ejecutar como: Yo (tu cuenta Google)
 *  7. Quién tiene acceso: Cualquier usuario
 *  8. Clic en "Implementar" → Copiá la URL generada
 *  9. Pegá esa URL en GAS_URL de index.html Y admin.html
 *
 *  ⚠️ IMPORTANTE: Siempre publicá una NUEVA VERSIÓN de la misma
 *     implementación (no crear implementación nueva) para mantener la URL.
 *
 *  NUEVAS FUNCIONALIDADES:
 *  - Soporte para múltiples trivias
 *  - Cada trivia tiene su propia hoja
 *  - Las hojas se nombran: TRIVIA_ID_FECHA
 *  - Conversión automática a MAYÚSCULAS de datos de participantes
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * POST handler — Registra un nuevo participante o crea una hoja
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === 'register') {
      return registrarParticipante(data);
    }
    
    if (data.action === 'createSheet') {
      return crearHojaParaTrivia(data);
    }
    
    return responder({ success: false, error: 'Acción desconocida' });
    
  } catch (err) {
    return responder({ success: false, error: err.toString() });
  }
}

/**
 * GET handler — Retorna participantes o estadísticas de una trivia específica
 */
function doGet(e) {
  try {
    var action = e.parameter.action;
    var triviaId = e.parameter.triviaId;
    
    if (action === 'getAll') {
      return obtenerParticipantes(triviaId);
    }
    
    if (action === 'stats') {
      return obtenerEstadisticas(triviaId);
    }
    
    if (action === 'listTrivias') {
      return listarTrivias();
    }
    
    // Default: retorna info básica
    return responder({ 
      success: true, 
      mensaje: 'Trivia Seguridad e Higiene API (Multi-Trivia) — CD Esteban Echeverría',
      version: '2.0'
    });
    
  } catch (err) {
    return responder({ success: false, error: err.toString() });
  }
}

/**
 * Crea una nueva hoja para una trivia
 */
function crearHojaParaTrivia(data) {
  var triviaId = data.triviaId;
  var nombre = data.nombre || 'Trivia';
  
  if (!triviaId) {
    return responder({ success: false, error: 'triviaId requerido' });
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fecha = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd');
  var sheetName = 'T_' + triviaId.substr(0, 8) + '_' + fecha;
  
  // Verificar si ya existe
  var existingSheet = ss.getSheetByName(sheetName);
  if (existingSheet) {
    return responder({ 
      success: true, 
      sheetName: sheetName,
      mensaje: 'La hoja ya existe'
    });
  }
  
  // Crear hoja
  var sheet = ss.insertSheet(sheetName);
  
  // Encabezados
  sheet.appendRow([
    'Timestamp',
    'Nombre',
    'Apellido',
    'DNI',
    'Empresa',
    'Puntaje',
    'N° Participación',
    'Firma Capturada',
    'Trivia ID',
    'Trivia Nombre'
  ]);
  
  // Formato encabezados
  var headerRange = sheet.getRange(1, 1, 1, 10);
  headerRange.setBackground('#0D2137');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(11);
  sheet.setFrozenRows(1);
  
  // Anchos de columna
  sheet.setColumnWidth(1, 160); // Timestamp
  sheet.setColumnWidth(2, 120); // Nombre
  sheet.setColumnWidth(3, 140); // Apellido
  sheet.setColumnWidth(4, 100); // DNI
  sheet.setColumnWidth(5, 160); // Empresa
  sheet.setColumnWidth(6, 80);  // Puntaje
  sheet.setColumnWidth(7, 180); // N° Participación
  sheet.setColumnWidth(8, 120); // Firma
  sheet.setColumnWidth(9, 120); // Trivia ID
  sheet.setColumnWidth(10, 200); // Trivia Nombre
  
  return responder({ 
    success: true, 
    sheetName: sheetName,
    mensaje: 'Hoja creada correctamente'
  });
}

/**
 * Registra un participante en la planilla de su trivia
 */
function registrarParticipante(data) {
  var triviaId = data.triviaId || 'default';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Buscar la hoja de esta trivia (la más reciente si hay varias)
  var sheet = buscarHojaDeTrivia(ss, triviaId);
  
  // Si no existe, crear una hoja default
  if (!sheet) {
    var fecha = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd');
    var sheetName = 'T_' + triviaId.substr(0, 8) + '_' + fecha;
    sheet = ss.insertSheet(sheetName);
    
    // Encabezados
    sheet.appendRow([
      'Timestamp',
      'Nombre',
      'Apellido',
      'DNI',
      'Empresa',
      'Puntaje',
      'N° Participación',
      'Firma Capturada',
      'Trivia ID',
      'Trivia Nombre'
    ]);
    
    // Formato encabezados
    var headerRange = sheet.getRange(1, 1, 1, 10);
    headerRange.setBackground('#0D2137');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(11);
    sheet.setFrozenRows(1);
  }
  
  // ✅ CONVERTIR A MAYÚSCULAS
  var nombre = String(data.nombre || '').toUpperCase();
  var apellido = String(data.apellido || '').toUpperCase();
  var empresa = String(data.empresa || '').toUpperCase();
  
  // Verificar duplicado por DNI
  var dni = String(data.dni || '').replace(/\D/g, '');
  if (dni && sheet.getLastRow() > 1) {
    var dniCol = sheet.getRange(2, 4, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    for (var i = 0; i < dniCol.length; i++) {
      if (String(dniCol[i][0]).replace(/\D/g, '') === dni) {
        // DNI ya registrado — devolver el número existente
        var existingRow = sheet.getRange(i + 2, 1, 1, 10).getValues()[0];
        return responder({
          success: true,
          duplicado: true,
          numero: existingRow[6],
          mensaje: 'Este DNI ya está registrado en esta trivia'
        });
      }
    }
  }
  
  // Agregar fila
  var timestamp = new Date();
  var puntajeTexto = (data.puntaje !== undefined) ? (data.puntaje + '/12') : '—';
  
  sheet.appendRow([
    timestamp,
    nombre,
    apellido,
    data.dni || '',
    empresa,
    puntajeTexto,
    data.numero || '',
    data.firmaCapturada || 'No',
    triviaId,
    data.triviaNombre || ''
  ]);
  
  // Colorear fila según puntaje
  var lastRow = sheet.getLastRow();
  var puntaje = parseInt(data.puntaje) || 0;
  var rowRange = sheet.getRange(lastRow, 1, 1, 10);
  if (puntaje >= 10) {
    rowRange.setBackground('#eefaf3'); // Verde claro
  } else if (puntaje >= 7) {
    rowRange.setBackground('#fff8ee'); // Naranja claro
  } else {
    rowRange.setBackground('#fdecea'); // Rojo claro
  }
  
  return responder({
    success: true,
    numero: data.numero,
    mensaje: 'Participante registrado correctamente'
  });
}

/**
 * Busca la hoja más reciente de una trivia
 */
function buscarHojaDeTrivia(ss, triviaId) {
  var sheets = ss.getSheets();
  var triviaSheets = [];
  
  var idCorto = triviaId.substr(0, 8);
  
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name.indexOf('T_' + idCorto) === 0) {
      triviaSheets.push(sheets[i]);
    }
  }
  
  // Retornar la más reciente (última en la lista)
  if (triviaSheets.length > 0) {
    return triviaSheets[triviaSheets.length - 1];
  }
  
  return null;
}

/**
 * Retorna todos los participantes de una trivia específica
 */
function obtenerParticipantes(triviaId) {
  if (!triviaId) {
    return responder({ participantes: [], error: 'triviaId requerido' });
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = buscarHojaDeTrivia(ss, triviaId);
  
  if (!sheet || sheet.getLastRow() < 2) {
    return responder({ participantes: [] });
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);
  
  var participantes = rows
    .filter(function(row) { return row[0] !== ''; }) // Filtrar filas vacías
    .map(function(row) {
      var obj = {};
      headers.forEach(function(header, i) {
        // Convertir timestamp a string legible
        if (i === 0 && row[i] instanceof Date) {
          obj[header] = row[i].toISOString();
        } else {
          obj[header] = row[i];
        }
      });
      return obj;
    });
  
  return responder({ participantes: participantes });
}

/**
 * Retorna estadísticas de una trivia específica
 */
function obtenerEstadisticas(triviaId) {
  if (!triviaId) {
    return responder({ total: 0, promedio: 0, aprobados: 0 });
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = buscarHojaDeTrivia(ss, triviaId);
  
  if (!sheet || sheet.getLastRow() < 2) {
    return responder({ total: 0, promedio: 0, aprobados: 0 });
  }
  
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  var puntajes = data
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) { 
      var puntajeStr = String(r[5]); // Puntaje está en formato "X/12"
      var num = parseInt(puntajeStr.split('/')[0]) || 0;
      return num;
    });
  
  var total = puntajes.length;
  var suma = puntajes.reduce(function(a, b) { return a + b; }, 0);
  var aprobados = puntajes.filter(function(p) { return p >= 7; }).length;
  
  return responder({
    total: total,
    promedio: total > 0 ? (suma / total).toFixed(1) : 0,
    aprobados: aprobados
  });
}

/**
 * Lista todas las trivias (hojas que empiezan con T_)
 */
function listarTrivias() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var trivias = [];
  
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name.indexOf('T_') === 0) {
      var lastRow = sheets[i].getLastRow();
      var participantes = lastRow > 1 ? lastRow - 1 : 0;
      
      trivias.push({
        sheetName: name,
        participantes: participantes
      });
    }
  }
  
  return responder({ trivias: trivias });
}

/**
 * Helper para devolver respuesta JSON con headers CORS
 */
function responder(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
