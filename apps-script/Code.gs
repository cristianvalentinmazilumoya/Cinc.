// Apps Script de la hoja de notas de Cinc.
// Devuelve todas las filas de la pestaña «Notas» (cabeceras incluidas) como JSON.
// Se publica como «Aplicación web» (ver README, paso 1).

const ID_HOJA = '1C8J7wz99vWVGb36E6KgrwaMiAaoD2R4undGIj-gn9nI';
const PESTANA = 'Notas';

function doGet() {
  const hoja = SpreadsheetApp.openById(ID_HOJA).getSheetByName(PESTANA);
  // getDataRange() llega hasta la última fila escrita, así cuentan las notas nuevas.
  // getDisplayValues() da el texto tal como se ve en la hoja ("9,00").
  const filas = hoja.getDataRange().getDisplayValues();

  const respuesta = {
    actualizado: new Date().toISOString(),
    filas: filas
  };

  return ContentService
    .createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}
