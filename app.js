// ============================================================
//  Cinc — guarda las notas en el dispositivo y calcula las medias
// ============================================================

// Versión de la app (sale en «Acerca de Cinc»)
const VERSION = '3.0';

// Dónde se guardan los datos (localStorage del navegador)
const CLAVE = 'cinc-datos';

// Plantilla para 1.º de DAW. «reparto» solo en los módulos con reparto
// oficial publicado (% de exámenes y % de actividades).
const PLANTILLA_DAW1 = [
  { nombre: 'Programació + Entorns de desenvolupament', sigla: 'PRG', reparto: null },
  { nombre: "Disseny d'interfícies web", sigla: 'DIW', reparto: { examenes: 60, practicas: 40 } },
  { nombre: 'Bases de dades', sigla: 'BBDD', reparto: null },
  { nombre: 'Llenguatges de marques', sigla: 'LMSGI', reparto: null },
  { nombre: 'Sistemes informàtics', sigla: 'SI', reparto: { examenes: 50, practicas: 50 } },
  { nombre: "Desplegament d'aplicacions web", sigla: 'DAW', reparto: null },
  { nombre: 'Digitalització aplicada als sectors productius', sigla: 'DIG', reparto: { examenes: 35, practicas: 45 } },
  { nombre: "Itinerari Personal per l'Ocupabilitat I", sigla: 'IPO', reparto: null },
  { nombre: 'Noves Tecnologies', sigla: 'NT', reparto: { examenes: 40, practicas: 60 } }
];

// datos = { cursos: [{ id, nombre }], cursoActual: id del curso o «ciclo»,
//           modulos: [{ id, cursoId, nombre, sigla, reparto, horas, minimos }],
//           horas: horas del módulo, para ponderar la media del curso (null = sin indicar)
//           minimos: { examenes, practicas } nota mínima de cada media (null = sin mínimo)
//           notas: [{ id, moduloId, actividad, tipo, nota, porcentaje, comentario }],
//           porcentaje: lo que vale la nota dentro de exámenes o actividades (null = sin indicar)
//           fecha: «2026-11-04» o null · recuperaDe: id de la nota que recupera, o null
//           ultimaCopia: fecha ISO o null }
let datos = { cursos: [], cursoActual: null, modulos: [], notas: [], ultimaCopia: null };
const CICLO = 'ciclo';   // valor de «cursoActual» cuando se ve todo el ciclo
let modulos = [];            // módulos con sus actividades y medias (se calcula)
let idSeleccionado = null;   // módulo que se ve en el detalle
let idEditando = null;       // nota o módulo abierto en un formulario (null = nuevo)


// ---------- Utilidades ----------

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Fecha de hoy como «2026-11-04» (hora local)
function hoyISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

// «2026-11-04» → «4 nov 2026» (o «4 nov» si es de este año)
function formatearFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  const opciones = { day: 'numeric', month: 'short' };
  if (a !== new Date().getFullYear()) opciones.year = 'numeric';
  return fecha.toLocaleDateString('es-ES', opciones).replace('.', '');
}

// Días que faltan hasta una fecha: «hoy», «mañana», «en 5 días»
function cuandoEs(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const [ah, mh, dh] = hoyISO().split('-').map(Number);
  const dias = Math.round((new Date(a, m - 1, d) - new Date(ah, mh - 1, dh)) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

// Evita que un texto escrito por el usuario se interprete como HTML
function escapar(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}


// ---------- Guardar y cargar ----------

// Guarda en el dispositivo y avisa a la sincronización (sync.js) de que hay
// cambios. «avisar = false» cuando los datos llegan de la nube.
function guardar(avisar = true) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch (e) {
    mostrarAviso('No se han podido guardar los cambios en este dispositivo.', true);
  }
  // Pide al navegador que no borre los datos aunque necesite espacio
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
  }
  if (avisar) window.dispatchEvent(new Event('cinc:guardado'));
}

// Lo que usa sync.js para leer y cambiar los datos. El curso que se está
// viendo no se sincroniza: cada dispositivo puede estar mirando uno distinto.
window.cinc = {
  datosParaSubir() {
    const { cursoActual, ...resto } = datos;
    return resto;
  },
  hayDatos() {
    return datos.modulos.length > 0 || datos.notas.length > 0;
  },
  aplicarDatosRemotos(remotos) {
    const visto = datos.cursoActual;
    datos = completarNotas({ ...remotos, cursoActual: visto });
    guardar(false);
    pintarTodo();
  },
  mostrarAviso
};

function esCopiaValida(objeto) {
  return objeto && Array.isArray(objeto.modulos) && Array.isArray(objeto.notas);
}

// «Bases de dades (0484)» → «Bases de dades». Quita el código oficial del
// final del nombre (uno o varios de 4 cifras: «(0485+0487)»).
function quitarCodigo(nombre) {
  return String(nombre).replace(/\s*\(\d{4}(\s*\+\s*\d{4})*\)\s*$/, '').trim();
}

// Módulo con todos sus campos (los que falten, vacíos)
function completarModulo(modulo) {
  return {
    ...modulo,
    id: modulo.id || nuevoId(),
    cursoId: modulo.cursoId ?? null,
    reparto: modulo.reparto ?? null,
    horas: modulo.horas ?? null,
    minimos: {
      examenes: modulo.minimos?.examenes ?? null,
      practicas: modulo.minimos?.practicas ?? null
    }
  };
}

// Pone al día datos guardados con versiones anteriores:
// «peso» (1 = normal) pasó a ser «porcentaje», y el tipo «Práctica» ahora es «Actividad»
function completarNotas(objeto) {
  objeto.modulos = objeto.modulos.map(completarModulo);

  // Cursos: las versiones anteriores no tenían; todo va a un primer curso
  if (!Array.isArray(objeto.cursos) || objeto.cursos.length === 0) {
    const esDAW = objeto.modulos.some(m => PLANTILLA_DAW1.some(p => p.sigla === m.sigla));
    objeto.cursos = [{ id: nuevoId(), nombre: esDAW ? '1.º DAW' : 'Mi curso' }];
  }
  for (const m of objeto.modulos) {
    if (!objeto.cursos.some(c => c.id === m.cursoId)) m.cursoId = objeto.cursos[0].id;
  }
  // Una sola vez: los nombres de los módulos pierden el código oficial del final.
  // Después se respeta lo que escriba cada persona.
  if (!objeto.nombresSinCodigo) {
    for (const m of objeto.modulos) m.nombre = quitarCodigo(m.nombre) || m.nombre;
    objeto.nombresSinCodigo = true;
  }

  if (objeto.cursoActual !== CICLO && !objeto.cursos.some(c => c.id === objeto.cursoActual)) {
    objeto.cursoActual = objeto.cursos[0].id;
  }

  for (const nota of objeto.notas) {
    if (nota.porcentaje === undefined) nota.porcentaje = null;
    if (nota.fecha === undefined) nota.fecha = null;
    if (nota.recuperaDe === undefined) nota.recuperaDe = null;
    delete nota.peso;
    if (nota.tipo !== 'Examen') nota.tipo = 'Actividad';
  }
  return objeto;
}

function cargarDatos() {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE));
    if (esCopiaValida(guardados)) return completarNotas(guardados);
  } catch (e) { /* nada guardado */ }
  return completarNotas({ modulos: [], notas: [], ultimaCopia: null });
}


// ---------- Cálculos (las funciones de las medias están en calculos.js) ----------

// Junta cada módulo con sus notas y calcula las medias
function calcularTodo() {
  modulos = datos.modulos.map(m => ({
    ...m,
    // Copias: el cálculo añade el peso y no debe tocar los datos guardados
    actividades: datos.notas.filter(n => n.moduloId === m.id).map(n => ({ ...n }))
  }));
  modulos.forEach(calcularModulo);
}

// ---------- Cursos ----------

function enCiclo() {
  return datos.cursoActual === CICLO;
}

// Curso que se está viendo (en la vista «Ciclo», el primero)
function cursoActivo() {
  return datos.cursos.find(c => c.id === datos.cursoActual) || datos.cursos[0];
}

// Módulos del curso que se está viendo (en «Ciclo», todos)
function modulosVisibles() {
  return enCiclo() ? modulos : modulos.filter(m => m.cursoId === cursoActivo().id);
}


// ---------- Textos de las medias ----------

// «sobre el 50 %» debajo de una media que aún no tiene todas sus notas
function textoEvaluado(evaluado) {
  if (evaluado === null || evaluado === 0 || evaluado >= 100) return '';
  return `<span class="sobre">sobre el ${formatoPorcentaje.format(evaluado)} % evaluado</span>`;
}

// «5 en exámenes · 4 en actividades» (vacío si el módulo no tiene mínimos)
function textoMinimos(minimos) {
  if (!minimos) return '';
  const partes = [];
  if (minimos.examenes !== null) partes.push(`${formatoPorcentaje.format(minimos.examenes)} en exámenes`);
  if (minimos.practicas !== null) partes.push(`${formatoPorcentaje.format(minimos.practicas)} en actividades`);
  return partes.join(' · ');
}

// Reparto oficial: una barra partida en exámenes y actividades, con su leyenda
function htmlReparto(reparto) {
  if (!reparto) {
    return '<dd class="texto color-sin">Sin indicar</dd>';
  }
  const { examenes, practicas } = reparto;
  const resto = 100 - examenes - practicas;

  return `<dd class="reparto">
      <div class="reparto-barra" aria-hidden="true">
        <span class="tramo tramo-examenes" style="width: ${examenes}%"></span>
        <span class="tramo tramo-practicas" style="width: ${practicas}%"></span>
      </div>
      <div class="reparto-leyenda">
        <span><i class="marca marca-examenes"></i>Exámenes <strong class="num">${examenes} %</strong></span>
        <span><i class="marca marca-practicas"></i>Actividades <strong class="num">${practicas} %</strong></span>
        ${resto > 0 ? `<span class="reparto-resto">${resto} % aún no cuenta</span>` : ''}
      </div>
    </dd>`;
}


// ---------- Pintar la página ----------

// «color» permite forzar el color (por ejemplo, rojo si no llega al mínimo)
function barra(nota, color = nivel(nota)) {
  const ancho = nota === null ? 0 : Math.min(Math.max(nota, 0), 10) * 10;
  return `<div class="barra" aria-hidden="true">
            <div class="barra-relleno ${color}" style="width: ${ancho}%"></div>
          </div>`;
}

// Panel de arriba: la media del curso (o del ciclo) y cómo se ha calculado
function pintarResumen() {
  const resumen = document.getElementById('resumen');
  const visibles = modulosVisibles();
  const curso = mediaDelCurso(visibles);
  const notas = visibles.reduce((total, m) => total + m.numNotas, 0);
  const conNota = visibles.filter(m => m.media !== null).length;
  const ciclo = enCiclo();

  document.getElementById('panel-curso').hidden = visibles.length === 0;
  document.getElementById('etiqueta-media').textContent =
    ciclo ? 'Nota del ciclo' : `Media de ${cursoActivo().nombre}`;
  const cifra = document.getElementById('media-curso');
  cifra.textContent = conNota === 0 ? '—' : formatear(curso.media);
  cifra.className = `cifra num ${conNota === 0 ? 'color-sin' : ''}`;

  if (visibles.length === 0) {
    resumen.textContent = 'Tus notas, siempre a mano.';
  } else if (notas === 0) {
    resumen.textContent = 'Aún no hay notas. Pulsa «+ Añadir nota» para añadir la primera.';
  } else if (conNota === 0) {
    resumen.innerHTML =
      `Tienes <strong class="num">${notas}</strong> ${notas === 1 ? 'nota puesta' : 'notas puestas'}, ` +
      'pero aún no se puede calcular ninguna media. Toca un módulo para ver qué falta.';
  } else {
    // Lista «PRG, BBDD y DIG»
    const lista = siglas => siglas.length === 1
      ? siglas[0]
      : siglas.slice(0, -1).join(', ') + ' y ' + siglas[siglas.length - 1];
    let tipoMedia = curso.ponderada
      ? '<span class="resumen-nota">Ponderada por las horas de cada módulo, como la nota final oficial del ciclo.</span>'
      : `<span class="resumen-nota">Es una media simple. Para ponderarla por horas, como la nota oficial, ` +
        `indica las horas de ${escapar(lista(curso.sinHoras))}.</span>`;
    if (ciclo) {
      tipoMedia += '<span class="resumen-nota">Para aprobar el ciclo hay que aprobar todos sus módulos.</span>';
    }

    const cursos = ciclo ? ` de <strong class="num">${datos.cursos.length}</strong> cursos` : '';
    resumen.innerHTML =
      `Con <strong class="num">${notas}</strong> ${notas === 1 ? 'nota puesta' : 'notas puestas'} en ` +
      `<strong class="num">${conNota}</strong> ${conNota === 1 ? 'módulo' : 'módulos'}${cursos}.` + tipoMedia;
  }
}

// «6 notas · 2 pendientes» debajo del nombre de cada módulo
function textoNotasModulo(m) {
  if (m.pendiente) return 'Falta el reparto exámenes / actividades';
  const pendientes = m.actividades.filter(a => a.nota === null).length;
  const partes = [`${m.numNotas} ${m.numNotas === 1 ? 'nota' : 'notas'}`];
  if (pendientes > 0) partes.push(`${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}`);
  return partes.join(' · ');
}

// Lista de módulos del curso: una fila por módulo, con su media a la derecha
function pintarTarjetas() {
  const contenedor = document.getElementById('modulos');
  contenedor.innerHTML = '';

  for (const m of modulosVisibles()) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'fila-modulo';
    boton.dataset.id = m.id;
    if (m.id === idSeleccionado) boton.classList.add('seleccionada');
    boton.setAttribute('aria-pressed', m.id === idSeleccionado);

    const bajoMinimo = m.bajoMinimo.length > 0;
    const color = bajoMinimo ? 'baja' : nivel(m.media);
    let media;
    if (m.media === null) {
      media = `<span class="media-fila sin-nota ${m.pendiente ? 'color-media' : 'color-sin'}">${m.pendiente ? 'Pendiente' : 'Sin nota'}</span>`;
    } else {
      media = `<span class="media-fila num color-${color}">${formatear(m.media)}</span>
        ${bajoMinimo ? '<span class="aviso-fila color-baja">Bajo el mínimo</span>' : barra(m.media, color)}`;
    }

    boton.innerHTML = `
      <span class="insignia">${escapar(m.sigla)}</span>
      <span class="fila-modulo-texto">
        <strong>${escapar(m.nombre)}</strong>
        <small>${escapar(textoNotasModulo(m))}</small>
      </span>
      <span class="fila-modulo-media">${media}</span>`;

    contenedor.appendChild(boton);
  }
}

function pintarDetalle() {
  const detalle = document.getElementById('detalle');
  const m = modulos.find(x => x.id === idSeleccionado);

  if (!m) {
    detalle.hidden = true;
    return;
  }
  detalle.hidden = false;

  // Orden: 1) las que ya tienen nota pero no fecha; 2) las que tienen fecha, de la más
  // antigua a la más nueva; 3) las que no tienen ni nota ni fecha. Si empatan, en el orden en que se añadieron.
  const grupo = a => a.fecha ? 1 : (a.nota !== null ? 0 : 2);
  const ordenadas = m.actividades
    .map((a, i) => ({ a, i }))
    .sort((x, y) => grupo(x.a) - grupo(y.a) || (x.a.fecha || '').localeCompare(y.a.fecha || '') || x.i - y.i)
    .map(x => x.a);

  const filas = ordenadas.map(a => {
    // Una nota no cuenta si aún no está puesta, si le falta el porcentaje o si ya está recuperada
    const noCuenta = a.nota === null || a.faltaPorcentaje || a.ceroPorCiento || a.recuperadaCon;
    let porcentaje = '';
    if (a.porcentaje !== null) {
      porcentaje = `<span class="porcentaje">${formatoPorcentaje.format(a.porcentaje)} %</span>`;
    } else if (a.faltaPorcentaje) {
      porcentaje = '<span class="porcentaje falta">Falta el %</span>';
    }

    let estado = a.comentario;
    if (a.recuperadaCon) estado = `Recuperada con «${a.recuperadaCon}»` + (a.comentario ? ` · ${a.comentario}` : '');
    else if (!estado && a.nota === null) estado = 'Pendiente';
    else if (!estado && a.faltaPorcentaje) estado = 'No cuenta en la media hasta que tenga porcentaje';
    else if (!estado && a.ceroPorCiento) estado = 'Vale 0 %: no cuenta en la media';

    // Debajo del nombre: fecha · tipo · porcentaje · recuperación
    const detalles = [];
    if (a.fecha) detalles.push(escapar(formatearFecha(a.fecha)));
    detalles.push(`<span class="${a.tipo === 'Examen' ? 'examen' : ''}">${escapar(a.tipo)}</span>`);
    if (porcentaje) detalles.push(porcentaje);
    if (a.esRecuperacion) detalles.push(escapar(`Recuperación de «${a.nombreOriginal}»`));

    return `
    <li class="fila-nota ${noCuenta ? 'pendiente' : ''}" data-id="${a.id}" tabindex="0"
        role="button" title="Editar esta nota">
      <span class="nota-texto">
        <strong>${escapar(a.actividad)}</strong>
        <span class="detalle-nota">${detalles.join(' · ')}</span>
        ${estado ? `<span class="nota-estado">${escapar(estado)}</span>` : ''}
      </span>
      <span class="nota-valor">
        <span class="num ${a.nota === null ? 'color-sin' : 'color-' + nivel(a.nota)} ${a.recuperadaCon ? 'tachada' : ''}">${formatear(a.nota)}</span>
        ${barra(a.nota)}
      </span>
    </li>`;
  }).join('');

  const colorMedia = m.bajoMinimo.length > 0 ? 'baja' : nivel(m.media);
  detalle.innerHTML = `
    <div class="detalle-cabecera">
      <div class="detalle-titulo">
        <p class="etiqueta">Módulo seleccionado · ${escapar(m.sigla)}</p>
        <h2>${escapar(m.nombre)}</h2>
      </div>
      <p class="detalle-media num color-${m.pendiente ? 'media' : colorMedia}">
        ${m.pendiente ? 'Pendiente' : formatear(m.media)}${textoEvaluado(m.evaluadoModulo)}
      </p>
    </div>
    <div class="detalle-botones">
      <button type="button" class="boton boton-primario" data-accion="nueva-nota-modulo">+ Añadir nota</button>
      <button type="button" class="boton" data-accion="editar-modulo">Editar módulo</button>
      <button type="button" class="boton boton-icono" data-accion="mover-antes"
              aria-label="Mover el módulo antes" title="Mover antes">←</button>
      <button type="button" class="boton boton-icono" data-accion="mover-despues"
              aria-label="Mover el módulo después" title="Mover después">→</button>
    </div>
    <dl class="datos">
      <div class="dato">
        <dt>Media de exámenes</dt>
        <dd class="num">${formatear(m.mediaExamenes)}${textoEvaluado(m.evaluadoExamenes)}</dd>
      </div>
      <div class="dato">
        <dt>Media de actividades</dt>
        <dd class="num">${formatear(m.mediaPracticas)}${textoEvaluado(m.evaluadoPracticas)}</dd>
      </div>
      <div class="dato dato-reparto">
        <dt>Reparto del módulo</dt>
        ${htmlReparto(m.reparto)}
      </div>
      <div class="dato">
        <dt>Horas</dt>
        <dd class="texto ${m.horas ? 'num' : 'color-sin'}">${m.horas ? `${m.horas} h` : 'Sin indicar'}</dd>
      </div>
      <div class="dato">
        <dt>Nota mínima</dt>
        <dd class="texto ${textoMinimos(m.minimos) ? '' : 'color-sin'}">${textoMinimos(m.minimos) || 'Sin mínimo'}</dd>
      </div>
    </dl>
    ${m.bajoMinimo.length > 0 ? `<p class="aviso aviso-modulo error">
        <strong>No apruebas el módulo${m.media !== null ? ` aunque la media dé ${formatear(m.media)}` : ''}:</strong>
        ${escapar(m.bajoMinimo.join(' y '))}.</p>` : ''}
    ${m.pendiente ? `<div class="aviso aviso-modulo aviso-con-boton">
        <p><strong>Pendiente:</strong> la nota media se calculará cuando se indique cuánto valen los exámenes y cuánto las actividades en este módulo.</p>
        <button type="button" class="boton" data-accion="editar-modulo">Indicar porcentajes</button>
      </div>` : ''}
    ${m.sinPorcentaje > 0
      ? `<p class="aviso aviso-modulo">${m.sinPorcentaje === 1 ? 'Una nota puesta aún no cuenta en la media porque le falta' : `${m.sinPorcentaje} notas puestas aún no cuentan en la media porque les falta`} el porcentaje.</p>`
      : ''}
    ${m.provisional ? `<p class="aviso aviso-modulo">${escapar(m.provisional)}</p>` : ''}
    ${m.avisos.map(aviso => `<p class="aviso aviso-modulo">${escapar(aviso)}</p>`).join('')}
    ${htmlNecesito(m)}
    <h3 class="titulo-notas">Notas</h3>
    <ul class="lista-notas">
      ${filas || '<li class="vacio">Aún no hay notas en este módulo.</li>'}
    </ul>`;
}

// Recuadro «¿Cuánto necesito?» de un módulo
let objetivo = 5;

function htmlNecesito(m) {
  const resultado = cuantoNecesito(m, objetivo);
  // Sin reparto ya hay un aviso; sin nada pendiente no hace falta
  if (resultado.tipo === 'sin-reparto' || resultado.tipo === 'nada-pendiente') return '';

  const lista = notas => notas.map(a => `«${a.actividad}»`).join(', ');
  let texto;
  switch (resultado.tipo) {
    case 'faltan-notas':
      texto = `Para calcularlo, añade los ${resultado.grupo} del módulo (aunque aún no tengan nota).`;
      break;
    case 'necesitas':
      texto = `Necesitas una media de <strong class="num">${formatear(resultado.nota)}</strong> en lo que queda: ${escapar(lista(resultado.pendientes))}.`;
      break;
    case 'asegurado':
      texto = `Ya lo tienes: llegarías aunque sacaras un 0 en lo que queda (${escapar(lista(resultado.pendientes))}).`;
      break;
    case 'imposible':
      texto = resultado.motivo
        ? `No es posible: ${escapar(resultado.motivo)}.`
        : `No es posible: aunque sacaras un 10 en todo lo que queda, no llegarías.`;
      break;
  }

  const opciones = [5, 6, 7, 8, 9, 10]
    .map(n => `<option value="${n}" ${n === objetivo ? 'selected' : ''}>${n}</option>`).join('');
  return `<div class="necesito">
      <label class="necesito-pregunta">
        ¿Cuánto necesito para sacar un
        <select data-accion="objetivo" aria-label="Nota que quieres sacar">${opciones}</select>?
      </label>
      <p>${texto}</p>
    </div>`;
}

// Notas con fecha de hoy en adelante que aún no tienen nota (de todos los cursos)
function notasProximas() {
  const hoy = hoyISO();
  return modulos
    .flatMap(m => m.actividades.map(a => ({ a, m })))
    .filter(({ a }) => a.fecha && a.fecha >= hoy && a.nota === null)
    .sort((x, y) => x.a.fecha.localeCompare(y.a.fecha));
}

// Calendario (.ics): un evento de día completo por cada próxima fecha, con un
// aviso el día antes a las 9:00. Lo abren Calendario de Apple, Google Calendar y Outlook.
function archivoCalendario() {
  // En .ics, las comas, puntos y comas y barras se escriben con «\» delante
  const textoIcs = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const dia = iso => iso.replaceAll('-', '');
  const diaSiguiente = iso => {
    const [a, m, d] = iso.split('-').map(Number);
    const f = new Date(a, m - 1, d + 1);
    return `${f.getFullYear()}${String(f.getMonth() + 1).padStart(2, '0')}${String(f.getDate()).padStart(2, '0')}`;
  };
  const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cinc//Notas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const { a, m } of notasProximas()) {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${a.id}@cinc`,
      `DTSTAMP:${ahora}`,
      `DTSTART;VALUE=DATE:${dia(a.fecha)}`,
      `DTEND;VALUE=DATE:${diaSiguiente(a.fecha)}`,
      `SUMMARY:${textoIcs(`${m.sigla} · ${a.actividad} (${a.tipo.toLowerCase()})`)}`,
      `DESCRIPTION:${textoIcs(`${m.nombre}. Añadido desde Cinc.`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${textoIcs(`Mañana: ${m.sigla} · ${a.actividad}`)}`,
      'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT'
    );
  }
  lineas.push('END:VCALENDAR');
  return new File([lineas.join('\r\n') + '\r\n'], 'cinc-fechas.ics', { type: 'text/calendar' });
}

// Próximas fechas: notas con fecha de hoy en adelante que aún no tienen nota
// Se ve en la agenda (las 5 primeras) y la primera también en el panel de arriba
function pintarProximas() {
  const todas = notasProximas();
  const proximas = todas.slice(0, 5);

  // La agenda se ve siempre que el curso tenga módulos; si no hay fechas, lo dice
  document.getElementById('proximas').hidden = modulosVisibles().length === 0;
  document.getElementById('sin-proximas').hidden = proximas.length > 0;
  document.getElementById('boton-calendario').hidden = proximas.length === 0;
  document.getElementById('lista-proximas').innerHTML = proximas.map(({ a, m }) => `
    <li>
      <button type="button" class="proxima" data-modulo="${m.id}">
        <span class="proxima-fecha">${escapar(formatearFecha(a.fecha))}</span>
        <span class="proxima-nombre"><strong>${escapar(a.actividad)}</strong>
          <small>${escapar(m.sigla)} · <span class="${a.tipo === 'Examen' ? 'examen' : ''}">${escapar(a.tipo.toLowerCase())}</span></small></span>
        <span class="proxima-cuando">${cuandoEs(a.fecha)}</span>
      </button>
    </li>`).join('');

  // Panel de arriba: solo la más cercana
  const panel = document.getElementById('panel-proxima');
  if (todas.length === 0) {
    panel.innerHTML = `<p class="etiqueta">Próxima fecha</p>
      <p class="proxima-grande color-sin">Sin fechas</p>
      <p class="resumen">Pon fecha a tus exámenes y entregas para verlos aquí.</p>`;
  } else {
    const { a, m } = todas[0];
    panel.innerHTML = `<p class="etiqueta">Próxima fecha · ${cuandoEs(a.fecha)}</p>
      <button type="button" class="proxima-panel" data-modulo="${m.id}">
        <span class="proxima-grande">${escapar(formatearFecha(a.fecha))}</span>
        <span class="resumen">${escapar(a.actividad)} · ${escapar(m.sigla)}</span>
      </button>`;
  }
}

// Aviso de arriba. «tipo» sirve para saber qué aviso es al cerrarlo.
function mostrarAviso(texto, esError, tipo = null) {
  const aviso = document.getElementById('aviso');
  document.getElementById('aviso-texto').textContent = texto;
  aviso.classList.toggle('error', esError);
  aviso.dataset.tipo = tipo || '';
  aviso.hidden = false;
}

// Al cerrar el recordatorio de la copia, no vuelve a salir en una semana
const CLAVE_AVISO_COPIA = 'cinc-aviso-copia-cerrado';

document.getElementById('cerrar-aviso').addEventListener('click', () => {
  const aviso = document.getElementById('aviso');
  if (aviso.dataset.tipo === 'copia') {
    try { localStorage.setItem(CLAVE_AVISO_COPIA, String(Date.now())); } catch (e) { /* sin almacenamiento */ }
  }
  aviso.hidden = true;
});

// Vuelve a calcular y pintar todo después de cualquier cambio
function pintarTodo() {
  calcularTodo();
  const visibles = modulosVisibles();

  if (!visibles.some(m => m.id === idSeleccionado)) {
    idSeleccionado = visibles.length > 0 ? visibles[0].id : null;
  }

  const ciclo = enCiclo();
  const hayModulos = visibles.length > 0;
  document.getElementById('bienvenida').hidden = hayModulos || ciclo;
  document.getElementById('seccion-modulos').hidden = !hayModulos || ciclo;
  document.getElementById('seccion-ciclo').hidden = !ciclo;
  document.getElementById('boton-nueva-nota').hidden = !hayModulos || ciclo;

  pintarCursos();
  pintarResumen();
  pintarProximas();
  if (ciclo) {
    pintarCiclo();
    document.getElementById('detalle').hidden = true;
  } else {
    pintarTarjetas();
    pintarDetalle();
  }
}

// Barra de cursos: uno por curso, «Ciclo» (si hay más de uno) y «+ Curso»
function pintarCursos() {
  const barra = document.getElementById('cursos');
  const botones = datos.cursos.map(c => `
    <button type="button" class="curso ${c.id === datos.cursoActual ? 'activo' : ''}" data-curso="${c.id}"
            aria-pressed="${c.id === datos.cursoActual}">${escapar(c.nombre)}</button>`);
  if (datos.cursos.length > 1) {
    botones.push(`<button type="button" class="curso ${enCiclo() ? 'activo' : ''}" data-curso="${CICLO}"
            aria-pressed="${enCiclo()}">Ciclo</button>`);
  }
  botones.push('<button type="button" class="curso curso-nuevo" data-accion="nuevo-curso">+ Curso</button>');
  barra.innerHTML = botones.join('');
}

// Vista «Ciclo»: una tarjeta por curso con su media
function pintarCiclo() {
  document.getElementById('lista-cursos').innerHTML = datos.cursos.map(c => {
    const suyos = modulos.filter(m => m.cursoId === c.id);
    const media = mediaDelCurso(suyos).media;
    const conMedia = suyos.filter(m => m.media !== null).length;
    return `
      <button type="button" class="fila-modulo" data-curso="${c.id}">
        <span class="insignia">${escapar(c.nombre.slice(0, 4))}</span>
        <span class="fila-modulo-texto">
          <strong>${escapar(c.nombre)}</strong>
          <small>${suyos.length} ${suyos.length === 1 ? 'módulo' : 'módulos'}, ${conMedia} con media · ${valoracion(media)}</small>
        </span>
        <span class="fila-modulo-media">
          ${media === null
            ? '<span class="media-fila sin-nota color-sin">Sin nota</span>'
            : `<span class="media-fila num color-${nivel(media)}">${formatear(media)}</span>${barra(media)}`}
        </span>
      </button>`;
  }).join('');
}


// ---------- Orden de los módulos ----------

// Mueve el módulo seleccionado un puesto antes (-1) o después (+1) dentro de su curso
function moverModulo(direccion) {
  const actual = datos.modulos.find(m => m.id === idSeleccionado);
  const delCurso = datos.modulos.filter(m => m.cursoId === actual.cursoId);
  const vecino = delCurso[delCurso.indexOf(actual) + direccion];
  if (!vecino) return;   // ya es el primero o el último

  const i = datos.modulos.indexOf(actual);
  const j = datos.modulos.indexOf(vecino);
  [datos.modulos[i], datos.modulos[j]] = [datos.modulos[j], datos.modulos[i]];
  guardar();
  pintarTodo();
}


// ---------- Deshacer ----------

// Después de borrar, sale un aviso abajo con «Deshacer» durante unos segundos.
// Se guarda una copia de los datos de antes de borrar.
let copiaParaDeshacer = null;
let temporizadorDeshacer = null;

function ofrecerDeshacer(texto, antes) {
  copiaParaDeshacer = antes;
  document.getElementById('deshacer-texto').textContent = texto;
  document.getElementById('deshacer').hidden = false;
  clearTimeout(temporizadorDeshacer);
  temporizadorDeshacer = setTimeout(ocultarDeshacer, 8000);
}

function ocultarDeshacer() {
  copiaParaDeshacer = null;
  document.getElementById('deshacer').hidden = true;
}

document.getElementById('boton-deshacer').addEventListener('click', () => {
  if (!copiaParaDeshacer) return;
  datos = JSON.parse(copiaParaDeshacer);
  guardar();
  pintarTodo();
  ocultarDeshacer();
});


// ---------- Formulario de notas ----------

const dialogoNota = document.getElementById('dialogo-nota');
const formNota = document.getElementById('form-nota');

function abrirNota(idNota, idModulo) {
  if (modulos.length === 0) return;
  idEditando = idNota;
  const nota = datos.notas.find(n => n.id === idNota);

  // Lista de módulos del desplegable
  formNota.modulo.innerHTML = datos.modulos
    .filter(m => m.cursoId === cursoActivo().id || (nota && m.id === nota.moduloId))
    .map(m => `<option value="${m.id}">${escapar(m.sigla)} · ${escapar(m.nombre)}</option>`)
    .join('');

  document.getElementById('titulo-nota').textContent = nota ? 'Editar nota' : 'Nueva nota';
  formNota.modulo.value = nota ? nota.moduloId : (idModulo || idSeleccionado);
  formNota.actividad.value = nota ? nota.actividad : '';
  formNota.tipo.value = nota ? nota.tipo : 'Actividad';
  formNota.nota.value = nota && nota.nota !== null ? String(nota.nota).replace('.', ',') : '';
  formNota.porcentaje.value = nota && nota.porcentaje !== null ? String(nota.porcentaje).replace('.', ',') : '';
  formNota.comentario.value = nota ? nota.comentario : '';
  formNota.fecha.value = nota && nota.fecha ? nota.fecha : '';
  rellenarRecuperaciones(nota ? nota.recuperaDe : null);
  document.getElementById('borrar-nota').hidden = !nota;
  document.getElementById('error-nota').textContent = '';
  explicarPorcentaje();

  dialogoNota.showModal();
  formNota.actividad.focus();
}

// Desplegable «Recuperación de»: notas del módulo elegido que no son a su vez
// recuperaciones (ni la propia nota)
function rellenarRecuperaciones(seleccionada) {
  const opciones = datos.notas.filter(n =>
    n.moduloId === formNota.modulo.value && n.id !== idEditando && !n.recuperaDe);
  formNota.recuperaDe.innerHTML = '<option value="">No</option>' + opciones
    .map(n => `<option value="${n.id}">${escapar(n.actividad)}</option>`).join('');
  formNota.recuperaDe.value = opciones.some(n => n.id === seleccionada) ? seleccionada : '';
  aplicarRecuperacionEnFormulario();
}

// Una recuperación usa el tipo y el % de la nota original: se rellenan y no se pueden cambiar
function aplicarRecuperacionEnFormulario() {
  const original = datos.notas.find(n => n.id === formNota.recuperaDe.value);
  const ayuda = document.getElementById('ayuda-recuperacion');
  formNota.tipo.disabled = Boolean(original);
  formNota.porcentaje.disabled = Boolean(original);

  if (original) {
    formNota.tipo.value = original.tipo;
    formNota.porcentaje.value = original.porcentaje !== null ? String(original.porcentaje).replace('.', ',') : '';
    ayuda.textContent = `Cuando tenga nota, sustituirá a «${original.actividad}» en la media, con su mismo tipo y porcentaje. Mientras no la tenga, cuenta la nota original.`;
    ayuda.hidden = false;
  } else {
    ayuda.hidden = true;
  }
  explicarPorcentaje();
}

formNota.recuperaDe.addEventListener('change', aplicarRecuperacionEnFormulario);
formNota.modulo.addEventListener('change', () => rellenarRecuperaciones(null));

// El campo del porcentaje se llama «% en exámenes» o «% en actividades» según
// el tipo elegido
function explicarPorcentaje() {
  const esExamen = formNota.tipo.value === 'Examen';
  const etiqueta = esExamen ? '% en exámenes' : '% en actividades';
  const grupo = esExamen ? 'los exámenes' : 'las actividades';
  const todas = esExamen ? 'todos los exámenes juntos' : 'todas las actividades juntas';
  const ninguna = esExamen ? 'ningún examen' : 'ninguna actividad';
  const [las, todos, algunos] = esExamen ? ['los', 'todos', 'algunos'] : ['las', 'todas', 'algunas'];

  document.getElementById('etiqueta-porcentaje').textContent = etiqueta;
  document.getElementById('nombre-ayuda-porcentaje').textContent = etiqueta + ' (opcional):';
  document.getElementById('ayuda-porcentaje').textContent =
    ` cuánto vale esta nota dentro de ${grupo} (${todas} suman 100 %). ` +
    `Si no lo pones en ${ninguna}, ${todos} cuentan lo mismo; si lo pones solo en ${algunos}, ` +
    `${las} que no lo tengan no cuentan. Un 0 % significa que esta nota no cuenta.`;
}

formNota.modulo.addEventListener('change', explicarPorcentaje);
formNota.tipo.addEventListener('change', explicarPorcentaje);

formNota.addEventListener('submit', evento => {
  evento.preventDefault();
  const error = document.getElementById('error-nota');

  const actividad = formNota.actividad.value.trim();
  const textoNota = formNota.nota.value.trim();
  const nota = aNumero(textoNota);
  const textoPorcentaje = formNota.porcentaje.value.trim().replace('%', '');
  const porcentaje = aNumero(textoPorcentaje);

  if (actividad === '') {
    error.textContent = 'Escribe un nombre (por ejemplo, Prova 1).';
    return;
  }
  if (textoNota !== '' && (nota === null || nota < 0 || nota > 10)) {
    error.textContent = 'La nota tiene que ser un número de 0 a 10 (o déjala vacía).';
    return;
  }
  if (textoPorcentaje !== '' && (porcentaje === null || porcentaje < 0 || porcentaje > 100)) {
    error.textContent = 'El porcentaje tiene que estar entre 0 y 100 (o déjalo vacío).';
    return;
  }
  const fecha = formNota.fecha.value;   // el campo de fecha da «2026-11-04» o vacío
  if (fecha !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    error.textContent = 'La fecha no es válida.';
    return;
  }

  const valores = {
    moduloId: formNota.modulo.value,
    actividad: actividad,
    tipo: formNota.tipo.value,
    nota: nota,
    porcentaje: porcentaje,   // 0 % = no cuenta en la media
    comentario: formNota.comentario.value.trim(),
    fecha: fecha || null,
    recuperaDe: formNota.recuperaDe.value || null
  };

  if (idEditando) {
    Object.assign(datos.notas.find(n => n.id === idEditando), valores);
  } else {
    datos.notas.push({ id: nuevoId(), ...valores });
  }

  idSeleccionado = valores.moduloId;
  guardar();
  pintarTodo();
  dialogoNota.close();
  recordarCopia();
});

document.getElementById('borrar-nota').addEventListener('click', () => {
  const nota = datos.notas.find(n => n.id === idEditando);
  const antes = JSON.stringify(datos);   // para poder deshacer

  datos.notas = datos.notas.filter(n => n.id !== idEditando);
  for (const n of datos.notas) {
    if (n.recuperaDe === idEditando) n.recuperaDe = null;   // su recuperación pasa a ser una nota normal
  }
  guardar();
  pintarTodo();
  dialogoNota.close();
  ofrecerDeshacer(`Nota «${nota.actividad}» borrada.`, antes);
});


// ---------- Formulario de módulos ----------

const dialogoModulo = document.getElementById('dialogo-modulo');
const formModulo = document.getElementById('form-modulo');

function abrirModulo(idModulo) {
  idEditando = idModulo;
  const modulo = datos.modulos.find(m => m.id === idModulo);

  document.getElementById('titulo-modulo').textContent = modulo ? 'Editar módulo' : 'Nuevo módulo';
  formModulo.nombre.value = modulo ? modulo.nombre : '';
  formModulo.sigla.value = modulo ? modulo.sigla : '';
  formModulo.curso.innerHTML = datos.cursos
    .map(c => `<option value="${c.id}">${escapar(c.nombre)}</option>`).join('');
  formModulo.curso.value = modulo ? modulo.cursoId : cursoActivo().id;
  formModulo.examenes.value = modulo && modulo.reparto ? String(modulo.reparto.examenes).replace('.', ',') : '';
  formModulo.practicas.value = modulo && modulo.reparto ? String(modulo.reparto.practicas).replace('.', ',') : '';
  const comoTexto = valor => (valor === null || valor === undefined ? '' : String(valor).replace('.', ','));
  formModulo.horas.value = modulo ? comoTexto(modulo.horas) : '';
  formModulo.minExamenes.value = modulo ? comoTexto(modulo.minimos.examenes) : '';
  formModulo.minPracticas.value = modulo ? comoTexto(modulo.minimos.practicas) : '';
  document.getElementById('borrar-modulo').hidden = !modulo;
  document.getElementById('error-modulo').textContent = '';

  dialogoModulo.showModal();
  formModulo.nombre.focus();
}

// La sigla siempre en mayúsculas
formModulo.sigla.addEventListener('input', () => {
  formModulo.sigla.value = formModulo.sigla.value.toUpperCase();
});

formModulo.addEventListener('submit', evento => {
  evento.preventDefault();
  const error = document.getElementById('error-modulo');

  const nombre = formModulo.nombre.value.trim();
  const sigla = formModulo.sigla.value.trim().toUpperCase();
  let reparto = null;

  if (nombre === '' || sigla === '') {
    error.textContent = 'Escribe el nombre y la sigla del módulo.';
    return;
  }
  // La sigla no se puede repetir dentro de un mismo curso
  if (datos.modulos.some(m => m.sigla === sigla && m.cursoId === formModulo.curso.value && m.id !== idEditando)) {
    error.textContent = `Ya tienes un módulo con la sigla ${sigla} en ese curso.`;
    return;
  }
  // Los dos porcentajes, o ninguno (entonces la media del módulo queda pendiente)
  const textoExamenes = formModulo.examenes.value.trim().replace('%', '');
  const textoPracticas = formModulo.practicas.value.trim().replace('%', '');
  if (textoExamenes !== '' || textoPracticas !== '') {
    const examenes = aNumero(textoExamenes);
    const practicas = aNumero(textoPracticas);
    if (examenes === null || practicas === null) {
      error.textContent = 'Rellena los dos porcentajes (exámenes y actividades) o deja los dos vacíos.';
      return;
    }
    if (examenes < 0 || practicas < 0 || examenes + practicas > 100 || examenes + practicas === 0) {
      error.textContent = 'Los porcentajes de exámenes y actividades tienen que sumar entre 1 y 100.';
      return;
    }
    reparto = { examenes: examenes, practicas: practicas };
  }

  // Horas: número entero mayor que 0, o vacío
  const textoHoras = formModulo.horas.value.trim();
  const horas = aNumero(textoHoras);
  if (textoHoras !== '' && (horas === null || horas <= 0 || !Number.isInteger(horas))) {
    error.textContent = 'Las horas tienen que ser un número entero mayor que 0 (o déjalas vacías).';
    return;
  }

  // Mínimos: de 0 a 10, o vacíos
  const minimo = campo => {
    const texto = campo.value.trim();
    if (texto === '') return null;
    const valor = aNumero(texto);
    return valor !== null && valor >= 0 && valor <= 10 ? valor : undefined;
  };
  const minimos = { examenes: minimo(formModulo.minExamenes), practicas: minimo(formModulo.minPracticas) };
  if (minimos.examenes === undefined || minimos.practicas === undefined) {
    error.textContent = 'La nota mínima tiene que estar entre 0 y 10 (o déjala vacía).';
    return;
  }

  const valores = { nombre, sigla, reparto, horas: textoHoras === '' ? null : horas, minimos, cursoId: formModulo.curso.value };
  if (idEditando) {
    Object.assign(datos.modulos.find(m => m.id === idEditando), valores);
  } else {
    const nuevo = completarModulo(valores);
    datos.modulos.push(nuevo);
    idSeleccionado = nuevo.id;
  }

  // Se pasa a ver el curso del módulo (por si se ha cambiado de curso)
  datos.cursoActual = valores.cursoId;
  guardar();
  pintarTodo();
  dialogoModulo.close();
});

document.getElementById('borrar-modulo').addEventListener('click', () => {
  const modulo = datos.modulos.find(m => m.id === idEditando);
  const cuantas = datos.notas.filter(n => n.moduloId === idEditando).length;
  const aviso = cuantas > 0
    ? `¿Borrar ${modulo.sigla}? También se borrarán sus ${cuantas} notas.`
    : `¿Borrar ${modulo.sigla}?`;
  if (!confirm(aviso)) return;
  const antes = JSON.stringify(datos);

  datos.modulos = datos.modulos.filter(m => m.id !== idEditando);
  datos.notas = datos.notas.filter(n => n.moduloId !== idEditando);
  guardar();
  pintarTodo();
  dialogoModulo.close();
  ofrecerDeshacer(`Módulo ${modulo.sigla} borrado.`, antes);
});


// ---------- Formulario de cursos ----------

const dialogoCurso = document.getElementById('dialogo-curso');
const formCurso = document.getElementById('form-curso');
let idCursoEditando = null;

function abrirCurso(idCurso) {
  idCursoEditando = idCurso;
  const curso = datos.cursos.find(c => c.id === idCurso);
  document.getElementById('titulo-curso').textContent = curso ? 'Editar curso' : 'Nuevo curso';
  formCurso.nombre.value = curso ? curso.nombre : '';
  // No se puede borrar el único curso
  document.getElementById('borrar-curso').hidden = !curso || datos.cursos.length === 1;
  document.getElementById('error-curso').textContent = '';
  dialogoCurso.showModal();
  formCurso.nombre.focus();
}

formCurso.addEventListener('submit', evento => {
  evento.preventDefault();
  const nombre = formCurso.nombre.value.trim();
  const error = document.getElementById('error-curso');
  if (nombre === '') {
    error.textContent = 'Escribe un nombre para el curso (por ejemplo, 2.º DAW).';
    return;
  }
  if (datos.cursos.some(c => c.nombre.toLowerCase() === nombre.toLowerCase() && c.id !== idCursoEditando)) {
    error.textContent = `Ya tienes un curso llamado «${nombre}».`;
    return;
  }

  if (idCursoEditando) {
    datos.cursos.find(c => c.id === idCursoEditando).nombre = nombre;
  } else {
    const nuevo = { id: nuevoId(), nombre };
    datos.cursos.push(nuevo);
    datos.cursoActual = nuevo.id;
  }
  guardar();
  pintarTodo();
  dialogoCurso.close();
});

document.getElementById('borrar-curso').addEventListener('click', () => {
  const curso = datos.cursos.find(c => c.id === idCursoEditando);
  const suyos = datos.modulos.filter(m => m.cursoId === curso.id);
  const notas = datos.notas.filter(n => suyos.some(m => m.id === n.moduloId)).length;
  const aviso = suyos.length > 0
    ? `¿Borrar ${curso.nombre}? También se borrarán sus ${suyos.length} módulos y ${notas} notas.`
    : `¿Borrar ${curso.nombre}?`;
  if (!confirm(aviso)) return;
  const antes = JSON.stringify(datos);

  datos.notas = datos.notas.filter(n => !suyos.some(m => m.id === n.moduloId));
  datos.modulos = datos.modulos.filter(m => m.cursoId !== curso.id);
  datos.cursos = datos.cursos.filter(c => c.id !== curso.id);
  datos.cursoActual = datos.cursos[0].id;
  guardar();
  pintarTodo();
  dialogoCurso.close();
  ofrecerDeshacer(`Curso ${curso.nombre} borrado.`, antes);
});

// Cambiar de curso (barra de arriba y tarjetas de la vista «Ciclo»)
function irACurso(idCurso) {
  datos.cursoActual = idCurso;
  guardar();
  pintarTodo();
}

document.getElementById('cursos').addEventListener('click', evento => {
  const boton = evento.target.closest('button');
  if (!boton) return;
  if (boton.dataset.accion === 'nuevo-curso') abrirCurso(null);
  else irACurso(boton.dataset.curso);
});

document.getElementById('lista-cursos').addEventListener('click', evento => {
  const tarjeta = evento.target.closest('[data-curso]');
  if (tarjeta) irACurso(tarjeta.dataset.curso);
});

document.querySelector('[data-accion="editar-curso"]').addEventListener('click', () => abrirCurso(cursoActivo().id));


// ---------- Plantilla ----------

function usarPlantilla() {
  const curso = cursoActivo();
  const delCurso = datos.modulos.filter(m => m.cursoId === curso.id);
  // Un curso vacío con el nombre por defecto pasa a llamarse como la plantilla
  if (delCurso.length === 0 && curso.nombre === 'Mi curso') curso.nombre = '1.º DAW';

  for (const p of PLANTILLA_DAW1) {
    if (!delCurso.some(m => m.sigla === p.sigla)) {
      datos.modulos.push(completarModulo({ ...p, cursoId: curso.id }));
    }
  }
  guardar();
  pintarTodo();
}


// ---------- Copia de seguridad ----------

const dialogoCopia = document.getElementById('dialogo-copia');

function abrirCopia() {
  const fecha = datos.ultimaCopia
    ? new Date(datos.ultimaCopia).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'nunca';
  document.getElementById('ultima-copia').textContent = fecha;
  document.getElementById('error-copia').textContent = '';
  // «Compartir» solo si el navegador puede compartir archivos (sobre todo en el móvil)
  document.getElementById('boton-compartir-copia').hidden = !puedeCompartirArchivos();
  dialogoCopia.showModal();
}

function crearArchivo(contenido, nombreArchivo) {
  return new File([JSON.stringify(contenido, null, 2)], nombreArchivo, { type: 'application/json' });
}

function puedeCompartirArchivos() {
  try {
    return Boolean(navigator.canShare) && navigator.canShare({ files: [crearArchivo({}, 'prueba.json')] });
  } catch (e) {
    return false;
  }
}

function descargarArchivo(archivo) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = archivo.name;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// Abre el menú «Compartir» del sistema (WhatsApp, AirDrop, Drive, correo…).
// Devuelve true si se compartió; si la persona lo cancela, false.
async function compartirArchivo(archivo, titulo) {
  try {
    await navigator.share({ files: [archivo], title: titulo });
    return true;
  } catch (e) {
    if (e.name === 'AbortError') return false;   // cerró el menú sin elegir nada
    descargarArchivo(archivo);                     // no se pudo compartir: se descarga
    return true;
  }
}

// Solo los módulos (del curso que se ve), sin notas, para pasárselos a otra persona
async function exportarModulos() {
  const modulosSinNotas = datos.modulos
    .filter(m => enCiclo() || m.cursoId === cursoActivo().id)
    .map(({ nombre, sigla, reparto, horas, minimos }) => ({ nombre, sigla, reparto, horas, minimos }));
  const archivo = crearArchivo(
    { app: 'Cinc', tipo: 'modulos', version: 1, exportado: new Date().toISOString(), modulos: modulosSinNotas },
    `cinc-modulos-${hoyISO()}.json`
  );
  if (puedeCompartirArchivos()) await compartirArchivo(archivo, 'Módulos de Cinc');
  else descargarArchivo(archivo);
}

// Añade módulos compartidos al curso que se ve: los de una sigla que ya existe
// en ese curso se actualizan (sin tocar sus notas) y los demás se añaden
function cargarModulos(lista) {
  const curso = cursoActivo();
  const delCurso = datos.modulos.filter(m => m.cursoId === curso.id);
  const nuevos = lista.filter(m => !delCurso.some(x => x.sigla === m.sigla)).length;
  const actualizados = lista.length - nuevos;
  const pregunta = `Se añadirán ${nuevos} ${nuevos === 1 ? 'módulo' : 'módulos'} a ${curso.nombre}` +
    (actualizados > 0 ? ` y se actualizarán ${actualizados} que ya tienes (misma sigla)` : '') +
    '. Tus notas no se tocan. ¿Seguir?';
  if (!confirm(pregunta)) return;
  const antes = JSON.stringify(datos);   // para poder deshacer

  for (const m of lista) {
    const existente = delCurso.find(x => x.sigla === m.sigla);
    const valores = completarModulo({ ...m, id: null, cursoId: curso.id });
    if (existente) {
      Object.assign(existente, { nombre: valores.nombre, reparto: valores.reparto, horas: valores.horas, minimos: valores.minimos });
    } else {
      datos.modulos.push(valores);
    }
  }
  datos.cursoActual = curso.id;
  guardar();
  pintarTodo();
  if (dialogoCopia.open) dialogoCopia.close();
  ofrecerDeshacer(`Módulos cargados en ${curso.nombre}: ${nuevos} ${nuevos === 1 ? 'nuevo' : 'nuevos'} y ${actualizados} ${actualizados === 1 ? 'actualizado' : 'actualizados'}.`, antes);
}

// Copia completa: cursos, módulos y notas
function archivoCopia() {
  return crearArchivo({
    app: 'Cinc',
    version: 2,
    exportado: new Date().toISOString(),
    cursos: datos.cursos,
    cursoActual: datos.cursoActual,
    nombresSinCodigo: true,
    modulos: datos.modulos,
    notas: datos.notas
  }, `cinc-copia-${hoyISO()}.json`);
}

function copiaHecha() {
  datos.ultimaCopia = new Date().toISOString();
  guardar();
  document.getElementById('aviso').hidden = true;
  document.getElementById('ultima-copia').textContent = 'hoy';
}

async function compartirCopia() {
  if (await compartirArchivo(archivoCopia(), 'Copia de Cinc')) copiaHecha();
}

function exportar() {
  descargarArchivo(archivoCopia());
  copiaHecha();
}

async function importar(archivo) {
  const error = document.getElementById('error-copia');
  // Los errores se muestran en el diálogo de copia (aunque se importe desde la bienvenida)
  const fallo = texto => {
    if (!dialogoCopia.open) abrirCopia();
    error.textContent = texto;
  };

  let contenido;
  try {
    contenido = JSON.parse(await archivo.text());
  } catch (e) {
    fallo('Ese archivo no es una copia de Cinc.');
    return;
  }
  if (!contenido || typeof contenido !== 'object') {
    fallo('Ese archivo no es una copia de Cinc.');
    return;
  }

  // Si el archivo tiene datos que no son válidos, no se carga nada y se dice qué pasa
  const rechazar = problemas => {
    const mas = problemas.length > 3 ? ` …y ${problemas.length - 3} más.` : '';
    fallo('El archivo tiene datos que no son válidos y no se ha cargado: ' + problemas.slice(0, 3).join(' ') + mas);
  };

  // Módulos compartidos (sin notas): se añaden a los que ya hay
  if (contenido.tipo === 'modulos') {
    const problemas = problemasArchivo(contenido, true);
    if (problemas.length > 0) { rechazar(problemas); return; }
    cargarModulos(contenido.modulos);
    return;
  }

  let nuevos;
  if (esCopiaValida(contenido)) {
    const problemas = problemasArchivo(contenido);
    if (problemas.length > 0) { rechazar(problemas); return; }
    nuevos = completarNotas({
      cursos: contenido.cursos, cursoActual: contenido.cursoActual, nombresSinCodigo: contenido.nombresSinCodigo,
      modulos: contenido.modulos, notas: contenido.notas, ultimaCopia: contenido.exportado || null
    });
  } else {
    fallo('Ese archivo no es una copia de Cinc.');
    return;
  }

  const hayDatos = datos.modulos.length > 0;
  if (hayDatos && !confirm('Esto sustituye todos los módulos y notas de este dispositivo por los de la copia. ¿Seguir?')) {
    return;
  }

  const antes = JSON.stringify(datos);   // para poder deshacer
  datos = nuevos;
  idSeleccionado = null;
  guardar();
  pintarTodo();
  if (dialogoCopia.open) dialogoCopia.close();
  ofrecerDeshacer(`Copia cargada: ${datos.modulos.length} módulos y ${datos.notas.length} notas.`, antes);
}

// Aviso si hay bastantes notas y hace más de un mes (o nunca) que no se hace copia
function recordarCopia() {
  const unMes = 30 * 24 * 60 * 60 * 1000;
  const sinCopiaReciente = !datos.ultimaCopia || Date.now() - new Date(datos.ultimaCopia) > unMes;
  let cerradoHace = Infinity;
  try { cerradoHace = Date.now() - Number(localStorage.getItem(CLAVE_AVISO_COPIA) || 0); } catch (e) { /* sin almacenamiento */ }
  const unaSemana = 7 * 24 * 60 * 60 * 1000;
  if (datos.notas.length >= 5 && sinCopiaReciente && cerradoHace > unaSemana) {
    mostrarAviso('Tus notas solo están en este dispositivo. Haz una copia de seguridad de vez en cuando (botón «Copia»).', false, 'copia');
  }
}


// ---------- Eventos ----------

document.getElementById('boton-nueva-nota').addEventListener('click', () => abrirNota(null));
document.getElementById('boton-copia').addEventListener('click', abrirCopia);
document.getElementById('boton-acerca').addEventListener('click', () => {
  document.getElementById('version').textContent = VERSION;
  document.getElementById('dialogo-acerca').showModal();
});
document.getElementById('boton-plantilla').addEventListener('click', usarPlantilla);
document.getElementById('boton-primer-modulo').addEventListener('click', () => abrirModulo(null));
document.getElementById('boton-exportar').addEventListener('click', exportar);
document.getElementById('boton-compartir-copia').addEventListener('click', compartirCopia);
document.getElementById('boton-compartir').addEventListener('click', exportarModulos);

// Los dos botones de importar (bienvenida y diálogo) usan el mismo selector de archivo
const entradaArchivo = document.getElementById('archivo-copia');
document.querySelectorAll('[data-accion="importar"]').forEach(boton => {
  boton.addEventListener('click', () => entradaArchivo.click());
});
entradaArchivo.addEventListener('change', () => {
  if (entradaArchivo.files.length > 0) importar(entradaArchivo.files[0]);
  entradaArchivo.value = '';   // para poder elegir el mismo archivo otra vez
});

// Lista de módulos: al tocar uno, se ve su detalle
document.getElementById('modulos').addEventListener('click', evento => {
  const fila = evento.target.closest('.fila-modulo');
  if (!fila) return;
  idSeleccionado = fila.dataset.id;
  pintarTarjetas();
  pintarDetalle();
  // En el móvil el detalle queda debajo de todo: se baja hasta él
  if (window.matchMedia('(max-width: 900px)').matches) {
    document.getElementById('detalle').scrollIntoView({ behavior: 'smooth' });
  }
});

document.getElementById('boton-nuevo-modulo').addEventListener('click', () => abrirModulo(null));

// Detalle: editar el módulo, añadir una nota o editar una fila
const detalle = document.getElementById('detalle');

detalle.addEventListener('click', evento => {
  const boton = evento.target.closest('[data-accion]');
  const fila = evento.target.closest('.fila-nota');

  if (boton && boton.dataset.accion === 'editar-modulo') abrirModulo(idSeleccionado);
  else if (boton && boton.dataset.accion === 'mover-antes') moverModulo(-1);
  else if (boton && boton.dataset.accion === 'mover-despues') moverModulo(1);
  else if (boton && boton.dataset.accion === 'nueva-nota-modulo') abrirNota(null, idSeleccionado);
  else if (fila) abrirNota(fila.dataset.id);
});

// «¿Cuánto necesito para sacar un …?»
detalle.addEventListener('change', evento => {
  if (evento.target.dataset.accion === 'objetivo') {
    objetivo = Number(evento.target.value);
    pintarDetalle();
  }
});

// Añadir todas las próximas fechas al calendario
document.getElementById('boton-calendario').addEventListener('click', () => {
  descargarArchivo(archivoCalendario());
});

// Próximas fechas (agenda y panel de arriba): al tocar una, se abre su módulo.
// Si es de otro curso, se cambia a ese curso.
function abrirProxima(evento) {
  const boton = evento.target.closest('[data-modulo]');
  if (!boton) return;
  const modulo = modulos.find(m => m.id === boton.dataset.modulo);
  if (!modulo) return;
  idSeleccionado = modulo.id;
  if (enCiclo() || modulo.cursoId !== datos.cursoActual) {
    datos.cursoActual = modulo.cursoId;
    guardar();
  }
  pintarTodo();
  detalle.scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('lista-proximas').addEventListener('click', abrirProxima);
document.getElementById('panel-proxima').addEventListener('click', abrirProxima);

detalle.addEventListener('keydown', evento => {
  const fila = evento.target.closest('.fila-nota');
  if (fila && (evento.key === 'Enter' || evento.key === ' ')) {
    evento.preventDefault();
    abrirNota(fila.dataset.id);
  }
});

// Botones «Cancelar» de los diálogos
document.querySelectorAll('[data-cerrar]').forEach(boton => {
  boton.addEventListener('click', () => boton.closest('dialog').close());
});


// ---------- Arranque ----------

datos = cargarDatos();
pintarTodo();

// Service worker para que la app se pueda instalar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
