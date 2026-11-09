# Registro de Cinc

## Pendiente

- [Cinc.] Elegir entre los nombres Cinc, Traça y Barem (propuestas en `prototipos/identidad/`) · empezada por Codex · 2026-11-09
- [Cinc.] Revisar en el iPhone el nuevo diseño «Panel de curso» (versión 3.0) y pedir los ajustes que hagan falta · empezada por Claude Code · 2026-11-10

## Historial

2026-11-09 23:32 · Codex · Cinc. · Pedido: crear prototipos de nombre y logo para la aplicación · Hecho: lámina comparativa con Cinc, Nota a nota y Quadern, símbolos y variantes de icono; capturas móvil/escritorio en claro/oscuro · Pendiente: Cristian elige si mantiene Cinc o prefiere otra identidad

2026-11-09 23:32 · Codex · Cinc. · Pedido: quitar de la propuesta C el avance estimado de evaluación porque las pruebas aún no están todas registradas · Hecho: eliminado el porcentaje y reorganizada la cabecera para mostrar solo la media según las notas guardadas y la próxima fecha registrada; capturas y documentación actualizadas · Pendiente: Cristian revisa la propuesta C ajustada y confirma si quiere aplicarla

2026-11-09 23:32 · Codex · Cinc. · Pedido: revisar los prototipos porque eran la misma distribución con distinto color · Hecho: rehice las tres composiciones (familiar, módulos en lateral y panel de curso), actualicé las capturas y documenté sus diferencias · Pendiente: Cristian revisa las nuevas distribuciones y elige una

2026-11-09 22:47 · Codex · Cinc. · Pedido: completar el rediseño encargado con prototipos y capturas · Hecho: tres prototipos estáticos y 12 capturas PNG (móvil/escritorio, claro/oscuro), documentados en `prototipos/README.md`; la app real no se modificó · Pendiente: Cristian elige una propuesta para aplicarla a la app real

2026-11-09 22:27 · Claude Code · Cinc. · Pedido: activar la memoria compartida y dejar a Codex el rediseño de la app con capturas de prototipos · Hecho: CONTEXTO.md (qué es, estructura, decisiones y el encargo de rediseño) y este registro · Pendiente: Codex crea los prototipos y las capturas en prototipos/

2026-11-09 23:53 · Codex · Cinc. · Pedido: desarrollar mejor las propuestas de nombre y logo · Hecho: rehice la lámina con argumentos de marca, voz, paleta y ejemplo aplicado a la interfaz; añadí tres símbolos SVG independientes y capturas completas de escritorio · Pendiente: Cristian decide si conserva Cinc o adopta otra identidad

2026-11-10 00:09 · Codex · Cinc. · Pedido: buscar nombres mejores y trabajar más los iconos del logo · Hecho: nueva comparación con Cinc, Traça y Barem; tres símbolos SVG originales redibujados para conservar la misma forma en cada tamaño; documentación y capturas actualizadas · Pendiente: Cristian elige nombre e identidad

2026-11-10 00:13 · Codex · Cinc. · Pedido: revisar y pulir las propuestas de nombre y los iconos · Hecho: símbolos afinados y comparativa visual verificada en claro/oscuro; se retiraron los conceptos anteriores y se actualizaron las referencias del proyecto · Pendiente: Cristian elige nombre e identidad

2026-11-10 00:28 · Claude Code · Cinc. · Pedido: aplicar a la app real el prototipo C («Panel de curso») · Hecho: nueva estructura en index.html (media y próxima fecha arriba, módulos junto a la agenda, detalle con las notas en una sola lista), styles.css reescrito con acento verde azulado y contrastes de 4,5:1 o más, app.js adaptado sin quitar funciones (sincronizar, copia, ¿cuánto necesito?, reparto, mínimos, ciclo); versión 3.0 y caché cinc-v34; 47 pruebas en verde y clics comprobados. Las capturas de 390 px salían recortadas porque Chrome sin ventana no baja de 500 px (anotado en CONTEXTO.md) · Pendiente: Cristian lo revisa en el iPhone

## Resumen

Antes de activar la memoria compartida, Cinc pasó de leer una hoja de Google a ser una PWA con datos locales, cursos (1.º, 2.º, Ciclo), copias de seguridad, pruebas de los cálculos y sincronización con Firebase entre Mac e iPhone. Se quitó el código de la antigua hoja, se ordenaron las notas (sin fecha con nota primero, luego por fecha) y se pusieron fechas a las 35 notas a partir de Moodle.
