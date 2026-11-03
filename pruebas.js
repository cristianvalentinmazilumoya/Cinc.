// ============================================================
//  Cinc — pruebas automáticas de los cálculos (calculos.js)
//  Abre pruebas.html: cada caso sale en verde si da lo esperado y en rojo si no.
//  Si cambias un cálculo, vuelve a abrir esta página para comprobar que no se ha roto nada.
// ============================================================

// ---------- Ayudantes para escribir los casos ----------

let contador = 0;

// Una nota: tipo, nota (null = pendiente), porcentaje (null = sin indicar)
function nota(tipo, valor, porcentaje = null, extra = {}) {
  contador++;
  return {
    id: 'n' + contador,
    tipo,
    nota: valor,
    porcentaje,
    actividad: extra.nombre || 'Nota ' + contador,
    recuperaDe: extra.recuperaDe || null
  };
}
const examen = (valor, porcentaje, extra) => nota('Examen', valor, porcentaje, extra);
const actividad = (valor, porcentaje, extra) => nota('Actividad', valor, porcentaje, extra);

// Un módulo ya calculado
function modulo(reparto, notas, minimos = { examenes: null, practicas: null }) {
  const m = { reparto, actividades: notas, minimos };
  calcularModulo(m);
  return m;
}

const R6040 = { examenes: 60, practicas: 40 };
const redondear = x => (x === null || x === undefined ? x : Math.round(x * 1000) / 1000);

// Cada caso: [grupo, descripción, valor obtenido, valor esperado]
const casos = [];
function caso(grupo, descripcion, obtenido, esperado) {
  casos.push({ grupo, descripcion, obtenido, esperado });
}


// ---------- Números ----------

caso('Números', '«9,00» de la hoja', aNumero('9,00'), 9);
caso('Números', '«8.5» con punto', aNumero('8.5'), 8.5);
caso('Números', '«12,5» con coma', aNumero('12,5'), 12.5);
caso('Números', '«1.234,5» con miles', aNumero('1.234,5'), 1234.5);
caso('Números', 'vacío', aNumero(''), null);
caso('Números', 'texto que no es un número', aNumero('abc'), null);


// ---------- Reparto del módulo ----------

caso('Reparto', 'sin reparto: la media queda pendiente',
  modulo(null, [examen(9), actividad(8)]).pendiente, true);
caso('Reparto', 'sin reparto ni notas: no está pendiente',
  modulo(null, [examen(null)]).pendiente, false);
caso('Reparto', '60/40 sin porcentajes: 0,6 × 9 + 0,4 × 7',
  redondear(modulo(R6040, [examen(9), actividad(8), actividad(6)]).media), 8.2);
caso('Reparto', 'DIG 35/45: se normaliza sobre el 80 %',
  redondear(modulo({ examenes: 35, practicas: 45 }, [examen(6), actividad(8)]).media), 7.125);
caso('Reparto', 'grupo que vale 0 %: no deja la media provisional',
  Boolean(modulo({ examenes: 100, practicas: 0 }, [examen(7)]).provisional), false);
caso('Reparto', 'solo hay exámenes en un grupo de 0 %: sin media',
  modulo({ examenes: 0, practicas: 100 }, [examen(7)]).media, null);


// ---------- Porcentajes dentro de cada grupo ----------

caso('Porcentajes', 'ninguno: todas valen lo mismo',
  redondear(modulo(R6040, [examen(9), actividad(7), actividad(null)]).mediaPracticas), 7);
caso('Porcentajes', '20 % y 30 % puestos, 50 % pendiente: en proporción',
  redondear(modulo(R6040, [examen(9), actividad(8, 20), actividad(6, 30), actividad(null, 50)]).mediaPracticas), 6.8);
caso('Porcentajes', '… y se indica «sobre el 50 % evaluado»',
  modulo(R6040, [examen(9), actividad(8, 20), actividad(6, 30), actividad(null, 50)]).evaluadoPracticas, 50);
caso('Porcentajes', 'nota sin % entre otras con %: no cuenta',
  redondear(modulo(R6040, [examen(9), actividad(8, 20), actividad(9)]).mediaPracticas), 8);
caso('Porcentajes', 'más del 100 %: hay aviso',
  modulo(R6040, [examen(9), actividad(8, 60), actividad(6, 60)]).avisos.length, 1);
caso('Porcentajes', 'nota que vale 0 %: no cuenta (y las demás valen lo mismo)',
  redondear(modulo({ examenes: 100, practicas: 0 }, [examen(9, 0), examen(6), examen(8)]).mediaExamenes), 7);
caso('Porcentajes', 'nota que vale 0 % con otras con porcentaje',
  redondear(modulo({ examenes: 100, practicas: 0 }, [examen(2, 0), examen(6, 40), examen(8, 60)]).mediaExamenes), 7.2);
caso('Porcentajes', 'un 0 cuenta como nota (no como pendiente)',
  redondear(modulo(R6040, [examen(0), actividad(10)]).media), 4);


// ---------- Media provisional y mínimos ----------

caso('Provisional', 'sin exámenes con nota: cuenta solo actividades',
  redondear(modulo(R6040, [examen(null), actividad(8), actividad(6)]).media), 7);
caso('Provisional', '… y se marca como provisional',
  Boolean(modulo(R6040, [examen(null), actividad(8)]).provisional), true);
caso('Provisional', 'el único examen con nota vale 0 %: el motivo no es que falte el porcentaje',
  modulo(R6040, [examen(9, 0), examen(null), actividad(8)]).provisional.includes('aún no hay exámenes con nota'), true);
caso('Mínimos', 'media de exámenes por debajo del mínimo',
  modulo(R6040, [examen(4), actividad(9)], { examenes: 5, practicas: null }).bajoMinimo.length, 1);
caso('Mínimos', 'media de exámenes justo en el mínimo: aprueba',
  modulo(R6040, [examen(5), actividad(9)], { examenes: 5, practicas: null }).bajoMinimo.length, 0);


// ---------- Recuperaciones ----------

{
  const original = examen(3, 50, { nombre: 'Prova 1' });
  caso('Recuperaciones', 'con nota, sustituye a la original',
    redondear(modulo({ examenes: 100, practicas: 0 },
      [original, examen(8, 50), examen(6, null, { recuperaDe: original.id })]).mediaExamenes), 7);
}
{
  const original = examen(3, 50);
  caso('Recuperaciones', 'sin nota, cuenta la original',
    redondear(modulo({ examenes: 100, practicas: 0 },
      [original, examen(8, 50), examen(null, null, { recuperaDe: original.id })]).mediaExamenes), 5.5);
}
{
  const a = examen(4);
  const b = examen(6, null, { recuperaDe: a.id });
  caso('Recuperaciones', 'recuperación de una recuperación: cuenta como nota normal',
    redondear(modulo({ examenes: 100, practicas: 0 }, [a, b, examen(9, null, { recuperaDe: b.id })]).mediaExamenes), 7.5);
}


// ---------- ¿Cuánto necesito? ----------

const base = () => [examen(6, 40), examen(null, 60), actividad(8), actividad(null)];
caso('¿Cuánto necesito?', 'para un 5',
  cuantoNecesito(modulo(R6040, base()), 5).nota, 3.5);
caso('¿Cuánto necesito?', 'para un 7',
  cuantoNecesito(modulo(R6040, base()), 7).nota, 7.08);
caso('¿Cuánto necesito?', 'comprobación: con 3,5 en lo pendiente sale un 5',
  redondear(modulo(R6040, [examen(6, 40), examen(3.5, 60), actividad(8), actividad(3.5)]).media), 5);
caso('¿Cuánto necesito?', 'con mínimo de 5 en exámenes',
  cuantoNecesito(modulo(R6040, base(), { examenes: 5, practicas: null }), 5).nota, 4.34);
caso('¿Cuánto necesito?', 'ya asegurado',
  cuantoNecesito(modulo({ examenes: 50, practicas: 50 }, [examen(10, 50), examen(null, 50), actividad(10)]), 5).tipo, 'asegurado');
caso('¿Cuánto necesito?', 'imposible aunque saques un 10',
  cuantoNecesito(modulo({ examenes: 100, practicas: 0 }, [examen(0, 90), examen(null, 10)]), 5).tipo, 'imposible');
caso('¿Cuánto necesito?', 'nada pendiente',
  cuantoNecesito(modulo(R6040, [examen(7), actividad(8)]), 5).tipo, 'nada-pendiente');
caso('¿Cuánto necesito?', 'faltan los exámenes del módulo',
  cuantoNecesito(modulo(R6040, [actividad(8), actividad(null)]), 5).tipo, 'faltan-notas');
{
  const original = examen(3, 50);
  caso('¿Cuánto necesito?', 'recuperación pendiente: nota que hace falta en ella',
    cuantoNecesito(modulo({ examenes: 100, practicas: 0 },
      [original, examen(8, 50), examen(null, null, { recuperaDe: original.id })]), 5).nota, 2);
}


// ---------- Media del curso ----------

caso('Media del curso', 'ponderada por horas',
  redondear(mediaDelCurso([{ media: 8, horas: 100, sigla: 'A' }, { media: 6, horas: 50, sigla: 'B' }]).media),
  redondear((8 * 100 + 6 * 50) / 150));
caso('Media del curso', 'si faltan horas: media simple',
  mediaDelCurso([{ media: 8, horas: 100, sigla: 'A' }, { media: 6, horas: null, sigla: 'B' }]).media, 7);
caso('Media del curso', '… y dice a qué módulo le faltan',
  mediaDelCurso([{ media: 8, horas: 100, sigla: 'A' }, { media: 6, horas: null, sigla: 'B' }]).sinHoras.join(','), 'B');


// ---------- Comprobar archivos ----------

const copiaBuena = () => ({
  cursos: [{ id: 'c1', nombre: '1.º DAW' }],
  modulos: [{ id: 'm1', cursoId: 'c1', nombre: 'Bases de dades', sigla: 'BBDD', reparto: { examenes: 60, practicas: 40 }, horas: 165, minimos: { examenes: 5, practicas: null } }],
  notas: [{ id: 'n1', moduloId: 'm1', actividad: 'Prova 1', tipo: 'Examen', nota: 7.5, porcentaje: 50, comentario: '', fecha: '2026-11-04', recuperaDe: null }]
});
caso('Archivos', 'copia correcta: sin problemas', problemasArchivo(copiaBuena()).length, 0);
caso('Archivos', 'copia antigua (sin cursos, fechas ni horas): sin problemas',
  problemasArchivo({ modulos: [{ id: 'm1', nombre: 'BBDD', sigla: 'BBDD', reparto: null }],
    notas: [{ id: 'n1', moduloId: 'm1', actividad: 'Prova', tipo: 'Examen', nota: 9, peso: 1 }] }).length, 0);
{
  const c = copiaBuena(); c.notas[0].nota = '7,5';
  caso('Archivos', 'nota escrita como texto: se rechaza', problemasArchivo(c).length, 1);
}
{
  const c = copiaBuena(); c.notas[0].nota = 12;
  caso('Archivos', 'nota de 12: se rechaza', problemasArchivo(c).length, 1);
}
{
  const c = copiaBuena(); c.notas[0].moduloId = 'otro';
  caso('Archivos', 'nota de un módulo que no existe: se rechaza', problemasArchivo(c).length, 1);
}
{
  const c = copiaBuena(); c.modulos[0].reparto = { examenes: 80, practicas: 40 };
  caso('Archivos', 'reparto que suma 120 %: se rechaza', problemasArchivo(c).length, 1);
}
caso('Archivos', 'módulos compartidos sin id: sin problemas',
  problemasArchivo({ tipo: 'modulos', modulos: [{ nombre: 'BBDD', sigla: 'BBDD', reparto: null, horas: null }] }, true).length, 0);


// ---------- Pintar el resultado ----------

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fallos = casos.filter(c => !iguales(c.obtenido, c.esperado));

document.getElementById('resumen').textContent = fallos.length === 0
  ? `Todo correcto: ${casos.length} de ${casos.length} pruebas.`
  : `${fallos.length} de ${casos.length} pruebas fallan.`;
document.getElementById('resumen').className = fallos.length === 0 ? 'resumen ok' : 'resumen falla';

document.getElementById('casos').innerHTML = casos.map(c => {
  const ok = iguales(c.obtenido, c.esperado);
  return `<tr class="${ok ? 'ok' : 'falla'}">
      <td>${ok ? '✓' : '✗'}</td>
      <td>${c.grupo}</td>
      <td>${c.descripcion}</td>
      <td class="num">${JSON.stringify(c.obtenido)}</td>
      <td class="num">${JSON.stringify(c.esperado)}</td>
    </tr>`;
}).join('');
