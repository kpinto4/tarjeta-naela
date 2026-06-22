/**
 * INSTRUCCIONES DE CONFIGURACIÓN
 * ================================
 * 1. Crea una hoja de Google Sheets nueva
 * 2. En la fila 1 pon estos encabezados:
 *    A: Fecha | B: Nombre | C: Asistencia | D: Acompañantes | E: Mensaje
 * 3. Ve a Extensiones → Apps Script
 * 4. Borra el contenido y pega TODO este archivo
 * 5. Guarda el proyecto (Ctrl+S)
 * 6. Clic en "Implementar" → "Nueva implementación"
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 7. Copia la URL que te da y pégala en index.html → CONFIG.googleScriptUrl
 * 8. Para ver las confirmaciones en el panel admin:
 *    - Archivo → Compartir → Publicar en la web
 *    - Elige la hoja y formato CSV
 *    - Copia el enlace y pégalo en CONFIG.sheetCsvUrl
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      new Date().toLocaleString('es-MX'),
      data.nombre || '',
      data.asistencia || '',
      data.acompanantes || 0,
      data.mensaje || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var headers = rows.shift();
  var result = rows.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
