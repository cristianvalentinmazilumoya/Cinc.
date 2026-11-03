// ============================================================
//  Cinc — guarda las notas en el dispositivo y calcula las medias
// ============================================================

// Dónde se guardan los datos (localStorage del navegador)
const CLAVE = 'cinc-datos';
// Copia de la hoja de Google que guardaba la versión anterior de la app
const CLAVE_ANTIGUA = 'notas-daw1-ultimos-datos';

// Plantilla para 1.º de DAW. «reparto» solo en los módulos con reparto
// oficial publicado (% de exámenes y % de actividades).
const PLANTILLA_DAW1 = [
  { nombre: 'Programació + Entorns de desenvolupament (0485+0487)', sigla: 'PRG', reparto: null },
  { nombre: "Disseny d'interfícies web (0615)", sigla: 'DIW', reparto: { examenes: 60, practicas: 40 } },
  { nombre: 'Bases de dades (0484)', sigla: 'BBDD', reparto: null },
  { nombre: 'Llenguatges de marques (0373)', sigla: 'LMSGI', reparto: null },
  { nombre: 'Sistemes informàtics (0483)', sigla: 'SI', reparto: { examenes: 50, practicas: 50 } },
  { nombre: "Desplegament d'aplicacions web (0614)", sigla: 'DAW', reparto: null },
  { nombre: 'Digitalització aplicada als sectors productius (1665)', sigla: 'DIG', reparto: { examenes: 35, practicas: 45 } },
  { nombre: "Itinerari Personal per l'Ocupabilitat I (1709)", sigla: 'IPO', reparto: null },
  { nombre: 'Noves Tecnologies', sigla: 'NT', reparto: { examenes: 40, practicas: 60 } }
];

const formato = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Porcentajes: «45», «33,3»
const formatoPorcentaje = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

// datos = { modulos: [{ id, nombre, sigla, reparto }],
//           notas: [{ id, moduloId, actividad, tipo, nota, porcentaje, comentario }],
//           porcentaje: lo que vale la nota dentro de su grupo (null = sin indicar, no cuenta)
//           ultimaCopia: fecha ISO o null }
let datos = { modulos: [], notas: [], ultimaCopia: null };
let modulos = [];            // módulos con sus actividades y medias (se calcula)
let idSeleccionado = null;   // módulo que se ve en el detalle
let idEditando = null;       // nota o módulo abierto en un formulario (null = nuevo)


// ---------- Utilidades ----------

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// "9,00" → 9 · "8.5" → 8.5 · "1.234,5" → 1234.5 · "" → null
// Si hay coma, la coma es el decimal y los puntos son de miles;
// si no, el punto es el decimal (así se escribe en el teclado del Mac).
function aNumero(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return valor;

  const texto = String(valor).trim();
  if (texto === '') return null;

  const limpio = texto.includes(',') ? texto.replaceAll('.', '').replace(',', '.') : texto;
  const numero = Number(limpio);
  return Number.isNaN(numero) ? null : numero;
}

// "Módulo" → "modulo", para comparar cabeceras sin tildes ni mayúsculas
function normalizar(texto) {
  return String(texto || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
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

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch (e) {
    mostrarAviso('No se han podido guardar los cambios en este dispositivo.', true);
  }
  // Pide al navegador que no borre los datos aunque necesite espacio
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
  }
}

function esCopiaValida(objeto) {
  return objeto && Array.isArray(objeto.modulos) && Array.isArray(objeto.notas);
}

// Pone al día datos guardados con versiones anteriores:
// «peso» (1 = normal) pasó a ser «porcentaje», y el tipo «Práctica» ahora es «Actividad»
function completarNotas(objeto) {
  for (const nota of objeto.notas) {
    if (nota.porcentaje === undefined) nota.porcentaje = null;
    delete nota.peso;
    if (nota.tipo !== 'Examen') nota.tipo = 'Actividad';
  }
  return objeto;
}

function cargarDatos() {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE));
    if (esCopiaValida(guardados)) return { datos: completarNotas(guardados), migrado: false };
  } catch (e) { /* nada guardado */ }

  // Primera vez con esta versión: si quedan las notas de la hoja de Google, se pasan
  try {
    const antiguos = JSON.parse(localStorage.getItem(CLAVE_ANTIGUA));
    if (antiguos && Array.isArray(antiguos.filas)) {
      return { datos: desdeHoja(antiguos.filas), migrado: true };
    }
  } catch (e) { /* no había hoja */ }

  return { datos: { modulos: [], notas: [], ultimaCopia: null }, migrado: false };
}


// ---------- Importar desde la hoja de Google antigua ----------

// Convierte las filas de la hoja en actividades. Las columnas se buscan por
// el nombre de su cabecera, así da igual en qué orden estén.
function leerFilas(filas) {
  const filaCabecera = filas.findIndex(f => f.some(c => normalizar(c) === 'modulo'));
  if (filaCabecera === -1) throw new Error('No encuentro la cabecera «Módulo»');

  const cabeceras = filas[filaCabecera].map(normalizar);
  const columna = nombre => cabeceras.findIndex(c => c.startsWith(nombre));
  const col = {
    modulo: columna('modulo'),
    tipo: columna('tipo'),
    actividad: columna('actividad'),
    nota: columna('nota'),
    comentario: columna('comentario')
  };
  const celda = (fila, i) => (i === -1 ? '' : String(fila[i] ?? '').trim());

  const actividades = [];

  for (let i = filaCabecera + 1; i < filas.length; i++) {
    const fila = filas[i];
    const modulo = celda(fila, col.modulo);
    if (modulo === '') continue;   // fila vacía

    actividades.push({
      modulo: modulo,
      tipo: celda(fila, col.tipo) === 'Examen' ? 'Examen' : 'Actividad',
      actividad: celda(fila, col.actividad),
      nota: aNumero(celda(fila, col.nota)),
      comentario: celda(fila, col.comentario)
    });
  }

  return actividades;
}

// Filas de la hoja → { modulos, notas }. Los módulos de la plantilla de DAW
// se reconocen por la sigla o el nombre y conservan su reparto.
function desdeHoja(filas) {
  const nuevos = { modulos: [], notas: [], ultimaCopia: null };

  for (const a of leerFilas(filas)) {
    let modulo = nuevos.modulos.find(m => m.sigla === a.modulo.toUpperCase() || m.nombre === a.modulo);

    if (!modulo) {
      const plantilla = PLANTILLA_DAW1.find(p => p.sigla === a.modulo.toUpperCase() || p.nombre === a.modulo);
      modulo = plantilla
        ? { ...plantilla, id: nuevoId() }
        : { id: nuevoId(), nombre: a.modulo, sigla: a.modulo.slice(0, 5).toUpperCase(), reparto: null };
      nuevos.modulos.push(modulo);
    }

    nuevos.notas.push({
      id: nuevoId(),
      moduloId: modulo.id,
      actividad: a.actividad,
      tipo: a.tipo,
      nota: a.nota,
      porcentaje: null,   // en la hoja todas valían lo mismo
      comentario: a.comentario
    });
  }

  return nuevos;
}


// ---------- Cálculos ----------

// El porcentaje de cada nota es dentro de su grupo: dentro de los exámenes o
// de las actividades si el módulo tiene reparto, o dentro de todo el módulo si
// no lo tiene. En cada grupo los porcentajes suman 100 %.
// Una nota sin porcentaje no cuenta en la media: no se inventa lo que vale.
// Devuelve un aviso si los porcentajes no cuadran. «valeEnLaNota» es lo que
// vale el grupo en el reparto oficial (null si el módulo no tiene reparto).
function asignarPesos(notas, nombreGrupo, valeEnLaNota) {
  for (const a of notas) {
    a.faltaPorcentaje = a.porcentaje === null;
    a.peso = a.porcentaje ?? 0;
  }

  const asignado = notas.reduce((suma, a) => suma + (a.porcentaje ?? 0), 0);
  const texto = n => formatoPorcentaje.format(n) + ' %';

  if (asignado > 100) {
    return `Los porcentajes de ${nombreGrupo} suman ${texto(asignado)}, más del 100 %.`;
  }
  // Todas tienen porcentaje y suman justo lo que vale el grupo en la nota final
  // (por ejemplo 10 + 10 + 20 = 40 %): seguramente se han puesto sobre la nota
  // final. La media sale igual, pero «sobre el … % evaluado» no llegaría al 100 %.
  const todasConPorcentaje = notas.length > 0 && notas.every(a => a.porcentaje !== null);
  if (todasConPorcentaje && valeEnLaNota !== null && valeEnLaNota !== 100 && asignado === valeEnLaNota) {
    return `Los porcentajes de ${nombreGrupo} suman ${texto(asignado)}, lo mismo que valen en la nota final. ` +
           `Aquí van dentro de ${nombreGrupo}, así que en total deberían sumar 100 %.`;
  }
  return null;
}

// Qué parte del grupo ya está evaluada: la suma de los porcentajes de las
// notas puestas (como mucho 100).
function porcentajeEvaluado(notas) {
  const suma = notas
    .filter(a => a.nota !== null)
    .reduce((total, a) => total + (a.porcentaje ?? 0), 0);
  return Math.min(suma, 100);
}

// ¿Hay alguna nota puesta a la que le falte el porcentaje?
function faltanPorcentajes(notas) {
  return notas.some(a => a.nota !== null && a.porcentaje === null);
}

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

  // Con reparto, los exámenes y las actividades van por separado;
  // sin reparto, todas las actividades forman un solo grupo
  const reparto = modulo.reparto;
  const avisos = reparto
    ? [asignarPesos(examenes, 'los exámenes', reparto.examenes),
       asignarPesos(practicas, 'las actividades', reparto.practicas)]
    : [asignarPesos(modulo.actividades, 'este módulo', null)];

  // Un grupo que vale 0 % en el reparto nunca cuenta: se avisa si tiene actividades
  if (reparto && reparto.examenes === 0 && examenes.length > 0) {
    avisos.push('Los exámenes valen 0 % en el reparto de este módulo, así que no cuentan en la media.');
  }
  if (reparto && reparto.practicas === 0 && practicas.length > 0) {
    avisos.push('Las actividades valen 0 % en el reparto de este módulo, así que no cuentan en la media.');
  }
  modulo.avisos = avisos.filter(aviso => aviso !== null);

  modulo.evaluadoExamenes = porcentajeEvaluado(examenes);
  modulo.evaluadoPracticas = porcentajeEvaluado(practicas);

  // Parte de la nota final que ya está evaluada
  if (reparto) {
    modulo.evaluadoModulo =
      (reparto.examenes * modulo.evaluadoExamenes + reparto.practicas * modulo.evaluadoPracticas) / 100;
  } else {
    modulo.evaluadoModulo = porcentajeEvaluado(modulo.actividades);
  }

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

    // Si hay media pero a uno de los dos grupos (que sí cuenta) aún le falta,
    // la media es provisional: se calcula con el otro, en proporción
    if (modulo.media !== null) {
      if (reparto.examenes > 0 && modulo.mediaExamenes === null) {
        modulo.provisional = 'Provisional: de momento solo cuentan las actividades, porque ' +
          (faltanPorcentajes(examenes) ? 'falta el porcentaje de los exámenes con nota.' : 'aún no hay exámenes con nota.');
      } else if (reparto.practicas > 0 && modulo.mediaPracticas === null) {
        modulo.provisional = 'Provisional: de momento solo cuentan los exámenes, porque ' +
          (faltanPorcentajes(practicas) ? 'falta el porcentaje de las actividades con nota.' : 'aún no hay actividades con nota.');
      }
    }
  } else {
    modulo.media = mediaPonderada(modulo.actividades);
  }

  // Hay notas, pero ninguna tiene porcentaje: la media queda pendiente
  modulo.pendiente = modulo.media === null && faltanPorcentajes(modulo.actividades);
  // Notas puestas que todavía no cuentan porque les falta el porcentaje
  modulo.sinPorcentaje = modulo.actividades.filter(a => a.nota !== null && a.porcentaje === null).length;
}

// Junta cada módulo con sus notas y calcula las medias
function calcularTodo() {
  modulos = datos.modulos.map(m => ({
    ...m,
    // Copias: el cálculo añade el peso y no debe tocar los datos guardados
    actividades: datos.notas.filter(n => n.moduloId === m.id).map(n => ({ ...n }))
  }));
  modulos.forEach(calcularModulo);
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

// «sobre el 50 %» debajo de una media que aún no tiene todas sus notas
function textoEvaluado(evaluado) {
  if (evaluado === null || evaluado === 0 || evaluado >= 100) return '';
  return `<span class="sobre">sobre el ${formatoPorcentaje.format(evaluado)} % evaluado</span>`;
}

// Reparto oficial: una barra partida en exámenes y actividades, con su leyenda
function htmlReparto(reparto) {
  if (!reparto) {
    return '<dd class="texto">Sin reparto: todas las notas cuentan en una sola media</dd>';
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

function barra(nota) {
  const ancho = nota === null ? 0 : Math.min(Math.max(nota, 0), 10) * 10;
  return `<div class="barra" aria-hidden="true">
            <div class="barra-relleno ${nivel(nota)}" style="width: ${ancho}%"></div>
          </div>`;
}

function pintarResumen() {
  const resumen = document.getElementById('resumen');
  const media = mediaDelCurso(modulos);
  const notas = modulos.reduce((total, m) => total + m.numNotas, 0);
  const conNota = modulos.filter(m => m.media !== null).length;

  if (modulos.length === 0) {
    resumen.textContent = 'Tus notas, siempre a mano.';
  } else if (notas === 0) {
    resumen.textContent = 'Aún no hay notas. Pulsa «+ Añadir nota» para añadir la primera.';
  } else if (conNota === 0) {
    resumen.innerHTML =
      `Tienes <strong class="num">${notas}</strong> ${notas === 1 ? 'nota puesta' : 'notas puestas'}, ` +
      'pero las medias se calcularán cuando indiques el porcentaje de cada nota.';
  } else {
    resumen.innerHTML =
      `Media del curso <strong class="num">${formatear(media)}</strong> con ` +
      `<strong class="num">${notas}</strong> ${notas === 1 ? 'nota puesta' : 'notas puestas'} en ` +
      `<strong class="num">${conNota}</strong> ${conNota === 1 ? 'módulo' : 'módulos'}. ` +
      `Toca un módulo para ver todas sus notas.`;
  }
}

function pintarTarjetas() {
  const contenedor = document.getElementById('modulos');
  contenedor.innerHTML = '';

  for (const m of modulos) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'tarjeta';
    boton.dataset.id = m.id;
    if (m.id === idSeleccionado) boton.classList.add('seleccionada');
    boton.setAttribute('aria-pressed', m.id === idSeleccionado);

    const media = m.media === null
      ? `<div class="media-grande sin-nota color-sin">${m.pendiente ? 'Pendiente' : 'Sin nota'}</div>`
      : `<div class="media-grande num color-${nivel(m.media)}">${formatear(m.media)}</div>`;

    boton.innerHTML = `
      <div class="tarjeta-arriba">
        <span class="sigla">${escapar(m.sigla)}</span>
        <span class="pastilla ${nivel(m.media)}">${m.pendiente ? 'Pendiente' : valoracion(m.media)}</span>
      </div>
      <div class="nombre-modulo">${escapar(m.nombre)}</div>
      ${media}
      ${barra(m.media)}`;

    contenedor.appendChild(boton);
  }

  // Tarjeta para crear un módulo nuevo
  const nueva = document.createElement('button');
  nueva.type = 'button';
  nueva.className = 'tarjeta tarjeta-nueva';
  nueva.dataset.accion = 'nuevo-modulo';
  nueva.innerHTML = '<span class="mas" aria-hidden="true">+</span> Módulo';
  contenedor.appendChild(nueva);
}

function pintarDetalle() {
  const detalle = document.getElementById('detalle');
  const m = modulos.find(x => x.id === idSeleccionado);

  if (!m) {
    detalle.hidden = true;
    return;
  }
  detalle.hidden = false;

  const filas = m.actividades.map(a => {
    // Una nota no cuenta si aún no está puesta o si le falta el porcentaje
    const noCuenta = a.nota === null || a.faltaPorcentaje;
    let porcentaje = '';
    if (a.porcentaje !== null) {
      porcentaje = `<span class="porcentaje">${formatoPorcentaje.format(a.porcentaje)} %</span>`;
    } else if (a.faltaPorcentaje) {
      porcentaje = '<span class="porcentaje falta">Falta el %</span>';
    }

    let estado = a.comentario;
    if (!estado && a.nota === null) estado = 'Pendiente';
    else if (!estado && a.faltaPorcentaje) estado = 'No cuenta en la media hasta que tenga porcentaje';

    return `
    <tr class="fila-nota ${noCuenta ? 'pendiente' : ''}" data-id="${a.id}" tabindex="0"
        title="Editar esta nota">
      <td>${escapar(a.actividad)}</td>
      <td>
        <span class="${a.tipo === 'Examen' ? 'examen' : ''}">${escapar(a.tipo)}</span>
        ${porcentaje}
      </td>
      <td>
        <div class="celda-nota">
          <span class="num ${a.nota === null ? '' : 'color-' + nivel(a.nota)}">${formatear(a.nota)}</span>
          ${barra(a.nota)}
        </div>
      </td>
      <td class="col-comentario comentario">${escapar(estado)}</td>
    </tr>`;
  }).join('');

  detalle.innerHTML = `
    <div class="detalle-cabecera">
      <h2>${escapar(m.nombre)}</h2>
      <button type="button" class="boton" data-accion="editar-modulo">Editar módulo</button>
    </div>
    <dl class="datos">
      <div class="dato">
        <dt>Media del módulo</dt>
        <dd class="num color-${nivel(m.media)}">${m.pendiente ? 'Pendiente' : formatear(m.media)}${textoEvaluado(m.evaluadoModulo)}</dd>
      </div>
      <div class="dato">
        <dt>Media de exámenes</dt>
        <dd class="num">${formatear(m.mediaExamenes)}${textoEvaluado(m.evaluadoExamenes)}</dd>
      </div>
      <div class="dato">
        <dt>Media de actividades</dt>
        <dd class="num">${formatear(m.mediaPracticas)}${textoEvaluado(m.evaluadoPracticas)}</dd>
      </div>
      <div class="dato dato-reparto">
        <dt>Reparto oficial</dt>
        ${htmlReparto(m.reparto)}
      </div>
    </dl>
    ${m.pendiente ? '<p class="aviso aviso-modulo"><strong>Pendiente:</strong> la nota media se calculará cuando se indique el porcentaje de cada nota.</p>' : ''}
    ${!m.pendiente && m.sinPorcentaje > 0
      ? `<p class="aviso aviso-modulo">${m.sinPorcentaje === 1 ? 'Una nota puesta aún no cuenta en la media porque le falta' : `${m.sinPorcentaje} notas puestas aún no cuentan en la media porque les falta`} el porcentaje.</p>`
      : ''}
    ${m.provisional ? `<p class="aviso aviso-modulo">${escapar(m.provisional)}</p>` : ''}
    ${m.avisos.map(aviso => `<p class="aviso aviso-modulo">${escapar(aviso)}</p>`).join('')}
    <table class="tabla">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Tipo</th>
          <th>Nota</th>
          <th class="col-comentario">Estado / comentario</th>
        </tr>
      </thead>
      <tbody>${filas || '<tr><td colspan="4" class="vacio">Aún no hay notas en este módulo.</td></tr>'}</tbody>
    </table>
    <button type="button" class="boton boton-primario anadir-en-modulo" data-accion="nueva-nota-modulo">
      + Añadir nota de ${escapar(m.sigla)}
    </button>`;
}

function mostrarAviso(texto, esError) {
  const aviso = document.getElementById('aviso');
  aviso.textContent = texto;
  aviso.classList.toggle('error', esError);
  aviso.hidden = false;
}

// Vuelve a calcular y pintar todo después de cualquier cambio
function pintarTodo() {
  calcularTodo();

  if (!modulos.some(m => m.id === idSeleccionado)) {
    idSeleccionado = modulos.length > 0 ? modulos[0].id : null;
  }

  const hayModulos = modulos.length > 0;
  document.getElementById('bienvenida').hidden = hayModulos;
  document.getElementById('seccion-modulos').hidden = !hayModulos;
  document.getElementById('boton-nueva-nota').hidden = !hayModulos;

  pintarResumen();
  pintarTarjetas();
  pintarDetalle();
}


// ---------- Formulario de notas ----------

const dialogoNota = document.getElementById('dialogo-nota');
const formNota = document.getElementById('form-nota');

function abrirNota(idNota, idModulo) {
  if (modulos.length === 0) return;
  idEditando = idNota;
  const nota = datos.notas.find(n => n.id === idNota);

  // Lista de módulos del desplegable
  formNota.modulo.innerHTML = datos.modulos
    .map(m => `<option value="${m.id}">${escapar(m.sigla)} · ${escapar(m.nombre)}</option>`)
    .join('');

  document.getElementById('titulo-nota').textContent = nota ? 'Editar nota' : 'Nueva nota';
  formNota.modulo.value = nota ? nota.moduloId : (idModulo || idSeleccionado);
  formNota.actividad.value = nota ? nota.actividad : '';
  formNota.tipo.value = nota ? nota.tipo : 'Actividad';
  formNota.nota.value = nota && nota.nota !== null ? String(nota.nota).replace('.', ',') : '';
  formNota.porcentaje.value = nota && nota.porcentaje !== null ? String(nota.porcentaje).replace('.', ',') : '';
  formNota.comentario.value = nota ? nota.comentario : '';
  document.getElementById('borrar-nota').hidden = !nota;
  document.getElementById('error-nota').textContent = '';
  explicarPorcentaje();

  dialogoNota.showModal();
  formNota.actividad.focus();
}

// El campo del porcentaje se llama «% en exámenes» o «% en actividades» según el
// tipo elegido, y su ayuda dice cuánto valen en total
function explicarPorcentaje() {
  const modulo = datos.modulos.find(m => m.id === formNota.modulo.value);
  const esExamen = formNota.tipo.value === 'Examen';
  let etiqueta, grupo, todas;

  if (!modulo || modulo.reparto) {
    etiqueta = esExamen ? '% en exámenes' : '% en actividades';
    grupo = esExamen ? 'los exámenes' : 'las actividades';
    todas = esExamen ? 'todos los exámenes juntos' : 'todas las actividades juntas';
  } else {
    // Sin reparto, exámenes y actividades forman un solo grupo
    etiqueta = '% del módulo';
    grupo = 'el módulo';
    todas = 'todas las actividades del módulo juntas';
  }

  document.getElementById('etiqueta-porcentaje').textContent = etiqueta;
  document.getElementById('nombre-ayuda-porcentaje').textContent = etiqueta + ':';
  document.getElementById('ayuda-porcentaje').textContent =
    ` cuánto vale esta nota dentro de ${grupo} (${todas} suman 100 %). ` +
    'Si no lo sabes, déjalo vacío: quedará pendiente y no contará en la media.';
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

  const valores = {
    moduloId: formNota.modulo.value,
    actividad: actividad,
    tipo: formNota.tipo.value,
    nota: nota,
    porcentaje: porcentaje === 0 ? null : porcentaje,   // 0 % = sin indicar: no cuenta
    comentario: formNota.comentario.value.trim()
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
  if (!confirm(`¿Borrar «${nota.actividad}»?`)) return;

  datos.notas = datos.notas.filter(n => n.id !== idEditando);
  guardar();
  pintarTodo();
  dialogoNota.close();
});


// ---------- Formulario de módulos ----------

const dialogoModulo = document.getElementById('dialogo-modulo');
const formModulo = document.getElementById('form-modulo');

function mostrarCamposReparto() {
  document.getElementById('campos-reparto').hidden = !formModulo.tieneReparto.checked;
}

function abrirModulo(idModulo) {
  idEditando = idModulo;
  const modulo = datos.modulos.find(m => m.id === idModulo);

  document.getElementById('titulo-modulo').textContent = modulo ? 'Editar módulo' : 'Nuevo módulo';
  formModulo.nombre.value = modulo ? modulo.nombre : '';
  formModulo.sigla.value = modulo ? modulo.sigla : '';
  formModulo.tieneReparto.checked = Boolean(modulo && modulo.reparto);
  formModulo.examenes.value = modulo && modulo.reparto ? modulo.reparto.examenes : 50;
  formModulo.practicas.value = modulo && modulo.reparto ? modulo.reparto.practicas : 50;
  mostrarCamposReparto();
  document.getElementById('borrar-modulo').hidden = !modulo;
  document.getElementById('error-modulo').textContent = '';

  dialogoModulo.showModal();
  formModulo.nombre.focus();
}

formModulo.tieneReparto.addEventListener('change', mostrarCamposReparto);

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
  if (datos.modulos.some(m => m.sigla === sigla && m.id !== idEditando)) {
    error.textContent = `Ya tienes un módulo con la sigla ${sigla}.`;
    return;
  }
  if (formModulo.tieneReparto.checked) {
    const examenes = aNumero(formModulo.examenes.value);
    const practicas = aNumero(formModulo.practicas.value);
    if (examenes === null || practicas === null || examenes < 0 || practicas < 0 ||
        examenes + practicas > 100 || examenes + practicas === 0) {
      error.textContent = 'Los porcentajes tienen que sumar entre 1 y 100.';
      return;
    }
    reparto = { examenes: examenes, practicas: practicas };
  }

  if (idEditando) {
    Object.assign(datos.modulos.find(m => m.id === idEditando), { nombre, sigla, reparto });
  } else {
    const nuevo = { id: nuevoId(), nombre, sigla, reparto };
    datos.modulos.push(nuevo);
    idSeleccionado = nuevo.id;
  }

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

  datos.modulos = datos.modulos.filter(m => m.id !== idEditando);
  datos.notas = datos.notas.filter(n => n.moduloId !== idEditando);
  guardar();
  pintarTodo();
  dialogoModulo.close();
});


// ---------- Plantilla ----------

function usarPlantilla() {
  for (const p of PLANTILLA_DAW1) {
    if (!datos.modulos.some(m => m.sigla === p.sigla)) {
      datos.modulos.push({ ...p, id: nuevoId() });
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
  dialogoCopia.showModal();
}

function exportar() {
  datos.ultimaCopia = new Date().toISOString();
  guardar();

  const copia = {
    app: 'Cinc',
    version: 1,
    exportado: datos.ultimaCopia,
    modulos: datos.modulos,
    notas: datos.notas
  };
  const archivo = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `cinc-copia-${datos.ultimaCopia.slice(0, 10)}.json`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);

  document.getElementById('aviso').hidden = true;
  document.getElementById('ultima-copia').textContent = 'hoy';
}

async function importar(archivo) {
  const error = document.getElementById('error-copia');
  let nuevos;

  try {
    const contenido = JSON.parse(await archivo.text());
    if (esCopiaValida(contenido)) {
      nuevos = completarNotas({ modulos: contenido.modulos, notas: contenido.notas, ultimaCopia: contenido.exportado || null });
    } else if (Array.isArray(contenido.filas)) {
      nuevos = desdeHoja(contenido.filas);   // copia de la antigua hoja de Google
    } else {
      throw new Error('Formato desconocido');
    }
  } catch (e) {
    if (!dialogoCopia.open) abrirCopia();   // si se importó desde la bienvenida
    error.textContent = 'Ese archivo no es una copia de Cinc.';
    return;
  }

  const hayDatos = datos.modulos.length > 0;
  if (hayDatos && !confirm('Esto sustituye todos los módulos y notas de este dispositivo por los de la copia. ¿Seguir?')) {
    return;
  }

  datos = nuevos;
  idSeleccionado = null;
  guardar();
  pintarTodo();
  if (dialogoCopia.open) dialogoCopia.close();
  mostrarAviso(`Copia cargada: ${datos.modulos.length} módulos y ${datos.notas.length} notas.`, false);
}

// Aviso si hay bastantes notas y hace más de un mes (o nunca) que no se hace copia
function recordarCopia() {
  const unMes = 30 * 24 * 60 * 60 * 1000;
  const sinCopiaReciente = !datos.ultimaCopia || Date.now() - new Date(datos.ultimaCopia) > unMes;
  if (datos.notas.length >= 5 && sinCopiaReciente) {
    mostrarAviso('Tus notas solo están en este dispositivo. Haz una copia de seguridad de vez en cuando (botón «Copia»).', false);
  }
}


// ---------- Eventos ----------

document.getElementById('boton-nueva-nota').addEventListener('click', () => abrirNota(null));
document.getElementById('boton-copia').addEventListener('click', abrirCopia);
document.getElementById('boton-plantilla').addEventListener('click', usarPlantilla);
document.getElementById('boton-primer-modulo').addEventListener('click', () => abrirModulo(null));
document.getElementById('boton-exportar').addEventListener('click', exportar);

// Los dos botones de importar (bienvenida y diálogo) usan el mismo selector de archivo
const entradaArchivo = document.getElementById('archivo-copia');
document.querySelectorAll('[data-accion="importar"]').forEach(boton => {
  boton.addEventListener('click', () => entradaArchivo.click());
});
entradaArchivo.addEventListener('change', () => {
  if (entradaArchivo.files.length > 0) importar(entradaArchivo.files[0]);
  entradaArchivo.value = '';   // para poder elegir el mismo archivo otra vez
});

// Tarjetas: seleccionar un módulo o crear uno nuevo
document.getElementById('modulos').addEventListener('click', evento => {
  const tarjeta = evento.target.closest('.tarjeta');
  if (!tarjeta) return;

  if (tarjeta.dataset.accion === 'nuevo-modulo') {
    abrirModulo(null);
  } else {
    idSeleccionado = tarjeta.dataset.id;
    pintarTarjetas();
    pintarDetalle();
  }
});

// Detalle: editar el módulo, añadir una nota o editar una fila
const detalle = document.getElementById('detalle');

detalle.addEventListener('click', evento => {
  const boton = evento.target.closest('[data-accion]');
  const fila = evento.target.closest('.fila-nota');

  if (boton && boton.dataset.accion === 'editar-modulo') abrirModulo(idSeleccionado);
  else if (boton && boton.dataset.accion === 'nueva-nota-modulo') abrirNota(null, idSeleccionado);
  else if (fila) abrirNota(fila.dataset.id);
});

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

const inicio = cargarDatos();
datos = inicio.datos;
if (inicio.migrado) {
  guardar();
  mostrarAviso('He pasado a la app las notas que tenías en la hoja de Google. A partir de ahora se escriben aquí.', false);
}
pintarTodo();

// Service worker para que la app se pueda instalar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
