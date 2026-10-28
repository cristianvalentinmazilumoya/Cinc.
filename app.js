// ============================================================
//  Cinc — lee la hoja de Google y calcula las medias
// ============================================================

// URL de la aplicación web de Apps Script (README, paso 1).
// Mientras esté vacía, la página usa datos-ejemplo.json.
const URL_DATOS = 'https://script.google.com/macros/s/AKfycbynBFvVfn25FAaIypWiBWSgNMhEYr1FovhneC1P9FDVrhjEMd2vev-Bgskp_mMBgOmOrg/exec';

// Módulos en el orden de la hoja. «reparto» solo en los que tienen
// reparto oficial publicado (pesos de exámenes y prácticas).
const MODULOS = [
  { nombre: 'Programació + Entorns de desenvolupament (0485+0487)', sigla: 'PRG' },
  { nombre: "Disseny d'interfícies web (0615)", sigla: 'DIW',
    reparto: { examenes: 60, practicas: 40, texto: '60 % pruebas / 40 % prácticas' } },
  { nombre: 'Bases de dades (0484)', sigla: 'BBDD' },
  { nombre: 'Llenguatges de marques (0373)', sigla: 'LMSGI' },
  { nombre: 'Sistemes informàtics (0483)', sigla: 'SI',
    reparto: { examenes: 50, practicas: 50, texto: '50 % pruebas / 50 % prácticas' } },
  { nombre: "Desplegament d'aplicacions web (0614)", sigla: 'DAW' },
  { nombre: 'Digitalització aplicada als sectors productius (1665)', sigla: 'DIG',
    reparto: { examenes: 35, practicas: 45, texto: '35 % prueba teórica / 45 % actividades (20 % proyecto final, aún no cuenta)' } },
  { nombre: "Itinerari Personal per l'Ocupabilitat I (1709)", sigla: 'IPO' },
  { nombre: 'Noves Tecnologies', sigla: 'NT',
    reparto: { examenes: 40, practicas: 60, texto: '40 % pruebas / 60 % proyecto' } }
];

const CLAVE_GUARDADO = 'notas-daw1-ultimos-datos';

const formato = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

let modulos = [];          // módulos con sus actividades y medias
let siglaSeleccionada = 'PRG';


// ---------- Conversión de datos ----------

// "9,00" → 9 · "1.234,5" → 1234.5 · "" → null
function aNumero(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return valor;

  const texto = String(valor).trim();
  if (texto === '') return null;

  const numero = Number(texto.replaceAll('.', '').replace(',', '.'));
  return Number.isNaN(numero) ? null : numero;
}

// Convierte las filas de la hoja en objetos. La primera fila son las cabeceras.
function leerFilas(filas) {
  const actividades = [];

  for (let i = 1; i < filas.length; i++) {
    const [modulo, tipo, actividad, nota, peso, comentario] = filas[i];
    if (!modulo || String(modulo).trim() === '') continue;   // fila vacía

    actividades.push({
      modulo: String(modulo).trim(),
      tipo: String(tipo || '').trim(),
      actividad: String(actividad || '').trim(),
      nota: aNumero(nota),
      peso: aNumero(peso) ?? 1,
      comentario: String(comentario || '').trim()
    });
  }

  return actividades;
}


// ---------- Cálculos ----------

// Media ponderada (nota × peso / suma de pesos) de las actividades con nota.
function mediaPonderada(actividades) {
  let suma = 0;
  let pesos = 0;

  for (const a of actividades) {
    if (a.nota === null) continue;
    suma += a.nota * a.peso;
    pesos += a.peso;
  }

  return pesos > 0 ? suma / pesos : null;
}

function calcularModulo(modulo) {
  const examenes = modulo.actividades.filter(a => a.tipo === 'Examen');
  const practicas = modulo.actividades.filter(a => a.tipo !== 'Examen');

  modulo.mediaExamenes = mediaPonderada(examenes);
  modulo.mediaPracticas = mediaPonderada(practicas);
  modulo.numNotas = modulo.actividades.filter(a => a.nota !== null).length;

  if (modulo.reparto) {
    // Solo cuentan los grupos que ya tienen nota
    let suma = 0;
    let pesos = 0;
    if (modulo.mediaExamenes !== null) {
      suma += modulo.mediaExamenes * modulo.reparto.examenes;
      pesos += modulo.reparto.examenes;
    }
    if (modulo.mediaPracticas !== null) {
      suma += modulo.mediaPracticas * modulo.reparto.practicas;
      pesos += modulo.reparto.practicas;
    }
    modulo.media = pesos > 0 ? suma / pesos : null;
  } else {
    modulo.media = mediaPonderada(modulo.actividades);
  }
}

// Agrupa las actividades por módulo, respetando el orden de MODULOS.
function agruparPorModulo(actividades) {
  const lista = MODULOS.map(m => ({ ...m, actividades: [] }));

  for (const a of actividades) {
    let modulo = lista.find(m => m.nombre === a.modulo);
    if (!modulo) {
      // Un módulo que no está en la lista: se añade al final
      modulo = { nombre: a.modulo, sigla: a.modulo.slice(0, 4).toUpperCase(), actividades: [] };
      lista.push(modulo);
    }
    modulo.actividades.push(a);
  }

  lista.forEach(calcularModulo);
  return lista;
}

function mediaDelCurso(lista) {
  const conNota = lista.filter(m => m.media !== null);
  if (conNota.length === 0) return null;
  return conNota.reduce((suma, m) => suma + m.media, 0) / conNota.length;
}


// ---------- Valoración y colores ----------

function valoracion(nota) {
  if (nota === null) return 'Sin notas';
  if (nota >= 9) return 'Sobresaliente';
  if (nota >= 7) return 'Notable';
  if (nota >= 5) return 'Aprobado';
  return 'Suspenso';
}

// Nivel de color: alta (verde), media (ámbar), baja (rojo), sin (gris)
function nivel(nota) {
  if (nota === null) return 'sin';
  if (nota >= 7) return 'alta';
  if (nota >= 5) return 'media';
  return 'baja';
}

function formatear(nota) {
  return nota === null ? '—' : formato.format(nota);
}


// ---------- Pintar la página ----------

// Evita que un texto de la hoja se interprete como HTML
function escapar(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function barra(nota) {
  const ancho = nota === null ? 0 : Math.min(Math.max(nota, 0), 10) * 10;
  return `<div class="barra" aria-hidden="true">
            <div class="barra-relleno ${nivel(nota)}" style="width: ${ancho}%"></div>
          </div>`;
}

function pintarResumen() {
  const media = mediaDelCurso(modulos);
  const notas = modulos.reduce((total, m) => total + m.numNotas, 0);
  const conNota = modulos.filter(m => m.media !== null).length;

  document.getElementById('resumen').innerHTML =
    `Media del curso <strong class="num">${formatear(media)}</strong> con ` +
    `<strong class="num">${notas}</strong> notas puestas en ` +
    `<strong class="num">${conNota}</strong> módulos. ` +
    `Toca un módulo para ver todas sus actividades.`;
}

function pintarTarjetas() {
  const contenedor = document.getElementById('modulos');
  contenedor.innerHTML = '';

  for (const m of modulos) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'tarjeta';
    if (m.sigla === siglaSeleccionada) boton.classList.add('seleccionada');
    boton.setAttribute('aria-pressed', m.sigla === siglaSeleccionada);

    const media = m.media === null
      ? '<div class="media-grande sin-nota color-sin">Sin nota</div>'
      : `<div class="media-grande num color-${nivel(m.media)}">${formatear(m.media)}</div>`;

    boton.innerHTML = `
      <div class="tarjeta-arriba">
        <span class="sigla">${escapar(m.sigla)}</span>
        <span class="pastilla ${nivel(m.media)}">${valoracion(m.media)}</span>
      </div>
      <div class="nombre-modulo">${escapar(m.nombre)}</div>
      ${media}
      ${barra(m.media)}`;

    boton.addEventListener('click', () => {
      siglaSeleccionada = m.sigla;
      pintarTarjetas();
      pintarDetalle();
    });

    contenedor.appendChild(boton);
  }
}

function pintarDetalle() {
  const m = modulos.find(x => x.sigla === siglaSeleccionada) || modulos[0];
  const reparto = m.reparto ? m.reparto.texto : 'No publicado: media simple';

  const filas = m.actividades.map(a => `
    <tr class="${a.nota === null ? 'pendiente' : ''}">
      <td>${escapar(a.actividad)}</td>
      <td class="${a.tipo === 'Examen' ? 'examen' : ''}">${escapar(a.tipo)}</td>
      <td>
        <div class="celda-nota">
          <span class="num ${a.nota === null ? '' : 'color-' + nivel(a.nota)}">${formatear(a.nota)}</span>
          ${barra(a.nota)}
        </div>
      </td>
      <td class="col-comentario comentario">${escapar(a.comentario)}</td>
    </tr>`).join('');

  document.getElementById('detalle').innerHTML = `
    <h2>${escapar(m.nombre)}</h2>
    <dl class="datos">
      <div class="dato">
        <dt>Media del módulo</dt>
        <dd class="num color-${nivel(m.media)}">${formatear(m.media)}</dd>
      </div>
      <div class="dato">
        <dt>Media de exámenes</dt>
        <dd class="num">${formatear(m.mediaExamenes)}</dd>
      </div>
      <div class="dato">
        <dt>Media de prácticas</dt>
        <dd class="num">${formatear(m.mediaPracticas)}</dd>
      </div>
      <div class="dato">
        <dt>Reparto oficial</dt>
        <dd class="texto">${escapar(reparto)}</dd>
      </div>
    </dl>
    <table class="tabla">
      <thead>
        <tr>
          <th>Actividad</th>
          <th>Tipo</th>
          <th>Nota</th>
          <th class="col-comentario">Estado / comentario</th>
        </tr>
      </thead>
      <tbody>${filas || '<tr><td colspan="4">Sin actividades.</td></tr>'}</tbody>
    </table>`;
}

function mostrarAviso(texto, esError) {
  const aviso = document.getElementById('aviso');
  aviso.textContent = texto;
  aviso.classList.toggle('error', esError);
  aviso.hidden = false;
}

function pintarTodo(datos) {
  modulos = agruparPorModulo(leerFilas(datos.filas));
  pintarResumen();
  pintarTarjetas();
  pintarDetalle();
}


// ---------- Carga de datos ----------

async function cargar() {
  const url = URL_DATOS || 'datos-ejemplo.json';

  try {
    // cache: 'no-store' para tener siempre la última versión de la hoja
    const respuesta = await fetch(url, { cache: 'no-store' });
    if (!respuesta.ok) throw new Error('Respuesta ' + respuesta.status);

    const datos = await respuesta.json();
    if (!Array.isArray(datos.filas)) throw new Error('Formato inesperado');

    pintarTodo(datos);
    if (!URL_DATOS) {
      mostrarAviso('Estás viendo datos de ejemplo: falta poner la URL del Apps Script en app.js.', false);
    }

    // Copia para poder ver las notas sin conexión
    try {
      localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
    } catch (e) { /* sin almacenamiento: no pasa nada */ }

  } catch (error) {
    console.error(error);

    let guardados = null;
    try {
      guardados = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
    } catch (e) { /* nada guardado */ }

    if (guardados && Array.isArray(guardados.filas)) {
      pintarTodo(guardados);
      const fecha = new Date(guardados.actualizado).toLocaleString('es-ES');
      mostrarAviso(`No se ha podido leer la hoja. Muestro las notas guardadas el ${fecha}.`, true);
    } else {
      document.getElementById('modulos').innerHTML = '';
      document.getElementById('resumen').textContent = 'No hay datos.';
      mostrarAviso('No se ha podido leer la hoja notas_DAW1. Comprueba la conexión y vuelve a abrir la página.', true);
    }
  }
}

cargar();

// Service worker para que la app se pueda instalar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
