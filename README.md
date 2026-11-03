# Cinc

Cinc es una app web (PWA) para apuntar las notas de clase y ver las medias de cada módulo. Cada persona crea sus módulos, añade sus notas y Cinc calcula las medias. Funciona sin cuentas ni servidor: los datos se guardan en el propio dispositivo (`localStorage`).

Web: https://cristianvalentinmazilumoya.github.io/Cinc./

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página y los formularios (`<dialog>`) |
| `styles.css` | Diseño (modo claro y oscuro) |
| `app.js` | Guarda los datos, pinta la página y gestiona los formularios |
| `calculos.js` | Cálculo de las medias, «¿Cuánto necesito?» y comprobación de archivos (sin tocar la página) |
| `pruebas.html` + `pruebas.js` | Pruebas automáticas de `calculos.js`: ábrela y todo debe salir en verde |
| `manifest.webmanifest` + `sw.js` | Lo que hace que la web se pueda instalar y abra sin conexión |
| `icons/` | Iconos (favicon, PWA, iPhone, Mac) |

## Cómo se usa

0. **Cursos:** arriba hay un botón por curso (por ejemplo «1.º DAW» y «2.º DAW») y «+ Curso» para crear otro. Cada curso tiene sus propios módulos; «Editar curso» (junto a «Módulos») cambia el nombre o lo borra con sus módulos y notas. Con dos o más cursos aparece «Ciclo»: la nota de todo el ciclo, ponderada por horas como la oficial, y un resumen por curso.
1. **Primer uso:** «Usar la plantilla de 1.º DAW» crea los módulos de DAW de golpe. También se pueden crear a mano («Crear un módulo») o cargar una copia de seguridad.
2. **Módulos:** la tarjeta «+ Módulo» crea uno nuevo, con su nombre, sigla y cuánto valen los exámenes y las actividades; «Editar módulo» (en el detalle) cambia esos datos o lo borra junto con sus notas.
3. **Notas:** «+ Añadir nota» arriba, o «+ Añadir nota de …» en el detalle de un módulo. Toca una fila de la tabla para editarla o borrarla. Si aún no hay nota, se deja vacía y sale como pendiente.
4. **Copia de seguridad:** botón «Copia». «Descargar copia» guarda un archivo `cinc-copia-AAAA-MM-DD.json` con todos los cursos, módulos y notas; en el móvil, «Compartir copia…» abre el menú del sistema para mandarla por WhatsApp, AirDrop, Drive o correo. «Cargar una copia» la recupera en este u otro dispositivo (sustituye lo que haya). Las copias de versiones anteriores, sin cursos, se cargan en un primer curso.
5. **Fechas:** cada nota puede tener una fecha. Las notas con fecha de hoy en adelante que aún no tienen nota salen arriba, en «Próximas fechas» (las 5 más cercanas); al tocar una se abre su módulo. «Añadir al calendario» descarga un archivo `.ics` con todas, con un aviso el día antes a las 9:00, que abren Calendario de Apple, Google Calendar y Outlook. En la tabla de cada módulo, las notas con fecha van primero, de la más antigua a la más nueva.
6. **Recuperaciones:** en «Recuperación de» se elige la nota que se recupera (del mismo módulo). La recuperación usa el tipo y el porcentaje de la original y, cuando tiene nota, la sustituye en la media; la original sale tachada. Mientras la recuperación no tiene nota, cuenta la original.
7. **Compartir módulos:** en «Copia», «Descargar módulos sin notas» guarda `cinc-modulos-AAAA-MM-DD.json` con el nombre, la sigla, el reparto, las horas y las notas mínimas de cada módulo, sin ninguna nota. Otra persona lo carga con «Cargar una copia…» en el curso que tenga abierto: se añaden los módulos nuevos y se actualizan los de la misma sigla, sin tocar sus notas.

8. **Deshacer:** al borrar una nota, un módulo o un curso sale abajo «Deshacer» durante 8 segundos.
9. **Acerca de Cinc** (abajo del todo): versión, dónde se guardan los datos, cómo se calculan las medias y enlace a las pruebas.

Las flechas ← → del detalle de un módulo cambian su orden dentro del curso.

Al cargar una copia o unos módulos, se comprueba cada dato (notas de 0 a 10, porcentajes, fechas, módulos que existen…). Si algo no es válido, no se carga nada y se dice qué falla.

### Dónde se guardan los datos

En `localStorage`, con la clave `cinc-datos`. Cada navegador y cada dispositivo tiene sus propios datos: no se sincronizan solos. Si alguien borra los datos del navegador, los pierde, por eso la app recuerda hacer una copia cuando hace más de un mes de la última.

La primera vez que se abre esta versión, si el navegador aún tenía las notas de la versión anterior (la que leía la hoja de Google), las pasa solas al formato nuevo.

## Cómo se calculan las medias

- **Reparto del módulo (imprescindible):** cuánto valen los exámenes y cuánto las actividades en la nota del módulo (por ejemplo, 60 % y 40 %). Se indica al crear o editar el módulo. **Sin reparto, la media del módulo queda pendiente**, con un aviso y un botón para indicarlo. Si los dos suman menos de 100 (por ejemplo DIG, 35 % y 45 %), el resto aún no cuenta.
- **Porcentaje de cada nota (opcional):** cuánto vale dentro de los exámenes o dentro de las actividades; los de un grupo suman 100 % (por ejemplo, tres actividades de 20 %, 30 % y 50 %). Si ninguna nota del grupo lo tiene, todas cuentan lo mismo. Si solo algunas lo tienen, las que no lo tienen no cuentan (la app no inventa lo que valen) y se avisa.
- **Media de exámenes / actividades:** media ponderada de las notas puestas, en proporción. Si de 20 %, 30 % y 50 % solo hay nota de las dos primeras, la media se calcula con esas dos como si fueran el 100 % y la app indica «sobre el 50 % evaluado».
- **Media del módulo:** se combinan las dos medias con el reparto del módulo. Si solo uno de los dos grupos tiene media, la del módulo es la de ese grupo y se marca como provisional, con el motivo. Un grupo que vale 0 % nunca cuenta.
- **Parte evaluada de la nota final:** si se puede saber (los grupos con notas usan porcentajes), debajo de la media del módulo se indica qué parte de la nota final ya está evaluada.
- **Nota mínima (opcional):** cada módulo puede tener una nota mínima en la media de exámenes y otra en la de actividades. Si una media no llega, el módulo sale como «Bajo el mínimo», en rojo, con un aviso: no se aprueba aunque la media dé 5 o más.
- **¿Cuánto necesito?:** en cada módulo con reparto y notas pendientes, la app calcula qué media hace falta en lo que queda para sacar un 5 (o la nota que se elija, de 5 a 10). Usa solo las notas añadidas y sus porcentajes, y tiene en cuenta las notas mínimas. Una recuperación pendiente cuenta como algo que queda: su nota sustituirá a la original. Si es imposible o ya está asegurado, lo dice.
- **Media del curso:** como la nota final oficial del ciclo en Catalunya, es la media de los módulos ponderada por sus horas. Si a algún módulo con media le faltan las horas, es una media simple y la app dice de qué módulos faltan. Las horas de la plantilla de DAW están vacías: hay que ponerlas a mano (no hay una fuente clara y única de las horas del plan actual).

### Avisos

- Pendiente: el módulo tiene notas pero no tiene reparto.
- Hay notas puestas que no cuentan porque, en su grupo, otras sí tienen porcentaje y ellas no.
- Los porcentajes de un grupo suman más del 100 %.
- Todos los porcentajes de un grupo suman justo lo que vale el grupo en la nota final (por ejemplo 10 + 10 + 20 = 40 % en las actividades de un 60/40): seguramente se han puesto sobre la nota final y no dentro del grupo.
- Un grupo vale 0 % en el reparto pero tiene notas.

Las notas y los porcentajes aceptan coma o punto decimal (`8,5` o `8.5`).

## Pruebas

Abre `pruebas.html` (en local o en la web publicada). Cada caso de cálculo sale en verde si da lo esperado y en rojo si no. Si cambias `calculos.js`, vuelve a abrirla.

## Probar en el Mac

El service worker no funciona abriendo el archivo con doble clic; hace falta un servidor local. Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Y abre http://localhost:8000. Para pararlo: `Ctrl + C`.

## Publicar cambios

La web se publica con GitHub Pages desde la rama `main`. Al hacer push a `main`, en un minuto está en línea.

Si modificas `index.html`, `styles.css` o `app.js`, sube el número de `CACHE` en `sw.js` (`cinc-v27` → `cinc-v28`). Las apps instaladas se actualizan solas la próxima vez que se abren con conexión.

## Instalarla

- **Mac con Safari:** abre la web → menú **Archivo → Añadir al Dock**.
- **Mac con Chrome:** icono de instalar a la derecha de la barra de direcciones.
- **iPhone (Safari):** botón Compartir → **Añadir a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ → **Instalar aplicación**.
