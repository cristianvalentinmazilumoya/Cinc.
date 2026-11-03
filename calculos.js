// ============================================================
//  Cinc — cálculo de las medias
//  Funciones que no tocan la página ni los datos guardados: reciben módulos
//  y notas y devuelven resultados. Las usan app.js y la página de pruebas.
// ============================================================

const formato = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Porcentajes: «45», «33,3»
const formatoPorcentaje = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });


// ---------- Números ----------

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


// ---------- Medias de cada módulo ----------

// Lo imprescindible para la media del módulo es su reparto: cuánto valen los
// exámenes y cuánto las actividades. Sin reparto, la media queda pendiente.
//
// Dentro de cada grupo (exámenes o actividades), el porcentaje de cada nota es
// opcional y los de un grupo suman 100 %:
// - Si ninguna nota del grupo tiene porcentaje, todas cuentan lo mismo.
// - Si algunas lo tienen, las que no lo tienen no cuentan (no se inventa lo que valen).
// Devuelve un aviso si los porcentajes no cuadran. «valeEnLaNota» es lo que
// vale el grupo en el reparto del módulo (null si no tiene reparto).
function asignarPesos(notas, nombreGrupo, valeEnLaNota) {
  // Una nota con 0 % no cuenta nunca (por ejemplo, una prueba inicial que solo
  // sirve de diagnóstico). Las demás siguen las reglas de arriba.
  const hayPorcentajes = notas.some(a => a.porcentaje > 0);

  for (const a of notas) {
    a.ceroPorCiento = a.porcentaje === 0;
    a.faltaPorcentaje = hayPorcentajes && a.porcentaje === null;
    if (a.ceroPorCiento) a.peso = 0;
    else a.peso = hayPorcentajes ? (a.porcentaje ?? 0) : 1;
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
// notas puestas (como mucho 100). Si no hay notas, es 0. Si hay notas pero el
// grupo no usa porcentajes, no se puede saber (null).
function porcentajeEvaluado(notas) {
  const conNota = notas.filter(a => a.nota !== null);
  if (conNota.length === 0) return 0;
  if (!notas.some(a => a.porcentaje > 0)) return null;
  const suma = conNota.reduce((total, a) => total + (a.porcentaje ?? 0), 0);
  return Math.min(suma, 100);
}

// Media ponderada (nota × peso / suma de pesos) de las notas puestas.
function mediaPonderada(notas) {
  let suma = 0;
  let pesos = 0;

  for (const a of notas) {
    if (a.nota === null) continue;
    suma += a.nota * a.peso;
    pesos += a.peso;
  }

  return pesos > 0 ? suma / pesos : null;
}

// Recuperaciones: una nota puede ser la recuperación de otra del mismo módulo.
// Usa el tipo y el porcentaje de la original y, cuando tiene nota, la sustituye.
// Mientras no tiene nota, cuenta la original.
function aplicarRecuperaciones(notas) {
  const porId = new Map(notas.map(a => [a.id, a]));
  for (const a of notas) {
    const original = a.recuperaDe ? porId.get(a.recuperaDe) : null;
    if (!original || original.recuperaDe || original === a) continue;   // enlace roto: nota normal

    a.esRecuperacion = true;
    a.nombreOriginal = original.actividad;
    a.tipo = original.tipo;
    a.porcentaje = original.porcentaje;
    if (a.nota !== null) {
      original.recuperadaCon = a.actividad;
    } else {
      a.recuperacionPendiente = true;
      original.recuperacionEnCurso = a.actividad;   // para «¿Cuánto necesito?»
    }
  }
  // Las notas que cuentan para las medias
  return notas.filter(a => !a.recuperadaCon && !a.recuperacionPendiente);
}

function calcularModulo(modulo) {
  const cuentan = aplicarRecuperaciones(modulo.actividades);
  const examenes = cuentan.filter(a => a.tipo === 'Examen');
  const practicas = cuentan.filter(a => a.tipo !== 'Examen');
  const reparto = modulo.reparto;

  const avisos = [
    asignarPesos(examenes, 'los exámenes', reparto ? reparto.examenes : null),
    asignarPesos(practicas, 'las actividades', reparto ? reparto.practicas : null)
  ];
  // Un grupo que vale 0 % en el reparto nunca cuenta: se avisa si tiene notas
  if (reparto && reparto.examenes === 0 && examenes.length > 0) {
    avisos.push('Los exámenes valen 0 % en el reparto de este módulo, así que no cuentan en la media.');
  }
  if (reparto && reparto.practicas === 0 && practicas.length > 0) {
    avisos.push('Las actividades valen 0 % en el reparto de este módulo, así que no cuentan en la media.');
  }
  modulo.avisos = avisos.filter(aviso => aviso !== null);

  modulo.mediaExamenes = mediaPonderada(examenes);
  modulo.mediaPracticas = mediaPonderada(practicas);
  modulo.evaluadoExamenes = porcentajeEvaluado(examenes);
  modulo.evaluadoPracticas = porcentajeEvaluado(practicas);
  modulo.numNotas = cuentan.filter(a => a.nota !== null).length;
  // Notas puestas que no cuentan porque en su grupo otras sí tienen porcentaje
  modulo.sinPorcentaje = cuentan.filter(a => a.nota !== null && a.faltaPorcentaje).length;
  modulo.grupos = { examenes, practicas };

  modulo.media = null;
  modulo.evaluadoModulo = null;
  modulo.pendiente = false;

  // Mínimos: si la media de un grupo no llega, no se aprueba el módulo
  // aunque la media del módulo dé 5 o más
  const minimos = modulo.minimos || { examenes: null, practicas: null };
  modulo.bajoMinimo = [];
  if (minimos.examenes !== null && modulo.mediaExamenes !== null && modulo.mediaExamenes < minimos.examenes) {
    modulo.bajoMinimo.push(`la media de exámenes (${formatear(modulo.mediaExamenes)}) no llega al mínimo de ${formatoPorcentaje.format(minimos.examenes)}`);
  }
  if (minimos.practicas !== null && modulo.mediaPracticas !== null && modulo.mediaPracticas < minimos.practicas) {
    modulo.bajoMinimo.push(`la media de actividades (${formatear(modulo.mediaPracticas)}) no llega al mínimo de ${formatoPorcentaje.format(minimos.practicas)}`);
  }

  if (!reparto) {
    // Sin reparto no se sabe cuánto vale cada grupo: la media queda pendiente
    modulo.pendiente = modulo.numNotas > 0;
    return;
  }

  // Se combinan los grupos que ya tienen media, en proporción a su reparto
  let suma = 0;
  let pesos = 0;
  if (modulo.mediaExamenes !== null) {
    suma += modulo.mediaExamenes * reparto.examenes;
    pesos += reparto.examenes;
  }
  if (modulo.mediaPracticas !== null) {
    suma += modulo.mediaPracticas * reparto.practicas;
    pesos += reparto.practicas;
  }
  modulo.media = pesos > 0 ? suma / pesos : null;

  // Parte de la nota final ya evaluada (solo si se puede saber en los dos grupos)
  const ex = reparto.examenes > 0 ? modulo.evaluadoExamenes : 0;
  const pr = reparto.practicas > 0 ? modulo.evaluadoPracticas : 0;
  if (ex !== null && pr !== null) {
    modulo.evaluadoModulo = (reparto.examenes * ex + reparto.practicas * pr) / 100;
  }

  // Si hay media pero a uno de los dos grupos (que sí cuenta) le falta,
  // la media es provisional: se calcula con el otro, en proporción
  if (modulo.media !== null) {
    if (reparto.examenes > 0 && modulo.mediaExamenes === null) {
      modulo.provisional = 'Provisional: de momento solo cuentan las actividades, porque ' +
        (examenes.some(a => a.nota !== null && a.porcentaje !== 0) ? 'a los exámenes con nota les falta el porcentaje.' : 'aún no hay exámenes con nota que cuenten.');
    } else if (reparto.practicas > 0 && modulo.mediaPracticas === null) {
      modulo.provisional = 'Provisional: de momento solo cuentan los exámenes, porque ' +
        (practicas.some(a => a.nota !== null && a.porcentaje !== 0) ? 'a las actividades con nota les falta el porcentaje.' : 'aún no hay actividades con nota que cuenten.');
    }
  }
}

// ¿Qué media hace falta en lo que queda para llegar a «objetivo» en el módulo?
// Cuando todo esté puesto, la media de cada grupo será
//   (lo ya puesto + X × lo pendiente) / todo lo del grupo
// y la del módulo, la combinación con el reparto. Es una recta en X: se despeja.
// Solo usa las notas añadidas (con o sin nota) y sus porcentajes: no inventa nada.
function cuantoNecesito(modulo, objetivo) {
  const reparto = modulo.reparto;
  if (!reparto) return { tipo: 'sin-reparto' };

  const grupos = [
    { nombre: 'exámenes', notas: modulo.grupos.examenes, vale: reparto.examenes, minimo: modulo.minimos.examenes },
    { nombre: 'actividades', notas: modulo.grupos.practicas, vale: reparto.practicas, minimo: modulo.minimos.practicas }
  ].filter(g => g.vale > 0);

  let fijo = 0;        // parte de la media del módulo que ya está decidida
  let porX = 0;        // cuánto sube la media del módulo por cada punto de X
  const valeTotal = grupos.reduce((total, g) => total + g.vale, 0);
  const pendientes = [];
  let necesario = -Infinity;

  for (const g of grupos) {
    const total = g.notas.reduce((suma, a) => suma + a.peso, 0);
    if (total === 0) return { tipo: 'faltan-notas', grupo: g.nombre };

    // Una nota con una recuperación pendiente se cuenta como pendiente: su
    // nota la decidirá la recuperación
    const enJuego = a => a.nota === null || Boolean(a.recuperacionEnCurso);
    const puesto = g.notas.filter(a => !enJuego(a)).reduce((suma, a) => suma + a.nota * a.peso, 0) / total;
    const queda = g.notas.filter(a => enJuego(a) && a.peso > 0);
    const pesoQueda = queda.reduce((suma, a) => suma + a.peso, 0) / total;
    pendientes.push(...queda.map(a => ({
      actividad: a.recuperacionEnCurso ? `${a.recuperacionEnCurso} (recuperación)` : a.actividad
    })));

    fijo += (g.vale / valeTotal) * puesto;
    porX += (g.vale / valeTotal) * pesoQueda;

    // Nota mínima del grupo
    if (g.minimo !== null) {
      if (pesoQueda === 0) {
        if (puesto < g.minimo) return { tipo: 'imposible', motivo: `la media de ${g.nombre} ya no llega al mínimo de ${formatoPorcentaje.format(g.minimo)}` };
      } else {
        necesario = Math.max(necesario, (g.minimo - puesto) / pesoQueda);
      }
    }
  }

  if (porX === 0) return { tipo: 'nada-pendiente' };
  necesario = Math.max(necesario, (objetivo - fijo) / porX);

  if (necesario > 10) return { tipo: 'imposible', pendientes };
  if (necesario <= 0) return { tipo: 'asegurado', pendientes };
  return { tipo: 'necesitas', nota: Math.ceil(necesario * 100) / 100, pendientes };
}


// ---------- Media del curso ----------

// Media del curso: ponderada por las horas de cada módulo, como la nota final
// oficial del cicle. Si a algún módulo con media le faltan las horas, es una
// media simple y se dice cuáles faltan.
function mediaDelCurso(lista) {
  const conMedia = lista.filter(m => m.media !== null);
  if (conMedia.length === 0) return { media: null, ponderada: false, sinHoras: [] };

  const sinHoras = conMedia.filter(m => !(m.horas > 0)).map(m => m.sigla);
  if (sinHoras.length === 0) {
    const horas = conMedia.reduce((total, m) => total + m.horas, 0);
    const suma = conMedia.reduce((total, m) => total + m.media * m.horas, 0);
    return { media: suma / horas, ponderada: true, sinHoras };
  }
  const suma = conMedia.reduce((total, m) => total + m.media, 0);
  return { media: suma / conMedia.length, ponderada: false, sinHoras };
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


// ---------- Comprobar archivos que se cargan ----------

// Devuelve la lista de problemas de una copia o de un archivo de módulos
// (vacía si todo está bien). Así un archivo dañado o editado a mano no puede
// estropear las medias: se rechaza y se dice qué le pasa.
function problemasArchivo(contenido, soloModulos = false) {
  const problemas = [];
  const esTexto = v => typeof v === 'string' && v.trim() !== '';
  const esNumero = v => typeof v === 'number' && Number.isFinite(v);
  const entre = (v, min, max) => esNumero(v) && v >= min && v <= max;
  const vacio = v => v === null || v === undefined;

  if (!Array.isArray(contenido.modulos)) return ['No tiene una lista de módulos.'];
  if (!soloModulos && !Array.isArray(contenido.notas)) return ['No tiene una lista de notas.'];

  if (!vacio(contenido.cursos)) {
    if (!Array.isArray(contenido.cursos)) problemas.push('La lista de cursos no es válida.');
    else contenido.cursos.forEach((c, i) => {
      if (!c || !esTexto(c.id) || !esTexto(c.nombre)) problemas.push(`El curso ${i + 1} no tiene nombre o identificador.`);
    });
  }

  contenido.modulos.forEach((m, i) => {
    const quien = m && esTexto(m.sigla) ? `El módulo ${m.sigla}` : `El módulo ${i + 1}`;
    if (!m || typeof m !== 'object') { problemas.push(`El módulo ${i + 1} no es válido.`); return; }
    if (!soloModulos && !esTexto(m.id)) problemas.push(`${quien} no tiene identificador.`);
    if (!esTexto(m.nombre)) problemas.push(`${quien} no tiene nombre.`);
    if (!esTexto(m.sigla)) problemas.push(`El módulo ${i + 1} no tiene sigla.`);
    if (!vacio(m.reparto)) {
      const r = m.reparto;
      if (!r || !entre(r.examenes, 0, 100) || !entre(r.practicas, 0, 100) ||
          r.examenes + r.practicas > 100 || r.examenes + r.practicas === 0) {
        problemas.push(`${quien} tiene un reparto de exámenes y actividades que no es válido.`);
      }
    }
    if (!vacio(m.horas) && !(esNumero(m.horas) && m.horas > 0)) problemas.push(`${quien} tiene unas horas que no son válidas.`);
    if (!vacio(m.minimos)) {
      for (const grupo of ['examenes', 'practicas']) {
        if (!vacio(m.minimos[grupo]) && !entre(m.minimos[grupo], 0, 10)) {
          problemas.push(`${quien} tiene una nota mínima que no está entre 0 y 10.`);
        }
      }
    }
  });

  if (!soloModulos) {
    const ids = new Set(contenido.modulos.map(m => m && m.id));
    contenido.notas.forEach((n, i) => {
      const quien = n && esTexto(n.actividad) ? `La nota «${n.actividad}»` : `La nota ${i + 1}`;
      if (!n || typeof n !== 'object') { problemas.push(`La nota ${i + 1} no es válida.`); return; }
      if (!esTexto(n.id)) problemas.push(`${quien} no tiene identificador.`);
      if (!ids.has(n.moduloId)) problemas.push(`${quien} es de un módulo que no está en el archivo.`);
      if (!esTexto(n.actividad)) problemas.push(`La nota ${i + 1} no tiene nombre.`);
      if (!esTexto(n.tipo)) problemas.push(`${quien} no tiene tipo (examen o actividad).`);
      if (!vacio(n.nota) && !entre(n.nota, 0, 10)) problemas.push(`${quien} tiene una nota que no es un número de 0 a 10.`);
      if (!vacio(n.porcentaje) && !entre(n.porcentaje, 0, 100)) problemas.push(`${quien} tiene un porcentaje que no está entre 0 y 100.`);
      if (!vacio(n.fecha) && !/^\d{4}-\d{2}-\d{2}$/.test(n.fecha)) problemas.push(`${quien} tiene una fecha que no es válida.`);
      if (!vacio(n.recuperaDe) && typeof n.recuperaDe !== 'string') problemas.push(`${quien} tiene una recuperación que no es válida.`);
    });
  }

  return problemas;
}
