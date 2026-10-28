// Apps Script de la hoja notas_DAW1.
// Devuelve las filas de la pestaña «Notas» (cabeceras incluidas) como JSON.
// Se publica como «Aplicación web» (ver README, paso 1).

const ID_HOJA = '1C8J7wz99vWVGb36E6KgrwaMiAaoD2R4undGIj-gn9nI';
const RANGO = 'Notas!A4:F104';

function doGet() {
  const hoja = SpreadsheetApp.openById(ID_HOJA);
  // getDisplayValues() da el texto tal como se ve en la hoja ("9,00").
  // La app ya sabe convertir ese formato a número.
  const filas = hoja.getRange(RANGO).getDisplayValues();

  const respuesta = {
    actualizado: new Date().toISOString(),
    filas: filas
  };

  return ContentService
    .createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}
